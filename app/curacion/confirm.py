"""
Materialización al grafo de borradores curados (B9.5 §1.2 / decisión C).

DOCYAN LDE™ by XCID.

Al confirmar un borrador (corregido por el humano), se escriben en el grafo del
tenant los nodos/aristas EXACTOS que los pipelines de lectura (B8) esperan:

  Tipo 3 → `:RecursoVisual` + `:Etiqueta{texto,x,y}` + `:LeyendaSimbolica` vía `:CONTIENE`.
  Tipo 5 → `:ArbolDiagnostico` + `:NodoDecision{pregunta,orden}` vía `:CONTIENE`,
           opciones como aristas `:OPCION{etiqueta}` entre nodos, y
           `:CausaProbable`/`:AccionResolutoria` vía `:CONTIENE`.

Todo se enlaza al `:DocumentoSource` (procedencia/citas) y, si hay `entidad_id`, a
la `:EntidadOperativa`. Idempotente (`MERGE`): confirmar dos veces no duplica.

NO se toca la lectura: estas funciones producen lo que el reader ya consulta.
"""
from __future__ import annotations

import logging
from typing import Any

from app.curacion.models import DraftArbol, DraftDiagrama

logger = logging.getLogger("docyan.curacion.confirm")


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


def confirmar_diagrama(
    client: Any, tenant_id: str, draft: DraftDiagrama, *,
    doc_id: str | None = None, entidad_id: str | None = None,
) -> str:
    """Materializa un `:RecursoVisual` con sus etiquetas y leyenda. Devuelve el id."""
    recurso_id = draft.recurso_id or f"rv_{abs(hash((tenant_id, draft.titulo))) & 0xFFFFFFFF:x}"
    client.query(
        tenant_id,
        """
        MERGE (r:RecursoVisual {id:$id})
        SET r.titulo = $titulo, r.url = $url
        """,
        {"id": recurso_id, "titulo": draft.titulo, "url": draft.recurso_url},
    )
    for i, et in enumerate(draft.etiquetas):
        eid = f"{recurso_id}_et{i}"
        client.query(
            tenant_id,
            """
            MATCH (r:RecursoVisual {id:$rid})
            MERGE (et:Etiqueta {id:$eid})
            SET et.texto = $texto, et.x = $x, et.y = $y
            MERGE (r)-[:CONTIENE]->(et)
            """,
            {"rid": recurso_id, "eid": eid, "texto": et.texto, "x": et.x, "y": et.y},
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
    logger.info("diagrama curado materializado | tenant=%s recurso=%s", tenant_id, recurso_id)
    return recurso_id


def confirmar_arbol(
    client: Any, tenant_id: str, draft: DraftArbol, *,
    doc_id: str | None = None, entidad_id: str | None = None,
) -> str:
    """Materializa un `:ArbolDiagnostico` con nodos, opciones, causas y acciones."""
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
            cid = f"{n.id}_causa"
            client.query(
                tenant_id,
                """
                MATCH (n:NodoDecision {id:$nid})
                MERGE (c:CausaProbable {id:$cid}) SET c.descripcion = $desc
                MERGE (n)-[:CONTIENE]->(c)
                """,
                {"nid": n.id, "cid": cid, "desc": n.causa_probable},
            )
        if n.accion_resolutoria:
            aid2 = f"{n.id}_accion"
            client.query(
                tenant_id,
                """
                MATCH (n:NodoDecision {id:$nid})
                MERGE (a:AccionResolutoria {id:$aid}) SET a.descripcion = $desc
                MERGE (n)-[:CONTIENE]->(a)
                """,
                {"nid": n.id, "aid": aid2, "desc": n.accion_resolutoria},
            )
    # Aristas de opción entre nodos (etiqueta = texto de la opción).
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
    logger.info("árbol curado materializado | tenant=%s arbol=%s", tenant_id, arbol_id)
    return arbol_id
