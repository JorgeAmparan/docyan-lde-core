"""
Onboarding + ciclo de uso del cliente (B13).

Habilita: cuenta Freemium (autoservicio) / Piloto (canje de código), onboarding en
dos fases (credenciales → plan + criticidad), invitación de usuarios por correo y
gestión de documentos vivos (eliminar/reemplazar) sobre el grafo del tenant.

La capa de datos se REUSA de `app/platform_admin/store.py` (orgs/users/budget/
billing/access_codes/invitations), extendida en B13 con orgs e invitations.
"""
