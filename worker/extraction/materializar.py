"""
Materialización al grafo de la estructura auto-extraída (B9.5).

DOCYAN LDE™ by XCID — worker.

Al cerrar la ingesta, la estructura AUTO-EXTRAÍDA de T3 (diagrama) y T5 (árbol) se
escribe directo al grafo del tenant — sin revisión manual. Produce EXACTAMENTE los
nodos/aristas que los pipelines de lectura (B8) esperan:

  Tipo 3 → `:RecursoVisual` + `:Etiqueta{texto,x,y,w,h}` + `:LeyendaSimbolica` vía `:CONTIENE`.
  Tipo 5 → `:ArbolDiagnostico` + `:NodoDecision{pregunta,orden}` vía `:CONTIENE`,
           opciones como aristas `:OPCION{etiqueta}`, y `:CausaProbable`/`:AccionResolutoria`.

Todo se enlaza al `:DocumentoSource` (procedencia/citas) y, si hay `entidad_id`, a
la `:EntidadOperativa`. Idempotente (`MERGE`).
"""
from __future__ import annotations

import logging
from typing import Any

from worker.extraction.models import DraftArbol, DraftDiagrama

logger = logging.getLogger("docyan.worker.materializar")


def _vincular_doc_y_entidad(
    client: Any, tenant_id: str, doc_id: str | None, entidad_id: str | None, nodo_id: str
) -> None:
    if doc_id:
        client.query(
            tenant_id,
            "MATCH (d:DocumentoSource {id:$doc}), (n {id:$nid}) MERGE (d)-[:CONTIENE]->(n)",
            {"doc": doc_id, "nid": nodo_id},
        )
    if entidad_id:
        client.query(
            tenant_id,
            "MATCH (e:EntidadOperativa {id:$eid}), (n {id:$nid}) MERGE (e)-[:CONTIENE]->(n)",
            {"eid": entidad_id, "nid": nodo_id},
        )


def materializar_diagrama(
    client: Any, tenant_id: str, draft: DraftDiagrama, *,
    doc_id: str | None = None, entidad_id: str | None = None,
) -> str:
    """Escribe un `:RecursoVisual` con sus etiquetas (x,y,w,h) y leyenda. Devuelve el id.

    ED-0c §5bis: si el draft trae `hash_imagen`, el id del `:RecursoVisual` se deriva
    de ese hash → figuras idénticas (mismo binario en varias páginas/documentos)
    MERGE-an al MISMO nodo (1 recurso, N vínculos de aparición), sin duplicar imagen.
    """
    if draft.recurso_id:
        recurso_id = draft.recurso_id
    elif draft.hash_imagen:
        recurso_id = f"rv_{draft.hash_imagen[:24]}"           # estable por imagen (dedup)
    else:
        recurso_id = f"rv_{abs(hash((tenant_id, draft.titulo))) & 0xFFFFFFFF:x}"
    client.query(
        tenant_id,
        "MERGE (r:RecursoVisual {id:$id}) SET r.titulo = $titulo, r.url = $url, r.hash_imagen = $h",
        {"id": recurso_id, "titulo": draft.titulo, "url": draft.recurso_url,
         "h": draft.hash_imagen},
    )
    for i, et in enumerate(draft.etiquetas):
        eid = f"{recurso_id}_et{i}"
        client.query(
            tenant_id,
            """
            MATCH (r:RecursoVisual {id:$rid})
            MERGE (et:Etiqueta {id:$eid})
            SET et.texto = $texto, et.x = $x, et.y = $y, et.w = $w, et.h = $h
            MERGE (r)-[:CONTIENE]->(et)
            """,
            {"rid": recurso_id, "eid": eid, "texto": et.texto,
             "x": et.x, "y": et.y, "w": et.w, "h": et.h},
        )
    for i, ls in enumerate(draft.leyenda_simbolica):
        lid = f"{recurso_id}_ls{i}"
        client.query(
            tenant_id,
            """
            MATCH (r:RecursoVisual {id:$rid})
            MERGE (ls:LeyendaSimbolica {id:$lid})
            SET ls.simbolo = $simbolo, ls.significado = $significado
            MERGE (r)-[:CONTIENE]->(ls)
            """,
            {"rid": recurso_id, "lid": lid, "simbolo": ls.simbolo, "significado": ls.significado},
        )
    _vincular_doc_y_entidad(client, tenant_id, doc_id, entidad_id, recurso_id)
    logger.info("diagrama materializado | tenant=%s recurso=%s", tenant_id, recurso_id)
    return recurso_id


def materializar_arbol(
    client: Any, tenant_id: str, draft: DraftArbol, *,
    doc_id: str | None = None, entidad_id: str | None = None,
) -> str:
    """Escribe un `:ArbolDiagnostico` con nodos, opciones, causas y acciones."""
    arbol_id = draft.arbol_id or f"ad_{abs(hash((tenant_id, draft.titulo))) & 0xFFFFFFFF:x}"
    client.query(
        tenant_id,
        "MERGE (t:ArbolDiagnostico {id:$id}) SET t.titulo = $titulo",
        {"id": arbol_id, "titulo": draft.titulo},
    )
    for n in draft.nodos:
        client.query(
            tenant_id,
            """
            MATCH (t:ArbolDiagnostico {id:$aid})
            MERGE (n:NodoDecision {id:$nid})
            SET n.pregunta = $pregunta, n.orden = $orden
            MERGE (t)-[:CONTIENE]->(n)
            """,
            {"aid": arbol_id, "nid": n.id, "pregunta": n.pregunta, "orden": n.orden},
        )
        if n.causa_probable:
            client.query(
                tenant_id,
                """
                MATCH (n:NodoDecision {id:$nid})
                MERGE (c:CausaProbable {id:$cid}) SET c.descripcion = $desc
                MERGE (n)-[:CONTIENE]->(c)
                """,
                {"nid": n.id, "cid": f"{n.id}_causa", "desc": n.causa_probable},
            )
        if n.accion_resolutoria:
            client.query(
                tenant_id,
                """
                MATCH (n:NodoDecision {id:$nid})
                MERGE (a:AccionResolutoria {id:$aid}) SET a.descripcion = $desc
                MERGE (n)-[:CONTIENE]->(a)
                """,
                {"nid": n.id, "aid": f"{n.id}_accion", "desc": n.accion_resolutoria},
            )
    for n in draft.nodos:
        for o in n.opciones:
            if not o.siguiente_nodo_id:
                continue
            client.query(
                tenant_id,
                """
                MATCH (a:NodoDecision {id:$src}), (b:NodoDecision {id:$dst})
                MERGE (a)-[r:OPCION {etiqueta:$et}]->(b)
                """,
                {"src": n.id, "dst": o.siguiente_nodo_id, "et": o.etiqueta},
            )
    _vincular_doc_y_entidad(client, tenant_id, doc_id, entidad_id, arbol_id)
    logger.info("árbol materializado | tenant=%s arbol=%s", tenant_id, arbol_id)
    return arbol_id
