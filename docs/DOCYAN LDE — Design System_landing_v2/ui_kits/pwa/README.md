# UI Kit — Capa A · Producto operativo (PWA)

Authenticated PWA the client uses daily. Audiences: collaborator with a phone (QR-first) + org admin on desktop. Open `index.html` and use the top switcher to flip between **Colaborador · móvil** and **Admin · escritorio**.

## What's interactive
- **Collaborator (phone):** lands as if a QR was just scanned — context strip (`CODO-LAB-04 · Centrífuga Hettich`) is always visible. Tap a suggested question (or type) to get a **conditionally-rendered answer** (all 8 intent types). Save consultas; ≥2 saves surfaces the progressive Playbook nudge → run them as a composed Playbook; every answer carries a tappable citation pedigree → source overlay with the exact span.
- **Acceso (desktop):** admin login (collaborators don't log in — the QR is the credential) → CoDo selection grid with search for admins with many CoDos.
- **Onboarding (desktop):** 7-step first-run wizard (welcome → org → first CoDo → ingest → first QR → first consulta → invite collaborators).
- **Admin (desktop)** — functional sidebar routing across:
  - **Resumen** — PCL metrics, CoDo cards, EDB patterns detected, ingest balance, SHA-256 chain verifier.
  - **CoDos** — the **expediente esquemático** as the focal canvas (entity hub + immediate relations, always-on goal strip, compacto/detallado density toggle — designed for *flow del usuario experto*), plus a Documentos mode with granular document tree + cross-document search + **annotations** (`:Observacion`, with recurring-pattern surfacing) + CoDo config (vertical, language pairs, cache threshold, criticality).
  - **Alertas** — admin alerts grouped by criticality with the administrative-reminder banner.
  - **Ingesta** — pre-ingest quote (cost + time + balance), processing queue (retry/cancel), history, prepaid balance.
  - **Gobernanza & FAT** — GRG confidence thresholds by criticality, quarantined outputs with justification, FAT audit log with family filters + PDF/XML/JSON/CSV export + chain verifier.
  - **Generar QRs** — the DOCYAN QR brand object (corner-bracket frame, cinnabar, discrete logo) with CoDo/entity/format selection, print/download, recent batch.
  - **Usuarios** — admins (with seat cost) + unlimited free collaborators, invite, per-user prefs (language pair, regional variant, proactive-AI toggle).

## Files
| File | Role |
|---|---|
| `index.html` | Entry — loads fonts, tokens, styles, all components |
| `pwa.css` / `admin.css` | Kit styles (collaborator + admin) on top of `../../colors_and_type.css` |
| `atoms.jsx` | `Icon` (Lucide wrapper), `Mark` (logo), `Cite` (citation chip) |
| `consult.jsx` | Collaborator consult flow + all 8 intent-type answer renderers |
| `admin.jsx` | Admin shell (sidebar routing) + Resumen view |
| `admin-views.jsx` | CoDos, Alertas, Ingesta, Gobernanza/FAT, Generar QRs, Usuarios + the QR brand-object plate |
| `access.jsx` | Acceso (login + CoDo selection) and the Onboarding wizard |
| `playbook.jsx` | Saved-consulta sheet, Playbook run, cited-source overlay |
| `admin.jsx` | Admin org dashboard |
| `app.jsx` | Shell: view switcher + phone frame |

## Coverage
The collaborator consult flow (all 8 intent types), Playbooks, and the full admin surface — Acceso/login, CoDo selection, Onboarding, Resumen, CoDos (nav + search + annotations + config), Alertas, Ingesta, Gobernanza/FAT, Generar QRs, Usuarios — are all built. Cosmetic recreations (canned data, no real backend), meant to be lifted into the real Next.js + shadcn implementation.
