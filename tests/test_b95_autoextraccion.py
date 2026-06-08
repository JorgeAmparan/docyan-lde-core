"""
B9.5 — Auto-extracción de borradores de curación (T5 árbol, T3 diagrama).

DOCYAN extrae el borrador del documento; el humano lo revisa. El LLM/visión se
inyecta (mock) para correr sin claves — la extracción REAL con Gemini/Docling es
autoridad de CI (ver test_b95_autoextraccion_real_ci.py, gated por claves).

Cubre: extractores (parseo + estructura), wiring del worker (persistencia del
borrador por tipo de schema), y el JSON tolerante.
"""
from __future__ import annotations

import json

from app.curacion.store import InMemoryDraftStore
from app.jobs.job_models import IngestJob
from worker.extraction._json import parse_llm_json
from worker.extraction.diagram_extractor import extraer_diagramas
from worker.extraction.docling_figures import FiguraExtraida
from worker.extraction.tree_extractor import extraer_arbol_diagnostico


# ── Parser JSON tolerante ─────────────────────────────────────────────────────

def test_parse_llm_json_con_fences_y_prosa():
    txt = 'Claro, aquí tienes:\n```json\n{"a": 1, "b": [2, 3,]}\n```\ngracias'
    assert parse_llm_json(txt) == {"a": 1, "b": [2, 3]}

def test_parse_llm_json_invalido_devuelve_none():
    assert parse_llm_json("no hay json aquí") is None


# ── T5 — extractor de árbol ───────────────────────────────────────────────────

def test_extraer_arbol_desde_llm():
    salida = json.dumps({
        "titulo": "La centrífuga no arranca",
        "nodos": [
            {"id": "n1", "pregunta": "¿Enciende el panel?", "orden": 0,
             "opciones": [{"etiqueta": "Sí", "siguiente_nodo_id": "n2"},
                          {"etiqueta": "No", "siguiente_nodo_id": "n3"}]},
            {"id": "n2", "pregunta": "¿La tapa cierra?", "orden": 1,
             "opciones": [{"etiqueta": "No", "siguiente_nodo_id": "n4"}]},
            {"id": "n3", "orden": 2, "causa_probable": "Sin alimentación",
             "accion_resolutoria": "Revisar breaker"},
            {"id": "n4", "orden": 3, "causa_probable": "Interlock abierto",
             "accion_resolutoria": "Cerrar tapa"},
        ],
    })
    draft = extraer_arbol_diagnostico("texto del manual...", complete=lambda _p: salida)
    assert draft is not None
    assert draft.titulo == "La centrífuga no arranca"
    assert len(draft.nodos) == 4
    assert draft.nodos[0].opciones[0].etiqueta == "Sí"
    assert draft.validar_conectividad() == []  # árbol bien formado

def test_extraer_arbol_sin_arbol_devuelve_none():
    salida = json.dumps({"titulo": "", "nodos": []})
    assert extraer_arbol_diagnostico("doc sin árbol", complete=lambda _p: salida) is None

def test_extraer_arbol_llm_falla_devuelve_none():
    def boom(_p):
        raise RuntimeError("rate limit")
    assert extraer_arbol_diagnostico("doc", complete=boom) is None


# ── T3 — extractor de diagrama (visión) ───────────────────────────────────────

def test_extraer_diagrama_desde_vision():
    salida = json.dumps({
        "titulo": "Rotor y cabezal",
        "etiquetas": [
            {"texto": "Tapa del rotor", "x": 0.33, "y": 0.26, "w": 0.1, "h": 0.06},
            {"texto": "Acople motor-eje", "x": 0.44, "y": 0.72, "w": 0.12, "h": 0.05},
        ],
        "leyenda_simbolica": [{"simbolo": "⚠", "significado": "Punto caliente"}],
    })
    figuras = [FiguraExtraida(titulo="Fig 1", png_bytes=b"\x89PNGfake")]
    assets: list = []
    drafts = extraer_diagramas(
        "tenantX", figuras,
        complete_vision=lambda _p, _img: salida,
        put_asset=lambda t, n, b: f"https://assets/{t}/{n}",
    )
    assert len(drafts) == 1
    d = drafts[0]
    assert d.titulo == "Rotor y cabezal"
    assert d.recurso_url == "https://assets/tenantX/figura_0.png"
    assert len(d.etiquetas) == 2
    assert d.etiquetas[0].texto == "Tapa del rotor"
    assert d.etiquetas[0].w == 0.1 and d.etiquetas[0].h == 0.06

def test_extraer_diagrama_figura_sin_rotulos_se_omite():
    salida = json.dumps({"titulo": "", "etiquetas": [], "leyenda_simbolica": []})
    figuras = [FiguraExtraida(titulo="foto", png_bytes=b"x")]
    drafts = extraer_diagramas("t", figuras, complete_vision=lambda _p, _i: salida, put_asset=lambda *_: "u")
    assert drafts == []


# ── Wiring del worker — persiste el borrador según el tipo de schema ──────────

class _FakeSchema:
    def __init__(self, tipos):
        self.tipos_intencion_visualizacion = tipos
        self.tipo_documento = "x"

def _job():
    return IngestJob(job_id="j1", tenant_id="tnt", documento_ref="r", nombre_archivo="d.pdf",
                     contexto={"entidad_id": "eq-1"})

def test_worker_autoextrae_arbol_t5(monkeypatch):
    from worker import ingest_pipeline as ip
    import worker.extraction.tree_extractor as te

    store = InMemoryDraftStore()
    pipe = ip.IngestPipeline(draft_store=store)
    draft = extraer_arbol_diagnostico(
        "x", complete=lambda _p: json.dumps(
            {"titulo": "T", "nodos": [{"id": "n1", "pregunta": "¿?", "orden": 0}]}))
    monkeypatch.setattr(te, "extraer_arbol_diagnostico", lambda *_a, **_k: draft)

    counters = pipe._auto_extraer_borradores(_FakeSchema([5, 2]), "markdown", None, _job(), "doc1")
    assert counters["arboles"] == 1
    saved = store.list("tnt")
    assert len(saved) == 1
    assert saved[0]["draft"]["kind"] == "arbol"
    assert saved[0]["doc_id"] == "doc1"
    assert saved[0]["entidad_id"] == "eq-1"

def test_worker_autoextrae_diagrama_t3(monkeypatch):
    from worker import ingest_pipeline as ip
    import worker.extraction.docling_figures as df
    import worker.extraction.diagram_extractor as de
    from app.curacion.models import DraftDiagrama, EtiquetaBorrador

    store = InMemoryDraftStore()
    pipe = ip.IngestPipeline(draft_store=store)
    monkeypatch.setattr(df, "extraer_figuras", lambda _doc: [FiguraExtraida("f", b"x")])
    monkeypatch.setattr(de, "extraer_diagramas", lambda *_a, **_k: [
        DraftDiagrama(titulo="D", recurso_url="u", etiquetas=[EtiquetaBorrador(texto="x", x=0.1, y=0.2, w=0.1, h=0.1)])
    ])

    counters = pipe._auto_extraer_borradores(_FakeSchema([3]), "md", object(), _job(), "doc2")
    assert counters["diagramas"] == 1
    assert store.list("tnt")[0]["draft"]["kind"] == "diagrama"

def test_worker_no_extrae_para_tipos_sin_t3_t5(monkeypatch):
    from worker import ingest_pipeline as ip
    store = InMemoryDraftStore()
    pipe = ip.IngestPipeline(draft_store=store)
    counters = pipe._auto_extraer_borradores(_FakeSchema([1, 8]), "md", None, _job(), "doc3")
    assert counters == {"arboles": 0, "diagramas": 0}
    assert store.list("tnt") == []
