# DOCYAN LDE™ — Fuentes de ingesta documental (Modo conectado, adenda 6.1).
#
# Repositorios documentales del cliente desde los que DOCYAN ingiere
# documentos. NO son conectores de datos transaccionales: la unidad de valor
# es el documento, no el registro.
#
# El CONTRATO HTTP del modo conectado vive en
# `app/api/routers/ingest_sources.py` (stub B0.5, tipado y testeado).
#
# Las implementaciones de cliente por fuente (Google Drive, OneDrive, FTP/SFTP,
# Notion) se reconstruyen sobre GraphRAG-SDK en B12 (Onboarding). La capa de
# implementación pre-GraphRAG fue ELIMINADA en B3.5: era código muerto
# (ninguna ruta activa la invocaba) construido sobre el DII deprecado
# (CLAUDE.md §4: "NO construir sobre él") y con imports rotos heredados del
# rename `app.connectors.*` → `app.integrations.*` de B0.5. No se revive; se
# rehace nativa al SDK cuando B12 lo requiera.
