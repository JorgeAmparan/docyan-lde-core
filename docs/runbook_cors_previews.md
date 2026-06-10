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

**Producción NO lo padece**: su dominio es fijo (`https://docyan-lde.vercel.app` y/o
`https://app.docyan.com`) y está en `ALLOWED_ORIGINS`. Verificar con:

```bash
flyctl secrets list --app docyan-lde-api | grep ALLOWED_ORIGINS   # debe incluir el dominio prod
```

## Cómo probar auth desde un preview
Tres opciones, de menor a mayor alcance:

1. **Probar auth en local o en producción** (recomendado para el recorrido de cierre).
   El preview sirve para revisar el sitio público (que no requiere auth). El embudo
   `/signup` → cuenta real se valida contra el backend de producción o en local
   (`http://localhost:3000` ya está en `ALLOWED_ORIGINS`).

2. **Backend de staging con patrón de preview** (F3 B5). El backend ahora acepta
   `ALLOWED_ORIGIN_REGEX` (opcional). En el backend de **staging** —nunca en
   producción— se setea para abrir los previews del proyecto:

   ```bash
   flyctl secrets set \
     ALLOWED_ORIGIN_REGEX='https://docyan-[a-z0-9-]+-jorgeamparans-projects\.vercel\.app' \
     --app docyan-lde-api-staging
   ```

   y el preview apunta su `NEXT_PUBLIC_API_URL` a ese staging. Producción deja
   `ALLOWED_ORIGIN_REGEX` **sin setear** → CORS estricto por lista exacta.

3. **Dominio de preview estable** (Vercel "Preview Branch Domain") agregado a
   `ALLOWED_ORIGINS` del staging. Útil si se quiere una URL fija de QA.

## Regla
- `ALLOWED_ORIGIN_REGEX` **solo** en staging. En producción, **no setear** (la lista
  exacta de `ALLOWED_ORIGINS` es la única fuente; CORS permisivo en prod es un riesgo).
- Verificar tras cada deploy de prod que `ALLOWED_ORIGINS` contiene el dominio público
  real y que `ALLOWED_ORIGIN_REGEX` está vacío en prod.
