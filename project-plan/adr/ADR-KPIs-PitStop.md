# ADR Reporting diario de KPI de PitStop

Fecha: 8 de octubre de 2026. Estado: propuesta revisada para implementación.

## Context

Lab4 exige entre 5 y 10 KPIs; solo `prod` cuenta para cumplimiento y un día completo requiere todos los indicadores activos, con un mínimo de cinco. Se reemplaza Microsoft Dataverse por la API central de Lab4, conservando la fecha del MVP y la capacidad de Lab2. 

## Decision Drivers

Reutilizar NestJS, Prisma y Neon, proteger credenciales, medir desde fuera de la API y recuperar envíos sin duplicados, manteniendo la capacidad y fecha del MVP.

## Options Considered

1. **API con Vercel Cron:** reutiliza despliegue y código, pero vincula la programación a Vercel y requiere un monitor externo.
2. **GitHub Actions y endpoint de PitStop. Seleccionada:** separa sondeos y publicación de las reglas de negocio; agrega secretos, consumo de Actions y posibles retrasos de ejecución.
3. **Plataforma de observabilidad y reporter:** mejora el diagnóstico, pero incorpora infraestructura y operación adicionales.

## Proposed Decision

**Programación.** Dos workflows en `pitstop-app`: monitor y reporting cada 30 minutos (`*/30 * * * *` UTC), y cierre de negocio a la 1:00 argentina (`0 4 * * *` UTC). El primero sondea `/health` y `/health/db`, conserva muestras y envía o reintenta cierres preparados. El segundo invoca el endpoint protegido de PitStop y reúne los indicadores del día argentino anterior. Ambos permiten ejecución manual por fecha y se publican en la rama predeterminada.

**Ventanas y cálculo.** Usar `America/Argentina/Buenos_Aires`: desde las 00:00 inclusive hasta las 00:00 del día siguiente exclusive. Los indicadores de 30 días terminan en ese corte. Incorporar `GET /internal/kpis/daily?date=YYYY-MM-DD`, con secreto de servicio independiente de Firebase, validación de fecha y consultas Prisma en repositories. Devolver agregados válidos y diagnósticos separados, sin datos personales. El runner no accede directamente a Neon. Registrar eventos HTTP mínimos y vincular tickets Linear con PRs de GitHub.

**Autenticación y catálogo.** Configurar URL y credenciales por ambiente; confirmar el destino productivo porque Swagger de `dev` y OpenAPI de `main` apuntan a servidores distintos. Enviar `apikey: SUPABASE_PUBLISHABLE_KEY` y `X-Project-Key: PROJECT_KEY`, con la clave privada en GitHub Secrets. Registrar por ambiente en `POST /rest/v1/kpi_catalog`: `id`, `kind`, `unit`, `description`; fuente y justificación opcionales. El servidor asigna equipo y frecuencia diaria. Retirar KPIs con `deprecated_at`, sin borrarlos ni renombrarlos.

**Publicación.** Usar `POST /rest/v1/measurement?on_conflict=project_id,kpi_id,date,env`, JSON y `Prefer: resolution=ignore-duplicates`. El lote lleva de 1 a 10 objetos con `kpi_id`, `date`, `env`, `value` numérico finito y `run_id` UUID. No enviar `project_id`, `reported_at`, `status` ni `error_message`. El primer valor por equipo/KPI/fecha/ambiente es inmutable: cada 30 minutos se procesan cierres y reintentos, nunca valores parciales del día abierto.

**Recuperación.** Conservar muestras, lotes definitivos y recibos en artifacts de Actions durante 14 días. Reenviar exactamente el mismo payload y UUID. Fallar visiblemente ante errores HTTP; validar el lote antes del POST, que es atómico, y verificar recepción por GET. `date` identifica el día medido, pero `reported_at` determina el día de cumplimiento: un envío histórico no repara retroactivamente un día incumplido.

## KPIs Selected

Todos se publican como cierres diarios. Porcentajes de 0 a 100; `%`, `h`, `ms` y `1` son las unidades del catálogo. Las métricas de entrega se clasifican como `technical`, sujetas a validación de la cátedra.

| KPI y código | Tipo y unidad | Fuente y cálculo | Finalidad |
| --- | --- | --- | --- |
| Preventivos `preventive_rate` | business / % | Neon: preventivos / servicios × 100, últimos 30 días. | Objetivo ≥60%. |
| Alertas a tiempo `alert_resolution_rate` | business / % | Neon: alertas evaluables con servicio en plazo / evaluables × 100, al corte. | Objetivo ≥80%. |
| Mean Time to PR `mean_time_to_pr` | technical / h | Linear/GitHub: media de primera entrada en In Progress a primera PR; PRs abiertas en últimos 30 días. | Demora hasta revisión. |
| Mean Time to Merge `mean_time_to_merge` | technical / h | GitHub: media de apertura a merge; PRs mergeadas en últimos 30 días. | Demora de integración. |
| Tickets sin PR `tickets_without_pr` | technical / 1 | Linear/GitHub: tickets en curso sin PR, con más de 48 h al corte. | Trabajo detenido. |
| PRs abiertas antiguas `aged_open_prs` | technical / 1 | GitHub: PRs abiertas con más de 48 h al corte. | Acumulación en revisión. |
| Disponibilidad API `api_availability` | health / % | Actions: sondeos /health exitosos / realizados en el día × 100. | Disponibilidad observada. |
| Errores 5xx `api_error_rate` | technical / % | Eventos HTTP: requests 5xx / registrados en el día × 100. | Fallos de la API. |
| Latencia p95 `api_latency_p95` | technical / ms | Eventos HTTP: percentil 95 de duraciones completas del día, nearest-rank. | Lentitud de operaciones. |
| Disponibilidad BD `db_availability` | health / % | Actions: sondeos /health/db exitosos / realizados en el día × 100. | Acceso a BD vía API. |

## Risks and Validation

Un cero debe representar una medición real. Sin denominador o muestras, conservar diagnóstico interno y omitir el valor: el receptor no admite `null`. Activar diez KPIs exige diez valores diarios; realizar un piloto y acordar un catálogo productivo viable de al menos cinco. Validar clasificación de preventivos y evidencia de envío, plazo y resolución de alertas, reutilizando `alertas-metrica` y PIT-63.

Actions puede retrasar o perder corridas: no garantiza puntualidad exacta. Controlar cobertura sobre 48 sondeos nominales diarios; una muestra ausente no equivale a caída. `/health/db` mide acceso a Neon a través de PitStop, no disponibilidad independiente de la BD. Excluir sondeos y reporting del tráfico medido. Probar corte argentino, fórmulas, aislamiento por ambiente, autenticación, atomicidad y reenvíos; conservar evidencia sin secretos.

## Impact on Current Project

Se agregan monitor/reporter en Actions, endpoint de KPIs, telemetría e integraciones Linear/GitHub. Se retiran Dataverse, Entra ID y Vercel Cron del diseño de KPIs; el cron de alertas de PIT-63 tiene alcance separado.

Para el 8–15 de octubre se proponen tres tickets: contrato/catálogo (2 SP), monitor/reporter (4 SP) y endpoint de negocio (4 SP). Los 10 SP sustituirían el margen de Fixes y carry, sujetos a revisar carry y capacidad; no se agregan a la carga existente. Telemetría HTTP y métricas de entrega requieren otros 6 SP preliminares. Compartir vehículos continúa fuera del MVP comprometido.

**Referencias**

- Guía: https://github.com/lab4-kpis/kpis/blob/main/docs/TEAM_GUIDE.md
- Swagger: https://lab4-kpis.github.io/kpis/dev/#/docs
- Actions: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
