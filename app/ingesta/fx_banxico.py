"""
Tipo de cambio USD→MXN para la cotización de ingesta (decisión Jorge 12-jun-2026).

DOCYAN LDE™ by XCID.

ÚNICO punto del modelo comercial que usa FX EN VIVO (los precios de plan son tabla
fija, ver `frontend/src/lib/bands.ts`). Reglas cerradas:

  · Fuente:   Banxico FIX (SIE API oficial, serie SF43718).
  · Margen:   +3 % sobre el FIX.
  · Redondeo: hacia ARRIBA al múltiplo de $10 MXN.
  · Congelado: el FIX usado se devuelve con la cotización (frozen at quote time).

La cotización NUNCA debe romperse por el FX: si Banxico no responde (sin token, red
caída, API lenta), se cae a `BANXICO_FIX_FALLBACK` y se marca `fuente="fallback"`
para que la UI/el reporte sepan que no es el FIX del día. El FIX se cachea por día
(una llamada real/día como máximo).
"""
from __future__ import annotations

import logging
import math
import os
from dataclasses import dataclass
from datetime import date

logger = logging.getLogger(__name__)

# Serie SF43718 = "Tipo de cambio pesos por dólar E.U.A. (FIX)".
_BANXICO_SERIE = "SF43718"
_BANXICO_URL = (
    f"https://www.banxico.org.mx/SieAPIRest/service/v1/series/{_BANXICO_SERIE}/datos/oportuno"
)

MARGEN_FX = float(os.getenv("BANXICO_FX_MARGEN", "0.03"))
REDONDEO_MXN = int(os.getenv("BANXICO_REDONDEO_MXN", "10"))


def _fallback_fix() -> float:
    # Default conservador y REALISTA (USD≈MXN 17.2 al 15-jun-2026; se toma 17.5 para
    # no subcotizar). Sólo aplica si falta `BANXICO_TOKEN` o la API falla — con token
    # rige el FIX vivo. NO usar 20.0 (sobrecotiza ~16 %).
    return float(os.getenv("BANXICO_FIX_FALLBACK", "17.5"))


@dataclass(frozen=True)
class FixQuote:
    """FIX del día (o fallback). `fuente` = "banxico" | "fallback"."""

    fix: float
    fecha: str
    fuente: str


# Caché por día (clave = fecha ISO). Una llamada real/día como máximo.
_cache: dict[str, FixQuote] = {}


def _hoy() -> str:
    return date.today().isoformat()


def _consultar_banxico(token: str) -> FixQuote | None:
    """Una llamada a la SIE API. None si falla (red/credencial/formato)."""
    try:
        import httpx

        r = httpx.get(_BANXICO_URL, headers={"Bmx-Token": token}, timeout=4.0)
        r.raise_for_status()
        serie = r.json()["bmx"]["series"][0]["datos"][0]
        # `dato` viene como string con coma de miles en algunos locales ("19.85").
        fix = float(str(serie["dato"]).replace(",", ""))
        fecha = str(serie["fecha"])  # dd/mm/aaaa según Banxico
        if fix <= 0:
            return None
        return FixQuote(fix=fix, fecha=fecha, fuente="banxico")
    except Exception as exc:  # noqa: BLE001 — cualquier fallo cae al fallback
        logger.warning("Banxico FIX no disponible (%s) → fallback", type(exc).__name__)
        return None


def obtener_fix() -> FixQuote:
    """FIX del día, cacheado. Sin token o ante fallo → fallback configurable."""
    hoy = _hoy()
    cached = _cache.get(hoy)
    if cached is not None:
        return cached

    token = os.getenv("BANXICO_TOKEN", "").strip()
    quote = _consultar_banxico(token) if token else None
    if quote is None:
        quote = FixQuote(fix=_fallback_fix(), fecha=hoy, fuente="fallback")
    _cache[hoy] = quote
    return quote


def _ceil_a_multiplo(x: float, multiplo: int) -> int:
    """Redondea hacia ARRIBA al múltiplo dado (decisión: $10 MXN)."""
    return int(math.ceil(x / multiplo) * multiplo)


@dataclass(frozen=True)
class ConversionMXN:
    mxn: int
    usd: float
    fix: float
    margen: float
    fecha: str
    fuente: str


def convertir_usd_a_mxn(usd: float, *, fix: FixQuote | None = None) -> ConversionMXN:
    """
    USD → MXN para mostrar en la tarjeta de cotización (Banda A):
        mxn = ceil_10( usd × FIX × (1 + margen) )

    `fix` permite inyectar un FIX ya congelado (tests / re-uso dentro de una misma
    cotización). Si se omite, toma el FIX del día (cacheado).
    """
    q = fix or obtener_fix()
    bruto = usd * q.fix * (1.0 + MARGEN_FX)
    mxn = _ceil_a_multiplo(bruto, REDONDEO_MXN)
    return ConversionMXN(
        mxn=mxn, usd=round(usd, 6), fix=q.fix, margen=MARGEN_FX,
        fecha=q.fecha, fuente=q.fuente,
    )
