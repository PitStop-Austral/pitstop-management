# Registrar el estado HTTP y la latencia de cada request en la base de datos

## Contexto

PitStop guardará un registro por cada request HTTP observada por la API, con su resultado y el tiempo que tardó en responder. Estos datos permitirán calcular más adelante cuántas requests fallan y qué latencia tiene la API.

Hoy no existe una tabla con esa evidencia. Guardar únicamente errores no alcanza: también se necesita el total de requests para calcular la tasa de 5xx.

## Objetivo

Crear la tabla y el middleware que registran las requests, sin calcular ni publicar KPIs en esta tarea.

Referencia visual: no aplica, backend.

## Qué tiene que quedar andando

- Cada request observada deja un registro, tanto si termina con éxito como con error.
- Se guarda el código HTTP final y la duración hasta completar la respuesta.
- Una respuesta interrumpida se distingue de una respuesta completada.
- Los sondeos de salud también quedan registrados y se pueden identificar.
- Un fallo al guardar el registro no modifica el resultado de la operación original.
- Los registros no contienen credenciales ni datos personales.

## Por dónde empezar

1. Revisar `create-app.ts`, el adaptador Express y el acceso a Prisma existente.
2. Crear `HttpRequestLog` y su migración, con un repository para insertar registros.
3. Implementar el middleware y registrarlo globalmente antes de los componentes que puedan finalizar una request.
4. Agregar pruebas Jest de respuestas, interrupciones y fallos de persistencia.
5. Correr la API, comprobar las filas en la base y verificar la escritura en un despliegue de prueba de Vercel.

## Palabras que vas a ver

- **Middleware:** código que observa la request antes de que la procese la API.
- **Migración:** cambio versionado que crea la tabla en la base de datos.
- **Reloj monotónico:** mide tiempo transcurrido sin verse afectado por cambios de hora.
- **Ruta normalizada:** plantilla de endpoint sin los identificadores reales de la URL.

---

## Datos del ticket

- Épica local: KPIs.
- Feature: `kpis-request-logging`.
- Proyecto: [KPI Reporting](https://linear.app/pitstop-austral/project/kpi-reporting-d35bccd52250).
- Ticket: [PIT-66](https://linear.app/pitstop-austral/issue/PIT-66/registrar-el-estado-http-y-la-latencia-de-cada-request-en-la-base-de), en Backlog.
- Estimación: **3 SP**, equivalentes a 3 h con margen. Incluye tabla, captura del final de la respuesta y validación en Vercel.
- Etiquetas sugeridas: Backend y Feature.
- Dependencias nuevas: ninguna; Prisma y la API ya existen.
- Fecha y responsable: pendientes de revisar capacidad. No reemplazar automáticamente Fixes y carry.

## Alcance

- Modelo Prisma y migración para una tabla de requests HTTP.
- Middleware global que captura resultado y duración.
- Servicio y repository que persisten una fila por request.
- Tratamiento de respuestas interrumpidas y fallos de escritura.
- Pruebas de backend y documentación de cobertura.

## Backend

### Tabla de requests

Crear el modelo `HttpRequestLog` en `apps/api/prisma/models/http-request-log.prisma`, siguiendo la organización de modelos actual. Crear su migración dentro de `apps/api/prisma/migrations/` y regenerar el cliente Prisma.

| Campo | Tipo propuesto | Qué representa |
| --- | --- | --- |
| `id` | UUID, clave primaria | Identificador generado una vez por request; reutilizarlo si se reintenta la escritura. |
| `method` | String | Método HTTP observado. |
| `route` | String nullable | Plantilla del endpoint, por ejemplo `/vehicles/:vehicleId`; null si no se resolvió una ruta segura. |
| `startedAt` | Timestamp con zona | Momento UTC en que entra al middleware. |
| `endedAt` | Timestamp con zona | Momento UTC en que termina o se interrumpe la respuesta. |
| `durationMs` | Float | Tiempo transcurrido, finito y no negativo, medido con reloj monotónico. |
| `statusCode` | Int nullable | Código final para respuestas completadas; null si se interrumpió antes de completarse. |
| `outcome` | Enum `COMPLETED`, `ABORTED` | Distingue respuesta terminada de conexión interrumpida. |
| `trafficKind` | Enum `APPLICATION`, `HEALTH`, `REPORTING`, `UNMATCHED` | Permite filtrar tráfico operativo en cálculos posteriores. |

Índices propuestos: `startedAt` y el compuesto `trafficKind, startedAt`. No almacenar un booleano `is5xx`: se deriva de `statusCode`. No agregar relaciones con User o Vehicle. La tabla almacena metadatos, no el contenido completo de las requests.

### Middleware y registro global

El repo usa NestJS 11 con Express. Crear un módulo `RequestLoggingModule` en `apps/api/src/modules/request-logging/`, con `RequestLoggingMiddleware`, servicio y repository. El acceso a Prisma queda exclusivamente en el repository.

Implementar una clase `@Injectable()` que cumpla `NestMiddleware`. Para cubrir también respuestas que terminan antes del controller, resolver su instancia desde el contenedor de Nest y enlazar `use` como middleware global en `apps/api/src/create-app.ts`, antes de `app.init()` y antes de registrar middleware que pueda responder sin continuar. Conservar CORS, pipes y autenticación existentes; verificar el orden real durante la implementación.

Esta cobertura debe incluir la raíz, rutas anidadas, rutas inexistentes, errores de autenticación, validación y controlador. Probar también preflight CORS y JSON malformado: no asumir que un middleware aplicado únicamente a controllers los observa. La misma fábrica se utiliza localmente y desde `apps/api/api/index.ts` en Vercel.

Al entrar, generar el UUID, guardar el timestamp inicial y tomar el reloj monotónico. Instalar los listeners antes de llamar a `next()`; no esperar una escritura a la base antes de dejar avanzar la request.

- En `res.finish`, capturar el código HTTP definitivo, el final y la duración. Este evento indica finalización del envío del servidor; no mide tiempo de red hasta el navegador.
- En `res.close` sin finalización previa, registrar `ABORTED`; no interpretar el status por defecto 200 como respuesta exitosa.
- Compartir una única finalización por request y retirar listeners: `finish` seguido de `close` no debe insertar dos filas.
- Resolver la plantilla de ruta al finalizar. No guardar `originalUrl`, URL cruda ni query string como fallback. Para solicitudes sin ruta resuelta, usar `route=null` y `UNMATCHED`; identificar las rutas conocidas de health sin conservar parámetros.
- Conservar todas las requests observadas, incluidas health y reporting. Solo etiquetarlas; su exclusión de métricas pertenece a una tarea futura.

### Escritura y despliegue

Insertar una fila al finalizar la respuesta. La duración termina antes de la escritura de telemetría y no incluye esa operación. Capturar cualquier rechazo de persistencia y emitir un log estructurado mínimo, sin cuerpos ni credenciales; no lanzar una nueva excepción hacia una respuesta ya enviada.

En Vercel no dejar una promesa sin seguimiento después de responder. Integrar un mecanismo de ciclo de vida como `waitUntil` de `@vercel/functions`, registrando la promesa de finalización y escritura mientras la invocación está activa. Si se incorpora esa dependencia, documentarla en el AGENTS.md y la documentación del MVP. Probar también el flujo local, donde no existe contexto de Vercel.

El mecanismo sigue sujeto al timeout de la función. Una caída de la base o terminación de la instancia puede impedir registrar una request; documentar esa limitación y hacer visible el fallo. Esta tarea no incorpora una cola durable ni garantiza escritura ante indisponibilidad de Neon. Evitar reintentos ilimitados, buffers globales entre requests y almacenamiento en el disco efímero del runner.

## Criterios de aceptación técnicos

- La migración crea la tabla y los índices, y Prisma puede insertar y consultar registros.
- Requests 200, 201, 400, 401, 404 y 500 generan una única fila con su código final; un error del guard también queda registrado.
- Raíz, rutas anidadas, preflight CORS y JSON malformado tienen cobertura verificada.
- Un fixture con cinco requests completadas, dos de ellas 5xx, deja cinco filas y dos códigos 5xx; no se filtran los éxitos.
- Reloj inyectado: una request de prueba de 125 ms produce `durationMs=125`. No usar esperas reales para afirmar tiempos exactos en Jest.
- `finish` seguido de `close` no duplica; `close` prematuro genera `ABORTED` con status null.
- IDs de vehículo, query strings, Authorization, cookies, IP y cuerpos no aparecen en filas ni logs de telemetría.
- Fallar la inserción no cambia el status/body original y no produce un rechazo de promesa sin manejar.
- La escritura posterior a respuesta funciona en un despliegue de prueba de Vercel y se documenta la limitación ante timeout o caída de BD.
- Pasan formato, lint, tipos, build y tests de API aplicables; comprobar también `check-types:vercel` si cambia el entrypoint.
- Documentar campos, cobertura y semántica de latencia en `docs/kpis.md`. No agregar endpoints públicos para consultar la tabla.

## Fuera de alcance

Cálculo de porcentaje de 5xx, p95, agregados diarios, limpieza programada, dashboard, endpoints de KPIs, cron, integración GitHub y publicación en Lab4. La retención y el crecimiento de la tabla se resolverán antes de operación sostenida mediante una tarea posterior.

## Referencias

- [Middleware en NestJS](https://docs.nestjs.com/middleware).
- [Ciclo de una request en NestJS](https://docs.nestjs.com/faq/request-lifecycle).
- [Eventos de ServerResponse en Node.js](https://nodejs.org/api/http.html#class-httpserverresponse).
- [Escrituras posteriores a respuesta en Vercel](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#waituntil).
- ADR local: `project-plan/adr/ADR-KPIs-PitStop.md`.
