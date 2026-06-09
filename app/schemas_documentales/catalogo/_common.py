"""
Bloque común de extracción de specs consultables (T1) — B9.5 cierre del gap T1.

DOCYAN LDE™ by XCID.

El pipeline de lectura T1 (Informativa) lee `:Especificacion{nombre,valor,unidad}`.
Para que un tipo documental sirva consultas T1 ("¿límite de exposición OSHA?",
"¿rango del manómetro?"), su schema DEBE producir nodos `:Especificacion` con el
valor y la unidad inline. Esta entidad canónica + el hint de prompt se inyectan en
los schemas que cargan valores técnicos consultables (msds, calibracion,
ficha_tecnica, manual_tecnico). La cita la aporta el bridge (`:DocumentoSource`).
"""
from app.schemas_documentales.base import EntidadSchema

# Entidad canónica de spec consultable (la que el reader T1 lee directo). Valor y
# unidad van INLINE (no requiere ParametroTecnico ni denormalización del bridge).
ESPECIFICACION_CONSULTABLE = EntidadSchema(
    "Especificacion",
    "Un valor técnico CONSULTABLE con su valor y unidad: límite de exposición "
    "(OSHA PEL, ACGIH TLV), propiedad física (punto de fusión, pH, densidad, "
    "gravedad específica, solubilidad), rango de medición, clase de precisión, "
    "incertidumbre, parámetro nominal. 'nombre' identifica el dato; 'valor' y "
    "'unidad' su magnitud.",
    ["nombre", "valor", "unidad"],
)

# Hint a anexar al prompt de extracción para que el LLM pueble `:Especificacion`.
SPEC_PROMPT_HINT = (
    " Extrae ADEMÁS, como entidades Especificacion, TODO valor técnico consultable "
    "con su valor y unidad: límites de exposición (OSHA PEL total/respirable, ACGIH "
    "TLV), propiedades físicas (punto de fusión, pH, densidad/gravedad específica, "
    "solubilidad, punto de ebullición), rango de medición, clase de precisión e "
    "incertidumbre. El 'nombre' es el del dato (p. ej. 'Límite de exposición OSHA "
    "PEL (total)', 'Rango de presión', 'Clase de precisión'); 'valor' es la magnitud "
    "(p. ej. '15', '0-4', '1,6') y 'unidad' su unidad (p. ej. 'mg/m³', 'bar')."
)
