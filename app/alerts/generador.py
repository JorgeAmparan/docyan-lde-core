"""
Generador de alertas administrativas (B9.5 §1.1 Tipo 7).

DOCYAN LDE™ by XCID.

Deriva nodos `:Alerta` desde los vencimientos YA ingeridos (`:CertificadoVigencia`
/ `:CertificadoCalibracion` con `fecha_vencimiento`, y `:FechaVencimiento`). NO
extrae alertas del LLM: las COMPUTA de datos administrativos (fechas), por eso son
administrativas por construcción.

LÍNEA ABSOLUTA (CLAUDE.md §11.1): toda alerta candidata pasa por
`safety_validator.validar_alerta` antes de persistirse. Una alerta con sugerencia
clínica/operativa NO se crea (se descarta y se reporta en los contadores). El gate
es defensa en profundidad: aunque la plantilla es administrativa, si un nombre de
certificado arrastrara texto decisorio, la línea lo frena.

Las alertas describen SOLO el hecho administrativo ("X vence el YYYY-MM-DD"),
jamás qué hacer al respecto.
"""
from __future__ import annotations

import logging
from datetime import date
from typing import Any

from app.alerts.safety_validator import validar_alerta

logger = logging.getLogger("docyan.alerts.generador")


def _parse_fecha(valor: Any) -> date | None:
    """Parsea una fecha ISO (YYYY-MM-DD) tolerante. None si no parsea."""
    if not valor:
        return None
    s = str(valor)[:10]
    try:
        y, m, d = (int(x) for x in s.split("-"))
        return date(y, m, d)
    except (ValueError, TypeError):
        return None


def _urgencia(dias: int) -> str:
    """Urgencia administrativa por días al vencimiento (no decisión operativa)."""
    if dias <= 15:
        return "alta"
    if dias <= 45:
        return "media"
    return "baja"


def generar_alertas_vencimiento(
    client: Any,
    tenant_id: str,
    *,
    hoy: date | None = None,
    horizonte_dias: int = 90,
) -> dict[str, int]:
    """
    Crea `:Alerta` administrativas para certificados cuyo vencimiento cae dentro de
    `horizonte_dias`. Idempotente: la alerta usa un `id` derivado del certificado +
    fecha, con `MERGE` (re-correr no duplica).

    Devuelve contadores: {creadas, vigentes_omitidas, cuarentena}.
    """
    hoy = hoy or date.today()
    counters = {"creadas": 0, "fuera_de_horizonte": 0, "cuarentena": 0}

    # Certificados con fecha de vencimiento (el espejo :CertificadoVigencia lo crea
    # el bridge; se aceptan ambas etiquetas por robustez).
    rows = client.query(
        tenant_id,
        """
        MATCH (c)
        WHERE (c:CertificadoVigencia OR c:CertificadoCalibracion)
              AND c.fecha_vencimiento IS NOT NULL
        OPTIONAL MATCH (ent:EntidadOperativa)-[]->(c)
        RETURN c.id AS cert_id,
               coalesce(c.nombre, c.folio, c.descripcion, 'certificado') AS nombre,
               c.fecha_vencimiento AS fecha_vencimiento,
               ent.id AS entidad_id
        """,
        {},
    )

    for r in rows:
        fecha = _parse_fecha(r.get("fecha_vencimiento"))
        if fecha is None:
            continue
        dias = (fecha - hoy).days
        if dias < 0 or dias > horizonte_dias:
            counters["fuera_de_horizonte"] += 1
            continue

        nombre = r.get("nombre") or "certificado"
        descripcion = f"{nombre} vence el {fecha.isoformat()} (en {dias} días)."

        # Gate absoluto: solo administrativas se persisten.
        veredicto = validar_alerta(descripcion)
        if not veredicto.admisible:
            counters["cuarentena"] += 1
            logger.warning(
                "alerta NO administrativa descartada (tenant=%s cert=%s): %s",
                tenant_id, r.get("cert_id"), veredicto.motivo,
            )
            continue

        alerta_id = f"alert_{r.get('cert_id')}_{fecha.isoformat()}"
        client.query(
            tenant_id,
            """
            MERGE (a:Alerta {id: $id})
            SET a.descripcion = $descripcion,
                a.fecha_vencimiento = $fecha,
                a.urgencia = $urgencia,
                a.tipo = 'vencimiento',
                a.entidad_id = $entidad_id,
                a.administrativa = true
            WITH a
            OPTIONAL MATCH (ent:EntidadOperativa {id: $entidad_id})
            FOREACH (_ IN CASE WHEN ent IS NULL THEN [] ELSE [1] END |
                MERGE (ent)-[:CONTIENE]->(a))
            """,
            {
                "id": alerta_id,
                "descripcion": descripcion,
                "fecha": fecha.isoformat(),
                "urgencia": _urgencia(dias),
                "entidad_id": r.get("entidad_id"),
            },
        )
        counters["creadas"] += 1

    logger.info("alertas generadas | tenant=%s | %s", tenant_id, counters)
    return counters
