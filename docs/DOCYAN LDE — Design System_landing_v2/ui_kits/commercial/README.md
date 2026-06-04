# UI Kit — Capa B · Capa comercial pública

The public layer that captures prospects, converts them, and lets them manage their account. Open `index.html`; use the top **kit switcher** (Landing · Precios · Signup · Cuenta) to move between surfaces. Nav links and CTAs also navigate.

## What's interactive
- **Landing** — hero with the "magic moment" product mock (QR context → question → cited answer) and floating brand-object tags; problem; how-it-works (3 steps); the **three levels** on the dark `ink` band; verticals; differentiators; regulatory frameworks + the administrative-only disclaimer; footer with region/language + status. Nav + footer links navigate to every secondary page.
- **Precios** — **regional detection selector** (USA/CA · UE · UK · AU · MX · LatAm) live-swaps every figure and currency; monthly/annual toggle (−15%); three plan cards (Profesional recommended); full feature comparison table. Figures match the brief exactly.
- **Signup** — 4-step Stripe checkout (Plan → Cuenta+Org → Datos fiscales CFDI → Pago con tarjeta/OXXO-SPEI) → confirmation → hands off to onboarding. Stepper shows progress.
- **Cuenta** — authenticated account-management dashboard: plan & next billing, usage meters, invoices with PDF, recharge balance. (Distinct from the operational admin dashboard in the PWA kit.)
- **Vertical** — use-case template (shown: Laboratorios ISO 17025): problem, example collaborator flow, applicable frameworks, product-shot placeholder, CTA. One page per vertical reuses this grammar.
- **Cómo funciona** — technical/conceptual: ingesta → grafo → consulta clasificada → respuesta con pedigree architecture flow + technical positioning for CIOs/architects.
- **Seguridad** — multi-tenancy, RLS por tenant, SHA-256 chain, GDPR/Privacy Act AU/Aviso MX, on-premise (Enterprise), responsible disclosure.
- **Acerca de** — XCID as the invisible engine, the náhuatl root of the name, commercial contact.
- **Estado** — status page: overall state, per-component status, recent incidents, uptime.
- **Soporte** — searchable help center: categories, popular articles, contact form.

## Files
| File | Role |
|---|---|
| `index.html` | Entry |
| `site.css` | All commercial styles on top of `../../colors_and_type.css` |
| `atoms.jsx` | `Icon`, `Mark` |
| `landing.jsx` | Landing sections + shared `Nav` / `Footer` |
| `pricing.jsx` | Regional pricing data, plan cards, comparison table |
| `signup.jsx` | Stripe checkout stepper |
| `account.jsx` | Account-management dashboard |
| `app.jsx` | Shell + page routing (grouped switcher) + region state |
| `pages.jsx` | Secondary pages: vertical, cómo funciona, security, about, status, support |

## Coverage
All public surfaces are built: landing, pricing, signup, account, the six secondary pages (vertical use-case, cómo funciona, security, about XCID, status, support center), and shared Nav/Footer wired to navigate between them. Cosmetic recreation, canned data; lift into the real Next.js + shadcn build.
