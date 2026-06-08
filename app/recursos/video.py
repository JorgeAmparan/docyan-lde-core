"""
Adjuntar video como recurso visual de apoyo (B9.5 §1.1 Tipo 4 / decisión B).

DOCYAN LDE™ by XCID.

Decisión (B): el video ENTRA como recurso de ayuda visual que DOCYAN presenta —
como el PDF original o un diagrama. **NO se analiza ni se transcribe**: se asocia
un archivo de video al documento/entidad y se sirve como apoyo. No es un pipeline
de análisis.

Crea el `:RecursoVideo` que el reader del Tipo 4 ya consulta, con `url` servible y
capítulos/marcadores opcionales si el documento los aporta (no derivados del
video). La bandera `subtitulos_disponibles_en_par_activo` permanece honesta: solo
true si el documento trae subtítulos en el par activo (no se generan).
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("docyan.recursos.video")


def adjuntar_video(
    client: Any,
    tenant_id: str,
    *,
    titulo: str,
    video_url: str,
    recurso_id: str | None = None,
    doc_id: str | None = None,
    entidad_id: str | None = None,
    acompana_procedimiento_id: str | None = None,
    capitulos: list[dict] | None = None,
) -> str:
    """
    Asocia un video como recurso de apoyo. `capitulos` opcional: lista de
    `{titulo, inicio_seg}` provistos por el documento (no extraídos del video).
    Devuelve el `recurso_id`. Idempotente (`MERGE`).
    """
    rid = recurso_id or f"vid_{abs(hash((tenant_id, video_url))) & 0xFFFFFFFF:x}"
    client.query(
        tenant_id,
        """
        MERGE (v:RecursoVideo {id:$id})
        SET v.titulo = $titulo, v.url = $url, v.par_activo = coalesce(v.par_activo, false)
        """,
        {"id": rid, "titulo": titulo, "url": video_url},
    )
    for i, c in enumerate(capitulos or []):
        cid = f"{rid}_cap{i}"
        client.query(
            tenant_id,
            """
            MATCH (v:RecursoVideo {id:$rid})
            MERGE (c:Capitulo {id:$cid})
            SET c.titulo = $titulo, c.inicio_seg = $inicio
            MERGE (v)-[:CONTIENE]->(c)
            """,
            {"rid": rid, "cid": cid, "titulo": c.get("titulo"), "inicio": c.get("inicio_seg", 0)},
        )
    if acompana_procedimiento_id:
        client.query(
            tenant_id,
            """
            MATCH (v:RecursoVideo {id:$rid}), (p:Procedimiento {id:$pid})
            MERGE (p)-[:CONTIENE]->(v)
            """,
            {"rid": rid, "pid": acompana_procedimiento_id},
        )
    if doc_id:
        client.query(
            tenant_id,
            "MATCH (d:DocumentoSource {id:$doc}), (v:RecursoVideo {id:$rid}) MERGE (d)-[:CONTIENE]->(v)",
            {"doc": doc_id, "rid": rid},
        )
    if entidad_id:
        client.query(
            tenant_id,
            "MATCH (e:EntidadOperativa {id:$eid}), (v:RecursoVideo {id:$rid}) MERGE (e)-[:CONTIENE]->(v)",
            {"eid": entidad_id, "rid": rid},
        )
    logger.info("video adjuntado | tenant=%s recurso=%s", tenant_id, rid)
    return rid
