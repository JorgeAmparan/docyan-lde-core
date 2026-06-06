"""
Gestor de presupuesto del tenant (B2 §7.1 / §7.2).

DOCYAN LDE™ by XCID.

Opera la tabla `tenant_budget` (migración 008): saldo prepagado finito sin
auto-recharge + hard caps por documento y por sesión. El cotizador lo consulta
como gate previo a cualquier ingesta.

Diseño testeable: el acceso al almacén se abstrae en `BudgetStore`. En
producción usa Supabase (`SupabaseBudgetStore`, service key — bypassa RLS igual
que auth). En tests se inyecta `InMemoryBudgetStore` para verificar la lógica de
caps/saldo sin una base real. NO hay bypass del gate (Adenda §8): incluso en
tests, el cotizador consulta un BudgetManager; lo que se mockea es el ALMACÉN,
nunca la decisión.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass
class TenantBudget:
    """Vista de dominio de una fila de `tenant_budget`.

    El saldo se parte en DISPONIBLE (`saldo_actual_usd`) y RETENIDO
    (`retenido_usd`, F1.5). El esquema reservar/liquidar/liberar mueve montos
    entre ambos sin perder el invariante disponible + retenido = saldo total vivo.
    """

    tenant_id: str
    saldo_actual_usd: float
    hard_cap_por_documento: float = 5.0
    hard_cap_por_sesion: float = 20.0
    moneda: str = "USD"
    # Monto comprometido por ingestas confirmadas y aún no liquidadas (F1.5).
    retenido_usd: float = 0.0


class BudgetStore(Protocol):
    """Contrato de almacenamiento del presupuesto (Supabase o memoria)."""

    def get(self, tenant_id: str) -> TenantBudget | None: ...

    def upsert(self, budget: TenantBudget) -> TenantBudget: ...

    def set_balance(self, tenant_id: str, nuevo_saldo: float) -> TenantBudget: ...

    # ── Operaciones ATÓMICAS de débito (F1.5) ─────────────────────────────────
    # Cada una es indivisible por descuento: en producción (Supabase) es UNA RPC
    # de Postgres (un solo UPDATE bajo lock de fila), sin read-modify-write — el
    # saldo es dinero y no admite condición de carrera. En memoria (tests) se
    # ejecuta la misma aritmética en proceso.
    def reservar(self, tenant_id: str, monto_usd: float) -> ReservaResultado: ...

    def liquidar(
        self, tenant_id: str, reserva_usd: float, costo_real_usd: float
    ) -> TenantBudget: ...

    def liberar(self, tenant_id: str, reserva_usd: float) -> TenantBudget: ...


# ── Almacén en memoria (tests / dev local) ────────────────────────────────────


@dataclass
class InMemoryBudgetStore:
    """Almacén volátil para tests. NO usar en producción."""

    _rows: dict[str, TenantBudget] = field(default_factory=dict)

    def get(self, tenant_id: str) -> TenantBudget | None:
        return self._rows.get(tenant_id)

    def upsert(self, budget: TenantBudget) -> TenantBudget:
        self._rows[budget.tenant_id] = budget
        return budget

    def set_balance(self, tenant_id: str, nuevo_saldo: float) -> TenantBudget:
        b = self._rows[tenant_id]
        b.saldo_actual_usd = nuevo_saldo
        return b

    # ── Operaciones atómicas (in-process; misma aritmética que la RPC) ────────
    def reservar(self, tenant_id: str, monto_usd: float) -> ReservaResultado:
        b = self._rows.get(tenant_id)
        if b is None:
            raise KeyError(f"tenant_budget inexistente para {tenant_id}")
        monto = round(monto_usd, 4)
        if monto > b.saldo_actual_usd:
            return ReservaResultado(
                ok=False, monto_reservado=0.0, saldo_disponible=b.saldo_actual_usd,
                retenido=b.retenido_usd,
                motivo=(
                    f"Saldo disponible insuficiente para reservar ${monto:.4f}: "
                    f"disponible ${b.saldo_actual_usd:.4f}. No se encola."
                ),
                falta_usd=round(monto - b.saldo_actual_usd, 4),
            )
        b.saldo_actual_usd = round(b.saldo_actual_usd - monto, 4)
        b.retenido_usd = round(b.retenido_usd + monto, 4)
        return ReservaResultado(
            ok=True, monto_reservado=monto, saldo_disponible=b.saldo_actual_usd,
            retenido=b.retenido_usd, motivo="Reserva creada (disponible→retenido).",
        )

    def liquidar(
        self, tenant_id: str, reserva_usd: float, costo_real_usd: float
    ) -> TenantBudget:
        b = self._rows.get(tenant_id)
        if b is None:
            raise KeyError(f"tenant_budget inexistente para {tenant_id}")
        b.retenido_usd = round(max(0.0, b.retenido_usd - reserva_usd), 4)
        b.saldo_actual_usd = round(b.saldo_actual_usd + (reserva_usd - costo_real_usd), 4)
        return b

    def liberar(self, tenant_id: str, reserva_usd: float) -> TenantBudget:
        b = self._rows.get(tenant_id)
        if b is None:
            raise KeyError(f"tenant_budget inexistente para {tenant_id}")
        b.retenido_usd = round(max(0.0, b.retenido_usd - reserva_usd), 4)
        b.saldo_actual_usd = round(b.saldo_actual_usd + reserva_usd, 4)
        return b


# ── Almacén Supabase (producción) ─────────────────────────────────────────────


class SupabaseBudgetStore:
    """Almacén real sobre la tabla `tenant_budget`. Usa SUPABASE_SERVICE_KEY."""

    TABLE = "tenant_budget"

    def __init__(self, client: Any = None) -> None:
        self._client = client

    def _sb(self) -> Any:
        if self._client is None:
            from supabase import create_client

            # B0.7: validación loud + service_role (helper compartido).
            from app.core.supabase_client import require_supabase_config
            _url, _key = require_supabase_config("budget_manager", service=True)
            self._client = create_client(_url, _key)
        return self._client

    @staticmethod
    def _row_to_budget(row: dict) -> TenantBudget:
        return TenantBudget(
            tenant_id=row["tenant_id"],
            saldo_actual_usd=float(row["saldo_actual_usd"]),
            hard_cap_por_documento=float(row.get("hard_cap_por_documento", 5.0)),
            hard_cap_por_sesion=float(row.get("hard_cap_por_sesion", 20.0)),
            moneda=row.get("moneda", "USD"),
            retenido_usd=float(row.get("retenido_usd", 0.0) or 0.0),
        )

    def get(self, tenant_id: str) -> TenantBudget | None:
        res = (
            self._sb()
            .table(self.TABLE)
            .select("*")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return self._row_to_budget(res.data[0])

    def upsert(self, budget: TenantBudget) -> TenantBudget:
        self._sb().table(self.TABLE).upsert(
            {
                "tenant_id": budget.tenant_id,
                "saldo_actual_usd": budget.saldo_actual_usd,
                "hard_cap_por_documento": budget.hard_cap_por_documento,
                "hard_cap_por_sesion": budget.hard_cap_por_sesion,
                "moneda": budget.moneda,
                "retenido_usd": budget.retenido_usd,
            },
            on_conflict="tenant_id",
        ).execute()
        return budget

    def set_balance(self, tenant_id: str, nuevo_saldo: float) -> TenantBudget:
        self._sb().table(self.TABLE).update(
            {"saldo_actual_usd": nuevo_saldo}
        ).eq("tenant_id", tenant_id).execute()
        b = self.get(tenant_id)
        if b is None:
            raise KeyError(f"tenant_budget inexistente para {tenant_id}")
        return b

    # ── Operaciones ATÓMICAS vía RPC de Postgres (migración 018) ──────────────
    # Cada operación es UNA sola RPC = un UPDATE indivisible bajo lock de fila. NO
    # hay read-modify-write: dos reservas concurrentes sobre el mismo tenant no
    # pueden sobre-vender el saldo (la guarda `saldo >= monto` se re-evalúa sobre
    # la fila ya bloqueada). El saldo es dinero; esta es la garantía dura.
    def _budget_inexistente(self, tenant_id: str) -> KeyError:
        return KeyError(f"tenant_budget inexistente para {tenant_id}")

    def reservar(self, tenant_id: str, monto_usd: float) -> ReservaResultado:
        res = self._sb().rpc(
            "budget_reservar", {"p_tenant": tenant_id, "p_monto": monto_usd}
        ).execute()
        if not res.data:
            raise self._budget_inexistente(tenant_id)
        row = res.data[0]
        disponible = float(row["out_disponible"])
        retenido = float(row["out_retenido"])
        if row["out_ok"]:
            return ReservaResultado(
                ok=True, monto_reservado=round(monto_usd, 4),
                saldo_disponible=disponible, retenido=retenido,
                motivo="Reserva creada (disponible→retenido).",
            )
        return ReservaResultado(
            ok=False, monto_reservado=0.0, saldo_disponible=disponible,
            retenido=retenido,
            motivo=(
                f"Saldo disponible insuficiente para reservar ${monto_usd:.4f}: "
                f"disponible ${disponible:.4f}. No se encola."
            ),
            falta_usd=float(row.get("out_falta") or 0.0),
        )

    def liquidar(
        self, tenant_id: str, reserva_usd: float, costo_real_usd: float
    ) -> TenantBudget:
        res = self._sb().rpc(
            "budget_liquidar",
            {"p_tenant": tenant_id, "p_reserva": reserva_usd, "p_real": costo_real_usd},
        ).execute()
        if not res.data:
            raise self._budget_inexistente(tenant_id)
        return self._merge_balances(tenant_id, res.data[0])

    def liberar(self, tenant_id: str, reserva_usd: float) -> TenantBudget:
        res = self._sb().rpc(
            "budget_liberar", {"p_tenant": tenant_id, "p_reserva": reserva_usd}
        ).execute()
        if not res.data:
            raise self._budget_inexistente(tenant_id)
        return self._merge_balances(tenant_id, res.data[0])

    @staticmethod
    def _merge_balances(tenant_id: str, row: dict) -> TenantBudget:
        """Construye un TenantBudget con los saldos que devolvió la RPC."""
        return TenantBudget(
            tenant_id=tenant_id,
            saldo_actual_usd=float(row["out_disponible"]),
            retenido_usd=float(row["out_retenido"]),
        )


# ── Gestor de presupuesto ─────────────────────────────────────────────────────


@dataclass
class CapVerdict:
    """Resultado de verificar un costo estimado contra saldo y hard caps."""

    aprobado: bool
    motivo: str
    saldo_disponible: float
    falta_usd: float = 0.0  # cuánto falta si fue rechazado por saldo


@dataclass
class ReservaResultado:
    """Resultado de intentar reservar (retener) un monto sobre el saldo (F1.5)."""

    ok: bool
    monto_reservado: float
    saldo_disponible: float
    retenido: float
    motivo: str = ""
    falta_usd: float = 0.0  # cuánto falta si no alcanzó (comportamiento "cuántos caben")


class BudgetManager:
    """Lógica de saldo y hard caps sobre un BudgetStore."""

    def __init__(self, store: BudgetStore | None = None):
        self.store = store or SupabaseBudgetStore()

    def get_budget(self, tenant_id: str) -> TenantBudget | None:
        return self.store.get(tenant_id)

    def ensure_budget(
        self,
        tenant_id: str,
        saldo_inicial_usd: float = 0.0,
        hard_cap_por_documento: float = 5.0,
        hard_cap_por_sesion: float = 20.0,
    ) -> TenantBudget:
        """Crea el presupuesto si no existe (alta de tenant / setup de tests)."""
        existing = self.store.get(tenant_id)
        if existing is not None:
            return existing
        return self.store.upsert(
            TenantBudget(
                tenant_id=tenant_id,
                saldo_actual_usd=saldo_inicial_usd,
                hard_cap_por_documento=hard_cap_por_documento,
                hard_cap_por_sesion=hard_cap_por_sesion,
            )
        )

    def verificar(
        self,
        tenant_id: str,
        costo_estimado_usd: float,
        costo_sesion_acumulado_usd: float = 0.0,
    ) -> CapVerdict:
        """
        Verifica un costo estimado contra (1) hard cap por documento, (2) hard
        cap por sesión acumulada, (3) saldo prepagado disponible. El orden
        importa: los hard caps son límites de seguridad y se evalúan antes que
        el saldo, para dar un mensaje preciso.
        """
        budget = self.store.get(tenant_id)
        if budget is None:
            return CapVerdict(
                aprobado=False,
                motivo=(
                    f"El tenant '{tenant_id}' no tiene presupuesto configurado. "
                    "Configure tenant_budget antes de ingerir."
                ),
                saldo_disponible=0.0,
                falta_usd=costo_estimado_usd,
            )

        if costo_estimado_usd > budget.hard_cap_por_documento:
            return CapVerdict(
                aprobado=False,
                motivo=(
                    f"Costo estimado ${costo_estimado_usd:.4f} excede el hard cap "
                    f"por documento (${budget.hard_cap_por_documento:.2f}). "
                    "Ingesta rechazada."
                ),
                saldo_disponible=budget.saldo_actual_usd,
            )

        total_sesion = costo_sesion_acumulado_usd + costo_estimado_usd
        if total_sesion > budget.hard_cap_por_sesion:
            return CapVerdict(
                aprobado=False,
                motivo=(
                    f"El acumulado de la sesión ${total_sesion:.4f} excede el hard "
                    f"cap por sesión (${budget.hard_cap_por_sesion:.2f}). "
                    "Ingesta rechazada."
                ),
                saldo_disponible=budget.saldo_actual_usd,
            )

        if costo_estimado_usd > budget.saldo_actual_usd:
            return CapVerdict(
                aprobado=False,
                motivo=(
                    f"Saldo insuficiente: disponible ${budget.saldo_actual_usd:.4f}, "
                    f"se requieren ${costo_estimado_usd:.4f}. "
                    "Recargue el saldo prepagado para continuar."
                ),
                saldo_disponible=budget.saldo_actual_usd,
                falta_usd=round(costo_estimado_usd - budget.saldo_actual_usd, 4),
            )

        return CapVerdict(
            aprobado=True,
            motivo="Presupuesto suficiente y dentro de hard caps.",
            saldo_disponible=budget.saldo_actual_usd,
        )

    def debitar(self, tenant_id: str, monto_usd: float) -> TenantBudget:
        """
        Descuenta del saldo tras una ingesta efectivamente realizada. Se invoca
        DESPUÉS de procesar (con el costo real o el estimado confirmado), nunca
        antes de la confirmación del usuario.

        NOTA F1.5: el flujo de ingesta usa el esquema reservar/liquidar/liberar
        (opción C) en lugar de un débito directo; `debitar` se conserva para usos
        puntuales (recargas/ajustes) y compatibilidad.
        """
        budget = self.store.get(tenant_id)
        if budget is None:
            raise KeyError(f"tenant_budget inexistente para {tenant_id}")
        nuevo = round(budget.saldo_actual_usd - monto_usd, 4)
        return self.store.set_balance(tenant_id, nuevo)

    # ── Esquema reservar / liquidar / liberar (opción C, F1.5) ────────────────
    # Delega en operaciones ATÓMICAS del store (RPC de Postgres en producción).
    # No hay read-modify-write en este nivel: el saldo es dinero y la
    # indivisibilidad la garantiza la base, no la app.
    def reservar(self, tenant_id: str, monto_usd: float) -> ReservaResultado:
        """
        Mueve `monto_usd` de DISPONIBLE a RETENIDO al confirmar una ingesta
        (paso 2 del gate), en una sola operación atómica. Si el disponible no
        alcanza, NO reserva y devuelve `ok=False` con `falta_usd` (el llamador no
        confirma / no encola — el "cuántos caben" del cotizador sigue vigente).
        """
        return self.store.reservar(tenant_id, round(monto_usd, 4))

    def liquidar(
        self, tenant_id: str, reserva_usd: float, costo_real_usd: float
    ) -> TenantBudget:
        """
        Convierte una reserva en consumo real al COMPLETAR la ingesta (atómico):
        libera la reserva de `retenido` y descuenta el `costo_real`, devolviendo
        el sobrante (reserva − real) a `disponible`. Si el real excede la reserva
        (sobre-consumo), el disponible absorbe la diferencia (puede quedar negativo;
        reflejo honesto del cómputo realmente gastado).
        """
        return self.store.liquidar(
            tenant_id, round(reserva_usd, 4), round(costo_real_usd, 4)
        )

    def liberar(self, tenant_id: str, reserva_usd: float) -> TenantBudget:
        """
        Devuelve la reserva COMPLETA a `disponible` (atómico) cuando la ingesta
        falla de forma terminal o se resuelve por idempotencia sin consumir
        cómputo. Estado final del saldo idéntico al de antes de reservar.
        """
        return self.store.liberar(tenant_id, round(reserva_usd, 4))
