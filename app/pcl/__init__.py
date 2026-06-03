"""
Capa de Contexto Persistente (CCP / PCL) (B8.5).

DOCYAN LDE™ by XCID — doc `docs/00_CCP_Arquitectura.md`.

Fachada unificada sobre FAT, consultas guardadas, playbooks, sugerencias EDB y el
caché semántico nuevo. Los pipelines, el MO y las UIs consumen `PCL`, no los
componentes individuales (doc §6). Maquinaria interna en código = `PCL`; en docs
en español = CCP. Unidad de cliente = `tenant_id` (sinónimo legible "DoCo").
"""
from app.pcl.modes import ModoRespuesta, elegir_modo
from app.pcl.pcl_cache import PCLCache
from app.pcl.pcl_facade import PCL
from app.pcl.pcl_metrics import PCLMetrics

__all__ = ["PCL", "PCLCache", "PCLMetrics", "ModoRespuesta", "elegir_modo"]
