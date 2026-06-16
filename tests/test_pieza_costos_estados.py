"""
Sprint Núcleo Consultable — costos de figuras, topes y estados honestos.

DOCYAN LDE™ by XCID.

Cubre:
  · Pieza 3 — la cotización incluye el costo de VISIÓN de las figuras (entra al gate)
    y aplica el TOPE por documento (cap top-N); el worker extrae solo hasta el tope.
  · Pieza 4b — el medidor de USO REAL de litellm acumula response.usage (base de la
    discrepancia real vs estimado, no por tier).
  · Pieza 4c — el reintento AUTOMÁTICO del worker pasa por el GATE de costo (no
    re-extrae ≤3× sin control si el tenant no puede absorberlo).
  · Pieza 6 — política de NO-COBRO: una ingesta que rinde 0 ontología LIBERA la
    reserva (no liquida) y NO registra idempotencia (el usuario puede reintentar).
"""
from __future__ import annotations

from app.ingesta import pricing_table as pt
from app.ingesta.budget_manager import BudgetManager, InMemoryBudgetStore
from app.ingesta.cotizador import Cotizador, estimar_costo
from app.jobs.dispatcher import InMemoryQueueBackend, JobDispatcher
from app.jobs.job_models import CotizacionSnapshot, IngestJob

# ── Pieza 3 — costo de visión + cap en el cotizador ───────────────────────────

def _cotizador(saldo: float = 100.0, tenant: str = "t") -> Cotizador:
    bm = BudgetManager(store=InMemoryBudgetStore())
    bm.ensure_budget(tenant, saldo_inicial_usd=saldo, hard_cap_por_documento=50.0,
                     hard_cap_por_sesion=100.0)
    return Cotizador(budget_manager=bm)


def test_cotizacion_suma_costo_de_vision_de_figuras():
    """Con figuras, el total de la cotización es MAYOR que sin figuras: el costo de
    visión entra al gate (no se ingiere visión gratis)."""
    texto = "Punto de inflamación 60 °C. " * 200
    sin = _cotizador().cotizar("t", texto, num_figuras=0)
    con = _cotizador().cotizar("t", texto, num_figuras=10)
    assert con.desglose.vision_usd > 0
    assert con.costo_estimado_usd > sin.costo_estimado_usd
    # El total reportado incluye la visión.
    assert con.desglose.total_usd == round(
        con.desglose.extraccion_usd + con.desglose.qa_usd
        + con.desglose.embeddings_usd + con.desglose.vision_usd, 6
    )
    assert con.num_figuras == 10 and con.figuras_cotizadas == 10 and con.figuras_excedidas == 0


def test_cotizacion_capa_figuras_al_tope_por_documento():
    """Más figuras que el tope → solo se cotiza el tope; el resto se reporta como
    excedido (aviso honesto), no se cobra visión sin límite."""
    texto = "contenido " * 100
    n = pt.MAX_FIGURAS_POR_DOCUMENTO + 17
    cot = _cotizador().cotizar("t", texto, num_figuras=n)
    assert cot.num_figuras == n
    assert cot.figuras_cotizadas == pt.MAX_FIGURAS_POR_DOCUMENTO
    assert cot.figuras_excedidas == 17
    # La visión cotizada corresponde SOLO al tope, no a las n figuras.
    assert cot.desglose.vision_usd == pt.costo_vision_figuras(pt.MAX_FIGURAS_POR_DOCUMENTO)


def test_estimar_costo_sin_figuras_no_cambia_baseline():
    """Sin figuras, vision_usd=0 → el baseline de texto queda idéntico (no regresa)."""
    desg, _ = estimar_costo(10_000, 0)
    assert desg.vision_usd == 0.0


# ── Pieza 3 — cap de figuras en el worker (extracción real) ───────────────────

def test_worker_extrae_solo_hasta_el_tope_de_figuras():
    """El worker NO llama a visión por más figuras que el tope por documento."""
    from worker.extraction.diagram_extractor import extraer_diagramas
    from worker.extraction.docling_figures import FiguraExtraida

    llamadas = {"n": 0}

    def fake_vision(prompt, b64):
        llamadas["n"] += 1
        return '{"titulo":"x","etiquetas":[],"leyenda_simbolica":[]}'

    # n figuras > tope; tamaños distintos para ejercitar el top-N por tamaño.
    n = pt.MAX_FIGURAS_POR_DOCUMENTO + 8
    figuras = [FiguraExtraida(titulo=f"f{i}", png_bytes=bytes([i % 256]) * (i + 1))
               for i in range(n)]
    extraer_diagramas(
        "t", figuras,
        complete_vision=fake_vision,
        put_asset=lambda *a, **k: "url",
        storage_ok=lambda: True,
    )
    assert llamadas["n"] == pt.MAX_FIGURAS_POR_DOCUMENTO, (
        f"se llamó visión {llamadas['n']} veces; el tope es {pt.MAX_FIGURAS_POR_DOCUMENTO}"
    )


# ── Pieza 4b — medidor de uso real de litellm ─────────────────────────────────

def test_medir_uso_acumula_response_usage():
    """El acumulador suma los tokens/llamadas que reporta litellm (base de la
    discrepancia REAL vs estimado, no por tier)."""
    from worker import llm_config

    class _Usage:
        prompt_tokens = 1000
        completion_tokens = 400

    class _Resp:
        usage = _Usage()

    logger = llm_config._UsageLogger()
    with llm_config.medir_uso() as uso:
        logger.log_success_event({}, _Resp(), 0, 0)
        logger.log_success_event({}, _Resp(), 0, 0)
    assert uso["calls"] == 2
    assert uso["prompt_tokens"] == 2000
    assert uso["completion_tokens"] == 800


def test_medir_uso_inerte_fuera_de_contexto():
    """Sin un bloque `medir_uso`, el callback no acumula en ningún lado (no fuga)."""
    from worker import llm_config

    class _Resp:
        usage = type("U", (), {"prompt_tokens": 5, "completion_tokens": 5})()

    # No debe lanzar aunque no haya acumulador activo.
    llm_config._UsageLogger().log_success_event({}, _Resp(), 0, 0)


# ── Pieza 4c — re-gate del reintento automático del worker ────────────────────

def _wire(saldo: float, tenant: str = "t"):
    bm = BudgetManager(store=InMemoryBudgetStore())
    bm.ensure_budget(tenant, saldo_inicial_usd=saldo, hard_cap_por_documento=50.0,
                     hard_cap_por_sesion=100.0)
    backend = InMemoryQueueBackend()
    return JobDispatcher(backend=backend, budget_manager=bm), bm, backend


def _job(job_id="j1", tenant="t", costo=2.0, sha="SHA"):
    return IngestJob(
        job_id=job_id, tenant_id=tenant, documento_ref="r", nombre_archivo="d.pdf",
        content_sha256=sha,
        cotizacion=CotizacionSnapshot(
            costo_estimado_usd=costo, tiempo_estimado_seg=10, tokens_documento=100,
            aprobado=True, decision="aprobado_requiere_confirmacion",
        ),
    )


def test_regate_permite_reintento_con_saldo():
    disp, _bm, _ = _wire(100.0)
    disp.crear_job(_job(costo=2.0))
    disp.confirmar("j1")  # retiene 2 → disponible 98 (alcanza para otra corrida)
    permitido, motivo = disp.gate_costo_reintento("j1")
    assert permitido is True and motivo == ""


def test_regate_bloquea_reintento_sin_saldo():
    """Tras reservar, si no queda disponible para OTRA corrida, el reintento se
    bloquea (no se multiplica el costo ≤3× sin control)."""
    disp, _bm, _ = _wire(2.5)
    disp.crear_job(_job(costo=2.0))
    disp.confirmar("j1")  # retiene 2 → disponible 0.5 (< 2.0 de otra corrida)
    permitido, motivo = disp.gate_costo_reintento("j1")
    assert permitido is False
    assert motivo  # motivo honesto de saldo


# ── Pieza 6 — política de no-cobro (0 ontología) ──────────────────────────────

def test_no_cobro_libera_reserva_si_cero_ontologia():
    """Una ingesta que rinde 0 ontología NO se cobra: la reserva se LIBERA (saldo
    intacto) en vez de liquidarse."""
    disp, bm, backend = _wire(10.0)
    disp.crear_job(_job(costo=2.0))
    disp.confirmar("j1")  # disponible 8, retenido 2
    disp.marcar_procesando("j1")
    disp.marcar_completado("j1", {"document_id": "x", "completed_sin_ontologia": True})
    b = bm.get_budget("t")
    assert b.retenido_usd == 0.0
    assert b.saldo_actual_usd == 10.0, "0 ontología debe DEVOLVER el saldo (no-cobro)"
    job = backend.load_job("j1")
    assert job.reserva_estado == "liberado_sin_contenido"
    assert job.costo_real_usd == 0.0


def test_no_cobro_no_registra_idempotencia_permite_reintento():
    """Sin contenido consultable, NO se marca idempotencia: re-subir el mismo
    contenido debe RE-extraer (no un idempotency-skip a un resultado vacío)."""
    disp, _bm, _ = _wire(10.0)
    disp.crear_job(_job(costo=2.0, sha="SHA-vacio"))
    disp.confirmar("j1")
    disp.marcar_completado("j1", {"document_id": "x", "completed_sin_ontologia": True})
    assert disp.buscar_idempotente("t", "SHA-vacio") is None


def test_cobro_normal_si_hay_ontologia():
    """Caso de control: con ontología sí se liquida (cobra) y se registra idempotencia."""
    disp, bm, _ = _wire(10.0)
    disp.crear_job(_job(costo=2.0, sha="SHA-ok"))
    disp.confirmar("j1")
    disp.marcar_completado("j1", {"document_id": "x", "completed_sin_ontologia": False,
                                  "completed_sin_documento": False})
    b = bm.get_budget("t")
    assert b.saldo_actual_usd == 8.0  # se cobró la reserva (cotizado)
    assert disp.buscar_idempotente("t", "SHA-ok") is not None
