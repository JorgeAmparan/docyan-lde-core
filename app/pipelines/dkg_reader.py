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

import json
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


def _primer_span(spans: object) -> tuple[str, int, int] | None:
    """
    Extrae el primer span de caracteres de la propiedad `spans` de un nodo del SDK.

    Formato del SDK (procedencia GraphRAG-SDK): JSON `{"<chunk_id>": [{"start": N,
    "end": M}, ...], ...}`. Devuelve `(chunk_id, start, end)` del primer span válido,
    o None si no hay. Importante: los offsets NO casan 1:1 el texto almacenado del
    chunk (Docling normaliza newlines/whitespace distinto al indexar, y la deriva
    crece por campo) → recortar `chunk[start:end]` produce texto desalineado. Por eso
    el `start` se usa SOLO como PISTA de posición; el verbatim se ancla por término
    (`_fragmento_anclado`), no por offset crudo. El `chunk_id` sí es fiable.
    """
    if not spans:
        return None
    data = spans
    if isinstance(spans, str):
        s = spans.strip()
        if not s or s == "[]" or s == "{}":
            return None
        try:
            data = json.loads(s)
        except (ValueError, TypeError):
            return None
    if not isinstance(data, dict):
        return None
    for chunk_id, lst in data.items():
        if not chunk_id or not isinstance(lst, list) or not lst:
            continue
        primero = lst[0]
        if not isinstance(primero, dict):
            continue
        ini, fin = primero.get("start"), primero.get("end")
        if isinstance(ini, int) and isinstance(fin, int) and 0 <= ini < fin:
            return str(chunk_id), ini, fin
    return None


_WS = re.compile(r"\s+")
_VENTANA = 52  # caracteres de contexto a cada lado del término anclado


def _fragmento_anclado(texto: str, nombre: str | None, pista: int) -> dict | None:
    """
    Reconstruye el VERBATIM del documento anclando en el TÉRMINO real de la spec, no
    en el offset crudo del SDK (que está desalineado con el texto almacenado).

    Busca `nombre` literal dentro del texto del chunk (la ocurrencia más cercana a la
    `pista` del span) y devuelve una ventana de contexto a su alrededor, colapsando
    espacios para legibilidad. Garantía de integridad: el resultado SIEMPRE es texto
    real del documento que CONTIENE el término — nunca texto generado, nunca un recorte
    desalineado. Si el `nombre` no aparece literal en el chunk (p. ej. fue traducido o
    sintetizado), devuelve None → la UI muestra "fragmento no disponible".
    """
    if not texto or not nombre:
        return None
    aguja = nombre.strip()
    if len(aguja) < 2:
        return None
    # Todas las ocurrencias literales del término en el chunk.
    posiciones: list[int] = []
    i = texto.find(aguja)
    while i != -1:
        posiciones.append(i)
        i = texto.find(aguja, i + 1)
    if not posiciones:
        return None
    # La más cercana a la pista del span (desambigua términos repetidos).
    pos = min(posiciones, key=lambda s: abs(s - pista))
    fin = pos + len(aguja)
    # Ventana de contexto, recortada a límites de palabra (lo ≤ pos, hi ≥ fin: el
    # término SIEMPRE queda dentro).
    lo = max(0, pos - _VENTANA)
    while lo > 0 and not texto[lo - 1].isspace():
        lo -= 1
    hi = min(len(texto), fin + _VENTANA)
    while hi < len(texto) and not texto[hi].isspace():
        hi += 1
    frag = _WS.sub(" ", texto[lo:hi]).strip()
    aguja_norm = _WS.sub(" ", aguja)
    if aguja_norm not in frag:  # salvaguarda tras colapsar espacios
        return None
    return {"texto": frag, "inicio": lo, "fin": hi}


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


# ── DEF-1 — Ontología legible por la InfoCard (más allá de :Especificacion) ─────
#
# Cada entrada: (label, etiqueta_card, sinonimos_match). La ingesta real produce
# ontología rica que hasta B13.2 nadie consultaba (el químico del MSDS vivía en
# `:Sustancia`, extraído pero invisible). Aquí esos labels se vuelven legibles:
#   · `etiqueta_card` = la ETIQUETA del dato en la tarjeta (p. ej. "Sustancia"); el
#     VALOR mostrado y CITADO es el contenido VERBATIM del nodo (nunca fabricado).
#   · `sinonimos_match` = sinónimos de la CLASE de dato (no contenido) que se suman
#     SOLO al texto que se puntúa contra la pregunta, para que "¿nombre del químico?"
#     alcance la `:Sustancia` sin inventar nada en la respuesta. ES+EN.
# `:Especificacion` es el caso canónico (etiqueta = su propio nombre) y se lee aparte.
_LABELS_INFORMATIVA: tuple[tuple[str, str, str], ...] = (
    ("Sustancia", "Sustancia",
     "sustancia quimico químico chemical substance compuesto componente material ingrediente nombre"),
    ("Producto", "Producto", "producto product articulo artículo equipo modelo"),
    ("NumeroCAS", "Número CAS", "cas numero número registro identificador"),
    ("Riesgo", "Riesgo", "riesgo peligro peligros riesgos hazard ghs clasificacion clasificación"),
    ("MedidaProteccion", "Medida de protección",
     "medida proteccion protección control controles measure"),
    ("EquipoProteccion", "Equipo de protección",
     "epp equipo proteccion protección guantes respirador lentes ppe protection"),
    ("Advertencia", "Advertencia", "advertencia precaucion precaución warning caution nota"),
    ("Instrumento", "Instrumento", "instrumento equipo aparato modelo serie device gauge"),
    ("MedicionRegistrada", "Medición registrada",
     "medicion medición lectura magnitud reading measurement registrada"),
    ("CertificadoCalibracion", "Certificado de calibración",
     "certificado calibracion calibración trazable trazabilidad patron patrón norma "
     "acreditacion acreditación traceable standard"),
)

# Campos de texto candidatos a CONTENIDO del nodo, en orden de preferencia. Cubre el
# shape post-bridge (campo canónico) y el SDK-nativo (`name`). El primero no vacío gana.
_CAMPOS_CONTENIDO = ("nombre", "valor", "descripcion", "texto", "termino", "magnitud",
                     "folio", "fecha", "name")


def _emb(row: dict) -> list[float] | None:
    """Extrae el `embedding` del nodo (el SDK lo escribe como lista de floats; algunos
    drivers lo devuelven como JSON string). None si no hay o no parsea."""
    v = row.get("embedding")
    if isinstance(v, list) and v:
        return v
    if isinstance(v, str) and v.strip():
        try:
            data = json.loads(v)
            return data if isinstance(data, list) and data else None
        except (ValueError, TypeError):
            return None
    return None


def _primer_no_vacio(row: dict, campos: tuple[str, ...]) -> str | None:
    for c in campos:
        v = row.get(c)
        if isinstance(v, str) and v.strip():
            return v.strip()
        if v not in (None, "") and not isinstance(v, (list, dict)):
            return str(v)
    return None


# Columnas que todo nodo citable devuelve (uniforme entre real-graph y reader fake).
_RETURN_CITABLE = (
    "n.id AS id, n.nombre AS nombre, n.valor AS valor, n.unidad AS unidad, "
    "n.descripcion AS descripcion, n.texto AS texto, n.termino AS termino, "
    "n.magnitud AS magnitud, n.folio AS folio, n.fecha AS fecha, n.name AS name, "
    "n.seccion AS seccion, n.pagina AS pagina, n.spans AS spans, n.embedding AS embedding, "
    "_docs[0].id AS documento_id, "
    "coalesce(_docs[0].nombre, _docs[0].tipo) AS documento_nombre, "
    "_docs[0].tipo AS documento_tipo, _docs[0].url AS documento_url"
)


class DKGReader:
    """Implementación real sobre el `dkg_client` (FalkorDB multi-tenant)."""

    def __init__(self, client=None, embedder=None) -> None:
        if client is None:
            from app.graph.dkg_client import dkg_client

            client = dkg_client
        self.client = client
        # DEF-2: embedder para la pasada semántica (decisión #1, BGE-M3 self-hosted,
        # SIN alterno). Inyectable en tests; en producción se carga `bge_client`
        # perezosamente SOLO si está configurado (EMBEDDER_URL/BGE_M3_URL). Sin
        # configurar → retrieval léxico estricto (idéntico a B13.2), sin tocar red.
        self._embedder = embedder
        self._embedder_resuelto = embedder is not None

    def _get_embedder(self):
        if self._embedder_resuelto:
            return self._embedder
        self._embedder_resuelto = True
        import os

        if not (os.getenv("EMBEDDER_URL") or os.getenv("BGE_M3_URL")):
            self._embedder = None
            return None
        try:
            from app.embeddings.bge_client import bge_client

            self._embedder = bge_client
        except Exception:  # noqa: BLE001 — sin embedder se degrada a léxico
            self._embedder = None
        return self._embedder

    # ── Tipo 1 — Informativa (DEF-1 multi-label + DEF-2 híbrido) ────────────────

    def informativa(self, tenant_id: str, termino: str, entidad_id: str | None) -> dict:
        from app.pipelines.retrieval_hibrido import Candidato, rankear

        toks = tokenizar_busqueda(termino)
        embedder = self._get_embedder()
        semantica = embedder is not None

        candidatos: list[Candidato] = []
        # :Especificacion — caso canónico (la etiqueta de la tarjeta es su propio nombre).
        for row in self._leer_especificaciones(tenant_id, toks, semantica):
            nombre = _primer_no_vacio(row, ("nombre", "name")) or "—"
            data = self._normalizar(row, nombre=nombre, valor=row.get("valor"),
                                    unidad=row.get("unidad"), ancla=nombre, label="Especificacion")
            tm = f"{nombre} {row.get('valor') or ''}".strip()
            candidatos.append(Candidato(texto_match=tm, embedding=_emb(row), data=data))
        # DEF-1 — resto de la ontología legible (Sustancia, Riesgo, Instrumento, …).
        for label, etiqueta, sinonimos in _LABELS_INFORMATIVA:
            for row in self._leer_label(tenant_id, label, toks, semantica):
                contenido = _primer_no_vacio(row, _CAMPOS_CONTENIDO)
                if not contenido:
                    continue
                data = self._normalizar(row, nombre=etiqueta, valor=contenido,
                                        unidad=row.get("unidad"), ancla=contenido, label=label)
                tm = f"{etiqueta} {sinonimos} {contenido}"
                candidatos.append(Candidato(texto_match=tm, embedding=_emb(row), data=data))

        elegidos = rankear(termino or "", candidatos, embedder=embedder, limite=8)
        especs = [c.data for c in elegidos]
        # Integridad de cita: VERBATIM del documento anclado en el término real del dato.
        self._hidratar_fragmentos(tenant_id, especs)

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

    @staticmethod
    def _normalizar(row: dict, *, nombre: str, valor, unidad, ancla: str, label: str) -> dict:
        """Aplana un row del grafo al shape que el pipeline + `_cita` consumen.

        Atribución de procedencia CORRECTA (B13.3 §2.3): `documento_nombre` y
        `documento_tipo` provienen del MISMO `:DocumentoSource` (el que `:CONTIENE`
        el nodo) — nunca el nombre de un doc con el tipo de otro. `_ancla` es el
        término literal sobre el que se ancla el verbatim de la cita.
        """
        return {
            "id": row.get("id"),
            "nombre": nombre,
            "valor": valor,
            "unidad": unidad,
            "seccion": row.get("seccion"),
            "pagina": row.get("pagina"),
            "spans": row.get("spans"),
            "documento_id": row.get("documento_id"),
            "documento_nombre": row.get("documento_nombre"),
            "documento_tipo": row.get("documento_tipo"),
            "documento_url": row.get("documento_url"),
            "_ancla": ancla,
            "_label": label,
        }

    def _leer_especificaciones(self, tenant_id: str, toks: list[str], semantica: bool) -> list[dict]:
        """Lee `:Especificacion`. Recall léxico estricto (CONTAINS) salvo que la
        semántica esté activa, en cuyo caso trae el universo (capado) para que la
        pasada vectorial considere specs que el léxico no casaría (siglas, EN/ES)."""
        filtro = (
            "" if semantica else
            "WHERE size($toks) = 0 OR ANY(w IN $toks WHERE "
            "toLower(coalesce(e.nombre,'')) CONTAINS w OR toLower(coalesce(e.valor,'')) CONTAINS w)"
        )
        return self.client.query(
            tenant_id,
            f"""
            MATCH (e:Especificacion)
            {filtro}
            OPTIONAL MATCH (d:DocumentoSource)-[:CONTIENE]->(e)
            WITH e, collect(DISTINCT {{id: d.id, nombre: d.nombre_archivo,
                                       tipo: d.tipo_documento, url: d.url_publica}}) AS _docs
            WITH e AS n, _docs
            RETURN {_RETURN_CITABLE}
            LIMIT 80
            """,
            {"toks": toks},
        )

    def _leer_label(self, tenant_id: str, label: str, toks: list[str], semantica: bool) -> list[dict]:
        """Lee un label citable de la ontología (DEF-1). Mismo patrón de recall que
        `:Especificacion`. El label es de una lista fija interna (no input de usuario)."""
        filtro = (
            "" if semantica else
            "WHERE size($toks) = 0 OR ANY(w IN $toks WHERE "
            "toLower(coalesce(n0.nombre, n0.descripcion, n0.texto, n0.valor, n0.termino, "
            "n0.name, '')) CONTAINS w)"
        )
        try:
            return self.client.query(
                tenant_id,
                f"""
                MATCH (n0:{label})
                {filtro}
                OPTIONAL MATCH (d:DocumentoSource)-[:CONTIENE]->(n0)
                WITH n0 AS n, collect(DISTINCT {{id: d.id, nombre: d.nombre_archivo,
                                                 tipo: d.tipo_documento, url: d.url_publica}}) AS _docs
                RETURN {_RETURN_CITABLE}
                LIMIT 60
                """,
                {"toks": toks},
            )
        except Exception as exc:  # noqa: BLE001 — un label ausente no rompe la consulta
            import logging

            logging.getLogger("docyan.dkg.reader").debug(
                "lectura de label %s falló: %s", label, type(exc).__name__
            )
            return []

    def _hidratar_fragmentos(self, tenant_id: str, especs: list[dict]) -> None:
        """
        Anexa in-place el VERBATIM del documento a cada spec con chunk de origen, como
        `fragmento` (+ `span_inicio`/`span_fin` = posición REAL en el texto almacenado).
        Una sola query extra: junta los chunks de origen y ancla por término real del
        dato (`_ancla` → `_fragmento_anclado`). Spec sin chunk, o cuyo término no
        aparece literal en él, queda con `fragmento=None` ⇒ la UI muestra "fragmento no
        disponible". Nunca se fabrica texto: el fragmento es real y contiene el término.
        """
        if not especs:
            return
        pendientes: list[tuple[dict, str, int]] = []
        for e in especs:
            loc = _primer_span(e.get("spans"))
            if loc is None:
                continue
            chunk_id, ini, _fin = loc
            pendientes.append((e, chunk_id, ini))
        if not pendientes:
            return
        ids = sorted({cid for _, cid, _ in pendientes})
        chunks = self.client.query(
            tenant_id,
            "MATCH (c:Chunk) WHERE c.id IN $ids RETURN c.id AS id, c.text AS text",
            {"ids": ids},
        )
        textos = {c.get("id"): c.get("text") for c in chunks}
        for e, chunk_id, pista in pendientes:
            texto = textos.get(chunk_id)
            if not isinstance(texto, str):
                continue
            # Ancla en el término real del dato (`_ancla`); cae a `nombre` por compat.
            ancla = e.get("_ancla") or e.get("nombre")
            frag = _fragmento_anclado(texto, ancla, pista)
            if frag is not None:
                e["fragmento"] = frag["texto"]
                e["span_inicio"], e["span_fin"] = frag["inicio"], frag["fin"]

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
                   head(collect(DISTINCT coalesce(d.nombre_archivo, d.tipo_documento))) AS documento_nombre,
                   head(collect(DISTINCT d.tipo_documento)) AS documento_tipo,
                   head(collect(DISTINCT d.url_publica)) AS documento_url,
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
        rows = self.client.query(
            tenant_id,
            f"""
            {scope}
            OPTIONAL MATCH (a)-[:DERIVA_DE]->(src)
            OPTIONAL MATCH (d:DocumentoSource)-[:CONTIENE]->(src)
            WITH a, src, collect(DISTINCT {{id: d.id, nombre: d.nombre_archivo,
                                            tipo: d.tipo_documento, url: d.url_publica}}) AS _docs
            RETURN a.id AS alerta_id, coalesce(a.descripcion, a.nombre, '') AS descripcion,
                   a.fecha_vencimiento AS fecha_vencimiento,
                   coalesce(a.urgencia, 'media') AS urgencia,
                   a.tipo AS tipo, a.entidad_id AS entidad_id,
                   src.spans AS _src_spans,
                   coalesce(src.nombre, src.folio, src.descripcion) AS _src_nombre,
                   _docs[0].id AS documento_id,
                   coalesce(_docs[0].nombre, _docs[0].tipo) AS documento_nombre,
                   _docs[0].tipo AS documento_tipo, _docs[0].url AS documento_url
            ORDER BY a.fecha_vencimiento ASC
            LIMIT 100
            """,
            {"eid": entidad_id},
        )
        # B13.3 §2.4 — cita verbatim del vencimiento: ancla en el AÑO de la fecha de
        # vencimiento (que SÍ aparece literal en el documento; la fecha ISO del nodo
        # no), no en la de emisión. Sin span anclable → fragmento None (honesto).
        self._hidratar_alertas(tenant_id, rows)
        return rows

    def _hidratar_alertas(self, tenant_id: str, rows: list[dict]) -> None:
        if not rows:
            return
        pendientes: list[tuple[dict, str, int, str]] = []
        for a in rows:
            loc = _primer_span(a.get("_src_spans"))
            if loc is None:
                continue
            chunk_id, ini, _fin = loc
            fecha = str(a.get("fecha_vencimiento") or "")
            anio = fecha[:4] if len(fecha) >= 4 and fecha[:4].isdigit() else None
            ancla = anio or (a.get("_src_nombre") or "")
            if ancla:
                pendientes.append((a, chunk_id, ini, ancla))
        if not pendientes:
            return
        ids = sorted({cid for _, cid, _, _ in pendientes})
        chunks = self.client.query(
            tenant_id,
            "MATCH (c:Chunk) WHERE c.id IN $ids RETURN c.id AS id, c.text AS text",
            {"ids": ids},
        )
        textos = {c.get("id"): c.get("text") for c in chunks}
        for a, chunk_id, pista, ancla in pendientes:
            texto = textos.get(chunk_id)
            if not isinstance(texto, str):
                continue
            frag = _fragmento_anclado(texto, ancla, pista)
            if frag is not None:
                a["fragmento"] = frag["texto"]
                a["span_inicio"], a["span_fin"] = frag["inicio"], frag["fin"]

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
