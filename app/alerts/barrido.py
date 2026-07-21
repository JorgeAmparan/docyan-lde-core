"""
Barrido de vencimientos del scheduler (ED-1 §2.2 / Adenda ED §2.1).

DOCYAN LDE™ by XCID.

`evaluate_vencimientos` real (cron 6am): recorre el grafo de cada tenant, evalúa
`:CertificadoVigencia` / `:CertificadoCalibracion` / `:FechaVencimiento` contra los
thresholds de la `ReglaAlerta` del tenant y crea/actualiza `:Alerta` cuando una
fecha cruza un threshold, notificando por los canales configurados. Idempotente:
`app.alerts.despacho` deduplica por `(entidad, fecha, threshold)` en la propia
`:Alerta` (segunda corrida = 0 duplicados, 0 renotificaciones).

Complementa (no reemplaza) la generación en ingesta: cubre el paso del tiempo sobre
documentos ya ingeridos.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone

from app.alerts import despacho as _despacho
from app.alerts.reglas import DEFAULT_THRESHOLDS, regla_aplicable
from app.eventos_dirigidos import ciclo_vida
from app.eventos_dirigidos.fat import registrar_transicion

logger = logging.getLogger("docyan.alerts.barrido")

# Query robusta: acepta las tres etiquetas de fecha administrativa y varios nombres
# de propiedad de fecha (los schemas por tipo documental no las nombran igual).
_CYPHER_VENCIMIENTOS = """
MATCH (c)
WHERE (c:CertificadoVigencia OR c:CertificadoCalibracion OR c:FechaVencimiento)
      AND coalesce(c.fecha_vencimiento, c.fecha, c.valor) IS NOT NULL
OPTIONAL MATCH (ent:EntidadOperativa)-[]->(c)
RETURN c.id AS cert_id,
       coalesce(c.nombre, c.folio, c.descripcion, 'vencimiento') AS nombre,
       coalesce(c.fecha_vencimiento, c.fecha, c.valor) AS fecha_vencimiento,
       ent.id AS entidad_id
"""


def _parse_fecha(valor) -> date | None:
    if not valor:
        return None
    s = str(valor)[:10]
    try:
        y, m, d = (int(x) for x in s.split("-"))
        return date(y, m, d)
    except (ValueError, TypeError):
        return None


def evaluar_vencimientos_tenant(
    client,
    tenant_id: str,
    *,
    hoy: date | None = None,
    horizonte_dias: int = 90,
    notificador=None,
    fat=None,
) -> dict:
    """
    Barre los vencimientos de un tenant y despacha alertas. Devuelve contadores:
    {creadas, actualizadas, sin_cambio, fuera_de_horizonte, cuarentena, notificadas}.
    """
    hoy = hoy or date.today()
    regla = regla_aplicable(client, tenant_id, "*")
    contadores = {
        "creadas": 0, "actualizadas": 0, "sin_cambio": 0,
        "fuera_de_horizonte": 0, "cuarentena": 0, "notificadas": 0,
    }
    rows = client.query(tenant_id, _CYPHER_VENCIMIENTOS, {})
    for r in rows:
        fecha = _parse_fecha(r.get("fecha_vencimiento"))
        if fecha is None:
            continue
        res = _despacho.procesar_vencimiento(
            client, tenant_id,
            cert_id=r.get("cert_id"), nombre=r.get("nombre") or "vencimiento",
            fecha=fecha, entidad_id=r.get("entidad_id"), hoy=hoy, regla=regla,
            origen="scheduler", horizonte_dias=horizonte_dias,
            notificador=notificador, fat=fat,
        )
        # ResultadoDespacho.resultado es singular (creada/actualizada); el contador
        # usa la forma plural. Los demás códigos coinciden 1-a-1.
        clave = {"creada": "creadas", "actualizada": "actualizadas"}.get(res.resultado, res.resultado)
        contadores[clave] = contadores.get(clave, 0) + 1
        if res.notificada:
            contadores["notificadas"] += 1
    logger.info("barrido vencimientos | tenant=%s | %s", tenant_id, contadores)
    return contadores


def evaluar_escalaciones_tenant(
    client,
    tenant_id: str,
    *,
    ahora: datetime | None = None,
    notificador=None,
    fat=None,
) -> dict:
    """
    Escalación automática (§2.3.4): alertas en estado `notificado` con más de
    `regla.escalacion_dias` desde `notificado_ts` sin pasar a `reconocido` se
    transicionan a `escalado` y se notifica al destinatario de escalación.
    """
    ahora = ahora or datetime.now(timezone.utc)
    regla = regla_aplicable(client, tenant_id, "*")
    contadores = {"evaluadas": 0, "escaladas": 0}
    if not regla.escalacion_dias:
        return contadores

    rows = client.query(
        tenant_id,
        "MATCH (a:Alerta {estado:'notificado'}) "
        "RETURN a.id AS id, a.descripcion AS descripcion, a.urgencia AS urgencia, "
        "a.fecha_vencimiento AS fecha_vencimiento, a.entidad_id AS entidad_id, "
        "a.notificado_ts AS notificado_ts",
        {},
    )
    for r in rows:
        contadores["evaluadas"] += 1
        ts = r.get("notificado_ts")
        if not ts:
            continue
        try:
            notificado_dt = datetime.fromisoformat(str(ts))
        except ValueError:
            continue
        if notificado_dt.tzinfo is None:
            notificado_dt = notificado_dt.replace(tzinfo=timezone.utc)
        dias_sin_reconocer = (ahora - notificado_dt).days
        if dias_sin_reconocer < regla.escalacion_dias:
            continue

        alerta_id = r.get("id")
        client.query(
            tenant_id, "MATCH (a:Alerta {id:$id}) SET a.estado=$e, a.escalado_ts=$ts",
            {"id": alerta_id, "e": ciclo_vida.ESCALADO, "ts": ahora.isoformat()},
        )
        contadores["escaladas"] += 1
        if fat is not None:
            try:
                registrar_transicion(
                    fat, tenant_id, evento_tipo="alerta", evento_id=alerta_id,
                    estado_anterior=ciclo_vida.NOTIFICADO, estado_nuevo=ciclo_vida.ESCALADO,
                    accion="escalar_auto",
                    extra={"dias_sin_reconocer": dias_sin_reconocer},
                )
            except Exception:  # noqa: BLE001
                logger.warning("no se pudo registrar FAT de escalación (%s)", alerta_id)

        # Notificar al destinatario de escalación (si está configurado).
        if notificador is not None and regla.escalacion_destinatario_id:
            from app.alerts.reglas import ReglaAlerta

            regla_escalacion = ReglaAlerta(
                tenant_id=tenant_id, tipo=regla.tipo, thresholds=regla.thresholds,
                urgencias=regla.urgencias, destinatarios=[regla.escalacion_destinatario_id],
                canales=regla.canales,
            )
            alerta_dict = {
                "id": alerta_id, "descripcion": r.get("descripcion") or "",
                "urgencia": r.get("urgencia") or "alta",
                "fecha_vencimiento": r.get("fecha_vencimiento"),
                "entidad_id": r.get("entidad_id"), "dias": dias_sin_reconocer,
            }
            notificador.notificar_alerta(
                tenant_id, alerta=alerta_dict, regla=regla_escalacion,
                tipo_evento="alerta_escalacion",
            )
    logger.info("escalaciones | tenant=%s | %s", tenant_id, contadores)
    return contadores


def evaluar_vencimientos_todos(*, hoy=None, notificador=None, fat=None) -> dict:
    """
    Barrido global (todos los tenants vivos). Un tenant que falla NO tumba el
    barrido. Registra FAT de la corrida (inicio, tenants, alertas creadas, errores).
    Cablea los backends de producción de forma perezosa; los tests llaman a
    `evaluar_vencimientos_tenant` directamente con backends en memoria.
    """
    from app.graph.dkg_client import dkg_client
    from app.orchestrator import providers

    fat = fat or _get_fat_lazy()
    if notificador is None:
        from app.eventos_dirigidos.notificador import build_notificador

        notificador = build_notificador(dkg=dkg_client)

    tenants = providers.tenants_vivos()
    total = {"creadas": 0, "actualizadas": 0, "sin_cambio": 0,
             "fuera_de_horizonte": 0, "cuarentena": 0, "notificadas": 0}
    errores = 0
    for tenant_id in tenants:
        try:
            c = evaluar_vencimientos_tenant(
                dkg_client, tenant_id, hoy=hoy, notificador=notificador, fat=fat
            )
            for k, v in c.items():
                total[k] = total.get(k, 0) + v
            evaluar_escalaciones_tenant(dkg_client, tenant_id, notificador=notificador, fat=fat)
        except Exception as exc:  # noqa: BLE001 — un tenant no tumba el barrido.
            errores += 1
            logger.warning("barrido vencimientos falló para tenant %s: %s", tenant_id, type(exc).__name__)

    resumen = {
        "evaluado": True, "tipo": "vencimientos_administrativos",
        "tenants": len(tenants), "errores": errores, **total,
    }
    _fat_run(fat, resumen)
    logger.info("barrido vencimientos GLOBAL | %s", resumen)
    return resumen


def _get_fat_lazy():
    from app.eventos_dirigidos.fat import get_fat

    return get_fat()


def _fat_run(fat, resumen: dict) -> None:
    if fat is None:
        return
    try:
        from app.audit.familias import FamiliaFAT

        fat.registrar(
            tipo_evento="evento_dirigido.barrido_vencimientos",
            familia=FamiliaFAT.F10_EVENTO_DIRIGIDO,
            tenant_id="__system__", actor_tipo="scheduler", actor_id="evaluate_vencimientos",
            payload=resumen,
        )
    except Exception:  # noqa: BLE001
        logger.warning("no se pudo registrar FAT de la corrida del barrido")


# Umbral de horizonte por defecto derivado de thresholds default (para claridad).
DEFAULT_HORIZONTE_DIAS = max(DEFAULT_THRESHOLDS + [90])
