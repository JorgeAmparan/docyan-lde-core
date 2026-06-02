"""
Clasificación heurística de intención (B8 §A1).

DOCYAN LDE™ by XCID.

Patrones léxicos (regex sobre la pregunta normalizada) + señales de contexto
(tipo de documento al que apunta el QR). Es la pasada RÁPIDA y barata del
clasificador híbrido: resuelve los casos obvios sin costo de LLM. Cuando la
confianza queda por debajo del umbral del tenant, el orquestador delega en el
`llm_classifier`.

La confianza heurística es la cuota normalizada del tipo ganador sobre el total
de evidencia acumulada, atenuada cuando la evidencia absoluta es escasa: una sola
señal débil NO debe producir confianza 1.0 (eso enviaría casos ambiguos por el
camino barato equivocado).
"""
from __future__ import annotations

import re
import unicodedata

from app.orchestrator.clasificacion.tipos import TipoIntencion

# ── Normalización ─────────────────────────────────────────────────────────────


def normalizar(texto: str) -> str:
    """Minúsculas, sin acentos, espacios colapsados — base estable para regex."""
    t = (texto or "").lower().strip()
    t = unicodedata.normalize("NFKD", t)
    t = "".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", t)


# ── Patrones léxicos por tipo (peso por patrón) ───────────────────────────────
# El peso pondera cuán discriminante es la señal. Patrones muy específicos pesan
# más (p. ej. "troubleshooting" vs "como" que es ambiguo).

_PATRONES: dict[TipoIntencion, list[tuple[str, float]]] = {
    TipoIntencion.INFORMATIVA: [
        (r"\bque es\b", 2.0),
        (r"\bque significa\b", 2.0),
        (r"\bcual es (el|la) (valor|especificacion|limite|rango|presion|par|torque)", 2.5),
        (r"\bespecificacion(es)?\b", 2.0),
        (r"\bvalor (de|nominal|maximo|minimo)\b", 2.0),
        (r"\bcuanto (mide|pesa|vale|es)\b", 1.8),
        (r"\b(limite|rango|tolerancia|unidad|parametro)\b", 1.2),
        (r"\bdefin(e|icion|ir)\b", 1.8),
        (r"\bdame informacion\b", 1.2),
    ],
    TipoIntencion.GUIA_PASO_A_PASO: [
        (r"\bpaso a paso\b", 3.0),
        (r"\bprocedimiento\b", 2.5),
        (r"\binstruccion(es)?\b", 2.0),
        (r"\bcomo (se )?(hace|realiza|instala|cambia|opera|monta|ejecuta|arma|configura)\b", 2.2),
        (r"\bcomo (puedo|debo)\b", 1.6),
        (r"\bguia (de|para)\b", 1.8),
        (r"\bque pasos\b", 2.5),
        (r"\bpasos? (para|de|a seguir)\b", 2.3),
    ],
    TipoIntencion.GRAFICOS_DIAGRAMAS: [
        (r"\bdiagrama\b", 3.0),
        (r"\b(grafic[oa]|esquema|plano|croquis)\b", 2.5),
        (r"\b(figura|ilustracion|dibujo)\b", 2.0),
        (r"\bmuestra(me)? (el|la|un) (diagrama|esquema|plano|grafico)\b", 3.0),
        (r"\bsimbolo(s|gia)?\b", 1.8),
        (r"\bleyenda\b", 1.5),
    ],
    TipoIntencion.VIDEO: [
        (r"\bvideo\b", 3.0),
        (r"\b(grabacion|clip|tutorial en video|videotutorial)\b", 2.5),
        (r"\bmuestra(me)? el video\b", 3.0),
        (r"\bhay (un|algun) video\b", 2.5),
    ],
    TipoIntencion.TROUBLESHOOTING: [
        (r"\btroubleshooting\b", 3.0),
        (r"\b(falla|averia|fallo)\b", 2.5),
        (r"\bno (funciona|enciende|arranca|prende|responde)\b", 2.8),
        (r"\b(error|defecto|problema)\b", 2.0),
        (r"\bque hago si\b", 2.2),
        (r"\bse (descompuso|daño|trabo|atasco)\b", 2.5),
        (r"\bcomo (resuelvo|soluciono|reparo|arreglo)\b", 2.4),
        (r"\bdiagnostic(o|ar)\b", 2.2),
    ],
    TipoIntencion.HISTORIAL: [
        (r"\bhistorial\b", 3.0),
        (r"\b(bitacora|cronologia)\b", 2.5),
        (r"\bultim[ao]s? (vez|mantenimiento|calibracion|revision|evento)\b", 2.5),
        (r"\bcuando se (hizo|realizo|calibro|reviso|cambio|mantuvo)\b", 2.4),
        (r"\bque (mantenimientos|eventos|observaciones|registros)\b", 2.2),
        (r"\bregistro(s)? (de|historico)\b", 2.0),
        (r"\bobservacion(es)?\b", 1.6),
    ],
    TipoIntencion.ALERTAS: [
        # Stems (venc/caduc/expir) cubren vence/vencen/vencimiento/caduca/caducan/expira(n).
        (r"\bvenc", 3.0),
        (r"\b(caduc|expir)", 2.8),
        (r"\balerta(s)?\b", 2.5),
        (r"\b(recordatorio|fecha limite|pendiente[s]? de)\b", 2.0),
        (r"\bque (esta|estan) por (vencer|expirar|caducar)\b", 3.0),
    ],
    TipoIntencion.COMPARATIVA: [
        (r"\bcompara(r|cion|tiv[ao])?\b", 3.0),
        (r"\bdiferencia(s)? (entre|con)\b", 2.8),
        (r"\b(versus|vs)\b", 2.5),
        (r"\bque cambio (entre|de|en)\b", 2.5),
        (r"\bcomparad[oa] con\b", 2.5),
        (r"\bcontra (la|el) (version|norma|especificacion)\b", 2.2),
    ],
}

# Señal de contexto: el tipo de documento al que apunta el QR sesga ligeramente
# la intención probable. Peso bajo (no debe dominar al texto), pero desempata.
_BONO_DOC_TIPO: dict[str, dict[TipoIntencion, float]] = {
    "calibracion": {TipoIntencion.HISTORIAL: 0.8, TipoIntencion.ALERTAS: 0.8},
    "manual_tecnico": {
        TipoIntencion.GUIA_PASO_A_PASO: 0.8,
        TipoIntencion.INFORMATIVA: 0.4,
    },
    "ficha_tecnica": {TipoIntencion.INFORMATIVA: 0.8},
    "especificacion": {TipoIntencion.INFORMATIVA: 0.8},
    "msds": {TipoIntencion.INFORMATIVA: 0.5, TipoIntencion.TROUBLESHOOTING: 0.4},
}

# Evidencia (peso acumulado) a partir de la cual la heurística puede alcanzar
# confianza plena. Calibrado para que un único patrón ESPECÍFICO (peso ≥ 2.5, p.
# ej. "procedimiento", "diagrama", "como se instala") resuelva sin LLM, pero un
# único patrón débil (peso ≤ 2.0, p. ej. "dame informacion") quede por debajo del
# umbral 0.80 y escale al LLM. La atenuación evita fingir certeza con poca señal.
_PISO_EVIDENCIA = 2.5


def puntuar(pregunta: str, contexto: dict | None = None) -> dict[TipoIntencion, float]:
    """Acumula evidencia (peso) por tipo a partir de patrones + contexto."""
    texto = normalizar(pregunta)
    scores: dict[TipoIntencion, float] = {t: 0.0 for t in TipoIntencion}

    for tipo, patrones in _PATRONES.items():
        for patron, peso in patrones:
            if re.search(patron, texto):
                scores[tipo] += peso

    ctx = contexto or {}
    tipo_doc = (ctx.get("tipo_documento") or "").lower()
    for tipo, bono in _BONO_DOC_TIPO.get(tipo_doc, {}).items():
        # El bono de contexto solo cuenta si ya hubo alguna señal léxica o si
        # ninguna otra señal existe (para no "inventar" intención de la nada,
        # pero sí para desempatar entre candidatos plausibles).
        scores[tipo] += bono

    return scores


def clasificar(
    pregunta: str, contexto: dict | None = None
) -> tuple[TipoIntencion, float, dict[str, float]]:
    """
    Devuelve (tipo_ganador, confianza, candidatos_normalizados).

    Confianza = cuota del ganador sobre el total, atenuada por la evidencia
    absoluta: con poca evidencia la confianza se reduce proporcionalmente para
    que el orquestador escale al LLM en casos débiles/ambiguos.
    """
    scores = puntuar(pregunta, contexto)
    total = sum(scores.values())
    if total <= 0:
        # Sin ninguna señal: INFORMATIVA es el default natural, pero con
        # confianza 0 → el orquestador delega al LLM.
        return TipoIntencion.INFORMATIVA, 0.0, {t.value: 0.0 for t in TipoIntencion}

    ganador = max(scores, key=lambda t: scores[t])
    cuota = scores[ganador] / total
    atenuacion = min(1.0, scores[ganador] / _PISO_EVIDENCIA)
    confianza = cuota * atenuacion

    candidatos = {t.value: (s / total) for t, s in scores.items() if s > 0}
    return ganador, confianza, candidatos
