"""
Channel Adapter del MO (B4 §1 responsabilidad 7).

DOCYAN LDE™ by XCID.

Adapta una respuesta canónica del MO al canal de salida:

  - PWA: salida RICA — estructura completa, anotaciones, QR clickeables.
  - WhatsApp: salida DEGRADADA graceful — texto plano estructurado, SIN perder el
    contenido sustantivo. Es degradación de PRESENTACIÓN, no de sustancia.

El contenido canónico (lo que produce el pipeline) tiene la forma:

    {
      "titulo": str,
      "secciones": [{"titulo": str, "cuerpo": str}, ...],
      "anotaciones": [str, ...],     # opcional
      "qr_links": [{"label": str, "url": str}, ...],  # opcional
    }

El adaptador NUNCA descarta el cuerpo sustantivo de las secciones; en WhatsApp lo
serializa a texto. La extensión a un BSP real (360dialog) llega en B10.
"""
from __future__ import annotations

from app.orchestrator.models import Canal


class ChannelAdapter:
    """Convierte contenido canónico en la representación específica del canal."""

    def adapt(self, contenido: dict, canal: Canal) -> dict:
        if canal == Canal.whatsapp:
            return self._whatsapp(contenido)
        # PWA y API reciben la estructura rica completa.
        return self._rico(contenido)

    def _rico(self, contenido: dict) -> dict:
        return {
            "formato": "rich",
            "titulo": contenido.get("titulo"),
            "secciones": contenido.get("secciones", []),
            "anotaciones": contenido.get("anotaciones", []),
            "qr_links": contenido.get("qr_links", []),
        }

    def _whatsapp(self, contenido: dict) -> dict:
        """Aplana a texto plano estructurado preservando la sustancia."""
        lineas: list[str] = []
        titulo = contenido.get("titulo")
        if titulo:
            lineas.append(f"*{titulo}*")

        for sec in contenido.get("secciones", []):
            sec_titulo = sec.get("titulo")
            cuerpo = sec.get("cuerpo", "")
            if sec_titulo:
                lineas.append("")
                lineas.append(f"*{sec_titulo}*")
            if cuerpo:
                lineas.append(cuerpo)

        anotaciones = contenido.get("anotaciones", [])
        if anotaciones:
            lineas.append("")
            lineas.append("Notas:")
            for nota in anotaciones:
                lineas.append(f"- {nota}")

        # Los QR no son clickeables en texto: se degradan a URLs planas, no se pierden.
        qr_links = contenido.get("qr_links", [])
        if qr_links:
            lineas.append("")
            for link in qr_links:
                label = link.get("label", "Enlace")
                url = link.get("url", "")
                lineas.append(f"{label}: {url}")

        return {"formato": "plain_text", "texto": "\n".join(lineas).strip()}
