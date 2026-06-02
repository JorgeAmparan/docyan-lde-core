"""
Pipelines de resolución de consulta — Tipos 1-8 (B8 §A2).

DOCYAN LDE™ by XCID.

Un módulo por tipo de intención. Cada pipeline consume el DKG (vía
`PipelineGraphReader`), aplica los cruces estructurales (doc 03) y compone un
payload tipado (`app/schemas/pipeline_payloads.py`) que B9 renderiza.

Los pipelines son funciones de transformación PURAS sobre lo que el reader
devuelve: el Cypher real vive en `dkg_reader.DKGReader`, de modo que los tests
inyectan un reader sintético y verifican el payload sin tocar FalkorDB.
"""
from app.pipelines.base import ContextoPipeline, ResultadoPipeline

__all__ = ["ContextoPipeline", "ResultadoPipeline"]
