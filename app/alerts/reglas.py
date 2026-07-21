"""
`ReglaAlerta` viva — configuración de alertas por tenant (ED-1 §2.3 / Adenda ED §2.2).

DOCYAN LDE™ by XCID.

Hasta ED-1 `ReglaAlerta` era un label muerto (declarado, jamás escrito/leído). Aquí
se persiste como **nodo `:ReglaAlerta` por tenant en FalkorDB** (aislamiento nativo
por graph_name), con:

- `thresholds`   — días antes del vencimiento en que se avisa (ej. [30, 15, 7]).
- `urgencias`    — urgencia por threshold (JSON), ej. {"30":"baja","15":"media","7":"alta"}.
- `destinatarios`— refs al Directorio de Destinatarios (§2.5).
- `canales`      — `email` / `in_app`.
- `escalacion`   — N días en estado `notificado` sin `reconocido` → notificar al
                   destinatario de escalación.

Defaults sembrados por tenant al onboarding (idempotente) + backfill de tenants
existentes. El admin los edita vía el router `/alertas/reglas` (que conecta la vista
`admin/alertas/page.tsx`).

Nota de persistencia: FalkorDB soporta arrays de escalares como propiedades pero NO
mapas; `urgencias` se guarda como JSON string y se rehidrata al leer.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

# Defaults sembrados por tenant (editables por el admin).
DEFAULT_THRESHOLDS: list[int] = [30, 15, 7]
DEFAULT_URGENCIAS: dict[str, str] = {"30": "baja", "15": "media", "7": "alta"}
DEFAULT_CANALES: list[str] = ["in_app"]
DEFAULT_ESCALACION_DIAS: int = 7
URGENCIA_DEFAULT = "media"
TIPO_GLOBAL = "*"

CANALES_VALIDOS: frozenset[str] = frozenset({"email", "in_app"})


def regla_id_para(tipo: str) -> str:
    return f"regla_{tipo}"


@dataclass
class ReglaAlerta:
    tenant_id: str
    tipo: str = TIPO_GLOBAL
    thresholds: list[int] = field(default_factory=lambda: list(DEFAULT_THRESHOLDS))
    urgencias: dict[str, str] = field(default_factory=lambda: dict(DEFAULT_URGENCIAS))
    destinatarios: list[str] = field(default_factory=list)
    canales: list[str] = field(default_factory=lambda: list(DEFAULT_CANALES))
    escalacion_dias: int | None = DEFAULT_ESCALACION_DIAS
    escalacion_destinatario_id: str | None = None
    activo: bool = True

    @property
    def id(self) -> str:
        return regla_id_para(self.tipo)

    def urgencia_para(self, threshold: int) -> str:
        return self.urgencias.get(str(threshold), URGENCIA_DEFAULT)

    def to_props(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "tipo": self.tipo,
            "thresholds": [int(t) for t in self.thresholds],
            "urgencias_json": json.dumps(self.urgencias),
            "destinatarios": list(self.destinatarios),
            "canales": list(self.canales),
            "escalacion_dias": self.escalacion_dias,
            "escalacion_destinatario_id": self.escalacion_destinatario_id,
            "activo": self.activo,
        }

    def to_public(self) -> dict[str, Any]:
        """Dict serializable para el API/frontend."""
        return {
            "tipo": self.tipo,
            "thresholds": [int(t) for t in self.thresholds],
            "urgencias": self.urgencias,
            "destinatarios": list(self.destinatarios),
            "canales": list(self.canales),
            "escalacion_dias": self.escalacion_dias,
            "escalacion_destinatario_id": self.escalacion_destinatario_id,
            "activo": self.activo,
        }

    @classmethod
    def from_row(cls, tenant_id: str, row: dict) -> "ReglaAlerta":
        urg_raw = row.get("urgencias_json")
        try:
            urgencias = json.loads(urg_raw) if urg_raw else dict(DEFAULT_URGENCIAS)
        except (json.JSONDecodeError, TypeError):
            urgencias = dict(DEFAULT_URGENCIAS)
        return cls(
            tenant_id=tenant_id,
            tipo=row.get("tipo") or TIPO_GLOBAL,
            thresholds=[int(t) for t in (row.get("thresholds") or DEFAULT_THRESHOLDS)],
            urgencias=urgencias,
            destinatarios=list(row.get("destinatarios") or []),
            canales=list(row.get("canales") or DEFAULT_CANALES),
            escalacion_dias=row.get("escalacion_dias"),
            escalacion_destinatario_id=row.get("escalacion_destinatario_id"),
            activo=bool(row.get("activo", True)),
        )


def default_regla(tenant_id: str, tipo: str = TIPO_GLOBAL) -> ReglaAlerta:
    return ReglaAlerta(tenant_id=tenant_id, tipo=tipo)


def guardar_regla(client: Any, regla: ReglaAlerta) -> ReglaAlerta:
    """Upsert (MERGE por id) del `:ReglaAlerta` en el grafo del tenant."""
    props = regla.to_props()
    client.query(
        regla.tenant_id,
        """
        MERGE (r:ReglaAlerta {id: $id})
        SET r.tipo = $tipo,
            r.thresholds = $thresholds,
            r.urgencias_json = $urgencias_json,
            r.destinatarios = $destinatarios,
            r.canales = $canales,
            r.escalacion_dias = $escalacion_dias,
            r.escalacion_destinatario_id = $escalacion_destinatario_id,
            r.activo = $activo
        """,
        props,
    )
    return regla


def listar_reglas(client: Any, tenant_id: str) -> list[ReglaAlerta]:
    rows = client.query(
        tenant_id,
        "MATCH (r:ReglaAlerta) RETURN r.tipo AS tipo, r.thresholds AS thresholds, "
        "r.urgencias_json AS urgencias_json, r.destinatarios AS destinatarios, "
        "r.canales AS canales, r.escalacion_dias AS escalacion_dias, "
        "r.escalacion_destinatario_id AS escalacion_destinatario_id, r.activo AS activo",
        {},
    )
    return [ReglaAlerta.from_row(tenant_id, r) for r in rows]


def obtener_regla(client: Any, tenant_id: str, tipo: str = TIPO_GLOBAL) -> ReglaAlerta | None:
    rows = client.query(
        tenant_id,
        "MATCH (r:ReglaAlerta {id: $id}) RETURN r.tipo AS tipo, r.thresholds AS thresholds, "
        "r.urgencias_json AS urgencias_json, r.destinatarios AS destinatarios, "
        "r.canales AS canales, r.escalacion_dias AS escalacion_dias, "
        "r.escalacion_destinatario_id AS escalacion_destinatario_id, r.activo AS activo",
        {"id": regla_id_para(tipo)},
    )
    return ReglaAlerta.from_row(tenant_id, rows[0]) if rows else None


def regla_aplicable(client: Any, tenant_id: str, tipo: str = TIPO_GLOBAL) -> ReglaAlerta:
    """
    Regla que aplica a un tipo: la específica si existe, si no la global `*`, si no
    el default en memoria (no persistido). El barrido/notificador siempre tiene una
    regla con la que evaluar.
    """
    especifica = obtener_regla(client, tenant_id, tipo) if tipo != TIPO_GLOBAL else None
    if especifica is not None and especifica.activo:
        return especifica
    global_ = obtener_regla(client, tenant_id, TIPO_GLOBAL)
    if global_ is not None and global_.activo:
        return global_
    return default_regla(tenant_id, TIPO_GLOBAL)


def sembrar_reglas_default(client: Any, tenant_id: str) -> bool:
    """
    Siembra la regla global default para un tenant si aún no tiene ninguna.
    Idempotente: si ya existe una `:ReglaAlerta`, no la toca. Devuelve True si sembró.
    Usada al onboarding y en el backfill de tenants existentes.
    """
    existentes = listar_reglas(client, tenant_id)
    if existentes:
        return False
    guardar_regla(client, default_regla(tenant_id, TIPO_GLOBAL))
    return True
