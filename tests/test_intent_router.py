"""Tests del Intent Router mínimo del MO (B4 §2, responsabilidad 2)."""
from app.orchestrator.intent_router import IntentRouter
from app.orchestrator.models import MORequest, RequestKind

AUTH = {"org_id": "t1", "user_id": "u1", "role": "admin"}


def _req(**kw):
    return MORequest(auth=AUTH, **kw)


def test_clasifica_consulta_por_texto():
    assert IntentRouter().classify(_req(texto="¿cuándo vence el extintor?")) == RequestKind.consulta


def test_clasifica_ingesta_por_accion():
    assert IntentRouter().classify(_req(accion="ingesta")) == RequestKind.ingesta


def test_clasifica_ingesta_por_payload_documento():
    assert IntentRouter().classify(_req(payload={"documento_ref": "s3://x"})) == RequestKind.ingesta


def test_clasifica_configuracion():
    assert IntentRouter().classify(_req(accion="onboarding")) == RequestKind.configuracion


def test_clasifica_evento_programado():
    assert IntentRouter().classify(_req(accion="cron")) == RequestKind.evento_programado


def test_hint_explicito_gana():
    r = _req(texto="algo", payload={"kind": "ingesta"})
    assert IntentRouter().classify(r) == RequestKind.ingesta


def test_desconocido_sin_senales():
    assert IntentRouter().classify(_req()) == RequestKind.desconocido
