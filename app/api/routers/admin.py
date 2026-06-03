"""
Router admin — verificación operativa de la infraestructura DKG (B1 §14).

DOCYAN LDE™ by XCID.

Endpoints administrativos (rol `admin`) que prueban en CALIENTE, desde el
backend en producción, que los dos procesos nuevos de B1 responden:

  POST /admin/tenants/test    → crea un :Tenant de prueba en FalkorDB y lo lee.
  POST /admin/embedding/test  → pide un embedding "hola" al servicio BGE-M3.
  GET  /admin/dkg/health      → PING a FalkorDB.

Multi-tenancy: el tenant de prueba se aísla bajo el `org_id` del admin logueado
(`<org_id>__selftest`), nunca toca grafos de otros tenants (regla absoluta §7).
"""
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.auth import requiere_rol
from app.embeddings.bge_client import bge_client
from app.graph.dkg_client import dkg_client
from app.graph.schemas.dkg_ontology import graph_name_for
from app.schemas.pcl_payloads import MetricasCCP

router = APIRouter(prefix="/admin", tags=["admin"])


def get_pcl():
    """Fachada PCL de producción para el endpoint de métricas. Override en tests."""
    from app.orchestrator import providers

    return providers.get_pcl()


@router.get("/dkg/health")
async def dkg_health(ctx: dict = Depends(requiere_rol("admin"))):
    """PING a FalkorDB (docyan-lde-graph)."""
    ok = dkg_client.health()
    if not ok:
        raise HTTPException(status_code=503, detail="FalkorDB (docyan-lde-graph) no responde.")
    return {"status": "healthy", "component": "docyan-lde-graph"}


@router.post("/tenants/test")
async def tenants_test(ctx: dict = Depends(requiere_rol("admin"))):
    """
    Crea un :Tenant de prueba en el grafo aislado del org y lo lee de vuelta.
    Idempotente: limpia el grafo de autotest antes de crear.
    """
    org_id = ctx["org_id"]
    test_tenant = f"{org_id}__selftest"
    try:
        dkg_client.drop_tenant_graph(test_tenant)
        created = dkg_client.create_tenant(
            test_tenant,
            {"nombre": f"selftest-{org_id}", "tipo": "cliente_final_directo"},
        )
        readback = dkg_client.get_tenant(test_tenant)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"DKG no disponible: {type(exc).__name__}: {exc}")
    return {
        "ok": readback is not None,
        "graph_name": graph_name_for(test_tenant),
        "tenant_id": test_tenant,
        "created_id": created.get("id"),
        "tenant": {k: v for k, v in (readback or {}).items() if not k.startswith("_")},
    }


@router.post("/embedding/test")
async def embedding_test(ctx: dict = Depends(requiere_rol("admin"))):
    """
    Pide un embedding del texto 'hola' al servicio BGE-M3 (docyan-lde-embedder)
    y verifica que la dimensión sea 1024 (BGE-M3) y NO 1536 (OpenAI).
    """
    try:
        vectors = bge_client.get_embeddings(["hola"])
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=503,
            detail=f"Embedder (docyan-lde-embedder) no disponible: {type(exc).__name__}: {exc}",
        )
    vector = vectors[0]
    dim = len(vector)
    return {
        "ok": dim == 1024,
        "dim": dim,
        "expected_dim": 1024,
        "model": "BAAI/bge-m3",
        "sample": vector[:5],
    }


@router.get("/fat/integrity")
async def fat_integrity(ctx: dict = Depends(requiere_rol("admin"))):
    """
    Verifica la integridad de la cadena de hashes FAT del tenant del admin (B7).

    Lee los eventos del FAT (Supabase + FalkorDB entrelazados por timestamp) y
    recorre la cadena SHA-256 detectando alteraciones y huecos. NO toca datos de
    otros tenants (multi-tenant absoluto: scope-a por el `org_id` del admin).
    """
    from app.audit.fat_extendido import FATExtendido
    from app.audit.integrity_checker import verificar_tenant
    from app.audit.stores import HybridFATStore

    org_id = ctx["org_id"]
    try:
        fat = FATExtendido(HybridFATStore())
        resultado = verificar_tenant(fat, org_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=503,
            detail=f"FAT no disponible: {type(exc).__name__}: {exc}",
        )
    return resultado.to_dict()


@router.get("/pcl/metrics", response_model=MetricasCCP)
async def pcl_metrics(
    desde: date | None = Query(None, description="Inicio de la ventana (default: hace 30 días)."),
    hasta: date | None = Query(None, description="Fin de la ventana (default: hoy)."),
    ctx: dict = Depends(requiere_rol("admin")),
    pcl=Depends(get_pcl),
):
    """
    Métricas agregadas de la CCP/PCL del DoCo del admin (B8.5, doc §7.3): hit rate
    del caché, costo por consulta, distribución de modos, latencias.

    Multi-tenant ABSOLUTO: scope-a por el `org_id` del admin logueado (mismo patrón
    que `/admin/fat/integrity`); NO acepta un `tenant_id` arbitrario por query.
    """
    org_id = ctx["org_id"]
    # UTC: la ventana por default se mide en UTC (los agregados se llaven por
    # fecha UTC, coherente con los timestamps del FAT).
    hasta = hasta or datetime.now(timezone.utc).date()
    desde = desde or (hasta - timedelta(days=30))
    try:
        return pcl.metricas(org_id, (desde, hasta))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=503,
            detail=f"Métricas PCL no disponibles: {type(exc).__name__}: {exc}",
        )
