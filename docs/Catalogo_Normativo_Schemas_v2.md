# DOCYAN LDE™ — Catálogo Normativo de Schemas por Tipo Documental — v2 (CERRADO)

**Principio generador (canónico):** los schemas no se inventan ni se adivinan — **se derivan de la normativa o práctica regulada que rige cada tipo documental.** La norma define qué datos debe contener el documento; ese contenido obligatorio ES la ontología de extracción, el render objetivo y las consultas que el documento debe responder. DOCYAN ofrece exactamente lo que la norma exige, ni más ni menos.

**Estructura del catálogo (decisión de Jorge, v2):** organizado por **fase del ciclo de vida del activo regulado**, no por sector. Un manual de operación de un CNC y uno de una bomba minera son el MISMO tipo con la misma firma de consulta — el sector cambia el contenido, no la estructura. Esto vuelve el catálogo **finito y cubriente**: ~14 tipos cubren los CoDos esperados de todos los segmentos explorados (laboratorios, maquila, minería, agroindustria, farma, construcción, energía, servicios públicos, legal/fiscal/aduanal), porque todos consultan documentos de las mismas fases. Coherente con la tesis canónica: la firma del trabajo, no la industria.

**Marco de referencia:** ISO 29845 cataloga los tipos de documento técnico de producto a través de las fases diseño → ingeniería → realización → operación → mantenimiento → desmantelamiento. DOCYAN cubre las fases consultables en el punto de uso.

**Regla de liberación (vigente):** schema sin retrieval que lo lea no se libera. Cada tipo entra con cuatro patas: labels al scope de lectura + intents de ranking + suite de paráfrasis + render asignado.

**Línea absoluta (cruza todo el catálogo):** alertas administrativas sí (vencimientos, faltantes, fechas); diagnóstico, decisión clínica/operativa o asesoría legal, jamás. DOCYAN presenta lo que el documento dice; el profesional decide. Frecuencia-sí / causa-no.

---

## Las fases del ciclo de vida (eje organizador)

| Fase | Pregunta que responde el documento | Tipos |
|---|---|---|
| **Identidad / especificación** | ¿qué es, qué características tiene? | ficha_tecnica, especificacion |
| **Instalación** | ¿cómo se instala/configura? | instructivo, manual_instalacion |
| **Operación** | ¿cómo se usa/opera? | manual_operacion, instruccion_trabajo |
| **Mantenimiento** | ¿cómo se mantiene/repara, cada cuánto? | manual_mantenimiento |
| **Calibración / verificación** | ¿está calibrado, hasta cuándo, con qué trazabilidad? | certificado_calibracion |
| **Calidad / inspección** | ¿qué se controla, con qué criterio? | plan_control, protocolo_inspeccion |
| **Seguridad** | ¿qué peligros, qué protección? | hoja_seguridad (SDS/MSDS) |
| **Normativo** | ¿qué exige la ley/norma? | norma_ley_reglamento |
| **Histórico / registro** | ¿qué ha pasado en el tiempo? | registro_historico |

---

## Los 14 tipos (cerrados)

### 1. `ficha_tecnica` — Identidad
- **Norma/práctica:** hoja del fabricante; ASTM/ISO de materiales según producto.
- **Ontología:** parámetro→valor→unidad→tolerancia (`:Especificacion`) · condiciones de prueba · normas de referencia citadas (`:NormaReferencia`).
- **Render:** info_card. **Consultas:** ¿valor de X? ¿tolerancia? ¿bajo qué norma?

### 2. `especificacion` — Identidad
- **Norma/práctica:** especificación de ingeniería; ISO/ASTM del dominio.
- **Ontología:** requisito (`:Especificacion`) · característica con clasificación (crítica/significativa) · método de verificación · norma aplicable.
- **Render:** info_card. **Consultas:** ¿requisito de X? ¿cómo se verifica? ¿es característica crítica?

### 3. `instructivo` — Instalación / uso de producto *(separado de instrucción de trabajo — corrección de Jorge)*
- **Audiencia:** usuario final. **Norma/práctica:** IEC/IEEE 82079-1 (preparación de instrucciones de uso) · NOM-018-STPS (información de seguridad de producto) · NOM-024-SCFI (instructivos y garantías, MX).
- **Ontología:** pasos de uso/configuración/instalación (`:Procedimiento`→`:Paso`) · advertencias (`:Advertencia`) · requisitos previos (`:Requisito`) · símbolos/iconos de seguridad.
- **Render:** procedure_card. **Consultas:** ¿cómo se configura/instala? ¿qué advertencia aplica? ¿qué requiere antes de usar?

### 4. `manual_instalacion` — Instalación industrial
- **Audiencia:** equipo de instalación. **Norma/práctica:** instrucciones del fabricante + NOM de instalación del dominio (ej. NOM-001-SEDE eléctrica, NOM de gas, etc., según activo).
- **Ontología:** especificaciones de instalación (`:Especificacion` — tolerancias, anclajes, condiciones) · pasos (`:Procedimiento`→`:Paso`) · requisitos de sitio/servicios · advertencias (`:Advertencia`) · herramientas (`:Herramienta`).
- **Render:** info_card + procedure_card. **Consultas:** ¿qué requisitos de sitio? ¿cómo se ancla/conecta? ¿qué tolerancia de instalación?

### 5. `manual_operacion` — Operación *(subdivisión de manual_tecnico)*
- **Audiencia:** operador/técnico. **Norma/práctica:** fabricante + IEC 82079-1; residual-risk warnings de directiva de maquinaria.
- **Ontología:** especificaciones operativas (`:Especificacion` — rangos, capacidades) · procedimientos de operación (`:Procedimiento`→`:Paso`) · advertencias y riesgo residual (`:Advertencia`) · controles/indicadores.
- **Render:** info_card + procedure_card. **Consultas:** ¿rango/capacidad? ¿cómo se opera X? ¿qué significa el indicador Y?

### 6. `manual_mantenimiento` — Mantenimiento / reparación *(subdivisión de manual_tecnico)*
- **Audiencia:** técnico de mantenimiento. **Norma/práctica:** fabricante + prácticas O&M (MIMOSA/ISO 14224 de datos de confiabilidad donde aplique); satisface OSHA/ISO de registros de mantenimiento.
- **Ontología:** intervalos de mantenimiento (`:FechaVencimiento`/intervalo → alertas) · procedimientos preventivos y correctivos (`:Procedimiento`→`:Paso`) · lubricación/insumos (`:Componente`) · troubleshooting síntoma→causa→acción (presentado como lo dice el manual, NUNCA diagnóstico del caso del usuario — línea absoluta) · herramientas (`:Herramienta`) · partes/refacciones.
- **Render:** procedure_card + alerts (intervalos) + info_card. **Consultas:** ¿cada cuánto mantenimiento? ¿cómo se repara X? ¿qué dice el manual del síntoma Y? ¿qué refacción usa?

### 7. `instruccion_trabajo` — Operación en producción *(separado de instructivo — corrección de Jorge)*
- **Audiencia:** operador en piso, punto de uso. **Norma/práctica:** SGC del cliente — ISO 9001 §7.5 + IATF 16949 (instrucciones de trabajo en estación) + NOM-018 seguridad.
- **Ontología:** pasos de la tarea (`:Procedimiento`→`:Paso`) · responsable/rol por paso (`:Responsable`) · EPP por paso (`:EquipoProteccion`) · criterios de aceptación (`:Especificacion`) · registros requeridos · documento padre/versión.
- **Render:** procedure_card. **Consultas:** ¿cómo se hace esta tarea? ¿quién es responsable? ¿qué EPP exige? ¿criterio de aceptación?

### 8. `certificado_calibracion` — Calibración *(activo, refinar)*
- **Norma:** ISO/IEC 17025:2017 §7.8; trazabilidad nacional vía CENAM / acreditación EMA (MX).
- **Ontología:** instrumento (`:Instrumento` — marca/modelo/serie) · resultados (`:MedicionRegistrada` — nominal/medido/desviación) · incertidumbre expandida + factor k (`:Especificacion`) · trazabilidad (`:TrazabilidadPatron` — patrón, NIST/CENAM) · fechas calibración/vencimiento (`:FechaVencimiento`, `:CertificadoVigencia`) · procedimiento usado · firmante (`:Responsable`).
- **Render:** info_card + alerts (vencimiento, citado). **Consultas:** ¿cuándo vence? ¿trazable a qué patrón? ¿incertidumbre? ¿desviación en X punto? *(activo y funcionando)*

### 9. `plan_control` — Calidad *(automotriz/manufactura)*
- **Norma:** IATF 16949 + manual de referencia AIAG (Control Plan); APQP.
- **Ontología:** operación/proceso · característica producto/proceso con clasificación · especificación+tolerancia (`:Especificacion`) · instrumento de medición (`:Instrumento` — cruce con calibración: plan↔cert-vigente, oro para el lab embajador) · frecuencia de inspección · plan de reacción (`:Procedimiento`).
- **Render:** info_card + alerts (instrumento referenciado con calibración vencida — administrativa). **Consultas:** ¿qué se mide en operación X? ¿con qué instrumento/frecuencia? ¿tolerancia? ¿plan de reacción? (cita, no aconseja)

### 10. `protocolo_inspeccion` — Calidad / inspección
- **Norma/práctica:** ISO 17020 (organismos de inspección) / protocolos del SGC; checklists de aceptación.
- **Ontología:** punto de inspección (`:PuntoInspeccion`) · criterio de aceptación/rechazo (`:Especificacion`) · método/instrumento · frecuencia · registro de resultado.
- **Render:** info_card + procedure_card (checklist). **Consultas:** ¿qué se inspecciona? ¿criterio de aceptación? ¿con qué método?

### 11. `hoja_seguridad` (SDS/MSDS) — Seguridad *(activo, refinar)*
- **Norma:** GHS 16 secciones / NOM-018-STPS-2015 (armonizada GHS). Cubre formato GHS Y pre-GHS (hojas viejas ES, secciones romanas — lección AM002).
- **Ontología:** sustancia (`:Sustancia` — comercial/químico/`:NumeroCAS`) · composición % (`:Componente`) · peligros (`:Riesgo`, categorías GHS) · primeros auxilios (`:Procedimiento`) · medidas de incendio (incluye datos negativos explícitos: "punto de inflamación: NINGUNO" — freno de alucinación) · límites de exposición (`:Especificacion` — PEL/TLV/IDLH con agencia) · EPP (`:EquipoProteccion`) · propiedades físicas · manejo/almacenamiento (`:MedidaProteccion`).
- **Refinamiento:** filtrar nombres genéricos de extracción ("El Material", "Componentes") para que la sustancia principal encabece *(ya aplicado en UI-2)*.
- **Render:** info_card; emergencias → procedure_card. **Consultas:** ¿cómo se llama el químico? ¿PEL? ¿punto de inflamación? ¿EPP? ¿qué hago si derrame? *(activo y funcionando)*

### 12. `norma_ley_reglamento` — Normativo *(prerequisito del Acervo + segmento legal)*
- **Norma/práctica:** la estructura formal del texto jurídico-normativo: títulos→capítulos→artículos→fracciones→incisos→transitorios (MX); secciones/párrafos (OSHA 29 CFR); cláusulas (ISO/NOM).
- **Ontología:** unidad normativa (`:Articulo`/`:Clausula` — número, texto, jerarquía) · obligaciones con sujeto (`:Obligacion` — fortaleza de Flash en voz pasiva regulatoria) · definiciones (`:TerminoTecnico`) · referencias cruzadas (`:REFERENCIA_NORMATIVA`) · vigencia/reformas (fecha DOF, `:VERSION_HISTORICA`) · ámbito.
- **Render:** info_card por artículo con jerarquía + **descargo obligatorio** ("texto de la norma, no asesoría legal"). **Consultas:** ¿qué dice el artículo X? ¿qué obliga a [sujeto]? ¿cómo define [término]? ¿vigente?
- **Habilita el Acervo Normativo precargado:** OSHA + anexos, NOMs de instalación/operación/mantenimiento, leyes del segmento aduanal/fiscal — ingeridas una vez, tenant común de solo lectura.

### 13. `registro_historico` — Histórico
- **Norma/práctica:** ISO 17025 (registros) / retención del SGC del cliente; bitácoras O&M.
- **Ontología:** serie de eventos fechados (`:EventoOperativo`) · activo asociado · resultado por evento · (tendencia SOLO como datos presentados — frecuencia-sí/causa-no: muestra la serie citada, jamás "se está degradando").
- **Render:** timeline_view. **Consultas:** ¿última/próxima calibración? ¿historial del activo X?

### 14. `memoria_traduccion` — Activo lingüístico *(Pista B)*
- **Norma/práctica:** formatos CAT estándar — TMX/XLIFF/TBX/SDLXLIFF/Bilingual DOCX.
- **Ontología:** segmento origen↔destino por par lingüístico (PTM, segregada estricta) · término↔equivalente con lock terminológico · metadatos de proyecto.
- **Render:** vista bilingüe alineada. **Consultas:** ¿equivalente de término X? ¿segmento previo de Y? *(conecta con el sprint de lock terminológico L2+L3)*

---

## Prioridad de implementación (aprobada por Jorge, refinada)
1. **Refinar los 2-3 activos:** `certificado_calibracion`, `hoja_seguridad`, y la subdivisión de manual en `manual_operacion`/`manual_mantenimiento` (hoy es un solo `manual_tecnico`).
2. **`norma_ley_reglamento`** — destraba el Acervo Normativo y el segmento legal/fiscal/aduanal de un golpe.
3. **`plan_control`** — automotriz, cruce con calibración (lab embajador).
4. **`instruccion_trabajo` + `instructivo`** (separados) + `manual_instalacion`.
5. **`especificacion`/`ficha_tecnica`** (refinar) + `protocolo_inspeccion`.
6. **`registro_historico`** + `memoria_traduccion` (con el sprint Pista B / lock terminológico).

## Reglas transversales
1. Tipo declarado = tipo real. El clasificador asigna, el cotizador muestra, el usuario corrige antes de aprobar.
2. Tipo sin schema → extracción genérica + aviso honesto pre-ingesta.
3. Cuatro patas por tipo: labels al scope de lectura + intents de ranking + suite de paráfrasis + render. Sin las cuatro, no se libera.
4. Datos negativos explícitos se extraen como datos (freno de alucinación = feature de schema).
5. Línea absoluta en todo: administrativo sí; diagnóstico/decisión/asesoría, jamás.

## Cobertura por segmento (validación de finitud — no se organiza por sector, se verifica que lo cubre)
- **Laboratorio metrología/ensayo:** certificado_calibracion, manual_operacion (instrumentos), registro_historico, norma (ISO 17025).
- **Manufactura/maquila:** manual_operacion/mantenimiento (CNC, equipo), plan_control, instruccion_trabajo, hoja_seguridad (fluidos), especificacion, norma (IATF/NOM).
- **Minería:** manual_operacion/mantenimiento (equipo pesado), hoja_seguridad, protocolo_inspeccion (seguridad), norma.
- **Agroindustria:** manual_operacion (equipo), hoja_seguridad (sanitizantes), norma (NOM sanitarias).
- **Farma:** instruccion_trabajo (SOP CIP), hoja_seguridad, protocolo_inspeccion, norma (COFEPRIS administrativa — jamás expedientes).
- **Construcción/instalación:** manual_instalacion, instructivo, especificacion, norma (NOM construcción/eléctrica).
- **Energía / servicios públicos:** manual_operacion/mantenimiento, manual_instalacion, protocolo_inspeccion, norma.
- **Legal/fiscal/aduanal:** norma_ley_reglamento (Acervo), + registro/especificacion según caso.
- **Agencias (Pista B):** memoria_traduccion + cualquier tipo como documento a traducir.

Los 14 tipos cubren los nueve segmentos explorados sin huecos. Un segmento nuevo se cubre combinando tipos existentes, no creando tipos — confirma la finitud del catálogo.

---
*Catálogo Normativo de Schemas v2 — CERRADO — Junio 2026 · DOCYAN LDE™ by XCID*
*Estructurado por fase del ciclo de vida del activo. Cada tipo derivado de su norma. Implementación post-UI-2, regla de cuatro patas.*
