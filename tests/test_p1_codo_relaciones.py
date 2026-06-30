"""
P1 — Relaciones inmediatas del Expediente del CoDo (del grafo real).

Verifica `GET /mo/codos/{id}/relaciones` con un grafo en memoria:
  · Una entidad devuelve sus relaciones reales (categoría, certificado de vigencia,
    alerta administrativa, procedimiento) con severidad correcta.
  · Las consultas sugeridas se derivan del CONTENIDO del documento (no inventadas).
  · 404 si el CoDo no existe; AISLAMIENTO: un tenant no ve relaciones de otro.
"""
from __future__ import annotations

import pytest

from app.api.auth import _create_access_token


class FakeRelDkg:
    """Grafo en memoria que responde los patrones Cypher de dkg_codos + dkg_relaciones
    + dkg_sugerencias_doc, por tenant (aislamiento real)."""

    def __init__(self) -> None:
        self.g: dict[str, dict] = {}

    def _t(self, tid: str) -> dict:
        return self.g.setdefault(tid, {"ent": {}, "docs": {}})

    def add_entidad(self, tid, eid, *, nombre, categoria=None, certs=None, alertas=None,
                    procs=None, docs=None):
        self._t(tid)["ent"][eid] = {
            "id": eid, "nombre": nombre, "categoria": categoria,
            "certs": certs or [], "alertas": alertas or [], "procs": procs or [],
            "docs": docs or [],
        }

    def add_doc(self, tid, did, *, nombre, tipo=None, content=None):
        self._t(tid)["docs"][did] = {"id": did, "nombre": nombre, "tipo": tipo,
                                     "content": content or {}}

    def query(self, tenant_id, cypher, params=None):
        params = params or {}
        t = self._t(tenant_id)
        i = params.get("id")

        # ── contexto_codo (dkg_codos) — entidad ──
        if "collect({id: d.id" in cypher:
            e = t["ent"].get(i)
            if not e:
                return []
            docs = [{"id": d, "nombre": t["docs"][d]["nombre"], "tipo": t["docs"][d]["tipo"]}
                    for d in e["docs"] if d in t["docs"]] or [{"id": None, "nombre": None, "tipo": None}]
            return [{"id": e["id"], "nombre": e["nombre"], "tipo": "equipo", "documentos": docs}]
        # ── contexto_codo (dkg_codos) — documento suelto ──
        if "count(x) AS contenido" in cypher:
            d = t["docs"].get(i)
            return [{"id": d["id"], "nombre": d["nombre"], "tipo": d["tipo"],
                     "contenido": sum(d["content"].values())}] if d else []

        # ── relaciones (dkg_relaciones) ──
        if "CATEGORIZADA_COMO" in cypher:
            e = t["ent"].get(i)
            return [{"id": e["categoria"]["id"], "titulo": e["categoria"]["nombre"]}] \
                if e and e.get("categoria") else []
        if "c:CertificadoVigencia" in cypher:
            e = t["ent"].get(i)
            return [{"id": c["id"], "titulo": c["titulo"], "tag": c.get("tag", "vigencia"),
                     "nota": c.get("nota"), "meta": c["id"]} for c in (e["certs"] if e else [])]
        if "a:Alerta" in cypher:
            e = t["ent"].get(i)
            return [{"id": a["id"], "titulo": a["titulo"], "urgencia": a.get("urgencia", "media"),
                     "nota": a.get("nota"), "meta": a["id"]} for a in (e["alertas"] if e else [])]
        if "p:Procedimiento" in cypher:
            e = t["ent"].get(i)
            return [{"id": p["id"], "titulo": p["titulo"], "meta": p["id"]}
                    for p in (e["procs"] if e else [])]
        if "VERSION_HISTORICA" in cypher or "TIENE_TRADUCCION" in cypher \
                or "v:RecursoVideo" in cypher or "DOCUMENTADA_POR]->(d:DocumentoSource {id: $id})" in cypher:
            return []  # no se siembran en este test

        # ── sugerencias por documento (dkg_sugerencias_doc) ──
        if "labels(n)[0] AS label" in cypher:
            d = t["docs"].get(i)
            return [{"label": lbl, "cnt": cnt} for lbl, cnt in d["content"].items()] if d else []

        return []


@pytest.fixture
def ctx(monkeypatch):
    dkg = FakeRelDkg()
    from app.onboarding import providers as onb
    monkeypatch.setattr(onb, "get_dkg", lambda: dkg)
    from fastapi.testclient import TestClient

    from app.api.main import app
    return {"client": TestClient(app), "dkg": dkg}


def _jwt(org_id, role="admin"):
    tok = _create_access_token({"id": "u1", "org_id": org_id, "role": role, "email": "x@x.com"})
    return {"Authorization": f"Bearer {tok}"}


def test_relaciones_de_entidad_salen_del_grafo(ctx):
    client, dkg = ctx["client"], ctx["dkg"]
    dkg.add_doc("org-1", "doc-1", nombre="manual.pdf", tipo="manual_tecnico",
                content={"Procedimiento": 3, "Especificacion": 5})
    dkg.add_entidad(
        "org-1", "ent-A", nombre="Mezcladora MAXI-10ND",
        categoria={"id": "cat-1", "nombre": "Mezcladora de concreto"},
        certs=[{"id": "CAL-03", "titulo": "Calibración del motor", "tag": "vigente"}],
        alertas=[{"id": "AL-1", "titulo": "Calibración por vencer", "urgencia": "alta",
                  "nota": "Vence 02 jul"}],
        procs=[{"id": "P-1", "titulo": "Arranque seguro"}],
        docs=["doc-1"],
    )

    r = client.get("/mo/codos/ent-A/relaciones", headers=_jwt("org-1"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["tipo_codo"] == "entidad"
    tipos = {rel["tipo"] for rel in body["relaciones"]}
    assert {"categoria", "certificado", "alerta", "procedimiento"} <= tipos
    alerta = next(rel for rel in body["relaciones"] if rel["tipo"] == "alerta")
    assert alerta["severidad"] == "warn"  # urgencia alta → warn
    # sugerencias derivadas del contenido real del doc principal
    intenciones = {s["tipo_intencion"] for s in body["consultas_sugeridas"]}
    assert "procedimiento" in intenciones and "informativa" in intenciones


def test_404_si_codo_no_existe(ctx):
    client = ctx["client"]
    assert client.get("/mo/codos/nope/relaciones", headers=_jwt("org-1")).status_code == 404


def test_aislamiento_entre_tenants(ctx):
    client, dkg = ctx["client"], ctx["dkg"]
    dkg.add_entidad("org-1", "ent-A", nombre="De org-1",
                    categoria={"id": "c", "nombre": "X"}, docs=[])
    # org-2 no ve el CoDo de org-1 → 404 (sin filtrar existencia)
    assert client.get("/mo/codos/ent-A/relaciones", headers=_jwt("org-2")).status_code == 404
