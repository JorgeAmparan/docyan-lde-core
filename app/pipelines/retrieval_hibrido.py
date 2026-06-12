"""
Retrieval híbrido léxico + semántico para la capa de consulta (B13.3 · DEF-2).

DOCYAN LDE™ by XCID.

Completa —NO rediseña— la **Decisión #2 del Paso C**: matching híbrido
Levenshtein + BGE-M3 en dos pasadas. La decisión está cerrada; los embeddings ya
viven en los nodos del grafo (el SDK escribe `embedding` por entidad) y el
embedder self-hosted (`docyan-lde-embedder`, decisión #1) ya corre. Lo único que
faltaba era CABLEAR la pasada vectorial al path de consulta, que hasta B13.2 era
léxico-only (`toLower + CONTAINS`): "OSHA PEL" ≠ "TLV", consultas de una palabra
caían a fallback, y EN sobre grafo ES casi siempre fallaba.

Reglas (Decisión #2, literal):
  · Dos pasadas: Levenshtein (léxico) + BGE-M3 (semántico).
  · Score 70/30 en bandas altas, 30/70 en bandas bajas (cuando el léxico es
    fuerte se confía en él; cuando es débil, se confía en la semántica).
  · Umbral mínimo léxico ≥30% para invocar la vectorial.
  · Tabulador estándar industria: 100% / 95-99% / 85-94% / 75-84% / 50-74% / 0-49%.

Diseño: este módulo es PURO (sin FalkorDB, sin red). El reader le pasa los
candidatos ya leídos del grafo (con su `embedding`) y el vector del query; el
módulo puntúa y ordena. El embedder es inyectable: producción usa `bge_client`
(decisión #1, SIN embedder alternativo); los tests inyectan un fake determinista.
Si el embedder no responde, se degrada a léxico-only con aviso (degradación
honesta, no un embedder alterno).
"""
from __future__ import annotations

import logging
import math
import re
import unicodedata
from dataclasses import dataclass, field

logger = logging.getLogger("docyan.retrieval.hibrido")

# Umbral léxico mínimo para invocar la pasada vectorial (Decisión #2).
UMBRAL_LEXICO_VECTORIAL = 0.30
# Frontera del tabulador entre "bandas altas" (≥85%, ponderación 70/30 a favor del
# léxico) y "bandas bajas" (<85%, ponderación 30/70 a favor de la semántica).
UMBRAL_BANDA_ALTA = 0.85
# Piso de relevancia para que un candidato no-léxico (encontrado solo por semántica)
# entre al resultado. Evita inundar la InfoCard con ruido semántico lejano.
PISO_RELEVANCIA_SEMANTICA = 0.55


def _sin_acentos(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def _norm(s: str) -> str:
    """Minúsculas sin acentos: base de la comparación léxica (Levenshtein/tokens)."""
    return _sin_acentos((s or "").lower())


_TOKEN = re.compile(r"[0-9a-z][0-9a-z\-/]*")


def _tokens(s: str) -> list[str]:
    return _TOKEN.findall(_norm(s))


def levenshtein(a: str, b: str) -> int:
    """Distancia de edición clásica (programación dinámica, O(len(a)·len(b)))."""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def ratio_levenshtein(a: str, b: str) -> float:
    """Similitud Levenshtein normalizada en [0,1] (1 = idénticos)."""
    a, b = _norm(a), _norm(b)
    if not a and not b:
        return 1.0
    m = max(len(a), len(b))
    if m == 0:
        return 1.0
    return 1.0 - levenshtein(a, b) / m


def es_match_estricto(query: str, texto: str) -> bool:
    """
    ¿Algún token del query aparece como substring (sin acentos) del texto? Es la
    PARIDAD exacta del `toLower + CONTAINS` que hace el Cypher de recall. Sirve de
    COMPUERTA de admisión: sin embedder, un candidato solo entra al resultado si
    casa léxicamente estricto — preserva la desambiguación léxica histórica (una
    pregunta por "OSHA" no arrastra la spec ACGIH por mera cercanía de edición).
    El Levenshtein refina el ORDEN y el blend, no admite por sí solo.
    """
    t = _norm(texto)
    return any(qt in t for qt in _tokens(query))


def score_lexico(query: str, texto: str) -> float:
    """
    Similitud léxica query↔texto en [0,1], robusta para campos cortos (nombre de
    spec) y consultas multi-palabra. Por cada token del query, el MEJOR de:
      · 1.0 si el token aparece como substring del texto (cubre el CONTAINS actual),
      · ratio Levenshtein contra el token más parecido del texto (cubre erratas/
        siglas/plurales: "manometro" ~ "manómetro", "PEL" ~ "PELs").
    El score es el promedio sobre los tokens del query (cada palabra que el usuario
    aporta cuenta). Sin tokens de query → 0 (lista vacía la maneja el reader).
    """
    q_tokens = _tokens(query)
    if not q_tokens:
        return 0.0
    t_norm = _norm(texto)
    t_tokens = _tokens(texto)
    total = 0.0
    for qt in q_tokens:
        if qt in t_norm:  # substring directo (paridad con el CONTAINS léxico)
            total += 1.0
            continue
        mejor = max((ratio_levenshtein(qt, tt) for tt in t_tokens), default=0.0)
        total += mejor
    return total / len(q_tokens)


def coseno(a: list[float] | None, b: list[float] | None) -> float:
    """Similitud coseno reescalada a [0,1] (0.5·(cos+1)). None/cero → 0."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0.0 or nb == 0.0:
        return 0.0
    cos = dot / (na * nb)
    return max(0.0, min(1.0, 0.5 * (cos + 1.0)))


def nivel_tabulador(score: float) -> str:
    """Banda del tabulador estándar de industria (Decisión #2)."""
    pct = score * 100.0
    if pct >= 100.0:
        return "100%"
    if pct >= 95.0:
        return "95-99%"
    if pct >= 85.0:
        return "85-94%"
    if pct >= 75.0:
        return "75-84%"
    if pct >= 50.0:
        return "50-74%"
    return "0-49%"


def combinar(lex: float, vec: float | None) -> float:
    """
    Combina léxico + semántico según las bandas de la Decisión #2. El "umbral léxico
    ≥30% para invocar la vectorial" es una compuerta GLOBAL de la pasada (en
    `rankear`: solo se calcula el embedding del query si ALGÚN candidato casa ≥30%);
    una vez invocada, el blend por candidato es:
      · léxico en banda alta (≥85%): 70/30 (se confía en el léxico fuerte).
      · léxico en banda media (30-85%): 30/70 (se confía en la semántica).
      · léxico < 30% (sin reclamo léxico propio): decide la SEMÁNTICA (score = vec).
        Es lo que permite el puente PEL↔TLV: una spec sin token compartido con el
        query entra por cercanía semántica, no por edición parcial de Levenshtein.
    Sin vector disponible (embedder caído / pasada no invocada) → score = léxico
    (degradación honesta a léxico estricto, idéntico a B13.2).
    """
    if vec is None:
        return lex
    if lex >= UMBRAL_BANDA_ALTA:
        return 0.70 * lex + 0.30 * vec
    if lex >= UMBRAL_LEXICO_VECTORIAL:
        return 0.30 * lex + 0.70 * vec
    return vec


@dataclass
class Candidato:
    """Un nodo citable leído del grafo, listo para puntuar.

    `texto_match` es el texto contra el que se mide el léxico (típicamente el
    nombre/valor del dato). `embedding` es el vector que el SDK ya escribió en el
    nodo (1024-dim BGE-M3); None ⇒ ese candidato solo se puntúa por léxico.
    `data` es el dict original del reader (se devuelve intacto al pipeline).
    """

    texto_match: str
    embedding: list[float] | None
    data: dict
    score: float = 0.0
    lex: float = 0.0
    estricto: bool = False
    vec: float | None = None
    banda: str = field(default="")


def _embeder_query(query: str, embedder) -> list[float] | None:
    """Vectoriza el query con el embedder (decisión #1). None si no hay/falla."""
    if embedder is None:
        return None
    try:
        return embedder.embed(query)
    except Exception as exc:  # noqa: BLE001 — degradación honesta a léxico-only
        logger.warning("embedder no disponible (%s) → retrieval léxico-only",
                       type(exc).__name__)
        return None


def rankear(
    query: str,
    candidatos: list[Candidato],
    *,
    embedder=None,
    limite: int = 8,
) -> list[Candidato]:
    """
    Puntúa y ordena candidatos por score híbrido (Decisión #2) y devuelve los
    mejores `limite`, filtrando ruido:

      · candidato con léxico ≥ umbral (30%) SIEMPRE entra (match léxico real);
      · candidato encontrado solo por semántica entra si su score ≥ piso de
        relevancia (evita arrastrar todo el grafo cuando el query no casa nada).

    Determinista: empata por score y rompe el empate por orden de llegada (estable).
    La pasada vectorial se invoca una sola vez (un embedding del query) y solo si
    AL MENOS un candidato superó el umbral léxico — coherente con "umbral mínimo
    léxico ≥30% para invocar la vectorial".
    """
    if not candidatos:
        return []
    # Pasada 1 — léxico (score fuzzy + compuerta estricta de substring).
    for c in candidatos:
        c.lex = score_lexico(query, c.texto_match)
        c.estricto = es_match_estricto(query, c.texto_match)
    invocar_vectorial = any(c.lex >= UMBRAL_LEXICO_VECTORIAL for c in candidatos)
    # Pasada 2 — semántico (solo si el léxico lo amerita y hay embedder).
    q_emb = _embeder_query(query, embedder) if invocar_vectorial else None
    for c in candidatos:
        c.vec = coseno(q_emb, c.embedding) if q_emb is not None else None
        c.score = combinar(c.lex, c.vec)
        c.banda = nivel_tabulador(c.score)
    # Admisión: match léxico estricto (paridad CONTAINS) SIEMPRE entra; un candidato
    # hallado solo por semántica entra si su score supera el piso de relevancia (y
    # por tanto hubo embedder real). Sin embedder, esto colapsa al recall léxico
    # histórico — ningún candidato no-substring se cuela. Orden estable por score.
    relevantes = [
        c for c in candidatos
        if c.estricto or (c.vec is not None and c.score >= PISO_RELEVANCIA_SEMANTICA)
    ]
    relevantes.sort(key=lambda c: c.score, reverse=True)
    return relevantes[:limite]
