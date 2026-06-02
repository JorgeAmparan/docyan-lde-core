"""Tests de variante regional y fallback del MO (B4 §6, responsabilidad 6)."""
from app.orchestrator.localization import VariantResolver


def test_jerarquia_usuario_gana():
    vr = VariantResolver()
    assert vr.resolve_variant(usuario="es-MX", cliente="es-ES", default="es") == "es-MX"


def test_jerarquia_cae_a_cliente():
    vr = VariantResolver()
    assert vr.resolve_variant(usuario=None, cliente="es-ES", default="es") == "es-ES"


def test_jerarquia_cae_a_neutro():
    vr = VariantResolver()
    assert vr.resolve_variant() == "neutro"


def test_orden_jerarquia_sin_duplicados():
    vr = VariantResolver()
    assert vr.jerarquia(usuario="es-MX", cliente="es-MX", default="es") == ["es-MX", "es", "neutro"]


def test_resolve_segment_usa_primera_variante_disponible():
    vr = VariantResolver()
    variantes = {
        "es-MX": {"saludo": "qué onda"},
        "es": {"saludo": "hola", "despedida": "adiós"},
        "neutro": {"saludo": "hola", "despedida": "adiós", "ayuda": "soporte"},
    }
    # 'saludo' existe en es-MX → gana es-MX.
    val, region = vr.resolve_segment("saludo", variantes, usuario="es-MX", default="es")
    assert (val, region) == ("qué onda", "es-MX")


def test_resolve_segment_fallback_baja_jerarquia():
    vr = VariantResolver()
    variantes = {
        "es-MX": {"saludo": "qué onda"},
        "es": {"despedida": "adiós"},
        "neutro": {"ayuda": "soporte"},
    }
    # 'despedida' no está en es-MX → baja a 'es'.
    val, region = vr.resolve_segment("despedida", variantes, usuario="es-MX", default="es")
    assert (val, region) == ("adiós", "es")
    # 'ayuda' solo en neutro.
    val2, region2 = vr.resolve_segment("ayuda", variantes, usuario="es-MX", default="es")
    assert (val2, region2) == ("soporte", "neutro")


def test_resolve_segment_inexistente():
    vr = VariantResolver()
    val, region = vr.resolve_segment("nada", {"neutro": {}}, usuario="es-MX")
    assert val is None and region is None
