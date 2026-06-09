"""
Schema: Manual de troubleshooting / diagnóstico de fallas (B9.5).

Guías de resolución de fallas: síntomas, chequeos, causas probables y acciones
resolutorias, organizados como árbol de decisión.
Mapeo de visualización: Tipo 5 (árbol de diagnóstico interactivo) y Tipo 2 (la
acción resolutoria puede ser un procedimiento). El árbol navegable se produce por
AUTO-EXTRACCIÓN curada (B9.5 §1.1 T5): el SDK extrae las entidades; el extractor de
árbol produce el borrador que el humano revisa.
"""
from app.schemas_documentales.base import DocumentSchema, EntidadSchema, RelacionSchema

SCHEMA = DocumentSchema(
    tipo_documento="troubleshooting",
    descripcion=(
        "Manual de diagnóstico de fallas: síntomas, chequeos de decisión, causas "
        "probables y acciones resolutorias."
    ),
    entidades=[
        EntidadSchema("Sintoma", "Síntoma o falla observable que inicia el diagnóstico.",
                      ["nombre", "descripcion"]),
        EntidadSchema("Chequeo", "Pregunta o verificación de decisión.",
                      ["pregunta"]),
        EntidadSchema("CausaProbable", "Causa probable de la falla.",
                      ["descripcion"]),
        EntidadSchema("AccionResolutoria", "Acción para resolver la falla.",
                      ["descripcion"]),
    ],
    relaciones=[
        RelacionSchema("PRESENTA_CHEQUEO", "Sintoma", "Chequeo",
                       "Un síntoma se diagnostica mediante chequeos."),
        RelacionSchema("INDICA_CAUSA", "Chequeo", "CausaProbable",
                       "Un chequeo indica una causa probable."),
        RelacionSchema("RESUELVE_CON", "CausaProbable", "AccionResolutoria",
                       "Una causa se resuelve con una acción."),
    ],
    prompt_extraccion=(
        "Eres un extractor de conocimiento de manuales de troubleshooting "
        "industrial. Extrae los síntomas de falla, los chequeos de decisión que "
        "guían el diagnóstico, las causas probables y las acciones resolutorias. "
        "Conserva la estructura de decisión (qué chequeo lleva a qué causa). "
        "Responde SIEMPRE en español, conservando términos técnicos."
    ),
    tipos_intencion_visualizacion=[5, 2],
    palabras_clave=[
        "troubleshooting", "diagnóstico", "diagnostico", "falla", "fault", "avería",
        "averia", "no arranca", "no enciende", "síntoma", "sintoma", "causa probable",
        "solución de problemas", "resolución de fallas", "diagnosis",
    ],
)
