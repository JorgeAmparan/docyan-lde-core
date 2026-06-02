# GRG — Familias modeladas pero INERTES en runtime MVP (B7)

> DOCYAN LDE™ by XCID. Estado: **modeladas, testadas aisladamente, NO enchufadas
> al pipeline activo.** Se reactivan con el motor de traducción de **B5**.

La Adenda de Alcance MVP de Consulta Viva acota B7: el FAT con hash chain y la
gobernanza de **consulta operativa** se activan completos; las familias GRG de
**producción de traducción** se construyen como cimiento pero quedan inertes
(mismo patrón que B3 trató al DTM: estructura sin motor).

## Familias activas en runtime MVP (consulta viva)

| Familia | Qué hace | Dónde se invoca |
|---|---|---|
| **F2** Umbrales de confianza por criticidad (R-UC-01..05) | Umbral por criticidad (seguridad 0.95 … informativa 0.60); bajo umbral → flag+disclaimer o escala a revisor | `GRGExtendido.f2_evaluar_umbral`, vía `GovernanceGate.evaluate(criticidad=…)` |
| **F3** Freno de alucinación | Bloquea cifras / normas / identificadores fabricados que no están en la fuente | `GRGExtendido.f3_freno_alucinacion` |
| **F7** Consulta operativa | Pasos imperativos + sin fabricación + pedigree clickeable obligatorio | `GRGExtendido.f7_consulta_operativa` |
| **F8** Canal PWA vs WhatsApp | La degradación a WhatsApp no pierde criticidad (mismo disclaimer crítico) | `GRGExtendido.f8_canal` |

## Familias INERTES en runtime MVP (cimiento para B5)

Viven en `app/governance/familias_inertes.py` como **funciones puras**. Tienen
tests unitarios (entrada → salida), pero **ningún caller del pipeline activo las
importa**: ni el Governance Gate ni el Master Orchestrator. Activarlas en B5 =
enchufar estas funciones al motor de traducción; la lógica ya está aquí y probada.

| Familia | Reglas | Función | Reactivación |
|---|---|---|---|
| **F1** Lock terminológico | R-LT-01..03 | `f1_lock_terminologico(origen, traduccion, lock_map)` | B5 — motor de traducción |
| **F4** Fidelidad de no-traducibles | R-NT-01 | `f4_fidelidad_no_traducibles(origen, traduccion)` | B5 |
| **F5** Validación por tipo de segmento traducido | R-VS-01 | `f5_validar_segmento(tipo, traduccion, …)` | B5 |
| **F6** Consistencia cross-segmento | R-CC-01 | `f6_consistencia_cross_segmento(traducciones_por_termino)` | B5 |

- **F1** verifica que cada término bloqueado del glosario (`:Glosario.lock_terminologico`,
  cimiento de B3) aparezca con su traducción obligatoria.
- **F4** preserva fórmulas químicas, unidades SI, marcas y marcadores `{variable}`
  verbatim entre origen y traducción.
- **F5** valida CPS de subtítulos, longitud de etiquetas de diagrama, imperativo
  en pasos traducidos y tono ANSI Z535 en advertencias traducidas.
- **F6** detecta un mismo término origen traducido de forma inconsistente
  intra-documento o cross-documento del mismo cliente.

## Espejo en el FAT

El FAT extendido (doc 08) tiene la misma partición: 6 familias activas
(F4 consulta, F5 troubleshooting, F6 alertas, F7 gobernanza, F8 onboarding,
F9 sistema) y 3 inertes (F1 pipeline traducción, F2 revisión humana, F3 ingesta
bilingüe). Las inertes del FAT están modeladas en `app/audit/familias.py`
(`FAMILIAS_INERTES_MVP`) con su retención; simplemente no se emiten en runtime MVP.

## Contrato de no-regresión

- Cambiar una familia inerte NO debe afectar ninguna ruta de consulta viva.
- Las familias inertes no aparecen en `GovernanceGate` ni en el flujo del MO.
- Sus tests viven en `tests/test_grg_familias_inertes.py` y corren aislados.
