# Chequear la API y la base cada 30 minutos y guardar los resultados en GitHub

## Contexto

PitStop tendrá un proceso externo que compruebe periódicamente si la API responde y si puede acceder a la base de datos. Cada ejecución conservará los dos resultados en un archivo descargable desde GitHub.

Los endpoints de salud ya existen. Falta ejecutarlos automáticamente y guardar evidencia, incluso cuando la API no responda.

## Objetivo

Ejecutar ambos chequeos cada 30 minutos con GitHub Actions y guardar sus resultados como artifact de cada corrida.

Referencia visual: no aplica, infraestructura.

## Qué tiene que quedar andando

- Cada ejecución realiza los dos chequeos, aunque uno falle.
- Se puede descargar un archivo con ambos resultados y sus fechas.
- Los fallos HTTP, de conexión y de timeout quedan registrados.
- El workflow también puede ejecutarse manualmente.
- Una falla de salud deja evidencia antes de marcar la ejecución como fallida.

## Por dónde empezar

1. Revisar los endpoints de health y la configuración actual de Actions.
2. Crear un script que haga ambos chequeos y genere el JSON.
3. Configurar el horario y la carga del artifact en el workflow.
4. Probar éxitos, errores y timeout con respuestas controladas.
5. Ejecutar el workflow manualmente y descargar el artifact para comprobar su contenido.

## Palabras que vas a ver

- **Artifact:** archivo conservado por GitHub junto a una ejecución del workflow.
- **Timeout:** límite de tiempo para esperar la respuesta de un chequeo.
- **Cron:** expresión que indica cuándo debe ejecutarse el workflow.

---

## Datos del ticket

- Épica: KPIs. Proyecto de Linear: KPI Reporting.
- Feature: `kpis-health-monitor`.
- Ticket: [PIT-67](https://linear.app/pitstop-austral/issue/PIT-67/chequear-la-api-y-la-base-cada-30-minutos-y-guardar-los-resultados-en), en Backlog.
- Estimación: **2 SP**, equivalentes a 2 h con margen.
- Etiquetas sugeridas: Infra y Feature.
- Dependencias nuevas: ninguna. `/health` y `/health/db` ya existen; no depende de PIT-66.
- Responsable y fechas: pendientes de asignación.

## Implementación

### Chequeos

Crear `.github/workflows/kpi-health-monitor.yml` y un script bajo `scripts/kpis/` en `pitstop-app`. Mantener el script ejecutable localmente y separar la captura de resultados de la decisión final de éxito o fallo.

Configurar la URL base mediante una variable de Actions, por ejemplo `PITSTOP_API_BASE_URL`. No conectar directamente a Neon ni agregar credenciales de base. Los endpoints actuales son públicos; si el despliegue tiene protección adicional, sus credenciales se guardan en Secrets y nunca en el artifact.

| Objetivo | Request | Condición de éxito |
| --- | --- | --- |
| API | `GET /health` | HTTP 200 y JSON con `status="ok"`. |
| Acceso a BD | `GET /health/db` | HTTP 200 y JSON con `database="up"`. |

Hacer una request por objetivo, con timeout de 15 segundos. Capturar errores por separado: un rechazo del primer chequeo no impide ejecutar el segundo. No reintentar dentro del sondeo, porque ocultaría su resultado inicial. Un 200 con JSON inválido o contenido inesperado se registra como fallo.

`/health/db` comprueba la conexión de PitStop a la base mediante `SELECT 1` y responde 503 ante fallo. Si no se puede llegar a la API, el chequeo de BD también puede fallar sin demostrar que Neon esté caído. El artifact representa los resultados observados, no un diagnóstico independiente de la base.

### Workflow y horario

- Trigger `schedule` con cron `*/30 * * * *` en UTC; minutos 00 y 30.
- Agregar `workflow_dispatch` para pruebas y recuperación manual.
- Ejecutar en un runner de GitHub y conservar un límite de 5 minutos para el job.
- Permisos mínimos: `contents: read` para checkout; usar el mecanismo de artifacts de Actions para cargar archivos.
- Reutilizar las convenciones de CI existentes y fijar versiones verificadas de las actions.
- El workflow debe estar en la rama predeterminada. Documentar que GitHub puede retrasar o perder ejecuciones; no crear muestras ficticias para una corrida ausente.

### Artifact

Generar un único `health-checks.json` por corrida, con ambos resultados. Campos mínimos:

```json
{
  "schemaVersion": 1,
  "env": "prod",
  "eventName": "schedule",
  "runId": "123456789",
  "runAttempt": 1,
  "checks": [
    {
      "target": "api",
      "checkedAt": "2026-10-08T21:00:00.000Z",
      "httpStatus": 200,
      "ok": true,
      "errorKind": null
    },
    {
      "target": "db",
      "checkedAt": "2026-10-08T21:00:01.000Z",
      "httpStatus": 503,
      "ok": false,
      "errorKind": "http_error"
    }
  ]
}
```

Guardar `env` desde la configuración y `eventName` (schedule/workflow_dispatch)
para aislar ambientes e identificar sondeos manuales al calcular cobertura.
Usar el timestamp UTC real de cada chequeo. `httpStatus=null` cuando no hay respuesta HTTP. Valores de `errorKind`: `http_error`, `timeout`, `connection_error`, `invalid_response` o null. No copiar mensajes crudos de transporte, cuerpos, headers ni secretos al JSON.

Cargar el archivo con `actions/upload-artifact`, con nombre único `kpi-health-<runId>-<runAttempt>` y `retention-days: 14`. Configurar la carga para ejecutarse aunque el paso de chequeos termine con error; fallar si el archivo esperado no existe. Después de preservar la evidencia, marcar el job fallido si algún chequeo falló. No dejar que el manejo de errores muestre un resultado verde cuando la API o el acceso a BD no respondió.

Una cancelación forzada o un runner que no llegó a ejecutar el script puede impedir generar el artifact. No tratar esa ausencia como resultado de un chequeo.

## Criterios de aceptación técnicos

- Ejecución manual exitosa: un artifact contiene exactamente dos chequeos con su fecha UTC real.
- API fallida y BD exitosa, o a la inversa: se conservan ambos resultados y el job falla después de cargar evidencia.
- HTTP 503, timeout, fallo de conexión y 200 con JSON inválido producen el diagnóstico correspondiente.
- Un reintento de la corrida tiene un nombre de artifact distinto mediante `runAttempt`.
- El artifact se conserva 14 días y no contiene credenciales ni datos sensibles.
- Evidencia de descarga y lectura del JSON desde Actions; verificar también una ejecución programada una vez integrado el workflow en la rama predeterminada.
- Pasan los chequeos de formato y las pruebas acotadas del script, reutilizando herramientas existentes.
- `docs/kpis.md` explica configuración, horario, formato y limitaciones del monitor.

## Fuera de alcance

Modificar los endpoints health, registrar muestras en la base, calcular porcentajes de disponibilidad, agrupar muestras por día, reporting de negocio, publicación en Lab4 y notificaciones externas de incidentes.

## Referencias

- [Schedule en GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
- [Conservar archivos como artifacts](https://docs.github.com/en/actions/tutorials/store-and-share-data).
- Código existente: `apps/api/src/modules/health/health.controller.ts`, `health.service.ts` y `health.repository.ts`.
