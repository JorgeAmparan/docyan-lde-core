"""
Generador de alertas administrativas al cierre de ingesta (B9.5 §1.1 Tipo 7).

DOCYAN LDE™ by XCID.

Deriva nodos `:Alerta` desde los vencimientos YA ingeridos (`:CertificadoVigencia`
/ `:CertificadoCalibracion` con `fecha_vencimiento`, y `:FechaVencimiento`). NO
extrae alertas del LLM: las COMPUTA de datos administrativos (fechas), por eso son
administrativas por construcción.

ED-1: esta ruta (`origen = ingesta`) converge en `app.alerts.despacho`, el núcleo
compartido con el barrido del scheduler y las alertas manuales. Puede además
notificar si se le pasa un `notificador` (§2.4.5: las tres rutas disparan
notificación). Sin notificador se comporta como antes (solo persiste la `:Alerta`).

LÍNEA ABSOLUTA (CLAUDE.md §11.1): `despacho` pasa toda descripción por
`safety_validator` antes de persistir; una alerta con sugerencia clínica/operativa
NO se crea (cuenta como `cuarentena`).
"""
from __future__ import annotations

import logging
from datetime import date
from typing import Any

from app.alerts import despacho as _despacho
from app.alerts.reglas import ReglaAlerta, regla_aplicable

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


def generar_alertas_vencimiento(
    client: Any,
    tenant_id: str,
    *,
    hoy: date | None = None,
    horizonte_dias: int = 90,
    regla: ReglaAlerta | None = None,
    notificador: Any = None,
    fat: Any = None,
) -> dict[str, int]:
    """
    Crea `:Alerta` administrativas para certificados cuyo vencimiento cae dentro de
    `horizonte_dias`. Idempotente (MERGE + dedup de thresholds en `despacho`).

    Devuelve contadores: {creadas, fuera_de_horizonte, cuarentena}.
    """
    hoy = hoy or date.today()
    regla = regla or regla_aplicable(client, tenant_id, "*")
    counters = {"creadas": 0, "fuera_de_horizonte": 0, "cuarentena": 0}

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
        res = _despacho.procesar_vencimiento(
            client, tenant_id,
            cert_id=r.get("cert_id"), nombre=r.get("nombre") or "certificado",
            fecha=fecha, entidad_id=r.get("entidad_id"), hoy=hoy, regla=regla,
            origen="ingesta", horizonte_dias=horizonte_dias,
            notificador=notificador, fat=fat,
        )
        if res.resultado == "creada":
            counters["creadas"] += 1
        elif res.resultado == "fuera_de_horizonte":
            counters["fuera_de_horizonte"] += 1
        elif res.resultado == "cuarentena":
            counters["cuarentena"] += 1

    logger.info("alertas generadas | tenant=%s | %s", tenant_id, counters)
    return counters
