"""
Límite de documentos vivos por plan (B13 §1.2/§1.5).

El conteo de "documentos vivos" se deriva del grafo del tenant (`:DocumentoSource`),
no de Postgres. Freemium = 3; otros planes según `orgs.doc_limit` (NULL = ilimitado).
Eliminar un documento libera cupo automáticamente (baja el conteo del grafo).
"""
from __future__ import annotations

from typing import Any

from app.graph.dkg_documents import contar_documentos


class LimiteDocumentosError(RuntimeError):
    """Se alcanzó el límite de documentos vivos del plan."""

    def __init__(self, limit: int, usados: int) -> None:
        self.limit = limit
        self.usados = usados
        super().__init__(
            f"Límite de documentos vivos alcanzado ({usados}/{limit}). "
            "Elimina un documento o pasa a un plan superior para cargar otro."
        )


def estado_cupo(store: Any, dkg: Any, tenant_id: str) -> dict:
    """
    Estado del cupo: {limit, usados, disponibles}. `limit`/`disponibles` = None si
    la org no tiene límite (plan ilimitado o sin fila de org formalizada).
    """
    org = store.get_org(tenant_id)
    limit = org.get("doc_limit") if org else None
    usados = contar_documentos(dkg, tenant_id)
    if limit is None:
        return {"limit": None, "usados": usados, "disponibles": None}
    return {"limit": int(limit), "usados": usados, "disponibles": max(0, int(limit) - usados)}


def verificar_limite_documentos(store: Any, dkg: Any, tenant_id: str) -> None:
    """
    Lanza `LimiteDocumentosError` si una nueva ingesta excedería el límite del plan.
    No-op si la org no tiene límite (None) o no está formalizada.
    """
    org = store.get_org(tenant_id)
    if org is None:
        return
    limit = org.get("doc_limit")
    if limit is None:
        return
    usados = contar_documentos(dkg, tenant_id)
    if usados >= int(limit):
        raise LimiteDocumentosError(int(limit), usados)
