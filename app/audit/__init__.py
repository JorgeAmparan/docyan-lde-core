"""
FAT extendido — Foundation Audit Trail con cadena criptográfica SHA-256 (B7).

DOCYAN LDE™ by XCID.

Materializa el pedigree clickeable (Nivel 1) y la auditoría de patrones del EDB
(Nivel 3) de la Adenda MVP. Evoluciona `app/core/matrix.py` (logging plano al
`audit_trail`) a un FAT inmutable, append-only, con hash chain global por tenant,
9 familias de eventos, retención diferenciada, exportadores auditables y
verificador de integridad.

Submódulos:
  - familias        : enums FamiliaFAT (9) + retención por familia (decisión #12).
  - fat_extendido   : EventoFAT, algoritmo de hash, FATExtendido + stores.
  - integrity_checker: verificación de cadena (tamper + huecos) + CLI para CI.
  - reports         : exportación PDF / XML / JSON / CSV con filtros.
  - retention       : rutina de retención (backup verificado antes de eliminar).
"""
from app.audit.familias import RETENCION_ANIOS, FamiliaFAT
from app.audit.fat_extendido import (
    EventoFAT,
    FATExtendido,
    InMemoryFATStore,
    compute_hash_evento,
)

# NOTA: `integrity_checker` NO se importa aquí a propósito — se ejecuta como
# módulo en CI (`python -m app.audit.integrity_checker`) y un import eager en el
# paquete dispara un RuntimeWarning de runpy. Impórtalo directamente:
#   from app.audit.integrity_checker import verificar_cadena, IntegrityResult

__all__ = [
    "FamiliaFAT",
    "RETENCION_ANIOS",
    "EventoFAT",
    "FATExtendido",
    "InMemoryFATStore",
    "compute_hash_evento",
]
