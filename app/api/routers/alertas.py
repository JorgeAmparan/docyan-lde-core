"""
Router `/alertas` — ReglaAlerta + AccionSobreAlerta + alertas manuales (ED-1 §2.3).

DOCYAN LDE™ by XCID.

Superficie ADMIN de alertas (distinta del pipeline Tipo 7 que sirve la Consulta):
- `GET  /alertas/reglas`            — regla(s) del tenant.
- `PUT  /alertas/reglas`            — upsert de la regla (conecta admin/alertas/page).
- `GET  /alertas`                   — listar por tenant/entidad, filtros estado/urgencia.
- `GET  /alertas/{id}`              — detalle + historial de acciones.
- `POST /alertas/{id}/accion`       — aplicar una AccionSobreAlerta.
- `POST /alertas`                   — crear alerta manual (origen = manual).

El pipeline Tipo 7 y su `AlertsDashboardPayload` siguen intactos (no se rompe la
Consulta). Multi-tenant estricto por `org_id` de la sesión.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from app.alerts import acciones as _acciones
from app.alerts import despacho as _despacho
from app.alerts import lectura as _lectura
from app.alerts import reglas as _reglas
from app.api.auth import requiere_rol, verificar_credenciales
from app.api.blocking import run_blocking
from app.api.routers._eventos_deps import dep_dkg, dep_fat, dep_notificador
from app.eventos_dirigidos import ciclo_vida
from app.schemas.eventos_dirigidos import (
    AccionRequest,
    AccionResultado,
    AlertaAdmin,
    AlertaListado,
    AlertaManualCreate,
    ReglaAlertaOut,
    ReglaAlertaUpdate,
)

logger = logging.getLogger("docyan.api.alertas")

router = APIRouter(prefix="/alertas", tags=["alertas"])


# ── ReglaAlerta ───────────────────────────────────────────────────────────────
@router.get("/reglas", response_model=list[ReglaAlertaOut])
async def listar_reglas(
    ctx: dict = Depends(requiere_rol("admin")),
    dkg=Depends(dep_dkg),
):
    org_id = ctx["org_id"]

    def _work():
        reglas = _reglas.listar_reglas(dkg, org_id)
        if not reglas:
            # Sin reglas persistidas aún → expone el default (no persiste hasta guardar).
            reglas = [_reglas.default_regla(org_id)]
        return [r.to_public() for r in reglas]

    data = await run_blocking(_work, endpoint="/alertas/reglas")
    return [ReglaAlertaOut(**r) for r in data]


@router.put("/reglas", response_model=ReglaAlertaOut)
async def guardar_regla(
    req: ReglaAlertaUpdate,
    ctx: dict = Depends(requiere_rol("admin")),
    dkg=Depends(dep_dkg),
):
    org_id = ctx["org_id"]
    regla = _reglas.ReglaAlerta(
        tenant_id=org_id,
        tipo=req.tipo,
        thresholds=req.thresholds,
        urgencias=req.urgencias or _reglas.DEFAULT_URGENCIAS,
        destinatarios=req.destinatarios,
        canales=list(req.canales),
        escalacion_dias=req.escalacion_dias,
        escalacion_destinatario_id=req.escalacion_destinatario_id,
        activo=req.activo,
    )
    guardada = await run_blocking(_reglas.guardar_regla, dkg, regla, endpoint="/alertas/reglas")
    return ReglaAlertaOut(**guardada.to_public())


# ── Listado / detalle ────────────────────────────────────────────────────────
@router.get("", response_model=AlertaListado)
async def listar_alertas(
    entidad_id: str | None = Query(None),
    estado: str | None = Query(None),
    urgencia: str | None = Query(None),
    ctx: dict = Depends(verificar_credenciales),
    dkg=Depends(dep_dkg),
):
    org_id = ctx["org_id"]
    items = await run_blocking(
        _lectura.listar_alertas, dkg, org_id,
        endpoint="/alertas", entidad_id=entidad_id, estado=estado, urgencia=urgencia,
    )
    return AlertaListado(alertas=[AlertaAdmin(**a) for a in items], total=len(items))


@router.get("/{alerta_id}", response_model=AlertaAdmin)
async def detalle_alerta(
    alerta_id: str,
    ctx: dict = Depends(verificar_credenciales),
    dkg=Depends(dep_dkg),
):
    org_id = ctx["org_id"]
    alerta = await run_blocking(_lectura.obtener_alerta, dkg, org_id, alerta_id, endpoint="/alertas/detalle")
    if alerta is None:
        raise HTTPException(status_code=404, detail="Alerta no encontrada.")
    return AlertaAdmin(**alerta)


# ── Acciones ─────────────────────────────────────────────────────────────────
@router.post("/{alerta_id}/accion", response_model=AccionResultado)
async def aplicar_accion(
    alerta_id: str,
    req: AccionRequest,
    ctx: dict = Depends(verificar_credenciales),
    dkg=Depends(dep_dkg),
    fat=Depends(dep_fat),
):
    org_id = ctx["org_id"]
    actor_id = ctx.get("user_id") or "api"

    def _work():
        return _acciones.aplicar_accion(
            dkg, org_id, alerta_id, req.accion, actor_id=actor_id,
            justificacion=req.justificacion, comentario=req.comentario, fat=fat,
        )

    try:
        res = await run_blocking(_work, endpoint="/alertas/accion")
    except _acciones.AlertaNoEncontrada:
        raise HTTPException(status_code=404, detail="Alerta no encontrada.")
    except (ciclo_vida.JustificacionRequerida,) as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except (ciclo_vida.TransicionInvalida, ciclo_vida.AccionDesconocida) as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return AccionResultado(**res)


# ── Disparo manual del barrido (evidencia §5.3 / operación) ──────────────────
@router.post("/scheduler/evaluate-vencimientos")
async def trigger_evaluate_vencimientos(
    ctx: dict = Depends(requiere_rol("admin")),
    dkg=Depends(dep_dkg),
    notificador=Depends(dep_notificador),
    fat=Depends(dep_fat),
):
    """
    Ejecuta el barrido de vencimientos para el tenant del admin (disparo manual del
    job del scheduler, scope multi-tenant estricto). Correrlo dos veces demuestra la
    idempotencia (segunda corrida: 0 nuevas creadas / 0 renotificaciones).
    """
    org_id = ctx["org_id"]

    def _work():
        from app.alerts.barrido import (
            evaluar_escalaciones_tenant,
            evaluar_vencimientos_tenant,
        )

        venc = evaluar_vencimientos_tenant(dkg, org_id, notificador=notificador, fat=fat)
        esc = evaluar_escalaciones_tenant(dkg, org_id, notificador=notificador, fat=fat)
        return {"tenant": org_id, "vencimientos": venc, "escalaciones": esc}

    return await run_blocking(_work, endpoint="/alertas/scheduler/evaluate-vencimientos", timeout=120)


# ── Alerta manual ────────────────────────────────────────────────────────────
@router.post("", response_model=AlertaAdmin, status_code=201)
async def crear_alerta_manual(
    req: AlertaManualCreate,
    ctx: dict = Depends(requiere_rol("admin", "editor")),
    dkg=Depends(dep_dkg),
    notificador=Depends(dep_notificador),
    fat=Depends(dep_fat),
):
    org_id = ctx["org_id"]
    actor_id = ctx.get("user_id") or "api"

    def _work():
        regla = _reglas.regla_aplicable(dkg, org_id, "*")
        if req.destinatarios is not None:
            regla = _reglas.ReglaAlerta(
                tenant_id=org_id, tipo=regla.tipo, thresholds=regla.thresholds,
                urgencias=regla.urgencias, destinatarios=req.destinatarios,
                canales=regla.canales, escalacion_dias=regla.escalacion_dias,
                escalacion_destinatario_id=regla.escalacion_destinatario_id,
            )
        despacho = _despacho.crear_alerta_manual(
            dkg, org_id, descripcion=req.descripcion, fecha_vencimiento=req.fecha_vencimiento,
            entidad_id=req.entidad_id, documento_id=req.documento_id, regla=regla,
            actor_id=actor_id, notificador=notificador, fat=fat,
        )
        return _lectura.obtener_alerta(dkg, org_id, despacho.alerta_id)

    try:
        alerta = await run_blocking(_work, endpoint="/alertas/manual")
    except ValueError as exc:
        # safety_validator rechazó la descripción (no administrativa).
        raise HTTPException(status_code=422, detail=str(exc))
    if alerta is None:
        raise HTTPException(status_code=500, detail="No se pudo crear la alerta.")
    return AlertaAdmin(**alerta)
