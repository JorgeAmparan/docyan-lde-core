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


def almacenamiento_disponible(*, client: Any = None) -> bool:
    """
    ¿Se puede GUARDAR un asset ahora? Corto-circuito de costo (decisión Jorge
    15-jun-2026): si el almacén no está disponible (p. ej. el bucket `docyan-assets`
    no existe), NO se debe llamar a la visión por figura — no se paga un resultado
    que no se puede guardar. Local (`DOCYAN_ASSET_DIR`) siempre disponible; Supabase:
    el bucket debe existir. Ante CUALQUIER duda → False (no gastar). Best-effort,
    una sola llamada barata (lista de buckets).
    """
    if os.getenv("DOCYAN_ASSET_DIR"):
        return True
    try:
        if client is None:
            from supabase import create_client

            from app.core.supabase_client import require_supabase_config

            url, key = require_supabase_config("asset_store", service=True)
            client = create_client(url, key)
        buckets = client.storage.list_buckets() or []
        nombres = {
            (getattr(b, "name", None) or (b.get("name") if isinstance(b, dict) else None))
            for b in buckets
        }
        return ASSET_BUCKET in nombres
    except Exception:  # noqa: BLE001 — ante la duda, NO gastar visión
        return False


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
