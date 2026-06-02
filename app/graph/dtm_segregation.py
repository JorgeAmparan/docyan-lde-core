"""
Segregación estricta del DTM por par lingüístico — DOCYAN LDE™ by XCID.

B3 §2 (Adenda MVP). El DTM segrega **sin cruce** cada par lingüístico
direccional en su propio `graph_name`, componiendo el aislamiento multi-tenant
(decisión cerrada, paralelo al DKG) con el par:

    docyan_dtm_{tenant_id}_{par_id}

donde `par_id` es la representación canónica del par direccional, p. ej.
`en-US_es-MX`. Cada par DIRECCIONAL es su propio grafo: en-US→es-MX y
es-MX→en-US son grafos distintos (la traducción no es simétrica en DOCYAN —
contexto, glosario y lock difieren por dirección).

**Agnóstico a idioma:** agregar un par nuevo es *configuración* (añadir el par a
`INITIAL_PAIRS` o pasarlo a `graph_name_for_pair`), nunca código nuevo. Los 5
pares iniciales del día 1 están en `INITIAL_PAIRS`.

El motor que CONSULTA estos grafos (búsqueda priorizada de TM dual, fuzzy
matching) es B5; aquí solo se resuelven los nombres canónicos.
"""
from __future__ import annotations

from app.graph.schemas.dtm_ontology import DTM_GRAPH_PREFIX

# ─────────────────────────────────────────────────────────────────────────────
# Pares iniciales (día 1). Configuración, no código: ampliar esta tupla (o pasar
# el par directo a graph_name_for_pair) habilita un par nuevo sin tocar lógica.
# Cada entrada es (idioma_origen, idioma_destino) en BCP-47.
# ─────────────────────────────────────────────────────────────────────────────

INITIAL_PAIRS: tuple[tuple[str, str], ...] = (
    ("en-US", "es-MX"),
    ("en-US", "es-US"),
    ("en-US", "es-ES"),
    ("en-UK", "es-MX"),
    ("en-UK", "es-ES"),
)


class InvalidLanguagePairError(ValueError):
    """Código de idioma o par lingüístico malformado."""


def normalize_lang(code: str) -> str:
    """
    Normaliza un código BCP-47 a su forma canónica de casing:
    subetiqueta de idioma en minúscula, subetiqueta de región en MAYÚSCULA.

    Ej.: 'EN-us' → 'en-US', 'es-mx' → 'es-MX', 'EN' → 'en'.

    No valida contra el registro IANA (DOCYAN admite p. ej. 'en-UK' como lo
    define el negocio); solo normaliza la forma. Acepta '-' o '_' como separador.
    """
    raw = (code or "").strip().replace("_", "-")
    if not raw:
        raise InvalidLanguagePairError("Código de idioma vacío.")
    parts = raw.split("-")
    lang = parts[0].lower()
    if not lang.isalpha():
        raise InvalidLanguagePairError(f"Subetiqueta de idioma inválida en '{code}'.")
    if len(parts) == 1:
        return lang
    region = parts[1].upper()
    rest = parts[2:]
    return "-".join([lang, region, *rest])


def pair_id(source_lang: str, target_lang: str) -> str:
    """
    Identificador canónico del par DIRECCIONAL: `{origen}_{destino}` con ambos
    códigos normalizados. Ej.: ('EN-us', 'es-mx') → 'en-US_es-MX'.
    """
    src = normalize_lang(source_lang)
    tgt = normalize_lang(target_lang)
    if src == tgt:
        raise InvalidLanguagePairError(
            f"Par lingüístico inválido: origen y destino iguales ('{src}')."
        )
    return f"{src}_{tgt}"


def par_linguistico_label(source_lang: str, target_lang: str) -> str:
    """
    Forma legible del par para la propiedad `par_linguistico` de `:Glosario`
    (BCP-47 ↔ BCP-47). Ej.: 'en-US↔es-MX'. Distinta del `par_id` (que va en el
    graph_name y usa '_' por compatibilidad de nombres de grafo).
    """
    return f"{normalize_lang(source_lang)}↔{normalize_lang(target_lang)}"


def graph_name_for_pair(tenant_id: str, source_lang: str, target_lang: str) -> str:
    """
    Resuelve el `graph_name` aislado de un par lingüístico de un tenant
    (regla absoluta de segregación B3 §2). Único punto de composición del nombre.

    Ej.: ('acme', 'en-US', 'es-MX') → 'docyan_dtm_acme_en-US_es-MX'.
    """
    tid = (tenant_id or "").strip()
    if not tid:
        raise InvalidLanguagePairError("tenant_id no puede ser vacío.")
    return f"{DTM_GRAPH_PREFIX}{tid}_{pair_id(source_lang, target_lang)}"


def initial_graph_names(tenant_id: str) -> list[str]:
    """Los 5 graph_names iniciales de un tenant (día 1)."""
    return [graph_name_for_pair(tenant_id, src, tgt) for src, tgt in INITIAL_PAIRS]


def is_initial_pair(source_lang: str, target_lang: str) -> bool:
    """True si el par (normalizado) está entre los 5 pares iniciales."""
    norm = (normalize_lang(source_lang), normalize_lang(target_lang))
    return norm in {(normalize_lang(s), normalize_lang(t)) for s, t in INITIAL_PAIRS}
