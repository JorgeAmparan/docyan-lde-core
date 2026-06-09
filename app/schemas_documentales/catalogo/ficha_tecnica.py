"""
Schema: Ficha técnica de producto (B2 §6.2).

Productos, características técnicas, modelos, fabricante.
Mapeo de visualización: Tipo 1 (datos puntuales) y Tipo 3 (recursos visuales /
etiquetas).
"""
from app.schemas_documentales.base import DocumentSchema, EntidadSchema, RelacionSchema
from app.schemas_documentales.catalogo._common import (
    ESPECIFICACION_CONSULTABLE,
    SPEC_PROMPT_HINT,
)

SCHEMA = DocumentSchema(
    tipo_documento="ficha_tecnica",
    descripcion=(
        "Ficha técnica de producto: producto, sus especificaciones técnicas "
        "consultables, modelos disponibles y fabricante."
    ),
    entidades=[
        EntidadSchema("Producto", "El producto descrito por la ficha.",
                      ["nombre", "categoria", "descripcion"]),
        # Antes `CaracteristicaTecnica` (que el reader T1 no leía) → entidad canónica
        # `Especificacion` consultable por T1.
        ESPECIFICACION_CONSULTABLE,
        EntidadSchema("Modelo", "Un modelo o variante del producto.",
                      ["nombre", "codigo"]),
        EntidadSchema("Fabricante", "El fabricante del producto.",
                      ["nombre", "pais"]),
    ],
    relaciones=[
        RelacionSchema("TIENE_ESPECIFICACION", "Producto", "Especificacion",
                       "Un producto tiene especificaciones técnicas consultables."),
        RelacionSchema("DISPONIBLE_EN_MODELO", "Producto", "Modelo",
                       "Un producto está disponible en distintos modelos."),
        RelacionSchema("FABRICADO_POR", "Producto", "Fabricante",
                       "Un producto es fabricado por un fabricante."),
    ],
    prompt_extraccion=(
        "Eres un extractor de conocimiento de fichas técnicas de producto. "
        "Extrae el producto, los modelos o variantes disponibles y el fabricante. "
        "Conserva los valores numéricos y códigos de modelo exactos. Ignora texto de "
        "marketing. Responde SIEMPRE en español, conservando códigos de modelo y "
        "nombres de fabricante en su forma original." + SPEC_PROMPT_HINT
    ),
    tipos_intencion_visualizacion=[1, 3],
    palabras_clave=[
        "ficha técnica", "data sheet", "datasheet", "product", "producto",
        "modelo", "model", "fabricante", "manufacturer", "características",
        "features", "catálogo", "catalog", "part number", "número de parte",
    ],
)
