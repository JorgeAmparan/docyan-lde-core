"""
Ciclo de vida común de un `:EventoDirigido` (Adenda ED §1.1).

DOCYAN LDE™ by XCID.

Máquina de estados compartida por `:Alerta` (ahora) y `:Solicitud` (ED-2):

    creado → notificado → leido → reconocido → en_proceso → resuelto | escalado | cancelado

Regla dura: una transición NO declarada es un error (`TransicionInvalida`), nunca un
cambio silencioso. Cada transición aplicada por una acción de usuario o por el motor
registra un evento FAT (familia F10, ver `app.eventos_dirigidos.fat`).

Las **acciones** (`AccionSobreAlerta`, doc 01) mapean 1-a-1 a esta máquina:

| acción            | estado destino | notas                                            |
|-------------------|----------------|--------------------------------------------------|
| `reconocer`       | reconocido     |                                                  |
| `iniciar_proceso` | en_proceso     |                                                  |
| `escalar`         | escalado       | también la dispara la regla de escalación auto.  |
| `resolver`        | resuelto       | terminal                                         |
| `suprimir`        | cancelado      | terminal (descartar sin resolver)                |
| `postponer`       | (sin cambio)   | **justificación obligatoria**; registra FAT      |
| `comentar`        | (sin cambio)   | anota; registra FAT                              |

`postponer`/`comentar` son acciones que NO mueven el estado pero SÍ se registran
(auditoría completa): son transiciones "self" válidas solo si el evento no está en
estado terminal.
"""
from __future__ import annotations

from dataclasses import dataclass

# ── Estados del ciclo de vida común ───────────────────────────────────────────
CREADO = "creado"
NOTIFICADO = "notificado"
LEIDO = "leido"
RECONOCIDO = "reconocido"
EN_PROCESO = "en_proceso"
RESUELTO = "resuelto"
ESCALADO = "escalado"
CANCELADO = "cancelado"

ESTADOS: frozenset[str] = frozenset(
    {CREADO, NOTIFICADO, LEIDO, RECONOCIDO, EN_PROCESO, RESUELTO, ESCALADO, CANCELADO}
)

#: Estados terminales: no admiten más transiciones (ni acciones self).
ESTADOS_TERMINALES: frozenset[str] = frozenset({RESUELTO, CANCELADO})

#: Transiciones válidas explícitas. Cualquier par (origen → destino) ausente aquí
#: es inválido por construcción.
TRANSICIONES: dict[str, frozenset[str]] = {
    # Desde `creado` un admin puede reconocer/escalar/cancelar aunque la entrega aún
    # no haya movido la alerta a `notificado` (p. ej. alerta manual sin destinatarios).
    # `iniciar_proceso`/`resolver` siguen exigiendo pasar por reconocido primero.
    CREADO: frozenset({NOTIFICADO, RECONOCIDO, ESCALADO, CANCELADO}),
    NOTIFICADO: frozenset({LEIDO, RECONOCIDO, EN_PROCESO, ESCALADO, RESUELTO, CANCELADO}),
    LEIDO: frozenset({RECONOCIDO, EN_PROCESO, ESCALADO, RESUELTO, CANCELADO}),
    RECONOCIDO: frozenset({EN_PROCESO, ESCALADO, RESUELTO, CANCELADO}),
    EN_PROCESO: frozenset({RESUELTO, ESCALADO, CANCELADO}),
    ESCALADO: frozenset({RECONOCIDO, EN_PROCESO, RESUELTO, CANCELADO}),
    RESUELTO: frozenset(),
    CANCELADO: frozenset(),
}


class TransicionInvalida(ValueError):
    """Transición de ciclo de vida no permitida. Error explícito, nunca silencio."""


class AccionDesconocida(ValueError):
    """Acción no reconocida sobre un evento dirigido."""


class JustificacionRequerida(ValueError):
    """La acción exige justificación y no se proporcionó (ej. `postponer`)."""


def es_terminal(estado: str) -> bool:
    return estado in ESTADOS_TERMINALES


def transicion_valida(origen: str, destino: str) -> bool:
    """True si `origen → destino` es una transición declarada."""
    if origen not in ESTADOS or destino not in ESTADOS:
        return False
    return destino in TRANSICIONES.get(origen, frozenset())


def validar_transicion(origen: str, destino: str) -> None:
    """Lanza `TransicionInvalida` si el par no es válido."""
    if origen not in ESTADOS:
        raise TransicionInvalida(f"estado de origen desconocido: {origen!r}")
    if destino not in ESTADOS:
        raise TransicionInvalida(f"estado de destino desconocido: {destino!r}")
    if not transicion_valida(origen, destino):
        raise TransicionInvalida(
            f"transición no permitida: {origen} → {destino} "
            f"(válidas desde {origen}: {sorted(TRANSICIONES.get(origen, []))})"
        )


@dataclass(frozen=True)
class Accion:
    """Definición de una acción sobre un evento dirigido."""

    nombre: str
    #: Estado destino de la transición, o None si la acción no mueve el estado.
    destino: str | None
    requiere_justificacion: bool = False


#: Catálogo cerrado de acciones (doc 01 §AccionSobreAlerta).
ACCIONES: dict[str, Accion] = {
    "reconocer": Accion("reconocer", RECONOCIDO),
    "iniciar_proceso": Accion("iniciar_proceso", EN_PROCESO),
    "escalar": Accion("escalar", ESCALADO),
    "resolver": Accion("resolver", RESUELTO),
    "suprimir": Accion("suprimir", CANCELADO),
    "postponer": Accion("postponer", None, requiere_justificacion=True),
    "comentar": Accion("comentar", None),
}

NOMBRES_ACCIONES: tuple[str, ...] = tuple(ACCIONES.keys())


def resolver_accion(nombre: str) -> Accion:
    accion = ACCIONES.get(nombre)
    if accion is None:
        raise AccionDesconocida(
            f"acción desconocida: {nombre!r} (válidas: {', '.join(NOMBRES_ACCIONES)})"
        )
    return accion


def aplicar_accion(estado_actual: str, nombre_accion: str, *, justificacion: str | None = None) -> str:
    """
    Calcula el estado resultante de aplicar una acción sobre `estado_actual`.

    Valida: acción conocida, justificación si la acción la exige, y que la
    transición asociada sea válida (o, para acciones "self", que el evento no esté
    terminal). Devuelve el nuevo estado (== actual para `postponer`/`comentar`).

    No persiste nada: la persistencia + el registro FAT los hace el llamador
    (`app.alerts.acciones`), que es quien conoce el store.
    """
    accion = resolver_accion(nombre_accion)

    if accion.requiere_justificacion and not (justificacion or "").strip():
        raise JustificacionRequerida(
            f"la acción '{accion.nombre}' requiere justificación."
        )

    if accion.destino is None:
        # Acción self (postponer / comentar): permitida solo si no es terminal.
        if es_terminal(estado_actual):
            raise TransicionInvalida(
                f"no se puede '{accion.nombre}' un evento en estado terminal "
                f"({estado_actual})."
            )
        return estado_actual

    validar_transicion(estado_actual, accion.destino)
    return accion.destino
