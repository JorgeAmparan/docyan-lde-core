"""Tests del Channel Adapter del MO (B4 §7, responsabilidad 7)."""
from app.orchestrator.channel_adapter import ChannelAdapter
from app.orchestrator.models import Canal

CONTENIDO = {
    "titulo": "Extintor PQS-5",
    "secciones": [
        {"titulo": "Vencimiento", "cuerpo": "La recarga vence el 2026-09-01."},
        {"titulo": "Ubicación", "cuerpo": "Pasillo B, columna 3."},
    ],
    "anotaciones": ["Revisado por mantenimiento el 2026-05-01."],
    "qr_links": [{"label": "Ficha", "url": "https://docyan-lde-api.fly.dev/qr/abc.def"}],
}


def test_pwa_conserva_estructura_rica():
    out = ChannelAdapter().adapt(CONTENIDO, Canal.pwa)
    assert out["formato"] == "rich"
    assert out["titulo"] == "Extintor PQS-5"
    assert len(out["secciones"]) == 2
    assert out["anotaciones"]
    assert out["qr_links"]


def test_whatsapp_degrada_pero_preserva_sustancia():
    out = ChannelAdapter().adapt(CONTENIDO, Canal.whatsapp)
    assert out["formato"] == "plain_text"
    texto = out["texto"]
    # La sustancia (cuerpos de las secciones) NO se pierde.
    assert "La recarga vence el 2026-09-01." in texto
    assert "Pasillo B, columna 3." in texto
    # El título y los títulos de sección están presentes.
    assert "Extintor PQS-5" in texto
    assert "Vencimiento" in texto
    # La anotación y el QR degradado a URL plana siguen ahí.
    assert "Revisado por mantenimiento el 2026-05-01." in texto
    assert "https://docyan-lde-api.fly.dev/qr/abc.def" in texto


def test_misma_fuente_dos_canales_misma_sustancia():
    rich = ChannelAdapter().adapt(CONTENIDO, Canal.pwa)
    plain = ChannelAdapter().adapt(CONTENIDO, Canal.whatsapp)
    for sec in rich["secciones"]:
        assert sec["cuerpo"] in plain["texto"]
