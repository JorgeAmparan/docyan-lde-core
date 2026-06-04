# Stripe Setup — B9.1

> **Estado:** El código de Stripe (checkout signup, webhook, recharge, billing UI)
> está completo y listo. La **configuración real de la cuenta Stripe + el cambio de
> test→live** se ejecuta en **B9.1**, bajo la cuenta Stripe de Jorge. Hasta entonces
> el frontend degrada con gracia: sin `pk_…` válido, la UI muestra el estado
> "configuración Stripe en B9.1" pero conserva el layout completo.

Este documento es la **lista de tareas de configuración** para B9.1. No requiere
cambios de código (salvo que se decida añadir más regiones/planes a `pricing.ts`).

---

## 1. Productos y precios a crear

Crear **un Product por plan** (3 productos) y **un Price por plan × región × período**
(mensual y anual). Las cifras son la fuente de verdad de
`frontend/src/lib/pricing.ts` (`REGIONS`). El anual aplica **−15%** (`ANNUAL_DISCOUNT`),
redondeado (`Math.round`), y se factura como `interval: year` por el total de 12 meses.

Productos:

| Product (slug) | Nombre | Notas |
|---|---|---|
| `esencial` | DOCYAN LDE Esencial | 1 plan, sin seats adicionales |
| `profesional` | DOCYAN LDE Profesional | seat adicional regional |
| `enterprise` | DOCYAN LDE Enterprise | precio "desde"; ventas cierra contrato custom |

Precios mensuales base por región (de `REGIONS[r].plans`), moneda en `REGIONS[r].currency`:

| Región | Moneda | Esencial /mes | Profesional /mes | Enterprise (desde) /mes |
|---|---|---|---|---|
| USA / CA | USD | 299 | 699 | 2500 |
| UE | EUR | 289 | 679 | 2450 |
| UK | GBP | 249 | 589 | 2099 |
| AU | AUD | 459 | 1079 | 3849 |
| MX | MXN | 4990 | 11990 | 42500 |
| LatAm | USD | 229 | 529 | 2500 |

Precios anuales (mensual × 0.85 redondeado; el Price anual cobra `× 12` por año):

| Región | Esencial anual /mes (×12 al año) | Profesional anual /mes (×12 al año) | Enterprise anual /mes (×12 al año) |
|---|---|---|---|
| USA / CA | 254 (3,048) | 594 (7,128) | 2125 (25,500) |
| UE | 246 (2,952) | 577 (6,924) | 2083 (24,996) |
| UK | 212 (2,544) | 501 (6,012) | 1784 (21,408) |
| AU | 390 (4,680) | 917 (11,004) | 3272 (39,264) |
| MX | 4242 (50,904) | 10192 (122,304) | 36125 (433,500) |
| LatAm | 195 (2,340) | 450 (5,400) | 2125 (25,500) |

> Total = `mes_anual × 12`. Diferencias de ±1 unidad pueden surgir por el orden de
> redondeo; **la fuente de verdad es `priceFor(region, plan, annual)`** en
> `pricing.ts`. Al crear los Prices en Stripe, usar el valor que arroja esa función.

Setup fee inicial (de `REGIONS[r].setup`, cobro único — recomendado como un
`invoice item` o un Price `one_time` separado, no recurrente):

| Región | Esencial | Profesional | Enterprise |
|---|---|---|---|
| USA / CA | $199 | $499 | Custom |
| UE | €199 | €499 | Custom |
| UK | £179 | £429 | Custom |
| AU | AUD 309 | AUD 769 | Custom |
| MX | MXN 3,490 | MXN 8,490 | Custom |
| LatAm | $159 | $379 | Custom |

Seat de admin adicional (`REGIONS[r].seats` = `[Profesional, Enterprise]`), recurrente
mensual, cantidad variable:

| Región | Seat Profesional /mes | Seat Enterprise /mes |
|---|---|---|
| USA / CA | 49 | 39 |
| UE | 47 | 37 |
| UK | 42 | 34 |
| AU | 75 | 60 |
| MX | 825 | 660 |
| LatAm | 49 | 39 |

Recargas de saldo de ingesta (`RECHARGE_PRESETS_USD`, USD-equivalente, mostradas en
moneda regional vía `fmtMoney`): **$50 · $100 · $250 · $500**. Implementar como pagos
únicos (`PaymentIntent` / Checkout `mode: payment`), **sin auto-recarga** (protección
financiera — saldo prepagado finito + hard cap).

> Mapear cada Stripe `price_id` resultante a `(region, plan, period)` en la
> configuración del backend (o en una tabla `stripe_prices`), para que el
> backend/checkout cree la suscripción con el precio correcto según la región del
> tenant.

---

## 2. Variables de entorno

| Variable | Dónde | Ejemplo (test) | Notas |
|---|---|---|---|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Frontend (build, Vercel) | `pk_test_…` | Inlined al build. `STRIPE_ENABLED` = empieza con `pk_`. Sin esto, UI cae al estado B9.1. |
| `STRIPE_SECRET_KEY` | Backend / route handler (server) | `sk_test_…` | **Nunca** al cliente. Instanciado lazy dentro del handler. |
| `STRIPE_WEBHOOK_SECRET` | Server (route handler) | `whsec_…` | Del endpoint de webhook en el dashboard de Stripe. |

En test → live: cambiar `pk_test_`→`pk_live_`, `sk_test_`→`sk_live_`, y crear un
**nuevo** `whsec_` para el endpoint live (los signing secrets no se comparten entre
modos). Recrear todos los Products/Prices en modo live (no se migran de test).

---

## 3. Webhook

- **Endpoint:** `POST /api/stripe-webhook`
  (ruta Next: `frontend/src/app/(public)/api/stripe-webhook/route.ts`,
  `runtime = "nodejs"`, firma verificada contra el **raw body** vía
  `stripe.webhooks.constructEvent`).
- Si falta `STRIPE_SECRET_KEY` o `STRIPE_WEBHOOK_SECRET` → responde **503**
  `"Stripe not configured (B9.1)"`.
- Si falta el header `stripe-signature` o la firma no valida → **400**.
- En éxito → **200** `{ received: true }`.

Eventos manejados (cada uno hace forward best-effort al backend + evento FAT;
ningún fallo del backend tumba el ack del webhook):

| Evento Stripe | Acción backend (best-effort) | FAT |
|---|---|---|
| `checkout.session.completed` | `/admin/subscriptions/activate` (activar suscripción + aprovisionar org + welcome) | `governance · subscription.activated` |
| `invoice.payment_succeeded` | `/admin/subscriptions/invoice-paid` | `governance · invoice.payment_succeeded` |
| `invoice.payment_failed` | `/admin/subscriptions/invoice-failed` | `governance · invoice.payment_failed` |
| `customer.subscription.updated` | `/admin/subscriptions/updated` | `governance · subscription.updated` |
| `customer.subscription.deleted` | `/admin/subscriptions/deleted` | `governance · subscription.deleted` |
| (otros) | — | `system · stripe.event.unhandled` |

> Los endpoints `/admin/subscriptions/*` y `/admin/fat/event` son los contratos
> que el backend debe exponer en B9.1. El webhook ya los invoca; falla en silencio
> si aún no existen.

Configurar el endpoint en el dashboard de Stripe → Developers → Webhooks → Add
endpoint → URL pública `https://<dominio>/api/stripe-webhook` → seleccionar los 5
eventos de arriba → copiar el `whsec_` a `STRIPE_WEBHOOK_SECRET`.

---

## 4. Tarjetas de prueba (modo test)

| Escenario | Número | Notas |
|---|---|---|
| Pago exitoso | `4242 4242 4242 4242` | Cualquier fecha futura + CVC + CP |
| Requiere 3DS / SCA | `4000 0025 0000 3155` | Dispara autenticación |
| Tarjeta rechazada | `4000 0000 0000 0002` | `card_declined` |
| Fondos insuficientes | `4000 0000 0000 9995` | `insufficient_funds` |
| OXXO (MX) | usar `payment_method_types: ["oxxo"]` | Genera voucher; en test se confirma manual |
| SEPA (UE) | IBAN `DE89370400440532013000` | Débito SEPA test |

Para webhooks en local: `stripe listen --forward-to localhost:3000/api/stripe-webhook`
y usar el `whsec_` que imprime el CLI.

---

## 5. Nota explícita B9.1

> La configuración **real** de la cuenta Stripe (productos, precios, claves live,
> dominio custom de Checkout) y el **switch test→live** se realizan en **B9.1**, en
> la cuenta Stripe de Jorge. Este sprint deja **todo el código** listo y probado
> contra claves de test/placeholder; **no** se creó ningún producto ni se llamó a
> una cuenta Stripe en vivo. Mientras `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` no sea un
> `pk_…` válido, la UI permanece en estado "configuración Stripe en B9.1" con el
> layout completo y los flujos de recarga/pago deshabilitados o vía mailto.
