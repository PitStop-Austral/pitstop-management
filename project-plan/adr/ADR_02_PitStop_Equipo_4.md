# ADR 02 Reporting diario de KPI de PitStop

## Context

Lab4 exige entre 5 y 10 KPIs válidos por día, sin modificar la fecha ni la capacidad de Lab2. El ADR 01 de PitStop integraba su API NestJS, Neon y Vercel al entorno de Microsoft Dataverse. Fue elegida por sobre esa opción la arquitectura alternativa de Supabase/Postgres. Los objetivos de preventivos y alertas provienen de DP; se agregan dos indicadores de uso del producto. Solo prod cuenta para la evaluación.

## Decision Drivers

Reutilizar infraestructura y datos existentes, reducir servicios nuevos, proteger credenciales, definir métricas comparables y permitir reprocesamiento sin duplicados. La obtención, el cálculo y el envío se implementarán por código, conforme a la restricción del challenge.

## Options Considered

1. **Reporter en la API con Vercel Cron.** Reutiliza código y despliegue; agrega carga a la API y requiere un monitor externo.
2. **GitHub Actions y endpoint de PitStop. Seleccionada.** Aísla sondeos y reporting, conserva el cálculo de negocio en la API y agrega otro entorno, secretos y posibles retrasos.
3. **OpenTelemetry con backend de observabilidad y reporter.** Mejora el diagnóstico, pero incorpora una plataforma adicional.

Las tres alternativas pueden publicar directamente en Supabase.

## Proposed Decision

**Programación.** Dos workflows en `pitstop-app`: monitor y reporting cada 30 minutos (`*/30 * * * *` UTC), y cierre de negocio a la 1:00 argentina (`0 4 * * *` UTC). El primero sondea `/health` y `/health/db`, conserva muestras y envía o reintenta cierres preparados. El segundo invoca el endpoint protegido de PitStop y reúne los indicadores del día argentino anterior. Ambos permiten ejecución manual por fecha y se publican en la rama predeterminada.

**Ventanas y cálculo.** Usar `America/Argentina/Buenos_Aires`: desde las 00:00 inclusive hasta las 00:00 del día siguiente exclusive. Los indicadores de 30 días terminan en ese corte. Incorporar `GET /internal/kpis/daily?date=YYYY-MM-DD`, con secreto de servicio independiente de Firebase, validación de fecha y consultas Prisma en repositories. Devolver agregados válidos y diagnósticos separados, sin datos personales. El runner no accede directamente a Neon. Registrar eventos HTTP mínimos y consultar ejecuciones de ci.yml y PRs de GitHub; los KPIs no requieren integración con Linear.

**Autenticación y catálogo.** Configurar URL y credenciales por ambiente; confirmar el destino productivo porque Swagger de `dev` y OpenAPI de `main` apuntan a servidores distintos. Enviar `apikey: SUPABASE_PUBLISHABLE_KEY` y `X-Project-Key: PROJECT_KEY`, con la clave privada en GitHub Secrets. Registrar por ambiente en `POST /rest/v1/kpi_catalog`: `id`, `kind`, `unit`, `description`; fuente y justificación opcionales. El servidor asigna equipo y frecuencia diaria. Retirar KPIs con `deprecated_at`, sin borrarlos ni renombrarlos.

**Publicación.** Usar `POST /rest/v1/measurement?on_conflict=project_id,kpi_id,date,env`, JSON y `Prefer: resolution=ignore-duplicates`. El lote lleva de 1 a 10 objetos con `kpi_id`, `date`, `env`, `value` numérico finito y `run_id` UUID. No enviar `project_id`, `reported_at`, `status` ni `error_message`. El primer valor por equipo/KPI/fecha/ambiente es inmutable: cada 30 minutos se procesan cierres y reintentos, nunca valores parciales del día abierto.

**Recuperación.** Conservar muestras, lotes definitivos y recibos en artifacts de Actions durante 14 días. Reenviar exactamente el mismo payload y UUID. Fallar visiblemente ante errores HTTP; validar el lote antes del POST, que es atómico, y verificar recepción por GET. `date` identifica el día medido, pero `reported_at` determina el día de cumplimiento: un envío histórico no repara retroactivamente un día incumplido.

Revisión del 15 de octubre de 2026: `ci_success_rate` reemplaza el indicador de tiempo hasta abrir una PR; `mean_time_to_merge` se mantiene. La obtención de KPIs requiere GitHub, sin consultas a Linear. El catálogo conserva diez indicadores. Si el indicador retirado ya fue registrado, marcarlo con `deprecated_at` y registrar `ci_success_rate` por ambiente; no reutilizar su ID ni renombrar mediciones históricas.

## KPIs Selected

Todos se publican diariamente (frequency=daily). Se propone clasificar los indicadores de entrega como technical, sujeto a aceptación de la cátedra. Las unidades corresponden al catálogo del contrato. Los porcentajes se expresan de 0 a 100.

| KPI y código | Tipo | Fuente y cálculo | Unidad | Justificación |
| --- | --- | --- | --- | --- |
| Preventivos `preventive_rate` | business | Neon: preventivos / mantenimientos × 100, ventana de 30 días. | % | DP: objetivo ≥60%. |
| Alertas a tiempo `alert_resolution_rate` | business | Neon: alertas evaluables con servicio en plazo / evaluables × 100, al corte. | % | DP: objetivo ≥80%. |
| Usuarios que registran servicios `service_users_30d` | business | Neon: usuarios distintos, por ownerId del vehículo, con al menos un servicio creado en los últimos 30 días, según createdAt. | {usuario} | Adopción del producto. |
| Vehículos con actividad `active_vehicles_30d` | business | Neon: vehicleId distintos con servicios creados en los últimos 30 días, según createdAt. | {vehiculo} | Alcance del uso del producto. |
| Éxito de CI `ci_success_rate` | technical | API GitHub (ci.yml): success / (success + failure) × 100, 30 d; solo PRs a main, omite cancelled/skipped. | % | Mide fallos de CI en PRs a main. |
| Mean Time to Merge `mean_time_to_merge` | technical | GitHub: media de apertura a merge de PRs mergeadas en los últimos 30 días. | h | Demora de integración. |
| Errores 5xx `api_error_rate` | technical | Eventos NestJS: requests 5xx / requests registrados en el día × 100. | % | Fallos de la API. |
| Latencia p95 `api_latency_p95` | technical | Eventos NestJS: percentil 95 de duraciones completas del día. | ms | Lentitud de operaciones. |
| Disponibilidad API `api_availability` | health | Monitor: sondeos /health exitosos / realizados en el día × 100. | % | Disponibilidad observada. |
| Disponibilidad BD `db_availability` | health | Monitor: sondeos /health/db exitosos / realizados en el día × 100. | % | Salud de la base. |

## Risks and Validation

En Supabase, value=0 representa un resultado medido: no se aceptan valores nulos, ni status=error o not_available. Sin denominador, muestras o casos, no inventar valores. Validar claves, lote atómico, fechas, unidades, rechazo de KPI ajeno y reenvío sin modificación. Registrar las mediciones enviadas y detectar fallos.

La disponibilidad mide sondeos observados; las muestras faltantes requieren control de cobertura y no se asumen caídas. Confirmar clasificación de KPIs de entrega y seguimiento de alertas. Diez indicadores definidos no garantizan cinco válidos cada día: el cumplimiento completo requiere todos los KPIs activos en prod, con al menos cinco. Hacer piloto previo en dev y registrar también el catálogo prod. Actions puede retrasar o perder corridas; controlar cobertura sobre 48 sondeos nominales diarios. /health/db mide acceso a Neon vía API, no disponibilidad independiente de la BD.

## Impact on Current Project

- **Se agrega:** telemetría, integraciones GitHub/Supabase, monitor y reporter en GitHub Actions.
- **Se modifica:** API, esquema Prisma, workflows de GitHub Actions y documentación. El cron de alertas de PIT-63 tiene alcance separado.
- **Se descarta y rehace:** contrato Dataverse (`kpi_definition/kpi_report`), Entra ID, permisos y upsert; se reemplazan por PostgREST, catálogo por ambiente, claves y envío inmutable con respaldo en artifacts.
- **Se elimina:** dos tickets de Fixes y carry del Sprint 2 (10 SP). Se acepta menor margen para defectos y arrastre para preservar los flujos principales del MVP.
- **Fuera del MVP:** compartir vehículos (6 SP). Ya dependía de tiempo sobrante y no libera capacidad comprometida adicional.
- **Lab2:** 16 h estimadas (instrumentación 3, monitor 2, GitHub (CI y merge) 4, cálculos 3, publicación y cron 4), a revisar para la implementación en Actions.
- **Lab4:** 10 h (pruebas y documentación 4, ADR y coordinación 6).
