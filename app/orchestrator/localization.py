"""
Localización y variante regional del MO (B4 §1 responsabilidad 6).

DOCYAN LDE™ by XCID.

Aplica la jerarquía de variante regional: usuario > cliente > default > neutro.
Si el segmento solicitado no existe en la variante elegida, hace fallback
automático bajando por la jerarquía hasta encontrarlo (o al neutro).
"""
from __future__ import annotations

NEUTRO = "neutro"


class VariantResolver:
    """Resuelve la variante regional efectiva y hace fallback por segmento."""

    def resolve_variant(
        self,
        usuario: str | None = None,
        cliente: str | None = None,
        default: str | None = None,
        neutro: str = NEUTRO,
    ) -> str:
        """Primera variante no nula en la jerarquía usuario>cliente>default>neutro."""
        for candidato in (usuario, cliente, default, neutro):
            if candidato:
                return candidato
        return neutro

    def jerarquia(
        self,
        usuario: str | None = None,
        cliente: str | None = None,
        default: str | None = None,
        neutro: str = NEUTRO,
    ) -> list[str]:
        """Orden de búsqueda de fallback, sin duplicados, preservando prioridad."""
        orden: list[str] = []
        for v in (usuario, cliente, default, neutro):
            if v and v not in orden:
                orden.append(v)
        if neutro not in orden:
            orden.append(neutro)
        return orden

    def resolve_segment(
        self,
        segmento: str,
        variantes_por_region: dict[str, dict[str, str]],
        usuario: str | None = None,
        cliente: str | None = None,
        default: str | None = None,
        neutro: str = NEUTRO,
    ) -> tuple[str | None, str | None]:
        """
        Devuelve (valor_del_segmento, region_efectiva). Recorre la jerarquía y
        devuelve el primer valor disponible para `segmento`. Si ninguna variante
        lo tiene, devuelve (None, None).
        """
        for region in self.jerarquia(usuario, cliente, default, neutro):
            variante = variantes_por_region.get(region) or {}
            if segmento in variante:
                return variante[segmento], region
        return None, None
