"""
B9.5 — Auto-extracción + materialización (T5 árbol, T3 diagrama).

DOCYAN extrae automáticamente del documento y materializa al grafo (sin revisión
manual). El LLM/visión se inyecta (mock) para correr sin claves — la extracción
REAL con Gemini/Docling es autoridad de CI (ver test_b95_autoextraccion_real_ci.py).

Cubre: extractores (parseo + estructura), wiring del worker (materialización al
grafo por tipo de schema), y el JSON tolerante.
"""
from __future__ import annotations

import json

from app.jobs.job_models import IngestJob
from worker.extraction._json import parse_llm_json
from worker.extraction.diagram_extractor import extraer_diagramas
from worker.extraction.docling_figures import FiguraExtraida
from worker.extraction.tree_extractor import extraer_arbol_diagnostico


class _FakeDKG:
    """Cliente DKG falso: registra las queries (verifica materialización sin FalkorDB)."""

    def __init__(self):
        self.queries: list[tuple[str, str]] = []

    def query(self, tenant_id, cypher, params=None):
        self.queries.append((tenant_id, cypher))
        return []

    def labels_creadas(self) -> set[str]:
        import re
        labels: set[str] = set()
        for _t, c in self.queries:
            labels.update(re.findall(r"MERGE \(\w+:(\w+)", c))
        return labels


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

def test_worker_materializa_arbol_t5(monkeypatch):
    import worker.extraction.tree_extractor as te
    from worker import ingest_pipeline as ip

    dkg = _FakeDKG()
    pipe = ip.IngestPipeline(dkg_client=dkg)
    draft = extraer_arbol_diagnostico(
        "x", complete=lambda _p: json.dumps(
            {"titulo": "T", "nodos": [{"id": "n1", "pregunta": "¿?", "orden": 0}]}))
    monkeypatch.setattr(te, "extraer_arbol_diagnostico", lambda *_a, **_k: draft)

    counters = pipe._auto_materializar_visuales(_FakeSchema([5, 2]), "markdown", None, _job(), "doc1")
    assert counters["arboles"] == 1
    # Materializó al grafo: creó :ArbolDiagnostico + :NodoDecision y enlazó al doc.
    assert "ArbolDiagnostico" in dkg.labels_creadas()
    assert "NodoDecision" in dkg.labels_creadas()
    assert any("doc1" in c or "DocumentoSource" in c for _t, c in dkg.queries)

def test_worker_materializa_diagrama_t3(monkeypatch):
    import worker.extraction.diagram_extractor as de
    import worker.extraction.docling_figures as df
    from worker import ingest_pipeline as ip
    from worker.extraction.models import DraftDiagrama, EtiquetaBorrador

    dkg = _FakeDKG()
    pipe = ip.IngestPipeline(dkg_client=dkg)
    monkeypatch.setattr(df, "extraer_figuras", lambda _doc: [FiguraExtraida("f", b"x")])
    monkeypatch.setattr(de, "extraer_diagramas", lambda *_a, **_k: [
        DraftDiagrama(titulo="D", recurso_url="u", etiquetas=[EtiquetaBorrador(texto="x", x=0.1, y=0.2, w=0.1, h=0.1)])
    ])

    counters = pipe._auto_materializar_visuales(_FakeSchema([3]), "md", object(), _job(), "doc2")
    assert counters["diagramas"] == 1
    assert "RecursoVisual" in dkg.labels_creadas()
    assert "Etiqueta" in dkg.labels_creadas()

def test_worker_no_materializa_para_tipos_sin_t3_t5():
    from worker import ingest_pipeline as ip
    dkg = _FakeDKG()
    pipe = ip.IngestPipeline(dkg_client=dkg)
    counters = pipe._auto_materializar_visuales(_FakeSchema([1, 8]), "md", None, _job(), "doc3")
    assert counters == {"arboles": 0, "diagramas": 0}
    assert dkg.queries == []
