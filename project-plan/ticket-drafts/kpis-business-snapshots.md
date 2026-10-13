# Calcular y persistir los cuatro KPIs de negocio de PIT-69

Borrador local actualizado al 13 de octubre de 2026. Pendiente de sincronización
con Linear; no afirma el estado actual del ticket externo.

PIT-69 conserva 5 SP: cálculo/persistencia 3 SP y acceso 2 SP, del 15 al 22 de
octubre. Las partes tienen una sola referencia al ticket padre.

## Implementación

Extender `KpisModule` y `KpisRepository` existentes de PIT-68. Usar
`createRunWithResults` para guardar atómicamente corrida y cuatro resultados;
no recrear modelos ni migración. Consultas de negocio en repositories.

| ID del ADR 02 | Cálculo |
| --- | --- |
| `preventive_rate` | Preventivos / mantenimientos de los 30 días × 100. Confirmar clasificación MANTENIMIENTO. |
| `alert_resolution_rate` | Alertas evaluables resueltas mediante servicio dentro de plazo / evaluables al corte × 100. |
| `service_users_30d` | Vehicle.ownerId distintos con servicios creados en los 30 días, por Maintenance.createdAt. |
| `active_vehicles_30d` | Maintenance.vehicleId distintos con servicios creados en esa ventana. |

Los porcentajes `vehicles_recent_maintenance_rate` y
`vehicles_prevention_configured_rate` del borrador anterior quedan reemplazados.
Sin denominador o evidencia, NO_DATA con valor null; un conteo real puede dar cero.
Persistir ventanas, conteos y versión. Sin evidencia de alertas, diagnóstico
`ALERT_RESOLUTION_EVIDENCE_MISSING`, sin activar ese indicador.

Acceso: `GET /internal/kpis/daily?date=YYYY-MM-DD`, conforme al ADR 02, protegido
por secreto de servicio independiente de Firebase. Fecha argentina cerrada y
ambiente del backend. Devuelve snapshot persistido, measurements y diagnostics,
sin datos personales. El GET puede crear otra corrida interna; la recuperación
externa usa el lote guardado en Actions y no vuelve a consultar la API.

No implementar POST de business-snapshots, endpoints por fuente ni ingesta de
sondeos/entrega. HTTP amplía después el servicio común de este GET.

## Aceptación

- Tres preventivos y dos correctivos producen 60%; sin denominador, NO_DATA.
- Un owner con servicios en varios vehículos cuenta una vez; cada vehículo cuenta
  una vez aunque tenga varios servicios. Consulta exitosa vacía produce cero.
- Ventana de 30 días argentinos y exclusión de registros posteriores al corte.
- Alertas sin evidencia producen el diagnóstico definido; con evidencia, probar
  servicio del tipo/ciclo correcto dentro y fuera del plazo.
- Guard, fechas, serialización BigInt, agregados seguros y fallo de BD probados.
- La persistencia falla sin dejar una corrida parcialmente guardada.

Detalle compartido de reglas, contratos y recuperación:
[kpis-implementation.md](kpis-implementation.md).

Fuera de alcance: publicación, catálogo, workflows, cálculo HTTP/sondeos/entrega
y construcción de evidencia de alertas. Los chequeos de API se ejecutan en el MVP
al implementar; esta revisión de planificación no los declara ejecutados.
