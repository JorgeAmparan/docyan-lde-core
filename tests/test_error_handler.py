"""Tests del Error Handler del MO (B4 §10, responsabilidad 10)."""
from app.orchestrator.error_handler import ErrorHandler
from app.orchestrator.models import Canal


def _no_sleep(_s):
    return None


def test_retry_exito_primer_intento():
    h = ErrorHandler(sleep=_no_sleep)
    out = h.run_with_retry(lambda: 42)
    assert out.ok and out.result == 42 and out.intentos == 1


def test_retry_reintenta_y_eventualmente_exito():
    h = ErrorHandler(max_intentos=3, sleep=_no_sleep)
    estado = {"n": 0}

    def flaky():
        estado["n"] += 1
        if estado["n"] < 3:
            raise RuntimeError("transitorio")
        return "ok"

    out = h.run_with_retry(flaky)
    assert out.ok and out.result == "ok" and out.intentos == 3


def test_retry_agota_y_reporta_falla_honesta():
    h = ErrorHandler(max_intentos=2, sleep=_no_sleep)

    def siempre_falla():
        raise ValueError("roto")

    out = h.run_with_retry(siempre_falla)
    assert not out.ok
    assert "roto" in out.error  # se reporta el fallo real, no se finge éxito


def test_fallback_se_usa_si_primary_falla():
    h = ErrorHandler(max_intentos=1, sleep=_no_sleep)
    out = h.run_with_fallback(
        primary=lambda: (_ for _ in ()).throw(RuntimeError("x")),
        fallback=lambda: "respaldo",
    )
    assert out.ok and out.result == "respaldo"


def test_ambos_fallan_reporta_ambos():
    h = ErrorHandler(max_intentos=1, sleep=_no_sleep)
    out = h.run_with_fallback(
        primary=lambda: (_ for _ in ()).throw(RuntimeError("p")),
        fallback=lambda: (_ for _ in ()).throw(RuntimeError("f")),
    )
    assert not out.ok and "p" in out.error and "f" in out.error


def test_degrade_channel():
    h = ErrorHandler()
    assert h.degrade_channel(Canal.pwa) == Canal.whatsapp
    assert h.degrade_channel(Canal.whatsapp) == Canal.api
    assert h.degrade_channel(Canal.api) is None


def test_honest_error_no_finge_exito():
    err = ErrorHandler.honest_error("No se pudo completar.", "TimeoutError: 30s")
    assert err["ok"] is False
    assert err["detalle_tecnico"] == "TimeoutError: 30s"
