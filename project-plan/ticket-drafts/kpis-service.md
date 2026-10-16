## Contexto

PitStop necesita calcular sus indicadores diarios con datos reales y conservar el resultado que usará el proceso de publicación. La API entregará indicadores de negocio y tráfico HTTP, junto con una explicación cuando falten datos.

La persistencia y el registro de requests ya existen. Falta conectar esas piezas con los cálculos y una consulta protegida para el proceso automático.

## Objetivo

Consultar una fecha cerrada, calcular sus indicadores, guardar el resultado y devolverlo al proceso de publicación.

**Referencia visual:** no aplica (backend).

## Qué tiene que quedar andando

- La consulta devuelve valores calculados con datos reales para el día solicitado.
- Cada resultado queda guardado con la evidencia necesaria para revisar el cálculo.
- La respuesta distingue un valor medido, la falta de datos y una falla al consultar la fuente.
- La consulta exige una credencial de servicio y rechaza fechas abiertas o inválidas.

## Por dónde empezar

1. Revisar KpisRepository, los modelos existentes y las reglas del ADR 02.
2. Escribir los cálculos con datos conocidos y sus pruebas Jest.
3. Agregar consultas de agregación, endpoint y protección de servicio.
4. Probar el contrato y la persistencia con las suites de la API.
5. Ejecutar la API y consultar una fecha cerrada con datos de desarrollo conocidos.

## Palabras que vas a ver

- **Snapshot:** resultado conservado de un cálculo para una fecha y ambiente.
- **Guard:** control que rechaza la consulta si la credencial de servicio no es válida.
- **Percentil 95:** duración que deja al menos el noventa y cinco por ciento de las muestras por debajo o en ese valor.
- **NO_DATA:** resultado sin evidencia suficiente; no equivale a un cero medido.

---

# Especificación técnica

## Datos del ticket

- Título: **Calcular y guardar los indicadores diarios de negocio y tráfico HTTP**.
- Operación: actualizar **PIT-69**; reemplazar su contrato anterior, sin crear un duplicado.
- Proyecto: KPI Reporting. Estado: Backlog. Sin cycle.
- Semana: 2026-10-15 al 2026-10-22; Sprint 3, semana 1 de 4.
- Fecha límite: **2026-10-22**.
- Estimado: **3 SP (~3 horas)**, presupuesto del plan que presupone reutilizar PIT-66 y PIT-68.
- Responsable: **Manuel Gioino**. Prioridad: **1 / Urgent**, por bloquear la publicación de la semana.
- Etiquetas: Fullstack, Feature.
- Depende de: **sin bloqueos pendientes** según la revisión de planificación; PIT-66 y PIT-68 están Done.
- La evidencia y el cálculo definitivo de alert_resolution_rate se entregan en la tarea local `PIT-73`, dependiente de PIT-69. Hasta integrarla, este endpoint conserva el diagnóstico NO_DATA; no bloquear PIT-69 por esa tarea.

## Alcance

- Extender el módulo existente con servicio, controller y DTO; reutilizar CronSecretGuard.
- Agregar agregaciones en repositories y reutilizar la persistencia existente.
- Calcular cuatro indicadores de negocio y dos de tráfico HTTP.
- Excluir el propio endpoint del tráfico de aplicación.
- Incluir pruebas unitarias, de endpoint y de persistencia aplicables.

## Backend

### Piezas existentes que se reutilizan

En el checkout limpio revisado `efca4dc` el 15 de octubre de 2026:

- `apps/api/src/modules/kpis/kpis.module.ts` registra y exporta `KpisRepository`.
- `kpis.repository.ts` ofrece `createRunWithResults` y `findRunById`; la creación anidada guarda corrida y resultados atómicamente.
- `apps/api/prisma/models/kpi.prisma` ya define `KpiRun`, `KpiResult`, ambientes DEV/PROD y estados READY/NO_DATA/ERROR. No recrear tablas ni migraciones de PIT-68.
- `HttpRequestLog` ya conserva tiempos, código, outcome y trafficKind; usar esos registros de PIT-66.
- `Maintenance.date` representa una fecha calendario; `createdAt` representa el momento de registro. `Vehicle.ownerId` permite contar propietarios distintos.
- `MaintenanceAlertDelivery` conserva intentos y envíos, pero no basta para demostrar un ciclo resuelto por un mantenimiento dentro de plazo.

Archivos nuevos propuestos, bajo `apps/api/src/modules/kpis/`:

```text
kpis.controller.ts
kpi.service.ts
kpi-calculations.ts
dto/daily-kpis-query.dto.ts
kpi.service.spec.ts
kpi-calculations.spec.ts
dto/daily-kpis-query.dto.spec.ts
```

Modificar el módulo y repository existentes; agregar pruebas de endpoint en `apps/api/test/kpis.e2e-spec.ts`. Los nombres propuestos pueden adaptarse a las convenciones del repositorio conservando estas responsabilidades.

Controller → service → repository. Todas las operaciones Prisma permanecen en repositories. Las fórmulas y el reloj deben poder probarse sin HTTP ni una base real.

### Endpoint y configuración

```http
GET /internal/kpis/daily?date=2026-10-21&env=dev
Authorization: Bearer <CRON_SECRET>
```

- `date` es obligatorio: fecha calendario real en formato estricto YYYY-MM-DD. Rechazar fechas imposibles, formatos alternativos, día abierto y fechas futuras.
- El reloj y el corte se interpretan en `America/Argentina/Buenos_Aires`.
- Reutilizar CRON_SECRET y su configuración existente. No agregar una variable de ambiente para identificar el contexto KPI en el backend.
- El runner envía `env=dev|prod` como contexto de publicación asociado a la PROJECT_KEY seleccionada en Actions. Es obligatorio y se valida como enum antes de consultar o persistir. PROJECT_KEY queda exclusivamente en el publicador; nuestra API no la recibe ni intenta decodificarla.
- El env recibido etiqueta la corrida para reutilizar el esquema existente; no selecciona otra base ni prueba el ambiente de los datos. El workflow debe usar API_BASE_URL y CRON_SECRET del despliegue acordado. No deducir ambiente desde NODE_ENV o la rama.
- Persistir DEV/PROD y devolver dev/prod mediante una conversión explícita.
- Aplicar `@Public()` y `@UseGuards(CronSecretGuard)`, siguiendo `MaintenanceAlertsController`. Reutilizar la clase existente de `apps/api/src/modules/maintenance-alerts/cron-secret.guard.ts` y registrarla como provider de KpisModule; no copiar su implementación ni crear otro guard. La request no verifica un token Firebase ni sincroniza un usuario.
- Conservar las pruebas existentes de CronSecretGuard y agregar pruebas de endpoint que demuestren que este controller realmente lo aplica: secreto válido, ausente, incorrecto y CRON_SECRET sin configurar. No hace falta duplicar los tests unitarios del guard.
- El secreto se recibe por header; nunca se registra ni se incluye en URLs o respuestas.
- Responder con `Cache-Control: no-store`.

| Código | Condición |
|---|---|
| 200 | Cálculo y persistencia completados, incluso con resultados NO_DATA |
| 400 | Fecha faltante, inválida, abierta o futura |
| 401 | Credencial ausente o inválida |
| 503 | Fallo de una fuente o de persistencia; diagnóstico seguro |

### Ventanas y fórmulas

Todas las ventanas usan inicio inclusivo y final exclusivo. El día 2026-10-21 comprende `2026-10-21T03:00:00.000Z` a `2026-10-22T03:00:00.000Z`. La ventana de treinta días comprende el día medido y los veintinueve anteriores.

| KPI | Cálculo y evidencia |
|---|---|
| `preventive_rate` | Servicios con categoría MANTENIMIENTO / total de servicios (MANTENIMIENTO + ARREGLO) de la ventana de treinta días × 100, por fecha de servicio. MANTENIMIENTO es preventivo y ARREGLO es no preventivo; equivalencia confirmada por negocio. Exigir createdAt anterior al corte; excluir el límite final. |
| `alert_resolution_rate` | Ciclos evaluables resueltos en plazo / ciclos evaluables al corte × 100. Requiere envío efectivo y vínculo de resolución del mismo vehículo, tipo y ciclo. Sin evidencia suficiente: NO_DATA y `ALERT_RESOLUTION_EVIDENCE_MISSING`. |
| `service_users_30d` | Propietarios distintos de vehículos con servicios cuyo createdAt cae dentro de la ventana de treinta días. |
| `active_vehicles_30d` | Vehículos distintos con servicios cuyo createdAt cae dentro de esa misma ventana. |
| `api_error_rate` | Requests APPLICATION y COMPLETED con código 5xx / total APPLICATION y COMPLETED del día × 100. Usar startedAt para pertenencia a la ventana y conservar esa regla en las pruebas. |
| `api_latency_p95` | Ordenar duraciones de esas mismas requests y tomar el elemento de posición `ceil(0.95 × n)`, contando desde uno. |

Un conteo exitoso sin registros vale cero. Una proporción sin denominador o un percentil sin muestras produce NO_DATA. No convertir una excepción en NO_DATA ni inferir resolución de alertas a partir de cualquier mantenimiento.

Para alertas, la regla del plan considera evaluables los ciclos enviados cuyo plazo venció al corte; exige confirmación de negocio antes de activar la métrica. Mientras falte esa definición o su evidencia, conservar NO_DATA. Este ticket no construye esa evidencia ni redefine la regla: la tarea local `PIT-73` implementa ambas piezas e incorpora el cálculo en este mismo servicio.

### Ejemplos de cálculo y búsqueda en la base

Las búsquedas siguientes describen las agregaciones que deben implementar los repositories sobre los modelos existentes; no requieren tablas nuevas. Los ejemplos son independientes entre sí. Aplicar siempre las ventanas y exclusiones de la sección anterior.

**`preventive_rate` — porcentaje de servicios preventivos.**

- Buscar en `Maintenance` por `date` dentro de los treinta días y `createdAt` anterior al corte.
- Numerador: contar los registros con `category = MANTENIMIENTO`.
- Denominador: contar todos los registros de esa selección, tanto MANTENIMIENTO como ARREGLO. No dividir solamente por los arreglos.
- Ejemplo: 3 MANTENIMIENTO y 2 ARREGLO → `100 × 3 / (3 + 2) = 60 %`.
- Solo ARREGLO, con al menos un servicio → `0 %` READY. Solo MANTENIMIENTO → `100 %` READY. Ningún servicio → NO_DATA.

**`alert_resolution_rate` — porcentaje de ciclos de alerta resueltos en plazo.**

- Fórmula: `100 × ciclos evaluables resueltos en plazo / ciclos evaluables al corte`.
- Ejemplo conceptual, aplicable solo cuando exista la evidencia y la regla esté confirmada: 10 ciclos evaluables, 8 resueltos en plazo y 2 sin resolver o resueltos tarde → `80 %`.
- `MaintenanceAlertDelivery` permite buscar envíos efectivos mediante `status = SENT` y reconocer su ciclo con `scheduleId` y `dueKey`. Sus filas representan entregas por instalación: varias entregas del mismo ciclo no son varias alertas evaluables.
- Ese modelo no tiene un vínculo que pruebe qué mantenimiento resolvió el ciclo ni cuándo lo resolvió. No existe hoy una consulta suficiente para calcular el numerador: no inferirlo uniendo cualquier servicio posterior ni usar el conteo de envíos como sustituto.
- Mientras falte la definición o evidencia requerida, devolver NO_DATA con `ALERT_RESOLUTION_EVIDENCE_MISSING`. Si eventualmente existe evidencia completa pero no hay ciclos evaluables, también corresponde NO_DATA por denominador cero.

**`service_users_30d` — usuarios distintos que registraron servicios.**

- Seleccionar `Maintenance` por `createdAt` dentro de los treinta días, relacionar `Maintenance.vehicleId` con `Vehicle.id` y contar `Vehicle.ownerId` distintos.
- Ejemplo: un propietario tiene dos vehículos con cinco servicios en total y otro propietario tiene un vehículo con dos servicios → `2 usuarios`.
- Contar propietarios, no servicios ni vehículos. No filtrar por categoría: ambas representan actividad. Una consulta exitosa sin registros devuelve `0` READY.

**`active_vehicles_30d` — vehículos distintos con actividad.**

- Sobre la misma selección de `Maintenance.createdAt`, contar `vehicleId` distintos, sin filtrar categoría.
- En el ejemplo anterior hay `3 vehículos activos`, aunque sean siete servicios y solo dos propietarios.
- Una consulta exitosa sin registros devuelve `0` READY.

**`api_error_rate` — porcentaje de requests que terminaron con 5xx.**

- Seleccionar `HttpRequestLog` por `startedAt` dentro del día, `trafficKind = APPLICATION` y `outcome = COMPLETED`.
- Numerador: contar las seleccionadas con `500 <= statusCode < 600`. Denominador: todas las seleccionadas, incluidos 2xx, 3xx, 4xx y 5xx.
- Ejemplo: códigos 200, 200, 404 y 500 → `100 × 1 / 4 = 25 %`. Un 404 no aumenta el numerador.
- Con requests pero sin 5xx → `0 %` READY. Sin requests elegibles → NO_DATA. Excluir HEALTH, REPORTING, UNMATCHED y ABORTED.

**`api_latency_p95` — percentil 95 de duración de requests.**

- Reutilizar exactamente la selección HTTP anterior, incluidos los 5xx completados, y ordenar sus `durationMs` de menor a mayor.
- Con `n` muestras, tomar la posición `ceil(0.95 × n)`, contando desde uno; en un array con índices desde cero usar `ceil(0.95 × n) - 1`. No interpolar ni calcular el promedio.
- Ejemplo: duraciones de 1 a 20 ms → posición `ceil(19) = 19` → `19 ms`. Con una sola muestra de 120 ms → `120 ms`.
- Sin muestras → NO_DATA. Conservar `sampleCount` como evidencia; la unidad es milisegundos.

### Registro HTTP y persistencia

- El middleware de PIT-66 hoy clasifica HEALTH y APPLICATION, aunque el enum incluye REPORTING. Clasificar el endpoint KPI como REPORTING y agregar su prueba de regresión; no permitir que sus consultas alteren errores o latencia de aplicación.
- Excluir HEALTH, REPORTING, UNMATCHED y ABORTED del denominador HTTP; informar ABORTED por separado en diagnósticos agregados.
- Generar un UUID de corrida en el backend y guardar seis resultados con ventanas, versión de cálculo y conteos disponibles.
- Usar una vista consistente para las consultas relacionadas, mediante la capacidad transaccional de Prisma encapsulada en repositories. Guardar corrida y seis resultados atómicamente.
- COMPLETED significa que la evaluación terminó sin errores, aunque haya NO_DATA; FAILED identifica una evaluación con ERROR. No equivale a publicación externa.
- Ante una falla de fuente, intentar conservar una corrida FAILED con diagnóstico ERROR si la base está disponible y responder 503. Si falla la base, no afirmar que se conservó nada ni dejar registros parciales.
- Una nueva request puede generar una corrida distinta para la misma fecha. El reintento del envío externo recuperará el lote ya guardado por Actions; no vuelve a llamar a este endpoint.
- Los datos editables no permiten reconstruir perfectamente un pasado: el snapshot conserva el cálculo realizado con los registros disponibles.

### Contrato de respuesta

```json
{
  "runId": "2dd1afc0-43bb-4f82-bb16-0b4dbcb892c0",
  "date": "2026-10-21",
  "env": "dev",
  "calculationVersion": "1",
  "windowStart": "2026-10-21T03:00:00.000Z",
  "windowEnd": "2026-10-22T03:00:00.000Z",
  "measurements": [
    { "kpi_id": "preventive_rate", "value": 60 }
  ],
  "diagnostics": [
    {
      "kpi_id": "preventive_rate",
      "status": "READY",
      "windowStart": "2026-09-22T03:00:00.000Z",
      "windowEnd": "2026-10-22T03:00:00.000Z",
      "numerator": "3",
      "denominator": "5"
    }
  ]
}
```

El ejemplo muestra un indicador; la respuesta completa tiene seis diagnósticos y solo los measurements READY. Los límites superiores describen el día medido; cada diagnóstico informa su ventana efectiva, que puede ser de treinta días.

Los READY contienen números finitos. NO_DATA/ERROR aparecen únicamente en diagnostics, con código seguro; no se publican como mediciones nulas. Serializar los BigInt de conteos como strings decimales. No incluir propietarios, vehículos individuales, stack traces ni secretos.

## Pruebas y criterios de aceptación técnicos

| Prueba | Resultado esperado |
|---|---|
| Tres preventivos y dos arreglos | preventive_rate = 60 |
| Solo ARREGLO / solo MANTENIMIENTO, con servicios | preventive_rate = 0 / 100, ambos READY |
| Dos vehículos del mismo propietario con varios servicios | Un usuario y dos vehículos activos; sin duplicación por servicio |
| Consultas exitosas sin servicios | Conteos de usuarios/vehículos = 0; proporción preventiva NO_DATA |
| Alertas sin vínculo de resolución | NO_DATA con diagnóstico específico; sin valor inventado |
| Una request 500 y tres 200 | api_error_rate = 25 |
| Duraciones de 1 a 20 ms | api_latency_p95 = 19 ms |
| HEALTH, REPORTING, ABORTED y UNMATCHED | No alteran los valores HTTP de aplicación |
| Fecha de servicio vs createdAt | Cada KPI usa su campo y ventana definidos |
| Inicio y final de ventana | Incluye inicio; excluye final, con reloj fijo y corte argentino |
| Fecha imposible, abierta o futura | 400, sin consultas ni escritura de corrida |
| Secreto ausente o incorrecto | 401; no sincroniza usuarios Firebase |
| env ausente o distinto de dev/prod | 400, sin persistencia; PROJECT_KEY no se envía al backend |
| Fallo de fuente / persistencia | 503; diagnóstico seguro y ninguna escritura parcial |
| Conteos BigInt | JSON serializable sin pérdida de precisión |

Comandos aplicables desde la raíz del MVP:

```bash
pnpm --filter api exec jest --runInBand
pnpm --filter api exec jest --config ./test/jest-e2e.json --runInBand
pnpm --filter api test:e2e:db
pnpm format:check
pnpm lint
pnpm check-types
pnpm build
```

La suite con base exige TEST_DATABASE_URL de una base dedicada cuyo nombre termine en `_test`, siguiendo el control existente. Nunca ejecutar esos casos sobre la base de desarrollo compartida o producción.

Cerrar con consulta real contra la API en desarrollo, comparación contra datos conocidos y lectura de la corrida y sus seis resultados guardados. PR aprobado y mergeado según la definición de terminado.

## Fuera de alcance

- Publicación en Supabase, scripts de GitHub y disponibilidad, workflows y dashboard.
- Recreación de la persistencia o instrumentación de PIT-66/PIT-68.
- Construcción del historial y cálculo definitivo de resolución de alertas, cubiertos por `PIT-73`; registro manual del catálogo.
- Garantizar seis mediciones publicables cuando falte evidencia.
