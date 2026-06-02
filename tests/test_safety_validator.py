"""
Tests del validador de seguridad de alertas — línea ABSOLUTA (B8, CLAUDE.md §11.1).

Las alertas administrativas se admiten; las que sugieren decisión clínica u
operativa se mandan a cuarentena SIEMPRE. Cobertura crítica: esta línea no se cruza.
"""
import pytest

from app.alerts.safety_validator import particionar_alertas, validar_alerta

ADMINISTRATIVAS = [
    "El certificado de calibración vence el 2026-09-01",
    "Documentos por vencer este mes",
    "La calibración del manómetro caduca pronto",
    "Renovación de licencia pendiente",
    "Falta el documento de mantenimiento",
]

PROHIBIDAS = [
    "Administre 5 mg de medicamento al paciente",
    "Suspenda el tratamiento de inmediato",
    "Incremente la dosis a 10 mg",
    "Detenga la línea de producción ahora",
    "Apague el reactor de inmediato",
    "Evacúe la zona",
]


@pytest.mark.parametrize("texto", ADMINISTRATIVAS)
def test_alertas_administrativas_admisibles(texto):
    assert validar_alerta(texto).admisible is True


@pytest.mark.parametrize("texto", PROHIBIDAS)
def test_alertas_clinicas_u_operativas_rechazadas(texto):
    res = validar_alerta(texto)
    assert res.admisible is False
    assert res.patron_detectado is not None


def test_mezcla_administrativa_con_clinica_se_rechaza():
    """Si una alerta mezcla vencimiento con sugerencia clínica, MANDA lo prohibido."""
    texto = "El certificado vence; administre el medicamento al operador"
    assert validar_alerta(texto).admisible is False


def test_particionar_separa_admisibles_y_cuarentena():
    alertas = [
        {"alerta_id": "1", "descripcion": "certificado por vencer"},
        {"alerta_id": "2", "descripcion": "suspenda el tratamiento"},
    ]
    admisibles, cuarentena = particionar_alertas(alertas)
    assert [a["alerta_id"] for a in admisibles] == ["1"]
    assert [a["alerta_id"] for a in cuarentena] == ["2"]
    assert cuarentena[0]["motivo_cuarentena"]
