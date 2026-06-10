"""
Lector del DKG para los pipelines de consulta (B8 §A2).

DOCYAN LDE™ by XCID.

Aísla TODO el Cypher de los pipelines detrás de una interfaz de alto nivel
(`PipelineGraphReader`). Beneficios:

  - Los pipelines son transformaciones puras de lo que el reader devuelve →
    testeables con un reader sintético, sin FalkorDB.
  - El Cypher multi-tenant (siempre vía `dkg_client`, graph_name aislado) vive en
    un solo lugar (`DKGReader`), ejercitado por el smoke contra Fly real.

Las consultas son léxicas/defensivas (toLower + CONTAINS, OPTIONAL MATCH): el
grafo es flexible y no todos los documentos pueblan todas las aristas. Devuelven
SIEMPRE estructuras planas (dict/list) — nunca nodos crudos de FalkorDB.
"""
from __future__ import annotations

import re
import unicodedata
from typing import Protocol, runtime_checkable

# Palabras vacías + interrogativas en español: se descartan al tokenizar la pregunta
# para el retrieval léxico. Sin esto, el `termino` cae a la PREGUNTA COMPLETA y el
# CONTAINS nunca casa el nombre/valor de un nodo (la frase entera no es substring).
_STOPWORDS = frozenset(
    "el la los las un una unos unas de del al a en y o u que cual cuales cuanto cuanta "
    "cuantos cuantas como cuando donde quien quienes es son esta estan ser para por con "
    "sin sobre se su sus mi mis lo le les me te nos hay tiene tienen dame muestrame dime "
    "cuál cuáles qué cómo cuándo dónde quién necesito quiero".split()
)


def _sin_acentos(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def tokenizar_busqueda(termino: str | None) -> list[str]:
    """
    Parte la consulta en tokens de contenido (≥3 chars, sin stopwords/interrogativas).
    El retrieval casa por CUALQUIER token, de modo que "¿cuál es el límite de exposición
    OSHA?" recupere la spec cuyo nombre/valor contiene "osha"/"exposición"/"límite".

    Los tokens CONSERVAN sus acentos: el texto extraído por el SDK los lleva, y el
    `CONTAINS` de FalkorDB es sensible a acentos (no hay `unaccent`). El filtro de
    stopwords/longitud sí compara sin acentos (para no depender de cómo se acentúe la
    stopword). Lista vacía ⇒ traer todo.
    """
    bajo = (termino or "").lower()
    # Conserva acentos en la palabra; separa por lo que no sea letra/dígito/(-/).
    palabras = re.findall(r"[0-9a-záéíóúñü][0-9a-záéíóúñü\-/]+", bajo)
    vistos: list[str] = []
    for p in palabras:
        plano = _sin_acentos(p)
        if len(plano) >= 3 and plano not in _STOPWORDS and p not in vistos:
            vistos.append(p)
    if not vistos and palabras:
        vistos = [max(palabras, key=len)]
    return vistos


@runtime_checkable
class PipelineGraphReader(Protocol):
    """Contrato que los 8 pipelines consumen (impl real + fake de tests)."""

    def informativa(self, tenant_id: str, termino: str, entidad_id: str | None) -> dict: ...
    def procedimiento(self, tenant_id: str, termino: str, entidad_id: str | None) -> dict: ...
    def recurso_visual(self, tenant_id: str, termino: str, entidad_id: str | None) -> dict: ...
    def video(self, tenant_id: str, termino: str, entidad_id: str | None) -> dict: ...
    def arbol_diagnostico(
        self, tenant_id: str, termino: str, entidad_id: str | None, nodo_id: str | None
    ) -> dict: ...
    def historial(self, tenant_id: str, entidad_id: str | None) -> dict: ...
    def alertas(self, tenant_id: str, entidad_id: str | None) -> list[dict]: ...
    def comparar(
        self, tenant_id: str, estrategia: str, ref_izquierda: str, ref_derecha: str
    ) -> dict: ...


class DKGReader:
    """Implementación real sobre el `dkg_client` (FalkorDB multi-tenant)."""

    def __init__(self, client=None) -> None:
        if client is None:
            from app.graph.dkg_client import dkg_client

            client = dkg_client
        self.client = client

    # ── Tipo 1 — Informativa ──────────────────────────────────────────────────

    def informativa(self, tenant_id: str, termino: str, entidad_id: str | None) -> dict:
        toks = tokenizar_busqueda(termino)
        especs = self.client.query(
            tenant_id,
            """
            MATCH (e:Especificacion)
            WHERE size($toks) = 0
               OR ANY(w IN $toks WHERE toLower(coalesce(e.nombre,'')) CONTAINS w
                                      OR toLower(coalesce(e.valor,'')) CONTAINS w)
            OPTIONAL MATCH (d:DocumentoSource)-[:CONTIENE]->(e)
            RETURN e.id AS id, e.nombre AS nombre, e.valor AS valor,
                   e.unidad AS unidad, e.seccion AS seccion, e.pagina AS pagina,
                   d.id AS documento_id, d.tipo_documento AS documento_nombre
            LIMIT 25
            """,
            {"toks": toks},
        )
        termino_def = self.client.query(
            tenant_id,
            """
            MATCH (tt:TerminoTecnico)
            WHERE size($toks) = 0
               OR ANY(w IN $toks WHERE toLower(coalesce(tt.termino,'')) CONTAINS w
                                      OR toLower(coalesce(tt.definicion,'')) CONTAINS w)
            RETURN tt.termino AS termino, tt.definicion AS definicion
            LIMIT 1
            """,
            {"toks": toks},
        )
        td = termino_def[0] if termino_def else {}
        return {
            "especificaciones": especs,
            "termino": td.get("termino"),
            "definicion": td.get("definicion"),
        }

    # ── Tipo 2 — Guía paso a paso ─────────────────────────────────────────────

    def procedimiento(self, tenant_id: str, termino: str, entidad_id: str | None) -> dict:
        toks = tokenizar_busqueda(termino)
        rows = self.client.query(
            tenant_id,
            """
            MATCH (p:Procedimiento)
            WHERE size($toks) = 0
               OR ANY(w IN $toks WHERE toLower(coalesce(p.nombre,'')) CONTAINS w)
            OPTIONAL MATCH (d:DocumentoSource)-[:CONTIENE]->(p)
            OPTIONAL MATCH (p)-[:CONTIENE]->(paso:Paso)
            OPTIONAL MATCH (paso)-->(epp:EPP)
            OPTIONAL MATCH (paso)-->(h:Herramienta)
            OPTIONAL MATCH (paso)-->(adv:Advertencia)
            WITH p, d, paso,
                 collect(DISTINCT epp.nombre) AS epps,
                 collect(DISTINCT h.nombre) AS herrs,
                 collect(DISTINCT adv.texto) AS advs
            ORDER BY paso.orden
            RETURN p.id AS procedimiento_id, p.nombre AS titulo,
                   head(collect(DISTINCT d.id)) AS documento_id,
                   head(collect(DISTINCT d.tipo_documento)) AS documento_nombre,
                   collect({orden: paso.orden, descripcion: paso.descripcion,
                            epp: epps, herramientas: herrs, advertencias: advs,
                            precondiciones: paso.precondiciones,
                            postcondiciones: paso.postcondiciones}) AS pasos
            LIMIT 1
            """,
            {"toks": toks},
        )
        return rows[0] if rows else {"procedimiento_id": None, "titulo": "", "pasos": []}

    # ── Tipo 3 — Gráficos / diagramas ─────────────────────────────────────────

    def recurso_visual(self, tenant_id: str, termino: str, entidad_id: str | None) -> dict:
        toks = tokenizar_busqueda(termino)
        rows = self.client.query(
            tenant_id,
            """
            MATCH (r:RecursoVisual)
            WHERE size($toks) = 0
               OR ANY(w IN $toks WHERE toLower(coalesce(r.titulo, r.nombre, '')) CONTAINS w)
            OPTIONAL MATCH (r)-[:CONTIENE]->(et:Etiqueta)
            OPTIONAL MATCH (r)-[:CONTIENE]->(ls:LeyendaSimbolica)
            WITH r,
                 collect(DISTINCT {texto: et.texto, x: et.x, y: et.y, w: et.w, h: et.h}) AS etiquetas,
                 collect(DISTINCT {simbolo: ls.simbolo, significado: ls.significado}) AS leyenda
            RETURN r.id AS recurso_id, coalesce(r.titulo, r.nombre) AS titulo,
                   r.url AS recurso_url, etiquetas, leyenda
            LIMIT 1
            """,
            {"toks": toks},
        )
        return rows[0] if rows else {"recurso_id": None, "titulo": "", "etiquetas": [], "leyenda": []}

    # ── Tipo 4 — Video ────────────────────────────────────────────────────────

    def video(self, tenant_id: str, termino: str, entidad_id: str | None) -> dict:
        toks = tokenizar_busqueda(termino)
        rows = self.client.query(
            tenant_id,
            """
            MATCH (v:RecursoVideo)
            WHERE size($toks) = 0
               OR ANY(w IN $toks WHERE toLower(coalesce(v.titulo, v.nombre, '')) CONTAINS w)
            OPTIONAL MATCH (v)-[:CONTIENE]->(c:Capitulo)
            OPTIONAL MATCH (v)-[:CONTIENE]->(s:Subtitulo)
            OPTIONAL MATCH (v)-[:CONTIENE]->(tr:Transcripcion)
            WITH v,
                 collect(DISTINCT {titulo: c.titulo, inicio_seg: c.inicio_seg}) AS capitulos,
                 collect(DISTINCT {idioma: s.idioma, texto: s.texto,
                                   inicio_seg: s.inicio_seg, fin_seg: s.fin_seg}) AS subtitulos,
                 head(collect(tr.texto)) AS transcripcion
            RETURN v.id AS recurso_id, coalesce(v.titulo, v.nombre) AS titulo,
                   v.url AS video_url, v.par_activo AS par_activo,
                   capitulos, subtitulos, transcripcion
            LIMIT 1
            """,
            {"toks": toks},
        )
        return rows[0] if rows else {"recurso_id": None, "titulo": "", "capitulos": [],
                                     "subtitulos": [], "transcripcion": None}

    # ── Tipo 5 — Troubleshooting ──────────────────────────────────────────────

    def arbol_diagnostico(
        self, tenant_id: str, termino: str, entidad_id: str | None, nodo_id: str | None
    ) -> dict:
        if nodo_id:
            rows = self.client.query(
                tenant_id,
                """
                MATCH (n:NodoDecision {id: $nid})
                OPTIONAL MATCH (n)-[rel]->(sig:NodoDecision)
                OPTIONAL MATCH (n)-[:CONTIENE]->(c:CausaProbable)
                OPTIONAL MATCH (n)-[:CONTIENE]->(a:AccionResolutoria)
                WITH n,
                     collect(DISTINCT {etiqueta: rel.etiqueta, siguiente_nodo_id: sig.id}) AS opciones,
                     head(collect(c.descripcion)) AS causa,
                     head(collect(a.descripcion)) AS accion
                RETURN n.id AS nodo_actual_id, n.pregunta AS pregunta,
                       opciones, causa AS causa_probable, accion AS accion_resolutoria
                LIMIT 1
                """,
                {"nid": nodo_id},
            )
            arbol = {"arbol_id": None, "titulo": termino}
        else:
            toks = tokenizar_busqueda(termino)
            rows = self.client.query(
                tenant_id,
                """
                MATCH (t:ArbolDiagnostico)
                WHERE size($toks) = 0
                   OR ANY(w IN $toks WHERE toLower(coalesce(t.titulo, t.nombre, '')) CONTAINS w)
                OPTIONAL MATCH (t)-[:CONTIENE]->(n:NodoDecision)
                WITH t, n ORDER BY coalesce(n.orden, 0) LIMIT 1
                OPTIONAL MATCH (n)-[rel]->(sig:NodoDecision)
                WITH t, n, collect(DISTINCT {etiqueta: rel.etiqueta, siguiente_nodo_id: sig.id}) AS opciones
                RETURN t.id AS arbol_id, coalesce(t.titulo, t.nombre) AS titulo,
                       n.id AS nodo_actual_id, n.pregunta AS pregunta, opciones
                LIMIT 1
                """,
                {"toks": toks},
            )
            arbol = {}
        if not rows:
            return {"arbol_id": None, "titulo": termino, "nodo_actual_id": None,
                    "pregunta": None, "opciones": []}
        row = dict(rows[0])
        row.setdefault("arbol_id", arbol.get("arbol_id"))
        row.setdefault("titulo", arbol.get("titulo", termino))
        return row

    # ── Tipo 6 — Historial ────────────────────────────────────────────────────

    def historial(self, tenant_id: str, entidad_id: str | None) -> dict:
        def _q(label: str, campos: str) -> list[dict]:
            scope = (
                "MATCH (ent:EntidadOperativa {id: $eid})-[]->(x:%s)" % label
                if entidad_id
                else "MATCH (x:%s)" % label
            )
            return self.client.query(
                tenant_id, f"{scope} RETURN {campos} ORDER BY ts DESC LIMIT 50",
                {"eid": entidad_id},
            )

        eventos = _q(
            "EventoOperativo",
            "x.tipo AS tipo, coalesce(x.consulta_texto, x.descripcion, x.tipo) AS descripcion, "
            "x.timestamp AS ts, x.id AS entidad_id",
        )
        certificados = _q(
            "CertificadoVigencia",
            "'certificado' AS tipo, coalesce(x.nombre, x.descripcion, '') AS descripcion, "
            "coalesce(x.fecha_vencimiento, x.timestamp) AS ts, x.id AS entidad_id",
        )
        observaciones = _q(
            "Observacion",
            "'observacion' AS tipo, x.texto AS descripcion, x.timestamp AS ts, x.id AS entidad_id",
        )
        mediciones = _q(
            "MedicionRegistrada",
            "'medicion' AS tipo, coalesce(x.descripcion, x.nombre, '') AS descripcion, "
            "x.timestamp AS ts, x.id AS entidad_id",
        )
        return {
            "eventos": eventos,
            "certificados": certificados,
            "observaciones": observaciones,
            "mediciones": mediciones,
        }

    # ── Tipo 7 — Alertas ──────────────────────────────────────────────────────

    def alertas(self, tenant_id: str, entidad_id: str | None) -> list[dict]:
        scope = (
            "MATCH (ent:EntidadOperativa {id: $eid})-[]->(a:Alerta)"
            if entidad_id
            else "MATCH (a:Alerta)"
        )
        return self.client.query(
            tenant_id,
            f"""
            {scope}
            RETURN a.id AS alerta_id, coalesce(a.descripcion, a.nombre, '') AS descripcion,
                   a.fecha_vencimiento AS fecha_vencimiento,
                   coalesce(a.urgencia, 'media') AS urgencia,
                   a.tipo AS tipo, a.entidad_id AS entidad_id
            ORDER BY a.fecha_vencimiento ASC
            LIMIT 100
            """,
            {"eid": entidad_id},
        )

    # ── Tipo 8 — Comparativa ──────────────────────────────────────────────────

    def comparar(
        self, tenant_id: str, estrategia: str, ref_izquierda: str, ref_derecha: str
    ) -> dict:
        if estrategia == "versiones_documento":
            label, key = "DocumentoSource", "id"
            campos = "x.tipo_documento AS tipo, x.version_documento AS version, x.hash_contenido AS hash"
        else:
            label, key = "EntidadOperativa", "id"
            campos = "x.tipo AS tipo, x.estado_ciclo_vida AS estado, x.sitio AS sitio"
        izq = self.client.query(
            tenant_id, f"MATCH (x:{label} {{{key}: $ref}}) RETURN {campos} LIMIT 1",
            {"ref": ref_izquierda},
        )
        der = self.client.query(
            tenant_id, f"MATCH (x:{label} {{{key}: $ref}}) RETURN {campos} LIMIT 1",
            {"ref": ref_derecha},
        )
        return {
            "izquierda": izq[0] if izq else {},
            "derecha": der[0] if der else {},
        }
