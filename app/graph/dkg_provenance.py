"""
Bridge de procedencia + normalización del DKG (B9.5 §1.0).

DOCYAN LDE™ by XCID.

Cierra el *seam* escritura↔lectura: GraphRAG-SDK escribe entidades de dominio
(`:Especificacion`, `:Procedimiento`, `:Paso`, …) y su PROPIA procedencia
(`:Document` / `MENTIONED_IN`), pero los pipelines de lectura (B8, correctos y NO
tocados) esperan un nodo `:DocumentoSource` enlazado por `:CONTIENE`, más algunas
convenciones de propiedad/arista que el catálogo no produce tal cual.

Este módulo corre **al cerrar una ingesta exitosa** (worker, después de
`graphrag.ingest()`), sobre el MISMO grafo del tenant, y realiza las tres piezas
transversales del Sprint Contract:

  §1.0.1  Bridge `:DocumentoSource` + `:CONTIENE`  → desbloquea CITAS (T1, T2) y
          comparación por versión/hash (T8). Incluye `version`/`content_sha256`.
  §1.0.2  Enlace de entidades a `:EntidadOperativa` (la del QR) → scope por equipo
          en Historial (T6) y Comparativa entidades (T8).
  §1.0.3  Alineación de aristas/propiedades que la lectura espera:
            · `:CONTIENE_PASO` (Proc→Paso) ⇒ alias `:CONTIENE`
            · `Paso.orden` ⇐ `Paso.numero` (cuando falta `orden`)
            · `:EPP` del procedimiento colgado también de cada `:Paso`
            · `Especificacion.valor/.unidad` ⇐ `ParametroTecnico.valor_nominal`
              / `UnidadMedida.simbolo` (denormalización para T1)
            · `:CertificadoCalibracion` ⇒ etiqueta espejo `:CertificadoVigencia`
              + `timestamp` (para Historial T6)

Decisión de modelado (A): se ajusta la ESCRITURA, no la lectura. Todo lo de aquí
construye lo que los readers ya esperan; ningún pipeline de B8 se modifica.

Idempotente: todo es `MERGE`/`coalesce`; correr el bridge dos veces sobre el mismo
grafo no duplica ni corrompe (clave para reintentos del worker e ingestas
incrementales del SDK).
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("docyan.dkg.provenance")

# Etiquetas de contenido extraído que, de existir en el grafo, se enlazan al
# `:DocumentoSource` de su ingesta vía `:CONTIENE` (procedencia para citas). Es el
# universo de nodos "citables": entidades de dominio de los 8 tipos + auxiliares
# del catálogo. NO incluye `:Tenant`/`:EntidadOperativa`/`:CategoriaEntidad`
# (metadatos, no contenido del documento) ni el propio `:DocumentoSource`.
CONTENT_LABELS: tuple[str, ...] = (
    "Especificacion", "TerminoTecnico", "ParametroTecnico", "Tolerancia", "UnidadMedida",
    "Procedimiento", "Paso", "EPP", "Herramienta", "Advertencia",
    "RecursoVisual", "Etiqueta", "LeyendaSimbolica",
    "RecursoVideo", "Capitulo", "Subtitulo", "Transcripcion",
    "ArbolDiagnostico", "NodoDecision", "CausaProbable", "AccionResolutoria",
    "EventoOperativo", "CertificadoVigencia", "CertificadoCalibracion",
    "Observacion", "MedicionRegistrada", "FechaVencimiento",
    "Alerta", "Norma", "RequisitoNormativo",
    "Sustancia", "Riesgo", "MedidaProteccion", "EquipoProteccion", "NumeroCAS",
    "Producto", "CaracteristicaTecnica", "Modelo", "Fabricante", "Instrumento", "Tecnico",
)


def bridge_and_normalize(
    client: Any,
    tenant_id: str,
    *,
    doc_id: str,
    tipo_documento: str,
    nombre_archivo: str | None = None,
    content_sha256: str | None = None,
    version_documento: str | None = None,
    idioma_origen: str = "es",
    entidad_id: str | None = None,
) -> dict[str, int]:
    """
    Ejecuta el bridge de procedencia + la normalización sobre el grafo del tenant.

    `client` es un `DKGClient` (o cualquier objeto con `.query(tenant_id, cypher,
    params)`). `doc_id` es el `document_id` del SDK (SHA-256 del contenido) — la
    misma clave de idempotencia del worker, así re-ingestas no duplican el
    `:DocumentoSource`.

    Devuelve contadores de lo realizado (para logging/telemetría del worker).
    """
    counters: dict[str, int] = {}

    # ── §1.0.1 — Crear/asegurar el :DocumentoSource (procedencia para citas) ────
    # `version_documento` por defecto = los primeros 12 chars del hash (revisión
    # estable y comparable en T8 sin metadato externo).
    version = version_documento or (content_sha256[:12] if content_sha256 else doc_id[:12])
    client.query(
        tenant_id,
        """
        MERGE (d:DocumentoSource {id: $doc_id})
        SET d.tipo_documento = $tipo_documento,
            d.nombre_archivo = coalesce($nombre, d.nombre_archivo),
            d.hash_contenido = coalesce($sha, d.hash_contenido),
            d.version_documento = coalesce(d.version_documento, $version),
            d.idioma_origen = coalesce(d.idioma_origen, $idioma),
            d.fuente_ingesta = coalesce(d.fuente_ingesta, 'manual')
        """,
        {
            "doc_id": doc_id,
            "tipo_documento": tipo_documento,
            "nombre": nombre_archivo,
            "sha": content_sha256,
            "version": version,
            "idioma": idioma_origen,
        },
    )
    counters["documento_source"] = 1

    # ── §1.0.1 — Enlazar contenido extraído al :DocumentoSource vía :CONTIENE ────
    # Solo los nodos de contenido AÚN no enlazados a NINGÚN :DocumentoSource (no
    # re-pisar la procedencia de otra ingesta en grafos multi-documento). Es
    # idempotente y conservador: lo recién ingerido por el SDK no tiene todavía
    # arista de procedencia de dominio, así que cae aquí.
    enlazados = 0
    for label in CONTENT_LABELS:
        rows = client.query(
            tenant_id,
            f"""
            MATCH (d:DocumentoSource {{id: $doc_id}})
            MATCH (n:{label})
            WHERE NOT (:DocumentoSource)-[:CONTIENE]->(n)
            MERGE (d)-[:CONTIENE]->(n)
            RETURN count(n) AS c
            """,
            {"doc_id": doc_id},
        )
        enlazados += int((rows[0].get("c") if rows else 0) or 0)
    counters["contenido_enlazado"] = enlazados

    # ── §1.0.3 — Denormalizar valor/unidad sobre :Especificacion (Tipo 1) ───────
    # El reader lee `e.valor`/`e.unidad`; el catálogo los pone en
    # `:ParametroTecnico.valor_nominal` y `:UnidadMedida.simbolo`. Se copian al
    # `:Especificacion` sin perder el dato original (coalesce: no pisa si ya hay).
    client.query(
        tenant_id,
        """
        MATCH (e:Especificacion)-[:DEFINE_PARAMETRO]->(p:ParametroTecnico)
        OPTIONAL MATCH (p)-[:EXPRESADO_EN]->(u:UnidadMedida)
        SET e.valor = coalesce(e.valor, p.valor_nominal),
            e.unidad = coalesce(e.unidad, u.simbolo)
        """,
        {},
    )

    # ── §1.0.3 — Tipo 2: alias de arista, orden y EPP por paso ──────────────────
    # (a) `:CONTIENE_PASO` (Proc→Paso) ⇒ alias `:CONTIENE` (lo que el reader lee).
    client.query(
        tenant_id,
        """
        MATCH (p:Procedimiento)-[:CONTIENE_PASO]->(s:Paso)
        MERGE (p)-[:CONTIENE]->(s)
        """,
        {},
    )
    # (b) `Paso.orden` ⇐ `Paso.numero` cuando falta (el reader ordena por `orden`).
    client.query(
        tenant_id,
        """
        MATCH (s:Paso)
        WHERE s.orden IS NULL AND s.numero IS NOT NULL
        SET s.orden = toInteger(s.numero)
        """,
        {},
    )
    # (c) EPP del procedimiento colgado también de cada `:Paso` (el reader lee
    #     `(paso)-->(:EPP)`; el catálogo lo cuelga del Procedimiento vía REQUIERE_EPP).
    client.query(
        tenant_id,
        """
        MATCH (p:Procedimiento)-[:REQUIERE_EPP]->(epp:EPP)
        MATCH (p)-[:CONTIENE]->(s:Paso)
        MERGE (s)-[:CONTIENE]->(epp)
        """,
        {},
    )

    # ── §1.0.2 — Enlazar contenido a la :EntidadOperativa del QR (T6/T8) ─────────
    # Si la ingesta vino atada a una entidad operativa (el equipo del QR), se
    # documenta vía `:DOCUMENTADA_POR` (DocumentoSource) y el contenido queda
    # alcanzable por el scope `(:EntidadOperativa)-[]->(x)` que usa el Historial.
    if entidad_id:
        client.query(
            tenant_id,
            """
            MATCH (ent:EntidadOperativa {id: $eid})
            MATCH (d:DocumentoSource {id: $doc_id})
            MERGE (ent)-[:DOCUMENTADA_POR]->(d)
            WITH ent, d
            MATCH (d)-[:CONTIENE]->(x)
            MERGE (ent)-[:CONTIENE]->(x)
            """,
            {"eid": entidad_id, "doc_id": doc_id},
        )
        counters["entidad_enlazada"] = 1

    # ── §1.0.3 — Tipo 6: :CertificadoCalibracion ⇒ espejo :CertificadoVigencia ──
    # El reader del Historial lee `:CertificadoVigencia`; el catálogo de calibración
    # produce `:CertificadoCalibracion`. FalkorDB soporta multi-label: se añade la
    # etiqueta espejo y un `timestamp` derivado del vencimiento para el ORDER BY.
    cert = _add_mirror_label(
        client, tenant_id,
        src="CertificadoCalibracion", mirror="CertificadoVigencia",
        ts_from="fecha_vencimiento",
    )
    counters["certificados_espejados"] = cert

    # ── §1.1 Tipo 7 — Generar alertas administrativas desde los vencimientos ────
    # Best-effort: el generador pasa cada alerta por el safety_validator (línea
    # ABSOLUTA). Si fallara, no rompe el cierre de la ingesta.
    try:
        from app.alerts.generador import generar_alertas_vencimiento

        alert_counters = generar_alertas_vencimiento(client, tenant_id)
        counters["alertas_creadas"] = alert_counters.get("creadas", 0)
        counters["alertas_cuarentena"] = alert_counters.get("cuarentena", 0)
    except Exception as exc:  # noqa: BLE001 — generación de alertas no es gate
        logger.warning("generación de alertas falló: %s", type(exc).__name__)

    logger.info(
        "bridge DKG | tenant=%s doc=%s tipo=%s | %s",
        tenant_id, doc_id[:12], tipo_documento, counters,
    )
    return counters


def _add_mirror_label(
    client: Any, tenant_id: str, *, src: str, mirror: str, ts_from: str
) -> int:
    """
    Añade una etiqueta espejo `mirror` a los nodos `src` y deriva `timestamp` desde
    `ts_from` si falta. Usa `SET n:Label` (multi-label de FalkorDB). Si el motor no
    soportara añadir label en caliente, degrada a no-op logueado (nunca rompe la
    ingesta — el bridge es parte del cierre, no un gate).
    """
    try:
        rows = client.query(
            tenant_id,
            f"""
            MATCH (c:{src})
            SET c:{mirror},
                c.timestamp = coalesce(c.timestamp, c.{ts_from})
            RETURN count(c) AS c
            """,
            {},
        )
        return int((rows[0].get("c") if rows else 0) or 0)
    except Exception as exc:  # noqa: BLE001 — multi-label opcional; no es gate
        logger.warning("no se pudo espejar %s→%s: %s", src, mirror, type(exc).__name__)
        return 0
