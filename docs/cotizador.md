# Cotizador pre-ingesta (B2 §7 — CRÍTICO)

> **DOCYAN LDE™ by XCID.** Gate financiero **inviolable**: ningún documento se
> ingiere al grafo sin pasar por el cotizador. **No hay bypass** (CLAUDE.md §14).
> Justificación: incidente PoC 28-may-2026 ($5,000 en Gemini por una ingesta sin
> control de costo, timeout 600s, escritura parcial).

## Qué hace (`app/ingesta/cotizador.py`)

Antes de cualquier ingesta:

1. **Mide tokens** del documento con `tiktoken` (encoding `o200k_base`).
2. **Estima costo** USD: extracción (Gemini 2.5 Flash) + QA (gpt-4o-mini) +
   embeddings (BGE-M3, costo de cómputo marginal).
3. **Estima tiempo** de procesamiento (PoC: NOM 32pp ≈ 642s).
4. **Verifica el cupo del plan** del tenant: si la ingesta cae dentro del cupo
   incluido, el setup es **$0**; si lo excede, calcula el **precio de setup**.
5. **Decide**: `incluido_en_cupo`, `aprobado_requiere_confirmacion` (con precio),
   o `rechazado_limite_plan` (tope de documentos vivos del tier).
6. **Nunca ingiere por su cuenta**: la ingesta procede solo con confirmación
   explícita del usuario; al confirmar **se cobra el monto cotizado al método de
   pago configurado** (manual durante el piloto, Stripe después).

## Modelo de costo (`pricing_table.py`)

Precios vigentes (fechados, `PRICING_AS_OF`) por 1M de tokens:

| Modelo | Input | Output |
|---|---|---|
| `gemini/gemini-2.5-flash` | $0.30 | $2.50 |
| `gpt-4o-mini` | $0.15 | $0.60 |

**Modelo de uso** (cómo se traducen los tokens del documento a tokens
facturables del pipeline GraphRAG-SDK), calibrado contra baselines del PoC:

```
extracción Gemini: input ≈ doc×1.0, output ≈ doc×0.5
QA gpt-4o-mini:     input ≈ doc×0.3, output ≈ doc×0.1
embeddings BGE-M3:  doc×1.0 tokens × costo de cómputo marginal
```

### Validación contra baselines del PoC (±15%)

| Caso | Tokens | Estimado | Baseline | Error |
|---|---|---|---|---|
| NOM 32pp | 22,400 | $0.0373 | $0.036 | +3.6% |
| Ley 61pp | 28,000 | $0.0466 | $0.046 | +1.3% |
| Corpus 50 NOM + 10 leyes | — | ~$2.27 | $2.26 | +0.4% |

Cubierto por `tests/test_cotizador_baselines.py`. `tiktoken` no es el tokenizador
exacto de Gemini, pero es la referencia que fija la Adenda §8 y es conservador
(tiende a contar igual o más para texto técnico latino).

## Modelo comercial — cupo + setup por excedente (Modelo Comercial Canónico)

**No hay saldo prepagado.** El cliente carga a su ritmo (Modelo 2):

- Cada plan incluye un **cupo de ingestas sin costo**: Esencial 10 iniciales +
  3/mes · Profesional 30 + 10/mes · Enterprise negociado.
- **Dentro del cupo → setup $0** (solo confirma).
- **Sobre el cupo → fórmula** `precio_setup = MAX($15, costo_base × 25) × factor`.
  Para casi todo gana el piso de $15; solo documentos enormes activan el ×25.
- Se cotiza **antes** de ingerir; el cliente confirma; **al confirmar se cobra el
  monto cotizado al método de pago** configurado (tarjeta/SPEI). Cobro **manual
  durante el piloto**; Stripe tras los primeros clientes.
- **Tope por tier**: documentos vivos del plan (freemium 3, Esencial 50,
  Profesional 300, Enterprise 300+/a la medida). Al alcanzarlo, mensaje de
  conversión, no "saldo insuficiente".

El cotizador es el **guard previo** a invocar a GraphRAG-SDK. Reserva el monto al
confirmar y lo liquida al costo real al completar.

## Planes y bandas (referencia de precios)

Métrica: **documentos vivos**, no usuarios. Todas las capacidades en todos los
tiers. Precios USD/mes por banda (poder adquisitivo):

| Tier | Documentos vivos | Cupo de ingestas | Banda A (MX·LatAm) | Banda B (US·CA) | Banda C (UE·UK·AU) |
|---|---|---|---|---|---|
| Esencial | hasta 50 | 10 + 3/mes | $250 | $349 | $375 |
| Profesional | hasta 300 | 30 + 10/mes | $550 | $770 | $825 |
| Enterprise | 300+ a la medida | negociado | desde $1,200 | desde $1,680 | desde $1,800 |

Freemium: 3 documentos vivos · 30 días, sin cupo. Piloto: Esencial −30% sobre la
banda activa, ventana 60 días (canje de código de acceso).

## Cómo el cliente lo ve

Cupo del plan ("te quedan N de M este mes") + por documento: tipo clasificado,
confianza, **corrección de tipo** (el usuario corrige antes de aprobar — regla
transversal #1), precio ("Incluido · $0" o "$15.00"), aviso honesto si el tipo
no tiene schema (extracción genérica — regla #2) o si es escaneado (OCR puede
variar). Gestión del plan y método de pago en `/plan`. Fuente de verdad de la UI:
prototipo del design system (`HANDOFF.md` → vista Plan / cotizador).

## Endpoints (`app/api/routers/ingesta.py`)

```
POST /ingesta/documents              → cotiza + crea job (pending/rejected), NO ingiere
POST /ingesta/documents/{id}/confirm → si aprobado, cobra al método de pago y encola al worker
GET  /ingesta/documents/{id}         → estado del job
```

`tipo_forzado` en el confirm = el usuario corrigió el tipo documental antes de
aprobar (el clasificador asigna, el cotizador muestra, el usuario corrige).

## Regla para tests

El cotizador **es un gate sin bypass**. Para tests que necesiten saltar el costo
real se mockea el **almacén** de cupo/cobro, **nunca la decisión** del cotizador.
Ver `tests/test_cotizador_*.py`.

## ⚠️ Migración pendiente (para Opus)

El backend actual (`cotizador.py`, `budget_manager.py`, tabla `tenant_budget` con
`saldo_actual_usd`, hard caps, `recargar`) y la ruta `(account)/cuenta/recharge`
aún implementan el **modelo viejo de saldo prepagado**. Migrar a: **cupo del plan
+ setup por excedente + cobro al método de pago**. Eliminar la ruta
`cuenta/recharge` y toda mención de "recargar saldo". La fuente de verdad del
modelo y de la UI es el prototipo del design system (`HANDOFF.md` → vista Plan).
