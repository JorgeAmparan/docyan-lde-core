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
    # Español
    "el la los las un una unos unas de del al a en y o u que cual cuales cuanto cuanta "
    "cuantos cuantas como cuando donde quien quienes es son esta estan ser para por con "
    "sin sobre se su sus mi mis lo le les me te nos hay tiene tienen dame muestrame dime "
    "cuál cuáles qué cómo cuándo dónde quién necesito quiero "
    # Inglés (los SDS demo están en inglés; las preguntas llegan EN/ES). Sin esto,
    # "what is the chemical name" tokeniza con "what/the" y diluye el score léxico.
    "the a an of for in on to is are was were be what which who whom how when where why "
    "do does did this that these those with and or its their there here it as at by from "
    "i you we they my your our give show tell me us need want".split()
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

    def informativa(
        self, tenant_id: str, termino: str, entidad_id: str | None,
        documento_id: str | None = None,
    ) -> dict: ...
    def procedimiento(
        self, tenant_id: str, termino: str, entidad_id: str | None,
        documento_id: str | None = None,
    ) -> dict: ...
    def recurso_visual(
        self, tenant_id: str, termino: str, entidad_id: str | None,
        documento_id: str | None = None,
    ) -> dict: ...
    def video(
        self, tenant_id: str, termino: str, entidad_id: str | None,
        documento_id: str | None = None,
    ) -> dict: ...
    def arbol_diagnostico(
        self, tenant_id: str, termino: str, entidad_id: str | None, nodo_id: str | None,
        documento_id: str | None = None,
    ) -> dict: ...
    def historial(self, tenant_id: str, entidad_id: str | None) -> dict: ...
    def alertas(self, tenant_id: str, entidad_id: str | None) -> list[dict]: ...
    def comparar(
        self, tenant_id: str, estrategia: str, ref_izquierda: str, ref_derecha: str
    ) -> dict: ...
    def bilingue(
        self, tenant_id: str, termino: str, source_lang: str = "en-US",
        target_lang: str = "es-MX",
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
     "sustancia quimico químico chemical substance compuesto componente material "
     "ingrediente nombre name producto agente"),
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
    ("FechaVencimiento", "Vence",
     "vence vencimiento vigencia caduca caducidad expira expiración expiry expires "
     "valid until due fecha renovacion renovación"),
)

# ── Ranking por intención del query (B13.3 §ranking — cierre acceptance #2) ─────
#
# El léxico+semántica solo NO basta para la RELEVANCIA: un :Riesgo cuyo texto
# contiene "QUIMICOS" o cuyo embedding cae cerca de cualquier consulta de seguridad
# encabeza preguntas que NO son de riesgo (diagnóstico real sobre el grafo de prod:
# "¿cómo se llama el químico?" devolvía :Riesgo 'PRODUCTOS DE COMBUSTION', y "LEL?"
# devolvía :Riesgo 'IRRITACION', sepultando la :Sustancia y la :Especificacion de
# inflamabilidad reales). Regla de relevancia (directiva de Jorge): una pregunta de
# IDENTIDAD prioriza :Sustancia/:Producto/:Instrumento sobre :Riesgo; y los labels de
# SEGURIDAD no encabezan salvo que el query sea, en efecto, sobre riesgos.
#
# Esto NO toca el score/banda (la confianza honesta que se muestra y cita) — solo el
# ORDEN (Candidato.prioridad): un :Riesgo demotado sigue en el resultado, solo deja
# de encabezar. Label-agnóstico el scorer; la ontología vive aquí.
_LABELS_IDENTIDAD = frozenset({"Sustancia", "Producto", "Instrumento", "NumeroCAS"})
_LABELS_SEGURIDAD = frozenset({"Riesgo", "MedidaProteccion", "EquipoProteccion", "Advertencia"})
# Marcadores de IDENTIDAD: la pregunta busca el NOMBRE/identidad de algo ("¿cómo se
# llama?", "nombre del químico", "what is it called", "chemical name"). Se evita el
# "¿qué es / what is" pelado (genérico: "what is the OSHA PEL" NO es identidad).
_MARCADORES_IDENTIDAD = frozenset(
    "nombre name llama llamado llamada llaman denomina denominacion denominado "
    "identifica identificacion identificar identidad called identity".split()
)
# Marcadores de SEGURIDAD: la pregunta SÍ es de riesgo/peligro → no se demota nada.
_MARCADORES_SEGURIDAD = frozenset(
    "riesgo riesgos peligro peligros peligroso peligrosa peligrosas peligrosidad "
    "hazard hazards hazardous ghs precaucion precauciones toxico toxica toxicidad "
    "corrosivo corrosiva irritante nocivo seguridad daninos danino".split()
)
# Magnitudes del sesgo de orden (no de score). Identidad es DECISIVA (boost + pena
# fuertes: el dato de identidad debe encabezar sobre un homónimo de :Riesgo). La
# democión GENERAL (query ni de identidad ni de seguridad) es leve: solo rompe
# cuasi-empates donde un :Riesgo semántico sepulta la :Especificacion relevante (LEL).
_BONUS_IDENTIDAD = 0.30
_PENA_IDENTIDAD = 0.30
_PENA_GENERAL = 0.10
# Sprint UI-2 §1.4 — nombres GENÉRICOS de extracción (placeholders que el extractor
# materializó como si fueran sustancias reales: "El Material", "COMPONENTES DE ESTE
# PRODUCTO", "SUSTANCIA DEL PRODUCTO"). Rankeaban junto a sustancias reales (ALUMINA)
# en respuestas de identidad. Esto es un sesgo de ORDEN (como el de intención): NO
# elimina ni cambia el score/banda mostrado — sólo demota para que el nombre real
# encabece. Filtro por LISTA CORTA y barato (la cirugía de extracción de fondo va a
# la cola del catálogo de schemas). Coincidencia por nombre completo normalizado:
# no toca un nombre real que contenga estas palabras (p. ej. "ácido + agua").
_PENA_GENERICO = 0.20
_NOMBRES_GENERICOS = frozenset({
    "el material", "material", "los materiales", "el material del producto",
    "componentes de este producto", "componentes del producto", "componentes",
    "componente", "los componentes",
    "sustancia del producto", "sustancia", "la sustancia", "sustancias",
    "sustancia o mezcla", "sustancia quimica",
    "el producto", "producto", "este producto", "del producto", "el producto quimico",
    "ingrediente", "ingredientes", "los ingredientes",
    "mezcla", "la mezcla", "la mezcla del producto",
})


def _es_nombre_generico(contenido: str | None) -> bool:
    """¿El nombre/valor del nodo es un placeholder genérico de extracción?
    Normaliza (sin acentos, minúsculas, sin puntuación de borde) y compara por
    igualdad contra la lista corta — exacto, nunca substring, para no demotar un
    nombre real que apenas contenga la palabra."""
    if not contenido:
        return False
    n = _sin_acentos(contenido.lower()).strip(" .,:;-\t\n\"'()[]")
    n = re.sub(r"\s+", " ", n)
    return n in _NOMBRES_GENERICOS


def _sesgo_intencion(termino: str | None) -> dict[str, float]:
    """Sesgo de ORDEN por label según la intención del query (no altera relevancia).

    · Query de SEGURIDAD (menciona riesgo/peligro/hazard/…): sin sesgo — los :Riesgo
      deben encabezar. Tiene precedencia si coexiste con marcadores de identidad
      ("riesgos del químico" → es de seguridad, no de identidad).
    · Query de IDENTIDAD (nombre/se llama/called/…): +bonus a Sustancia/Producto/
      Instrumento/NumeroCAS, −pena a los labels de seguridad.
    · Resto: −pena leve a los labels de seguridad, para que el dato específico
      (Especificacion/Sustancia) no quede sepultado por un :Riesgo de pura cercanía
      semántica (caso "LEL"→"IRRITACION").
    """
    norm = _sin_acentos((termino or "").lower())
    palabras = set(re.findall(r"[a-z0-9]+", norm))
    if palabras & _MARCADORES_SEGURIDAD:
        return {}
    if palabras & _MARCADORES_IDENTIDAD:
        sesgo = {lbl: _BONUS_IDENTIDAD for lbl in _LABELS_IDENTIDAD}
        sesgo.update({lbl: -_PENA_IDENTIDAD for lbl in _LABELS_SEGURIDAD})
        return sesgo
    return {lbl: -_PENA_GENERAL for lbl in _LABELS_SEGURIDAD}


# Campos de texto candidatos a CONTENIDO del nodo, en orden de preferencia. Son los
# campos CANÓNICOS que el bridge proyecta por label (`_CAMPO_PRIMARIO_DESDE_NAME`).
# A propósito NO incluye el `name` SDK-nativo: el reader lee lo proyectado por el
# bridge, no el crudo del SDK — así se preserva el invariante "sin bridge no hay
# lectura" (es el bridge, no el azar, lo que cierra la costura escritura↔lectura).
_CAMPOS_CONTENIDO = ("nombre", "valor", "descripcion", "texto", "termino", "magnitud",
                     "folio", "fecha")


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

    # ── Aislamiento documental (provenance) ─────────────────────────────────────
    #
    # ACOTA el universo de nodos de un label al DOCUMENTO o ENTIDAD consultados, en
    # vez de barrer todo el grafo del tenant. Sin esto, una consulta sobre el doc A
    # puntúa y cita el nodo que mejor casa los tokens de CUALQUIER documento del
    # tenant (cross-citation: doc A → cita doc B). El scope es:
    #   · documento_id → `(:DocumentoSource {id})-[:CONTIENE]->(n)` (documento suelto).
    #   · entidad_id   → `(:EntidadOperativa {id})-[:CONTIENE]->(n)` (CoDo de entidad;
    #     el bridge de procedencia espeja `:CONTIENE` del doc sobre la entidad).
    #   · ninguno      → tenant-wide (compat: búsqueda libre sin contexto de CoDo).
    # El parámetro `$doc_id`/`$eid` solo se referencia en la rama elegida; los demás
    # quedan inertes en el dict de params.
    @staticmethod
    def _scope_prefix(alias: str, label: str, documento_id: str | None,
                      entidad_id: str | None) -> str:
        if documento_id:
            return f"MATCH (:DocumentoSource {{id: $doc_id}})-[:CONTIENE]->({alias}:{label})"
        if entidad_id:
            return f"MATCH (:EntidadOperativa {{id: $eid}})-[:CONTIENE]->({alias}:{label})"
        return f"MATCH ({alias}:{label})"

    # ── Tipo 1 — Informativa (DEF-1 multi-label + DEF-2 híbrido) ────────────────

    def informativa(
        self, tenant_id: str, termino: str, entidad_id: str | None,
        documento_id: str | None = None,
    ) -> dict:
        from app.pipelines.retrieval_hibrido import Candidato, rankear

        toks = tokenizar_busqueda(termino)
        embedder = self._get_embedder()
        semantica = embedder is not None
        # Sesgo de ORDEN por intención del query (no toca relevancia): identidad
        # prioriza Sustancia/Producto/Instrumento; los labels de seguridad no
        # encabezan salvo query de riesgo. `_label` → prioridad (0.0 = neutral).
        sesgo = _sesgo_intencion(termino)

        candidatos: list[Candidato] = []
        # :Especificacion — caso canónico (la etiqueta de la tarjeta es su propio nombre).
        # Lee el `nombre` CANÓNICO (proyectado por el bridge), no el `name` SDK-nativo:
        # sin bridge, `nombre` es NULL ⇒ "—" ⇒ no casa ⇒ no se lee (invariante de costura).
        # :Especificacion es el dato neutral de referencia: nunca se demota ni se bonifica.
        for row in self._leer_especificaciones(
            tenant_id, toks, semantica, documento_id=documento_id, entidad_id=entidad_id
        ):
            nombre = _primer_no_vacio(row, ("nombre",)) or "—"
            data = self._normalizar(row, nombre=nombre, valor=row.get("valor"),
                                    unidad=row.get("unidad"), ancla=nombre, label="Especificacion")
            tm = f"{nombre} {row.get('valor') or ''}".strip()
            candidatos.append(Candidato(texto_match=tm, embedding=_emb(row), data=data,
                                        prioridad=sesgo.get("Especificacion", 0.0)))
        # DEF-1 — resto de la ontología legible (Sustancia, Riesgo, Instrumento, …).
        for label, etiqueta, sinonimos in _LABELS_INFORMATIVA:
            for row in self._leer_label(
                tenant_id, label, toks, semantica,
                documento_id=documento_id, entidad_id=entidad_id,
            ):
                contenido = _primer_no_vacio(row, _CAMPOS_CONTENIDO)
                if not contenido:
                    continue
                data = self._normalizar(row, nombre=etiqueta, valor=contenido,
                                        unidad=row.get("unidad"), ancla=contenido, label=label)
                tm = f"{etiqueta} {sinonimos} {contenido}"
                # §1.4 — demota (no elimina) nombres genéricos de extracción para que
                # la sustancia real encabece. Sesgo de orden, sumado al de intención.
                prioridad = sesgo.get(label, 0.0)
                if _es_nombre_generico(contenido):
                    prioridad -= _PENA_GENERICO
                candidatos.append(Candidato(texto_match=tm, embedding=_emb(row), data=data,
                                            prioridad=prioridad))

        # Puntuar con la consulta SIN stopwords (mismos tokens de contenido que el
        # recall). Pasar el `termino` crudo diluía el score léxico ("what is the
        # chemical name" → tokens what/is/the bajaban :Sustancia de banda alta y
        # :Riesgo ganaba por pura semántica). El embedding de los tokens limpios es
        # igual de bueno (menos ruido) para la pasada vectorial.
        query_score = " ".join(toks) if toks else (termino or "")
        elegidos = rankear(query_score, candidatos, embedder=embedder, limite=8)
        especs = [c.data for c in elegidos]
        # Integridad de cita: VERBATIM del documento anclado en el término real del dato.
        self._hidratar_fragmentos(tenant_id, especs)

        # Aislamiento: el glosario (`:TerminoTecnico`) también se acota al documento/
        # entidad consultados. Sin scope, consultar el doc A podía devolver la
        # `definicion` de un término que solo existe en el doc B del mismo tenant
        # (fuga cruzada en el campo secundario de definición — confirmada en auditoría).
        scope_tt = self._scope_prefix("tt", "TerminoTecnico", documento_id, entidad_id)
        termino_def = self.client.query(
            tenant_id,
            f"""
            {scope_tt}
            WHERE size($toks) = 0
               OR ANY(w IN $toks WHERE toLower(coalesce(tt.termino,'')) CONTAINS w
                                      OR toLower(coalesce(tt.definicion,'')) CONTAINS w)
            RETURN tt.termino AS termino, tt.definicion AS definicion
            LIMIT 1
            """,
            {"toks": toks, "doc_id": documento_id, "eid": entidad_id},
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

    def _leer_especificaciones(
        self, tenant_id: str, toks: list[str], semantica: bool,
        *, documento_id: str | None = None, entidad_id: str | None = None,
    ) -> list[dict]:
        """Lee `:Especificacion` ACOTADA al documento/entidad consultados (aislamiento).
        Recall léxico estricto (CONTAINS) salvo que la semántica esté activa, en cuyo
        caso trae el universo (capado, dentro del scope) para que la pasada vectorial
        considere specs que el léxico no casaría (siglas, EN/ES)."""
        scope = self._scope_prefix("e", "Especificacion", documento_id, entidad_id)
        filtro = (
            "" if semantica else
            "WHERE size($toks) = 0 OR ANY(w IN $toks WHERE "
            "toLower(coalesce(e.nombre,'')) CONTAINS w OR toLower(coalesce(e.valor,'')) CONTAINS w)"
        )
        return self.client.query(
            tenant_id,
            f"""
            {scope}
            {filtro}
            OPTIONAL MATCH (d:DocumentoSource)-[:CONTIENE]->(e)
            WITH e, collect(DISTINCT {{id: d.id, nombre: d.nombre_archivo,
                                       tipo: d.tipo_documento, url: d.url_publica}}) AS _docs
            WITH e AS n, _docs
            RETURN {_RETURN_CITABLE}
            LIMIT 80
            """,
            {"toks": toks, "doc_id": documento_id, "eid": entidad_id},
        )

    def _leer_label(
        self, tenant_id: str, label: str, toks: list[str], semantica: bool,
        *, documento_id: str | None = None, entidad_id: str | None = None,
    ) -> list[dict]:
        """Lee un label citable de la ontología (DEF-1) ACOTADO al documento/entidad
        consultados. Mismo patrón de recall que `:Especificacion`. El label es de una
        lista fija interna (no input de usuario)."""
        scope = self._scope_prefix("n0", label, documento_id, entidad_id)
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
                {scope}
                {filtro}
                OPTIONAL MATCH (d:DocumentoSource)-[:CONTIENE]->(n0)
                WITH n0 AS n, collect(DISTINCT {{id: d.id, nombre: d.nombre_archivo,
                                                 tipo: d.tipo_documento, url: d.url_publica}}) AS _docs
                RETURN {_RETURN_CITABLE}
                LIMIT 60
                """,
                {"toks": toks, "doc_id": documento_id, "eid": entidad_id},
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

    def procedimiento(
        self, tenant_id: str, termino: str, entidad_id: str | None,
        documento_id: str | None = None,
    ) -> dict:
        toks = tokenizar_busqueda(termino)
        scope = self._scope_prefix("p", "Procedimiento", documento_id, entidad_id)
        rows = self.client.query(
            tenant_id,
            f"""
            {scope}
            WHERE size($toks) = 0
               OR ANY(w IN $toks WHERE toLower(coalesce(p.nombre,'')) CONTAINS w)
            // Entre los procedimientos que casan, elige el de MÁS pasos: la
            // extracción puede producir varios :Procedimiento homónimos y solo
            // algunos traen los :Paso enlazados (`:CONTIENE`). Sin esto, el LIMIT 1
            // tomaba uno vacío y la procedure_card salía sin pasos (visto en CIP).
            OPTIONAL MATCH (p)-[:CONTIENE]->(paso0:Paso)
            WITH p, count(paso0) AS _npasos
            ORDER BY _npasos DESC, p.nombre
            LIMIT 1
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
                   collect({{orden: paso.orden, descripcion: paso.descripcion,
                            epp: epps, herramientas: herrs, advertencias: advs,
                            precondiciones: paso.precondiciones,
                            postcondiciones: paso.postcondiciones}}) AS pasos
            LIMIT 1
            """,
            {"toks": toks, "doc_id": documento_id, "eid": entidad_id},
        )
        return rows[0] if rows else {"procedimiento_id": None, "titulo": "", "pasos": []}

    # ── Tipo 3 — Gráficos / diagramas ─────────────────────────────────────────

    def recurso_visual(
        self, tenant_id: str, termino: str, entidad_id: str | None,
        documento_id: str | None = None,
    ) -> dict:
        toks = tokenizar_busqueda(termino)
        scope = self._scope_prefix("r", "RecursoVisual", documento_id, entidad_id)
        rows = self.client.query(
            tenant_id,
            f"""
            {scope}
            WHERE size($toks) = 0
               OR ANY(w IN $toks WHERE toLower(coalesce(r.titulo, r.nombre, '')) CONTAINS w)
            OPTIONAL MATCH (r)-[:CONTIENE]->(et:Etiqueta)
            OPTIONAL MATCH (r)-[:CONTIENE]->(ls:LeyendaSimbolica)
            WITH r,
                 collect(DISTINCT {{texto: et.texto, x: et.x, y: et.y, w: et.w, h: et.h}}) AS etiquetas,
                 collect(DISTINCT {{simbolo: ls.simbolo, significado: ls.significado}}) AS leyenda
            RETURN r.id AS recurso_id, coalesce(r.titulo, r.nombre) AS titulo,
                   r.url AS recurso_url, etiquetas, leyenda
            LIMIT 1
            """,
            {"toks": toks, "doc_id": documento_id, "eid": entidad_id},
        )
        return rows[0] if rows else {"recurso_id": None, "titulo": "", "etiquetas": [], "leyenda": []}

    # ── Tipo 4 — Video ────────────────────────────────────────────────────────

    def video(
        self, tenant_id: str, termino: str, entidad_id: str | None,
        documento_id: str | None = None,
    ) -> dict:
        toks = tokenizar_busqueda(termino)
        scope = self._scope_prefix("v", "RecursoVideo", documento_id, entidad_id)
        rows = self.client.query(
            tenant_id,
            f"""
            {scope}
            WHERE size($toks) = 0
               OR ANY(w IN $toks WHERE toLower(coalesce(v.titulo, v.nombre, '')) CONTAINS w)
            OPTIONAL MATCH (v)-[:CONTIENE]->(c:Capitulo)
            OPTIONAL MATCH (v)-[:CONTIENE]->(s:Subtitulo)
            OPTIONAL MATCH (v)-[:CONTIENE]->(tr:Transcripcion)
            WITH v,
                 collect(DISTINCT {{titulo: c.titulo, inicio_seg: c.inicio_seg}}) AS capitulos,
                 collect(DISTINCT {{idioma: s.idioma, texto: s.texto,
                                   inicio_seg: s.inicio_seg, fin_seg: s.fin_seg}}) AS subtitulos,
                 head(collect(tr.texto)) AS transcripcion
            RETURN v.id AS recurso_id, coalesce(v.titulo, v.nombre) AS titulo,
                   v.url AS video_url, v.par_activo AS par_activo,
                   capitulos, subtitulos, transcripcion
            LIMIT 1
            """,
            {"toks": toks, "doc_id": documento_id, "eid": entidad_id},
        )
        return rows[0] if rows else {"recurso_id": None, "titulo": "", "capitulos": [],
                                     "subtitulos": [], "transcripcion": None}

    # ── Tipo 5 — Troubleshooting ──────────────────────────────────────────────

    def arbol_diagnostico(
        self, tenant_id: str, termino: str, entidad_id: str | None, nodo_id: str | None,
        documento_id: str | None = None,
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
            scope = self._scope_prefix("t", "ArbolDiagnostico", documento_id, entidad_id)
            rows = self.client.query(
                tenant_id,
                f"""
                {scope}
                WHERE size($toks) = 0
                   OR ANY(w IN $toks WHERE toLower(coalesce(t.titulo, t.nombre, '')) CONTAINS w)
                OPTIONAL MATCH (t)-[:CONTIENE]->(n:NodoDecision)
                WITH t, n ORDER BY coalesce(n.orden, 0) LIMIT 1
                OPTIONAL MATCH (n)-[rel]->(sig:NodoDecision)
                WITH t, n, collect(DISTINCT {{etiqueta: rel.etiqueta, siguiente_nodo_id: sig.id}}) AS opciones
                RETURN t.id AS arbol_id, coalesce(t.titulo, t.nombre) AS titulo,
                       n.id AS nodo_actual_id, n.pregunta AS pregunta, opciones
                LIMIT 1
                """,
                {"toks": toks, "doc_id": documento_id, "eid": entidad_id},
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
        # B13.3 §2.4 — además de las :Alerta pre-generadas (vencimientos inminentes
        # del generador, acotados por horizonte), surface las FECHAS DE VENCIMIENTO
        # administrativas directamente: "¿cuándo vence?" debe responder la fecha
        # citada aunque el vencimiento NO sea inminente (es un dato, no una alarma).
        # Solo administrativas (fechas) — la LÍNEA ABSOLUTA se mantiene.
        rows = list(rows) + self._vencimientos_administrativos(tenant_id, entidad_id)
        # Cita verbatim: ancla en el AÑO del vencimiento (que SÍ aparece literal en el
        # documento; la fecha ISO del nodo no), no en la de emisión.
        self._hidratar_alertas(tenant_id, rows)
        return rows

    def _vencimientos_administrativos(self, tenant_id: str, entidad_id: str | None) -> list[dict]:
        """Lee :FechaVencimiento (dato administrativo) con su doc + spans, como filas de
        alerta administrativa para el dashboard. Cada una cita el AÑO en el documento."""
        scope = (
            "MATCH (ent:EntidadOperativa {id: $eid})-[]->(n:FechaVencimiento)"
            if entidad_id else "MATCH (n:FechaVencimiento)"
        )
        try:
            return self.client.query(
                tenant_id,
                f"""
                {scope}
                WHERE coalesce(n.fecha, n.nombre, n.name) IS NOT NULL
                OPTIONAL MATCH (d:DocumentoSource)-[:CONTIENE]->(n)
                WITH n, collect(DISTINCT {{id: d.id, nombre: d.nombre_archivo,
                                          tipo: d.tipo_documento, url: d.url_publica}}) AS _docs
                RETURN n.id AS alerta_id,
                       'Vencimiento: ' + coalesce(n.fecha, n.nombre, n.name) AS descripcion,
                       coalesce(n.fecha, n.nombre, n.name) AS fecha_vencimiento,
                       'baja' AS urgencia, 'vencimiento' AS tipo, n.entidad_id AS entidad_id,
                       n.spans AS _src_spans, coalesce(n.fecha, n.nombre, n.name) AS _src_nombre,
                       _docs[0].id AS documento_id,
                       coalesce(_docs[0].nombre, _docs[0].tipo) AS documento_nombre,
                       _docs[0].tipo AS documento_tipo, _docs[0].url AS documento_url
                LIMIT 25
                """,
                {"eid": entidad_id},
            )
        except Exception:  # noqa: BLE001 — label ausente no rompe el dashboard
            return []

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

    # ── Tipo 9 — Bilingüe (memoria_traduccion · DTM, par segregado) ─────────────

    def _get_dtm(self):
        """Cliente DTM perezoso (reutiliza el driver del DKG). Inyectable en tests."""
        dtm = getattr(self, "_dtm", None)
        if dtm is None:
            from app.graph.dtm_client import DTMClient

            dtm = DTMClient()
            self._dtm = dtm
        return dtm

    def bilingue(
        self, tenant_id: str, termino: str, source_lang: str = "en-US",
        target_lang: str = "es-MX",
    ) -> dict:
        """
        Lee segmentos alineados del DTM (`:SegmentoTraduccion`) del par direccional,
        casando léxicamente la consulta contra el texto ORIGEN o DESTINO. Adjunta los
        términos del glosario (lock terminológico) presentes en cada segmento.

        Devuelve SIEMPRE estructura plana. Si el par no tiene memoria (grafo vacío o
        DTM no disponible) → `{"segmentos": [], "desde_memoria": False}` (honesto: el
        pipeline declara "sin memoria para el par", no inventa traducción).
        """
        par = f"{source_lang} → {target_lang}"
        vacio = {"par_linguistico": par, "segmentos": [], "desde_memoria": False,
                 "lock_activo": False}
        dtm = self._get_dtm()
        toks = tokenizar_busqueda(termino)

        try:
            # Glosario del par: términos fijados (lock terminológico). Se leen una vez
            # y se cruzan contra cada segmento por contención en el texto origen.
            glos = dtm.query(
                tenant_id, source_lang, target_lang,
                """
                MATCH (g:Glosario)-[:CONTIENE_TERMINO]->(t:TerminoGlosario)
                RETURN t.texto_origen AS origen, t.texto_destino AS destino,
                       coalesce(g.lock_terminologico, false) AS lock
                """,
            )
            # Segmentos del par. CONTAINS por CUALQUIER token (origen o destino); sin
            # tokens (consulta vacía) trae los primeros N para poblar la vista.
            if toks:
                conds = " OR ".join(
                    f"toLower(s.texto_origen) CONTAINS $t{i} "
                    f"OR toLower(coalesce(s.texto_destino,'')) CONTAINS $t{i}"
                    for i in range(len(toks))
                )
                where = f"WHERE {conds}"
                params = {f"t{i}": tok.lower() for i, tok in enumerate(toks)}
            else:
                where, params = "", {}
            rows = dtm.query(
                tenant_id, source_lang, target_lang,
                f"""
                MATCH (s:SegmentoTraduccion)
                {where}
                RETURN s.texto_origen AS texto_origen, s.texto_destino AS texto_destino,
                       s.idioma_origen AS idioma_origen, s.idioma_destino AS idioma_destino,
                       s.tipo_segmento AS tipo_segmento, s.contexto AS contexto,
                       s.dominio AS dominio
                LIMIT 12
                """,
                params,
            )
        except Exception:  # noqa: BLE001 — sin DTM/par se degrada honesto (no se finge).
            return vacio

        locks = [
            {"termino_origen": g.get("origen"), "termino_destino": g.get("destino"),
             "lock": bool(g.get("lock"))}
            for g in glos
            if g.get("origen") and g.get("destino")
        ]
        lock_activo = any(g["lock"] for g in locks)

        segmentos: list[dict] = []
        for r in rows:
            origen = r.get("texto_origen")
            if not origen:
                continue
            origen_low = origen.lower()
            seg_locks = [
                {"termino_origen": lk["termino_origen"], "termino_destino": lk["termino_destino"]}
                for lk in locks
                if lk["termino_origen"] and lk["termino_origen"].lower() in origen_low
            ]
            dominio = r.get("dominio") or r.get("contexto")
            segmentos.append({
                "texto_origen": origen,
                "texto_destino": r.get("texto_destino"),
                "idioma_origen": r.get("idioma_origen") or source_lang,
                "idioma_destino": r.get("idioma_destino") or target_lang,
                "tipo_segmento": r.get("tipo_segmento"),
                "lock": seg_locks,
                # Cita: el segmento origen ES verbatim de la memoria. El "documento"
                # es la memoria de traducción del par; la sección es el dominio/contexto.
                "documento_nombre": "Memoria de traducción",
                "documento_tipo": "memoria_traduccion",
                "seccion": dominio,
                "fragmento": origen,
            })

        if not segmentos:
            return vacio
        return {
            "par_linguistico": par,
            "segmentos": segmentos,
            "desde_memoria": True,
            "lock_activo": lock_activo,
        }
