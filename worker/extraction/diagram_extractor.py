"""
Auto-extracción de diagramas: figuras + etiquetas con coordenadas (B9.5 §1.1 T3).

DOCYAN LDE™ by XCID — worker `docyan-lde-ingest`.

DOCYAN extrae automáticamente el diagrama: cada figura del documento se almacena
como asset servible y se le piden al LLM de VISIÓN las etiquetas/callouts con su
caja normalizada `{x,y,w,h}` (0..1) y la leyenda simbólica. El resultado se
materializa directo al grafo (sin revisión manual; el editor se retiró de B9.5).

Inyectables para test sin claves/stack:
  - `complete_vision(prompt, image_b64) -> str` (prod: worker.llm_config.complete_vision)
  - `put_asset(tenant_id, nombre, png_bytes) -> url` (prod: app.recursos.asset_store)
"""
from __future__ import annotations

import base64
import hashlib
import logging
from typing import Callable

from worker.extraction._json import parse_llm_json
from worker.extraction.docling_figures import FiguraExtraida
from worker.extraction.models import DraftDiagrama, EtiquetaBorrador, LeyendaBorrador

logger = logging.getLogger("docyan.worker.extraccion.diagrama")

_PROMPT = """Eres un extractor de diagramas técnicos. Observa la figura y detecta \
las ETIQUETAS/callouts que rotulan sus partes (números o textos con líneas guía) y \
la LEYENDA simbólica si existe.

Devuelve EXCLUSIVAMENTE un JSON (sin texto adicional):
{
  "titulo": "string — título del diagrama",
  "etiquetas": [
    {"texto": "Tapa del rotor", "x": 0.33, "y": 0.26, "w": 0.10, "h": 0.06}
  ],
  "leyenda_simbolica": [{"simbolo": "⚠", "significado": "Punto caliente"}]
}

Reglas:
- Las coordenadas x,y,w,h están NORMALIZADAS (0..1): x,y = esquina superior \
izquierda de la caja del rótulo; w,h = ancho y alto. Sé preciso con la posición.
- "texto" es el rótulo legible de la parte señalada.
- Si la figura NO es un diagrama con rótulos (p. ej. una foto sin callouts), \
devuelve {"titulo": "", "etiquetas": [], "leyenda_simbolica": []}.
- Responde en español, conservando términos técnicos."""


def extraer_diagramas(
    tenant_id: str,
    figuras: list[FiguraExtraida],
    *,
    complete_vision: Callable[[str, str], str] | None = None,
    put_asset: Callable[[str, str, bytes], str] | None = None,
    storage_ok: Callable[[], bool] | None = None,
    hashes_previos: dict[str, DraftDiagrama] | None = None,
) -> tuple[list[DraftDiagrama], dict]:
    """
    Porta CADA figura con imagen usable como recurso renderable (ED-0c).

    Cambio de contrato (ED-0c): se guarda el PNG de TODA figura y se devuelve un
    `DraftDiagrama` con su `recurso_url` **tenga o no callouts**. La visión de Gemini
    ENRIQUECE con etiquetas/leyenda donde las detecta, pero su ausencia YA NO descarta
    el dibujo (antes las fotos/planos sin rótulos se perdían por completo — el bug de
    fidelidad que rompía la promesa en manuales técnicos). Sin tope de figuras por
    default (el gate de costo es el cotizador + confirmación, no un tope ciego).

    Best-effort: nunca lanza. Si el almacén de assets no está disponible NO se porta
    nada (no se puede servir la imagen) y se reporta en la fidelidad.

    Devuelve `(drafts, fidelidad)`:
      · drafts: recursos renderables (con `recurso_url`; etiquetas opcionales).
      · fidelidad: contadores del QA de ingesta — `procesadas`, `portadas`,
        `con_callouts`, `sin_imagen_utilizable`, `store_fallo`, `vision_fallo`,
        `omitidas_por_tope`. Base para verificar detectadas-vs-portadas.
    """
    fidelidad = {
        "procesadas": 0, "portadas": 0, "con_callouts": 0,
        "sin_imagen_utilizable": 0, "store_fallo": 0, "vision_fallo": 0,
        "omitidas_por_tope": 0, "figuras_deduplicadas": 0,
    }
    if not figuras:
        return [], fidelidad

    # Tope de EMERGENCIA solo si se configuró `MAX_FIGURAS_POR_DOCUMENTO`>0 (default
    # ED-0c = 0 = sin tope → se portan TODAS). No se descartan dibujos por default.
    from app.ingesta.pricing_table import figuras_a_procesar

    total = len(figuras)
    n_proc = figuras_a_procesar(total)
    if n_proc < total:
        fidelidad["omitidas_por_tope"] = total - n_proc
        logger.warning(
            "tope de emergencia MAX_FIGURAS activo: se procesan %d de %d figuras "
            "(top-N por tamaño); %d omitidas", n_proc, total, total - n_proc,
        )
        figuras = sorted(figuras, key=lambda f: len(f.png_bytes or b""), reverse=True)[:n_proc]
    fidelidad["procesadas"] = len(figuras)

    # Sin almacén servible no se puede renderizar la imagen → no se porta nada.
    usa_store_default = put_asset is None
    if storage_ok is None:
        if usa_store_default:
            from app.recursos.asset_store import almacenamiento_disponible as storage_ok
        else:
            storage_ok = lambda: True  # noqa: E731 — store inyectado ⇒ disponible
    if not storage_ok():
        logger.warning(
            "almacenamiento de assets no disponible (bucket %s); NO se portan %d "
            "figura(s) (no se pueden servir para renderizar)", "docyan-assets", len(figuras),
        )
        fidelidad["store_fallo"] = len(figuras)
        return [], fidelidad

    if complete_vision is None:
        from worker import llm_config

        complete_vision = llm_config.complete_vision
    if put_asset is None:
        from app.recursos.asset_store import put_asset as _put

        put_asset = _put

    # ED-0c §5bis — dedup por hash SHA-256 del PNG. `vistos` arranca con los hashes
    # ya presentes en el tenant (`hashes_previos`, cross-documento) para no re-almacenar
    # ni re-visionar una figura idéntica ya portada en otra ingesta del mismo tenant.
    vistos: dict[str, DraftDiagrama] = dict(hashes_previos or {})

    drafts: list[DraftDiagrama] = []
    for i, fig in enumerate(figuras):
        if not fig.png_bytes:
            fidelidad["sin_imagen_utilizable"] += 1
            continue

        h = hashlib.sha256(fig.png_bytes).hexdigest()

        # §5bis DEDUP: figura idéntica ya portada (esta ingesta o previa del tenant)
        # → NO se re-almacena ni se re-visiona; se REFERENCIA el mismo recurso desde
        # esta nueva aparición (preserva "aparece aquí también"). Cuenta como portada.
        prev = vistos.get(h)
        if prev is not None and prev.recurso_url:
            fidelidad["figuras_deduplicadas"] += 1
            fidelidad["portadas"] += 1
            drafts.append(
                DraftDiagrama(
                    titulo=prev.titulo,
                    recurso_url=prev.recurso_url,
                    hash_imagen=h,
                    etiquetas=list(prev.etiquetas),
                    leyenda_simbolica=list(prev.leyenda_simbolica),
                )
            )
            continue

        # 1) GUARDAR la imagen SIEMPRE (renderable), ANTES de la visión: el dibujo se
        #    conserva aunque no tenga callouts o la visión falle. Una vez por hash.
        try:
            url = put_asset(tenant_id, f"figura_{h[:16]}.png", fig.png_bytes)
        except Exception as exc:  # noqa: BLE001
            logger.warning("no se pudo almacenar la figura %d: %s", i, type(exc).__name__)
            fidelidad["store_fallo"] += 1
            continue  # sin url no se puede renderizar

        # 2) VISIÓN opcional — enriquece con callouts/leyenda donde existan. Su fallo
        #    o ausencia NO descarta la figura (se porta la imagen sin rótulos).
        titulo = fig.titulo or f"Figura {i + 1}"
        etiquetas: list[EtiquetaBorrador] = []
        leyenda: list[LeyendaBorrador] = []
        try:
            b64 = base64.b64encode(fig.png_bytes).decode("ascii")
            data = parse_llm_json(complete_vision(_PROMPT, b64))
            if isinstance(data, dict):
                titulo = data.get("titulo") or titulo
                etiquetas = [
                    EtiquetaBorrador(
                        texto=str(e.get("texto", "")),
                        x=float(e.get("x") or 0.0),
                        y=float(e.get("y") or 0.0),
                        w=_opt_float(e.get("w")),
                        h=_opt_float(e.get("h")),
                    )
                    for e in (data.get("etiquetas") or [])
                    if isinstance(e, dict) and e.get("texto")
                ]
                leyenda = [
                    LeyendaBorrador(
                        simbolo=str(s.get("simbolo", "")),
                        significado=str(s.get("significado", "")),
                    )
                    for s in (data.get("leyenda_simbolica") or [])
                    if isinstance(s, dict) and s.get("simbolo")
                ]
        except Exception as exc:  # noqa: BLE001 — la visión enriquece, no es gate
            logger.warning(
                "visión falló en figura %d (se porta la imagen sin callouts): %s",
                i, type(exc).__name__,
            )
            fidelidad["vision_fallo"] += 1

        if etiquetas:
            fidelidad["con_callouts"] += 1
        fidelidad["portadas"] += 1
        nuevo = DraftDiagrama(
            titulo=titulo,
            recurso_url=url,
            hash_imagen=h,
            etiquetas=etiquetas,
            leyenda_simbolica=leyenda,
        )
        vistos[h] = nuevo  # §5bis: la próxima figura idéntica se deduplica
        drafts.append(nuevo)
    return drafts, fidelidad


def _opt_float(v) -> float | None:
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None
