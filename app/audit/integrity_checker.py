"""
Verificador de integridad del hash chain FAT (doc 08, B7).

DOCYAN LDE™ by XCID.

Verifica que la cadena de hashes de un tenant es íntegra desde el primer evento
(génesis) hasta el último. Detecta:
  - ALTERACIÓN: el hash almacenado de un evento no coincide con el recalculado
    desde sus campos (alguien editó el payload/timestamp/etc.).
  - HUECO / ELIMINACIÓN: el `hash_evento_anterior` de un evento no coincide con el
    `hash_evento` del evento previo en la cadena cronológica (se borró o reordenó
    un evento intermedio).

Ejecutable:
  - Bajo demanda vía endpoint admin del backend (`/admin/fat/integrity`).
  - En CI como job de smoke sobre dataset SINTÉTICO (no productivo):
        python -m app.audit.integrity_checker
    exit code 0 si íntegro, no-cero si roto.
"""
from __future__ import annotations

import sys
from dataclasses import dataclass, field

from app.audit.familias import FamiliaFAT
from app.audit.fat_extendido import (
    GENESIS_HASH,
    EventoFAT,
    FATExtendido,
    InMemoryFATStore,
)


@dataclass
class IntegrityResult:
    """Resultado de verificar la cadena de un tenant."""

    tenant_id: str
    integra: bool
    total_eventos: int
    primer_evento_roto: str | None = None  # evento_id donde se rompe
    tipo_problema: str | None = None  # "alteracion" | "hueco" | None
    detalle: str = ""
    problemas: list[dict[str, str]] = field(default_factory=list)

    def to_dict(self) -> dict[str, object]:
        return {
            "tenant_id": self.tenant_id,
            "integra": self.integra,
            "total_eventos": self.total_eventos,
            "primer_evento_roto": self.primer_evento_roto,
            "tipo_problema": self.tipo_problema,
            "detalle": self.detalle,
            "problemas": self.problemas,
        }


def verificar_cadena(tenant_id: str, eventos: list[EventoFAT]) -> IntegrityResult:
    """
    Verifica la cadena cronológica de `eventos` de un tenant.

    Función PURA sobre la lista de eventos (ya ordenada cronológicamente por el
    store). No toca la red: el caller le pasa los eventos de ambos almacenes
    entrelazados por timestamp.
    """
    problemas: list[dict[str, str]] = []
    primer_roto: str | None = None
    tipo_primer: str | None = None
    detalle_primer = ""

    hash_previo_esperado = GENESIS_HASH
    for idx, ev in enumerate(eventos):
        # 1. Linkage: el puntero al anterior debe coincidir con el hash previo real.
        if ev.hash_evento_anterior != hash_previo_esperado:
            problema = {
                "evento_id": ev.evento_id,
                "tipo": "hueco",
                "detalle": (
                    f"hash_evento_anterior={ev.hash_evento_anterior!r} no coincide "
                    f"con el hash del evento previo ({hash_previo_esperado!r}). "
                    f"Posible evento eliminado o reordenado en posición {idx}."
                ),
            }
            problemas.append(problema)
            if primer_roto is None:
                primer_roto, tipo_primer, detalle_primer = (
                    ev.evento_id,
                    "hueco",
                    problema["detalle"],
                )

        # 2. Tamper: el hash almacenado debe coincidir con el recalculado.
        if not ev.hash_valido():
            problema = {
                "evento_id": ev.evento_id,
                "tipo": "alteracion",
                "detalle": (
                    f"hash_evento almacenado ({ev.hash_evento[:16]}…) no coincide "
                    f"con el recalculado ({ev.recompute_hash()[:16]}…). "
                    f"Campos del evento alterados."
                ),
            }
            problemas.append(problema)
            if primer_roto is None:
                primer_roto, tipo_primer, detalle_primer = (
                    ev.evento_id,
                    "alteracion",
                    problema["detalle"],
                )

        # El siguiente eslabón debe apuntar al hash ALMACENADO de este evento
        # (así, si este fue alterado, el siguiente delata el hueco también).
        hash_previo_esperado = ev.hash_evento

    integra = not problemas
    return IntegrityResult(
        tenant_id=tenant_id,
        integra=integra,
        total_eventos=len(eventos),
        primer_evento_roto=primer_roto,
        tipo_problema=tipo_primer,
        detalle=detalle_primer or ("Cadena íntegra." if integra else ""),
        problemas=problemas,
    )


def verificar_tenant(fat: FATExtendido, tenant_id: str) -> IntegrityResult:
    """Verifica la cadena de un tenant leyendo sus eventos del store del FAT."""
    return verificar_cadena(tenant_id, fat.eventos(tenant_id))


# ── CLI / smoke para CI ──────────────────────────────────────────────────────


def _construir_dataset_sintetico() -> FATExtendido:
    """
    Construye una cadena sintética determinista (sin red) para el smoke de CI.
    10 eventos de un tenant, variando familias activas.
    """
    fat = FATExtendido(InMemoryFATStore())
    tenant = "ci-synthetic-tenant"
    familias = [
        FamiliaFAT.F4_CONSULTA,
        FamiliaFAT.F7_GOBERNANZA,
        FamiliaFAT.F9_SISTEMA,
        FamiliaFAT.F6_ALERTAS,
        FamiliaFAT.F5_TROUBLESHOOTING,
    ]
    for i in range(10):
        familia = familias[i % len(familias)]
        fat.registrar(
            tipo_evento=f"{familia.value}.evento_{i}",
            familia=familia,
            tenant_id=tenant,
            actor_tipo="sistema",
            actor_id="ci",
            payload={"i": i, "estado_set": {"contador": i}},
            evento_id=f"ci-evt-{i:02d}",
            timestamp=f"2026-06-02T10:{i:02d}:00+00:00",
        )
    return fat


def main(argv: list[str] | None = None) -> int:
    """Smoke de CI: verifica una cadena sintética íntegra. exit 0 si OK."""
    fat = _construir_dataset_sintetico()
    tenant = "ci-synthetic-tenant"
    resultado = verificar_tenant(fat, tenant)
    print(
        f"[FAT integrity] tenant={tenant} eventos={resultado.total_eventos} "
        f"integra={resultado.integra}"
    )
    if not resultado.integra:
        print(f"[FAT integrity] ROTO: {resultado.tipo_problema} en "
              f"{resultado.primer_evento_roto}: {resultado.detalle}")
        return 1

    # Verificación negativa: simular intrusión y confirmar que se detecta.
    eventos = fat.eventos(tenant)
    alterado = EventoFAT.from_dict({**eventos[5].to_dict(), "payload": {"i": 999}})
    eventos_intrusion = eventos[:5] + [alterado] + eventos[6:]
    res_roto = verificar_cadena(tenant, eventos_intrusion)
    if res_roto.integra:
        print("[FAT integrity] FALLO: el verificador NO detectó la intrusión simulada.")
        return 2

    print(
        f"[FAT integrity] intrusión simulada detectada en "
        f"{res_roto.primer_evento_roto} ({res_roto.tipo_problema}). OK."
    )
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main(sys.argv[1:]))
