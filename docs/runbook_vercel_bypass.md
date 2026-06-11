# Runbook — Vercel Protection Bypass for Automation (screenshots del preview)

## Qué es y por qué
Los **previews** de Vercel del proyecto `docyan-lde` están bajo **Deployment
Protection (SSO)** — `ssoProtection.deploymentType = all_except_custom_domains`:
producción (dominio propio) es pública, los previews piden login. Por eso
Playwright/cURL contra un preview devuelven **HTTP 401** y no pueden capturar el
estado real de la UI.

El **Protection Bypass for Automation** es un **secreto** del proyecto que, enviado
en cada request, salta ese login **solo para automatización** (Playwright, smoke,
screenshots), sin exponer el preview al público. Lo usa el header:

```
x-vercel-protection-bypass: <SECRET>
x-vercel-set-bypass-cookie: true
```

## Dónde vive el secreto (NUNCA en el repo)
Regla (autorizada por Jorge, jun 2026): el secreto vive **solo como variable de
entorno** — jamás hardcodeado ni commiteado:
- **Local (Playwright):** `export VERCEL_AUTOMATION_BYPASS_SECRET=<secret>` antes de
  `node frontend/scripts/shot-demo.mjs` (el script lo lee de env; sin él, no manda el
  header). El `.env` está en `.gitignore`.
- **CI (si se automatizan screenshots):** GitHub Actions secret
  `VERCEL_AUTOMATION_BYPASS_SECRET` (repo → Settings → Secrets → Actions), inyectado
  al job como env. Nunca en el YAML en claro.

`gitleaks` corre en CI: si el secreto aparece en un diff, el push falla (deseado).

## Cómo se genera / lee
- **Generar:** Vercel dashboard → proyecto `docyan-lde` → **Settings → Deployment
  Protection → Protection Bypass for Automation → Enable**. Vercel genera el secreto
  (la creación NO está expuesta por la API REST con el token del CLI — devuelve
  `not_found`; es acción de dashboard).
- **Leer (una vez habilitado):** `GET https://api.vercel.com/v9/projects/<projectId>?teamId=<teamId>`
  con `Authorization: Bearer <token-cli>` → campo `protectionBypass`. (projectId
  `prj_XW2ieDofJqXPzlUBY7QWcXpqxBLA`, teamId `team_NtStY4wgr9IzLwz46ZBihPXI`.)

## Rotar / revocar
- **Rotar:** dashboard → mismo panel → "Regenerate". Actualizar el env local y el
  secret de CI con el nuevo valor.
- **Revocar:** dashboard → "Disable" Protection Bypass for Automation. Tras revocar,
  los requests con el header viejo vuelven a 401 (correcto).
- **Higiene:** el bypass es para superficies de automatización (screenshots/smoke);
  no es una llave de acceso general. Si se filtra, revocar y regenerar.

## Uso (capturar las 4 evidencias)
```bash
export VERCEL_AUTOMATION_BYPASS_SECRET=<secret>
cd frontend && PREVIEW=https://docyan-<hash>-jorgeamparans-projects.vercel.app \
  node scripts/shot-demo.mjs
# → /tmp/hero_{desktop,mobile}.png, codo_{...}.png (CoDo que cita), lab_{...}.png
```
Criterio binario: la tarjeta del CoDo (`.dc2-a`) == la del hero. Regla de evidencia
visual: ver [[evidencia-visual-obligatoria]] (memoria).
