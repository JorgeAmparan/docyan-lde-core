---
name: docyan-design
description: Use this skill to generate well-branded interfaces and assets for DOCYAN LDE (Live Document Environment by XCID), either for production or throwaway prototypes/mocks. Contains design guidelines, color & type tokens, fonts, brand assets, the internal logged-in frontend prototype (the source of truth), and the public commercial + founder-console kits.
user-invocable: true
---

Read the `README.md` in this skill first — it carries the brand spine ("in tlilli, in tlapalli" — the black ink, the red ink), the content/voice rules, the visual foundations, and the iconography. Then explore the other files.

## What's here
- `README.md` — full brand, content fundamentals, visual foundations, iconography, manifest, and open flags.
- `colors_and_type.css` — all design tokens (color, type, spacing, radii, elevation, motion) as CSS variables + semantic type classes. Mirror into `tailwind.config` for shadcn work.
- `fonts/` — IBM Plex loading notes (Sans + Mono + Serif).
- `assets/` — brand assets (`docyan-mark.svg`, etc.).
- `preview/` — one-concept design-system cards (colors, type, spacing, brand objects, components).
- `DOCYAN-Prototipo.html` (+ `app/*`) — **the internal logged-in frontend — the single source of truth.** Registro/login/código + onboarding, consult with the 8 renderers, CoDos/expediente, Documentos, Ingesta + cotizador, Schemas, Glosario + lock, Inteligencia (sugerencias→Playbooks), Usuarios, Alertas, QRs, Gobernanza & FAT, Plan (bandas) + método de pago. Opus rebuilds this pixel-perfect. See `HANDOFF.md`.
- `ui_kits/commercial-v2/` — Capa B: public site (home, producto, cómo funciona, verticales, seguridad, precios v2.1, demos). Band pricing, no prepaid. Single source of truth for the public site.
- `ui_kits/platform/` — Consola del fundador (super-admin de plataforma). Metadata, nunca contenido.

## How to work
- **Throwaway artifact** (slide, mock, prototype, one-off screen): copy the assets you need out of this folder and build a static/standalone HTML file the user can open. Always `<link>` `colors_and_type.css`, load IBM Plex + Lucide, and reuse the kit components/classes.
- **Production code**: read the rules here and lift exact token values (hex, spacing, radii, font stacks) into the Next.js 15 + React 19 + Tailwind + shadcn/ui implementation.

## Non-negotiables (from the brief)
- **Cinnabar is the citation color** — every answer carries a tappable pedigree chip to the exact source span. It's the signature brand object; keep the corner-bracket "span" motif.
- **Progressive naming** — never show the word "Playbook" until the user's behavior earns it (≥2 related saved consultas + repetition). Before that it's only "consulta guardada".
- **Alerts are administrative only** — never clinical/operational instructions. Reinforce visually and in copy.
- **Voice**: direct, competent, no marketing-speak ("revoluciona", "AI-powered" are banned), no emoji. Spanish uses *tú*. Mono uppercase only for technical labels.
- **Accessibility**: WCAG 2.1 AA; tap targets ≥44px (gloves); never rely on color alone.

If invoked with no other guidance, ask the user what they want to build, ask a few focused questions (surface, audience, language, variations), then act as an expert DOCYAN designer — output HTML artifacts or production code as the need dictates.
