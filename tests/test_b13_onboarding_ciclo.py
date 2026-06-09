"""
B13 — Onboarding Freemium/Piloto + ciclo de uso del cliente.

Verifica (con store/dkg/email en memoria, sin Supabase ni FalkorDB):
  · Signup Freemium: credenciales mínimas → org nueva, admin, freemium, 3 docs/30 días.
  · Canje de código piloto: válido → Esencial-piloto activo; usado/expirado/inválido → rechazo.
  · Onboarding dos fases: fase 1 sin plan; fase 2 activa plan + criticidad (#15).
  · Invitación: generar → token; aceptar → usuario con rol correcto; expirado/usado → rechazo.
  · Invitado consulta: queda en la MISMA org (aislamiento) con su rol.
  · Eliminar documento: se va del grafo y libera cupo; FAT conserva el evento.
  · Reemplazar: cargar tras eliminar dentro del límite (cupo se libera).
  · `orgs` formalizada: el signup crea la fila orgs + billing sin perder datos.
"""
from __future__ import annotations

import pytest

from app.api.auth import _create_access_token
from app.platform_admin.audit import InMemoryPlatformAudit
from app.platform_admin.store import InMemoryPlatformStore


class FakeTokenIssuer:
    """Emite tokens dummy (sin tocar Supabase). Captura el último user."""

    def __init__(self) -> None:
        self.last_user = None

    def emit(self, user: dict) -> dict:
        self.last_user = user
        return {"access_token": f"acc-{user['id']}", "refresh_token": f"ref-{user['id']}",
                "token_type": "bearer", "expires_in": 3600}


class FakeDkg:
    """
    Grafo en memoria, multi-tenant (clave por tenant_id). Simula los `:DocumentoSource`
    sobre los patrones Cypher que usa `app/graph/dkg_documents.py`. El aislamiento es
    real: cada tenant_id tiene su propio diccionario de documentos.
    """

    def __init__(self) -> None:
        self.graphs: dict[str, dict[str, dict]] = {}

    def add_doc(self, tenant_id: str, doc_id: str, **props) -> None:
        self.graphs.setdefault(tenant_id, {})[doc_id] = {
            "id": doc_id, "nombre_archivo": props.get("nombre_archivo"),
            "tipo_documento": props.get("tipo_documento"),
            "version": props.get("version"), "hash_contenido": props.get("hash_contenido"),
            "idioma_origen": props.get("idioma_origen", "es"),
            "contenido": int(props.get("contenido", 0)),
        }

    def query(self, tenant_id: str, cypher: str, params=None):
        params = params or {}
        docs = self.graphs.setdefault(tenant_id, {})
        doc_id = params.get("doc_id")

        if "DETACH DELETE d" in cypher:
            docs.pop(doc_id, None)
            return []
        if "DETACH DELETE x" in cypher:        # borrado de contenido exclusivo (no-op)
            return []
        if "RETURN count(x) AS c" in cypher:   # conteo de contenido exclusivo del doc
            d = docs.get(doc_id)
            return [{"c": d["contenido"] if d else 0}]
        if "count(d) AS c" in cypher:          # total de documentos vivos
            return [{"c": len(docs)}]
        if "AS contenido_directo" in cypher:   # listado de documentos
            return [
                {"id": d["id"], "nombre_archivo": d["nombre_archivo"],
                 "tipo_documento": d["tipo_documento"], "version": d["version"],
                 "hash_contenido": d["hash_contenido"], "idioma_origen": d["idioma_origen"],
                 "contenido_directo": d["contenido"]}
                for d in docs.values()
            ]
        if "RETURN d.id AS id" in cypher:  # documento_existe
            return [{"id": doc_id}] if doc_id in docs else []
        return []


@pytest.fixture
def ctx(monkeypatch):
    store = InMemoryPlatformStore()
    audit = InMemoryPlatformAudit()
    dkg = FakeDkg()
    issuer = FakeTokenIssuer()
    from app.notifications.email import CapturingEmailSender

    email = CapturingEmailSender()

    from app.onboarding import providers as onb
    from app.platform_admin import providers as pa

    for mod in (onb, pa):
        monkeypatch.setattr(mod, "get_store", lambda: store, raising=False)
        monkeypatch.setattr(mod, "get_audit", lambda: audit, raising=False)
    monkeypatch.setattr(onb, "get_dkg", lambda: dkg)
    monkeypatch.setattr(onb, "get_token_issuer", lambda: issuer)
    monkeypatch.setattr(onb, "get_email_sender", lambda: email)

    from fastapi.testclient import TestClient

    from app.api.main import app
    client = TestClient(app)
    return {"client": client, "store": store, "audit": audit, "dkg": dkg,
            "issuer": issuer, "email": email}


def _tenant_jwt(org_id: str, role: str = "admin", uid: str = "u1", em: str = "x@x.com") -> dict:
    tok = _create_access_token({"id": uid, "org_id": org_id, "role": role, "email": em})
    return {"Authorization": f"Bearer {tok}"}


# ════════════════════════════════════════════════════════════════════════════
# Signup Freemium (Fase 1)
# ════════════════════════════════════════════════════════════════════════════

def test_signup_freemium_credenciales_minimas(ctx):
    client, store = ctx["client"], ctx["store"]
    r = client.post("/onboarding/signup", json={
        "email": "jorge@lab.com", "password": "pass1234", "name": "Jorge",
        "org_name": "Lab Estándar",
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["plan"] == "freemium"
    assert body["role"] == "admin"
    assert body["doc_limit"] == 3
    assert body["fase2_completada"] is False
    assert body["freemium_expira"] is not None
    assert body["tokens"]["access_token"]

    org = store.get_org(body["org_id"])
    assert org["plan"] == "freemium" and org["doc_limit"] == 3
    assert org["banda_mercado"] == "A" and org["idioma"] == "es"
    # orgs formalizada SIN perder el registro de billing (ambos consistentes).
    assert store.get_org_billing(body["org_id"])["plan"] == "freemium"
    # Saldo de cortesía freemium provisionado (para vivir el producto).
    assert store.get_budget(body["org_id"])["saldo_actual_usd"] > 0


def test_signup_email_duplicado_rechaza(ctx):
    client = ctx["client"]
    payload = {"email": "dup@lab.com", "password": "pass1234", "name": "A", "org_name": "A"}
    assert client.post("/onboarding/signup", json=payload).status_code == 200
    assert client.post("/onboarding/signup", json=payload).status_code == 409


def test_signup_hereda_banda_e_idioma(ctx):
    client = ctx["client"]
    r = client.post("/onboarding/signup", json={
        "email": "intl@agency.com", "password": "pass1234", "name": "Intl",
        "org_name": "Agency", "banda_mercado": "B", "idioma": "en",
    })
    org = ctx["store"].get_org(r.json()["org_id"])
    assert org["banda_mercado"] == "B" and org["idioma"] == "en"


# ════════════════════════════════════════════════════════════════════════════
# Canje de código piloto
# ════════════════════════════════════════════════════════════════════════════

def _seed_code(store, code="DOCYAN-PILOT001", status="active", expires=None, tipo="piloto"):
    store.create_access_code({
        "code": code, "tipo": tipo, "cuota_documentos": 50, "cuota_saldo_usd": 25.0,
        "expires_at": expires, "status": status, "created_by": "fundador@xcid.com",
    })
    return code


def test_signup_con_codigo_piloto_activa_plan(ctx):
    client, store = ctx["client"], ctx["store"]
    code = _seed_code(store)
    r = client.post("/onboarding/signup", json={
        "email": "piloto@maquila.com", "password": "pass1234", "name": "Piloto",
        "org_name": "Maquila SA", "codigo_acceso": code,
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["plan"] == "piloto"
    assert body["fase2_completada"] is True  # plan ya activo por el código
    assert body["doc_limit"] == 50
    org = store.get_org(body["org_id"])
    assert org["plan"] == "piloto" and org["lifecycle_status"] == "active"
    assert store.get_budget(body["org_id"])["saldo_actual_usd"] == 25.0
    assert store.get_access_code(code)["status"] == "used"


def test_codigo_usado_rechaza(ctx):
    client, store = ctx["client"], ctx["store"]
    code = _seed_code(store)
    client.post("/onboarding/signup", json={
        "email": "p1@x.com", "password": "pass1234", "name": "P1",
        "org_name": "X", "codigo_acceso": code})
    r = client.post("/onboarding/signup", json={
        "email": "p2@x.com", "password": "pass1234", "name": "P2",
        "org_name": "Y", "codigo_acceso": code})
    assert r.status_code == 409


def test_codigo_invalido_rechaza(ctx):
    r = ctx["client"].post("/onboarding/signup", json={
        "email": "p@x.com", "password": "pass1234", "name": "P",
        "org_name": "X", "codigo_acceso": "DOCYAN-NOEXISTE"})
    assert r.status_code == 404


def test_codigo_expirado_rechaza(ctx):
    client, store = ctx["client"], ctx["store"]
    code = _seed_code(store, code="DOCYAN-EXP001", expires="2020-01-01T00:00:00+00:00")
    r = client.post("/onboarding/signup", json={
        "email": "p@x.com", "password": "pass1234", "name": "P",
        "org_name": "X", "codigo_acceso": code})
    assert r.status_code == 409


def test_redeem_endpoint_legacy_crea_fila_orgs(ctx):
    # El endpoint /access-codes/{code}/redeem (F2) ahora también formaliza `orgs`.
    client, store = ctx["client"], ctx["store"]
    code = _seed_code(store, code="DOCYAN-REDEEM01")
    r = client.post(f"/access-codes/{code}/redeem", json={
        "email": "redeem@x.com", "password": "pass1234", "name": "R", "org_name": "R SA"})
    assert r.status_code == 200, r.text
    org_id = r.json()["org_id"]
    assert store.get_org(org_id) is not None
    assert store.get_org(org_id)["plan"] == "piloto"


# ════════════════════════════════════════════════════════════════════════════
# Onboarding dos fases
# ════════════════════════════════════════════════════════════════════════════

def test_fase2_activa_plan_y_criticidad(ctx):
    client, store = ctx["client"], ctx["store"]
    r = client.post("/onboarding/signup", json={
        "email": "fase2@lab.com", "password": "pass1234", "name": "F2", "org_name": "Lab"})
    org_id = r.json()["org_id"]
    assert store.get_org(org_id)["fase2_completada"] is False

    r2 = client.post("/onboarding/plan", headers=_tenant_jwt(org_id, "admin"), json={
        "plan": "esencial", "criticidad_segmento": "alta", "doc_limit": None})
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body["plan"] == "esencial"
    assert body["criticidad_segmento"] == "alta"
    assert body["fase2_completada"] is True
    assert body["doc_limit"] is None  # plan pagado: ilimitado
    # La ventana freemium deja de aplicar al pasar a plan pagado.
    assert store.get_org(org_id)["freemium_expira"] is None


def test_fase2_requiere_admin(ctx):
    client = ctx["client"]
    org_id = client.post("/onboarding/signup", json={
        "email": "v@lab.com", "password": "pass1234", "name": "V", "org_name": "L"}).json()["org_id"]
    r = client.post("/onboarding/plan", headers=_tenant_jwt(org_id, "viewer"), json={
        "plan": "esencial", "criticidad_segmento": "media"})
    assert r.status_code == 403


# ════════════════════════════════════════════════════════════════════════════
# Invitaciones + aislamiento del invitado
# ════════════════════════════════════════════════════════════════════════════

def _signup(client, email, org="Org"):
    return client.post("/onboarding/signup", json={
        "email": email, "password": "pass1234", "name": "Admin", "org_name": org}).json()


def test_invitacion_generar_aceptar_rol_correcto(ctx):
    client, store, email = ctx["client"], ctx["store"], ctx["email"]
    admin = _signup(client, "admin@org.com", "Org A")
    org_id = admin["org_id"]

    # Admin invita a un colaborador (editor).
    r = client.post("/invitations", headers=_tenant_jwt(org_id, "admin"), json={
        "email": "colab@org.com", "role": "editor"})
    assert r.status_code == 200, r.text
    inv = r.json()
    assert inv["status"] == "pending" and inv["role"] == "editor"
    assert inv["invite_url"] and "token=" in inv["invite_url"]
    # Se intentó enviar el correo (capturado por el sender en memoria).
    assert len(email.sent) == 1 and email.sent[0].to == "colab@org.com"

    token = inv["invite_url"].split("token=")[1]
    # El invitado acepta: establece contraseña → entra como editor de ESA org.
    acc = client.post("/invitations/accept", json={
        "token": token, "password": "newpass123", "name": "Colaborador"})
    assert acc.status_code == 200, acc.text
    body = acc.json()
    assert body["org_id"] == org_id          # MISMA org (aislamiento)
    assert body["role"] == "editor"          # rol/permiso correcto
    assert body["tokens"]["access_token"]

    # La invitación queda aceptada y el usuario existe en la org.
    assert store.list_invitations(org_id, "accepted")
    assert store.get_user_by_email("colab@org.com")["org_id"] == org_id


def test_invitacion_token_invalido(ctx):
    r = ctx["client"].post("/invitations/accept", json={
        "token": "no-existe", "password": "newpass123", "name": "X"})
    assert r.status_code == 404


def test_invitacion_no_se_reusa(ctx):
    client = ctx["client"]
    admin = _signup(client, "admin2@org.com", "Org B")
    org_id = admin["org_id"]
    inv = client.post("/invitations", headers=_tenant_jwt(org_id, "admin"), json={
        "email": "uno@org.com", "role": "viewer"}).json()
    token = inv["invite_url"].split("token=")[1]
    assert client.post("/invitations/accept", json={
        "token": token, "password": "newpass123", "name": "Uno"}).status_code == 200
    # Segundo intento con el mismo token → 409.
    assert client.post("/invitations/accept", json={
        "token": token, "password": "newpass123", "name": "Otro"}).status_code == 409


def test_invitacion_expirada_rechaza(ctx, monkeypatch):
    client, store = ctx["client"], ctx["store"]
    admin = _signup(client, "admin3@org.com", "Org C")
    org_id = admin["org_id"]
    inv = client.post("/invitations", headers=_tenant_jwt(org_id, "admin"), json={
        "email": "tarde@org.com", "role": "viewer"}).json()
    # Forzar vencimiento en el pasado.
    store.update_invitation(inv["id"], expires_at="2020-01-01T00:00:00+00:00")
    token = inv["invite_url"].split("token=")[1]
    r = client.post("/invitations/accept", json={
        "token": token, "password": "newpass123", "name": "Tarde"})
    assert r.status_code == 409


def test_invitar_viewer_sin_acceso(ctx):
    # Consulta (viewer) no tiene acceso al endpoint de invitaciones.
    client = ctx["client"]
    org_id = _signup(client, "admin4@org.com", "Org D")["org_id"]
    r = client.post("/invitations", headers=_tenant_jwt(org_id, "viewer"), json={
        "email": "x@org.com", "role": "viewer"})
    assert r.status_code == 403


def test_admin_invita_cualquier_rol(ctx):
    client = ctx["client"]
    org_id = _signup(client, "adminroles@org.com", "Org R")["org_id"]
    for i, role in enumerate(("admin", "editor", "viewer")):
        r = client.post("/invitations", headers=_tenant_jwt(org_id, "admin"), json={
            "email": f"dest{i}@org.com", "role": role})
        assert r.status_code == 200, r.text
        assert r.json()["role"] == role


def test_editor_solo_invita_consulta(ctx):
    client = ctx["client"]
    org_id = _signup(client, "admined@org.com", "Org Ed")["org_id"]
    # Editor invita viewer (Consulta) → OK.
    ok = client.post("/invitations", headers=_tenant_jwt(org_id, "editor"), json={
        "email": "consulta@org.com", "role": "viewer"})
    assert ok.status_code == 200, ok.text
    assert ok.json()["role"] == "viewer"
    # Editor invita editor o admin → 403 (regla de rol-destino, aplicada en backend).
    assert client.post("/invitations", headers=_tenant_jwt(org_id, "editor"), json={
        "email": "otro-editor@org.com", "role": "editor"}).status_code == 403
    assert client.post("/invitations", headers=_tenant_jwt(org_id, "editor"), json={
        "email": "otro-admin@org.com", "role": "admin"}).status_code == 403


def test_editor_no_evade_regla_por_el_service(ctx):
    # Defensa en profundidad: el service rechaza aunque se llame fuera del endpoint.
    from app.onboarding import service
    from app.onboarding.service import OnboardingError
    org_id = _signup(ctx["client"], "svc@org.com", "Org Svc")["org_id"]
    with pytest.raises(OnboardingError) as exc:
        service.crear_invitacion(
            ctx["store"], ctx["audit"], ctx["email"],
            org_id=org_id, invited_by="editor@org.com", invited_by_role="editor",
            email="nuevo@org.com", role="editor")
    assert exc.value.status_code == 403


def test_invitar_email_existente_rechaza(ctx):
    client = ctx["client"]
    org_id = _signup(client, "admin5@org.com", "Org E")["org_id"]
    # admin5 ya existe como usuario → no se puede invitar ese email.
    r = client.post("/invitations", headers=_tenant_jwt(org_id, "admin"), json={
        "email": "admin5@org.com", "role": "editor"})
    assert r.status_code == 409


# ════════════════════════════════════════════════════════════════════════════
# Gestión de documentos (eliminar / cupo / aislamiento)
# ════════════════════════════════════════════════════════════════════════════

def test_listar_documentos_muestra_cupo(ctx):
    client, dkg = ctx["client"], ctx["dkg"]
    org_id = _signup(client, "docs@lab.com", "Docs Lab")["org_id"]
    dkg.add_doc(org_id, "doc-aaa", nombre_archivo="MSDS-1.pdf", tipo_documento="MSDS", contenido=5)
    dkg.add_doc(org_id, "doc-bbb", nombre_archivo="MSDS-2.pdf", tipo_documento="MSDS", contenido=3)

    r = client.get("/mis-documentos", headers=_tenant_jwt(org_id, "admin"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] == 2
    assert body["doc_limit"] == 3 and body["usados"] == 2 and body["disponibles"] == 1


def test_eliminar_documento_libera_cupo_y_audita(ctx):
    client, dkg, audit = ctx["client"], ctx["dkg"], ctx["audit"]
    org_id = _signup(client, "del@lab.com", "Del Lab")["org_id"]
    dkg.add_doc(org_id, "doc-x", nombre_archivo="x.pdf", contenido=4)
    dkg.add_doc(org_id, "doc-y", nombre_archivo="y.pdf", contenido=2)

    r = client.delete("/mis-documentos/doc-x", headers=_tenant_jwt(org_id, "admin"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "deleted" and body["contenido_eliminado"] == 4
    assert body["usados"] == 1 and body["disponibles"] == 2  # cupo liberado
    # Se fue del grafo (sin residuo).
    assert "doc-x" not in dkg.graphs[org_id]
    # FAT conserva el evento de borrado.
    assert any(e["action"] == "document_deleted" for e in audit.entries)


def test_eliminar_inexistente_404(ctx):
    client = ctx["client"]
    org_id = _signup(client, "noexist@lab.com", "NX")["org_id"]
    r = client.delete("/mis-documentos/no-existe", headers=_tenant_jwt(org_id, "admin"))
    assert r.status_code == 404


def test_reemplazar_libera_y_permite_cargar(ctx):
    # "Reemplazar" = eliminar (libera cupo) y volver a estar dentro del límite.
    client, store, dkg = ctx["client"], ctx["store"], ctx["dkg"]
    org_id = _signup(client, "rep@lab.com", "Rep Lab")["org_id"]
    dkg.add_doc(org_id, "d1")
    dkg.add_doc(org_id, "d2")
    dkg.add_doc(org_id, "d3")

    from app.onboarding.limites import LimiteDocumentosError, verificar_limite_documentos
    # En el límite (3/3): una nueva ingesta se rechaza.
    with pytest.raises(LimiteDocumentosError):
        verificar_limite_documentos(store, dkg, org_id)
    # Eliminar uno libera cupo.
    client.delete("/mis-documentos/d1", headers=_tenant_jwt(org_id, "admin"))
    # Ahora sí cabe otro (no lanza).
    verificar_limite_documentos(store, dkg, org_id)


def test_aislamiento_entre_orgs_en_documentos(ctx):
    client, dkg = ctx["client"], ctx["dkg"]
    org_a = _signup(client, "a@iso.com", "Org A")["org_id"]
    org_b = _signup(client, "b@iso.com", "Org B")["org_id"]
    dkg.add_doc(org_a, "doc-a1", nombre_archivo="solo-A.pdf", contenido=1)

    # Org B NO ve los documentos de Org A.
    rb = client.get("/mis-documentos", headers=_tenant_jwt(org_b, "admin")).json()
    assert rb["total"] == 0
    assert "solo-A.pdf" not in client.get(
        "/mis-documentos", headers=_tenant_jwt(org_b, "admin")).text
    # Org B no puede borrar un doc de Org A (no existe en su grafo) → 404.
    assert client.delete("/mis-documentos/doc-a1",
                         headers=_tenant_jwt(org_b, "admin")).status_code == 404
    # Org A sí lo ve.
    ra = client.get("/mis-documentos", headers=_tenant_jwt(org_a, "admin")).json()
    assert ra["total"] == 1


def test_limite_sin_org_formalizada_no_bloquea(ctx):
    # Org sin fila `orgs` (cuenta previa a B13) → sin límite (no-op), no rompe.
    from app.onboarding.limites import verificar_limite_documentos
    verificar_limite_documentos(ctx["store"], ctx["dkg"], "org-legacy-sin-formalizar")
