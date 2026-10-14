# Implementación simple de KPI Reporting

Revisión local del 14 de octubre de 2026. Fuente funcional: ADR 02 y TEAM_GUIDE
entregados por el equipo. No modifica Linear ni la decisión arquitectónica del ADR.
Reemplaza la propuesta de endpoints de ingesta y snapshots del plan anterior.

## Flujo común

1. La API recibe `GET /internal/kpis/daily?date=YYYY-MM-DD` con secreto de servicio.
   Calcula negocio y HTTP desde sus repositories, guarda una corrida con sus
   resultados y devuelve agregados más diagnósticos. Actions no consulta Neon.
2. Actions agrega disponibilidad desde los artifacts del monitor y tiempos de
   entrega desde Linear/GitHub. Estas fuentes no vuelven a la API ni a Neon.
3. Actions arma y conserva el JSON definitivo antes del POST a Lab4. Reintenta
   exactamente ese archivo y UUID, sin consultar ni calcular de nuevo.

Mantener un módulo de API y scripts de runner. No incorporar otra base, cola,
plataforma de observabilidad, controller por fuente ni modelo de catálogo local.
La persistencia de PIT-68 puede guardar resultados de cualquier KPI; esa capacidad
no obliga a agregar una integración para almacenar fuentes externas.

Una consulta nueva a la API puede generar otra corrida para la misma fecha, como
permite el esquema actual. El `runId` de publicación identifica el lote del runner;
el artifact conserva también el UUID del snapshot API usado como origen. Si ya
hay un lote preparado para fecha/ambiente, el runner lo recupera en vez de preparar
otro. No confundir UUID de ejecución de Actions con UUID de publicación.

## Preparación manual, fuera de tickets

El equipo registra el catálogo por ambiente antes de publicar. El registro, el
comando para hacerlo y su automatización NO forman parte de tickets de desarrollo.
El cliente de publicación consume IDs ya registrados. URL y claves pertenecen al
ambiente elegido; confirmar el destino antes de publicar.

Registrar únicamente indicadores con evidencia viable; se requieren al menos cinco
activos y todos ellos reportados para un día completo. Si el subset no llega a cinco,
la publicación parcial funciona pero no cumple: revisar disponibilidad de datos con
el equipo, sin fabricar valores ni redefinir las fórmulas. Diez candidatos no son
una garantía de diez valores diarios. El registro en dev no registra prod.

## Contexto comprobado en pitstop-app

Revisión de lectura del 14 de octubre de 2026 sobre `../pitstop-app`, rama
`main`, commit `3d5bfae`. Estos datos describen el checkout, no prueban el
estado de otras ramas ni la configuración remota de GitHub/Vercel/Supabase.

- `KpisModule` ya está en `AppModule`; solo tiene repository, sin servicio ni
  controller. `createRunWithResults` hace nested create atómico y
  `findRunById` devuelve resultados ordenados por KPI.
- `apps/api/prisma/models/kpi.prisma` y la migración
  `20261013184155_add_kpi_persistence` ya existen. Ambientes internos DEV/PROD,
  resultados READY/NO_DATA/ERROR, conteos BigInt y múltiples corridas por fecha.
  `apps/api/test/kpis.db-spec.ts` y `docs/kpis.md` explican su verificación.
- `Maintenance.date` es fecha calendario y `createdAt` es timestamp;
  `Vehicle.ownerId` y `Maintenance.vehicleId` permiten los dos conteos distintos.
- `HealthController` expone /health y /health/db públicamente; el segundo
  hace SELECT 1 mediante repository y devuelve 503 si la base no responde.
- `FirebaseAuthGuard` es global y sincroniza usuarios; el endpoint KPI debe
  saltarlo con @Public y aplicar su propio guard de servicio.
- No hay modelo de requests HTTP, scripts KPI ni monitor en este checkout.
  Notifications conserva dispositivos y envío de prueba, sin historial de ciclos
  enviados/resueltos. Revisar PIT-66/67/63 al integrar.
- Solo existe `.github/workflows/ci.yml`: PRs a main, pnpm 11.20.0 y Node 24.
  No existe carpeta scripts/. Las rutas de scripts/workflows indicadas en las
  tareas son propuestas para implementar.
- `apps/api/.env.example` todavía no define KPI_ENV/KPI_CRON_SECRET. No inferir
  dev/prod desde NODE_ENV, rama o nombres de URL. La tarea 1 define el ambiente
  de datos del backend y la tarea 2 configura los ambientes del reporting.

## Responsabilidad de documentación y validación

Cada implementación incluye sus pruebas propias. Las tareas de integración
verifican el recorrido de su fuente hasta el receptor. La tarea 6 cierra con una
prueba técnica de las tres fuentes, coordinada con A/B, incluida en sus 2 SP.
Otro equipo conserva documentación, piloto y validación de aceptación del MVP;
no se agregan tareas ni puntos para esas actividades.

## Seis tareas y reparto

| Tarea | Responsable | SP |
| --- | --- | --- |
| 1. Implementar KPIService, endpoint diario y persistencia | A | 3 |
| 2. Implementar workflows, publicación en Supabase y prueba API a receptor | A | 3 |
| 3. Implementar y probar el script de disponibilidad de API y base | B | 4 |
| 4. Integrar disponibilidad al workflow y verificar el flujo | B | 2 |
| 5. Implementar y probar el script de métricas de GitHub y Linear | C | 4 |
| 6. Integrar métricas de entrega y verificar el flujo completo | C | 2 |
| Total | A: 6 · B: 6 · C: 6 | 18 |

A/B/C representan responsables todavía sin nombre asignado. Las seis tareas
reemplazan el desglose anterior de cálculo, endpoint, HTTP, publicación,
workflows, agregación de sondeos y fuente/cálculo de entrega. La referencia
PIT-69 queda únicamente en la tarea 1, con nueva estimación local de 3 SP;
esto no cambia el ticket externo ni su estimación en Linear.

### Prerrequisitos, fuera de los 18 SP

- PIT-66: registros HTTP disponibles; PIT-67: sondeos y artifacts; PIT-68:
  persistencia existente. Conservar sus tres tareas históricas (8 SP), sin duplicar.
- Catálogo registrado manualmente y credenciales por ambiente antes de publicar.
- Evidencia de alertas enviadas y su resolución: envío efectivo, ciclo, plazo y
  mantenimiento del mismo vehículo/tipo. Se retira su tarea del backlog KPI
  nuevo, pero el trabajo sigue pendiente de cobertura en Alertas. Sin evidencia,
  reportar ALERT_RESOLUTION_EVIDENCE_MISSING, sin valor publicable.

Los 3 SP de la tarea 1 son un presupuesto acordado que presupone reutilizar estas
piezas; no absorben la construcción de evidencia faltante.

### 1. Implementar KPIService, endpoint diario y persistencia

**Responsable A · 3 SP · Referencia existente: PIT-69**

**Objetivo.** Obtener el cierre de los cuatro KPIs de negocio y los dos de HTTP desde la API, conservarlo y devolverlo al runner. Esta tarea amplía localmente PIT-69; no vuelve a crear la persistencia de PIT-68.

**Contexto del repositorio.** `apps/api/src/modules/kpis/kpis.module.ts` ya está importado por `AppModule`, pero solo registra y exporta `KpisRepository`. El repository ofrece `createRunWithResults` y `findRunById`; la primera operación persiste corrida y resultados atómicamente. `apps/api/prisma/models/kpi.prisma` define ambientes `DEV`/`PROD`, resultados `READY`/`NO_DATA`/`ERROR` y conteos BigInt. `Maintenance` contiene `category`, `date`, `createdAt` y `vehicleId`; `Vehicle.ownerId` permite contar usuarios distintos. Los repositories actuales de mantenimientos sirven operaciones por vehículo/propietario; agregar consultas de agregación, sin descargar historiales individuales al runner.

**Implementación.** Extender el módulo existente con `KpiService`, controller, DTO de fecha y guard de servicio; archivos nuevos bajo `apps/api/src/modules/kpis/`. Seguir el patrón controller → service → repository, con Prisma exclusivamente en repositories. Exponer `GET /internal/kpis/daily?date=YYYY-MM-DD`. Aplicar `@Public()` únicamente junto con el guard que verifica `KPI_CRON_SECRET`: `FirebaseAuthGuard` es global y, sin esa excepción, intenta validar Firebase y sincronizar un usuario. El flujo KPI no debe hacerlo.

Agregar `KPI_ENV=dev|prod` y `KPI_CRON_SECRET` a la configuración del backend y documentar placeholders en `apps/api/.env.example`. La API obtiene su ambiente del despliegue, no de un query param ni de `NODE_ENV`; convertir explícitamente `dev/prod` a `DEV/PROD` al persistir y devolver minúsculas al runner. Rechazar configuración faltante/inválida. El entorno desplegado debe tener su base y secreto correspondientes; cambiar una etiqueta no transforma datos productivos en datos de desarrollo.

Calcular `preventive_rate`, `alert_resolution_rate`, `service_users_30d`, `active_vehicles_30d`, `api_error_rate` y `api_latency_p95` con las reglas del ADR 02. Negocio usa sus ventanas de 30 días o el corte de alertas; HTTP usa el día cerrado, solo tráfico APPLICATION y respuestas COMPLETED, excluyendo health/reporting. Reutilizar el modelo real que entregue PIT-66 al integrarlo; hoy no está presente en este checkout. `Maintenance.date` es fecha calendario, distinta del timestamp `createdAt`.

Guardar una corrida y seis resultados con UUID generado por el backend, versión, ventanas y conteos. Sin denominador o evidencia, conservar NO_DATA; ante un fallo de fuente, responder 503 con diagnóstico seguro. No inferir resolución de alertas desde un mantenimiento cualquiera: faltan envío efectivo, ciclo, plazo y vínculo de resolución. Reutilizar los datos cuando estén disponibles; construirlos queda fuera de los 3 SP.

**Contrato de salida.** `{runId,date,env,calculationVersion,windowStart,windowEnd,measurements,diagnostics}`; `measurements` solo contiene `{kpi_id,value}` READY y finitos. Serializar BigInt como strings en diagnósticos. Respuesta sin caché ni datos personales. Una nueva consulta puede generar otra corrida; los reintentos externos recuperan el lote del runner y no llaman otra vez al endpoint.

**Criterios de cierre.** Probar 60% con tres preventivos y dos arreglos, owners/vehículos distintos, conteos vacíos iguales a cero, porcentaje sin denominador, alertas sin evidencia, filtros HTTP, p95 y corte argentino. Probar 400 de fecha, 401 de secreto, 503 de fuente, ambiente y rollback. Agregar pruebas unitarias en el módulo y pruebas de endpoint con el patrón Jest/Supertest de `apps/api/test/app.e2e-spec.ts`; reutilizar `test/kpis.db-spec.ts` para la persistencia. Las pruebas con BD requieren `TEST_DATABASE_URL` de una base terminada en `_test`.

### 2. Implementar workflows, publicación en Supabase y prueba API a receptor

**Responsable A · 3 SP**

**Objetivo.** Entregar un flujo API → lote guardado → Supabase que inicialmente se configure y pruebe en dev, permita seleccionar prod y deje definidos los puntos donde B/C conectarán sus fuentes.

**Contexto del repositorio.** Actualmente solo existe `.github/workflows/ci.yml`: checks de PR a main, pnpm 11.20.0, Node 24 e instalación con lockfile congelado. No hay carpeta `scripts/` ni workflows KPI en este checkout. Reutilizar esas convenciones y mantener los scripts separados del YAML. Las rutas y nombres siguientes son propuestos, no archivos implementados.

**Selección del ambiente.** Agregar un input manual `environment` con valores `dev` y `prod`, predeterminado dev, además de la fecha opcional. Para schedule, resolver `KPI_SCHEDULE_ENV` desde una variable de repositorio y usar dev si todavía no está definida. Validar el valor antes de elegir el job; aplicar el GitHub Environment correspondiente para obtener su configuración. La rama main no implica prod. Tanto el cierre como el monitor/reporter deben usar la misma política de selección.

Preparar la configuración separada de los GitHub Environments dev y prod. Variables por ambiente: `PITSTOP_API_BASE_URL`, `KPI_API_BASE_URL` del receptor, `KPI_ENABLE_AVAILABILITY` y `KPI_ENABLE_DELIVERY`; las dos integraciones empiezan deshabilitadas. Credenciales por ambiente: `KPI_CRON_SECRET`, `SUPABASE_PUBLISHABLE_KEY` y `PROJECT_KEY`. Las credenciales futuras de GitHub/Linear se incorporan en la tarea 6. No agregar DATABASE_URL ni credenciales de Neon al runner. Configuración faltante, snapshot de otro ambiente o URLs/identidad incompatibles con el destino elegido deben fallar antes de publicar; nunca reutilizar las claves de dev como fallback de prod. Documentar qué despliegue/base alimenta cada ambiente y comprobar el destino según el contrato del receptor.

**Archivos y puntos de integración.** Crear `scripts/kpis/` con un contrato y validador compartidos, helpers de fecha/configuración y comandos para obtener el snapshot, preparar el lote y publicarlo. Nombres propuestos: `contracts.mjs`, `dates.mjs`, `config.mjs`, `api-snapshot.mjs`, `prepare-batch.mjs`, `publish-batch.mjs`. Usar Node 24; si se agregan scripts `.mjs`, definir una prueba ejecutable con `node --test` e incorporarla a CI, sin instalar otro framework solo para estos scripts.

Definir el pipeline con pasos identificables: resolver contexto → recuperar lote existente → obtener snapshot API si no hay lote → availability (tarea 4) → delivery (tarea 6) → validar y congelar lote → subir artifact → publicar → verificar recepción. B/C reciben el mismo `--date`, `--env` y un `--output` para escribir su fragmento JSON. El preparador reúne únicamente los fragmentos habilitados; valida fecha, ambiente, versión, IDs únicos y números finitos, conserva diagnósticos y asigna un UUID común. No crear stubs con mediciones falsas. Si una integración se habilita sin script/configuración válida, dejar un fallo visible.

**Referencia de configuración.** Separar variables y secretos siguiendo [Variables](https://docs.github.com/en/actions/concepts/workflows-and-actions/variables) y [Environments](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/deploy-to-environment) de GitHub; el schedule corre en la rama predeterminada, según [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows). Esto no determina el ambiente de datos.

**Workflows y recuperación.** Crear `.github/workflows/kpi-daily.yml` para el cierre a `0 4 * * *` UTC y reutilizar/extender `.github/workflows/kpi-health-monitor.yml` de PIT-67 para sondeos/reintentos cada 30 minutos. Si PIT-67 aún no está integrado, coordinar su archivo/contrato; no implementarlo de nuevo dentro de esta tarea. Permisos de lectura mínimos para código y recuperación de artifacts. Separar contexto y nombres de artifacts por ambiente/fecha; coordinar concurrencia por ambiente sin cancelar un envío en curso. Publicar solo después de conservar lote y UUID durante 14 días. Recuperar también lotes de corridas fallidas; un reintento no ejecuta la API ni los scripts de B/C, incluso si luego cambian sus flags. Los fallos del monitor no deben impedir la recuperación del reporter.

Enviar 1–10 filas `{kpi_id,date,env,value,run_id}` a `POST /rest/v1/measurement?on_conflict=project_id,kpi_id,date,env`, con `apikey`, `X-Project-Key` y `Prefer: resolution=ignore-duplicates`. No enviar null ni campos internos. Verificar por GET fecha, ambiente y valores: un POST exitoso puede haber ignorado una fila previa distinta. Conservar recibo y diagnóstico; no sobrescribir valores aceptados.

**Criterios de cierre.** Ejecutar manualmente en dev con datos conocidos y catálogo dev previamente registrado; descargar el lote, comprobar recepción y reintentar idénticamente. Probar selección manual dev/prod y selección de schedule con mocks/configuración controlada, sin enviar datos reales a prod como prueba. Probar ausencia/cruce de credenciales, ambiente incorrecto, rechazo, 429/5xx, pérdida de confirmación, fallo al guardar artifact y conflictos. Entregar el contrato y los pasos reservados para B/C; la tarea debe cerrar con API → Supabase dev aunque ambas integraciones estén deshabilitadas. Documentar cómo cambiar el ambiente explícitamente y cómo correr/verificar el flujo; catálogo manual fuera de alcance.

### 3. Implementar y probar el script de disponibilidad de API y base

**Responsable B · 4 SP**

**Objetivo.** Crear `scripts/kpis/availability.mjs`, ejecutable independientemente del workflow, que devuelva los dos KPIs de disponibilidad y su cobertura.

**Contexto del repositorio.** `HealthController` ya expone públicamente GET `/health` con `{status:"ok"}` y GET `/health/db` con `{database:"up"}`. `HealthRepository` ejecuta SELECT 1 y `HealthService` devuelve 503 cuando la consulta falla. El monitor de PIT-67 aún no está en main; su borrador local define `health-checks.json` con `schemaVersion`, `env`, `eventName`, `runId`, `runAttempt` y `checks` con target, checkedAt, httpStatus, ok y errorKind. Coordinar el formato real antes de integrar; desarrollar con fixtures sin esperar al workflow de A.

**Implementación.** Recibir `--date`, `--env` y `--output` conforme al contrato común. Separar lectura/paginación/descarga de artifacts del agregador puro, con cliente HTTP y reloj sustituibles en pruebas. Leer artifacts incluso de corridas fallidas, filtrar el ambiente solicitado y usar el timestamp real de cada sondeo para decidir pertenencia al día argentino. Validar archivos y campos; un artifact seleccionado cuyo contenido contradice su ambiente no se acepta como muestra válida.

Deduplicar por `runId`/target conservando el primer intento con muestra; no contar un rerun como nuevo sondeo programado. Calcular `api_availability` y `db_availability` como éxitos / sondeos observados × 100, siguiendo la condición de éxito del monitor. Mantener diferenciadas muestras manuales y programadas para informar cobertura sobre 48 corridas nominales. Sondeos ausentes no son fallos; sin muestras, NO_DATA. La métrica DB es acceso vía API y no una medición independiente de Neon.

Escribir un fragmento `source=availability` con measurements READY, diagnósticos por KPI, numeradores/denominadores, cobertura, ventana y referencias mínimas de origen. Un fallo de lectura debe identificarse como ERROR, distinto de ausencia de muestras. No publicar, escribir en Neon ni asignar run_id de publicación. Las credenciales de lectura llegan por entorno y no se escriben en JSON.

**Criterios de cierre.** Fixtures para límites del día, éxito/fallo/timeout, 0% real, 100%, falta de muestras, artifacts duplicados, intentos, manuales, ambientes mezclados, archivos inválidos y varias páginas. Probar el CLI y las funciones con `node --test` si se adopta el runtime `.mjs` de A. Entregar ejemplo de fragmento y comando local reproducible; la integración al workflow queda en la tarea 4.

### 4. Integrar disponibilidad al workflow y verificar el flujo

**Responsable B · 2 SP**

**Objetivo.** Conectar el script de la tarea 3 al punto availability definido en la tarea 2, sin crear otra publicación o scheduler.

**Implementación.** Depende de tareas 2 y 3 y del monitor PIT-67. Usar el contexto de fecha/ambiente ya resuelto, permisos de lectura de Actions y archivo de salida acordado. Habilitar `KPI_ENABLE_AVAILABILITY` primero en dev y conservar la configuración independiente de prod. Asegurar que el monitor produzca muestras del mismo ambiente: artifacts prod no alimentan el cierre dev. Mantener el sondeo semihorario; el cierre solo agrega sus resultados, no sustituye un día de evidencia por dos requests puntuales.

Incorporar el fragmento antes de congelar el lote y guardar su evidencia/diagnósticos 14 días. Dejar que el preparador valide fecha, ambiente e IDs. Si el script falla, conservar el diagnóstico y permitir el manejo de otros READY según el contrato; finalizar con fallo visible, sin usar continue-on-error para ocultarlo. Si falla la validación global o no se puede conservar el lote, no publicar. La recuperación usa el archivo definitivo ya guardado y saltea la agregación.

**Criterios de cierre.** Ejecución manual en dev con muestras conocidas y comprobación de ambos valores recibidos en Supabase. Probar NO_DATA, error de lectura, archivo ausente, ambiente incorrecto y fallo de publicación seguido de recuperación sin volver a descargar/calcular muestras. Si el script funciona pero no queda conectado y verificado hasta el receptor, la tarea no está terminada.

### 5. Implementar y probar el script de métricas de GitHub y Linear

**Responsable C · 4 SP**

**Objetivo.** Crear `scripts/kpis/delivery.mjs`, independiente del workflow, para calcular Mean Time to PR y Mean Time to Merge con evidencia verificable.

**Contexto del repositorio.** El monorepo no tiene cliente Linear, script de entrega ni paquete compartido KPI; no crear un módulo Nest ni tablas para estas fuentes. La CI actual se ejecuta sobre PRs a main. Recibir explícitamente owner/repositorio de GitHub y equipo/proyecto de Linear; no buscar todo el workspace ni asumir que una PR cualquiera corresponde a PitStop. Verificar permisos y disponibilidad real del historial al comenzar; las fechas de ejemplo no sustituyen la evidencia de la API.

**Implementación.** Recibir `--date`, `--env`, `--output` y configuración de las fuentes. Separar adaptadores de lectura y agregadores puros para probar con fixtures mientras A implementa el workflow. Paginar issues/PRs e historial y vincular por referencias PIT-XX verificables en rama/título/cuerpo; conservar IDs y timestamps necesarios sin guardar cuerpos ni tokens. `env` identifica el contexto de reporte: las métricas describen el mismo repositorio/equipo y no se filtran por una supuesta rama dev/prod salvo una regla explícita de negocio.

Calcular `mean_time_to_pr`: media en horas desde primera entrada real en In Progress hasta primera PR asociada, seleccionada por apertura dentro de los 30 días que terminan en el corte argentino. `updatedAt` no prueba una transición, y una segunda entrada en In Progress no reemplaza a la primera. Calcular `mean_time_to_merge`: media apertura–merge de PRs mergeadas dentro de esa ventana; excluir cerradas sin merge. Definir explícitamente cómo se deduplican vínculos para no multiplicar una observación por referencias repetidas o varias PRs.

Conservar horas fraccionarias, excluir duraciones negativas y distinguir falta de casos, historial incompleto y fallo de proveedor. Devolver fragmento `source=delivery`, measurements READY y diagnósticos con conteos, ventanas y referencias mínimas. No transformar datos faltantes en cero, publicar ni persistir en Neon. El token GitHub debe tener acceso real a las PRs requeridas; el cliente Linear usa credencial de lectura externa a PROJECT_KEY y KPI_CRON_SECRET.

**Criterios de cierre.** Fixtures con varias páginas, reaperturas de estado, múltiples PRs, referencias repetidas, PRs sin ticket, issues sin historial, PRs abiertas fuera de ventana pero mergeadas dentro, horas fraccionarias y fallos parciales. Ejecutar pruebas independientes y validar el contrato común. Confirmar lectura real de las fuentes con credenciales dev de reporting, conservando evidencia segura; integración al workflow fuera de esta tarea.

### 6. Integrar métricas de entrega y verificar el flujo completo

**Responsable C · 2 SP**

**Objetivo.** Conectar delivery al pipeline de A y cerrar la prueba técnica de API, disponibilidad y entrega publicadas juntas en dev.

**Implementación.** Integrar tras tareas 2 y 5; la prueba completa también requiere la tarea 4. Configurar owner/repositorio GitHub y equipo/proyecto Linear en el GitHub Environment seleccionado, y la credencial Linear como Secret. Reutilizar el token de GitHub con permisos de lectura si alcanza; documentar la alternativa de credencial dedicada solo si la fuente requerida no es accesible. No exponer secretos en argumentos, artifacts o logs.

Habilitar `KPI_ENABLE_DELIVERY` inicialmente en dev. Ejecutar el script con la misma fecha/ambiente que API y availability y guardar su fragmento antes de preparar el lote. Reutilizar validador, publicación y recuperación existentes; no crear otro POST ni volver a almacenar estas métricas en la API. Un fallo parcial conserva evidencia y diagnóstico, puede permitir publicar los READY válidos y debe dejar el workflow fallido. NO_DATA no es un valor publicable.

**Criterios de cierre.** Coordinar con A/B una ejecución manual dev con datos conocidos de las tres fuentes; verificar por GET los diez valores si todos tienen evidencia, y omisiones justificadas si algún KPI no puede calcularse. Comprobar que el catálogo activo dev coincide con los valores esperados; una publicación parcial no se presenta como cumplimiento completo. Descargar origen, lote y recibo. Repetir tras una publicación fallida y comprobar mismo UUID/valores y ausencia de nuevas consultas a API, artifacts de sondeos o proveedores. Probar script fallido, fragmento ausente, fuente sin datos, ambiente cruzado e IDs duplicados. Preparar configuración prod sin efectuar publicaciones productivas como parte de estas pruebas. La tarea incluye integración técnica; el piloto y aceptación del MVP siguen a cargo del otro equipo.

## Contrato común y trabajo en paralelo

La tarea 2 define y prueba el contrato antes de que B/C integren. Propuesta de
interfaz de los scripts: `--date YYYY-MM-DD --env dev|prod --output <archivo>`.
El CLI usa el ambiente resuelto por el workflow; las credenciales se reciben por
entorno. Las funciones de agregación admiten fixtures y reloj inyectado.

Ejemplo de fragmento de disponibilidad, solo con datos de prueba:

```json
{
  "schemaVersion": 1,
  "source": "availability",
  "date": "2026-10-13",
  "env": "dev",
  "measurements": [
    { "kpi_id": "api_availability", "value": 100 }
  ],
  "diagnostics": [
    {
      "kpi_id": "api_availability",
      "status": "READY",
      "windowStart": "2026-10-13T03:00:00.000Z",
      "windowEnd": "2026-10-14T03:00:00.000Z",
      "numerator": 48,
      "denominator": 48,
      "scheduledSamples": 48,
      "expectedScheduledSamples": 48
    },
    {
      "kpi_id": "db_availability",
      "status": "NO_DATA",
      "diagnosticCode": "NO_SAMPLES"
    }
  ]
}
```

Fuentes internas del runner: api, availability y delivery. El adaptador de la
respuesta API agrega schemaVersion/source y conserva su runId como referencia de
origen. Validar campos, ventanas, fecha cerrada, env y IDs permitidos por fuente;
rechazar duplicados y números no finitos. Los conteos BigInt de API permanecen
como strings. NO_DATA/ERROR solo aparecen en diagnostics, nunca como valores
nulos enviados a Supabase. Guardar referencias seguras de evidencia en el artifact
compañero. El UUID de Actions, el del snapshot API y el del lote son distintos.

B/C no publican ni generan el UUID externo. El workflow reúne los fragmentos
habilitados y asigna un mismo run_id al lote. Los pasos de availability y delivery
comienzan deshabilitados, identificados explícitamente; no declarar una fuente
medida ni emitir ceros de relleno mientras no esté integrada. Habilitar una fuente
sin su script/configuración válida es error. Cuando una fuente falla, escribir un
diagnóstico seguro y preservar las demás fuentes; el workflow puede publicar READY
válidos después del respaldo, pero termina fallido. Un contrato global inválido
impide publicar. Distinguir esa situación de NO_DATA.

Las tareas 3 y 5 avanzan con fixtures en paralelo con A. La 4 depende de 2 y 3;
la 6 integra tras 2 y 5, y su cierre conjunto requiere 4. La tarea 2 puede probar
API → Supabase en dev con ambos flags deshabilitados. Registrar qué fuentes están
habilitadas en el manifiesto de origen del lote, para auditar la cobertura.

## Entornos de ejecución y prueba inicial

- Input manual environment: dev/prod, default dev. Schedule: variable de repositorio
  KPI_SCHEDULE_ENV, inicialmente dev y fallback dev si falta; rechazar otros valores.
- Resolver el ambiente antes del job con secretos y seleccionar el GitHub Environment
  correspondiente. No elegirlo a partir de una variable que solo se carga después
  de seleccionar ese mismo Environment.
- Cada ambiente tiene su URL de PitStop, URL del receptor, claves y flags de fuentes.
  El backend devuelve su KPI_ENV configurado; no aceptar una API prod etiquetada
  como dev por el runner. La tarea 2 valida identidad/ambiente según el contrato
  externo y registra destino/contexto sin secretos antes de preparar el lote.
- Artefacts, recibos, contexto de origen y recuperación quedan aislados por fecha y
  ambiente. No cambiar env de un lote recuperado ni consultar datos de otro ambiente.
- Primer cierre real, integración de B/C y prueba conjunta: dev. La configuración
  prod queda preparada y seleccionable; no se realizan envíos productivos como
  prueba de estas tareas. Dev no cuenta para la evaluación de Lab4.
- Reintentos recuperan lote y UUID sin consultar fuentes, aunque cambien los flags.
  Mantener el catálogo manual de cada ambiente alineado con sus KPIs habilitados;
  solo activar indicadores con evidencia viable.

## Reglas de cálculo

Todas las ventanas usan días calendario de `America/Argentina/Buenos_Aires`, inicio
inclusivo y final exclusivo. Los 30 días incluyen el día medido y los 29 anteriores.
No publicar el día abierto. `Maintenance.date` es una fecha calendario; `createdAt`
es un timestamp y requiere los límites UTC del corte argentino.

- `preventive_rate`: preventivos / mantenimientos de los 30 días × 100, por fecha
  de servicio y excluyendo registros creados después del corte. Confirmar que
  `MANTENIMIENTO` representa preventivo; el enum por sí solo no prueba esa regla.
- `alert_resolution_rate`: ciclos evaluables resueltos mediante servicio en plazo /
  ciclos evaluables al corte × 100. Para la implementación, fijar como evaluables
  los ciclos con envío efectivo y plazo ya vencido al corte; los aún abiertos no
  se evalúan anticipadamente. Confirmar esa regla con negocio antes de activar.
  Vincular mismo vehículo/tipo/ciclo; no cualquier servicio. Si falta evidencia,
  `ALERT_RESOLUTION_EVIDENCE_MISSING`, sin valor publicable.
- `service_users_30d`: owners distintos de vehículos con servicios cuyo `createdAt`
  está en la ventana. `active_vehicles_30d`: vehículos distintos de esos servicios.
  Ambos son conteos, no porcentajes; cero es válido si la consulta fue exitosa.
- `api_error_rate`: 5xx / requests COMPLETED de aplicación × 100.
  `api_latency_p95`: ordenar sus duraciones y tomar posición `ceil(0.95 × n)`.
  Excluir health/reporting; informar ABORTED por separado. Sin muestras: NO_DATA.
- `api_availability` y `db_availability`: éxitos / sondeos observados × 100.
  Deduplicar por ejecución/objetivo conservando el primer intento con muestra;
  no sumar un rerun como otro sondeo programado. Los manuales quedan identificados
  y no se cuentan como cobertura de los 48 horarios nominales. Ausentes no son
  fallos medidos. `/health/db` mide acceso a Neon por la API.
- `mean_time_to_pr`: horas desde primera entrada en In Progress a primera PR,
  seleccionadas por apertura dentro de la ventana. `mean_time_to_merge`: horas
  apertura–merge de PRs mergeadas en la ventana. Sin casos o historial: NO_DATA.

Los datos editables no reconstruyen exactamente un estado histórico. El snapshot
API y el lote guardado conservan lo que se calculó. Cambiar una fórmula requiere
versionarla; una versión nueva no permite corregir valores aceptados por Lab4.

## Contrato y recuperación

Respuesta API: `{ runId, date, env, calculationVersion, windowStart, windowEnd,
measurements, diagnostics }`. `measurements` contiene `{ kpi_id, value }` READY;
los diagnósticos contienen estado, motivo seguro, conteos y ventana por KPI.
Los BigInt se serializan como strings. Ambiente tomado del backend, validado por
el runner contra su configuración. No aceptar Neon credentials en Actions.

El GET calcula y conserva resultados internos; desactivar caché de su respuesta.
Una falta de datos devuelve diagnóstico, un fallo de fuente devuelve 503. La salud
fallida del monitor no evita ejecutar el paso de recuperación del reporter.

Lote externo: entre 1 y 10 filas `{ kpi_id, date, env, value, run_id }`, UUID de lote
común. Solo números finitos; no enviar campos internos, null, `project_id` ni
`reported_at`. POST canónico y headers definidos en TEAM_GUIDE. Un ERROR externo
puede dejar el workflow fallido después de conservar/publicar valores válidos de
otras fuentes; conservar diagnóstico del fallo, no presentarlo como éxito total.

Conservar evidencia de origen, lote definitivo y recibo 14 días. Listar artifacts
con paginación; recuperar también lotes de workflows fallidos. Concurrencia común
por ambiente entre cierre y monitor, sin cancelar el envío en curso. Un lote queda
confirmado solo al comparar por GET todas sus filas, fecha, ambiente y valores;
si se ignoró una fila por existir otro valor, registrar divergencia y no sobrescribir.

Un reenvío histórico no corrige cumplimiento retroactivo: `reported_at` determina
el día de recepción. Pasados 14 días no prometer recuperación de sondeos sin respaldo.

## Capacidad

Las seis tareas suman 18 SP del 15 al 22 de octubre: A 6, B 6 y C 6. Se elimina
la antigua reserva KPI de 1 SP para no superar la capacidad semanal. KPI Reporting
suma 26 SP, incluyendo 8 históricos del Sprint 2 y los 18 nuevos del Sprint 3.

La capacidad del Sprint 3 sigue en 72 SP. El plan por fechas suma 66 SP, con
21 SP de reservas y 6 SP disponibles en la semana del 22 al 29, sin crear tareas
adicionales. Perfil conserva 12 SP y deseos 11; sus fechas y alcance se mantienen.
Las estimaciones son presupuesto de planificación, no evidencia de viabilidad.
