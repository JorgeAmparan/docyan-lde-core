"""
Resolución de tokens QR (B4 §6).

DOCYAN LDE™ by XCID.

Endpoint conceptual `GET /qr/<token>`: el QR mismo es la credencial (sin JWT para
resolver). El resolver:

  1. verifica la FIRMA del token (autosuficiente, sin tocar la base);
  2. consulta el registro `qr_tokens` para estado de ciclo de vida
     (revocado / expirado);
  3. recupera la :EntidadOperativa y sus documentos asociados DEL GRAFO DEL
     TENANT del token — nunca de otro;
  4. devuelve el contexto + la URL de frontend a la que redirigir.

Multi-tenant ABSOLUTO: la entidad se busca SIEMPRE en el grafo del `tenant_id`
que viene firmado en el token. Un token no puede alcanzar otro tenant. Cualquier
fallo (firma inválida, token desconocido, revocado, expirado, entidad
inexistente) se reporta como NotFound — 404, no 403 — para no filtrar existencia
(B4 §6).
"""
from __future__ import annotations

# Base del frontend de consulta (landing del QR). El contexto se pasa por query.
import os
from dataclasses import dataclass, field

from app.graph.schemas.dkg_ontology import EdgeType, NodeLabel
from app.qr import tokens
from app.qr.store import QrTokenStore, SupabaseQrTokenStore

QR_FRONTEND_BASE_URL = os.getenv("QR_FRONTEND_BASE_URL", "https://consulta.docyan.com")


class QrResolutionError(Exception):
    """
    No se pudo resolver el token. `reason` es interno (para FAT/logs); hacia el
    exterior SIEMPRE se traduce a 404 sin detalle, para no filtrar existencia.
    """

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


@dataclass
class ResolvedQr:
    """Contexto resuelto de un token QR válido."""

    tenant_id: str
    entidad_id: str
    entidad: dict
    documentos: list[dict] = field(default_factory=list)
    frontend_url: str = ""

    def to_dict(self) -> dict:
        return {
            "tenant_id": self.tenant_id,
            "entidad_id": self.entidad_id,
            "entidad": self.entidad,
            "documentos": self.documentos,
            "frontend_url": self.frontend_url,
        }


class QrResolver:
    """Resuelve tokens QR a contexto del DKG, con aislamiento absoluto por tenant."""

    def __init__(
        self,
        store: QrTokenStore | None = None,
        dkg=None,
        frontend_base_url: str | None = None,
    ):
        self.store = store or SupabaseQrTokenStore()
        self._dkg = dkg
        self.frontend_base_url = (frontend_base_url or QR_FRONTEND_BASE_URL).rstrip("/")

    @property
    def dkg(self):
        # Carga perezosa del cliente DKG (evita conexión a FalkorDB al importar).
        if self._dkg is None:
            from app.graph.dkg_client import dkg_client

            self._dkg = dkg_client
        return self._dkg

    def resolve(self, token: str) -> ResolvedQr:
        """Resuelve un token a su contexto. Lanza QrResolutionError (→404) si falla."""
        # 1. Firma (sin tocar la base).
        try:
            payload = tokens.verify(token)
        except tokens.InvalidQrToken as exc:
            raise QrResolutionError(f"token_invalido: {exc}") from exc

        # 2. Registro / ciclo de vida.
        record = self.store.get(payload.tenant_id, payload.nonce)
        if record is None:
            raise QrResolutionError("token_no_registrado")
        if record.entidad_id_dkg != payload.entidad_id:
            # El registro y la firma discrepan: token manipulado o corrupto.
            raise QrResolutionError("token_entidad_discrepa")
        if record.is_revoked():
            raise QrResolutionError("token_revocado")
        if record.is_expired():
            raise QrResolutionError("token_expirado")

        # 3. Entidad + documentos DEL GRAFO DEL TENANT DEL TOKEN (aislamiento).
        entidad = self.dkg.get_entity(payload.tenant_id, payload.entidad_id)
        if entidad is None:
            raise QrResolutionError("entidad_inexistente")

        documentos = self._documentos_de(payload.tenant_id, payload.entidad_id)

        # Ruta pública REAL del frontend para el QR: `(qr-public)/q/[token]` (fetch
        # de `/qr/{token}?format=json`, self-contained por token, fuera del auth
        # middleware). NO existe `/consulta` en el frontend — apuntar ahí daba 404.
        # El token basta: la página re-resuelve el contexto (tenant/entidad/aislamiento).
        frontend_url = f"{self.frontend_base_url}/q/{token}"
        return ResolvedQr(
            tenant_id=payload.tenant_id,
            entidad_id=payload.entidad_id,
            entidad=entidad,
            documentos=documentos,
            frontend_url=frontend_url,
        )

    def _documentos_de(self, tenant_id: str, entidad_id: str) -> list[dict]:
        """
        Documentos asociados a la entidad vía arista DOCUMENTADA_POR. Tolerante a
        fallos del grafo: si la consulta de documentos falla, la resolución de la
        entidad NO se cae (el QR sigue sirviendo el contexto de la entidad).
        """
        try:
            rows = self.dkg.query(
                tenant_id,
                f"MATCH (e:{NodeLabel.ENTIDAD_OPERATIVA.value} {{id: $id}})"
                f"-[:{EdgeType.DOCUMENTADA_POR.value}]->(d:{NodeLabel.DOCUMENTO_SOURCE.value}) "
                f"RETURN d",
                {"id": entidad_id},
            )
            return rows or []
        except Exception:
            return []
