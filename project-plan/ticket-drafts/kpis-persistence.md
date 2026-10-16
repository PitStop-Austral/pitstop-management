> Borrador histórico de PIT-68. Implementación presente en `pitstop-app` tras
> el pull del 13 de octubre: reutilizar KpisModule, KpisRepository y la migración.
> No crear otro ticket de persistencia ni inferir el estado externo de Linear
> desde los metadatos de este borrador. Alcance vigente: `kpis-implementation.md`.

# Crear las tablas y el módulo de persistencia de KPIs

## Contexto

PitStop necesita conservar las corridas y los resultados de sus KPIs de negocio, tráfico HTTP, sondeos de API y base de datos, éxito de CI y tiempo hasta merge. Esta tarea prepara una persistencia común para los diez indicadores, independientemente de su fuente, para que una tarea posterior implemente el cálculo y la generación de snapshots.

## Objetivo

Crear `kpi_runs`, `kpi_results`, su migración y un módulo interno de persistencia en la API. No exponer endpoints ni implementar fórmulas.

## Datos del ticket

- Ticket: [PIT-68](https://linear.app/pitstop-austral/issue/PIT-68/crear-las-tablas-y-el-modulo-de-persistencia-de-kpis), en Backlog.
- Épica: KPIs. Proyecto sugerido: KPI Reporting.
- Feature sugerida: `kpis-persistence`.
- Etiquetas sugeridas: Backend y Feature.
- Estimación preliminar: 3 SP, equivalentes a 3 horas estimadas con margen según la escala del equipo. Incluye modelos, migración, módulo, repository y pruebas de integridad y atomicidad; validar contra el repositorio de la API al implementar.
- Semana propuesta: 8 al 15 de octubre de 2026, sujeta a capacidad disponible.
- Responsable: pendiente de asignación.
- No requiere PIT-66 para crear las tablas; el cálculo posterior de errores y latencia sí requiere sus registros HTTP.

## Implementación

### Modelo de corridas

Crear `KpiRun`, mapeado a `kpi_runs`, siguiendo las convenciones de la API.

| Campo | Tipo propuesto | Propósito |
| --- | --- | --- |
| `id` | UUID, PK | Identificador estable de la corrida. |
| `env` | Enum `DEV`, `PROD` | Ambiente de la medición. |
| `date` | Date | Día argentino medido, sin hora. |
| `windowStart`, `windowEnd` | Timestamp con zona | Ventana diaria: inicio inclusivo y fin exclusivo. |
| `calculationVersion` | String | Versión de las reglas que generarán el snapshot. |
| `status` | Enum `PENDING`, `COMPLETED`, `FAILED` | Estado de ejecución interna, independiente de una publicación externa. |
| `startedAt` | Timestamp con zona | Inicio real de la corrida. |
| `finishedAt` | Timestamp con zona nullable | Finalización real. |
| `errorCode` | String nullable | Código seguro ante una falla de la corrida. |

Agregar índice compuesto por `env, date`. No imponer unicidad por día y ambiente: debe ser posible conservar distintas corridas de la misma fecha. El UUID identifica la corrida reutilizada en un reintento.

### Modelo de resultados

Crear `KpiResult`, mapeado a `kpi_results`, con relación obligatoria a `KpiRun`.

| Campo | Tipo propuesto | Propósito |
| --- | --- | --- |
| `id` | UUID, PK | Identificador del resultado. |
| `runId` | UUID, FK | Corrida a la que pertenece. |
| `kpiId` | String | Identificador estable del catálogo versionado. |
| `status` | Enum `READY`, `NO_DATA`, `ERROR` | Distingue valor válido, falta de datos y error. |
| `value` | Double precision nullable | Valor numérico del indicador. |
| `numerator`, `denominator` | BigInt nullable | Conteos de origen para indicadores de proporción. |
| `sampleCount` | BigInt nullable | Cantidad de observaciones utilizadas. |
| `windowStart`, `windowEnd` | Timestamp con zona | Ventana efectiva del KPI; puede diferir de la diaria para indicadores de 30 días. |
| `diagnosticCode` | String nullable | Motivo seguro de ausencia de datos o error. |
| `createdAt` | Timestamp con zona | Momento de persistencia. |

Agregar unicidad por `runId, kpiId` e índice por `kpiId`. La FK debe impedir resultados huérfanos y restringir el borrado de corridas con resultados. No crear una tabla de catálogo en esta tarea: `kpiId` referencia lógicamente el catálogo versionado que se incorporará con su tarea correspondiente.

La migración debe exigir un valor finito para `READY` y valor null para `NO_DATA` o `ERROR`. Los conteos presentes son no negativos y los límites de ventana deben cumplir `windowStart < windowEnd`. Un cero medido es válido; no usarlo como sustituto de falta de datos. No guardar mensajes crudos, credenciales ni datos personales en los diagnósticos.

### Módulo interno

Crear `KpisModule` en `apps/api/src/modules/kpis/` y registrarlo siguiendo la composición actual de la API. Agregar un repository para crear una corrida con sus resultados en una transacción y consultar una corrida por UUID. El acceso a Prisma queda en el repository.

No agregar controller, servicio de cálculo ni providers vacíos. Exportar el repository para su uso posterior. Un intento duplicado con el mismo UUID o con el mismo par corrida/KPI debe producir un conflicto identificable sin sobrescribir resultados existentes.

Los modelos y la migración se agregan en `apps/api/prisma/`, según la organización existente del repositorio de la API; regenerar el cliente Prisma.

## Criterios de aceptación

- La migración crea ambas tablas, enums, FK, índices y restricciones.
- El módulo queda registrado y su repository puede resolverse mediante inyección de dependencias.
- Se puede persistir una corrida con resultados `READY`, `NO_DATA` y `ERROR`, y recuperarla por UUID.
- Si falla uno de los resultados, la transacción no deja una corrida o un conjunto de resultados parcialmente insertado.
- Se rechazan resultados huérfanos, duplicados, valores no finitos, estados incompatibles con el valor y ventanas inválidas.
- Se pueden conservar dos corridas distintas para la misma fecha y ambiente.
- Las pruebas de persistencia verifican restricciones y atomicidad contra una base de prueba; pasan los chequeos aplicables de la API.

## Fuera de alcance

Endpoint de snapshots o consulta, autenticación de servicio, cálculo de KPIs, registro HTTP, captura de health, catálogo externo, workflows, publicación en Lab4, recibos de publicación, dashboard y limpieza programada. La planificación de retención queda para una tarea posterior antes de operación sostenida.
