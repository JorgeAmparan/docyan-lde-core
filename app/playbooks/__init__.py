"""
Mecánica de Playbooks de Consulta (B8 §B) — DOCYAN LDE™ by XCID.

Materializa el Nivel 3 visible (Adenda) en tres niveles (doc de visión de
Playbooks):

  - **Nivel A** (`consultas_guardadas`): la consulta guardada por nombre, viva
    (se re-evalúa contra el grafo actual, no es snapshot).
  - **Nivel B** (`playbooks_core`): la secuencia de consultas guardadas que el
    usuario encadena en el orden en que trabaja (recorrido razonado).
  - **Nivel C** (`sugerencias`): el EDB propone Playbooks al detectar patrones,
    bajo la COMPUERTA DE TRES SEÑALES (estructural + conductual + permiso).

Naming progresivo (disciplina de producto): la palabra "Playbook" NO aparece al
usuario hasta que su comportamiento la justifica (≥2 consultas guardadas
relacionadas). En código interno los modelos se llaman `consultas_guardadas`,
NO `playbooks_atomicos`.
"""
