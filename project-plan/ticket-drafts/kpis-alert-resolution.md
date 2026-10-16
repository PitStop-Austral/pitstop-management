## Contexto

PitStop conservará qué aviso de mantenimiento se resolvió con un servicio y si ese servicio se realizó en plazo. Esa evidencia permitirá calcular el porcentaje de alertas resueltas a tiempo.

Actualmente se guardan los envíos a dispositivos, pero no el vínculo con el servicio que resuelve cada vencimiento. Contar envíos o cualquier servicio posterior no permite obtener ese porcentaje.

## Objetivo

Registrar la resolución de cada ciclo de alerta y completar su indicador en el cálculo diario existente.

**Referencia visual:** no aplica (backend).

## Qué tiene que quedar andando

- Un aviso enviado a varios dispositivos cuenta como un único ciclo.
- Un servicio válido queda vinculado al ciclo que resuelve.
- Las correcciones de servicios no dejan resoluciones falsas.
- El cierre distingue resoluciones en plazo, tardías y falta de evidencia.

## Por dónde empezar

1. Revisar envíos, vencimientos y registro de servicios, y cerrar la regla de plazo.
2. Agregar la migración y las escrituras de evidencia dentro de sus transacciones.
3. Incorporar el cálculo al servicio de PIT-69 con pruebas Jest.
4. Probar migración, concurrencia y consultas con una base dedicada.
5. Ejecutar la API en desarrollo y comparar el indicador con ciclos conocidos.

## Palabras que vas a ver

- **Ciclo:** vencimiento concreto de un servicio, aunque genere varios envíos.
- **Evidencia:** datos conservados que prueban envío, vencimiento y resolución.
- **Migración:** cambio versionado de estructura de la base.
- **Transacción:** grupo de escrituras que se confirma o revierte completo.

---

# Especificación técnica

## Datos del ticket

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

### Prerrequisitos y coordinación

PIT-63 (envíos), PIT-68 (persistencia) y los flujos de servicios/vencimientos ya están implementados. Se reutilizan, no se recrean. PIT-69 sigue pendiente y es el bloqueo vigente; debe entregar NO_DATA hasta integrar esta tarea.

## Alcance

Migración y evidencia por ciclo; integración con envíos, servicios y cambios de kilometraje; cálculo puro y agregación dentro del módulo KPI de PIT-69. No agrega pantallas ni otro endpoint.

## Backend

### Evidencia y migración

- Agregar un modelo `MaintenanceAlertCycle` o equivalente, con UUID y unicidad por `(scheduleId, dueKey)`. Una alerta enviada a dos instalaciones representa un ciclo, no dos observaciones del KPI.
- Conservar vehículo, tipo normalizado, vencimientos originales por fecha y kilometraje, primer envío efectivo (`firstSentAt`) y versión de la regla. No reconstruir el vencimiento histórico desde el Schedule actual, cuya baseline cambia con los servicios.
- Vincular las entregas existentes al ciclo, sin perder la identidad ni la deduplicación por instalación. Reutilizar SENT y su timestamp de finalización como evidencia de envío; no confundir aceptación por FCM con lectura por el usuario.
- Agregar referencia al mantenimiento resolutor, fecha del servicio, kilometraje del servicio y momento de registro de la resolución (`resolvedAt`). Conservar evidencia suficiente para evaluar al corte y distinguir la fecha declarada del servicio de cuándo se registró.
- Registrar cuándo se observa que se alcanza el kilometraje límite, para poder determinar si un ciclo por kilometraje ya era evaluable al corte. Actualizar esa evidencia en los flujos que modifican kilometraje; no deducir un instante histórico a partir del kilometraje actual.
- Migración compatible con datos existentes, índices para la consulta por corte/ciclo y estrategia explícita de referencias ante borrados. Los datos históricos que no permitan probar envío, plazo y resolución no se completan por suposición.

## Flujos de negocio

1. Al confirmar un envío efectivo, crear o actualizar idempotentemente el ciclo y su primer envío. Entregas duplicadas o concurrentes no crean ciclos adicionales; intentos fallidos no lo vuelven evaluable.
2. Al registrar un servicio, identificar el ciclo correspondiente al mismo vehículo y tipo normalizado y conservar el vínculo de resolución antes de recalcular las baselines. El servicio debe corresponder al ciclo notificado: no resolverlo con cualquier servicio posterior ni con registros anteriores al envío.
3. Aplicar controles equivalentes al editar o eliminar un servicio y al modificar o eliminar un recordatorio. Actualizar o invalidar evidencia en una transacción, sin mantener resoluciones falsas ni borrar silenciosamente la historia del ciclo. Los snapshots KPI ya guardados permanecen inmutables.
4. Manejar concurrencia entre envío, registro de servicio y actualizaciones. Las escrituras de resolución y cambios del servicio son atómicas; un error no deja vínculos parciales.

## Regla y cálculo en PIT-69

- Antes de activar, documentar y confirmar con negocio qué significa en plazo: vencimiento por fecha, por kilometraje y combinación de ambos; tratamiento del límite exacto, registros retroactivos y ciclos modificados/cancelados. Conservar esa regla versionada y probarla. No asumir un plazo de gracia ni excluir kilometraje silenciosamente.
- Denominador: ciclos distintos con envío efectivo cuyo plazo ya venció al corte y cuya evidencia permite evaluar la regla. Los ciclos todavía abiertos no entran anticipadamente. Conservar un diagnóstico de cobertura para los ciclos históricos sin evidencia; no presentar un subconjunto incompleto como medición completa.
- Numerador: ciclos del denominador vinculados a un servicio válido del mismo vehículo, tipo y ciclo, realizado en plazo y registrado antes del corte.
- Fórmula: `100 × resueltos en plazo / evaluables`. Diez ciclos evaluables, ocho resueltos en plazo y dos tarde o sin resolver → `80 %`.
- Si hay evaluables y ninguno se resolvió en plazo → `0` READY. Sin evaluables → NO_DATA. Si falta la regla o evidencia necesaria para la población evaluada → NO_DATA con `ALERT_RESOLUTION_EVIDENCE_MISSING`, sin valor inventado. Una falla al consultar produce ERROR y conserva el manejo 503 de PIT-69.
- Implementar agregación en repositories y cálculo puro en el módulo KPI existente. Persistir numerador, denominador, ventana, versión y diagnóstico mediante PIT-68. No crear otro endpoint, otra fuente del runner ni otro publicador; PIT-71 recibe la medición por el contrato API existente.

### Archivos existentes que se extienden

- `apps/api/prisma/models/maintenance-alert-delivery.prisma`, `schedule.prisma`, `maintenance.prisma` y nuevo modelo de ciclos.
- `apps/api/src/modules/maintenance-alerts/maintenance-alerts.repository.ts`: `markSent` guarda SENT y finishedAt; extender el éxito del envío atómicamente con el ciclo. `dueKey` se construye desde fecha/km en maintenance-alerts.service.ts.
- `apps/api/src/modules/maintenances/maintenances.repository.ts`: `createWithMileageUpdate`, `updateWithMileageUpdate` y `delete` recalculan baselines dentro de transacciones; capturar/resolver antes de perder el vencimiento anterior.
- `apps/api/src/modules/schedules/schedules.repository.ts`: `recalculateBaselines`, `updateWithBaseline` y `delete`; preservar o invalidar el ciclo histórico al cambiar la frecuencia.
- `apps/api/src/modules/vehicles/vehicles.repository.ts`: `updateMileageIfNotDecreased` y `update`, además de aumentos de km desde servicios. Cubrir todas las rutas que modifican el dato.
- Reutilizar `normalizeScheduleType` de `schedules/schedule-type.ts`; no agregar una normalización incompatible para comparar servicios y recordatorios.

### Decisión funcional pendiente de revisión del draft

El código actual de `computeScheduleDue` considera vencido el límite exacto por fecha o kilometraje, y vence al alcanzarse cualquiera de los dos. La regla de resolución en plazo debe quedar aprobada antes de activar el KPI, incluidos registros retroactivos; no afirmar que el modelo actual ya la prueba. Hasta entonces, evidencia y pruebas pueden avanzar, pero el cálculo mantiene NO_DATA. Registrar esta decisión y su versión en el PR.

### Comandos de comprobación

`pnpm --filter api exec jest --runInBand`, `pnpm --filter api test:e2e`, `pnpm --filter api test:e2e:db`, `pnpm format:check`, `pnpm lint`, `pnpm check-types` y `pnpm build`. La suite DB exige TEST_DATABASE_URL de una base cuyo nombre termine en `_test`.

## Pruebas y criterios de aceptación

- Un ciclo enviado a dos instalaciones cuenta una vez; solo los envíos efectivos lo habilitan. Crear evidencia de forma idempotente y probar concurrencia y rollback.
- Servicios de otro vehículo, tipo o ciclo, anteriores al envío o registrados después del corte no resuelven el ciclo evaluado.
- Resolución en plazo, resolución tardía, sin resolución, ciclo aún abierto, límites exactos de fecha/kilometraje, regla combinada y servicio registrado retroactivamente.
- Edición/eliminación del servicio y modificación/eliminación del recordatorio no dejan resoluciones falsas ni destruyen la evidencia conservada. Un nuevo ciclo no reutiliza la resolución anterior.
- Casos 8/10 → 80 %, 0/n → 0 READY, sin evaluables → NO_DATA y evidencia histórica insuficiente → diagnóstico específico. Varios dispositivos y reintentos no alteran numerador/denominador.
- Migrar una base de pruebas dedicada y verificar constraints, integridad, índices aplicables y atomicidad. Usar Jest, suites HTTP y pruebas DB existentes; nunca la base compartida o producción para pruebas destructivas.
- Ejecutar el endpoint de PIT-69 en dev con datos conocidos y comparar el cálculo y sus seis resultados persistidos. Entregar ese fixture a la tarea de integración conjunta para verificar el KPI hasta Supabase.
- Formato, lint, tipos, build y tests de API aplicables; PR aprobado y mergeado.

## Fuera de alcance

Reconstruir evidencia histórica que no existe, cambiar la fórmula sin aprobación de negocio, rehacer el sistema de notificaciones, agregar pantallas o modificar el publicador de PIT-71.
