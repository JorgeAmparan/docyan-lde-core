"""
Modelos de la estructura extraída visual/decisional (B9.5).

DOCYAN LDE™ by XCID — worker `docyan-lde-ingest`.

Tipo 3 (diagramas) y Tipo 5 (árboles de troubleshooting) se AUTO-EXTRAEN del
documento (extracción del stack) y se materializan directo al grafo — sin revisión
manual. Estos modelos son la salida tipada del extractor que el materializador
escribe al DKG. (El editor de curación manual se retiró del alcance de B9.5: la
extracción del stack es de calidad suficiente; ver reporte de cierre.)

Pydantic v2 estricto.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class _Base(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ── Tipo 3 — Diagrama ─────────────────────────────────────────────────────────


class EtiquetaBorrador(_Base):
    """Etiqueta/callout sobre la imagen, con caja normalizada (0..1)."""

    texto: str
    x: float = 0.0
    y: float = 0.0
    w: float | None = None
    h: float | None = None


class LeyendaBorrador(_Base):
    simbolo: str
    significado: str


class DraftDiagrama(_Base):
    kind: Literal["diagrama"] = "diagrama"
    recurso_id: str | None = None
    titulo: str
    recurso_url: str | None = None  # asset de imagen (storage)
    etiquetas: list[EtiquetaBorrador] = Field(default_factory=list)
    leyenda_simbolica: list[LeyendaBorrador] = Field(default_factory=list)


# ── Tipo 5 — Árbol de diagnóstico ─────────────────────────────────────────────


class OpcionBorrador(_Base):
    etiqueta: str  # texto de la opción ("Sí" / "No enciende" / …)
    siguiente_nodo_id: str | None = None


class NodoBorrador(_Base):
    id: str
    pregunta: str | None = None
    orden: int = 0
    opciones: list[OpcionBorrador] = Field(default_factory=list)
    causa_probable: str | None = None
    accion_resolutoria: str | None = None


class DraftArbol(_Base):
    kind: Literal["arbol"] = "arbol"
    arbol_id: str | None = None
    titulo: str
    nodos: list[NodoBorrador] = Field(default_factory=list)

    def validar_conectividad(self) -> list[str]:
        """
        Advertencias de conectividad (no rompe): referencias a nodos inexistentes,
        nodos huérfanos. Se loguean en la extracción.
        """
        ids = {n.id for n in self.nodos}
        warns: list[str] = []
        referidos: set[str] = set()
        for n in self.nodos:
            for o in n.opciones:
                if o.siguiente_nodo_id:
                    referidos.add(o.siguiente_nodo_id)
                    if o.siguiente_nodo_id not in ids:
                        warns.append(
                            f"nodo '{n.id}' apunta a '{o.siguiente_nodo_id}' inexistente"
                        )
        for n in sorted(self.nodos, key=lambda x: x.orden)[1:]:
            if n.id not in referidos:
                warns.append(f"nodo '{n.id}' es huérfano (nadie lo referencia)")
        return warns
