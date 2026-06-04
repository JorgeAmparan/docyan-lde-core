# Handoff: DOCYAN LDE — Design System + UI Kits (Capa A + Capa B)

> Read this first. It tells a developer (or Claude Code) how to turn this bundle into production code. The deep reference lives in **`README.md`** (brand, voice, visual foundations) and **`colors_and_type.css`** (all tokens). This file is the orientation layer on top of those.

## Overview
DOCYAN LDE is a **living documentary-knowledge environment** for regulated industries. The product has two layers that share one identity:
- **Capa A** — the authenticated collaborator/admin PWA (`ui_kits/pwa/`): scan a persistent QR → ask → get an answer **with a clickable citation to the source span**; save consultas that graduate into Playbooks; admin dashboards.
- **Capa B** — the public commercial layer (`ui_kits/commercial/`): landing, regional pricing, Stripe signup, account dashboard.

## About the design files (READ THIS)
Every `.html` / `.jsx` / `.css` file in this bundle is a **design reference built in HTML** — a cosmetic prototype showing the intended look, copy, and behavior with **canned data and no backend**. They are **not** production code to copy verbatim.

**Your job:** recreate these designs in the target codebase using its established patterns. Per the brief, that target is **Next.js 15 + React 19 + Tailwind + shadcn/ui (on Radix) + react-i18next**, deployed on Vercel, consuming an already-built backend via typed REST. If you are starting greenfield, use that stack. Lift exact token values from `colors_and_type.css` into `tailwind.config`; rebuild the kit components as shadcn/Radix components; replace the Lucide CDN with `lucide-react`.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, shadows, motion, copy, and interactions are final and intentional. Recreate the UI pixel-faithfully. Where a value isn't obvious, read it from `colors_and_type.css` (it is the source of truth and mirrors 1:1 into Tailwind). The only deliberately rough spots are **striped image placeholders** (technical diagrams, video clips, hero/vertical photography) — these await real warm-toned documentary assets from XCID.

## How to run the references
- `ui_kits/pwa/index.html` — open it; use the top switcher to flip **Colaborador · móvil** ↔ **Admin · escritorio**.
- `ui_kits/commercial/index.html` — open it; use the top switcher for **Landing · Precios · Signup · Cuenta** (plus secondary pages and **Landing v1**). The default Landing is **v2 (FLOW)**.
- `preview/*.html` — one-concept design-system cards (colors, type, spacing, brand objects, components).
No build step — they load React + Babel + Lucide + IBM Plex from CDN and `../../colors_and_type.css`.

## Screens / Views to implement

### Capa A — PWA (`ui_kits/pwa/`)
| View | Purpose | Key components |
|---|---|---|
| **Acceso** | Admin login + CoDo selection | Email/password login (collaborators never log in — the QR is the credential); CoDo-selection grid with search for multi-CoDo admins |
| **Onboarding** | Admin first-run | 7-step wizard: welcome → org → first CoDo → ingest → first QR → first consulta → invite collaborators |
| **Consult (collaborator, phone)** | QR → ask → cited answer | Always-visible context strip; bottom-anchored query box (mic + send); entity card with suggested questions; **8 intent-type answer renderers** (below); citation pedigree chip on every answer; save-consulta → progressive Playbook nudge at ≥2 saves |
| **Saved consultas / Playbook** | Review & run a captured routine | Bottom sheet of saved consultas; composed Playbook run; cited-source overlay with the exact span highlighted |
| **Admin · Resumen** | Measure | PCL metrics (hit rate / cost-per-consulta / P95); CoDo cards; EDB patterns detected; ingest balance; SHA-256 chain verifier |
| **Admin · CoDos** | Navigate & govern knowledge | **Expediente esquemático** as the focal canvas (entity hub + immediate relations: documentos/procedimientos/calibración/alertas, with an always-on goal strip and a compacto/detallado density toggle) + a Documentos mode with granular tree, cross-document search, annotations (`:Observacion`, recurring-pattern surfacing) + CoDo config (vertical, language pairs, cache threshold, criticality) |
| **Admin · Alertas** | Administrative reminders | Grouped by criticality; mandatory administrative-only banner; read/snooze |
| **Admin · Ingesta** | Document intake & cost | Pre-ingest quote (cost + time + balance); processing queue (retry/cancel); history; prepaid balance |
| **Admin · Gobernanza & FAT** | Audit & guardrails | GRG confidence thresholds by criticality; quarantined outputs w/ justification; FAT audit log w/ family filters + PDF/XML/JSON/CSV export + chain verifier |
| **Admin · Generar QRs** | Print physical QRs | The DOCYAN QR brand object (corner-bracket frame, cinnabar, discrete logo); CoDo/entity/format selection; print/download; recent batch |
| **Admin · Usuarios** | Team | Admins (seat cost) + unlimited free collaborators; invite; per-user prefs (language pair, regional variant, proactive-AI toggle) |

**The 8 intent-type answer renderers** (in `consult.jsx`, all built — each is conditionally rendered by classified intent):
1. **Informativa** — big value + unit + citation.
2. **Guía paso a paso** — numbered steps + PPE chips + ANSI-Z535-tone warning.
3. **Gráficos / Diagramas** — image viewer with numbered pins over the diagram + synced legend + pinch-to-zoom.
4. **Video** — player with scrubber + CC + Capítulos/Transcripción tabs (timestamped, navigable).
5. **Troubleshooting** — interactive decision tree, one node at a time, decision history.
6. **Historial** — filterable timeline + "Patrones detectados" (EDB / Nivel 3) card.
7. **Alertas** — grouped-by-criticality dashboard. **Mandatory administrative-reminder banner; never ANSI red.** Read/snooze actions.
8. **Comparativa** — +/−/~ diff between revisions + executive summary + EDB insight.

### Capa B — Commercial (`ui_kits/commercial/`)
| View | Purpose | Key components |
|---|---|---|
| **Landing (v2 · FLOW — default)** | Explain DOCYAN + let the visitor experience it | **Brand lockup** (DOCYAN LDE · by XCID) → eyebrow → headline; **playable FLOW hero**: an interactive consult demo where the visitor asks and gets a real cited answer (calls Claude via `window.claude.complete`, falls back to canned; the input shows a blinking caret + cinnabar focus ring to invite use); **three-levels** as a connected 01→02→03 progression with a distinct mini-visual per card (cita / Playbook sequence / patterns hub); **moat** = expediente esquemático visual; then problem, how-it-works, verticals, differentiators, regulatory, footer. This is the file `landing-flow.jsx`. |
| **Landing v1** | Original static landing (preserved) | Static "magic moment" mock hero + the same downstream sections. Reachable via the switcher's "Landing v1". File: `landing.jsx`. |
| **— Hero · vertical selector** | Let the visitor pick their industry | The FLOW hero carries a **5-vertical segmented selector** (Laboratorios/Maquiladoras/Pharma/Mining/Agribusiness). Switching swaps the demo CoDo, suggested questions and grounded answers (200ms fade). Bottom trust chips expanded to 5 (adds "Sin alucinaciones por diseño", "Gobernanza activa por criticidad"). |
| **— Functional citation → PDF** | Prove the answer is grounded | The citation chip is **functional**: pointer + hover cinnabar shadow + tooltip; a sibling **"Abrir PDF"** ghost button removes ambiguity. Click → 200ms shimmer → opens the source document in a new tab **scrolled to the exact highlighted span** (`demo-doc.html`). Curated questions map to a real doc span; this is the anti-hallucination proof. In production, swap `demo-doc.html` for the real PDF at `#page=N`. |
| **Explora un CoDo demo** | Navigable demo, no signup | Section under the hero: grid of **5 cards** (one per vertical) → a public **demo-CoDo explorer** (`DemoConsult`, in `demo-flow.jsx`) that runs the **full consult flow**: **multi-turn thread** (answers accumulate, scrollable), **conditional renderers by intent type** (info big-value, guía steps+EPP+ANSI, diagram w/ pins, video, troubleshoot decision-tree, history timeline+pattern, alerts grouped, compare diff) distributed across verticals so discovery surprises, and an **in-app source overlay** that threads to the exact span on tapping the cite (plus "Abrir PDF"). Banner with [Agendar demo]/[Regístrate]. Route `demo:<vertical>`. Every curated answer carries cite/doc/page/span (grounded); free-text input is live-AI representative. | consult grammar preloaded with that vertical's CoDo, live AI + grounded curated answers, and a discreet "estás en un CoDo demo" banner with [Agendar demo]/[Regístrate]. Route `demo:<vertical>`. |
| **Gobernanza por diseño** | The other differentiator | New section between Tres niveles and Casos de uso: **4 connected layers** (pedigree a span · umbrales por criticidad ≥0.95/0.90/0.85 · freno de alucinación · cadena SHA-256), technical voice (no "AI sin alucinaciones"), closing line. Plus a 3rd trust message in "El problema" and a governance↔compliance paragraph in Marcos regulatorios. |
| **Precios** | Regional pricing | Region selector (USA/CA · UE · UK · AU · MX · LatAm) live-swaps every figure/currency; monthly/annual toggle (−15%); 3 plan cards (Profesional recommended); full comparison table. Figures match the brief exactly |
| **Signup** | Convert | 4-step Stripe checkout (Plan → Cuenta+Org → Datos fiscales CFDI → Pago tarjeta/OXXO-SPEI) → confirmation → onboarding handoff; progress stepper |
| **Cuenta** | Manage account | Plan & next billing; usage meters (docs vivos / almacenamiento / saldo de ingesta); invoices with PDF; recharge balance |
| **Vertical** | Use-case landing (per industry) | Template (shown: Laboratorios ISO 17025): problem, example collaborator flow, applicable frameworks, product-shot placeholder, CTA |
| **Cómo funciona** | Technical positioning | ingesta → grafo → consulta clasificada → respuesta con pedigree architecture flow; for CIOs/IT/architects |
| **Seguridad** | Security & compliance | Multi-tenancy, RLS por tenant, SHA-256 chain, GDPR/Privacy Act AU/Aviso MX, on-premise (Enterprise), responsible disclosure |
| **Acerca de** | About XCID | Invisible engine framing, náhuatl root of the name, commercial contact |
| **Estado** | Status page | Overall state, per-component status, recent incidents, uptime |
| **Soporte** | Help center | Searchable; categories, popular articles, contact form |

## Interactions & behavior
- **Flow del usuario experto** (governs every long-session surface — the CoDos expediente, entity views, Playbook building, granular nav): keep the **goal strip** naming the current entity/CoDo always visible; make every node selection respond instantly (no spinner on local navigation); give the user **density control** (compacto/detallado, expand/collapse, filter) instead of a fixed layout; keep all EDB suggestions **on-demand in a visible place**, never pushed. Focal surface = one cognitive object (entity + immediate relations), not a multi-widget overview. See README → "Flow del usuario experto".
- **Motion** — default ease `cubic-bezier(0.16,1,0.3,1)`, durations 120/200/320ms (tokens `--ease-out`, `--dur-*`). Animate: cited span "threading" to its source on tap; answer compose-in (cache = instant, synthesis = brief "buscando" shimmer); Playbook steps unfolding; step-by-step advance. **No bounce, no infinite decorative loops, no parallax.** Respect `prefers-reduced-motion`.
- **Hover/press/focus** — primary darkens to `cinnabar-600` + cinnabar glow; secondary/ghost get `amate-100` wash; press = 1px translate-down / scale .99; focus = 3px `cinnabar-50` ring + `cinnabar-500` border (keyboard-first, AA).
- **Answer mode line** — every answer shows whether it was instant (cache, jade dot) or synthesized (warning dot, blinking).
- **Responsive** — collaborator surfaces are mobile-first (bottom query box, ≥48px controls); admin/account are desktop-dense; landing breathes. Reading column max-width ~720px.
- **Landing v2 hero demo (live AI)** — the hero consult demo calls Claude via `window.claude.complete` (model `claude-haiku-4-5`, ~1024-token cap, rate-limited) with a prompt that returns `{answer, cite}` JSON; it renders the answer + a citation pedigree that "threads" to a source line. On any failure it falls back to canned answers so the hero is never blank. **These answers are representative for the demo, not read from a real manual** — in production, point this hero at a real sample CoDo (typed REST) rather than free-form generation, and keep the same answer/citation render.

## State management (for the live product)
- **Consult:** message list (user turns + answer objects keyed by classified intent), saved-consulta IDs, source-overlay open/target span, query draft, mic state.
- **Progressive naming:** the word **"Playbook" must not appear** until ≥2 related saved consultas + repetition — gate it on saved-count + relatedness, not a static flag.
- **Pricing:** active region (default from geo-detect, user-overridable) + billing period drive all figures.
- **Signup:** stepper index + plan + org + fiscal + payment-method.
- **i18n:** ES + EN minimum (ES MX/CO/AR · EN US/UK/AU), expandable; copy must survive ~+35% length growth (German) — no fixed-width labels.

## Design tokens
**Do not hand-transcribe — import `colors_and_type.css`** (CSS variables + semantic type classes) and mirror into `tailwind.config`. Headlines:
- **Amate** (warm paper) surfaces — canvas `amate-50` `#FAF7F1`, cards pure white. **Tlilli** (warm ink) text — body `ink-900` `#211C16`, never pure black. **Tlapalli / cinnabar** `#CF4124` — the single brand accent = primary CTAs + citation pedigree + focus + QR brackets; reserved, so it means something.
- **Semantic:** success jade `#2C7A57`, warning amber `#C0820F`, caution `#E6B72E`, **danger true-ANSI red `#C2160E` (operational STOP only — never for brand or admin alerts)**, info teal-slate `#3E6E78` (intentionally not corporate blue).
- **Type:** IBM Plex Sans (UI/display), IBM Plex Mono (data/citations/eyebrows, tabular), IBM Plex Serif (document moments). Body never below 14px in product, 16px on collaborator surfaces.
- **Radii:** md 8px (controls, shadcn-compatible), lg 12px (cards), 2xl 22px (QR plate/sheets). **Spacing:** 4px base, 8px gutters, controls 40px desktop / 48px touch, tap targets ≥44px. **Shadows:** warm, ink-tinted (rgba 33,28,22), never black/blue; one reserved cinnabar glow for primary CTAs.
- **Dark mode:** warm dark (`ink-950` canvas), cinnabar lifts to `cinnabar-400`. Recommended for collaborators in variable lighting.

## Assets & iconography
- **Icons:** [Lucide](https://lucide.dev) (stroke only, ~1.75px, `currentColor`). Use `lucide-react` in production. **Swappable** — there was no inherited set. Icon-only buttons need `aria-label`. **No emoji, ever.**
- **Brand glyphs (bespoke, not Lucide):** the corner-bracket "span" mark (`assets/docyan-mark.svg`) and its derivatives (citation bracket, QR frame). These are brand objects.
- **Placeholders:** striped boxes mark where real **warm-toned documentary photography / technical diagrams / video** go. Commission/source real assets — do not ship the placeholders or substitute stock-blue corporate imagery.
- **Fonts:** IBM Plex (real typefaces) currently load from Google Fonts CDN. For the offline-first collaborator PWA, **self-host `.woff2`** — see `fonts/README.md`.

## Non-negotiables (from the brief)
- **Cinnabar is the citation color.** Every answer carries a tappable pedigree chip to the exact source span; keep the corner-bracket "span" motif.
- **Progressive naming.** "Playbook" only after it's earned; before that it's "consulta guardada".
- **Alerts are administrative only** — never clinical/operational instructions; reinforce in copy and visual tone.
- **Voice:** direct, competent, no marketing-speak (`revoluciona`, `AI-powered`, etc. banned), no emoji. Spanish uses *tú*. Mono UPPERCASE only for technical labels (tracked 0.12em).
- **Accessibility:** WCAG 2.1 AA; tap targets ≥44px (gloves); never rely on color alone (status carries dot/icon + text); visible focus; screen-reader labels on icon-only controls.

## Files in this bundle
- `README.md` — full design-system spec (brand spine, content fundamentals, visual foundations, iconography, manifest, open flags). **The deep reference.**
- `colors_and_type.css` — all tokens as CSS variables + semantic type classes. **Mirror into Tailwind.**
- `SKILL.md` — front-matter so this folder works as a Claude Code skill (`docyan-design`).
- `assets/` — `docyan-mark.svg` and brand assets.
- `fonts/` — IBM Plex loading + self-hosting notes.
- `preview/` — design-system cards (one concept each), with `_card.css` scaffold.
- `ui_kits/pwa/` — Capa A. See its `README.md`. Components: `app.jsx` (shell/switcher: Colaborador / Acceso / Onboarding / Admin), `atoms.jsx` (Icon/Mark/Cite), `consult.jsx` (consult + 8 renderers), `playbook.jsx` (saved/Playbook/source overlay), `admin.jsx` (admin shell + Resumen), `admin-views.jsx` (CoDos/Alertas/Ingesta/Gobernanza/QRs/Usuarios + QR plate), `access.jsx` (login/CoDo-select/onboarding); `pwa.css` + `admin.css`.
- `ui_kits/commercial/` — Capa B. See its `README.md`. Components: `app.jsx` (shell/routing/region + `demo:<vertical>` route), `atoms.jsx`, `demo-data.jsx` (5-vertical grounded multi-intent Q&A + docs), `landing.jsx` (Landing **v1** + shared Nav/Footer + reused sections), `landing-flow.jsx` (Landing **v2**: vertical-selector FLOW hero w/ live AI + functional citation, `DemoExplore`, `GovernanceSection`, three-levels progression, moat), `demo-flow.jsx` (full demo-CoDo consult: multi-turn `DemoConsult`, the 8 intent renderers, in-app `SourceOverlay`), `demo-doc.html` (simulated source-PDF viewer w/ highlighted span), `pricing.jsx`, `signup.jsx`, `account.jsx`, `pages.jsx`; `site.css`..jsx` (Landing **v1** + shared Nav/Footer + reused sections), `landing-flow.jsx` (Landing **v2**: vertical-selector FLOW hero w/ live AI + functional citation, `DemoExplore`, `DemoConsult`, `GovernanceSection`, three-levels progression, moat), `demo-doc.html` (simulated source-PDF viewer w/ highlighted span), `pricing.jsx`, `signup.jsx`, `account.jsx`, `pages.jsx` (vertical/how/security/about/status/support); `site.css`.
- `uploads/full_brief-1780510608597.md` — the complete XCID brief (single source of truth for product scope, flows, pricing tables, verticals).

## Known gaps / next steps
All screens enumerated in the brief (Capa A §5 and Capa B §6) are now built as design references. Remaining work is implementation-side and asset-side, not missing screens:
- **Real assets:** striped placeholders (technical diagrams, video clips, vertical/hero photography, product screenshots) await real warm-toned documentary material from XCID.
- **Open brand flags:** fonts not yet self-hosted; Lucide chosen (swappable); logo/cinnabar-hue/QR treatments are original proposals open to XCID direction. See `README.md` → "Flags & substitutions".
- **Depth not separately mocked** (reuses established grammar): per-vertical variants beyond the Laboratorios template; secondary-state flows (payment declined, retention/cancel, 2FA, active sessions); public docs article bodies. Build these from the patterns already in the kits.
