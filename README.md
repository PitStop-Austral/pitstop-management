# PitStop Management

Editor local del plan de PitStop. Sirve para ordenar el backlog por prioridad y
escribir de que se trata cada funcionalidad, para despues pedirle a Claude Code que
cree los tickets de la semana en Linear.

**Materia:** Direccion de Proyectos 2026 — Austral Ingenieria

---

## Levantarlo

```bash
npm install
npm run dev
```

Abre <http://localhost:5180>. No hay backend aparte: un plugin de Vite lee y
escribe directamente los archivos de `project-plan/`.

## Que hay adentro

```
pitstop-management/
├── project-plan/
│   ├── features.yaml   El backlog: epicas, funcionalidades, prioridad y fechas
│   └── team.yaml       Equipo, capacidad, sprints y coordenadas de Linear
├── .claude/skills/     La skill que usa Claude Code para crear los tickets
├── server/plan-api.ts  Lectura y escritura de los yaml
└── src/                La app
```

Los dos yaml son la fuente de verdad. Se pueden leer y editar a mano, pero **la app
los reescribe enteros al guardar**, asi que los comentarios que agregues se pierden:
todo lo explicativo va en los campos `description` y `notes`.

## Las pestanas

**Backlog.** Las epicas y, dentro de cada una, sus funcionalidades. Se arrastran de
la manija de la izquierda para reordenarlas: **el orden es la prioridad**, y es el
que sigue Claude para elegir que entra en la semana. Al hacer click en una
funcionalidad se abre el panel de edicion.

Cada funcionalidad tiene ademas una **fecha de inicio y una de fin** estimadas, que son
las que dibuja el Cronograma. La fecha de fin es la fecha limite del ticket.

Lo que mas importa de cada funcionalidad es la **descripcion**: ahi se escribe *que*
tiene que pasar, en criollo. El *como* lo resuelve Claude leyendo esa descripcion y
mirando los archivos del prototipo que le indiques en "Referencias del prototipo".

Los estados siguen el mismo flujo que Linear:

| Estado | Que significa |
|---|---|
| Sin ticket | Todavia no se subio a Linear. Es lo unico que Claude planifica. |
| En Linear | El ticket ya existe (lo marca Claude al crearlo). |
| En curso | Alguien lo esta trabajando. |
| Terminado | Cumple la definicion de terminado. |
| Bloqueado | No se puede avanzar. |

**Cronograma.** La timeline estilo Gantt de todo el proyecto: sprints, epicas y
tickets sobre semanas de jueves a jueves. Se panea arrastrando el fondo y se hace zoom
con los botones. Cada epica tiene su color, asi se ve de un vistazo a cual pertenece
cada ticket. Al hacer click en un ticket se abre el mismo panel de edicion del Backlog,
con sus fechas: al cambiarlas, la barra se mueve sola.

La franja debajo de cada semana muestra los SP planificados contra los 18 de capacidad.
Lo que no entra antes del fin del ultimo sprint cae en una banda **Fuera de sprint** en
rojo: es la senal de que hay que recortar alcance o mover cosas de sprint.

**El margen de cada sprint es una epica**, no un porcentaje escondido: `Fixes y carry`
tiene dos tickets de 5 SP en la ultima semana del sprint para arreglar lo que aparecio y
terminar lo que se alargo. Son dos y no uno para que dos personas puedan tomar arreglos
en paralelo sin pisarse. Se ve en el Backlog como cualquier otra epica y en el cronograma con
la barra rayada. Cuando llega esa semana, ese ticket generico se reemplaza por los
arreglos concretos que hayan salido.

Al apretar una semana se abre a la derecha la **lista de sus tickets**, agrupados por
epica, con estado, prioridad y SP contra la capacidad. Desde ahi se entra al detalle de
cualquiera y se vuelve con "Volver a la semana".

Las flechas punteadas son las dependencias. Por defecto se ven solo las del ticket
seleccionado; el check "Todas las dependencias" muestra el resto.

Una dependencia empuja el ticket hacia adelante, pero **no obliga a saltear la semana**:
lo ideal es que el bloqueante termine antes, y cuando no se puede, los dos van en la
misma semana y a la misma persona. Cuando eso pasa, la flecha se dibuja vertical entre
las dos barras y el panel de la semana lo avisa con un "va con...", que es lo que hay
que mirar al repartir los tickets.

El reparto ademas **empareja cada sprint**: en vez de amontonar todo lo antes posible y
dejar la ultima semana vacia, apunta a que todas las semanas del sprint lleven una carga
parecida.

**Recalcular fechas** vuelve a repartir todas las funcionalidades segun prioridad,
dependencias y capacidad. Pide confirmacion porque **pisa las fechas ajustadas a mano**.

**Semana.** Muestra la semana a planificar (de jueves a jueves), a que sprint
pertenece, la capacidad disponible y las proximas funcionalidades de la fila. Tiene
el prompt listo para copiar y pegarle a Claude Code.

**Equipo.** Quien toma tickets y cuantos SP por semana. Solo los tres devs de Lab2
reciben tickets de desarrollo. Si a alguien le falta el `linear_user_id`, sus
tickets se crean sin asignar.

**Sprints.** Fechas, tema, cycle de Linear y cuantos SP hay estimados contra la
capacidad de cada sprint.

## Como se crean los tickets

1. Ordena el backlog y completa las descripciones de lo que viene.
2. Anda a la pestana **Semana** y copia el prompt.
3. Pegaselo a Claude Code parado en esta carpeta.
4. Claude muestra el reparto propuesto con los SP de cada dev. Recien despues de que
   lo confirmes crea los tickets en Linear.

## Como trabaja el equipo

- **Semanas de jueves a jueves.** Los tickets se cargan antes del jueves de
  arranque y vencen el jueves siguiente.
- **Margen por sprint.** La ultima semana de cada sprint tiene los dos tickets de la
  epica `Fixes y carry` (10 SP) para lo que haya que arreglar o terminar.
- **1 story point = 1 hora estimada con margen**, en escala de 1 a 5. Se estima
  cuanto le lleva a un estudiante de 3er año usando Claude Code y se redondea para
  arriba: los 6 SP semanales deberian resolverse en 4 o 4,5 horas reales, y el
  resto queda como colchon. Entre los tres devs, 18 SP por semana.
- **Tickets fullstack.** Cada ticket es una vertical completa (Prisma, endpoint de
  Nest y pantalla de Vite) para que nadie quede esperando el backend o el frontend
  de otro.
- **Sin bloqueos entre tickets de la misma semana.** Cuando no hay forma de
  evitarlo, los dos tickets van a la misma persona.
- **shadcn primero.** Los componentes parten del de shadcn cuando existe y se
  adaptan a la identidad del prototipo. Cada uno se resuelve en su version web y en
  su version mobile.

## El stack del MVP

Ojo con no confundir tres cosas distintas:

| | Que es | Stack |
|---|---|---|
| `../PitStop Prototype/` | La referencia visual, con datos mock | Next.js |
| El MVP | Lo que hay que construir | Vite + React Router, NestJS + Prisma, Neon, Firebase, Vercel |
| Esta app | La herramienta de planificacion | Vite + React |

El prototipo define **el comportamiento**; la implementacion se traduce al stack del
MVP.
