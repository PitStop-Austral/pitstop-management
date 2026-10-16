# Implementación de KPI Reporting — draft del 22 de octubre

Revisión local del 15 de octubre de 2026, con la skill pitstop-create-linear-tickets. Fuente de SP: features.yaml actual; seis tareas de 3 SP. Fuente técnica: pitstop-app efca4dc, docs/kpis.md y tickets existentes. Carga parcial: PIT-69/PIT-71 actualizados, PIT-72/PIT-73 creados; PIT-74/PIT-75 creados para Ignacio; las seis tareas están en Linear.

## Propuesta revisable

[Reparto, títulos y puntos pendientes](2026-10-22.md). [Payload de carga posterior](2026-10-22.json).

## Arquitectura y límites entre tareas

- PIT-69 calcula negocio y HTTP dentro de la API y guarda la corrida y seis resultados mediante PIT-68. Conserva NO_DATA de alertas hasta completar la nueva evidencia; esa tarea depende de PIT-69 y no al revés.
- PIT-71 no depende de PIT-69 para implementar ni entregar: usa fixtures y un receptor controlado; si la API real no está disponible, falla visiblemente. PIT-75 valida la integración real. PIT-71 define contrato común, consulta API, respaldo, publicación, verificación y recuperación manual del mismo lote. No vuelve a calcular durante recover ni se agrega recuperación a PIT-67.
- Disponibilidad agrega sondeos de PIT-67; GitHub calcula ci_success_rate y mean_time_to_merge. Ambos scripts entregan fragmentos a la integración conjunta; no acceden a Neon ni publican por separado.
- La tarea de alertas extiende envíos, registro/edición/eliminación de servicios, recordatorios y modificaciones de kilometraje con evidencia transaccional. Su cálculo se integra al módulo KPI existente, sin otro endpoint ni fuente de runner.
- Una sola integración reúne las tres fuentes y verifica el cierre final, incluido alert_resolution_rate. Conservar NO_DATA, ERROR y publicación parcial de READY según el contrato, sin inventar ceros.

## Estado del repositorio verificado

KpisRepository existe con createRunWithResults y findRunById; modelos KpiRun/KpiResult y HttpRequestLog implementados. El middleware reserva REPORTING pero hoy clasifica APPLICATION/HEALTH/UNMATCHED: PIT-69 agrega la exclusión del endpoint KPI. MaintenanceAlertDelivery guarda envíos por instalación con dueKey y finishedAt, sin resolución por servicio. SchedulesRepository recalcula baselines al cambiar servicios, por lo que la evidencia debe conservarse antes. VehiclesRepository actualiza kilometraje tanto por update como por updateMileageIfNotDecreased; también sube desde servicios.

Existen ci.yml y maintenance-alerts.yml. No existe todavía kpi-health-monitor.yml ni scripts/kpis en main de este checkout; PIT-67 sigue In Progress. Su JSON actual no garantiza env/eventName. No recrear las piezas Done de PIT-63/66/68.

## Contrato común

Cada fuente usa --date YYYY-MM-DD --env dev|prod --output <archivo>. Fragmentos con schemaVersion, source, date/env, calculationVersion, referencias, diagnostics y measurements solo READY. Fuentes: api, availability y delivery; delivery conserva su nombre interno pero contiene ci_success_rate (%) y mean_time_to_merge (h). El cálculo usa cortes argentinos, los seis diagnósticos de API y el lote definitivo antes del primer POST. Publicación y recuperación se detallan en el draft de PIT-71.

## Capacidad y coordinación

Las seis tareas suman 18 SP y el reparto propuesto es de 6 SP por persona, con fecha límite 2026-10-22. Se conservan los SP actuales, sin reestimarlos. KPI Reporting totaliza 26 SP con sus 8 históricos; el Sprint 3 tiene 68 SP por fechas frente a 72 de capacidad. No se modifican otras tareas, valor ganado ni el avance manual del reporte cronológico.

La regla de resolución por fecha/km requiere revisión funcional antes de activarla; hasta entonces NO_DATA. El ADR conserva una descripción anterior de reintentos periódicos, mientras PIT-71 vigente usa recuperación manual: registrar la actualización arquitectónica antes de cerrar la implementación. El catálogo se registra manualmente fuera de estas tareas.

## Descripciones completas

### 1. Calcular y guardar los indicadores diarios de negocio y tráfico HTTP

#### Contexto

PitStop necesita calcular sus indicadores diarios con datos reales y conservar el resultado que usará el proceso de publicación. La API entregará indicadores de negocio y tráfico HTTP, junto con una explicación cuando falten datos.

La persistencia y el registro de requests ya existen. Falta conectar esas piezas con los cálculos y una consulta protegida para el proceso automático.

#### Objetivo

Consultar una fecha cerrada, calcular sus indicadores, guardar el resultado y devolverlo al proceso de publicación.

**Referencia visual:** no aplica (backend).

#### Qué tiene que quedar andando

- La consulta devuelve valores calculados con datos reales para el día solicitado.
- Cada resultado queda guardado con la evidencia necesaria para revisar el cálculo.
- La respuesta distingue un valor medido, la falta de datos y una falla al consultar la fuente.
- La consulta exige una credencial de servicio y rechaza fechas abiertas o inválidas.

#### Por dónde empezar

1. Revisar KpisRepository, los modelos existentes y las reglas del ADR 02.
2. Escribir los cálculos con datos conocidos y sus pruebas Jest.
3. Agregar consultas de agregación, endpoint y protección de servicio.
4. Probar el contrato y la persistencia con las suites de la API.
5. Ejecutar la API y consultar una fecha cerrada con datos de desarrollo conocidos.

#### Palabras que vas a ver

- **Snapshot:** resultado conservado de un cálculo para una fecha y ambiente.
- **Guard:** control que rechaza la consulta si la credencial de servicio no es válida.
- **Percentil 95:** duración que deja al menos el noventa y cinco por ciento de las muestras por debajo o en ese valor.
- **NO_DATA:** resultado sin evidencia suficiente; no equivale a un cero medido.

---

#### Especificación técnica

#### Datos del ticket

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

#### Alcance

- Extender el módulo existente con servicio, controller y DTO; reutilizar CronSecretGuard.
- Agregar agregaciones en repositories y reutilizar la persistencia existente.
- Calcular cuatro indicadores de negocio y dos de tráfico HTTP.
- Excluir el propio endpoint del tráfico de aplicación.
- Incluir pruebas unitarias, de endpoint y de persistencia aplicables.

#### Backend

##### Piezas existentes que se reutilizan

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

##### Endpoint y configuración

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

##### Ventanas y fórmulas

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

##### Ejemplos de cálculo y búsqueda en la base

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

##### Registro HTTP y persistencia

- El middleware de PIT-66 hoy clasifica HEALTH y APPLICATION, aunque el enum incluye REPORTING. Clasificar el endpoint KPI como REPORTING y agregar su prueba de regresión; no permitir que sus consultas alteren errores o latencia de aplicación.
- Excluir HEALTH, REPORTING, UNMATCHED y ABORTED del denominador HTTP; informar ABORTED por separado en diagnósticos agregados.
- Generar un UUID de corrida en el backend y guardar seis resultados con ventanas, versión de cálculo y conteos disponibles.
- Usar una vista consistente para las consultas relacionadas, mediante la capacidad transaccional de Prisma encapsulada en repositories. Guardar corrida y seis resultados atómicamente.
- COMPLETED significa que la evaluación terminó sin errores, aunque haya NO_DATA; FAILED identifica una evaluación con ERROR. No equivale a publicación externa.
- Ante una falla de fuente, intentar conservar una corrida FAILED con diagnóstico ERROR si la base está disponible y responder 503. Si falla la base, no afirmar que se conservó nada ni dejar registros parciales.
- Una nueva request puede generar una corrida distinta para la misma fecha. El reintento del envío externo recuperará el lote ya guardado por Actions; no vuelve a llamar a este endpoint.
- Los datos editables no permiten reconstruir perfectamente un pasado: el snapshot conserva el cálculo realizado con los registros disponibles.

##### Contrato de respuesta

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

#### Pruebas y criterios de aceptación técnicos

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

#### Fuera de alcance

- Publicación en Supabase, scripts de GitHub y disponibilidad, workflows y dashboard.
- Recreación de la persistencia o instrumentación de PIT-66/PIT-68.
- Construcción del historial y cálculo definitivo de resolución de alertas, cubiertos por `PIT-73`; registro manual del catálogo.
- Garantizar seis mediciones publicables cuando falte evidencia.


### 2. Publicar los indicadores diarios en Supabase y recuperar envíos fallidos

#### Contexto

PitStop necesita enviar los indicadores diarios al receptor de Supabase y comprobar que fueron recibidos. El proceso automático reunirá los resultados de la API y, cuando estén integradas, las fuentes de disponibilidad, éxito de CI y tiempo hasta merge.

Si una conexión falla después de enviar, repetir los cálculos puede producir valores distintos. Por eso se conservará el lote antes del envío y el workflow de KPIs permitirá recuperar ese mismo archivo mediante una ejecución manual.

#### Objetivo

Publicar y verificar un cierre diario en desarrollo y permitir el reenvío manual de un lote guardado, sin recalcularlo.

**Referencia visual:** no aplica (infraestructura).

#### Qué tiene que quedar andando

* Una ejecución permite elegir el ambiente y el día cerrado que se va a informar.
* Los valores de la API se conservan, se envían y se verifican en el receptor.
* Un envío fallido se puede recuperar manualmente desde el workflow de KPIs, conservando sus valores e identificador.
* Los errores quedan visibles y los valores faltantes no se reemplazan por ceros.
* Quedan definidos los puntos donde los otros desarrolladores conectarán sus fuentes.

#### Por dónde empezar

1. Acordar el formato compartido con quienes implementan disponibilidad, éxito de CI y tiempo hasta merge.
2. Crear scripts de lectura de la API, preparación, recuperación, publicación y verificación.
3. Agregar pruebas locales del pipeline y conectarlas a la CI existente.
4. Componer el workflow diario con la acción local de publicación.
5. Ejecutar el workflow con respuestas controladas, comprobar el fallo visible de una API no disponible y recuperar un lote guardado.

#### Palabras que vas a ver

* **Fragmento:** archivo de resultados de una fuente, todavía sin publicar.
* **Lote:** conjunto definitivo de mediciones que se conserva y se envía sin modificar.
* **Artifact:** archivo guardado en GitHub para auditar o recuperar una ejecución.
* **Composite action:** grupo de pasos reutilizable dentro de un job de GitHub Actions.
* **UUID:** identificador único que permite reconocer el mismo lote durante sus reintentos.

---

#### Especificación técnica

#### Datos del ticket

* Título: **Publicar los indicadores diarios en Supabase y recuperar envíos fallidos**.
* Feature: kpis-workflow-publish.
* Proyecto: KPI Reporting. Estado: Backlog. Sin cycle.
* Semana: 2026-10-15 al 2026-10-22; Sprint 3, semana 1 de 4.
* Fecha límite: **2026-10-22**.
* Estimado: **3 SP (\~3 horas)**, presupuesto acordado del plan; incluye las pruebas propias.
* Responsable: **Manuel Gioino**. Prioridad: **2 / High**, por habilitar las integraciones posteriores.
* Etiquetas: Fullstack, Feature.
* Depende de: **sin bloqueos de implementación**. Puede desarrollarse y entregarse en paralelo con [PIT-69](https://linear.app/pitstop-austral/issue/PIT-69/calcular-y-guardar-los-indicadores-diarios-de-negocio-y-trafico-http) usando respuestas simuladas del contrato acordado; la integración real se verifica en [PIT-75](https://linear.app/pitstop-austral/issue/PIT-75/publicar-disponibilidad-y-metricas-de-github-junto-con-los-indicadores).
* Prerrequisitos para publicación real: catálogo dev registrado y credenciales de ese ambiente. Su alta manual no forma parte de este ticket.

#### Alcance

* Carpeta scripts/kpis con módulos `.mjs`, ejecutables con Node 24 y sin un package nuevo.
* Consulta autenticada a la API de [PIT-69](https://linear.app/pitstop-austral/issue/PIT-69/calcular-y-guardar-los-indicadores-diarios-de-negocio-y-trafico-http) y contrato común para tres fuentes.
* Preparación del lote, respaldo, envío, verificación y recuperación manual desde el workflow de KPIs.
* Workflow de cierre diario y acción compuesta para publicar un lote existente.
* Tests del runner y paso explícito en la CI existente.

#### Implementación

##### Archivos y responsabilidades

```text
.github/
  workflows/
    ci.yml                         # Add the KPI test step
    kpi-daily.yml                  # Daily collection or manual recovery of a saved batch
  actions/
    publish-kpis/
      action.yml                   # Validate, preserve, publish and verify an existing batch
scripts/kpis/
  contracts.mjs                    # Source IDs, schema and validators
  dates.mjs                        # Closed day and Argentine reporting windows
  config.mjs                       # Environment and endpoint validation
  api-snapshot.mjs                 # Call our API and write its source fragment
  prepare-batch.mjs                # Combine enabled sources and assign publication UUID
  recover-batch.mjs                # Download the batch explicitly selected for recovery
  publish-batch.mjs                # POST the preserved payload
  verify-batch.mjs                 # GET and compare the receiver's values
  tests/
    contracts.test.mjs
    dates.test.mjs
    api-snapshot.test.mjs
    batch.test.mjs
    publication.test.mjs
    recovery.test.mjs
    fixtures/
```

No implementar availability.mjs ni delivery.mjs en esta tarea: los entregan los otros desarrolladores. Reservar sus pasos y contrato. Ambos comienzan deshabilitados mediante flags.

El checkout revisado ya tiene ci.yml y maintenance-alerts.yml. Conservar sus responsabilidades. Reutilizar pnpm, Node y las convenciones de la CI existente.

Cada módulo exporta funciones importables sin ejecutar su CLI al importarlo. Separar cálculo/validación de HTTP y archivos. Inyectar cliente HTTP, reloj, generador de UUID y almacenamiento de artifacts en las pruebas; no introducir un contenedor de dependencias.

##### Configuración por ambiente

* Input manual `environment`: dev/prod, default dev; `mode`: collect/recover, default collect. En collect, `date` es opcional y usa el día argentino anterior. En recover, son obligatorios `date`, `source_run_id` y `artifact_name`, que identifican explícitamente el lote guardado.
* Schedule de cierre: `0 4 * * *` UTC. Resolver el ambiente desde la variable de repositorio `KPI_SCHEDULE_ENV`, con fallback dev si falta; rechazar valores distintos de dev/prod.
* Resolver el contexto antes del job que selecciona el GitHub Environment. No intentar resolverlo desde una variable disponible únicamente dentro del Environment aún no seleccionado.
* Variables por GitHub Environment: `API_BASE_URL`, `KPI_API_BASE_URL`, `KPI_ENABLE_AVAILABILITY`, `KPI_ENABLE_DELIVERY`.
* Reutilizar `vars.API_BASE_URL` y `secrets.CRON_SECRET`, ya consumidos por maintenance-alerts.yml, para consultar nuestra API. Mantener esos nombres; no crear aliases para KPIs.
* Credenciales del receptor: `SUPABASE_PUBLISHABLE_KEY` y `PROJECT_KEY`. Si dev/prod usan despliegues diferentes, configurar API_BASE_URL y CRON_SECRET con los mismos nombres y valores correspondientes en cada GitHub Environment; la existencia de la configuración de repositorio no demuestra que ya existan ambos ambientes.
* Permisos del workflow KPI: contents: read y actions: read para recuperar el artifact seleccionado. Los permisos adicionales que requiera disponibilidad se definen en su integración. Pasar credenciales por entorno, no argumentos ni JSON.
* PROJECT_KEY está ligada al equipo y ambiente en el receptor. Conservar env en el payload porque TEAM_GUIDE lo exige: el workflow selecciona el contexto y la clave correspondiente; el receptor valida su coincidencia y devuelve 401 si difieren. La clave es opaca: no deducir su ambiente leyendo su texto ni inventar una operación de introspección.
* Enviar ese contexto como query env a nuestra API, que lo valida y persiste sin una variable adicional de configuración. Su respuesta confirma el contexto recibido, no verifica por sí sola el ambiente de los datos. Validar API_BASE_URL y credenciales del despliegue seleccionado.
* No incorporar credenciales de Neon al runner, inferir prod desde main ni usar claves dev como fallback de prod.
* La primera prueba real se realiza en dev. Dejar prod configurado y seleccionable, sin enviar valores productivos como prueba de implementación.

##### Contrato que reciben los otros desarrolladores

Todos los recolectores usan la misma interfaz:

```bash
node scripts/kpis/api-snapshot.mjs --date 2026-10-21 --env dev --output .tmp/kpis/api.json
node scripts/kpis/availability.mjs --date 2026-10-21 --env dev --output .tmp/kpis/availability.json
node scripts/kpis/delivery.mjs --date 2026-10-21 --env dev --output .tmp/kpis/delivery.json
```

La carpeta de ejecución queda fuera de Git. Los dos últimos comandos son puntos de integración, no entregables de este ticket.

Formato compartido de fragmento, con datos ilustrativos:

```json
{
  "schemaVersion": 1,
  "source": "availability",
  "date": "2026-10-21",
  "env": "dev",
  "measurements": [
    { "kpi_id": "api_availability", "value": 75 }
  ],
  "diagnostics": [
    {
      "kpi_id": "api_availability",
      "status": "READY",
      "windowStart": "2026-10-21T03:00:00.000Z",
      "windowEnd": "2026-10-22T03:00:00.000Z",
      "numerator": 3,
      "denominator": 4
    }
  ]
}
```

* `source`: api, availability o delivery. api-snapshot adapta la respuesta de [PIT-69](https://linear.app/pitstop-austral/issue/PIT-69/calcular-y-guardar-los-indicadores-diarios-de-negocio-y-trafico-http) y conserva su runId como referencia de origen, sin confundirlo con el UUID de publicación.
* Definir IDs permitidos por fuente: seis de la API, api_availability/db_availability y ci_success_rate/mean_time_to_merge. La fuente delivery usa únicamente GitHub: ci_success_rate es technical, unidad %, y mean_time_to_merge conserva unidad h. Validar ambos porcentajes y horas con sus rangos correspondientes; no requiere credencial de Linear.
* measurements solo lleva READY y valores finitos. diagnostics contiene los estados, códigos seguros, ventanas y conteos por indicador; los BigInt de API permanecen como strings.
* Validar fecha/ambiente idénticos, schemaVersion admitida, ventanas válidas, IDs únicos y pertenecientes a la fuente. Conservar calculationVersion y referencias de origen de cada fuente en el manifiesto.
* Una fuente deshabilitada no produce mediciones falsas ni exige un archivo. Una fuente habilitada con archivo ausente o error deja diagnóstico y fallo visible.
* Diferenciar ERROR de NO_DATA. Un fragmento válido con NO_DATA no genera valores nulos; un contrato global inválido impide cualquier publicación.
* Acordar este contrato al comienzo de la semana para que B/C desarrollen con fixtures en paralelo. Mantener un ejemplo válido por fuente en tests/fixtures.

##### Consulta a nuestra API

api-snapshot.mjs hace `GET /internal/kpis/daily?date=YYYY-MM-DD&env=dev|prod` con `Authorization: Bearer <CRON_SECRET>`, timeout finito y validación de status/JSON/contrato. Verificar que fecha y env coincidan con el contexto resuelto.

Guardar el fragmento y referencia de la corrida antes de preparar el lote. Un 401, 503, timeout o cuerpo inválido deja diagnóstico seguro y estado de fallo. No convertirlos en cero ni dar la fuente por completada. Este ticket demuestra el recorrido con API y receptor controlados, sin esperar a [PIT-69](https://linear.app/pitstop-austral/issue/PIT-69/calcular-y-guardar-los-indicadores-diarios-de-negocio-y-trafico-http). Cuando se consulta la API real aún no implementada, conservar el fallo visible y su diagnóstico; no activar un fallback automático a datos simulados. La prueba real API → receptor dev pertenece a [PIT-75](https://linear.app/pitstop-austral/issue/PIT-75/publicar-disponibilidad-y-metricas-de-github-junto-con-los-indicadores).

##### Desarrollo independiente y respuestas simuladas

* Acordar y versionar fixtures con el contrato de [PIT-69](https://linear.app/pitstop-austral/issue/PIT-69/calcular-y-guardar-los-indicadores-diarios-de-negocio-y-trafico-http): respuesta válida, NO_DATA, 401, 404/503, timeout y JSON inválido. Usar cliente HTTP inyectable o servidor HTTP local para probar los mismos CLI y funciones del workflow, sin implementar otra API de negocio.
* Usar un receptor HTTP controlado para verificar POST, GET, respaldo y recuperación con datos simulados. Identificar esa evidencia como prueba; los fixtures no se publican como mediciones reales en el receptor compartido.
* En Actions, probar los pasos del workflow y su manejo de errores. Si API_BASE_URL real todavía no sirve el endpoint, 404/503 o fallo de conexión deben dejar diagnóstico seguro y job fallido. No ocultar el error, inventar ceros ni reemplazar silenciosamente la fuente con un mock.
* Mantener collect/recover reales y el contrato preparados para conectar [PIT-69](https://linear.app/pitstop-austral/issue/PIT-69/calcular-y-guardar-los-indicadores-diarios-de-negocio-y-trafico-http) cuando esté disponible. La ausencia del endpoint no bloquea el cierre de este ticket si pasan las pruebas controladas y se demuestra el fallo esperado; la validación de datos reales queda en [PIT-75](https://linear.app/pitstop-austral/issue/PIT-75/publicar-disponibilidad-y-metricas-de-github-junto-con-los-indicadores).

##### Orden del workflow diario

El schedule ejecuta collect. La ejecución manual permite collect o recover; la rama recover se describe abajo y omite toda recolección.

1. Resolver y validar fecha cerrada, ambiente y configuración.
2. Consultar API y ejecutar las fuentes habilitadas; conservar fragmentos y diagnósticos.
3. Preparar un lote con los READY válidos y generar su UUID de publicación, junto con un manifiesto de fuentes, versiones, referencias de origen y errores parciales.
4. Invocar la composite action con el lote preparado: respaldar, publicar y verificar.
5. Conservar recibo y resumen de cobertura. Un ERROR de fuente mantiene el job fallido aunque se hayan enviado READY válidos; NO_DATA se informa sin inventar valores.

Sin READY, conservar diagnóstico sin realizar POST. Si falla la validación global, no publicar. La política de publicación parcial conserva el lote exacto: un reintento no agrega mediciones que aparecieron después ni cambia sus valores.

##### Acción compuesta reutilizable

`.github/actions/publish-kpis/action.yml` usa `runs.using: composite`.

Inputs: ruta al directorio del lote, fecha y ambiente esperados. Las credenciales llegan mediante env desde el job que seleccionó el Environment; no se escriben como inputs visibles ni se imprimen.

Pasos:

1. Validar lote y manifiesto contra el contexto y calcular/verificar una huella SHA-256 del payload.
2. Guardar payload, manifiesto y evidencia como artifact con retención de 14 días. Fallar si faltan archivos o no se confirma el respaldo. Usar nombres únicos por ambiente, fecha, corrida e intento.
3. Publicar exactamente el payload respaldado mediante publish-batch.mjs.
4. Verificar recepción mediante verify-batch.mjs; conservar recibo y diagnóstico incluso si el envío o la verificación fallan.

La acción no ejecuta cálculos ni prepare-batch. Se invoca tanto desde el cierre diario como desde la recuperación manual del workflow KPI. Este ticket no la conecta al monitor. Cada paso `run` declara shell. El caller hace checkout y configura Node antes de usar la acción local.

##### Publicación y verificación

```http
POST /rest/v1/measurement?on_conflict=project_id,kpi_id,date,env
Content-Type: application/json
apikey: <SUPABASE_PUBLISHABLE_KEY>
X-Project-Key: <PROJECT_KEY>
Prefer: resolution=ignore-duplicates
```

```json
[
  {
    "kpi_id": "preventive_rate",
    "date": "2026-10-21",
    "env": "dev",
    "value": 60,
    "run_id": "41425050-6e16-4fe7-8c80-fd2ff9dbed05"
  }
]
```

* Lote de 1–10 filas con UUID común, números finitos y únicamente los cinco campos del ejemplo. No enviar project_id, reported_at, status, error_message ni null.
* Antes de POST, validar rangos por KPI: porcentajes entre 0 y 100; conteos enteros no negativos; latencia y tiempos no negativos. No redondear horas fraccionarias a enteros.
* Verificar por GET las filas del contexto autorizado, filtrando fecha, env e IDs del lote y comparando valores. Aplicar el contrato real del receptor sin descargar datos de otros equipos.
* Un POST exitoso no confirma igualdad: ignore-duplicates puede conservar un valor previo diferente. Registrar divergencia, fallar y no sobrescribirlo.
* Guardar el lote antes del primer POST. Realizar como máximo tres intentos totales por ejecución ante timeout, error de conexión, 429 o 5xx, con esperas de 5 y 15 segundos; respetar Retry-After válido cuando exista. Si la espera excede el tiempo disponible del job, fallar conservando el lote para recuperación manual. Cada intento utiliza el mismo payload y UUID.
* No reintentar automáticamente 400, 401, 403 ni 409: corregir datos, claves o catálogo según la causa. Conforme a TEAM_GUIDE: 400 indica contrato inválido; 401 puede indicar ambiente incompatible; 403 clave ausente/inválida/revocada; 409 KPI inexistente/ajeno o integridad.
* Probar atomicidad del receptor en dev con un lote que incluya una fila inválida: ninguna fila del lote debe guardarse.
* El recibo registra resultado de verificación por indicador y referencias seguras; no confundir el UUID del snapshot API, la corrida de Actions y el lote publicado.

##### Recuperación manual desde el workflow de KPIs

1. Ejecutar manualmente el workflow KPI en modo recover e indicar environment, date, source_run_id y artifact_name. No es necesario que la corrida de origen haya terminado exitosamente.
2. Buscar el artifact indicado dentro de esa corrida del mismo repositorio, con paginación si corresponde. Verificar que pertenece al workflow KPI esperado; no buscar automáticamente entre todas las ejecuciones ni elegir el lote más reciente.
3. Descargar payload y manifiesto. Validar fecha, ambiente, UUID, esquema y huella del payload contra los datos conservados. Si falta el archivo, expiró o el contexto no coincide, fallar sin consultar fuentes ni preparar otro lote.
4. Invocar la misma composite action con el lote recuperado. Conservar exactamente los bytes del payload y su UUID; respaldarlo en la nueva ejecución antes del POST y verificar recepción por GET.
5. Conservar un recibo de la recuperación con referencia a la corrida de origen. Si el receptor ya tenía los mismos valores, reconocer la coincidencia; si tiene otros, informar conflicto y no sobrescribirlos.

La rama recover nunca ejecuta api-snapshot, availability, delivery ni prepare-batch, aunque los datos o flags hayan cambiado. Reutiliza la configuración del ambiente autorizado y no permite cambiar el env del lote.

Coordinar exclusión de concurrencia por ambiente dentro del workflow KPI, sin cancelar un envío en curso. Esa coordinación no incluye [PIT-67](https://linear.app/pitstop-austral/issue/PIT-67/chequear-la-api-y-la-base-cada-30-minutos-y-guardar-los-resultados-en). La retención de 14 días limita la recuperación disponible; un artifact vencido no se reconstruye mediante un nuevo cálculo.

La recuperación requiere intervención humana y la selección explícita de un lote; no incluye búsqueda periódica de pendientes ni reintentos automáticos entre ejecuciones.

#### Tests incluidos y conexión a CI

Usar node:test y node:assert/strict de Node 24. Agregar al package.json raíz, conservando sus scripts actuales:

```json
{
  "test:kpis": "node --test scripts/kpis/tests/*.test.mjs"
}
```

Agregar al job checks de ci.yml, junto a las pruebas existentes:

```yaml
- name: Test KPI scripts
  run: pnpm test:kpis
```

`pnpm test` ejecuta Turbo sobre packages existentes y no incorpora automáticamente esta carpeta. Los nuevos tests usan reloj fijo, directorios temporales y clientes simulados o servidor HTTP local; no necesitan secretos de GitHub/Supabase.

| Suite | Casos mínimos |
| -- | -- |
| contracts / dates | Día cerrado, corte argentino, ventanas, fecha imposible, env cruzado, IDs duplicados, NaN/null y rango inválido |
| api-snapshot | Request con fecha/header correctos, adaptación válida, 401/503, timeout, JSON inválido, fecha/env contradictorios |
| batch | Combinar tres fixtures, flags deshabilitados, NO_DATA, ERROR parcial, archivo habilitado ausente y contrato global inválido |
| publication | POST exacto, headers, rechazo, 429/5xx, GET coincidente, divergencia y datos de otro contexto |
| recovery | Recuperar el artifact seleccionado de una corrida fallida; rechazar origen, fecha, env o huella incorrectos, archivo ausente y retención agotada |
| pipeline local | Respaldo antes del POST y ausencia de POST cuando falla el respaldo |

Prueba obligatoria de recuperación: simular que el receptor acepta el POST pero se pierde la respuesta. Recuperar explícitamente el artifact de esa corrida y comprobar mismo payload/UUID, recepción sin duplicados y cero invocaciones a API, disponibilidad, delivery o prepare-batch. Cambiar los datos simulados y flags antes de recuperar para demostrar que no afectan al lote. Los reintentos acotados dentro de una ejecución también usan exactamente el mismo lote.

La integración local debe ejercitar las mismas funciones usadas por los CLI, y al menos una ejecución de CLI debe comprobar argumentos, archivos y código de salida. La subida y recuperación reales de artifacts y las condiciones del YAML se comprueban además en Actions dev.

#### Criterios de aceptación técnicos

* `pnpm test:kpis`, formato, lint, tipos y build aplicables pasan; las pruebas KPI corren automáticamente en las PRs.
* El contrato común queda disponible para B/C antes de su integración, con fixtures válidos y comandos reproducibles.
* Demostrar con respuestas controladas: contrato API → fragmento → lote respaldado → POST → GET coincidente y recuperación del mismo lote/UUID. Esta comprobación permite cerrar [PIT-71](https://linear.app/pitstop-austral/issue/PIT-71/publicar-los-indicadores-diarios-en-supabase-y-recuperar-envios) aunque [PIT-69](https://linear.app/pitstop-austral/issue/PIT-69/calcular-y-guardar-los-indicadores-diarios-de-negocio-y-trafico-http) siga pendiente; registrar que la evidencia es simulada. [PIT-75](https://linear.app/pitstop-austral/issue/PIT-75/publicar-disponibilidad-y-metricas-de-github-junto-con-los-indicadores) verifica después el recorrido real hasta Supabase dev.
* Descargar origen, lote y recibo; comprobar mismo día, ambiente, UUID y valores entre archivos y receptor.
* Ante un fallo de publicación, conservar el lote e informar el error; ejecutar mode=recover desde el workflow KPI y demostrar mismo payload/UUID sin consultas nuevas de origen.
* [PIT-67](https://linear.app/pitstop-austral/issue/PIT-67/chequear-la-api-y-la-base-cada-30-minutos-y-guardar-los-resultados-en) no se modifica ni incorpora recuperación. [PIT-71](https://linear.app/pitstop-austral/issue/PIT-71/publicar-los-indicadores-diarios-en-supabase-y-recuperar-envios) no depende de [PIT-69](https://linear.app/pitstop-austral/issue/PIT-69/calcular-y-guardar-los-indicadores-diarios-de-negocio-y-trafico-http) para implementar, probar o entregar el workflow; [PIT-75](https://linear.app/pitstop-austral/issue/PIT-75/publicar-disponibilidad-y-metricas-de-github-junto-con-los-indicadores) verifica la integración real cuando estén disponibles las fuentes.
* Probar selección dev/prod y schedule mediante configuración controlada; no publicar valores productivos como prueba.
* Una fuente habilitada rota deja fallo visible; un contrato global inválido o respaldo fallido impide el envío.
* No se declara cumplimiento completo si falta algún indicador activo o evidencia; el mínimo de evaluación se verifica con el catálogo real.
* Documentar comandos, configuración y pasos para seleccionar y recuperar un artifact desde el workflow KPI. PR aprobado y mergeado.

#### Fuera de alcance

* Modificar [PIT-67](https://linear.app/pitstop-austral/issue/PIT-67/chequear-la-api-y-la-base-cada-30-minutos-y-guardar-los-resultados-en) o su monitor, buscar periódicamente lotes pendientes y automatizar su recuperación entre ejecuciones. La recuperación manual explícita del workflow KPI sí está incluida.
* Implementar los cálculos de disponibilidad o GitHub y sus adaptadores.
* Registrar o automatizar el catálogo, crear evidencia de alertas o incorporar dashboards.
* Agregar otra base, cola, framework de tests o un package de workspace para los scripts.
* Recalcular para corregir mediciones ya aceptadas, modificar su valor o reparar cumplimiento retroactivo mediante reenvíos históricos.

#### Referencias

* [Composite actions locales](<https://docs.github.com/en/actions/tutorials/create-actions/create-a-composite-action>).
* [Runner de pruebas de Node 24](<https://nodejs.org/docs/latest-v24.x/api/test.html>).


### 3. Calcular la disponibilidad de la API y la base desde los sondeos guardados

#### Contexto

PitStop reunirá los chequeos de salud que ya se guardan en GitHub y calculará qué proporción respondió con éxito cada día. También indicará cuántos chequeos se pudieron observar.

Hoy hay chequeos individuales, pero todavía no un resultado diario. La ausencia de un chequeo no demuestra una caída y debe distinguirse de un error observado.

#### Objetivo

Calcular la disponibilidad diaria de la API y del acceso a la base, junto con su cobertura.

**Referencia visual:** no aplica (infraestructura).

#### Qué tiene que quedar andando

- Los chequeos guardados producen un porcentaje por cada objetivo.
- Se puede conocer cuántos chequeos se observaron y cuáles faltan.
- La falta de muestras se distingue de una caída medida.
- Repetir una ejecución no cuenta el mismo chequeo dos veces.

#### Por dónde empezar

1. Revisar el artifact real de PIT-67 y acordar cómo identificar su ambiente.
2. Separar la descarga de evidencia de los cálculos y preparar fixtures.
3. Agregar pruebas de ventanas, duplicados, fallos y paginación.
4. Ejecutar el script contra evidencia dev conocida y comparar sus resultados.

#### Palabras que vas a ver

- **Sondeo:** chequeo individual de salud guardado por el monitor.
- **Artifact:** archivo descargable asociado a una ejecución de GitHub.
- **Cobertura:** proporción de horarios programados con evidencia disponible.
- **NO_DATA:** resultado sin muestras suficientes para producir un valor.

---

#### Especificación técnica

#### Datos del ticket

- Título: **Calcular la disponibilidad de la API y la base desde los sondeos guardados**.
- Feature: `kpis-availability-script`.
- Operación: crear un ticket nuevo.
- Proyecto: KPI Reporting. Estado: Backlog. Sin cycle.
- Semana: 2026-10-15 al 2026-10-22. Fecha límite: **2026-10-22**.
- Estimado: **3 SP (~3 horas)**; conservar el valor actual del plan.
- Responsable: **Juan Cruz García Ferrer**.
- Prioridad: **2 / High**. Etiquetas: Fullstack, Feature.
- Depende de: PIT-67.
- Referencia de código: pitstop-app, commit `efca4dc`, checkout limpio revisado el 15 de octubre de 2026.

#### Alcance

- Crear `scripts/kpis/availability.mjs` y sus pruebas bajo `scripts/kpis/tests/`.
- Consumir artifacts de PIT-67; devolver `api_availability` y `db_availability` con contrato `source=availability`.
- Entregar el fragmento a la integración conjunta, sin realizar publicaciones.

#### Implementación

**Objetivo.** Crear `scripts/kpis/availability.mjs`, ejecutable independientemente del workflow, que devuelva los dos KPIs de disponibilidad y su cobertura.

**Contexto del repositorio.** `HealthController` ya expone públicamente GET `/health` con `{status:"ok"}` y GET `/health/db` con `{database:"up"}`. `HealthRepository` ejecuta SELECT 1 y `HealthService` devuelve 503 cuando la consulta falla. El monitor de PIT-67 aún no está en main; el contrato vigente de PIT-67 exige `health-checks.json` con `schemaVersion`, `runId`, `runAttempt` y `checks` con target, checkedAt, httpStatus, ok y errorKind. El ejemplo de PIT-67 no incluye env ni eventName: no exigirlos como si ya existieran. Coordinar el formato real antes de integrar; desarrollar con fixtures sin esperar al workflow de A.

**Implementación.** Recibir `--date`, `--env` y `--output` conforme al contrato común. Separar lectura/paginación/descarga de artifacts del agregador puro, con cliente HTTP y reloj sustituibles en pruebas. Leer artifacts incluso de corridas fallidas, filtrar el ambiente solicitado y usar el timestamp real de cada sondeo para decidir pertenencia al día argentino. Validar archivos y campos; un artifact seleccionado cuyo contenido contradice su ambiente no se acepta como muestra válida.

Deduplicar por `runId`/target conservando el primer intento con muestra; no contar un rerun como nuevo sondeo programado. Calcular `api_availability` y `db_availability` como éxitos / sondeos observados × 100, siguiendo la condición de éxito del monitor. Mantener diferenciadas muestras manuales y programadas para informar cobertura sobre 48 corridas nominales. Sondeos ausentes no son fallos; sin muestras, NO_DATA. La métrica DB es acceso vía API y no una medición independiente de Neon.

Escribir un fragmento `source=availability` con measurements READY, diagnósticos por KPI, numeradores/denominadores, cobertura, ventana y referencias mínimas de origen. Un fallo de lectura debe identificarse como ERROR, distinto de ausencia de muestras. No publicar, escribir en Neon ni asignar run_id de publicación. Las credenciales de lectura llegan por entorno y no se escriben en JSON.

**Criterios de cierre.** Fixtures para límites del día, éxito/fallo/timeout, 0% real, 100%, falta de muestras, artifacts duplicados, intentos, manuales, ambientes mezclados, archivos inválidos y varias páginas. Probar el CLI y las funciones con `node --test` si se adopta el runtime `.mjs` de A. Entregar ejemplo de fragmento y comando local reproducible; la integración al workflow queda en la tarea local `kpis-sources-integration`.
##### Compatibilidad con el monitor

- Configurar explícitamente repositorio, workflow `kpi-health-monitor.yml` y ambiente de origen. Si falta env en el JSON, usar una asignación explícita de ese monitor/despliegue al ambiente, validada en dev; no inferir ambiente desde rama o nombre de archivo. Si el mismo monitor mezcla ambientes sin evidencia para distinguirlos, devolver ERROR en vez de atribuir muestras al azar.
- Obtener eventName de los metadatos de la corrida cuando no esté en el JSON. Mantener las muestras manuales identificadas aparte de la cobertura programada; no contar el estado final del job como sustituto de cada `checks[].ok`.
- API exitosa: HTTP 200 con status=ok; DB exitosa: HTTP 200 con database=up. PIT-67 conserva el resultado por objetivo incluso en una corrida fallida.
- Ejemplo: 36 éxitos de 48 observaciones → 75 %; 18/24 → 75 % con cobertura de solo 24/48 horarios. Una request al API y otra a DB no equivalen a 48 sondeos.
- Para horarios nominales, deduplicar por horario previsto cuando haya varias ejecuciones del mismo slot; conservar timestamps reales para pertenencia a la ventana. No exigir exactitud de ejecución al minuto: Actions puede retrasar corridas.

#### Criterios de aceptación técnicos comunes

- Funciones de cálculo separadas de HTTP y almacenamiento, con reloj y clientes sustituibles en pruebas. No agregar otro framework de tests ni un package de workspace.
- Pruebas de scripts con Node 24: `pnpm test:kpis`, conectado por PIT-71 a `.github/workflows/ci.yml`. Al importar un módulo no se ejecuta su CLI.
- Pasan `pnpm format:check`, `pnpm lint`, `pnpm check-types` y `pnpm build`; las pruebas no dependen de credenciales reales.
- Documentar comando local y evidencia real dev en `docs/kpis.md`. PR aprobado y mergeado; ninguna prueba publica valores productivos.

#### Fuera de alcance

Publicar en Supabase, cambiar endpoints health, escribir en Neon, rehacer el monitor PIT-67 o crear muestras ficticias. Cualquier ampliación incompatible del contrato del monitor se coordina antes de activar la fuente.


### 4. Calcular el porcentaje de chequeos exitosos y el tiempo hasta fusionar una PR

#### Contexto

PitStop calculará qué porcentaje de los chequeos automáticos de las propuestas de cambio termina con éxito y cuánto tardan en fusionarse esas propuestas. Ambos resultados se obtendrán de GitHub.

La publicación diaria todavía no recibe estas mediciones. Contar ejecuciones ajenas o duplicar reintentos puede mostrar una calidad distinta de la observada.

#### Objetivo

Calcular el éxito de los chequeos automáticos y el tiempo promedio hasta fusionar una PR.

**Referencia visual:** no aplica (infraestructura).

#### Qué tiene que quedar andando

- Los chequeos de propuestas dirigidas a la rama principal producen un porcentaje de éxito.
- Los reintentos no duplican una misma ejecución.
- Las propuestas fusionadas producen un tiempo promedio en horas.
- La falta de casos se distingue de un resultado cero y de un error de lectura.

#### Por dónde empezar

1. Revisar ci.yml y comprobar el acceso de lectura a Actions y PRs.
2. Separar adaptadores de GitHub y funciones de cálculo con fixtures.
3. Agregar pruebas de conclusiones, reintentos, ventanas y paginación.
4. Ejecutar el script contra datos dev conocidos y comparar los dos valores.

#### Palabras que vas a ver

- **CI:** chequeos automáticos que corren al proponer un cambio.
- **Conclusión:** resultado final de una ejecución en GitHub.
- **Reintento:** nuevo intento de una misma ejecución, no una observación adicional.
- **Fixture:** datos controlados para comprobar el cálculo.

---

#### Especificación técnica

#### Datos del ticket

- Título: **Calcular el porcentaje de chequeos exitosos y el tiempo hasta fusionar una PR**.
- Feature: `kpis-delivery-script`.
- Operación: crear un ticket nuevo.
- Proyecto: KPI Reporting. Estado: Backlog. Sin cycle.
- Semana: 2026-10-15 al 2026-10-22. Fecha límite: **2026-10-22**.
- Estimado: **3 SP (~3 horas)**; conservar el valor actual del plan.
- Responsable: **Ignacio Siaba**.
- Prioridad: **1 / Urgent**. Etiquetas: Fullstack, Feature.
- Depende de: sin bloqueos pendientes.
- Referencia de código: pitstop-app, commit `efca4dc`, checkout limpio revisado el 15 de octubre de 2026.

#### Alcance

Crear `scripts/kpis/delivery.mjs` con `ci_success_rate` (%) y `mean_time_to_merge` (h), sus adaptadores de lectura y pruebas. Conservar `source=delivery` para reutilizar el contrato de PIT-71.

#### Implementación

**Objetivo.** Crear `scripts/kpis/delivery.mjs`, independiente del workflow, para calcular Éxito de CI (`ci_success_rate`, technical, %) y Mean Time to Merge (`mean_time_to_merge`, technical, h) con evidencia verificable de GitHub.

**Contexto del repositorio.** Crear un script de lectura de GitHub, sin módulo Nest ni tablas para estas fuentes. La CI actual es `.github/workflows/ci.yml` y se ejecuta sobre PRs a main. Recibir explícitamente owner/repositorio; consultar el workflow por su archivo `ci.yml`, no todos los workflows del repositorio. Verificar acceso real a Actions y PRs al comenzar. No consultar Linear ni vincular tickets para calcular estos indicadores.

**Implementación.** Recibir `--date`, `--env`, `--output` y configuración de GitHub. Separar adaptadores de lectura y agregadores puros para probar con fixtures mientras A implementa el workflow. Paginar ejecuciones de Actions y PRs; conservar IDs, conclusiones y timestamps necesarios sin cuerpos ni tokens. `env` identifica el contexto de reporte: ambos indicadores describen el repositorio configurado y no se filtran por una supuesta rama dev/prod.

Calcular `ci_success_rate`: `100 × success / (success + failure)` de las ejecuciones de `ci.yml` para el evento `pull_request` con base `main`, en la ventana de treinta días terminada en el corte argentino. Seleccionar por `created_at` de la ejecución y exigir que el intento evaluado haya terminado antes del corte. Contar una vez cada `run_id`, usando el primer intento para que un rerun exitoso no oculte una falla inicial; conservar su evidencia. El filtro `branch` de Actions identifica la rama de origen, no prueba la base de la PR: verificar `base.ref = main` con los metadatos de la PR. Solo `conclusion = success` o `failure` entra en la fórmula; omitir cancelled/skipped, ejecuciones abiertas y cualquier otra conclusión, dejando conteos de exclusión. Sin denominador: NO_DATA. Ejemplo: 8 success, 2 failure, 1 cancelled y 1 skipped → `100 × 8 / (8 + 2) = 80 %`.

Calcular `mean_time_to_merge`: media en horas de apertura a merge de PRs mergeadas dentro de esa misma ventana de treinta días; excluir cerradas sin merge y deduplicar por ID de PR. Mantener su fórmula y unidad actuales. Ejemplo: PRs de 2 h y 4 h → `3 h`. Sin casos: NO_DATA.

Conservar horas fraccionarias para `mean_time_to_merge` y porcentajes entre 0 y 100 para `ci_success_rate`; excluir duraciones negativas y distinguir falta de casos, evidencia incompleta y fallo de GitHub. Devolver fragmento `source=delivery` con los IDs `ci_success_rate` y `mean_time_to_merge`, measurements READY y diagnósticos con conteos, ventanas, versión y referencias mínimas. El nombre interno delivery se conserva para compatibilidad del contrato. No transformar datos faltantes en cero, publicar ni persistir en Neon. El token GitHub debe permitir leer Actions y PRs; no se necesita token de Linear.

**Criterios de cierre.** Fixtures con paginación, PRs con base distinta de main, workflows distintos de ci.yml, eventos push/manual excluidos, success/failure, cancelled/skipped y otras conclusiones excluidas, ejecuciones abiertas, reruns sin duplicación y límites del corte. Probar 8 success y 2 failure → 80 %, solo success → 100 %, solo failure → 0 % y denominador vacío → NO_DATA. Para merge, conservar casos de PRs abiertas fuera de ventana pero mergeadas dentro, cerradas sin merge, horas fraccionarias y duraciones inválidas. Un fallo de GitHub produce ERROR, no NO_DATA ni cero. Ejecutar pruebas independientes y validar el contrato común. Confirmar lectura real de GitHub con evidencia segura; integración al workflow fuera de esta tarea. Referencia: [API de ejecuciones de workflows](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-workflow).

##### Consulta y evidencia

- Consultar `GET /repos/{owner}/{repo}/actions/workflows/ci.yml/runs` con evento pull_request y paginación. La API puede limitar búsquedas filtradas a 1000 resultados: subdividir rangos si hace falta y nunca aceptar una ventana truncada como completa.
- Para reintentos, consultar la evidencia del primer intento; no usar la conclusión del último intento como si fuera la inicial. Si el primer intento no está disponible, informar evidencia incompleta sin inventar éxito.
- Leer PRs cerradas y conservar únicamente las que tienen `merged_at` en la ventana; ordenar/paginar hasta cubrirla, sin asumir que todas las PRs cerradas se fusionaron. Base main se exige para el KPI de CI; no agregar ese filtro al tiempo hasta merge sin una regla de negocio explícita.
- Permisos de lectura: Actions y Pull requests sobre el repositorio configurado. No requiere token ni consultas a Linear. Conservar conteos de conclusiones excluidas y sampleCount de PRs; no publicar diagnósticos como mediciones.
- Fragmento: schemaVersion=1, source=delivery, date/env, calculationVersion, referencias mínimas, dos diagnósticos y measurements exclusivamente READY. Primer cálculo: 8 success y 2 failure → 80 %. Segundo: tiempos de 2 h y 4 h → 3 h.

#### Criterios de aceptación técnicos comunes

- Funciones de cálculo separadas de HTTP y almacenamiento, con reloj y clientes sustituibles en pruebas. No agregar otro framework de tests ni un package de workspace.
- Pruebas de scripts con Node 24: `pnpm test:kpis`, conectado por PIT-71 a `.github/workflows/ci.yml`. Al importar un módulo no se ejecuta su CLI.
- Pasan `pnpm format:check`, `pnpm lint`, `pnpm check-types` y `pnpm build`; las pruebas no dependen de credenciales reales.
- Documentar comando local y evidencia real dev en `docs/kpis.md`. PR aprobado y mergeado; ninguna prueba publica valores productivos.

#### Fuera de alcance

Cambiar los chequeos de CI, medir tiempos de tickets Linear, publicar o integrar al workflow, modificar Neon o crear dashboards.

#### Referencias

- [Ejecuciones de workflows](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-workflow).
- [Pull requests](https://docs.github.com/en/rest/pulls/pulls#list-pull-requests).


### 5. Publicar disponibilidad y métricas de GitHub junto con los indicadores diarios

#### Contexto

El cierre diario reunirá los indicadores de la API, la disponibilidad y las métricas de GitHub y comprobará que llegaron al receptor.

Los cálculos y la publicación se construyen en tareas distintas. Falta conectarlos y comprobar que un fallo o un reenvío conserve los mismos valores.

#### Objetivo

Publicar y verificar las tres fuentes juntas, incluida la recuperación de un envío fallido.

**Referencia visual:** no aplica (infraestructura).

#### Qué tiene que quedar andando

- Los indicadores de las tres fuentes participan del mismo cierre diario.
- Un fallo parcial queda visible y conserva los resultados válidos.
- El lote guardado se puede reenviar sin recalcular sus valores.
- Los valores recibidos coinciden con los resultados conservados.

#### Por dónde empezar

1. Revisar el contrato y el workflow de PIT-71 junto con ambos scripts.
2. Conectar los recolectores antes de preparar el lote.
3. Agregar pruebas de errores parciales y recuperación.
4. Ejecutar el cierre conjunto en desarrollo y descargar lote y recibo.

#### Palabras que vas a ver

- **Fragmento:** resultados de una fuente antes de armar el envío.
- **Lote:** conjunto definitivo de mediciones que se conserva y publica.
- **Recuperación:** reenvío del mismo lote guardado sin nuevos cálculos.

---

#### Especificación técnica

#### Datos del ticket

- Título: **Publicar disponibilidad y métricas de GitHub junto con los indicadores diarios**.
- Feature: `kpis-sources-integration`.
- Operación: crear un ticket nuevo.
- Proyecto: KPI Reporting. Estado: Backlog. Sin cycle.
- Semana: 2026-10-15 al 2026-10-22. Fecha límite: **2026-10-22**.
- Estimado: **3 SP (~3 horas)**; conservar el valor actual del plan.
- Responsable: **Ignacio Siaba**.
- Prioridad: **4 / Low**. Etiquetas: Fullstack, Feature.
- Depende de: PIT-71, PIT-72, PIT-74, PIT-73.
- Referencia de código: pitstop-app, commit `efca4dc`, checkout limpio revisado el 15 de octubre de 2026.

##### Prerrequisitos y coordinación

La integración puede comenzar con fixtures tras PIT-71 y los dos scripts. La validación final del indicador de alertas requiere la tarea `kpis-alert-resolution`.

#### Implementación

1. Conectar ambos recolectores antes de preparar y congelar el lote de PIT-71, usando los mismos `--date`, `--env` y `--output`. Habilitar `KPI_ENABLE_AVAILABILITY` y `KPI_ENABLE_DELIVERY` inicialmente en dev; mantener configuración independiente de prod.
2. Disponibilidad consume sondeos del ambiente seleccionado y conserva cobertura sobre los 48 horarios nominales. No sustituirlos por dos requests puntuales. GitHub entrega `ci_success_rate` (%) y `mean_time_to_merge` (h), sin integración con Linear.
3. Configurar owner/repositorio, workflow `ci.yml` y permisos de lectura de Actions y PRs. Reutilizar el token de GitHub si tiene acceso; documentar una credencial dedicada solo si resulta necesaria. Secretos por entorno, sin argumentos ni artifacts.
4. Conservar fragmentos, ventanas, versiones, referencias y diagnósticos. Validar fecha, ambiente, IDs y rangos con el contrato común; usar un único UUID de publicación y el mismo respaldo, POST y GET existentes.
5. Capturar el resultado de cada recolector y continuar hasta preparar, respaldar y publicar los READY válidos cuando el contrato permita publicación parcial. Conservar el error de origen y fallar al finalizar el job. Una validación global inválida o un respaldo fallido impide publicar; NO_DATA no se convierte en cero ni en mediciones nulas.
6. La rama recover usa únicamente el lote respaldado. No vuelve a consultar API, sondeos ni GitHub, aunque cambien los flags o los datos. Conservar payload exacto, UUID y evidencia por 14 días.

#### Pruebas y criterios de aceptación

- Fixtures de las tres fuentes con los diez IDs vigentes, incluidos `ci_success_rate`, `mean_time_to_merge` y `alert_resolution_rate`; no usar el indicador retirado de tiempo hasta abrir una PR.
- Casos de NO_DATA, ERROR parcial, archivo habilitado ausente, fuente deshabilitada, ambiente cruzado, IDs duplicados y contrato global inválido. Verificar que un recolector fallido no oculte el diagnóstico ni impida publicar otros READY cuando corresponda.
- Ejecución manual dev con datos conocidos: API y ambos scripts → fragmentos → lote respaldado → POST → GET coincidente. Descargar origen, lote y recibo y comparar fecha, ambiente, UUID y valores.
- Tras integrar la tarea de alertas, incluir un ciclo enviado y resuelto en plazo en los datos conocidos y verificar su porcentaje desde la API hasta el receptor. Sin casos reales suficientes, informar NO_DATA sin presentar cobertura completa.
- Recuperar una publicación fallida y comprobar mismos bytes/UUID y cero invocaciones a los tres recolectores. Probar selección explícita de dev/prod sin publicar valores productivos como prueba.
- Tests del pipeline en `pnpm test:kpis` y comprobación real del YAML en Actions dev. Pruebas propias incluidas; PR aprobado y mergeado. Piloto y aceptación del MVP permanecen a cargo del otro equipo.

#### Fuera de alcance

Implementar las fórmulas de las fuentes, recrear PIT-71, modificar PIT-67, registrar el catálogo o crear dashboards.


### 6. Registrar la resolución de alertas y completar su KPI

#### Contexto

PitStop conservará qué aviso de mantenimiento se resolvió con un servicio y si ese servicio se realizó en plazo. Esa evidencia permitirá calcular el porcentaje de alertas resueltas a tiempo.

Actualmente se guardan los envíos a dispositivos, pero no el vínculo con el servicio que resuelve cada vencimiento. Contar envíos o cualquier servicio posterior no permite obtener ese porcentaje.

#### Objetivo

Registrar la resolución de cada ciclo de alerta y completar su indicador en el cálculo diario existente.

**Referencia visual:** no aplica (backend).

#### Qué tiene que quedar andando

- Un aviso enviado a varios dispositivos cuenta como un único ciclo.
- Un servicio válido queda vinculado al ciclo que resuelve.
- Las correcciones de servicios no dejan resoluciones falsas.
- El cierre distingue resoluciones en plazo, tardías y falta de evidencia.

#### Por dónde empezar

1. Revisar envíos, vencimientos y registro de servicios, y cerrar la regla de plazo.
2. Agregar la migración y las escrituras de evidencia dentro de sus transacciones.
3. Incorporar el cálculo al servicio de PIT-69 con pruebas Jest.
4. Probar migración, concurrencia y consultas con una base dedicada.
5. Ejecutar la API en desarrollo y comparar el indicador con ciclos conocidos.

#### Palabras que vas a ver

- **Ciclo:** vencimiento concreto de un servicio, aunque genere varios envíos.
- **Evidencia:** datos conservados que prueban envío, vencimiento y resolución.
- **Migración:** cambio versionado de estructura de la base.
- **Transacción:** grupo de escrituras que se confirma o revierte completo.

---

#### Especificación técnica

#### Datos del ticket

- Título: **Registrar la resolución de alertas y completar su KPI**.
- Feature: `kpis-alert-resolution`.
- Operación: crear un ticket nuevo.
- Proyecto: KPI Reporting. Estado: Backlog. Sin cycle.
- Semana: 2026-10-15 al 2026-10-22. Fecha límite: **2026-10-22**.
- Estimado: **3 SP (~3 horas)**; conservar el valor actual del plan.
- Responsable: **Juan Cruz García Ferrer**.
- Prioridad: **2 / High**. Etiquetas: Fullstack, Feature.
- Depende de: PIT-69.
- Referencia de código: pitstop-app, commit `efca4dc`, checkout limpio revisado el 15 de octubre de 2026.

##### Prerrequisitos y coordinación

PIT-63 (envíos), PIT-68 (persistencia) y los flujos de servicios/vencimientos ya están implementados. Se reutilizan, no se recrean. PIT-69 sigue pendiente y es el bloqueo vigente; debe entregar NO_DATA hasta integrar esta tarea.

#### Alcance

Migración y evidencia por ciclo; integración con envíos, servicios y cambios de kilometraje; cálculo puro y agregación dentro del módulo KPI de PIT-69. No agrega pantallas ni otro endpoint.

#### Backend

##### Evidencia y migración

- Agregar un modelo `MaintenanceAlertCycle` o equivalente, con UUID y unicidad por `(scheduleId, dueKey)`. Una alerta enviada a dos instalaciones representa un ciclo, no dos observaciones del KPI.
- Conservar vehículo, tipo normalizado, vencimientos originales por fecha y kilometraje, primer envío efectivo (`firstSentAt`) y versión de la regla. No reconstruir el vencimiento histórico desde el Schedule actual, cuya baseline cambia con los servicios.
- Vincular las entregas existentes al ciclo, sin perder la identidad ni la deduplicación por instalación. Reutilizar SENT y su timestamp de finalización como evidencia de envío; no confundir aceptación por FCM con lectura por el usuario.
- Agregar referencia al mantenimiento resolutor, fecha del servicio, kilometraje del servicio y momento de registro de la resolución (`resolvedAt`). Conservar evidencia suficiente para evaluar al corte y distinguir la fecha declarada del servicio de cuándo se registró.
- Registrar cuándo se observa que se alcanza el kilometraje límite, para poder determinar si un ciclo por kilometraje ya era evaluable al corte. Actualizar esa evidencia en los flujos que modifican kilometraje; no deducir un instante histórico a partir del kilometraje actual.
- Migración compatible con datos existentes, índices para la consulta por corte/ciclo y estrategia explícita de referencias ante borrados. Los datos históricos que no permitan probar envío, plazo y resolución no se completan por suposición.

#### Flujos de negocio

1. Al confirmar un envío efectivo, crear o actualizar idempotentemente el ciclo y su primer envío. Entregas duplicadas o concurrentes no crean ciclos adicionales; intentos fallidos no lo vuelven evaluable.
2. Al registrar un servicio, identificar el ciclo correspondiente al mismo vehículo y tipo normalizado y conservar el vínculo de resolución antes de recalcular las baselines. El servicio debe corresponder al ciclo notificado: no resolverlo con cualquier servicio posterior ni con registros anteriores al envío.
3. Aplicar controles equivalentes al editar o eliminar un servicio y al modificar o eliminar un recordatorio. Actualizar o invalidar evidencia en una transacción, sin mantener resoluciones falsas ni borrar silenciosamente la historia del ciclo. Los snapshots KPI ya guardados permanecen inmutables.
4. Manejar concurrencia entre envío, registro de servicio y actualizaciones. Las escrituras de resolución y cambios del servicio son atómicas; un error no deja vínculos parciales.

#### Regla y cálculo en PIT-69

- Antes de activar, documentar y confirmar con negocio qué significa en plazo: vencimiento por fecha, por kilometraje y combinación de ambos; tratamiento del límite exacto, registros retroactivos y ciclos modificados/cancelados. Conservar esa regla versionada y probarla. No asumir un plazo de gracia ni excluir kilometraje silenciosamente.
- Denominador: ciclos distintos con envío efectivo cuyo plazo ya venció al corte y cuya evidencia permite evaluar la regla. Los ciclos todavía abiertos no entran anticipadamente. Conservar un diagnóstico de cobertura para los ciclos históricos sin evidencia; no presentar un subconjunto incompleto como medición completa.
- Numerador: ciclos del denominador vinculados a un servicio válido del mismo vehículo, tipo y ciclo, realizado en plazo y registrado antes del corte.
- Fórmula: `100 × resueltos en plazo / evaluables`. Diez ciclos evaluables, ocho resueltos en plazo y dos tarde o sin resolver → `80 %`.
- Si hay evaluables y ninguno se resolvió en plazo → `0` READY. Sin evaluables → NO_DATA. Si falta la regla o evidencia necesaria para la población evaluada → NO_DATA con `ALERT_RESOLUTION_EVIDENCE_MISSING`, sin valor inventado. Una falla al consultar produce ERROR y conserva el manejo 503 de PIT-69.
- Implementar agregación en repositories y cálculo puro en el módulo KPI existente. Persistir numerador, denominador, ventana, versión y diagnóstico mediante PIT-68. No crear otro endpoint, otra fuente del runner ni otro publicador; PIT-71 recibe la medición por el contrato API existente.

##### Archivos existentes que se extienden

- `apps/api/prisma/models/maintenance-alert-delivery.prisma`, `schedule.prisma`, `maintenance.prisma` y nuevo modelo de ciclos.
- `apps/api/src/modules/maintenance-alerts/maintenance-alerts.repository.ts`: `markSent` guarda SENT y finishedAt; extender el éxito del envío atómicamente con el ciclo. `dueKey` se construye desde fecha/km en maintenance-alerts.service.ts.
- `apps/api/src/modules/maintenances/maintenances.repository.ts`: `createWithMileageUpdate`, `updateWithMileageUpdate` y `delete` recalculan baselines dentro de transacciones; capturar/resolver antes de perder el vencimiento anterior.
- `apps/api/src/modules/schedules/schedules.repository.ts`: `recalculateBaselines`, `updateWithBaseline` y `delete`; preservar o invalidar el ciclo histórico al cambiar la frecuencia.
- `apps/api/src/modules/vehicles/vehicles.repository.ts`: `updateMileageIfNotDecreased` y `update`, además de aumentos de km desde servicios. Cubrir todas las rutas que modifican el dato.
- Reutilizar `normalizeScheduleType` de `schedules/schedule-type.ts`; no agregar una normalización incompatible para comparar servicios y recordatorios.

##### Decisión funcional pendiente de revisión del draft

El código actual de `computeScheduleDue` considera vencido el límite exacto por fecha o kilometraje, y vence al alcanzarse cualquiera de los dos. La regla de resolución en plazo debe quedar aprobada antes de activar el KPI, incluidos registros retroactivos; no afirmar que el modelo actual ya la prueba. Hasta entonces, evidencia y pruebas pueden avanzar, pero el cálculo mantiene NO_DATA. Registrar esta decisión y su versión en el PR.

##### Comandos de comprobación

`pnpm --filter api exec jest --runInBand`, `pnpm --filter api test:e2e`, `pnpm --filter api test:e2e:db`, `pnpm format:check`, `pnpm lint`, `pnpm check-types` y `pnpm build`. La suite DB exige TEST_DATABASE_URL de una base cuyo nombre termine en `_test`.

#### Pruebas y criterios de aceptación

- Un ciclo enviado a dos instalaciones cuenta una vez; solo los envíos efectivos lo habilitan. Crear evidencia de forma idempotente y probar concurrencia y rollback.
- Servicios de otro vehículo, tipo o ciclo, anteriores al envío o registrados después del corte no resuelven el ciclo evaluado.
- Resolución en plazo, resolución tardía, sin resolución, ciclo aún abierto, límites exactos de fecha/kilometraje, regla combinada y servicio registrado retroactivamente.
- Edición/eliminación del servicio y modificación/eliminación del recordatorio no dejan resoluciones falsas ni destruyen la evidencia conservada. Un nuevo ciclo no reutiliza la resolución anterior.
- Casos 8/10 → 80 %, 0/n → 0 READY, sin evaluables → NO_DATA y evidencia histórica insuficiente → diagnóstico específico. Varios dispositivos y reintentos no alteran numerador/denominador.
- Migrar una base de pruebas dedicada y verificar constraints, integridad, índices aplicables y atomicidad. Usar Jest, suites HTTP y pruebas DB existentes; nunca la base compartida o producción para pruebas destructivas.
- Ejecutar el endpoint de PIT-69 en dev con datos conocidos y comparar el cálculo y sus seis resultados persistidos. Entregar ese fixture a la tarea de integración conjunta para verificar el KPI hasta Supabase.
- Formato, lint, tipos, build y tests de API aplicables; PR aprobado y mergeado.

#### Fuera de alcance

Reconstruir evidencia histórica que no existe, cambiar la fórmula sin aprobación de negocio, rehacer el sistema de notificaciones, agregar pantallas o modificar el publicador de PIT-71.
