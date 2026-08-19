---
name: pitstop-sync-linear
description: Sincroniza los tickets de Linear del team PIT con el backlog local de PitStop (project-plan/features.yaml y team.yaml), en las dos direcciones. Usar SIEMPRE que se toque algo de un ticket — crear, renombrar, reestimar, cambiar la fecha, empezarlo, terminarlo, cancelarlo, moverlo de project — y tambien cuando se edite una funcionalidad del plan que ya tiene ticket. Usar ademas cuando el usuario pida revisar si el plan y Linear estan al dia, diga que algo quedo desactualizado, pregunte en que estado esta el sprint, o antes de planificar la semana. Ante la duda de si hace falta sincronizar, correr el chequeo: es barato y detecta desvios que despues salen caros.
---

# PitStop — Sincronizar Linear con el plan

`project-plan/features.yaml` es lo que el PM ve desde la app: el backlog, el
cronograma y el avance del sprint. Linear es donde el trabajo pasa de verdad. Los dos
tienen que contar lo mismo, porque el PM planifica la semana siguiente mirando el plan.
Un ticket que cambio en Linear y no se reflejo deja al PM decidiendo sobre datos
viejos, y un cambio en el plan que no bajo a Linear deja al dev haciendo otra cosa.

Esta skill cierra ese circuito. No es un backup ni un import: es una **reconciliacion**
que compara los dos lados, muestra las diferencias y las resuelve una por una.

## Coordenadas

- Backlog local: `project-plan/features.yaml` — epicas (`epics`) con sus
  funcionalidades (`features`).
- Equipo y sprints: `project-plan/team.yaml` — `sprints[].linear_projects`, ids de
  Linear, gente y capacidad.
- Linear: servidor MCP `73fb21e2-edf7-4f5a-9087-7c11a7c50efa` (workspace
  `pitstop-austral`, team `PIT`). **No** es el servidor de Linear default; esta
  anotado en `team.yaml` bajo `linear.mcp_server`.

Los dos yaml los reescribe entera la app al guardar, asi que se editan con las
herramientas de archivos y **sin agregar comentarios**: todo lo explicativo va en los
campos `description` y `notes`.

## El flujo

### 1. Traer el estado real de Linear

```
list_issues  team=PIT  limit=250
             fields=["id","title","status","estimate","project","dueDate","assignee","priority","labels"]
list_projects team=PIT fields=["id","name","status","startDate","targetDate"]
```

Guardar las dos respuestas juntas en un solo archivo del scratchpad, con esta forma:

```json
{ "issues": [ ... ], "projects": [ ... ] }
```

### 2. Correr la reconciliacion

```bash
node .claude/skills/pitstop-sync-linear/scripts/reconcile.mjs \
  --linear <dump.json> --escala-vieja capacitacion
```

Sale un listado de diferencias agrupadas por gravedad, cada una con que esta mal y
como se arregla. Devuelve 0 si esta todo sincronizado y 1 si encontro algo, asi que
sirve tambien como chequeo rapido.

`--escala-vieja capacitacion` saltea la comparacion de estimaciones y titulos de esa
epica: la Capacitacion quedo con la escala vieja de 1 y 2 puntos y con tickets
partidos en `[BE]` y `[FE]`, asi que ahi los numeros no tienen por que coincidir. Los
estados y los huerfanos si se comparan igual.

El script hace la parte mecanica —encontrar las diferencias— pero **no decide nada**.
Decidir de que lado esta la verdad es tu trabajo, y para eso esta la tabla de abajo.

### 3. Resolver cada diferencia

Antes de escribir nada, mostrar al usuario la lista de diferencias con lo que proponés
hacer en cada una, y esperar. Hay una excepcion: si el usuario ya dijo que cambio algo
concreto ("mové PIT-30 a in progress", "le subi la estimacion a PIT-31"), eso no se
vuelve a preguntar — se aplica y se avisa.

### 4. Aplicar y verificar

Aplicar los cambios de los dos lados, y despues volver a correr el script. Tiene que
salir limpio. Si algo sigue apareciendo, es que el arreglo no fue el correcto.

## De que lado esta la verdad

La pregunta de fondo en cada diferencia es cual de los dos lados tiene razon. No es
siempre el mismo:

| Campo | Manda | Por que |
|---|---|---|
| `status` de la funcionalidad | **Linear** | Refleja lo que el dev realmente hizo. El plan lo copia, nunca al reves |
| `assignee` | **Linear** | El reparto puede cambiar durante la semana |
| Existencia del ticket (`ticket_refs`) | **Linear** | Si el ticket no esta, la funcionalidad no esta en backlog |
| Orden de epicas y funcionalidades | **el plan** | Es la prioridad que fijo el PM desde la app |
| `moscow`, alcance, `out_of_scope` | **el plan** | Decisiones de producto, no de ejecucion |
| Que epica agrupa que funcionalidad | **el plan** | Linear solo tiene projects planos |
| `estimate` | **el ultimo que cambio** | Si no se sabe cual fue, preguntar: reestimar tiene efecto sobre la capacidad de la semana |
| `title` y `description` | **el ultimo que cambio** | Idem. Un titulo distinto suele significar que el alcance se movio |
| Fechas (`ends` ↔ `dueDate`) | **Linear** | La `dueDate` es lo que el dev ve; el cronograma se ajusta a eso |
| Fechas del project | **el plan** | Salen de las fechas de las funcionalidades de la epica |

Cuando el usuario dice explicitamente que acaba de cambiar un lado, ese lado manda,
sin importar la tabla.

## Como sale el `status` de sus tickets

Una funcionalidad puede tener varios tickets. Su estado sale de mirarlos todos,
ignorando los cancelados:

- sin tickets vivos → `todo`
- todos terminados → `done`
- alguno empezado o terminado → `in_progress`
- todos sin arrancar → `backlog`

`blocked` es la excepcion: lo pone una persona porque algo externo la traba, y Linear
no lo representa. El script no lo pisa y vos tampoco.

Ojo con `done`: en Linear alcanza con mover el ticket, pero la definicion de terminado
del equipo esta en `team.yaml` (rama, PR aprobado y mergeado, build limpio, probado
corriendo la app). Si un ticket figura Done y es evidente que no la cumple, decirlo en
vez de copiarlo callado.

## Los dos errores que mas aparecen

**Ticket huerfano**: existe en Linear y ninguna funcionalidad lo referencia. Casi
siempre es un ticket creado a mano desde la UI. Hay que encontrarle su funcionalidad y
agregarlo a `ticket_refs`; si de verdad no corresponde a ninguna, es que al plan le
falta esa funcionalidad y hay que escribirla, no borrar el ticket.

**Ref colgante**: `ticket_refs` nombra un PIT-XX que ya no existe. Si se borro a
proposito, se saca de la lista y la funcionalidad vuelve a `todo`. Si se borro por
error, se vuelve a crear el ticket.

## Que no se toca nunca

- **PIT-1 a PIT-4**: los issues de ejemplo que Linear crea con el workspace. El script
  ya los ignora.
- **Los cancelados**: PIT-6 y PIT-12 quedaron cancelados a proposito. Un cancelado sale
  de `ticket_refs` pero no se revive ni se recicla.
- **`out_of_scope`**: si aparece un ticket sobre algo que esta ahi, no se agrega al
  plan — se avisa, porque probablemente el ticket este de mas.
- **Los ids de Linear de `team.yaml`** (`team_id`, `cycle_id`, `linear_user_id`): estan
  verificados. Si uno no resuelve, avisar antes de cambiarlo.

## Escribir de cada lado

**En el plan** (`features.yaml`): `status`, `ticket_refs`, `estimate`, `title`,
`description`, `starts`, `ends`, `depends_on`, y el `linear_project` de la epica. Con
las herramientas de archivos, sin comentarios.

**En Linear**: `save_issue` para los tickets y `save_project` para las fechas y el
nombre de un project. Dos cosas de la convencion del equipo que conviene no romper al
actualizar:

- Los tickets de la semana viven en estado `Backlog` y **sin cycle**. Linear no permite
  las dos cosas a la vez: si se manda `cycle`, el ticket sale del Backlog. El sprint se
  identifica por el project y por la `dueDate`.
- Ningun ticket queda sin `project` ni sin `priority`.

Si al terminar quedaron funcionalidades nuevas sin ticket, no crearlos aca: eso lo hace
la skill `pitstop-create-linear-tickets`, que sabe repartir la semana y escribir el
cuerpo del ticket. Esta skill sincroniza lo que ya existe.

## Que informar al final

Un resumen corto y concreto: que se cambio en el plan, que se cambio en Linear, y que
quedo pendiente de una decision del PM. Si el script sale limpio, decirlo en una linea
y no inventar trabajo.
