# Implementación simple de KPI Reporting

Revisión local del 13 de octubre de 2026. Fuente funcional: ADR 02 y TEAM_GUIDE
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

## Estado comprobado del MVP después del pull

- Existen `apps/api/prisma/models/kpi.prisma`, la migración
  `20261013184155_add_kpi_persistence` y `test/kpis.db-spec.ts`.
- `KpisModule` exporta `KpisRepository`, con `createRunWithResults` atómico y
  `findRunById`. Reutilizar estas piezas. No recrear PIT-68.
- El esquema permite varias corridas por fecha/ambiente y detecta UUID duplicado;
  todavía no hay controller ni servicio de cálculo en ese módulo.
- `Maintenance` tiene `date`, `createdAt`, `vehicleId` y categorías
  `MANTENIMIENTO`/`ARREGLO`; `Vehicle` tiene `ownerId`.
- Existen `/health` y `/health/db`. En este checkout no aparecen registros HTTP,
  workflow de sondeos ni evidencia persistida de alertas enviadas/resueltas.
  Revisar ramas de PIT-66/67/63 al integrar, sin asumir que el plan demuestra código.

## Responsabilidad de documentación y validación

Otro equipo realiza la documentación, validación integrada, piloto y comprobación
final de recepción, incluidos flujos del MVP y push/PWA. Estas actividades no
tienen tickets ni SP en este backlog de implementación. Se conservan las pruebas
propias y los controles funcionales de cada cambio, incluida la verificación GET
que usa el cliente para confirmar una publicación.

## Límites y aceptación por tarea

| Tarea | Implementación concreta | Evidencia de cierre |
| --- | --- | --- |
| PIT-66, 3 SP históricos | Registrar requests y finalización; conservar tráfico identificable y duraciones completas. | Una fila por request; interrupciones y fallo de escritura probados, incluida cobertura en Vercel. |
| PIT-67, 2 SP históricos | Dos sondeos por corrida cada 30 minutos, artifact incluso ante fallos, retención 14 días. | JSON descargable con timestamps reales y ambos resultados. |
| PIT-68, 3 SP históricos | Ya implementado: tablas y repository de corridas/resultados. | Reutilizar migración y pruebas existentes; no volver a planificar su construcción. |
| Negocio, parte de PIT-69, 3 SP | Servicio de cuatro fórmulas y consultas por repository; persistencia existente. | Fixture 60%, usuarios/vehículos distintos, cero real, NO_DATA y límites temporales. |
| Endpoint, parte de PIT-69, 2 SP | Un GET diario protegido; llama al servicio y serializa agregados/diagnósticos. | 400 fecha, 401 secreto, 503 fuente no disponible y respuesta sin datos personales. |
| Evidencia de alertas, 3 SP | Completar datos que PIT-63 no guarda; vincular ciclo, envío efectivo, plazo y servicio del mismo vehículo/tipo. | Un ciclo cuenta una vez; servicio dentro/fuera de plazo, envío fallido y sin resolución. |
| HTTP diario, 3 SP | Extender servicio y resultados del GET común con error rate y p95. | Conjunto COMPLETED de aplicación, filtros, 5xx, nearest-rank y sin muestras. |
| Sondeos diarios, 2 SP | Agregador puro del runner desde artifacts, sin envío de muestras a API. | Día argentino, deduplicación, paginación, faltantes y cobertura auditables. |
| Publicación, 2 SP | Cliente de mediciones y verificación GET; catálogo previamente registrado. | Payload exacto, rechazo visible, reintento idéntico y conflicto con valor previo detectado. |
| Workflows, 2 SP | Extender monitor para reintentos; segundo workflow para preparar cierre a 04:00 UTC. | Respaldo antes del envío, manual por fecha y recuperación del mismo lote tras fallo. |
| Fuente de entrega, 4 SP | Adaptadores de lectura del runner; historial verificable y referencias PIT-XX. | Paginación, primera transición/PR, varias PRs y falta de historial. |
| Cálculo de entrega, 2 SP | Agregadores del runner sobre evidencia, con ventana y diagnósticos. | Horas fraccionarias, fechas de selección y casos sin evidencia. |

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

Cuatro semanas de 18 SP: 72 SP planificados. El núcleo de KPIs conserva 17 SP,
con 1 SP de reserva de fixes/carry del 15 al 22 de octubre. KPI Reporting suma
31 SP (23 en Sprint 3 y 8 históricos); PIT-69 conserva 5 SP.

Las fechas de Perfil y deseos se adelantan sin ampliar sus 12 y 11 SP. Los 12 SP
antes libres se presupuestan como reserva explícita de fixes/carry: 1 en la primera
semana, 5 en la tercera y 6 adicionales en la última. Las reservas totales son
22 SP, incluyendo los 10 anteriores; no son nuevas funcionalidades ni trabajo
consumido. Documentación y validación integrada siguen fuera del backlog.

Las fechas y estimaciones son planificación, no evidencia de viabilidad. La semana
del núcleo tiene dependencias internas: coordinar contrato API y formato de artifacts
al comenzar, repartir las tres cadenas API, monitor/agregación y cliente/workflows,
y entregar el núcleo antes del 22 para que el otro equipo lo valide. El trabajo de alertas puede avanzar con
NO_DATA en negocio; el scheduler no depende de él para publicar otras fuentes.
