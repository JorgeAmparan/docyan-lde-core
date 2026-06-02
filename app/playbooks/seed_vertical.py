"""
Playbooks precargados por vertical (B8 §B4; refinado en B13).

DOCYAN LDE™ by XCID.

B8 expone la MECÁNICA de seed y trae el CONTENIDO INICIAL de los 3 verticales del
mercado alfa (laboratorio, maquiladora, agencia) en
`data/playbooks_precargados/<vertical>.json` (2-3 Playbooks por vertical). B13 lo
refina y amplía en onboarding con el conocimiento curado por Jorge.
`seed_for_vertical(tenant_id, vertical)` carga la librería de plantillas; cada
plantilla define las consultas guardadas (precargadas) y el orden del Playbook, y
se materializa como Nivel A + Nivel B con `tipo_creacion='precargado_vertical'`.
"""
from __future__ import annotations

import json
import pathlib

from app.playbooks.consultas_guardadas import ConsultasGuardadasService
from app.playbooks.models import PlaybookStore, TipoCreacionPlaybook
from app.playbooks.playbooks_core import PlaybooksService

# Directorio de la librería de plantillas (se llena en B13).
DATA_DIR = pathlib.Path(__file__).resolve().parent.parent.parent / "data" / "playbooks_precargados"


def _cargar_plantillas(vertical: str, data_dir: pathlib.Path | None = None) -> list[dict]:
    base = data_dir or DATA_DIR
    archivo = base / f"{vertical}.json"
    if not archivo.exists():
        return []
    contenido = json.loads(archivo.read_text(encoding="utf-8"))
    # El archivo es una lista de plantillas de Playbook.
    return contenido if isinstance(contenido, list) else contenido.get("playbooks", [])


def seed_for_vertical(
    tenant_id: str,
    vertical: str,
    store: PlaybookStore,
    user_id: str = "system",
    data_dir: pathlib.Path | None = None,
) -> list[dict]:
    """
    Siembra los Playbooks precargados del `vertical` en el tenant. Devuelve la
    lista de Playbooks creados (vacía en B8: aún no hay librería de contenido).

    Formato de cada plantilla:
        {
          "nombre": "...", "descripcion": "...",
          "pasos": [
            {"nombre": "...", "consulta_original": "...",
             "tipo_intencion": "INFORMATIVA", "entidad_referenciada_id": null,
             "tipo_documento_origen": null, "nota_paso": "..."}
          ]
        }
    """
    plantillas = _cargar_plantillas(vertical, data_dir)
    consultas_svc = ConsultasGuardadasService(store)
    playbooks_svc = PlaybooksService(store)

    creados: list[dict] = []
    for tpl in plantillas:
        pasos_pb: list[dict] = []
        for i, paso in enumerate(tpl.get("pasos", [])):
            consulta = consultas_svc.guardar(
                tenant_id=tenant_id,
                user_id=user_id,
                nombre=paso.get("nombre") or f"{tpl.get('nombre', 'Paso')} {i + 1}",
                consulta_original=paso["consulta_original"],
                tipo_intencion=paso.get("tipo_intencion", "INFORMATIVA"),
                tipo_documento_origen=paso.get("tipo_documento_origen"),
                entidad_referenciada_id=paso.get("entidad_referenciada_id"),
                metadata={"precargado_vertical": vertical},
            )
            pasos_pb.append(
                {"consulta_guardada_id": consulta["id"], "orden": i + 1,
                 "nota_paso": paso.get("nota_paso")}
            )
        playbook = playbooks_svc.crear(
            tenant_id=tenant_id,
            user_id=user_id,
            nombre=tpl.get("nombre", f"Playbook {vertical}"),
            descripcion=tpl.get("descripcion"),
            pasos=pasos_pb,
            tipo_creacion=TipoCreacionPlaybook.precargado_vertical.value,
            vertical=vertical,
        )
        creados.append(playbook)
    return creados
