# Lock terminológico — propiedad de schema (B3) y contrato para B5

> **Estado B3 (Adenda MVP):** el lock terminológico existe **solo como propiedad
> técnica del schema**. NO hay motor que lo lea ni que reemplace términos en
> runtime. Este documento define qué se construyó y el contrato exacto que el
> motor de B5 consumirá al reactivarse traducción.

## Qué es (B3)

`:Glosario.lock_terminologico` es un `bool` en la ontología DTM
(`app/graph/schemas/dtm_ontology.py`, modelo `GlosarioProps`). Default `False`.

- `True` → el glosario está **bloqueado**: sus términos son de uso obligatorio y
  no pueden ser sustituidos por alternativas del traductor/motor.
- `False` → el glosario es orientativo.

En B3 la propiedad se persiste y se recupera correctamente (test
`test_lock_terminologico_como_propiedad`). **No se prueba reemplazo de términos
porque ese comportamiento no existe todavía** — es B5.

## Por qué el lock no es cosmético

El lock terminológico es un **diferenciador defendible frente a las CAT tools**
(CLAUDE.md §11). En industrias reguladas (NOM, ISO 17025, IATF 16949, FDA), un
término técnico mal sustituido es un riesgo de compliance, no un detalle de
estilo. Por eso el lock se modela desde los cimientos aunque su motor llegue
después: el día que se active, no debe haber migración del grafo.

## Relación con doc 07 (regla F1)

El lock soporta la **regla F1** de gobernanza (doc 07): cuando un glosario tiene
`lock_terminologico=True`, el Guardrail Governance (GRG) debe impedir que el
flujo de traducción produzca un destino que contradiga el término bloqueado. La
**regla** vive en GRG (B6); la **propiedad que habilita evaluarla** vive aquí.

## Contrato para B5 (constraint generator — NO construido en B3)

Cuando B5 se reactive, el motor de traducción:

1. Al resolver un `:SegmentoTraduccion`, recorre `:USA_GLOSARIO` hacia sus
   `:Glosario` ordenados por `prioridad` (cliente > agencia).
2. Para cada `:Glosario` con `lock_terminologico=True`, lee sus términos vía
   `:CONTIENE_TERMINO` → `:TerminoGlosario`.
3. Genera un **constraint** que fuerza el `texto_destino` de cada término
   bloqueado en la salida (reemplazo determinista, no sugerencia).
4. Si dos glosarios bloqueados entran en conflicto sobre el mismo
   `texto_origen`, gana el de mayor prioridad (cliente). El conflicto se reporta
   a FAT (familia `governance`).

Nada de los puntos 1–4 está implementado en B3. Lo que B3 garantiza es que la
estructura (propiedad `lock_terminologico`, aristas `:USA_GLOSARIO` con
`prioridad`, `:CONTIENE_TERMINO`) ya existe y es consultable, de modo que B5 se
construye **sin migración**.

## Resumen

| Aspecto | B3 (ahora) | B5 (reactivación) |
|---|---|---|
| Propiedad `lock_terminologico` | ✅ existe, validada, recuperable | la lee |
| Reemplazo de términos en runtime | ❌ no existe | ✅ lo construye |
| Constraint generator | ❌ no existe | ✅ lo construye |
| Prioridad cliente > agencia en `:USA_GLOSARIO` | ✅ modelada | la consume |
| Reporte de conflicto a FAT | ❌ no existe | ✅ (familia governance) |
