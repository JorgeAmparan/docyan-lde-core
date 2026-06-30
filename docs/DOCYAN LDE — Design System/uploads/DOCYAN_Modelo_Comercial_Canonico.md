# DOCYAN LDE™ — Modelo Comercial Canónico

**Producto:** DOCYAN LDE — Live Document Environment by XCID
**Documento:** referencia comercial canónica. Rige sobre los Sprint Contracts comerciales (F1.5 débito, F4 Stripe, ciclo de vida de suscripción) y sobre los TyC / Política de Privacidad.
**Estado:** decisiones cerradas en sesión de junio 2026. No re-validar salvo evidencia de mercado.
**Versión:** 1.1 — Junio 2026 (piso $15 + cupo de ingestas por tier; antes 1.0 con piso $25 sin cupo)

---

## 1. Principio rector

DOCYAN monetiza en **dos planos complementarios**, no en uno:

- **Setup por ingesta** — gancho primario, margen fuerte. El cliente paga por convertir cada documento en conocimiento vivo consultable.
- **Suscripción mensual** — segundo gancho, ingreso recurrente. El cliente paga por mantener ese conocimiento vivo, accesible y operativo.

El costo real de cómputo (ingesta) es de **centavos por documento**. El precio NO se ancla al costo, se ancla al **valor**: convertir un documento muerto y disperso en conocimiento consultable al instante. El cliente nunca paga el cómputo; paga el valor.

---

## 2. Setup por ingesta — Modelo 2 (cliente administra su ritmo)

### 2.1 Definición

El cliente **decide cuántos documentos carga y cuándo**, dentro del límite de su plan. No hay tarifa de setup fija por adelantado. Cada documento se cotiza de forma transparente **antes** de ingerir; el cliente confirma; se cobra el monto cotizado.

Ejemplos de uso real del cliente:
- Sube 30 este mes, 20 el próximo, 5 de actualización en otro.
- O carga de 15 en 15 a lo largo de 3-4 meses, según su presupuesto y experiencia con la plataforma.

### 2.2 Por qué este modelo (ventajas)

- **Sin abuso posible** — nada se ingiere sin cotización aprobada; el costo siempre lo cubre quien lo genera. Un PDF con varios manuales pegados cuesta lo que cuesta procesarlo, y el cliente lo aprueba antes.
- **Transparencia total** — el cliente ve el precio antes de confirmar. En un producto nuevo que pide confianza, mostrar el costo real antes de cobrar desarma la desconfianza de entrada.
- **Control bilateral** — el cliente administra su gasto al ritmo de su flujo de caja y su necesidad; DOCYAN nunca procesa a pérdida.
- **Reduce el riesgo de adopción** — el cliente prueba con pocos documentos, ve el valor, y escala cuando quiere. El modelo mismo baja la barrera de entrada para pilotos y prospectos nuevos.

### 2.3 Cupo de ingestas incluido por tier (cerrado — junio 2026)

Cada tier de suscripción **incluye un cupo de ingestas sin costo de setup**. La fórmula de cobro (§2.4) aplica **solo al excedente del cupo**.

| Tier | Cupo inicial (mes 1) | Cupo mensual recurrente |
|---|---|---|
| **Esencial** | 10 ingestas | 3 / mes |
| **Profesional** | 30 ingestas | 10 / mes |
| **Enterprise** | negociado | negociado |

**Razón comercial:** el setup cobrado desde el primer documento golpeaba el momento de conversión — el usuario que decide pagar se encontraba con "suscripción Y ADEMÁS $X por documento", lectura de doble cobro que mata conversión en la puerta. El cupo inicial resuelve la carga de arranque (el perfil típico entra con 10-13 documentos y paga $0 de setup el primer mes); el cupo mensual mantiene el entorno creciendo sin fricción. El costo real de regalar el cupo es de centavos (§2.5); el valor percibido del plan sube ~30% sin mover el margen.

**Mensaje al cliente (página de precios y cotizador):** "incluye N documentos; adicionales desde $15" — la misma economía contada como generosidad, no como peaje. El excedente lo paga quien ya vive adentro del producto y carga en serio — a ese cliente el setup no lo frena.

### 2.4 Fórmula de cobro por ingesta excedente (cerrada)

```
precio_ingesta = MAX( $15 USD , costo_base_real × 25 ) × factor_complejidad
```

Aplica únicamente a documentos que exceden el cupo del tier (§2.3). Donde:

```
costo_base_real = (tokens_entrada × precio_entrada)
                + (tokens_salida_estimada × precio_salida)
                + costo_embeddings
```

**Componentes:**

| Componente | Valor | Razón |
|---|---|---|
| **Piso mínimo** | **$15 USD** | Precio mínimo por usar el motor de ingesta de DOCYAN sobre el excedente. Debajo del umbral de fricción psicológica (~15% del costo anual de suscripción en cargas grandes), arriba del territorio commodity. Cobra el valor, no el costo. Deja aire para descuentos por volumen negociados en Enterprise. |
| **Margen multiplicador** | **25×** | Sobre el costo real. Para documentos grandes/caros (300+ páginas, OCR pesado) cuyo costo real sube a $1-2 USD, asegura cobrar proporcionalmente más ($40-60) cubriendo el costo extra con holgura. Es la protección de costo real; el piso es señal de valor. |
| **factor_complejidad** | **1.0 inicial** | Perilla de ajuste por tipo documental. Arranca neutro; se calibra con datos de uso real si un tipo (ej. MSDS estructurado vs. manual con tablas/OCR) lo justifica. |

**Comportamiento del `MAX`:** para la inmensa mayoría de documentos excedentes (costo real de centavos), **gana el piso de $15**. Solo los documentos monstruosos activan `costo_base × 25` y se cobran más. Así nunca cobras centavos ni pierdes dinero en un documento caro.

**Referencia de decisión (junio 2026):** se evaluaron pisos de $25/$20/$15/$12 contra el caso de 40 documentos en Esencial banda A. A $25 el setup total ($1,000) representaba 33% del costo anual de suscripción — lectura de "mes 4 extra por entrar". Entre $25 y $20 no hay diferencia comercial (misma categoría mental). A $12 se pierde el carácter de servicio y el aire de negociación. **$15 con cupo** deja el caso de 40 documentos en $405 reales, distribuibles al ritmo del cliente (Modelo 2), debajo del umbral de fricción, con margen sobre cómputo intacto (~99%).

### 2.5 Referencia de costos reales (junio 2026)

Medición para calibrar la fórmula (cotizador mide tokens exactos con tiktoken antes de procesar):

- **Gemini 2.5 Flash** (extracción/resolución): ~$0.30 / millón tokens entrada, ~$2.50 / millón salida.
- **QA / consulta** (gpt-4o-mini o Claude Haiku): ~$0.25 / millón entrada, ~$1.25 / millón salida.
- **Documento de 30 páginas** (~15,000 tokens in, ~3,000 out): costo real de extracción < 2 centavos; con embeddings + QA, **2-4 centavos por documento**.

Conclusión: el costo es de centavos; el precio de $15 sobre el excedente es valor, no margen sobre cómputo. Regalar el cupo incluido por tier cuesta centavos reales y compra conversión al recurrente.

### 2.6 Validación de accesibilidad (argumento de venta)

- **Maquiladora T-MEC (Profesional):** 50 documentos con cupo incluido (30 iniciales + 10/mes) → solo ~10-20 excedentes × $15 USD ≈ $2,800-5,500 MXN de setup real, distribuible al ritmo del cliente. Menos de lo que gastan en carpetas físicas para alojar documentos que nadie consulta. La comparación vende sola: conocimiento vivo permanente vs. papel muerto.
- **Cliente de BuildTech (edificio en EE.UU., Profesional banda B):** 50 documentos con cupo → ~$150-300 USD de setup excedente real. Menos que una silla de recepción, por convertir 50 documentos en conocimiento vivo permanente.
- **Filtro de calidad:** un precio sólido atrae clientes que valoran el producto y dan feedback serio (mejores pilotos), en vez de cazadores de gangas que prueban y abandonan.

### 2.7 El plan define el límite, el cupo y el excedente, el cliente decide el uso

El plan de suscripción incluye derecho a **hasta N documentos vivos** (ej. 50) y un **cupo de ingestas sin costo** (§2.3). El cliente decide cuántos usar y cuándo; el excedente del cupo se cotiza con la fórmula §2.4 y se confirma antes de cobrar (Modelo 2). El límite es derecho, no obligación.

---

## 3. Suscripción mensual — el entorno vivo

### 3.1 Qué cubre

La suscripción mensual cubre los **costos operativos del entorno vivo de DOCYAN** con margen de utilidad:
- Infraestructura (Fly.io, FalkorDB, Redis, almacenamiento).
- Disponibilidad del entorno consultable (QR persistente, consultas, usuarios).
- Mantenimiento del conocimiento vivo y la inteligencia organizacional.

### 3.2 Posicionamiento de precio

**Accesible, un poco más holgada hacia el cliente.** La suscripción es el **segundo gancho**, no la barrera de entrada. El primer contacto con el valor es subir un documento y verlo volverse consultable (el setup). La suscripción sostiene ese valor una vez probado. Por eso se mantiene accesible: no debe asustar antes de que el cliente sienta el producto.

El margen fuerte vive en el setup; la suscripción es ingreso recurrente predecible y gancho de retención.

### 3.3 Relación setup ↔ suscripción

- **Setup** paga *meter* el documento (cómputo de ingesta + valor).
- **Suscripción** paga *tenerlo vivo y consultable* (operación continua).
- Mientras haya suscripción activa, el entorno está vivo. Sin pago, el entorno se duerme (ver §4).

---

## 4. Ciclo de vida de impago (cerrado)

Estructura estándar de la industria, generosa con clientes industriales que confían documentación crítica. Periodos cerrados:

### 4.1 Las tres fases

| Fase | Duración | Estado del entorno | Datos |
|---|---|---|---|
| **Gracia** | **7 días** | Plenamente funcional | Intactos |
| **Suspensión** | **60 días** | Dormido (sin acceso) | Almacenados, a salvo |
| **Cancelación** | tras los 67 días | Eliminado | Eliminados (salvo retención FAT) |

### 4.2 Línea de tiempo y alertas (correo-e en cada transición)

- **Día 0** — vence el pago, no entra. Entorno funcional. **Alerta de vencimiento.**
- **Días 1-7 (gracia)** — entorno plenamente funcional. **Recordatorios de pago.** El que va a pagar, paga rápido.
- **Día 7** — gracia agotada → **suspensión**. Entorno se duerme: documentos almacenados intactos, consultas y QR bloqueados con mensaje "suscripción suspendida, reactiva para recuperar acceso". **Alerta de suspensión** (deja claro que los datos están a salvo y cómo reactivar).
- **Días 7-67 (suspensión, 60 días)** — datos a salvo, sin acceso. **Alertas periódicas** + una **alerta crítica final** antes de eliminar ("tus datos se eliminarán el [fecha], última oportunidad de reactivar").
- **Día 67** — suspensión agotada → **cancelación y eliminación** de la documentación del cliente.

### 4.3 Eliminación vs. retención FAT (línea regulatoria)

"Eliminar la documentación del cliente" significa eliminar el **acceso y el entorno vivo** (contenido consultable, grafo). Pero los **rastros de auditoría (FAT)** pueden tener obligación de retención mayor — política de **7 años en producción**. Distinguir siempre:
- **Contenido consultable del cliente** → se elimina al cancelar.
- **Rastro auditable (FAT)** → se retiene según obligación regulatoria del segmento.

Esto se refleja en los TyC y en la lógica de eliminación del sistema.

---

## 5. Implicaciones técnicas (para Sprint Contracts)

### 5.1 F1.5 — Débito real / cobro de setup

El cotizador (ya construido en F1) mide con tiktoken, verifica primero el cupo disponible del tier (§2.3 — dentro de cupo: $0 de setup, solo confirma), y para excedentes muestra el precio según la fórmula §2.4. El **débito** cobra ese setup al confirmar, con esquema **reservar / liquidar / liberar** (opción C):
- Al **confirmar**: reserva el monto cotizado.
- Al **completar**: liquida a consumo real (devuelve sobrante si la estimación fue mayor).
- Al **fallar**: libera la reserva completa.
- **Idempotencia SHA-256** (ya construida en F1): un reintento no re-reserva ni re-cobra; un documento con hash ya liquidado no se cobra de nuevo.

`BudgetManager.debitar()` existe pero no se invoca (hallazgo de Opus en F1) — F1.5 lo cablea como liquidación del setup, no como débito plano.

### 5.2 Ciclo de impago — automatización

La maquinaria gracia/suspensión/eliminación con alertas por correo requiere:
- **Scheduler** (APScheduler con backend Redis, ya en stack) para las transiciones por fecha.
- **Envío de correo** para las alertas.
- **Estados de tenant** (`active`/`grace`/`suspended`/`cancelled`) — base ya dejada en `org_billing.lifecycle_status` (F2).

Cae con F4 (Stripe) por compartir la lógica de suscripción, o contrato propio. Mientras Stripe no esté activo, la renovación y el avance de fase pueden dispararse por fecha o manualmente al registrar pago manual (F2).

### 5.3 Cobro en fase piloto

Cobro **manual** sigue vigente (registro en F2, `manual_payments`). Stripe entra después de 3-5 clientes (F4). La fórmula y el ciclo de vida operan igual con cobro manual.

---

## 6. PENDIENTE — Postura de PI (resolver ANTES de pilotos)

A incorporar en **TyC y Política de Privacidad** antes de cualquier piloto:

1. **PI del documento original** — el cliente conserva toda la propiedad de sus documentos. DOCYAN no reclama propiedad del contenido.
2. **Conocimiento derivado vs. motor** — el contenido derivado (grafo, anotaciones) pertenece al cliente; la estructura, método y tecnología que lo genera son de DOCYAN/XCID. El cliente se lleva su conocimiento si se va; no se lleva el motor.
3. **Eliminación de grafo vs. retención FAT** al cancelar (ver §4.3) — el cliente debe consentir esta distinción.
4. **Inteligencia organizacional (el foso)** — blindar el derecho de DOCYAN a usar datos **agregados y anonimizados** para mejorar el producto. Sin esto, el foso podría no ser legalmente utilizable. Cruzar con confidencialidad de clientes regulados.
5. **PI de traducción / glosario canónico** — diferido a alcance de Nivel 2 (traducción rigurosa).

---

## 7. Resumen ejecutivo (una línea por decisión)

- **Setup:** Modelo 2 — cliente carga a su ritmo, cotizador transparente cobra al confirmar; cupo incluido por tier primero, fórmula solo al excedente.
- **Cupo incluido:** Esencial 10 iniciales + 3/mes · Profesional 30 + 10/mes · Enterprise negociado. Setup $0 dentro del cupo.
- **Fórmula (solo excedente):** `MAX($15 USD, costo_base × 25) × factor_complejidad`.
- **Suscripción:** accesible, cubre operación del entorno vivo con margen, segundo gancho.
- **Plan:** incluye hasta N documentos como derecho; el cliente decide el uso.
- **Impago:** gracia 7d → suspensión 60d → cancelación + eliminación, con alertas por correo.
- **Retención:** contenido se elimina; FAT se retiene 7 años.
- **Cobro:** manual en piloto; Stripe tras 3-5 clientes.
- **PI:** pendiente, resolver en TyC/Privacidad antes de pilotos.

---

*DOCYAN LDE™ by XCID — Modelo Comercial Canónico v1.1 — Junio 2026*
*Rige sobre Sprint Contracts comerciales y documentos legales. Decisiones cerradas; no re-validar salvo evidencia de mercado.*
