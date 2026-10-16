## Contexto

PitStop calculará qué porcentaje de los chequeos automáticos de las propuestas de cambio termina con éxito y cuánto tardan en fusionarse esas propuestas. Ambos resultados se obtendrán de GitHub.

La publicación diaria todavía no recibe estas mediciones. Contar ejecuciones ajenas o duplicar reintentos puede mostrar una calidad distinta de la observada.

## Objetivo

Calcular el éxito de los chequeos automáticos y el tiempo promedio hasta fusionar una PR.

**Referencia visual:** no aplica (infraestructura).

## Qué tiene que quedar andando

- Los chequeos de propuestas dirigidas a la rama principal producen un porcentaje de éxito.
- Los reintentos no duplican una misma ejecución.
- Las propuestas fusionadas producen un tiempo promedio en horas.
- La falta de casos se distingue de un resultado cero y de un error de lectura.

## Por dónde empezar

1. Revisar ci.yml y comprobar el acceso de lectura a Actions y PRs.
2. Separar adaptadores de GitHub y funciones de cálculo con fixtures.
3. Agregar pruebas de conclusiones, reintentos, ventanas y paginación.
4. Ejecutar el script contra datos dev conocidos y comparar los dos valores.

## Palabras que vas a ver

- **CI:** chequeos automáticos que corren al proponer un cambio.
- **Conclusión:** resultado final de una ejecución en GitHub.
- **Reintento:** nuevo intento de una misma ejecución, no una observación adicional.
- **Fixture:** datos controlados para comprobar el cálculo.

---

# Especificación técnica

## Datos del ticket

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

## Alcance

Crear `scripts/kpis/delivery.mjs` con `ci_success_rate` (%) y `mean_time_to_merge` (h), sus adaptadores de lectura y pruebas. Conservar `source=delivery` para reutilizar el contrato de PIT-71.

## Implementación

**Objetivo.** Crear `scripts/kpis/delivery.mjs`, independiente del workflow, para calcular Éxito de CI (`ci_success_rate`, technical, %) y Mean Time to Merge (`mean_time_to_merge`, technical, h) con evidencia verificable de GitHub.

**Contexto del repositorio.** Crear un script de lectura de GitHub, sin módulo Nest ni tablas para estas fuentes. La CI actual es `.github/workflows/ci.yml` y se ejecuta sobre PRs a main. Recibir explícitamente owner/repositorio; consultar el workflow por su archivo `ci.yml`, no todos los workflows del repositorio. Verificar acceso real a Actions y PRs al comenzar. No consultar Linear ni vincular tickets para calcular estos indicadores.

**Implementación.** Recibir `--date`, `--env`, `--output` y configuración de GitHub. Separar adaptadores de lectura y agregadores puros para probar con fixtures mientras A implementa el workflow. Paginar ejecuciones de Actions y PRs; conservar IDs, conclusiones y timestamps necesarios sin cuerpos ni tokens. `env` identifica el contexto de reporte: ambos indicadores describen el repositorio configurado y no se filtran por una supuesta rama dev/prod.

Calcular `ci_success_rate`: `100 × success / (success + failure)` de las ejecuciones de `ci.yml` para el evento `pull_request` con base `main`, en la ventana de treinta días terminada en el corte argentino. Seleccionar por `created_at` de la ejecución y exigir que el intento evaluado haya terminado antes del corte. Contar una vez cada `run_id`, usando el primer intento para que un rerun exitoso no oculte una falla inicial; conservar su evidencia. El filtro `branch` de Actions identifica la rama de origen, no prueba la base de la PR: verificar `base.ref = main` con los metadatos de la PR. Solo `conclusion = success` o `failure` entra en la fórmula; omitir cancelled/skipped, ejecuciones abiertas y cualquier otra conclusión, dejando conteos de exclusión. Sin denominador: NO_DATA. Ejemplo: 8 success, 2 failure, 1 cancelled y 1 skipped → `100 × 8 / (8 + 2) = 80 %`.

Calcular `mean_time_to_merge`: media en horas de apertura a merge de PRs mergeadas dentro de esa misma ventana de treinta días; excluir cerradas sin merge y deduplicar por ID de PR. Mantener su fórmula y unidad actuales. Ejemplo: PRs de 2 h y 4 h → `3 h`. Sin casos: NO_DATA.

Conservar horas fraccionarias para `mean_time_to_merge` y porcentajes entre 0 y 100 para `ci_success_rate`; excluir duraciones negativas y distinguir falta de casos, evidencia incompleta y fallo de GitHub. Devolver fragmento `source=delivery` con los IDs `ci_success_rate` y `mean_time_to_merge`, measurements READY y diagnósticos con conteos, ventanas, versión y referencias mínimas. El nombre interno delivery se conserva para compatibilidad del contrato. No transformar datos faltantes en cero, publicar ni persistir en Neon. El token GitHub debe permitir leer Actions y PRs; no se necesita token de Linear.

**Criterios de cierre.** Fixtures con paginación, PRs con base distinta de main, workflows distintos de ci.yml, eventos push/manual excluidos, success/failure, cancelled/skipped y otras conclusiones excluidas, ejecuciones abiertas, reruns sin duplicación y límites del corte. Probar 8 success y 2 failure → 80 %, solo success → 100 %, solo failure → 0 % y denominador vacío → NO_DATA. Para merge, conservar casos de PRs abiertas fuera de ventana pero mergeadas dentro, cerradas sin merge, horas fraccionarias y duraciones inválidas. Un fallo de GitHub produce ERROR, no NO_DATA ni cero. Ejecutar pruebas independientes y validar el contrato común. Confirmar lectura real de GitHub con evidencia segura; integración al workflow fuera de esta tarea. Referencia: [API de ejecuciones de workflows](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-workflow).

### Consulta y evidencia

- Consultar `GET /repos/{owner}/{repo}/actions/workflows/ci.yml/runs` con evento pull_request y paginación. La API puede limitar búsquedas filtradas a 1000 resultados: subdividir rangos si hace falta y nunca aceptar una ventana truncada como completa.
- Para reintentos, consultar la evidencia del primer intento; no usar la conclusión del último intento como si fuera la inicial. Si el primer intento no está disponible, informar evidencia incompleta sin inventar éxito.
- Leer PRs cerradas y conservar únicamente las que tienen `merged_at` en la ventana; ordenar/paginar hasta cubrirla, sin asumir que todas las PRs cerradas se fusionaron. Base main se exige para el KPI de CI; no agregar ese filtro al tiempo hasta merge sin una regla de negocio explícita.
- Permisos de lectura: Actions y Pull requests sobre el repositorio configurado. No requiere token ni consultas a Linear. Conservar conteos de conclusiones excluidas y sampleCount de PRs; no publicar diagnósticos como mediciones.
- Fragmento: schemaVersion=1, source=delivery, date/env, calculationVersion, referencias mínimas, dos diagnósticos y measurements exclusivamente READY. Primer cálculo: 8 success y 2 failure → 80 %. Segundo: tiempos de 2 h y 4 h → 3 h.

## Criterios de aceptación técnicos comunes

- Funciones de cálculo separadas de HTTP y almacenamiento, con reloj y clientes sustituibles en pruebas. No agregar otro framework de tests ni un package de workspace.
- Pruebas de scripts con Node 24: `pnpm test:kpis`, conectado por PIT-71 a `.github/workflows/ci.yml`. Al importar un módulo no se ejecuta su CLI.
- Pasan `pnpm format:check`, `pnpm lint`, `pnpm check-types` y `pnpm build`; las pruebas no dependen de credenciales reales.
- Documentar comando local y evidencia real dev en `docs/kpis.md`. PR aprobado y mergeado; ninguna prueba publica valores productivos.

## Fuera de alcance

Cambiar los chequeos de CI, medir tiempos de tickets Linear, publicar o integrar al workflow, modificar Neon o crear dashboards.

## Referencias

- [Ejecuciones de workflows](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-workflow).
- [Pull requests](https://docs.github.com/en/rest/pulls/pulls#list-pull-requests).
