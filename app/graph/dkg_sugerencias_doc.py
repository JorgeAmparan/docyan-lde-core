"""
Consultas sugeridas por documento — derivadas del CONTENIDO real del grafo DKG.

Alimenta el bloque "Consultas sugeridas sobre este documento" del `DocDetail` del
Expediente (UI Capa A · P1). NO son preguntas inventadas: se derivan de QUÉ tipos
de contenido extrajo la ingesta para ese documento (`:CONTIENE`→labels). Si el
documento tiene `:Procedimiento`, se sugiere preguntar por el procedimiento; si
tiene `:Especificacion`, por las especificaciones; etc. Un documento sin esos
contenidos no recibe esa sugerencia — sin afordancias huecas.

Multi-tenant ESTRICTO: `client.query(tenant_id, ...)`. FalkorDB-safe.

Cada sugerencia: {icono, texto, tipo_intencion} — el shape que consume `ed-sug`.
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("docyan.dkg.sugerencias")

# label de contenido en el grafo → (icono, texto sugerido, tipo de intención).
# El texto es una AFORDANCIA derivada de que ese contenido existe en el doc, no un
# hecho fabricado: el operador la pulsa y entra a Consultar.
_SUGERENCIA_POR_LABEL: dict[str, tuple[str, str, str]] = {
    "Especificacion": ("ruler", "¿Cuáles son las especificaciones técnicas?", "informativa"),
    "Procedimiento": ("list-checks", "Muéstrame el procedimiento paso a paso", "procedimiento"),
    "RecursoVisual": ("image", "Muéstrame el diagrama", "recurso_visual"),
    "RecursoVideo": ("play-circle", "¿Hay un video de apoyo?", "video"),
    "ArbolDiagnostico": ("wrench", "¿Qué hago si algo falla?", "troubleshoot"),
    "Alerta": ("alarm-clock", "¿Qué vencimientos o alertas hay?", "alertas"),
    "CertificadoVigencia": ("calendar", "¿Cuándo vence la calibración?", "alertas"),
    "MedicionRegistrada": ("history", "Muéstrame el historial de mediciones", "historial"),
}

# Orden de presentación (los más útiles primero) y tope de sugerencias mostradas.
_ORDEN = list(_SUGERENCIA_POR_LABEL.keys())
_MAX_SUGERENCIAS = 4


def sugerencias_por_documento(client: Any, tenant_id: str, doc_id: str) -> list[dict]:
    """
    Sugiere consultas según los tipos de contenido que el documento realmente tiene
    en el grafo. Devuelve [] si el documento no tiene contenido mapeable.
    """
    try:
        rows = client.query(
            tenant_id,
            "MATCH (d:DocumentoSource {id: $id})-[:CONTIENE]->(n) "
            "RETURN labels(n)[0] AS label, count(n) AS cnt",
            {"id": doc_id},
        ) or []
    except Exception as exc:  # noqa: BLE001 — sin sugerencias antes que tumbar el expediente
        logger.warning("sugerencias: query falló (%s): %s", tenant_id, type(exc).__name__)
        return []

    presentes = {r.get("label") for r in rows if r.get("label") and int(r.get("cnt") or 0) > 0}

    sugerencias: list[dict] = []
    for label in _ORDEN:
        if label in presentes:
            icono, texto, intencion = _SUGERENCIA_POR_LABEL[label]
            sugerencias.append({"icono": icono, "texto": texto, "tipo_intencion": intencion})
        if len(sugerencias) >= _MAX_SUGERENCIAS:
            break
    return sugerencias
