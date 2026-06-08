"""
Almacén de assets servibles (B9.5 §1.1 Tipo 3) — DOCYAN LDE™ by XCID.

Las figuras de diagramas extraídas necesitan una URL que el navegador pueda cargar
(el `recurso_url` del DiagramViewer). En producción se suben a un bucket PÚBLICO de
Supabase Storage y se devuelve su URL pública; en dev/tests se usa un store local
que devuelve una ruta de archivo.

PENDIENTE DE JORGE (ops): crear el bucket público `docyan-assets` en Supabase
Storage (lectura pública; los assets de figura no son sensibles — son recortes del
documento que el operador ya consulta). Sin el bucket, la subida falla y el
extractor degrada (el borrador queda sin `recurso_url`, las etiquetas igual se
curan; la imagen se re-asocia al confirmar).
"""
from __future__ import annotations

import os
import pathlib
import uuid
from typing import Any

ASSET_BUCKET = os.getenv("DOCYAN_ASSET_BUCKET", "docyan-assets")


def put_asset(tenant_id: str, nombre: str, data: bytes, *, client: Any = None) -> str:
    """
    Sube un asset y devuelve una URL servible. Supabase (público) en prod; local en
    dev/tests (`DOCYAN_ASSET_DIR`). Selección por entorno, como el document_store.
    """
    if os.getenv("DOCYAN_ASSET_DIR"):
        return _put_local(tenant_id, nombre, data)
    return _put_supabase(tenant_id, nombre, data, client=client)


def _put_local(tenant_id: str, nombre: str, data: bytes) -> str:
    base = pathlib.Path(os.getenv("DOCYAN_ASSET_DIR", "/tmp/docyan_assets"))
    key = f"{tenant_id}/{uuid.uuid4().hex}_{nombre}"
    dest = base / key
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return f"file://{dest}"


def _put_supabase(tenant_id: str, nombre: str, data: bytes, *, client: Any = None) -> str:
    if client is None:
        from supabase import create_client

        from app.core.supabase_client import require_supabase_config

        url, key = require_supabase_config("asset_store", service=True)
        client = create_client(url, key)
    storage_key = f"{tenant_id}/{uuid.uuid4().hex}_{nombre}"
    client.storage.from_(ASSET_BUCKET).upload(
        storage_key, data, {"content-type": "image/png", "upsert": "true"}
    )
    return client.storage.from_(ASSET_BUCKET).get_public_url(storage_key)
