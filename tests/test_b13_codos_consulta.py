"""
B13 — CoDos consultables + aislamiento multi-tenant (cierre del ciclo de consulta).

Verifica `GET /mo/codos` y `GET /mo/codos/{id}` con un grafo en memoria multi-tenant:
  · Lista entidades operativas (CoDos plenos) Y documentos sueltos (freemium directo).
  · El contexto de un CoDo trae título/meta/entidad_id reales (lo que CANNED_CTX fingía).
  · Un documento suelto resuelve con `entidad_id=None` (scope de tenant).
  · AISLAMIENTO ESTRICTO: un tenant no ve los CoDos de otro, y el contexto de un id de
    otro tenant responde 404 (sin filtrar existencia). Invariante más crítico del producto.
"""
from __future__ import annotations

import pytest

from app.api.auth import _create_access_token


class FakeCodosDkg:
    """
    Grafo en memoria multi-tenant para los patrones Cypher de `app/graph/dkg_codos.py`.
    Aislamiento real: cada tenant_id tiene su propio espacio de entidades y documentos.
    """

    def __init__(self) -> None:
        # tenant -> {"entidades": {eid: {...}}, "docs": {doc_id: {...}}}
        self.g: dict[str, dict] = {}

    def _t(self, tenant_id: str) -> dict:
        return self.g.setdefault(tenant_id, {"entidades": {}, "docs": {}})

    def add_entidad(self, tenant_id: str, eid: str, *, nombre=None, tipo=None, alertas=0) -> None:
        self._t(tenant_id)["entidades"][eid] = {
            "id": eid, "nombre": nombre, "tipo": tipo, "alertas": int(alertas), "docs": [],
        }

    def add_doc(self, tenant_id: str, doc_id: str, *, nombre_archivo=None,
                tipo_documento=None, contenido=0, entidad=None) -> None:
        self._t(tenant_id)["docs"][doc_id] = {
            "id": doc_id, "nombre_archivo": nombre_archivo, "tipo_documento": tipo_documento,
            "contenido": int(contenido), "entidad": entidad,
        }
        if entidad and entidad in self._t(tenant_id)["entidades"]:
            self._t(tenant_id)["entidades"][entidad]["docs"].append(doc_id)

    def query(self, tenant_id: str, cypher: str, params=None):
        params = params or {}
        t = self._t(tenant_id)
        ents, docs = t["entidades"], t["docs"]

        if "alertas AS alertas" in cypher:  # listar entidades
            out = []
            for e in ents.values():
                out.append({
                    "id": e["id"], "nombre": e["nombre"] or e["tipo"] or e["id"],
                    "tipo_entidad": e["tipo"], "documentos": len(e["docs"]),
                    "alertas": e["alertas"],
                })
            return sorted(out, key=lambda r: (r["nombre"] or ""))

        if "WHERE ents = 0" in cypher:  # documentos sueltos (sin entidad)
            out = []
            for d in docs.values():
                if not d["entidad"]:
                    out.append({
                        "id": d["id"], "nombre": d["nombre_archivo"] or d["id"],
                        "tipo_documento": d["tipo_documento"],
                    })
            return sorted(out, key=lambda r: (r["nombre"] or ""))

        if "MATCH (e:EntidadOperativa {id: $id})" in cypher:  # contexto entidad
            e = ents.get(params.get("id"))
            if not e:
                return []
            documentos = [
                {"id": docs[did]["id"], "nombre": docs[did]["nombre_archivo"] or did,
                 "tipo": docs[did]["tipo_documento"]}
                for did in e["docs"]
            ] or [{"id": None, "nombre": None, "tipo": None}]  # collect null cuando no hay docs
            return [{
                "id": e["id"], "nombre": e["nombre"] or e["tipo"] or e["id"],
                "tipo": e["tipo"], "documentos": documentos,
            }]

        if "MATCH (d:DocumentoSource {id: $id})" in cypher:  # contexto documento
            d = docs.get(params.get("id"))
            if not d:
                return []
            return [{
                "id": d["id"], "nombre": d["nombre_archivo"] or d["id"],
                "tipo": d["tipo_documento"], "contenido": d["contenido"],
            }]

        return []


@pytest.fixture
def ctx(monkeypatch):
    dkg = FakeCodosDkg()
    from app.onboarding import providers as onb
    monkeypatch.setattr(onb, "get_dkg", lambda: dkg)

    from fastapi.testclient import TestClient

    from app.api.main import app
    return {"client": TestClient(app), "dkg": dkg}


def _jwt(org_id: str, role: str = "admin") -> dict:
    tok = _create_access_token({"id": "u1", "org_id": org_id, "role": role, "email": "x@x.com"})
    return {"Authorization": f"Bearer {tok}"}


# ── Listado ────────────────────────────────────────────────────────────────────

def test_lista_entidades_y_documentos_sueltos(ctx):
    client, dkg = ctx["client"], ctx["dkg"]
    dkg.add_entidad("org-1", "ent-A", nombre="Centrífuga 1", tipo="equipo")
    dkg.add_doc("org-1", "doc-1", nombre_archivo="manual.pdf", tipo_documento="manual", entidad="ent-A")
    dkg.add_doc("org-1", "doc-2", nombre_archivo="MSDS.pdf", tipo_documento="MSDS")  # suelto

    r = client.get("/mo/codos", headers=_jwt("org-1"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] == 2
    by_id = {c["id"]: c for c in body["items"]}
    assert by_id["ent-A"]["tipo"] == "entidad" and by_id["ent-A"]["documentos"] == 1
    assert by_id["doc-2"]["tipo"] == "documento" and by_id["doc-2"]["documentos"] == 1
    assert by_id["doc-2"]["nombre"] == "MSDS.pdf"


def test_documento_atado_a_entidad_no_aparece_suelto(ctx):
    client, dkg = ctx["client"], ctx["dkg"]
    dkg.add_entidad("org-1", "ent-A", nombre="Equipo")
    dkg.add_doc("org-1", "doc-1", nombre_archivo="m.pdf", entidad="ent-A")
    r = client.get("/mo/codos", headers=_jwt("org-1")).json()
    # Solo la entidad (1 CoDo); el documento cuelga de ella, no se duplica como suelto.
    assert r["total"] == 1 and r["items"][0]["id"] == "ent-A"


def test_estado_warn_si_entidad_tiene_alertas(ctx):
    client, dkg = ctx["client"], ctx["dkg"]
    dkg.add_entidad("org-1", "ent-A", nombre="Con alertas", alertas=2)
    dkg.add_entidad("org-1", "ent-B", nombre="Al día", alertas=0)
    items = {c["id"]: c for c in client.get("/mo/codos", headers=_jwt("org-1")).json()["items"]}
    assert items["ent-A"]["estado"] == "warn"
    assert items["ent-B"]["estado"] == "ok"
    # P5: el conteo REAL de alertas se expone (no un "2" hardcodeado en el front).
    assert items["ent-A"]["alertas"] == 2
    assert items["ent-B"]["alertas"] == 0


# ── Contexto ───────────────────────────────────────────────────────────────────

def test_contexto_de_entidad_trae_entidad_id_real(ctx):
    client, dkg = ctx["client"], ctx["dkg"]
    dkg.add_entidad("org-1", "ent-A", nombre="Centrífuga Hettich", tipo="equipo")
    dkg.add_doc("org-1", "doc-1", nombre_archivo="manual.pdf", tipo_documento="manual", entidad="ent-A")

    r = client.get("/mo/codos/ent-A", headers=_jwt("org-1"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["tipo"] == "entidad"
    assert body["entidad_id"] == "ent-A"  # id REAL (no inventado)
    assert body["titulo"] == "Centrífuga Hettich"
    assert "1 documento" in body["meta"]
    assert body["documentos"][0]["id"] == "doc-1"


def test_contexto_de_documento_suelto_sin_entidad(ctx):
    client, dkg = ctx["client"], ctx["dkg"]
    dkg.add_doc("org-1", "doc-2", nombre_archivo="MSDS.pdf", tipo_documento="MSDS", contenido=7)

    r = client.get("/mo/codos/doc-2", headers=_jwt("org-1"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["tipo"] == "documento"
    assert body["entidad_id"] is None  # documento suelto → scope de tenant
    assert body["titulo"] == "MSDS.pdf"
    assert "MSDS" in body["meta"]


def test_contexto_inexistente_404(ctx):
    client = ctx["client"]
    r = client.get("/mo/codos/no-existe", headers=_jwt("org-1"))
    assert r.status_code == 404


# ── Aislamiento multi-tenant (invariante crítico) ──────────────────────────────

def test_lista_codos_aislada_por_tenant(ctx):
    client, dkg = ctx["client"], ctx["dkg"]
    dkg.add_entidad("org-A", "ent-A", nombre="Solo A")
    dkg.add_doc("org-A", "doc-A", nombre_archivo="soloA.pdf")
    dkg.add_doc("org-B", "doc-B", nombre_archivo="soloB.pdf")

    a = client.get("/mo/codos", headers=_jwt("org-A")).json()
    b = client.get("/mo/codos", headers=_jwt("org-B")).json()
    ids_a = {c["id"] for c in a["items"]}
    ids_b = {c["id"] for c in b["items"]}
    assert ids_a == {"ent-A", "doc-A"}
    assert ids_b == {"doc-B"}
    assert ids_a.isdisjoint(ids_b)
    # B no ve nada de A ni en el texto crudo.
    assert "soloA.pdf" not in client.get("/mo/codos", headers=_jwt("org-B")).text


def test_contexto_de_codo_de_otro_tenant_es_404(ctx):
    client, dkg = ctx["client"], ctx["dkg"]
    dkg.add_entidad("org-A", "ent-A", nombre="Solo A")
    dkg.add_doc("org-A", "doc-A", nombre_archivo="soloA.pdf")

    # org-B intenta resolver un CoDo de org-A → 404 (no filtra existencia).
    assert client.get("/mo/codos/ent-A", headers=_jwt("org-B")).status_code == 404
    assert client.get("/mo/codos/doc-A", headers=_jwt("org-B")).status_code == 404
    # org-A sí lo resuelve.
    assert client.get("/mo/codos/ent-A", headers=_jwt("org-A")).status_code == 200


def test_codos_requiere_autenticacion(ctx):
    client = ctx["client"]
    assert client.get("/mo/codos").status_code in (401, 403)
    assert client.get("/mo/codos/x").status_code in (401, 403)
