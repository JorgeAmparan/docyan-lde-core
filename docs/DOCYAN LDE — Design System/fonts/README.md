# Fonts — DOCYAN LDE

The system uses the **IBM Plex** family (open-source, SIL OFL):

| Family | Role | Weights used |
|---|---|---|
| **IBM Plex Sans** | UI, body, display | 400, 500, 600, 700 |
| **IBM Plex Mono** | Data, citation pedigree, QR labels, technical eyebrows | 400, 500, 600 |
| **IBM Plex Serif** | Document-rendering / editorial moments only | 400, 600 |

## Current loading method ⚠️ FLAG
Every HTML file in this system currently loads these from the **Google Fonts CDN**:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Serif:wght@400;600&display=swap" rel="stylesheet">
```

These are the **real, intended typefaces** — not a visual substitution. The only caveat is delivery: the PWA brief (§7) calls for an offline-first operator app, so for production you should **self-host the `.woff2` files** here in `fonts/` and swap the `<link>` for local `@font-face` rules.

## To bundle for production / offline PWA
Download from <https://github.com/IBM/plex> (or `@fontsource/ibm-plex-sans`, `-mono`, `-serif`) and drop the `.woff2` files in this folder, then use:

```css
@font-face {
  font-family: "IBM Plex Sans";
  src: url("fonts/IBMPlexSans-Regular.woff2") format("woff2");
  font-weight: 400; font-display: swap;
}
/* …repeat per weight/family… */
```

Why IBM Plex: engineered for technical/industrial contexts (reads as rigor, not consultant-tech), excellent multilingual coverage for ES/EN + regional variants, and the Mono companion gives the engineering feel the citation/QR brand objects need.
