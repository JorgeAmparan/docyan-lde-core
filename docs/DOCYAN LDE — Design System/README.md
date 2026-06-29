# DOCYAN LDE™ — Design System

**Live Document Environment by XCID** · XCID SA de CV (México)

This repository is the visual + interaction design system for DOCYAN LDE. It exists so any designer or agent can produce on-brand interfaces and assets — production code or throwaway mocks — without re-deriving the brand each time.

> **Status:** v1 foundations. Greenfield brand — there was no prior logo, codebase, or Figma to anchor to, so the identity below was established from the design brief. Everything here is a **proposal open to iteration** (see the bold ask at the bottom of this file / in the chat).

---

## 1. What DOCYAN is (so the design reflects it)

DOCYAN is a **living documentary-knowledge environment** for regulated industries (ISO 17025 labs, IMMEX maquiladoras, pharma, mining, agribusiness). An organization's documents stop being dead and scattered and become **instantly consultable, where they're needed, by whoever needs them**. An collaborator scans a QR stuck to a machine, asks a question, and gets an answer **with a clickable citation to the exact source span**.

Commercial category: **Connected Worker Platforms / Industrial Copilots** (Tulip, Dozuki, Augmentir, Poka). DOCYAN positions as **anti-Dozuki**: ingests the document as-is, time-to-value in days not months, transparent pricing.

**Three levels of value the design must communicate, in order of appearance:**
1. **Consulta viva (the hook)** — scan QR → ask → answer with citation. Real-time, at the point of use.
2. **Playbooks (appropriation)** — the user captures *how* they consult as a reusable object. ⚠️ **Progressive naming: the word "Playbook" is NOT shown until the user's behavior earns it** (≥2 related saved consultas + repetition). Before that it is only "consulta guardada".
3. **Inteligencia organizacional (the moat)** — patterns detected, tacit knowledge retained when people leave.

**Three concepts the design names visually:**
- **CoDo** (Contexto Documental) — the client's unit of organization: a coherent set of documents-in-context (e.g. a CNC + its manuals + MSDS + calibration history). English: *DoCo*. Taught at first contact, no heavy explanation.
- **QR persistente** — physical label on equipment; the collaborator's door into the CoDo. **A brand object.**
- **Playbook** — a captured, reusable way of interrogating knowledge. Progressive naming (above).

---

## 2. Audiences

| Audience | Device | Context |
|---|---|---|
| **Collaborator on the floor** | Phone / tablet, possibly gloves | Visual noise, fragmented attention, scans QR. Big type, large tap targets, voice-to-text. |
| **Org admin** | Desktop / tablet | Configures, ingests docs, reads metrics, generates QRs. Dense, efficient layouts. |
| **Economic decision-maker** | Desktop | Approves budget, doesn't use daily. Must understand DOCYAN in 30s on the landing. |

---

## 3. The two layers (one product, two densities)

- **Capa A — Operational product (authenticated PWA):** consult view with conditional rendering by 8 intent types, granular CoDo navigation, Playbooks A/B/C, admin dashboards (org / ingest / governance), QR generation, onboarding. Fully responsive (collaborator mobile + tablet + admin desktop).
- **Capa B — Public commercial layer:** landing, regional pricing, vertical use-case pages, Stripe signup, authenticated account dashboard, support, status page.

Both layers share typography, palette, iconography and tone. They differ only in **informational density** (the landing breathes; the product is functional and dense), never in identity.

---

## 4. The identity in one paragraph

The conceptual spine is the náhuatl couplet **"in tlilli, in tlapalli"** — *the black ink, the red ink* — the Aztec metaphor for **writing / knowledge / the codex itself**. A perfect, non-folkloric substrate for a living-document product made in Mexico (XCID; *Yan* = "place" → "the place of the documents"). It yields the palette directly: **tlilli** = warm near-black ink; **tlapalli** = codex cinnabar (the accent and the citation color — codices were written in red and black); **amate** = the warm paper of the codex (backgrounds). Two brand objects — the **citation pedigree chip** and the **persistent QR** — share one **corner-bracket "span" motif** that also forms the logo mark. Type is **IBM Plex** (Sans + Mono + Serif): engineered for technical/industrial rigor, multilingual, free. The result reads as competent, document-native, and warm — and is unmistakably *not* the corporate blue + green of the CWP category.

---

## 5. Sources & references given

- **`uploads/full_brief-1780510608597.md`** — the complete design brief from XCID (screens, flows, regional pricing tables, verticals, Playbook behavior, signup, tone). The single source of truth for product scope. *Do not assume the reader has access — it is stored here in case they do.*
- No codebase, Figma, logo, or prior brand was provided (greenfield). The implementation stack (per brief) will be **Next.js 15 + React 19 + Tailwind + shadcn/ui on Radix + react-i18next**, deployed on Vercel; the backend (B0–B8.5) is already built (FastAPI + FalkorDB + Supabase + Redis + BGE-M3 + LiteLLM), consumed via typed REST.

---

## 6. CONTENT FUNDAMENTALS — how DOCYAN writes

The voice is **competent calm**: people who work in regulated industry talking to peers who do too. Never consultant-tech, never consumer-cute.

**Principles**
- **Direct.** Short sentences. Active verbs. Zero filler. *"Escanea. Pregunta. Obtén respuesta con cita."*
- **Competent.** Speaks about regulation with familiarity (NOM, ISO, IATF, FDA, TGA), not as if discovering it.
- **Respects the expert.** The collaborator and admin know their jobs. The product assists; it never infantilizes or over-explains.
- **No marketing-speak.** Banned: *revoluciona, disruptivo, next-gen, AI-powered, empodera, plataforma cognitiva, transforma tu operación.*
- **No empty techno-jargon.** What matters is the outcome — *answer with a citation to the source* — not the machinery.

**Person & address**
- Spanish: **tú** (direct, respectful, not formal *usted*) — *"Tus documentos dejan de estar muertos."*
- English: **you**, plain and operational.
- The product speaks about itself as **DOCYAN** in the third person when it acts (*"DOCYAN responde con cita a la fuente"*), not "we/our AI".

**Casing & mechanics**
- Sentence case for almost everything — headings, buttons, labels. **No Title Case Marketing Headers.**
- `UPPERCASE` only for **mono eyebrows / technical labels** (e.g. `CODO-LAB-04`, `NOM-018-STPS`, `CITA · PEDIGREE A FUENTE`), tracked at 0.12em.
- Product terms keep their exact casing: **DOCYAN** (all caps wordmark), **CoDo** / **DoCo**, **Playbook** (capital P, and only once earned), **LDE™**.
- **Role naming:** the floor user is the **Colaborador** (EN: *collaborator*) — **not "operador"**. The brief (XCID's source doc) still uses *operador/consultor*; this design system standardizes on **colaborador** across all UI and copy. Admins remain **Admin de organización**.
- Numbers, units, IDs, latencies, thresholds → **IBM Plex Mono, tabular** (`85 N·m`, `P95 · 1.4s`, `0.92`, `§4.2.1`).

**Emoji:** **none.** Not in product, not in marketing. Iconography carries that load (Lucide).

**Regulatory guardrail in copy (absolute):** alerts are **administrative reminders only** — never clinical/operational instructions. Copy and visual tone must reinforce this (*"Recordatorio administrativo — no es una instrucción operativa."*). Critical procedural warnings follow **ANSI Z535** tone (DANGER / WARNING / CAUTION) in step-by-step guides.

**Progressive disclosure in copy:** "guardar consulta" → (after repetition) introduce **Playbook** with a single explanatory line: *"Un Playbook es una secuencia de consultas que repites como rutina."* Never lead with the jargon.

**Multilingual:** ES + EN minimum, expandable (PT/FR/DE/IT on the landing). Regional variants within each (ES MX/CO/AR · EN US/UK/AU). Default language follows detected region with an explicit user toggle. Design copy to **survive length variation** between languages (German ~+35%, no fixed-width labels).

---

## 7. VISUAL FOUNDATIONS

**Palette** — see `colors_and_type.css` and the Colors cards.
- **Amate** (warm bone/paper) — backgrounds and surfaces. App canvas is `amate-50` (#FAF7F1); cards are pure white to lift off the paper. Warmth comes from the canvas, not from tinting every surface.
- **Tlilli** (warm ink) — text and dark surfaces. Body text is `ink-900` (#211C16), **never pure black** — softer, document-native contrast on paper.
- **Tlapalli** (cinnabar #CF4124) — the single brand accent. Used sparingly and meaningfully: primary CTAs, the citation pedigree, focus rings, QR brackets. Because it's reserved, it *means* something every time it appears.
- **Semantic** — success (deep jade #2C7A57), warning (amber #C0820F), caution (#E6B72E), **danger (true ANSI red #C2160E — deliberately crimson, not the orange cinnabar, so brand ≠ alarm)**, info (muted teal-slate #3E6E78, intentionally not corporate blue).
- **Dark mode** — warm dark (ink-950 canvas), never cold. Cinnabar lifts to `cinnabar-400` for contrast. Recommended for collaborators in variable lighting.

**Type** — IBM Plex Sans (UI + display, 400/500/600/700), IBM Plex Mono (data, citations, QR labels, eyebrows), IBM Plex Serif (document-rendering moments only). Display is Plex Sans bold at tight tracking (−0.02em). Scale documented on the Type cards. Min sizes: body never below 14px in product; 16px on collaborator surfaces.

**Spacing** — 4px base. Default control height 40px (desktop), **48px on touch/collaborator surfaces; tap targets never below 44×44px** (gloves, WCAG). Layout gutters in multiples of 8.

**Radii** — `md` 8px is the default control radius (shadcn-compatible); `lg` 12px for cards; `2xl` 22px for the QR plate and large sheets. Nothing fully pill-shaped except badges/toggles.

**Backgrounds** — flat warm paper. **No gradient backgrounds, no purple-blue washes, no hero gradients.** Texture, if ever used, is an extremely subtle paper grain — optional, never loud. Imagery (when real photos arrive) should be **warm-toned, documentary, real industrial environments** — not stock-blue corporate offices. Full-bleed photography is reserved for landing hero and vertical pages.

**Elevation / shadows** — warm and low, tinted with ink (rgba 33,28,22), **never black or bluish**. Four steps (xs→lg) plus one reserved **cinnabar glow** for primary CTAs only. Cards favor a 1px `border` + `shadow-sm`; modals/sheets use `shadow-lg`.

**Borders** — hairlines in `amate-200`; `border-strong` (`amate-300`) for inputs and dividers that need to assert. Cards = border + subtle shadow (not shadow alone, not border alone). Citations and the QR use cinnabar brackets.

**Corners / cards** — white surface, 1px warm border, `radius-lg`, `shadow-sm`. Alert cards add a 3px left accent border in the relevant semantic color (the *only* sanctioned use of the "colored left-border" pattern, and only for alerts).

**Transparency & blur** — used sparingly: sticky headers get a paper-tinted `backdrop-blur` scrim; sheets/overlays use a warm ink scrim at ~45% over a light blur. Not decorative glassmorphism.

**Motion** — purposeful and quick. Default ease `cubic-bezier(0.16,1,0.3,1)`, durations 120/200/320ms. Things the design *does* animate: the cited span "threading" to its source on tap; answers composing in (cache = instant, synthesis = a brief "buscando" shimmer); Playbook steps unfolding as a summary builds in real time; step-by-step guide advancing. **No bounce, no infinite decorative loops, no parallax.** Respect `prefers-reduced-motion`.

**Hover / press states**
- Hover: primary darkens to `cinnabar-600` + gains the cinnabar glow; secondary/ghost get an `amate-100` wash; links shift to `accent-fg`. (No opacity-only hovers.)
- Press: a subtle 1px translate-down / scale 0.99 + slightly darker fill. Tactile, restrained.
- Focus: 3px `cinnabar-50` ring + `cinnabar-500` border — visible, AA, keyboard-first.

**Layout rules** — fixed top app bar (paper scrim) + contextual side nav on desktop; bottom-anchored query box on collaborator mobile (thumb reach). The "Estás consultando: [CoDo] — [Entidad]" context strip is **always visible** in the consult view. Content max-width ~720px for reading, wider for dashboards/tables.

**Flow del usuario experto** — admins and the experts on a team spend long cognitive sessions with the **expediente esquemático del CoDo**, entity views, Playbook building, and granular navigation of the acervo. These surfaces are designed for *immersion*, not dashboarding. Four conditions, always: **(1) Meta clara** — the entity/CoDo/context you're working in is named and visible at all times (the always-on goal strip), never "explore this tree" in a vacuum. **(2) Feedback instantáneo** — every navigation responds without a wait; selecting a node reveals the next state immediately (it should feel like chess, not like waiting). **(3) Reto ajustable** — information density is controlled by the user (compacto/detallado, expand/collapse, filter), so an expert can absorb a dense view while a newcomer sees the same object simpler — without leaving the flow. **(4) Agencia total** — zero intrusive notifications; EDB suggestions are *always on demand in a visible place*, never pushed into the user's face mid-task. The result reads more like a **thinking tool** (Linear, Figma, Roam) than a corporate dashboard (Tableau, Power BI). The focal surface is a single **cognitive object** — an entity and its immediate relations — not a 30-widget overview. Latency is not a UX nicety here: high latency or vague answers break the collaborator's flow and throw attention off the equipment, which is why low-latency cache + clickable pedigree are load-bearing, not luxuries.

**Accessibility** — WCAG 2.1 AA minimum (regulated industry requires it). All color pairings checked for contrast; never rely on color alone (status badges carry a dot/icon + text); full keyboard nav; visible focus; screen-reader labels on icon-only controls (e.g. the mic button).

---

## 8. ICONOGRAPHY

- **Icon set: [Lucide](https://lucide.dev)** — clean, consistent ~1.75px stroke, open-source, and the de-facto companion to shadcn/ui (the implementation stack). This is a **substitution flag**: there was no existing icon set to inherit, so Lucide was chosen for ecosystem fit. If XCID prefers another set (Phosphor, Tabler, a custom set), it's a one-line swap.
  - **Loading:** preview cards and kits load it from CDN (`https://unpkg.com/lucide@latest`) and call `lucide.createIcons()`. In production use the `lucide-react` package.
  - **Usage:** stroke icons only, no filled duotone. Match text color (`currentColor`), size 16–20px inline, 24px standalone. Icon-only buttons always carry an `aria-label`.
- **Brand glyphs (not from Lucide)** — the **corner-bracket "span" mark** (`assets/docyan-mark.svg`) and its derivatives (citation bracket, QR frame brackets) are bespoke geometric marks built in inline SVG/CSS. They are brand objects, not utility icons.
- **Emoji: never.** **Unicode as icons:** only typographic collaborators that read as data, not decoration — `↗` (open source), `§` (section/span), `·` (separator), `≥` (thresholds). Everything else is Lucide.
- **No hand-drawn illustration** in this system. When spot illustration or real photography is needed (landing, verticals), it should be commissioned/sourced as real warm-toned documentary imagery — placeholders are used in the kits until then.

Common icons in use: `scan-line` (QR), `mic` (voice), `search`, `file-text` / `files` (documents), `folder-tree` (CoDo navigation), `shield-check` (cryptographic chain), `alarm-clock` / `bell` (administrative alerts), `git-branch` (versions / Playbook sequence), `sparkles` (EDB pattern suggestions — used *very* sparingly), `chevron-right`, `external-link`.

---

## 9. Index / manifest

**Root**
- `README.md` — this file.
- `colors_and_type.css` — all design tokens (color, type, spacing, radii, elevation, motion) as CSS variables + semantic type classes. Mirror into `tailwind.config`.
- `SKILL.md` — Agent-Skill front-matter so this folder works as a downloadable Claude Code skill.
- `fonts/` — `README.md` with font loading + how to bundle `.woff2` for the offline PWA. *(Fonts currently load from Google Fonts CDN — see flag below.)*
- `assets/` — brand assets. `docyan-mark.svg` (the logo mark). *(More added as kits grow.)*
- `preview/` — Design-System-tab cards (one concept each). `_card.css` is the shared scaffold.

**Preview cards** (registered in the Design System tab): Colors (amate, tlilli, tlapalli, semantic) · Type (display, body, mono, scale) · Spacing (scale, radii, elevation) · Brand (logo, citation pedigree, QR object) · Components (buttons, inputs, badges, cards).

**UI kits** (`ui_kits/<product>/` — each has `README.md`, `index.html`, and JSX components):
- `ui_kits/commercial-v2/` — **Capa B**, the public site (home · producto · cómo funciona · verticales · seguridad · precios v2.1 · demos). Band pricing, no prepaid. The single source of truth for the public site; the repo `(public)/*` is already built from it. *(The older `ui_kits/commercial/` was retired.)*
- `ui_kits/platform/` — **Consola del fundador** (super-admin de plataforma — resumen, orgs, códigos, ingresos, soporte, jobs). Metadata, nunca contenido.

> **El frontend interno (logged-in) ya NO vive en un UI kit.** Su fuente de verdad única es **`DOCYAN-Prototipo.html`** (ver abajo). Los kits `ui_kits/pwa/` y `ui_kits/onboarding/` quedaron **superados y retirados**: todo su alcance (consulta del colaborador, admin, auth + onboarding) se reconstruyó, mejor y al día, en el prototipo.

**Frontend interno — fuente de verdad:** `DOCYAN-Prototipo.html` (+ `app/*.jsx`, `app/*.css`). Es el diseño que Opus debe reconstruir pixel-perfect en el repo. Cubre, en un solo harness con conmutador Entrada/Producto · Organización/Colaborador · Escritorio/Tablet/Móvil: registro/login/código + onboarding ájá, consulta con los 8 renders, CoDos/expediente, Documentos vivos, Ingesta + cotizador, Catálogo de schemas (14 tipos), Glosario + lock terminológico, Inteligencia (sugerencias→Playbooks), Usuarios, Alertas + avisos automáticos, QRs, Gobernanza & FAT, Plan (bandas) + método de pago. Orientación completa en `HANDOFF.md`.

*(No slide template was provided, so `slides/` is intentionally absent.)*

---

## ⚠️ Flags & substitutions
1. **Fonts load from Google Fonts CDN**, not bundled. They are the *real* IBM Plex typefaces — but for the offline-first collaborator PWA they should be self-hosted (`fonts/README.md`).
2. **Lucide** chosen as the icon set (no existing set to inherit) — swappable.
3. **Logo & brand objects are original proposals** built from the brief — there was no prior identity. The cinnabar hue, the bracket mark, and the QR treatments are all open to your direction.
