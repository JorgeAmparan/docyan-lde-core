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
    url_publica: str | None = None,
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
            d.fuente_ingesta = coalesce(d.fuente_ingesta, 'manual'),
            d.url_publica = coalesce($url_publica, d.url_publica)
        """,
        {
            "doc_id": doc_id,
            "tipo_documento": tipo_documento,
            "nombre": nombre_archivo,
            "sha": content_sha256,
            "version": version,
            "idioma": idioma_origen,
            "url_publica": url_publica,
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

    # ── §1.0.3 — Normalización al shape REAL de GraphRAG-SDK (costura escritura↔lectura)
    # GraphRAG-SDK 1.1.1 NO escribe los atributos del schema como propiedades del
    # nodo: colapsa toda entidad a `{id, name, type, description, spans, embedding}`
    # (labels `[__Entity__, <type>]`), y TODA relación a `:RELATES {rel_type, …}`
    # (el label original del schema queda en la propiedad `rel_type`, no como tipo de
    # arista). Los readers B8 leen `e.nombre/e.valor`, `:Procedimiento-[:CONTIENE]->`,
    # etc. — que el SDK nunca emite. Verificado en el grafo de prod (sprint B13.2).
    #
    # Aquí cerramos la costura UNA vez, post-ingesta, de forma ESTRUCTURAL y agnóstica
    # al tipo documental (mapa por label de ontología, NO por tipo de documento):
    #   (a) proyectar `name`/`description` del SDK a los campos canónicos que el reader
    #       lee, por label (coalesce: no pisa si ya hay dato real);
    #   (b) materializar las aristas `:CONTIENE` que el reader recorre, desde las
    #       `:RELATES` del SDK, por pares contenedor→hijo de la ontología.
    counters["props_normalizadas"] = _proyectar_campos_canonicos(client, tenant_id)
    counters["aristas_lectura"] = _materializar_aristas_lectura(client, tenant_id)

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

        # ED-1 §2.4.5: la creación de :Alerta dispara notificación (ruta ingesta).
        # Best-effort y con default seguro: la ReglaAlerta default no trae
        # destinatarios, así que hasta que el admin configure el Directorio la
        # notificación de ingesta no envía nada (solo persiste la alerta).
        notificador = None
        fat = None
        try:
            from app.eventos_dirigidos.fat import get_fat
            from app.eventos_dirigidos.notificador import build_notificador

            notificador = build_notificador(dkg=client)
            fat = get_fat()
        except Exception:  # noqa: BLE001 — sin notificador, solo se persiste la alerta.
            notificador = None
        alert_counters = generar_alertas_vencimiento(
            client, tenant_id, notificador=notificador, fat=fat
        )
        counters["alertas_creadas"] = alert_counters.get("creadas", 0)
        counters["alertas_cuarentena"] = alert_counters.get("cuarentena", 0)
    except Exception as exc:  # noqa: BLE001 — generación de alertas no es gate
        logger.warning("generación de alertas falló: %s", type(exc).__name__)

    logger.info(
        "bridge DKG | tenant=%s doc=%s tipo=%s | %s",
        tenant_id, doc_id[:12], tipo_documento, counters,
    )
    return counters


# ── Normalización del shape SDK-nativo → contrato de lectura B8 ────────────────
#
# Mapa ONTOLÓGICO (por label de entidad, NO por tipo documental): a qué campo
# canónico del reader se proyecta el `name` del SDK. Cubre las entidades de los 8
# tipos; un tipo documental nuevo que reuse estos labels queda cubierto sin tocar
# código (esa es la regla anti-parche-por-tipo).
_CAMPO_PRIMARIO_DESDE_NAME: dict[str, str] = {
    "Especificacion": "nombre",
    "TerminoTecnico": "termino",
    "Procedimiento": "nombre",
    "Paso": "descripcion",
    "EPP": "nombre",
    "Herramienta": "nombre",
    "Advertencia": "texto",
    "RecursoVisual": "titulo",
    "Etiqueta": "texto",
    "LeyendaSimbolica": "simbolo",
    "RecursoVideo": "titulo",
    "Capitulo": "titulo",
    "Subtitulo": "texto",
    "Transcripcion": "texto",
    "ArbolDiagnostico": "titulo",
    "NodoDecision": "pregunta",
    "CausaProbable": "descripcion",
    "AccionResolutoria": "descripcion",
    "EventoOperativo": "descripcion",
    "Observacion": "texto",
    "MedicionRegistrada": "descripcion",
    "CertificadoVigencia": "nombre",
    "CertificadoCalibracion": "nombre",
    "FechaVencimiento": "fecha",
    "Alerta": "descripcion",
    "Norma": "nombre",
    "RequisitoNormativo": "descripcion",
    "Sustancia": "nombre",
    "Riesgo": "descripcion",
    "MedidaProteccion": "descripcion",
    "EquipoProteccion": "nombre",
    "Producto": "nombre",
    "Modelo": "nombre",
    "Fabricante": "nombre",
    "Instrumento": "nombre",
    "Tecnico": "nombre",
}

# Campo secundario proyectado desde `description` del SDK (el detalle/valor textual).
_CAMPO_SECUNDARIO_DESDE_DESCRIPTION: dict[str, str] = {
    "Especificacion": "valor",
    "TerminoTecnico": "definicion",
    "LeyendaSimbolica": "significado",
}

# Pares contenedor→hijo que el reader recorre con `:CONTIENE`. El SDK escribe estas
# relaciones como `:RELATES`; se materializa el `:CONTIENE` que la lectura espera.
# Es ontológico (pares de labels), no por tipo documental.
_PARES_CONTIENE: tuple[tuple[str, str], ...] = (
    ("Procedimiento", "Paso"),
    ("ArbolDiagnostico", "NodoDecision"),
    ("NodoDecision", "CausaProbable"),
    ("NodoDecision", "AccionResolutoria"),
    ("RecursoVisual", "Etiqueta"),
    ("RecursoVisual", "LeyendaSimbolica"),
    ("RecursoVideo", "Capitulo"),
    ("RecursoVideo", "Subtitulo"),
    ("RecursoVideo", "Transcripcion"),
)


def _proyectar_campos_canonicos(client: Any, tenant_id: str) -> int:
    """
    Proyecta el `name`/`description` genéricos del SDK a los campos canónicos que el
    reader lee, por label (coalesce: no pisa un dato ya presente). Idempotente.
    Devuelve cuántos labels se normalizaron (best-effort por label).
    """
    n = 0
    for label, primario in _CAMPO_PRIMARIO_DESDE_NAME.items():
        sets = [f"x.{primario} = coalesce(x.{primario}, x.name)"]
        secundario = _CAMPO_SECUNDARIO_DESDE_DESCRIPTION.get(label)
        if secundario:
            sets.append(f"x.{secundario} = coalesce(x.{secundario}, x.description, x.name)")
        try:
            client.query(
                tenant_id,
                f"MATCH (x:{label}) WHERE x.name IS NOT NULL SET {', '.join(sets)}",
                {},
            )
            n += 1
        except Exception as exc:  # noqa: BLE001 — normalización best-effort, no es gate
            logger.warning("no se pudo normalizar props de %s: %s", label, type(exc).__name__)
    return n


def _materializar_aristas_lectura(client: Any, tenant_id: str) -> int:
    """
    Materializa las aristas `:CONTIENE` que los readers recorren, desde las `:RELATES`
    del SDK, por pares contenedor→hijo de la ontología. Idempotente (MERGE).
    Devuelve cuántas aristas `:CONTIENE` se aseguraron.
    """
    total = 0
    for contenedor, hijo in _PARES_CONTIENE:
        try:
            rows = client.query(
                tenant_id,
                f"""
                MATCH (a:{contenedor})-[:RELATES]->(b:{hijo})
                MERGE (a)-[:CONTIENE]->(b)
                RETURN count(*) AS c
                """,
                {},
            )
            total += int((rows[0].get("c") if rows else 0) or 0)
        except Exception as exc:  # noqa: BLE001 — best-effort, no es gate
            logger.warning(
                "no se pudo materializar :CONTIENE %s→%s: %s",
                contenedor, hijo, type(exc).__name__,
            )
    return total


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
