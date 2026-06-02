"""Tests de firma/verificación de tokens QR (B4 §6)."""
import pytest

from app.qr import tokens


def test_sign_verify_roundtrip():
    nonce = tokens.generate_nonce()
    token = tokens.sign("tenant-a", "ent-123", nonce)
    payload = tokens.verify(token)
    assert payload.tenant_id == "tenant-a"
    assert payload.entidad_id == "ent-123"
    assert payload.nonce == nonce


def test_tampered_body_rejected():
    token = tokens.sign("tenant-a", "ent-123", tokens.generate_nonce())
    body, sig = token.split(".", 1)
    # Cambia el body manteniendo la firma vieja → debe fallar.
    otro = tokens.sign("tenant-b", "ent-999", tokens.generate_nonce()).split(".", 1)[0]
    forjado = f"{otro}.{sig}"
    with pytest.raises(tokens.InvalidQrToken):
        tokens.verify(forjado)


def test_tampered_signature_rejected():
    token = tokens.sign("tenant-a", "ent-123", tokens.generate_nonce())
    body, _sig = token.split(".", 1)
    with pytest.raises(tokens.InvalidQrToken):
        tokens.verify(f"{body}.AAAAAAAA")


def test_malformed_token_rejected():
    for malo in ["", "sinpunto", "a.b.c", "."]:
        with pytest.raises(tokens.InvalidQrToken):
            tokens.verify(malo)


def test_separator_in_component_rejected():
    with pytest.raises(ValueError):
        tokens.sign("tenant|x", "ent", "nonce")


def test_empty_component_rejected():
    with pytest.raises(ValueError):
        tokens.sign("", "ent", "nonce")
