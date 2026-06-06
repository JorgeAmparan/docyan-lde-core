"""
Router del Super-Admin de Plataforma (F2 backend).

Prefijo `/platform/*`. Salvo el login, TODO endpoint exige scope `platform_admin`
(`requiere_platform_admin`) y registra las acciones mutantes en el FAT. Modelo de
seguridad cerrado: metadata SÍ / contenido NO — ningún endpoint devuelve texto de
documentos, texto de consultas ni contenido de grafos.

Los providers (store/audit/metrics/jobs) se resuelven DENTRO del handler vía
`providers.get_*()` (no por Depends), para que los tests los sustituyan con una
sola sobreescritura por backend en memoria — mismo patrón que el router de ingesta.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from app.jobs.progress import pct_total
from app.platform_admin import providers
from app.platform_admin.models import (
    AccessCodeList,
    AccessCodeOut,
    BillingStatus,
    CreateAccessCodeRequest,
    CreatePaymentRequest,
    JobList,
    JobSummary,
    OrgList,
    OrgMetrics,
    PaymentList,
    PaymentOut,
    PlatformLoginRequest,
    PlatformSummary,
    PlatformTokenResponse,
    ReplyThreadRequest,
    SupportMessageOut,
    SupportThreadList,
    SupportThreadOut,
)
from app.platform_admin.security import (
    PLATFORM_TOKEN_EXPIRE_MINUTES,
    actor_de,
    create_platform_token,
    requiere_platform_admin,
    verify_password,
)

router = APIRouter(prefix="/platform", tags=["platform-admin"])

_ACTIVE_JOB = {"queued", "processing"}
_GEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # sin O/0/I/1 (legibilidad)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _gen_code() -> str:
    import secrets

    return "DOCYAN-" + "".join(secrets.choice(_GEN_ALPHABET) for _ in range(8))


# ── Auth de plataforma ────────────────────────────────────────────────────────


@router.post("/auth/login", response_model=PlatformTokenResponse)
async def platform_login(body: PlatformLoginRequest):
    store = providers.get_store()
    audit = providers.get_audit()
    admin = store.get_admin_by_email(body.email)
    if not admin or not admin.get("is_active", True) or not verify_password(
        body.password, admin["password_hash"]
    ):
        raise HTTPException(status_code=401, detail="Credenciales de plataforma inválidas.")
    token = create_platform_token(admin)
    audit.record("platform_login", admin["email"], {"admin_id": admin["id"]})
    return PlatformTokenResponse(
        access_token=token,
        expires_in=PLATFORM_TOKEN_EXPIRE_MINUTES * 60,
        admin={"id": admin["id"], "email": admin["email"], "name": admin.get("name")},
    )


# ── (A) Métricas / observabilidad ─────────────────────────────────────────────


@router.get("/orgs", response_model=OrgList)
async def list_orgs(ctx: dict = Depends(requiere_platform_admin)) -> OrgList:
    return providers.get_metrics().list_orgs()


@router.get("/orgs/{org_id}/metrics", response_model=OrgMetrics)
async def org_metrics(org_id: str, ctx: dict = Depends(requiere_platform_admin)) -> OrgMetrics:
    return providers.get_metrics().org_metrics(org_id)


@router.get("/jobs", response_model=JobList)
async def list_jobs(ctx: dict = Depends(requiere_platform_admin)) -> JobList:
    jobs_backend = providers.get_jobs_backend()
    items = []
    for job in jobs_backend.list_all_jobs():
        status = job.status.value
        pct = 100.0 if status == "completed" else (
            pct_total(job.phase, job.phase_fraction) if status == "processing" else 0.0
        )
        items.append(JobSummary(
            job_id=job.job_id,
            org_id=job.tenant_id,
            status=status,
            phase=job.phase,
            pct=pct,
            nombre_archivo=job.nombre_archivo,
            tiempo_estimado_seg=(job.cotizacion.tiempo_estimado_seg if job.cotizacion else None),
        ))
    return JobList(items=items, total=len(items))


@router.get("/metrics/summary", response_model=PlatformSummary)
async def metrics_summary(
    ctx: dict = Depends(requiere_platform_admin),
    moneda: str = Query("MXN"),
) -> PlatformSummary:
    store = providers.get_store()
    jobs_backend = providers.get_jobs_backend()
    jobs_activos = sum(1 for j in jobs_backend.list_all_jobs() if j.status.value in _ACTIVE_JOB)
    ingresos = sum(
        float(p["monto"]) for p in store.list_payments() if p.get("moneda") == moneda
    )
    return providers.get_metrics().summary(
        jobs_activos=jobs_activos, ingresos_periodo=ingresos, moneda=moneda
    )


# ── (B) Códigos de acceso ─────────────────────────────────────────────────────


def _access_code_out(row: dict) -> AccessCodeOut:
    return AccessCodeOut(
        id=str(row["id"]), code=row["code"], tipo=row["tipo"],
        cuota_documentos=row["cuota_documentos"], cuota_saldo_usd=float(row["cuota_saldo_usd"]),
        expires_at=row.get("expires_at"), status=row["status"],
        org_generada=row.get("org_generada"), created_at=row.get("created_at"),
        redeemed_at=row.get("redeemed_at"),
    )


@router.post("/access-codes", response_model=AccessCodeOut)
async def create_access_code(
    body: CreateAccessCodeRequest,
    ctx: dict = Depends(requiere_platform_admin),
) -> AccessCodeOut:
    if body.tipo not in ("prueba", "piloto"):
        raise HTTPException(status_code=400, detail="tipo debe ser 'prueba' o 'piloto'.")
    store = providers.get_store()
    expires = (_now() + timedelta(days=body.dias_vigencia)).isoformat()
    row = store.create_access_code({
        "code": _gen_code(), "tipo": body.tipo,
        "cuota_documentos": body.cuota_documentos, "cuota_saldo_usd": body.cuota_saldo_usd,
        "expires_at": expires, "status": "active", "created_by": actor_de(ctx),
    })
    providers.get_audit().record("access_code_created", actor_de(ctx), {
        "code": row["code"], "tipo": body.tipo, "cuota_documentos": body.cuota_documentos,
        "cuota_saldo_usd": body.cuota_saldo_usd,
    })
    return _access_code_out(row)


@router.get("/access-codes", response_model=AccessCodeList)
async def list_access_codes(ctx: dict = Depends(requiere_platform_admin)) -> AccessCodeList:
    rows = providers.get_store().list_access_codes()
    return AccessCodeList(items=[_access_code_out(r) for r in rows], total=len(rows))


@router.post("/access-codes/{code}/revoke", response_model=AccessCodeOut)
async def revoke_access_code(
    code: str,
    ctx: dict = Depends(requiere_platform_admin),
) -> AccessCodeOut:
    store = providers.get_store()
    row = store.get_access_code(code)
    if row is None:
        raise HTTPException(status_code=404, detail="Código no encontrado.")
    if row["status"] != "active":
        raise HTTPException(status_code=409, detail=f"Código en estado '{row['status']}', no revocable.")
    updated = store.update_access_code(code, status="revoked")
    providers.get_audit().record("access_code_revoked", actor_de(ctx), {"code": code})
    return _access_code_out(updated)


# ── (C) Pagos manuales ────────────────────────────────────────────────────────


def _payment_out(row: dict) -> PaymentOut:
    return PaymentOut(
        id=str(row["id"]), org_id=row["org_id"], monto=float(row["monto"]),
        moneda=row["moneda"], concepto=row["concepto"], fecha=row.get("fecha"),
        nota=row.get("nota"), registrado_por=row.get("registrado_por"),
    )


@router.post("/payments", response_model=PaymentOut)
async def create_payment(
    body: CreatePaymentRequest,
    ctx: dict = Depends(requiere_platform_admin),
) -> PaymentOut:
    if body.moneda not in ("MXN", "USD"):
        raise HTTPException(status_code=400, detail="moneda debe ser MXN o USD.")
    if body.concepto not in ("suscripcion", "setup", "recarga"):
        raise HTTPException(status_code=400, detail="concepto inválido.")
    store = providers.get_store()
    row = store.create_payment({
        "org_id": body.org_id, "monto": body.monto, "moneda": body.moneda,
        "concepto": body.concepto, "nota": body.nota, "registrado_por": actor_de(ctx),
        "fecha": _now().isoformat(),
    })
    providers.get_audit().record("manual_payment_recorded", actor_de(ctx), {
        "org_id": body.org_id, "monto": body.monto, "moneda": body.moneda,
        "concepto": body.concepto,
    }, org_id=body.org_id)
    return _payment_out(row)


@router.get("/payments", response_model=PaymentList)
async def list_payments(
    ctx: dict = Depends(requiere_platform_admin),
    org_id: str | None = Query(None),
    desde: str | None = Query(None),
) -> PaymentList:
    rows = providers.get_store().list_payments(org_id=org_id, desde=desde)
    return PaymentList(items=[_payment_out(r) for r in rows], total=len(rows))


@router.get("/orgs/{org_id}/billing-status", response_model=BillingStatus)
async def billing_status(
    org_id: str,
    ctx: dict = Depends(requiere_platform_admin),
    moneda: str = Query("MXN"),
) -> BillingStatus:
    store = providers.get_store()
    billing = store.get_org_billing(org_id) or {}
    pagos = [p for p in store.list_payments(org_id=org_id) if p.get("moneda") == moneda]
    return BillingStatus(
        org_id=org_id,
        plan=billing.get("plan", "piloto"),
        lifecycle_status=billing.get("lifecycle_status", "active"),
        next_billing_date=billing.get("next_billing_date"),
        pagos_registrados=len(pagos),
        total_pagado=round(sum(float(p["monto"]) for p in pagos), 2),
        moneda=moneda,
    )


# ── (D) Soporte — bandeja del fundador ────────────────────────────────────────


def _thread_out(thread: dict, mensajes: list[dict]) -> SupportThreadOut:
    return SupportThreadOut(
        id=str(thread["id"]), org_id=thread["org_id"], user_id=thread.get("user_id"),
        pantalla_origen=thread.get("pantalla_origen"), estado=thread["estado"],
        auto_respondible=bool(thread.get("auto_respondible", False)),
        created_at=thread.get("created_at"), updated_at=thread.get("updated_at"),
        mensajes=[
            SupportMessageOut(
                id=str(m["id"]), thread_id=str(m["thread_id"]), autor_tipo=m["autor_tipo"],
                autor_id=m.get("autor_id"), cuerpo=m["cuerpo"], created_at=m.get("created_at"),
            )
            for m in mensajes
        ],
    )


@router.get("/support/threads", response_model=SupportThreadList)
async def support_inbox(ctx: dict = Depends(requiere_platform_admin)) -> SupportThreadList:
    store = providers.get_store()
    threads = store.list_threads()
    items = [_thread_out(t, store.list_messages(t["id"])) for t in threads]
    return SupportThreadList(items=items, total=len(items))


@router.post("/support/threads/{thread_id}/reply", response_model=SupportThreadOut)
async def support_reply(
    thread_id: str,
    body: ReplyThreadRequest,
    ctx: dict = Depends(requiere_platform_admin),
) -> SupportThreadOut:
    store = providers.get_store()
    thread = store.get_thread(thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="Hilo no encontrado.")
    store.add_message({
        "thread_id": thread_id, "autor_tipo": "founder",
        "autor_id": actor_de(ctx), "cuerpo": body.cuerpo,
    })
    nuevo_estado = "cerrado" if body.cerrar else "respondido"
    thread = store.update_thread(thread_id, estado=nuevo_estado)
    providers.get_audit().record("support_reply", actor_de(ctx), {
        "thread_id": thread_id, "estado": nuevo_estado,
    }, org_id=thread.get("org_id"))
    return _thread_out(thread, store.list_messages(thread_id))
