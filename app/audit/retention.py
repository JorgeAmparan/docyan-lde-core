"""
Rutina de retención del FAT por familia (decisión #12 Paso C / doc 08, B7).

DOCYAN LDE™ by XCID.

Cada familia FAT tiene años de retención (app.audit.familias.RETENCION_ANIOS).
La rutina:
  1. Identifica eventos VENCIDOS (timestamp más viejo que la retención de su
     familia respecto a `ahora`).
  2. Hace un BACKUP VERIFICADO de los vencidos (a Supabase Storage o equivalente)
     ANTES de eliminar. Si el backup no se verifica, NO se elimina nada.
  3. Elimina del store solo los vencidos respaldados. Los no vencidos quedan
     intactos.

Corre como tarea programada del scheduler de B4 (APScheduler) — ver
`app/orchestrator/scheduler.py`. Aquí queda la lógica pura + inyección de store,
clock y backup sink, para que sea testable sin red ni reloj real.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Protocol

from app.audit.familias import RETENCION_ANIOS
from app.audit.fat_extendido import EventoFAT, FATExtendido

# Aproximación de año en días para el cálculo de vencimiento (gregoriano medio).
_DIAS_POR_ANIO = 365.2425


class BackupSink(Protocol):
    """Destino de backup. `respaldar` devuelve True solo si el backup se verifica."""

    def respaldar(self, eventos: list[EventoFAT]) -> bool: ...


@dataclass
class InMemoryBackupSink:
    """Backup en memoria para tests. Expone `respaldados` para aserciones."""

    respaldados: list[EventoFAT] = field(default_factory=list)
    debe_fallar: bool = False

    def respaldar(self, eventos: list[EventoFAT]) -> bool:
        if self.debe_fallar:
            return False
        self.respaldados.extend(eventos)
        return True


#: Bucket de Supabase Storage donde se respaldan los eventos FAT antes de purgar.
#: Privado (no público). Se crea con `scripts/ensure_fat_backup_bucket.py`.
FAT_BACKUP_BUCKET = "fat-backups"


class SupabaseStorageBackupSink:
    """
    Backup REAL a Supabase Storage (bucket privado `fat-backups`), VERIFICADO.

    Sube el export JSON de los eventos vencidos y lo RE-DESCARGA para confirmar
    que quedó persistido (mismo tamaño en bytes) ANTES de autorizar la
    eliminación. Si la subida o la verificación fallan, `respaldar` devuelve
    False y la rutina de retención NO elimina nada (gate de seguridad).

    Cliente Supabase inyectable (tests con fake); en producción lo construye
    perezosamente con service_role.
    """

    def __init__(self, supabase: Any = None, bucket: str = FAT_BACKUP_BUCKET) -> None:
        self._supabase = supabase
        self.bucket = bucket

    def _client(self) -> Any:
        if self._supabase is None:
            from supabase import create_client

            from app.core.supabase_client import require_supabase_config

            url, key = require_supabase_config("FATBackup", service=True)
            self._supabase = create_client(url, key)
        return self._supabase

    def respaldar(self, eventos: list[EventoFAT]) -> bool:
        if not eventos:
            return True
        # Import local para no acoplar el módulo de retención con el de reportes.
        from app.audit.reports import export_json

        tenant_id = eventos[0].tenant_id
        # Path determinista por tenant + rango temporal de lo respaldado.
        ts_min = min(e.timestamp for e in eventos).replace(":", "").replace("+", "")
        ts_max = max(e.timestamp for e in eventos).replace(":", "").replace("+", "")
        path = f"{tenant_id}/{ts_min}__{ts_max}__{len(eventos)}eventos.json"
        data = export_json(eventos).encode("utf-8")

        storage = self._client().storage.from_(self.bucket)
        try:
            storage.upload(
                path,
                data,
                {"content-type": "application/json", "upsert": "true"},
            )
        except Exception:  # noqa: BLE001
            return False

        # Verificación: re-descargar y comparar tamaño en bytes.
        try:
            bajado = storage.download(path)
        except Exception:  # noqa: BLE001
            return False
        return bajado is not None and len(bajado) == len(data)


@dataclass
class ResultadoRetencion:
    tenant_id: str
    evaluados: int
    vencidos: int
    eliminados: int
    backup_ok: bool
    detalle: str = ""

    def to_dict(self) -> dict[str, object]:
        return {
            "tenant_id": self.tenant_id,
            "evaluados": self.evaluados,
            "vencidos": self.vencidos,
            "eliminados": self.eliminados,
            "backup_ok": self.backup_ok,
            "detalle": self.detalle,
        }


def _es_vencido(ev: EventoFAT, ahora: datetime) -> bool:
    anios = RETENCION_ANIOS[ev.familia]
    corte = ahora - timedelta(days=_DIAS_POR_ANIO * anios)
    try:
        ts = datetime.fromisoformat(ev.timestamp)
    except ValueError:
        return False
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return ts < corte


def aplicar_retencion(
    fat: FATExtendido,
    tenant_id: str,
    *,
    backup: BackupSink,
    ahora: datetime | None = None,
) -> ResultadoRetencion:
    """
    Aplica la política de retención al tenant. Backup verificado antes de eliminar.

    Si el backup falla, NO elimina nada (devuelve backup_ok=False, eliminados=0).
    """
    ahora = ahora or datetime.now(timezone.utc)
    eventos = fat.eventos(tenant_id)
    vencidos = [e for e in eventos if _es_vencido(e, ahora)]

    if not vencidos:
        return ResultadoRetencion(
            tenant_id=tenant_id,
            evaluados=len(eventos),
            vencidos=0,
            eliminados=0,
            backup_ok=True,
            detalle="Sin eventos vencidos.",
        )

    backup_ok = backup.respaldar(vencidos)
    if not backup_ok:
        return ResultadoRetencion(
            tenant_id=tenant_id,
            evaluados=len(eventos),
            vencidos=len(vencidos),
            eliminados=0,
            backup_ok=False,
            detalle="Backup NO verificado: no se elimina nada (gate de seguridad).",
        )

    eliminados = fat.store.delete_eventos([e.evento_id for e in vencidos])
    return ResultadoRetencion(
        tenant_id=tenant_id,
        evaluados=len(eventos),
        vencidos=len(vencidos),
        eliminados=eliminados,
        backup_ok=True,
        detalle=f"{eliminados} eventos vencidos respaldados y eliminados.",
    )
