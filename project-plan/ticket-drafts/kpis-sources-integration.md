## Contexto

El cierre diario reunirá los indicadores de la API, la disponibilidad y las métricas de GitHub y comprobará que llegaron al receptor.

Los cálculos y la publicación se construyen en tareas distintas. Falta conectarlos y comprobar que un fallo o un reenvío conserve los mismos valores.

## Objetivo

Publicar y verificar las tres fuentes juntas, incluida la recuperación de un envío fallido.

**Referencia visual:** no aplica (infraestructura).

## Qué tiene que quedar andando

- Los indicadores de las tres fuentes participan del mismo cierre diario.
- Un fallo parcial queda visible y conserva los resultados válidos.
- El lote guardado se puede reenviar sin recalcular sus valores.
- Los valores recibidos coinciden con los resultados conservados.

## Por dónde empezar

1. Revisar el contrato y el workflow de PIT-71 junto con ambos scripts.
2. Conectar los recolectores antes de preparar el lote.
3. Agregar pruebas de errores parciales y recuperación.
4. Ejecutar el cierre conjunto en desarrollo y descargar lote y recibo.

## Palabras que vas a ver

- **Fragmento:** resultados de una fuente antes de armar el envío.
- **Lote:** conjunto definitivo de mediciones que se conserva y publica.
- **Recuperación:** reenvío del mismo lote guardado sin nuevos cálculos.

---

# Especificación técnica

## Datos del ticket

- Título: **Publicar disponibilidad y métricas de GitHub junto con los indicadores diarios**.
- Feature: `kpis-sources-integration`.
- Operación: crear un ticket nuevo.
- Proyecto: KPI Reporting. Estado: Backlog. Sin cycle.
- Semana: 2026-10-15 al 2026-10-22. Fecha límite: **2026-10-22**.
- Estimado: **3 SP (~3 horas)**; conservar el valor actual del plan.
- Responsable: **Ignacio Siaba**.
- Prioridad: **4 / Low**. Etiquetas: Fullstack, Feature.
- Depende de: PIT-71, PIT-72, PIT-74, PIT-73.
- Referencia de código: pitstop-app, commit `efca4dc`, checkout limpio revisado el 15 de octubre de 2026.

### Prerrequisitos y coordinación

La integración puede comenzar con fixtures tras PIT-71 y los dos scripts. La validación final del indicador de alertas requiere la tarea `kpis-alert-resolution`.

## Implementación

1. Conectar ambos recolectores antes de preparar y congelar el lote de PIT-71, usando los mismos `--date`, `--env` y `--output`. Habilitar `KPI_ENABLE_AVAILABILITY` y `KPI_ENABLE_DELIVERY` inicialmente en dev; mantener configuración independiente de prod.
2. Disponibilidad consume sondeos del ambiente seleccionado y conserva cobertura sobre los 48 horarios nominales. No sustituirlos por dos requests puntuales. GitHub entrega `ci_success_rate` (%) y `mean_time_to_merge` (h), sin integración con Linear.
3. Configurar owner/repositorio, workflow `ci.yml` y permisos de lectura de Actions y PRs. Reutilizar el token de GitHub si tiene acceso; documentar una credencial dedicada solo si resulta necesaria. Secretos por entorno, sin argumentos ni artifacts.
4. Conservar fragmentos, ventanas, versiones, referencias y diagnósticos. Validar fecha, ambiente, IDs y rangos con el contrato común; usar un único UUID de publicación y el mismo respaldo, POST y GET existentes.
5. Capturar el resultado de cada recolector y continuar hasta preparar, respaldar y publicar los READY válidos cuando el contrato permita publicación parcial. Conservar el error de origen y fallar al finalizar el job. Una validación global inválida o un respaldo fallido impide publicar; NO_DATA no se convierte en cero ni en mediciones nulas.
6. La rama recover usa únicamente el lote respaldado. No vuelve a consultar API, sondeos ni GitHub, aunque cambien los flags o los datos. Conservar payload exacto, UUID y evidencia por 14 días.

## Pruebas y criterios de aceptación

- Fixtures de las tres fuentes con los diez IDs vigentes, incluidos `ci_success_rate`, `mean_time_to_merge` y `alert_resolution_rate`; no usar el indicador retirado de tiempo hasta abrir una PR.
- Casos de NO_DATA, ERROR parcial, archivo habilitado ausente, fuente deshabilitada, ambiente cruzado, IDs duplicados y contrato global inválido. Verificar que un recolector fallido no oculte el diagnóstico ni impida publicar otros READY cuando corresponda.
- Ejecución manual dev con datos conocidos: API y ambos scripts → fragmentos → lote respaldado → POST → GET coincidente. Descargar origen, lote y recibo y comparar fecha, ambiente, UUID y valores.
- Tras integrar la tarea de alertas, incluir un ciclo enviado y resuelto en plazo en los datos conocidos y verificar su porcentaje desde la API hasta el receptor. Sin casos reales suficientes, informar NO_DATA sin presentar cobertura completa.
- Recuperar una publicación fallida y comprobar mismos bytes/UUID y cero invocaciones a los tres recolectores. Probar selección explícita de dev/prod sin publicar valores productivos como prueba.
- Tests del pipeline en `pnpm test:kpis` y comprobación real del YAML en Actions dev. Pruebas propias incluidas; PR aprobado y mergeado. Piloto y aceptación del MVP permanecen a cargo del otro equipo.

## Fuera de alcance

Implementar las fórmulas de las fuentes, recrear PIT-71, modificar PIT-67, registrar el catálogo o crear dashboards.
