"""
Lógica del onboarding + ciclo de uso (B13).

Framework-agnóstica y testable: las funciones reciben sus dependencias (store,
audit, email_sender, token_issuer) y lanzan `OnboardingError(status_code, detail)`
que el router traduce a HTTPException. Reusa el store de plataforma para la
persistencia (orgs/users/budget/billing/access_codes/invitations).
"""
from __future__ import annotations

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from app.platform_admin.security import hash_password

# ── Parámetros del modelo comercial (B13; ajustables por entorno) ─────────────

FREEMIUM_DOC_LIMIT = int(os.getenv("FREEMIUM_DOC_LIMIT", "3"))
FREEMIUM_VENTANA_DIAS = int(os.getenv("FREEMIUM_VENTANA_DIAS", "30"))
# Saldo de cortesía freemium (USD): permite que la cuenta ingiera sus pocos docs
# para vivir el producto (extracción ~$0.04/doc, PoC). PENDIENTE DE JORGE: monto.
FREEMIUM_SALDO_USD = float(os.getenv("FREEMIUM_SALDO_USD", "2.0"))
PILOTO_VENTANA_DIAS = int(os.getenv("PILOTO_VENTANA_DIAS", "60"))
INVITATION_EXPIRE_HOURS = int(os.getenv("INVITATION_EXPIRE_HOURS", "168"))  # 7 días
APP_BASE_URL = os.getenv("APP_BASE_URL", "https://docyan-lde.vercel.app")


class OnboardingError(RuntimeError):
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def org_id_for(email: str) -> str:
    """Derivación canónica del org_id (igual que auth.register / redeem)."""
    return hashlib.sha256(email.encode()).hexdigest()[:16]


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# ════════════════════════════════════════════════════════════════════════════
# Canje de código de piloto (compartido con platform_tenant.redeem)
# ════════════════════════════════════════════════════════════════════════════


def _sembrar_reglas_alerta(dkg: Any, org_id: str) -> None:
    """
    Siembra la `ReglaAlerta` default del tenant al onboarding (ED-1 §2.3). Fail-open:
    un fallo del grafo NO bloquea el alta de cuenta (la regla se re-siembra en el
    backfill). Idempotente (no toca si ya hay reglas).
    """
    if dkg is None:
        return
    try:
        from app.alerts.reglas import sembrar_reglas_default

        sembrar_reglas_default(dkg, org_id)
    except Exception:  # noqa: BLE001 — fail-open
        pass


def _sembrar_tipos_solicitud(org_id: str) -> None:
    """
    Siembra los 5 tipos base de solicitud al onboarding (ED-2 §2.1). Fail-open e
    idempotente (por (org, clave)); también sirve al backfill de tenants existentes
    (el listado del catálogo re-asegura la semilla). No bloquea el alta de cuenta.
    """
    try:
        from app.solicitudes.tipos import SupabaseTipoSolicitudStore, asegurar_semilla

        asegurar_semilla(SupabaseTipoSolicitudStore(), org_id)
    except Exception:  # noqa: BLE001 — fail-open
        pass


def canjear_codigo(
    store: Any,
    audit: Any,
    *,
    code: str,
    email: str,
    password: str,
    name: str,
    org_name: str | None,
    quota: Any = None,
    dkg: Any = None,
) -> dict:
    """
    Valida y canjea un código de acceso: provisiona una org NUEVA con plan piloto,
    su budget, su registro de billing y su fila `orgs` formalizada (B13). Alta
    controlada, NO acceso cross-tenant. Marca el código usado.
    """
    row = store.get_access_code(code)
    if row is None:
        raise OnboardingError(404, "Código no encontrado.")
    if row["status"] == "used":
        raise OnboardingError(409, "Código ya canjeado.")
    if row["status"] in ("revoked", "expired"):
        raise OnboardingError(409, f"Código {row['status']}, no canjeable.")
    expires = row.get("expires_at")
    if expires and str(expires) < _now().isoformat():
        store.update_access_code(code, status="expired")
        raise OnboardingError(409, "Código expirado.")
    if store.email_exists(email):
        raise OnboardingError(409, "Email ya registrado.")

    org_id = org_id_for(email)
    if store.org_has_users(org_id):
        raise OnboardingError(409, "La organización ya existe.")

    user = store.create_user(
        org_id=org_id, email=email, password_hash=hash_password(password),
        name=name, role="admin",
    )
    # v2.1: sin saldo prepagado — el plan opera por cupo de documentos.
    store.upsert_org_billing(
        org_id, display_name=org_name, plan=row["tipo"], lifecycle_status="active",
    )
    # Límite de docs del piloto = su cuota_documentos (0 → ilimitado para no bloquear).
    cuota_docs = int(row.get("cuota_documentos") or 0)
    doc_limit = cuota_docs if cuota_docs > 0 else None
    inicio = _now()
    store.create_org(
        org_id,
        nombre=org_name,
        plan=row["tipo"],
        lifecycle_status="active",
        doc_limit=doc_limit,
        # Piloto: plan YA activo por el código → fase 2 completa, ventana 60 días.
        fase2_completada=True,
        freemium_inicio=inicio.isoformat(),
        freemium_expira=(inicio + timedelta(days=PILOTO_VENTANA_DIAS)).isoformat(),
    )
    store.update_access_code(
        code, status="used", org_generada=org_id, redeemed_at=_now().isoformat(),
    )
    # F3 §C: siembra el cupo de ingestas del plan del piloto (Esencial → 10+3/mes).
    # Fail-open: un fallo de infraestructura al sembrar el cupo NO debe bloquear el
    # canje del código (el cupo se puede re-sembrar; el alta de cuenta es lo crítico).
    if quota is not None:
        try:
            quota.ensure_quota(org_id, row["tipo"])
        except Exception:  # noqa: BLE001 — fail-open
            pass
    _sembrar_reglas_alerta(dkg, org_id)
    _sembrar_tipos_solicitud(org_id)
    audit.record("access_code_redeemed", email, {
        "code": code, "org_id": org_id, "plan": row["tipo"],
    }, org_id=org_id)

    return {
        "org_id": org_id,
        "user": user,
        "plan": row["tipo"],
        "cuota_documentos": cuota_docs,
        "cuota_saldo_usd": float(row["cuota_saldo_usd"]),
        "expires_at": row.get("expires_at"),
        "doc_limit": doc_limit,
        "fase2_completada": True,
    }


# ════════════════════════════════════════════════════════════════════════════
# Fase 1 — Registro (Freemium o Piloto)
# ════════════════════════════════════════════════════════════════════════════


def signup(store: Any, audit: Any, token_issuer: Any, req: Any, quota: Any = None, dkg: Any = None) -> dict:
    """
    Crea la cuenta (Fase 1). Sin `codigo_acceso` → Freemium (admin de org nueva,
    3 docs / 30 días). Con `codigo_acceso` → canje de piloto. En ambos casos el
    usuario queda logueado (tokens emitidos) para vivir el producto de inmediato.
    """
    if req.codigo_acceso:
        prov = canjear_codigo(
            store, audit, code=req.codigo_acceso, email=str(req.email),
            password=req.password, name=req.name, org_name=req.org_name, quota=quota,
            dkg=dkg,
        )
        user = prov["user"]
        org = store.get_org(prov["org_id"]) or {}
        tokens = token_issuer.emit(user)
        return {
            "org_id": prov["org_id"], "user_id": str(user["id"]), "email": user["email"],
            "role": user["role"], "plan": prov["plan"], "doc_limit": prov["doc_limit"],
            "freemium_expira": org.get("freemium_expira"),
            "fase2_completada": True, "tokens": tokens,
        }

    # ── Freemium ──
    if store.email_exists(str(req.email)):
        raise OnboardingError(409, "Email ya registrado.")
    org_id = org_id_for(str(req.email))
    if store.org_has_users(org_id):
        raise OnboardingError(409, "La organización ya existe.")

    user = store.create_user(
        org_id=org_id, email=str(req.email), password_hash=hash_password(req.password),
        name=req.name, role="admin",
    )
    # v2.1: sin saldo prepagado — freemium opera por límite de documentos.
    store.upsert_org_billing(
        org_id, display_name=req.org_name, plan="freemium", lifecycle_status="active",
    )
    inicio = _now()
    expira = inicio + timedelta(days=FREEMIUM_VENTANA_DIAS)
    org = store.create_org(
        org_id,
        nombre=req.org_name,
        banda_mercado=req.banda_mercado or "A",
        idioma=req.idioma or "es",
        plan="freemium",
        lifecycle_status="active",
        doc_limit=FREEMIUM_DOC_LIMIT,
        fase2_completada=False,
        freemium_inicio=inicio.isoformat(),
        freemium_expira=expira.isoformat(),
    )
    _sembrar_reglas_alerta(dkg, org_id)
    _sembrar_tipos_solicitud(org_id)
    audit.record("signup_freemium", str(req.email), {
        "org_id": org_id, "plan": "freemium", "doc_limit": FREEMIUM_DOC_LIMIT,
    }, org_id=org_id)

    tokens = token_issuer.emit(user)
    return {
        "org_id": org_id, "user_id": str(user["id"]), "email": user["email"],
        "role": user["role"], "plan": "freemium", "doc_limit": FREEMIUM_DOC_LIMIT,
        "freemium_expira": org.get("freemium_expira"),
        "fase2_completada": False, "tokens": tokens,
    }


# ════════════════════════════════════════════════════════════════════════════
# Fase 2 — Activación de plan + criticidad (decisión #15)
# ════════════════════════════════════════════════════════════════════════════


def activar_plan(
    store: Any, audit: Any, *, org_id: str, actor: str, req: Any, quota: Any = None
) -> dict:
    """
    Fase 2: el cliente elige/activa plan. Fija plan, criticidad del segmento
    (decisión #15) y, en planes pagados, retira el límite freemium (doc_limit del
    plan o ilimitado). Marca `fase2_completada=True`. F3 §C: siembra el cupo de
    ingestas del plan (Esencial 10+3/mes · Profesional 30+10/mes · Enterprise config).
    """
    org = store.get_org(org_id)
    if org is None:
        raise OnboardingError(404, "Organización no encontrada.")

    fields: dict[str, Any] = {
        "plan": req.plan,
        "criticidad_segmento": req.criticidad_segmento,
        "doc_limit": req.doc_limit,  # None = ilimitado (plan pagado)
        "fase2_completada": True,
    }
    if req.banda_mercado is not None:
        fields["banda_mercado"] = req.banda_mercado
    if req.idioma is not None:
        fields["idioma"] = req.idioma
    # Al pasar a un plan pagado, la ventana freemium deja de aplicar.
    if req.plan != "freemium":
        fields["freemium_expira"] = None

    org = store.update_org(org_id, **fields)
    store.upsert_org_billing(org_id, plan=req.plan, lifecycle_status="active")
    # F3 §C: al activar un plan con cupo, siémbralo (idempotente: no reinicia el
    # cupo ya gastado si la fase 2 se re-ejecuta). Freemium no lleva cupo → no-op.
    # Fail-open: un fallo al sembrar el cupo no debe bloquear la activación de plan.
    if quota is not None:
        try:
            quota.ensure_quota(org_id, req.plan)
        except Exception:  # noqa: BLE001 — fail-open
            pass
    audit.record("onboarding_fase2", actor, {
        "org_id": org_id, "plan": req.plan, "criticidad": req.criticidad_segmento,
    }, org_id=org_id)
    return org


# ════════════════════════════════════════════════════════════════════════════
# Invitaciones
# ════════════════════════════════════════════════════════════════════════════


def crear_invitacion(
    store: Any, audit: Any, email_sender: Any, *,
    org_id: str, invited_by: str, invited_by_role: str, email: str, role: str,
) -> dict:
    """
    Genera una invitación (token + vencimiento) y envía el correo. Si el envío
    falla (SMTP no configurado / error), NO rompe: la invitación queda creada y el
    `invite_url` se devuelve para reenvío manual (con `email_enviado=False`).

    Regla de rol-destino (modelo Admin/Editor/Consulta): un `editor` solo puede
    invitar `viewer` (Consulta); un `admin` puede invitar cualquier rol. Se aplica
    aquí (service) además del gate del endpoint — el backend rechaza aunque el
    frontend oculte opciones.
    """
    if invited_by_role == "editor" and role != "viewer":
        raise OnboardingError(
            403, "Un editor solo puede invitar usuarios de Consulta (viewer)."
        )

    if store.email_exists(email):
        raise OnboardingError(409, "Ese email ya tiene una cuenta.")

    raw_token = secrets.token_urlsafe(48)
    expires_at = _now() + timedelta(hours=INVITATION_EXPIRE_HOURS)
    inv = store.create_invitation({
        "org_id": org_id,
        "email": email,
        "role": role,
        "token_hash": _hash_token(raw_token),
        "status": "pending",
        "expires_at": expires_at.isoformat(),
        "invited_by": invited_by,
    })
    invite_url = f"{APP_BASE_URL}/invitacion?token={raw_token}"

    # Sin proveedor de correo (email_sender None: SMTP no configurado) → no se
    # envía, pero la invitación queda creada y el invite_url vuelve en la respuesta
    # para reenvío/prueba manual. Con proveedor, se intenta enviar de verdad.
    email_enviado = False
    if email_sender is not None:
        try:
            from app.notifications.email import EmailMessage

            org = store.get_org(org_id) or {}
            nombre_org = org.get("nombre") or "tu organización"
            email_sender.send(EmailMessage(
                to=email,
                subject="Te invitaron a DOCYAN LDE™",
                body_text=(
                    f"Te invitaron a unirte a {nombre_org} en DOCYAN LDE™.\n\n"
                    f"Abre este enlace para establecer tu contraseña y entrar:\n{invite_url}\n\n"
                    f"El enlace vence el {expires_at.date().isoformat()}.\n"
                ),
            ))
            email_enviado = True
        except Exception:  # noqa: BLE001 — el envío no es gate de la creación
            email_enviado = False

    audit.record("invitation_created", invited_by, {
        "org_id": org_id, "email": email, "role": role,
        "invitation_id": str(inv["id"]), "email_enviado": email_enviado,
    }, org_id=org_id)

    return {**inv, "invite_url": invite_url, "email_enviado": email_enviado}


def listar_invitaciones(store: Any, org_id: str, status: str | None = None) -> list[dict]:
    return store.list_invitations(org_id, status)


def aceptar_invitacion(store: Any, audit: Any, token_issuer: Any, *, token: str,
                       password: str, name: str | None) -> dict:
    """
    El invitado abre el enlace → establece contraseña → queda como usuario de la org
    con su rol → entra (tokens emitidos).
    """
    inv = store.get_invitation_by_token_hash(_hash_token(token))
    if inv is None:
        raise OnboardingError(404, "Invitación no encontrada.")
    if inv["status"] == "accepted":
        raise OnboardingError(409, "La invitación ya fue aceptada.")
    if inv["status"] in ("revoked", "expired"):
        raise OnboardingError(409, f"Invitación {inv['status']}, no utilizable.")
    if str(inv["expires_at"]) < _now().isoformat():
        store.update_invitation(inv["id"], status="expired")
        raise OnboardingError(409, "La invitación expiró.")
    if store.email_exists(inv["email"]):
        raise OnboardingError(409, "Ese email ya tiene una cuenta.")

    user = store.create_user(
        org_id=inv["org_id"], email=inv["email"],
        password_hash=hash_password(password),
        name=name or inv["email"], role=inv["role"],
    )
    store.update_invitation(
        inv["id"], status="accepted", accepted_user_id=str(user["id"]),
        accepted_at=_now().isoformat(),
    )
    audit.record("invitation_accepted", inv["email"], {
        "org_id": inv["org_id"], "invitation_id": str(inv["id"]), "role": inv["role"],
    }, org_id=inv["org_id"])

    tokens = token_issuer.emit(user)
    return {
        "org_id": inv["org_id"], "user_id": str(user["id"]), "email": user["email"],
        "role": user["role"], "tokens": tokens,
    }
