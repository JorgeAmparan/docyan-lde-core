# Runbook — CORS y pruebas de auth desde previews de Vercel (F3 B5)

## Síntoma
En un **preview de Vercel** (PR), crear cuenta o iniciar sesión devuelve **"No pudimos
conectar"**. En **producción** funciona.

## Causa (confirmada)
El backend (`app/api/main.py`) aplica CORS con `allow_origins=_origins`, una **lista
exacta** tomada de la env `ALLOWED_ORIGINS`. Los previews de Vercel usan dominios
**dinámicos** por deploy:

```
https://docyan-<hash>-jorgeamparans-projects.vercel.app
```

Ese dominio no está (ni puede estarlo, cambia por commit) en `ALLOWED_ORIGINS`, así
que el navegador bloquea la llamada con auth (`credentials: include`) por CORS. Es el
mismo gotcha del encendido de B13.1.

**El sitio público v2 SÍ lo padece desde previews**: su demo (`/demo/query`) llama al
backend real, y el dominio del preview no está (ni puede estar) en `ALLOWED_ORIGINS`.
Para el recorrido de los CoDos en preview se resolvió con la opción 2 de abajo (regex
acotado al scope propio). **Producción NO lo padece para su dominio fijo**
(`https://docyan-lde.vercel.app` y/o `https://app.docyan.com`), que está en
`ALLOWED_ORIGINS`. Verificar con:

```bash
flyctl secrets list --app docyan-lde-api | grep ALLOWED_ORIGINS   # debe incluir el dominio prod
```

## Cómo probar auth o demo desde un preview
Tres opciones, de menor a mayor alcance:

1. **Probar en local o en producción** (válido para el recorrido de cierre de auth).
   El preview sirve para revisar el sitio público. El embudo `/signup` → cuenta real
   se valida contra el backend de producción o en local (`http://localhost:3000` ya
   está en `ALLOWED_ORIGINS`).

2. **`ALLOWED_ORIGIN_REGEX` con patrón acotado al scope propio de Vercel** (F3 B5).
   El backend acepta `ALLOWED_ORIGIN_REGEX` (opcional, lo consume `CORSMiddleware`
   vía `fullmatch`, así que el patrón queda anclado de extremo a extremo). Se setea
   con el patrón **acotado al scope propio del proyecto Vercel**:

   ```bash
   flyctl secrets set \
     ALLOWED_ORIGIN_REGEX='https://docyan-[a-z0-9-]+-jorgeamparans-projects\.vercel\.app' \
     --app docyan-lde-api          # o el backend de staging, según el caso
   ```

   Esto se aplicó en **producción** el 2026-06-10 para el recorrido de los CoDos
   (el demo del sitio v2 rutea toda consulta a `/demo/query`, superficie pública
   read-only). El patrón solo matchea los previews del propio scope `jorgeamparans-projects`;
   un origen ajeno (p. ej. `evil-attacker.vercel.app`) NO matchea → preflight 400 sin
   `access-control-allow-origin`. Verificación obligatoria antes de confiar en él:

   ```bash
   curl -s -i -X OPTIONS https://docyan-lde-api.fly.dev/demo/query \
     -H "Origin: https://docyan-<hash>-jorgeamparans-projects.vercel.app" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: content-type" | grep -i "allow-origin"
   # debe devolver access-control-allow-origin igual al Origin enviado
   ```

3. **Dominio de preview estable** (Vercel "Preview Branch Domain") agregado a
   `ALLOWED_ORIGINS`. Útil si se quiere una URL fija de QA.

## Regla (actualizada 2026-06-10 — política escrita, no excepción verbal)
La política anterior ("`ALLOWED_ORIGIN_REGEX` solo en staging; en prod, no setear")
queda **derogada y reemplazada** por:

- En **producción**, `ALLOWED_ORIGIN_REGEX` está **permitido SOLO** cuando:
  1. el patrón está **acotado al scope propio de Vercel**
     (`...-jorgeamparans-projects\.vercel\.app`), nunca un wildcard ni `vercel.app` a secas; y
  2. cubre **únicamente superficies públicas read-only** (p. ej. `/demo/query`).
- **Nunca** wildcard. **Nunca** habilitarlo para rutas de escritura/auth sin revisión
  explícita: el regex abre el origen a TODAS las rutas, así que su justificación
  descansa en que las rutas sensibles ya validan auth/token por su cuenta. Antes de
  setearlo se asume que ese es el caso y se documenta cuál es la superficie que lo motiva.
- Tras setearlo, **verificar el preflight** (positivo desde un preview real + control
  negativo desde un origen ajeno) ANTES de confiar en él.
- Verificar tras cada deploy de prod que `ALLOWED_ORIGINS` contiene el dominio público
  real y que `ALLOWED_ORIGIN_REGEX`, si está seteado, sigue acotado al scope propio.
- Reversible en un comando: `flyctl secrets unset ALLOWED_ORIGIN_REGEX --app docyan-lde-api`.
