## Contexto

PitStop necesita enviar los indicadores diarios al receptor de Supabase y comprobar que fueron recibidos. El proceso automático reunirá los resultados de la API y, cuando estén integradas, las fuentes de disponibilidad, éxito de CI y tiempo hasta merge.

Si una conexión falla después de enviar, repetir los cálculos puede producir valores distintos. Por eso se conservará el lote antes del envío y el workflow de KPIs permitirá recuperar ese mismo archivo mediante una ejecución manual.

## Objetivo

Publicar y verificar un cierre diario en desarrollo y permitir el reenvío manual de un lote guardado, sin recalcularlo.

**Referencia visual:** no aplica (infraestructura).

## Qué tiene que quedar andando

* Una ejecución permite elegir el ambiente y el día cerrado que se va a informar.
* Los valores de la API se conservan, se envían y se verifican en el receptor.
* Un envío fallido se puede recuperar manualmente desde el workflow de KPIs, conservando sus valores e identificador.
* Los errores quedan visibles y los valores faltantes no se reemplazan por ceros.
* Quedan definidos los puntos donde los otros desarrolladores conectarán sus fuentes.

## Por dónde empezar

1. Acordar el formato compartido con quienes implementan disponibilidad, éxito de CI y tiempo hasta merge.
2. Crear scripts de lectura de la API, preparación, recuperación, publicación y verificación.
3. Agregar pruebas locales del pipeline y conectarlas a la CI existente.
4. Componer el workflow diario con la acción local de publicación.
5. Ejecutar el workflow con respuestas controladas, comprobar el fallo visible de una API no disponible y recuperar un lote guardado.

## Palabras que vas a ver

* **Fragmento:** archivo de resultados de una fuente, todavía sin publicar.
* **Lote:** conjunto definitivo de mediciones que se conserva y se envía sin modificar.
* **Artifact:** archivo guardado en GitHub para auditar o recuperar una ejecución.
* **Composite action:** grupo de pasos reutilizable dentro de un job de GitHub Actions.
* **UUID:** identificador único que permite reconocer el mismo lote durante sus reintentos.

---

# Especificación técnica

## Datos del ticket

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

## Alcance

* Carpeta scripts/kpis con módulos `.mjs`, ejecutables con Node 24 y sin un package nuevo.
* Consulta autenticada a la API de [PIT-69](https://linear.app/pitstop-austral/issue/PIT-69/calcular-y-guardar-los-indicadores-diarios-de-negocio-y-trafico-http) y contrato común para tres fuentes.
* Preparación del lote, respaldo, envío, verificación y recuperación manual desde el workflow de KPIs.
* Workflow de cierre diario y acción compuesta para publicar un lote existente.
* Tests del runner y paso explícito en la CI existente.

## Implementación

### Archivos y responsabilidades

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

### Configuración por ambiente

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

### Contrato que reciben los otros desarrolladores

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

### Consulta a nuestra API

api-snapshot.mjs hace `GET /internal/kpis/daily?date=YYYY-MM-DD&env=dev|prod` con `Authorization: Bearer <CRON_SECRET>`, timeout finito y validación de status/JSON/contrato. Verificar que fecha y env coincidan con el contexto resuelto.

Guardar el fragmento y referencia de la corrida antes de preparar el lote. Un 401, 503, timeout o cuerpo inválido deja diagnóstico seguro y estado de fallo. No convertirlos en cero ni dar la fuente por completada. Este ticket demuestra el recorrido con API y receptor controlados, sin esperar a [PIT-69](https://linear.app/pitstop-austral/issue/PIT-69/calcular-y-guardar-los-indicadores-diarios-de-negocio-y-trafico-http). Cuando se consulta la API real aún no implementada, conservar el fallo visible y su diagnóstico; no activar un fallback automático a datos simulados. La prueba real API → receptor dev pertenece a [PIT-75](https://linear.app/pitstop-austral/issue/PIT-75/publicar-disponibilidad-y-metricas-de-github-junto-con-los-indicadores).

### Desarrollo independiente y respuestas simuladas

* Acordar y versionar fixtures con el contrato de [PIT-69](https://linear.app/pitstop-austral/issue/PIT-69/calcular-y-guardar-los-indicadores-diarios-de-negocio-y-trafico-http): respuesta válida, NO_DATA, 401, 404/503, timeout y JSON inválido. Usar cliente HTTP inyectable o servidor HTTP local para probar los mismos CLI y funciones del workflow, sin implementar otra API de negocio.
* Usar un receptor HTTP controlado para verificar POST, GET, respaldo y recuperación con datos simulados. Identificar esa evidencia como prueba; los fixtures no se publican como mediciones reales en el receptor compartido.
* En Actions, probar los pasos del workflow y su manejo de errores. Si API_BASE_URL real todavía no sirve el endpoint, 404/503 o fallo de conexión deben dejar diagnóstico seguro y job fallido. No ocultar el error, inventar ceros ni reemplazar silenciosamente la fuente con un mock.
* Mantener collect/recover reales y el contrato preparados para conectar [PIT-69](https://linear.app/pitstop-austral/issue/PIT-69/calcular-y-guardar-los-indicadores-diarios-de-negocio-y-trafico-http) cuando esté disponible. La ausencia del endpoint no bloquea el cierre de este ticket si pasan las pruebas controladas y se demuestra el fallo esperado; la validación de datos reales queda en [PIT-75](https://linear.app/pitstop-austral/issue/PIT-75/publicar-disponibilidad-y-metricas-de-github-junto-con-los-indicadores).

### Orden del workflow diario

El schedule ejecuta collect. La ejecución manual permite collect o recover; la rama recover se describe abajo y omite toda recolección.

1. Resolver y validar fecha cerrada, ambiente y configuración.
2. Consultar API y ejecutar las fuentes habilitadas; conservar fragmentos y diagnósticos.
3. Preparar un lote con los READY válidos y generar su UUID de publicación, junto con un manifiesto de fuentes, versiones, referencias de origen y errores parciales.
4. Invocar la composite action con el lote preparado: respaldar, publicar y verificar.
5. Conservar recibo y resumen de cobertura. Un ERROR de fuente mantiene el job fallido aunque se hayan enviado READY válidos; NO_DATA se informa sin inventar valores.

Sin READY, conservar diagnóstico sin realizar POST. Si falla la validación global, no publicar. La política de publicación parcial conserva el lote exacto: un reintento no agrega mediciones que aparecieron después ni cambia sus valores.

### Acción compuesta reutilizable

`.github/actions/publish-kpis/action.yml` usa `runs.using: composite`.

Inputs: ruta al directorio del lote, fecha y ambiente esperados. Las credenciales llegan mediante env desde el job que seleccionó el Environment; no se escriben como inputs visibles ni se imprimen.

Pasos:

1. Validar lote y manifiesto contra el contexto y calcular/verificar una huella SHA-256 del payload.
2. Guardar payload, manifiesto y evidencia como artifact con retención de 14 días. Fallar si faltan archivos o no se confirma el respaldo. Usar nombres únicos por ambiente, fecha, corrida e intento.
3. Publicar exactamente el payload respaldado mediante publish-batch.mjs.
4. Verificar recepción mediante verify-batch.mjs; conservar recibo y diagnóstico incluso si el envío o la verificación fallan.

La acción no ejecuta cálculos ni prepare-batch. Se invoca tanto desde el cierre diario como desde la recuperación manual del workflow KPI. Este ticket no la conecta al monitor. Cada paso `run` declara shell. El caller hace checkout y configura Node antes de usar la acción local.

### Publicación y verificación

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

### Recuperación manual desde el workflow de KPIs

1. Ejecutar manualmente el workflow KPI en modo recover e indicar environment, date, source_run_id y artifact_name. No es necesario que la corrida de origen haya terminado exitosamente.
2. Buscar el artifact indicado dentro de esa corrida del mismo repositorio, con paginación si corresponde. Verificar que pertenece al workflow KPI esperado; no buscar automáticamente entre todas las ejecuciones ni elegir el lote más reciente.
3. Descargar payload y manifiesto. Validar fecha, ambiente, UUID, esquema y huella del payload contra los datos conservados. Si falta el archivo, expiró o el contexto no coincide, fallar sin consultar fuentes ni preparar otro lote.
4. Invocar la misma composite action con el lote recuperado. Conservar exactamente los bytes del payload y su UUID; respaldarlo en la nueva ejecución antes del POST y verificar recepción por GET.
5. Conservar un recibo de la recuperación con referencia a la corrida de origen. Si el receptor ya tenía los mismos valores, reconocer la coincidencia; si tiene otros, informar conflicto y no sobrescribirlos.

La rama recover nunca ejecuta api-snapshot, availability, delivery ni prepare-batch, aunque los datos o flags hayan cambiado. Reutiliza la configuración del ambiente autorizado y no permite cambiar el env del lote.

Coordinar exclusión de concurrencia por ambiente dentro del workflow KPI, sin cancelar un envío en curso. Esa coordinación no incluye [PIT-67](https://linear.app/pitstop-austral/issue/PIT-67/chequear-la-api-y-la-base-cada-30-minutos-y-guardar-los-resultados-en). La retención de 14 días limita la recuperación disponible; un artifact vencido no se reconstruye mediante un nuevo cálculo.

La recuperación requiere intervención humana y la selección explícita de un lote; no incluye búsqueda periódica de pendientes ni reintentos automáticos entre ejecuciones.

## Tests incluidos y conexión a CI

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

## Criterios de aceptación técnicos

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

## Fuera de alcance

* Modificar [PIT-67](https://linear.app/pitstop-austral/issue/PIT-67/chequear-la-api-y-la-base-cada-30-minutos-y-guardar-los-resultados-en) o su monitor, buscar periódicamente lotes pendientes y automatizar su recuperación entre ejecuciones. La recuperación manual explícita del workflow KPI sí está incluida.
* Implementar los cálculos de disponibilidad o GitHub y sus adaptadores.
* Registrar o automatizar el catálogo, crear evidencia de alertas o incorporar dashboards.
* Agregar otra base, cola, framework de tests o un package de workspace para los scripts.
* Recalcular para corregir mediciones ya aceptadas, modificar su valor o reparar cumplimiento retroactivo mediante reenvíos históricos.

## Referencias

* [Composite actions locales](<https://docs.github.com/en/actions/tutorials/create-actions/create-a-composite-action>).
* [Runner de pruebas de Node 24](<https://nodejs.org/docs/latest-v24.x/api/test.html>).
