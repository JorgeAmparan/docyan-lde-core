"""
Gestor de cupo de ingestas por tier (F3 §C — Modelo Comercial v1.1 §2.3).

DOCYAN LDE™ by XCID.

Opera la tabla `org_ingest_quota` (migración 021): las "ingestas incluidas" que el
plan promete (Esencial 10 + 3/mes · Profesional 30 + 10/mes · Enterprise negociado).
Es una dimensión DISTINTA de `orgs.doc_limit` (mig 020), que es el tope de
DOCUMENTOS VIVOS del grafo. Modelo comercial v2.1: cupo + excedente, SIN saldo
prepagado (el wallet `tenant_budget` fue retirado, migración 022).

El cupo gobierna el PRECIO DE SETUP comercial: dentro de cupo el setup es $0
("incluido en tu plan"); agotado, el cotizador cobra con la fórmula canónica.

El acceso al almacén se abstrae en `QuotaStore`. Producción usa Supabase (RPC
atómicas idempotentes); tests inyectan `InMemoryQuotaStore`. Freemium NO tiene fila
de cupo: opera por su límite de documentos vivos (doc_limit), sin ingestas incluidas.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol

# ── Cupo por plan (Modelo Comercial v1.1 §2.3 · Precios v2.1 §5) ──────────────
# (cupo_inicial, cupo_recurrente_mensual). El inicial es también el TECHO de
# acumulación de la reposición mensual. Enterprise = None → cupo negociado,
# sembrado a mano (enterprise_configurable=True). Freemium/None → sin fila de cupo.
CUPOS_POR_PLAN: dict[str, tuple[int, int] | None] = {
    "esencial": (10, 3),
    "profesional": (30, 10),
    "enterprise": None,  # configurable / negociado
    # Piloto es Esencial con −30%: comercialmente es el tier Esencial, hereda su cupo.
    "piloto": (10, 3),
}
# Planes sin cupo de setup (freemium opera por doc_limit, sin ingestas incluidas).
PLANES_SIN_CUPO = frozenset({"freemium"})


def cupo_para_plan(plan: str | None) -> tuple[int, int] | None:
    """
    Devuelve (cupo_inicial, recurrente_mensual) del plan, o None si el plan no
    lleva cupo de setup (freemium, plan desconocido, enterprise sin configurar).
    """
    if not plan:
        return None
    return CUPOS_POR_PLAN.get(plan.strip().lower())


@dataclass
class OrgQuota:
    """Vista de dominio de una fila de `org_ingest_quota`."""

    org_id: str
    cupo_inicial: int
    cupo_recurrente_mensual: int
    cupo_restante: int
    enterprise_configurable: bool = False


@dataclass
class DecrementoResultado:
    """Resultado de intentar descontar una ingesta del cupo (idempotente por job)."""

    decremented: bool
    cupo_restante: int


class QuotaStore(Protocol):
    """Contrato de almacenamiento del cupo (Supabase o memoria)."""

    def get(self, org_id: str) -> OrgQuota | None: ...

    def upsert(self, quota: OrgQuota) -> OrgQuota: ...

    # Decremento ATÓMICO e idempotente por job_id (RPC en producción).
    def decrementar(self, org_id: str, job_id: str) -> DecrementoResultado: ...

    # Reposición mensual del recurrente (sin pasar del techo). Devuelve nº de orgs.
    def reponer_mensual(self) -> int: ...


# ── Almacén en memoria (tests / dev local) ────────────────────────────────────


@dataclass
class InMemoryQuotaStore:
    """Almacén volátil para tests. Misma aritmética que las RPC de la migración 021."""

    _rows: dict[str, OrgQuota] = field(default_factory=dict)
    # Ledger de idempotencia: job_ids que ya descontaron cupo.
    _ledger: set[str] = field(default_factory=set)

    def get(self, org_id: str) -> OrgQuota | None:
        return self._rows.get(org_id)

    def upsert(self, quota: OrgQuota) -> OrgQuota:
        self._rows[quota.org_id] = quota
        return quota

    def decrementar(self, org_id: str, job_id: str) -> DecrementoResultado:
        q = self._rows.get(org_id)
        if job_id in self._ledger:
            # Idempotente: este job ya descontó. No vuelve a tocar el cupo.
            return DecrementoResultado(False, q.cupo_restante if q else 0)
        self._ledger.add(job_id)
        if q is None or q.cupo_restante <= 0:
            return DecrementoResultado(False, q.cupo_restante if q else 0)
        q.cupo_restante -= 1
        return DecrementoResultado(True, q.cupo_restante)

    def reponer_mensual(self) -> int:
        n = 0
        for q in self._rows.values():
            if q.cupo_recurrente_mensual > 0:
                q.cupo_restante = min(
                    q.cupo_restante + q.cupo_recurrente_mensual, q.cupo_inicial
                )
                n += 1
        return n


# ── Almacén Supabase (producción) ─────────────────────────────────────────────


class SupabaseQuotaStore:
    """Almacén real sobre `org_ingest_quota`. Usa SUPABASE_SERVICE_KEY (bypassa RLS)."""

    TABLE = "org_ingest_quota"

    def __init__(self, client: Any = None) -> None:
        self._client = client

    def _sb(self) -> Any:
        if self._client is None:
            from supabase import create_client

            from app.core.supabase_client import require_supabase_config

            _url, _key = require_supabase_config("quota_manager", service=True)
            self._client = create_client(_url, _key)
        return self._client

    @staticmethod
    def _row_to_quota(row: dict) -> OrgQuota:
        return OrgQuota(
            org_id=row["org_id"],
            cupo_inicial=int(row["cupo_inicial"]),
            cupo_recurrente_mensual=int(row["cupo_recurrente_mensual"]),
            cupo_restante=int(row["cupo_restante"]),
            enterprise_configurable=bool(row.get("enterprise_configurable", False)),
        )

    def get(self, org_id: str) -> OrgQuota | None:
        res = (
            self._sb()
            .table(self.TABLE)
            .select("*")
            .eq("org_id", org_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return self._row_to_quota(res.data[0])

    def upsert(self, quota: OrgQuota) -> OrgQuota:
        self._sb().table(self.TABLE).upsert(
            {
                "org_id": quota.org_id,
                "cupo_inicial": quota.cupo_inicial,
                "cupo_recurrente_mensual": quota.cupo_recurrente_mensual,
                "cupo_restante": quota.cupo_restante,
                "enterprise_configurable": quota.enterprise_configurable,
            },
            on_conflict="org_id",
        ).execute()
        return quota

    def decrementar(self, org_id: str, job_id: str) -> DecrementoResultado:
        res = self._sb().rpc(
            "cupo_decrementar", {"p_org": org_id, "p_job": job_id}
        ).execute()
        if not res.data:
            return DecrementoResultado(False, 0)
        row = res.data[0]
        return DecrementoResultado(
            decremented=bool(row["out_decremented"]),
            cupo_restante=int(row["out_restante"]),
        )

    def reponer_mensual(self) -> int:
        res = self._sb().rpc("cupo_reponer_mensual", {}).execute()
        # La RPC devuelve un entero escalar (nº de orgs repuestas).
        if isinstance(res.data, int):
            return res.data
        if isinstance(res.data, list) and res.data:
            return int(res.data[0]) if not isinstance(res.data[0], dict) else int(
                next(iter(res.data[0].values()))
            )
        return 0


# ── Gestor de cupo ────────────────────────────────────────────────────────────


@dataclass
class EstadoCupo:
    """Vista de cupo para la UI / cotizador."""

    aplica: bool  # False = el plan no lleva cupo (freemium / sin fila)
    cupo_restante: int = 0
    cupo_inicial: int = 0
    cupo_recurrente_mensual: int = 0
    dentro_de_cupo: bool = False  # ¿la PRÓXIMA ingesta entra incluida?

    def to_dict(self) -> dict:
        return {
            "aplica": self.aplica,
            "cupo_restante": self.cupo_restante,
            "cupo_inicial": self.cupo_inicial,
            "cupo_recurrente_mensual": self.cupo_recurrente_mensual,
            "dentro_de_cupo": self.dentro_de_cupo,
        }


class QuotaManager:
    """Lógica de cupo de ingestas sobre un QuotaStore."""

    def __init__(self, store: QuotaStore | None = None):
        self.store = store or SupabaseQuotaStore()

    def get_quota(self, org_id: str) -> OrgQuota | None:
        return self.store.get(org_id)

    def ensure_quota(self, org_id: str, plan: str | None) -> OrgQuota | None:
        """
        Siembra el cupo de la org según su plan si aún no existe. Idempotente: si ya
        hay fila, la devuelve sin tocarla (no reinicia el cupo gastado). Devuelve
        None para planes sin cupo (freemium) — no se crea fila.
        """
        existing = self.store.get(org_id)
        if existing is not None:
            return existing
        cupos = cupo_para_plan(plan)
        if cupos is None:
            # Enterprise (configurable) o sin cupo. Para enterprise se crea una fila
            # marcada configurable con cupo 0 (el operador lo negocia/edita); para
            # freemium y desconocidos, no se crea nada.
            if plan and plan.strip().lower() == "enterprise":
                return self.store.upsert(
                    OrgQuota(org_id, 0, 0, 0, enterprise_configurable=True)
                )
            return None
        inicial, recurrente = cupos
        return self.store.upsert(
            OrgQuota(org_id, inicial, recurrente, inicial, enterprise_configurable=False)
        )

    def estado(self, org_id: str) -> EstadoCupo:
        """Estado del cupo para UI y cotizador. `aplica=False` si el plan no lleva cupo."""
        q = self.store.get(org_id)
        if q is None:
            return EstadoCupo(aplica=False)
        return EstadoCupo(
            aplica=True,
            cupo_restante=q.cupo_restante,
            cupo_inicial=q.cupo_inicial,
            cupo_recurrente_mensual=q.cupo_recurrente_mensual,
            dentro_de_cupo=q.cupo_restante > 0,
        )

    def decrementar(self, org_id: str, job_id: str) -> DecrementoResultado:
        """Descuenta una ingesta del cupo al confirmar (idempotente por job_id)."""
        return self.store.decrementar(org_id, job_id)

    def reponer_mensual(self) -> int:
        """Reposición mensual del cupo recurrente (scheduler). Devuelve nº de orgs."""
        return self.store.reponer_mensual()
