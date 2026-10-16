## Contexto

PitStop reunirá los chequeos de salud que ya se guardan en GitHub y calculará qué proporción respondió con éxito cada día. También indicará cuántos chequeos se pudieron observar.

Hoy hay chequeos individuales, pero todavía no un resultado diario. La ausencia de un chequeo no demuestra una caída y debe distinguirse de un error observado.

## Objetivo

Calcular la disponibilidad diaria de la API y del acceso a la base, junto con su cobertura.

**Referencia visual:** no aplica (infraestructura).

## Qué tiene que quedar andando

- Los chequeos guardados producen un porcentaje por cada objetivo.
- Se puede conocer cuántos chequeos se observaron y cuáles faltan.
- La falta de muestras se distingue de una caída medida.
- Repetir una ejecución no cuenta el mismo chequeo dos veces.

## Por dónde empezar

1. Revisar el artifact real de PIT-67 y acordar cómo identificar su ambiente.
2. Separar la descarga de evidencia de los cálculos y preparar fixtures.
3. Agregar pruebas de ventanas, duplicados, fallos y paginación.
4. Ejecutar el script contra evidencia dev conocida y comparar sus resultados.

## Palabras que vas a ver

- **Sondeo:** chequeo individual de salud guardado por el monitor.
- **Artifact:** archivo descargable asociado a una ejecución de GitHub.
- **Cobertura:** proporción de horarios programados con evidencia disponible.
- **NO_DATA:** resultado sin muestras suficientes para producir un valor.

---

# Especificación técnica

## Datos del ticket

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

## Alcance

- Crear `scripts/kpis/availability.mjs` y sus pruebas bajo `scripts/kpis/tests/`.
- Consumir artifacts de PIT-67; devolver `api_availability` y `db_availability` con contrato `source=availability`.
- Entregar el fragmento a la integración conjunta, sin realizar publicaciones.

## Implementación

**Objetivo.** Crear `scripts/kpis/availability.mjs`, ejecutable independientemente del workflow, que devuelva los dos KPIs de disponibilidad y su cobertura.

**Contexto del repositorio.** `HealthController` ya expone públicamente GET `/health` con `{status:"ok"}` y GET `/health/db` con `{database:"up"}`. `HealthRepository` ejecuta SELECT 1 y `HealthService` devuelve 503 cuando la consulta falla. El monitor de PIT-67 aún no está en main; el contrato vigente de PIT-67 exige `health-checks.json` con `schemaVersion`, `runId`, `runAttempt` y `checks` con target, checkedAt, httpStatus, ok y errorKind. El ejemplo de PIT-67 no incluye env ni eventName: no exigirlos como si ya existieran. Coordinar el formato real antes de integrar; desarrollar con fixtures sin esperar al workflow de A.

**Implementación.** Recibir `--date`, `--env` y `--output` conforme al contrato común. Separar lectura/paginación/descarga de artifacts del agregador puro, con cliente HTTP y reloj sustituibles en pruebas. Leer artifacts incluso de corridas fallidas, filtrar el ambiente solicitado y usar el timestamp real de cada sondeo para decidir pertenencia al día argentino. Validar archivos y campos; un artifact seleccionado cuyo contenido contradice su ambiente no se acepta como muestra válida.

Deduplicar por `runId`/target conservando el primer intento con muestra; no contar un rerun como nuevo sondeo programado. Calcular `api_availability` y `db_availability` como éxitos / sondeos observados × 100, siguiendo la condición de éxito del monitor. Mantener diferenciadas muestras manuales y programadas para informar cobertura sobre 48 corridas nominales. Sondeos ausentes no son fallos; sin muestras, NO_DATA. La métrica DB es acceso vía API y no una medición independiente de Neon.

Escribir un fragmento `source=availability` con measurements READY, diagnósticos por KPI, numeradores/denominadores, cobertura, ventana y referencias mínimas de origen. Un fallo de lectura debe identificarse como ERROR, distinto de ausencia de muestras. No publicar, escribir en Neon ni asignar run_id de publicación. Las credenciales de lectura llegan por entorno y no se escriben en JSON.

**Criterios de cierre.** Fixtures para límites del día, éxito/fallo/timeout, 0% real, 100%, falta de muestras, artifacts duplicados, intentos, manuales, ambientes mezclados, archivos inválidos y varias páginas. Probar el CLI y las funciones con `node --test` si se adopta el runtime `.mjs` de A. Entregar ejemplo de fragmento y comando local reproducible; la integración al workflow queda en la tarea local `kpis-sources-integration`.
### Compatibilidad con el monitor

- Configurar explícitamente repositorio, workflow `kpi-health-monitor.yml` y ambiente de origen. Si falta env en el JSON, usar una asignación explícita de ese monitor/despliegue al ambiente, validada en dev; no inferir ambiente desde rama o nombre de archivo. Si el mismo monitor mezcla ambientes sin evidencia para distinguirlos, devolver ERROR en vez de atribuir muestras al azar.
- Obtener eventName de los metadatos de la corrida cuando no esté en el JSON. Mantener las muestras manuales identificadas aparte de la cobertura programada; no contar el estado final del job como sustituto de cada `checks[].ok`.
- API exitosa: HTTP 200 con status=ok; DB exitosa: HTTP 200 con database=up. PIT-67 conserva el resultado por objetivo incluso en una corrida fallida.
- Ejemplo: 36 éxitos de 48 observaciones → 75 %; 18/24 → 75 % con cobertura de solo 24/48 horarios. Una request al API y otra a DB no equivalen a 48 sondeos.
- Para horarios nominales, deduplicar por horario previsto cuando haya varias ejecuciones del mismo slot; conservar timestamps reales para pertenencia a la ventana. No exigir exactitud de ejecución al minuto: Actions puede retrasar corridas.

## Criterios de aceptación técnicos comunes

- Funciones de cálculo separadas de HTTP y almacenamiento, con reloj y clientes sustituibles en pruebas. No agregar otro framework de tests ni un package de workspace.
- Pruebas de scripts con Node 24: `pnpm test:kpis`, conectado por PIT-71 a `.github/workflows/ci.yml`. Al importar un módulo no se ejecuta su CLI.
- Pasan `pnpm format:check`, `pnpm lint`, `pnpm check-types` y `pnpm build`; las pruebas no dependen de credenciales reales.
- Documentar comando local y evidencia real dev en `docs/kpis.md`. PR aprobado y mergeado; ninguna prueba publica valores productivos.

## Fuera de alcance

Publicar en Supabase, cambiar endpoints health, escribir en Neon, rehacer el monitor PIT-67 o crear muestras ficticias. Cualquier ampliación incompatible del contrato del monitor se coordina antes de activar la fuente.
