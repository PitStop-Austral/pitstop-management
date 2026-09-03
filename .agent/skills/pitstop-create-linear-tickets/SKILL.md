---
name: pitstop-create-linear-tickets
description: Convierte las funcionalidades del backlog de PitStop en los tickets de Linear de una semana. Usar cuando el usuario pide armar, planificar o cargar los tickets de la semana o de una epica en Linear, planificar el sprint, o repartir el trabajo entre los devs de Lab2.
---

# PitStop — Crear tickets de Linear

Convierte las funcionalidades priorizadas por el PM en un set realista de tickets
semanales para los tres desarrolladores de PitStop.

## Fuentes de verdad

Revisar antes de planificar:

- `project-plan/features.yaml` — el backlog: epicas y funcionalidades en orden de
  prioridad, con titulo y descripcion escritos por el PM desde la app.
- `project-plan/team.yaml` — equipo, roles, capacidad, semanas, ids de Linear,
  stack y coordenadas del repo.
- `project-plan/design-system.md` — **los colores, las tipografias y los estilos de
  PitStop**. Todo ticket que toque la UI describe lo visual con los nombres de ahi:
  tokens de color (`primary`, `muted-foreground`, `border`), variantes de `Text`
  (`title`, `body`, `caption-strong`), tamanos de `Icon` y radios. Nunca con
  hexadecimales sueltos ni con clases de Tailwind inventadas en el momento.
- `../CLAUDE.md` — el project charter: objetivo, alcance, fuera de alcance, KPIs.
- `../PitStop Prototype/` — **especificacion de la UI**, no la implementacion.
- `../capacitacion/APP-CONTEXT.md` — convenciones de codigo y reglas de trabajo
  con desarrolladores junior.
- `../pitstop-stack/` — **el template de repo** (`project.repos.template` en
  `team.yaml`). El MVP no se arma desde cero: se crea desde ahi con `create-turbo`.
  Antes de escribir cualquier ticket de infraestructura o de setup, abrir el template
  y ver que trae ya — package.json de la raiz y de cada app, `turbo.json`, la config
  de lint y formato, `.github/` y `docs/`. **Nunca pedir trabajo que el template ya
  resuelve**, y nunca proponer una herramienta distinta a la que el template usa.
  (`../changuito/` es una copia del mismo template, la que se uso en la capacitacion.)
- **Linear** — trabajo existente, estado, asignados, puntos y duplicados.

> El workspace de PitStop es el servidor MCP `73fb21e2-edf7-4f5a-9087-7c11a7c50efa`
> (workspace `pitstop-austral`, team `PIT`), **no** el servidor de Linear default.
> Esta en `team.yaml` bajo `linear.mcp_server`.

Nunca crear tickets para trabajo ya terminado ni ya cubierto por un ticket existente.

## El backlog

`features.yaml` tiene **epicas** (`epics`) y dentro de cada una sus
**funcionalidades** (`features`).

**El orden de los arrays es el orden de prioridad que fijo el PM.** Se respeta:
para llenar la semana se avanza de arriba hacia abajo, primero por epicas y dentro
de cada epica por funcionalidades. No reordenar por conveniencia; si hay un motivo
tecnico para alterar el orden, decirlo y esperar confirmacion.

Los estados siguen el mismo flujo que Linear:

`todo` (sin ticket) → `backlog` (ticket creado) → `in_progress` → `done`, mas `blocked`.

- Solo se planifican funcionalidades en `todo`.
- `backlog` significa que el ticket **ya se subio a Linear**: no se duplica. Lo
  mismo si tiene `ticket_refs`.
- Para `in_progress`, cruzar contra Linear antes de crear mas trabajo.
- Nunca crear trabajo para funcionalidades `done`.
- Una funcionalidad `blocked` no se planifica: se reporta que la bloquea.
- Las epicas con `moscow: could` estan **fuera del MVP**: solo se planifican si el
  usuario lo pide explicitamente porque sobro tiempo.
- Nunca generar tickets para nada de `out_of_scope`.

### La descripcion es el input principal del ticket

La `description` que escribio el PM dice **que** tiene que pasar. El **como** lo
escribis vos:

1. Leer la descripcion y el titulo.
2. Abrir todos los archivos listados en `prototype` y ver como esta resuelto ahi:
   campos del formulario, validaciones, estados vacios, reglas de negocio,
   comportamiento responsive.
3. Traducir eso al stack real y escribirlo en el ticket: modelo de Prisma,
   endpoints de Nest, componentes de React, hooks, rutas.

> **Los archivos del prototipo son para vos, no para el ticket.** Los devs no tienen
> el codigo del prototipo: solo lo ven corriendo. Por eso **ningun ticket nombra un
> archivo del prototipo** — ni en la referencia visual, ni en las notas de frontend,
> ni en las de componentes. Lo que viste en el codigo se escribe como valores y
> comportamiento concretos: los colores en hexadecimal, los radios en pixeles, los
> breakpoints, las validaciones, que pasa al tocar cada cosa. Un dev tiene que poder
> hacer el ticket con la pantalla del prototipo abierta al lado y nada mas.
>
> La `Referencia visual` nombra **la pantalla del prototipo funcionando** y como se
> llega a ella (por ejemplo "pantalla de Garage, solapa Informacion"). El PM le
> adjunta la captura al ticket despues, y le conviene hacerlo **como adjunto o como
> comentario del issue, no pegandola adentro de la descripcion**: cualquier edicion
> posterior del cuerpo se la puede llevar puesta, y Linear no permite recuperarla.

> **El prototipo es Next.js; el MVP es Vite + TanStack Router.** El comportamiento se
> copia tal cual, la implementacion se traduce: nada de `next/font`, `next/image` ni
> Server Components. El ruteo si es file-based, porque asi funciona TanStack Router.
> El stack esta fijado en `team.yaml`; si algo parece pedir una dependencia de
> `project.forbidden_dependencies`, replantear el alcance en vez de instalarla.

Si una funcionalidad no tiene descripcion, avisarlo antes de escribir el ticket:
va a salir generico y es mejor que el PM la complete.

Lo mismo si una funcionalidad **tiene UI y su `prototype` esta vacio**: sin esos
archivos no hay forma de saber donde vive la pantalla ni de donde se llega a ella, y
el ticket termina inventando una decision de producto. Reportarlo y esperar, igual
que con la descripcion faltante. Dos excepciones: las funcionalidades sin UI —
infraestructura, deploy y backend puro — donde `prototype: []` es lo correcto y la
`Referencia visual` va como `no aplica`; y las pantallas que el prototipo no tiene,
cuando la descripcion ya dice donde aparecen y como se comportan.

Si la descripcion nombra explicitamente donde vive la pantalla, esa es la ubicacion
buena aunque el prototipo diga otra cosa: el prototipo tiene pantallas que quedaron
sin conectar y botones que navegan a cualquier lado.

### Componentes: shadcn primero

Si el componente existe en shadcn, **se parte de ahi** y se lo adapta a los tokens
y al comportamiento del prototipo. Solo se escribe desde cero lo que shadcn no
tiene: la hoja inferior con arrastre, el odometro, el selector de servicios con
iconos y las tarjetas de mantenimiento.

El ticket tiene que nombrar los componentes de shadcn que se usan y decir que hay
que adaptarles (radios, colores de marca, tipografia, tamano de los targets).

Ademas, **por cada componente que el ticket pida crear o modificar hay que decir que
usa**, con los nombres de `design-system.md`: los tokens de fondo y de borde (con su
hover), el color y la variante de `Text` de cada texto de adentro, los iconos de lucide
con su tamano, el radio y la sombra. Un ticket que dice "una tarjeta con el nombre del
vehiculo" esta incompleto; uno que dice "tarjeta `bg-card` con borde `border`,
`rounded-xl`, `shadow-sm` que pasa a `shadow-md` en hover, nombre del vehiculo en
variante `card-title` color `default` y la patente en `caption` color `muted`" esta
completo.

Todo eso vive en la seccion `## Componentes` del bloque tecnico del ticket, nunca
arriba del separador: son valores exactos y arriba del separador no van valores.

Dos reglas de codigo que valen para toda la app y que los criterios de aceptacion
pueden dar por sabidas: **todo texto va dentro de `<Text variant=... color=...>`** y
**todo icono dentro de `<Icon name=... size=... color=...>`**. No se escriben `<p>`,
`<span>` ni headings sueltos, ni se pasan colores o tamanos de texto con clases de
Tailwind. Los dos componentes salen del ticket del design system.

### Web y mobile, siempre

Todo ticket de frontend define el comportamiento en las dos resoluciones, porque
varios componentes cambian de forma:

- Formularios: hoja inferior a pantalla completa en mobile, modal centrado en desktop.
- Navegacion: barra inferior flotante en mobile, sidebar en desktop.
- Listas: una columna en mobile, dos o grilla en desktop.
- La accion principal de un formulario largo queda siempre visible en mobile.

Las dos resoluciones se cubren en las dos listas de criterios, cada una a su manera:
en "Que tiene que quedar andando" con una frase en castellano y sin numeros ("el
formulario abre pegado abajo en el celular y como ventana centrada en la compu"), y en
"Criterios de aceptacion tecnicos" con el breakpoint exacto y lo que cambia a cada lado.

## Analisis previo

**Que exista en el prototipo no significa que este implementado.**

1. Si `project.repos.monorepo.local_path` en `team.yaml` es `null`, el repo real
   todavia no existe: todo el prototipo cuenta como no implementado y la unica
   verdad de lo hecho es Linear mas los estados del backlog.
2. Cuando el repo exista, inspeccionarlo antes de planificar: estructura de
   `apps/web` y `apps/api`, rutas, componentes, servicios, modelo de datos y que
   esta realmente andando contra la API. Si tiene `.codegraph/`, usar CodeGraph
   antes que grep.

## La semana

Las semanas del equipo van de **jueves a jueves** (`team.yaml` → `week`).

- La semana a planificar arranca el **proximo jueves** y su fecha limite es el
  **jueves siguiente**. Ejemplo: se cargan los tickets el lunes 10, los devs
  arrancan el jueves 13 y todo vence el jueves 20.
- Una semana pertenece al sprint que contiene su **fecha limite**, porque es
  cuando el trabajo tiene que estar terminado. Ese sprint define de que epicas se
  saca el trabajo y a que projects van los tickets.
- **Todos los tickets de la corrida llevan la misma `dueDate`**: el jueves de
  cierre.

Si el usuario nombra otra semana, usar la que pidio.

### Las fechas del cronograma

Cada funcionalidad de `features.yaml` tiene `starts` y `ends`: las fechas estimadas que
el PM ve en la pestana Cronograma. Al elegir que entra en la semana:

1. Primero, las funcionalidades pendientes cuyo `starts` cae en la semana que se esta
   planificando. Ese es el plan que el PM ya miro.
2. Si sobra capacidad, seguir por orden de prioridad como siempre, empezando por lo
   que quedo atrasado (`starts` anterior a la semana y todavia sin ticket).
3. Si algo del plan de la semana no entra o no corresponde, decirlo y explicar por que.

Al terminar, las funcionalidades que hayan quedado con ticket y cuyas fechas no
coincidan con la semana planificada se actualizan: `starts` = jueves de arranque y
`ends` = la `dueDate` del ticket. Asi el cronograma refleja lo que realmente se cargo.

## Capacidad

Segun `team.yaml`:

- 3 desarrolladores que toman tickets (`takes_tickets: true`).
- 6 SP por desarrollador por semana → **18 SP totales**.
- El margen del sprint no se descuenta de la semana: es la epica **`Fixes y carry`**, que
  tiene dos tickets de 5 SP en la ultima semana de cada sprint. Cuando toca planificar
  esa semana, esos tickets genericos se reemplazan por los arreglos concretos que hayan
  salido del QA y de las pruebas; si no aparecio nada, se usa para adelantar trabajo del sprint
  que sigue. Nunca generar tickets de esa epica en otra semana.
- **1 SP = 1 hora estimada con margen** (cada dev tiene 6 h semanales por el charter).

Apuntar a los puntos de cada dev sin inventar relleno. Si la epica pedida no tiene
suficiente trabajo pendiente:

1. Planificar todo lo que queda de esa epica.
2. Seguir por la siguiente epica incompleta **del mismo sprint**, en orden.
3. Traer solo lo necesario y marcar de donde salio.
4. Si aun asi no alcanza, dejar capacidad sin llenar y decirlo.

Nunca adelantar trabajo de un sprint posterior sin avisarlo y justificar por que no
rompe el orden de dependencias.

## Tickets fullstack

**Un ticket es una vertical completa**: modelo de Prisma, endpoint de Nest y
pantalla de Vite, todo de la misma persona. Nadie queda esperando el backend o el
frontend de otro.

**Los tests van adentro del ticket, y solo en el backend.** Nunca generar un ticket
separado de tests, de QA automatizado ni de smoke tests: si el ticket toca la API, sus
tests de Jest son parte de ese mismo ticket y de la definicion de terminado. El frontend
no lleva tests automatizados; se prueba corriendo la app.

No partir un ticket en `[BE]` y `[FE]`. Si una funcionalidad es tan grande que la
vertical no entra en 5 SP, partirla en dos verticales mas chicas y completas —
por ejemplo "alta de vehiculo" y "edicion y baja de vehiculo" — no en capas.

### Estimacion

Escala **1 a 5**, sin valores intermedios. Se estima cuanto le lleva a un
**estudiante de 3er año de ingenieria informatica, sin experiencia laboral, que usa
Claude Code**, y se **redondea para arriba**: la idea es que los 6 SP semanales se
resuelvan en 4 o 4,5 horas reales y que el resto quede como margen para lo que se
complique.

| SP | Que es |
|---|---|
| 1 | Configuracion o cambio acotado que Claude Code resuelve casi entero y el dev solo verifica |
| 2 | Una pantalla simple o un endpoint con su modelo, sobre un patron que ya vieron en la capacitacion |
| 3 | Vertical completa estandar: modelo, endpoint y pantalla, todo con patrones conocidos |
| 4 | Vertical con algo nuevo que hay que aprender primero (Firebase, Storage, push, un job) |
| 5 | Lo mas grande permitido: algo nuevo mas varias piezas |

Dos cosas tiran en direcciones opuestas y hay que sopesarlas en cada ticket: Claude
Code acelera mucho el andamiaje y el codigo repetitivo, pero son juniors y lo que
requiere entender una herramienta nueva o depurar una integracion les lleva mas de
lo que parece.

Si `features.yaml` trae un `estimate`, es la sugerencia del PM: respetarla salvo que
el analisis del prototipo muestre que esta muy lejos, en cuyo caso corregirla y
explicar por que.

Evitar tickets que sean solo un componente, un cambio de estilos, un hook, un
endpoint trivial o setup generico. No partir trabajo artificialmente para llegar al
objetivo de puntos.

## Bloqueos

**Objetivo: que ningun ticket de la semana bloquee a otro de la misma semana.**

En orden de preferencia:

1. Elegir el corte de la semana de forma que los tickets sean independientes entre
   si, aunque eso signifique saltear una funcionalidad y tomar la siguiente.
2. Si un ticket bloquea a otro y los dos tienen que entrar, **los dos van a la
   misma persona**, con el bloqueante primero, siempre que sumen hasta sus 6 SP.
3. Si la suma pasa los 6 SP, van a dos personas que coordinan el orden dentro de la
   semana: el bloqueante arranca primero y el otro sigue apenas queda liberado. Se
   avisa en el reparto para que las dos sepan que dependen una de la otra.

El cronograma planifica encadenados en la misma semana a proposito cuando esperar una
semana entera dejaria al equipo a media carga. El panel de la semana de la app los marca
con "va con...": esos son los que hay que repartir con este criterio.

Las dependencias reales estan en `depends_on`. Una dependencia hacia una
funcionalidad ya `done` no bloquea nada. Al crear el ticket, las dependencias
vigentes van en `blockedBy` **y ademas** escritas como `Depende de: PIT-XX` en
`## Datos del ticket`, al principio del bloque tecnico.

## Asignacion

- Solo reciben tickets las personas con `takes_tickets: true`. PM, PO, Tech Leader
  y QA nunca reciben tickets de desarrollo (restriccion del charter: programa
  unicamente Lab2).
- Como todos los tickets son fullstack, no hay division por area: repartir por
  carga, por dependencias y por continuidad (quien ya toco esa parte la sigue).
- **Nunca inventar un `linear_user_id`.** Si es `null`, crear el ticket sin asignar
  y avisarlo al final indicando quien deberia tomarlo.

## Convenciones de Linear del team PIT

Al crear un issue con `save_issue`:

| Campo | Valor |
|---|---|
| `team` | `PIT` |
| `title` | En espanol, sin prefijo de area y sin jerga (ver "El titulo se lee sin abrir el ticket") |
| `state` | **`Backlog` siempre.** No se le asigna cycle (ver abajo) |
| `project` | **Obligatorio.** El `linear_project` de la epica |
| `priority` | **Obligatorio.** Es el orden de ejecucion de la semana (ver abajo) |
| `estimate` | 1, 2, 3, 4 o 5 |
| `dueDate` | El jueves de cierre de la semana |
| `labels` | `Fullstack` + una de `Feature` / `Improvement` / `Bug` |
| `assignee` | El `linear_user_id` del dev, o nada si es `null` |
| `blockedBy` | Solo dependencias reales que sigan pendientes |

**Ningun ticket se crea sin project y sin priority.** El project identifica la epica
y la priority le dice al dev que agarrar primero. Si la epica tiene
`linear_project: null`, crear primero el project en Linear con el nombre de la epica
(o preguntar cual quiere el PM), anotarlo en `features.yaml` y recien despues crear
los tickets.

### La priority es el orden en que se hacen los tickets

Los tableros del equipo se miran ordenados por prioridad, asi que **la prioridad no
mide importancia: define el orden**. Arriba tiene que quedar lo que hay que hacer
primero, aunque sea un ticket de infraestructura que nadie considera "importante".

Sale sola del grafo de bloqueos que ya se armo para repartir la semana:

| Priority | Cuando | Que le dice al dev |
|---|---|---|
| `1` Urgent | Bloqueante raiz: sin el no arranca nadie | Esto va el primer dia, si o si |
| `2` High | Bloquea a otro ticket de la semana | Apenas se libere el raiz, esto |
| `3` Medium | No bloquea ni esta bloqueado | Se puede hacer en cualquier momento |
| `4` Low | Esta bloqueado por otros de la semana | Va al final, cuando lleguen sus dependencias |

Con esos cuatro niveles el orden de la semana queda determinado por el tablero solo,
sin que nadie tenga que leer los `blockedBy` para saber por donde empezar. Si dos
tickets caen en el mismo nivel y da igual cual va primero, se dejan empatados.

> **Limite de la herramienta:** el orden manual de Linear (`sortOrder`, lo que se
> arrastra en el tablero) **no se puede setear** — ni `save_issue` ni
> `linear_update_issue` lo exponen. Por eso la prioridad es la unica palanca de orden
> disponible, y por eso se usan los cuatro niveles en vez de dos. Dentro de un mismo
> nivel el orden lo decide Linear; si el PM necesita un orden exacto ahi adentro, lo
> arrastra a mano. No prometer que se ordeno el tablero mas alla de la prioridad.

### El cycle no se asigna: es incompatible con Backlog

Linear **no permite que un issue en estado `Backlog` pertenezca a un cycle**. Los dos
campos se pisan:

- Si se manda `cycle`, el ticket sale del Backlog y pasa a `Todo`.
- Si se manda `state: Backlog`, Linear lo saca del cycle.

**El equipo eligio Backlog.** Los tickets de la semana se crean en `Backlog`, **sin**
cycle, y quien los empieza los pasa a `Todo`. El sprint queda identificado por el
project de la epica y por la `dueDate`, no por el cycle.

Dos trampas mas de `save_issue` con el cycle, por si alguna vez se decide asignarlo:
acepta el `cycle_id` de `team.yaml` sin quejarse y despues **no lo asigna** (hay que
pasar el **numero**: `cycle: 1` para el Sprint 1), y su respuesta omite el `cycleId`
cuando quedo sin asignar, asi que el ticket parece bien creado y no esta en ningun
sprint.

### Verificacion obligatoria al terminar

Despues de crear todos los tickets, correr un `list_issues` sobre el team `PIT`
pidiendo `["id", "status", "priority", "estimate", "project", "dueDate", "assignee",
"labels"]` y confirmar campo por campo que ninguno quedo vacio y que los cinco
siguen en `Backlog`. La respuesta de `save_issue` no alcanza como verificacion:
omite los campos que quedaron sin setear en vez de marcarlos.

Los bugs de un sprint van al project `Fixes - SN` con label `Bug`.

## Cuerpo del ticket

El ticket tiene **dos bloques separados por una linea horizontal**, y cada uno esta
escrito para un lector distinto.

**Arriba del separador** lee un dev de segundo ano que abre el ticket por primera vez y
todavia no sabe que es esto. Ahi va que se va a construir, como se ve y por donde
arranca. **Entra en una pantalla**: si hay que scrollear para llegar al separador, esta
largo y hay que bajar cosas.

**Abajo del separador** lee ese mismo dev, pero con Claude Code al lado. Es la
referencia precisa para hacer el trabajo: modelos, endpoints, tokens, hexadecimales,
breakpoints, comandos, tablas. **Este bloque no tiene tope de largo** y no se resume:
mientras mas exacto, mejor sale el trabajo.

La regla que decide de que lado va cada cosa: **ningun bullet de arriba del separador
contiene un hexadecimal, una clase de Tailwind, una ruta de archivo, un comando, un
endpoint ni un nombre de modelo de Prisma.** Si aparece uno, ese bullet va abajo. La
unica excepcion es "Por donde empezar", que se explica mas adelante.

Escribir en espanol rioplatense, con esta estructura exacta:

```markdown
## Contexto

[Que hay que hacer, en terminos de lo que la app pasa a poder hacer. Sin jerga:
es lo primero que lee el dev.]

[Que problema resuelve: que falta hoy o que se rompe si esto no esta.]

## Objetivo

[Resultado esperado, en una frase.]

**Referencia visual:** [la pantalla del prototipo funcionando y como se llega a ella].
El PM adjunta la captura.

## Que tiene que quedar andando

- [Que puede hacer el usuario, verificable abriendo la app. Sin jerga.]
- [...]

## Por donde empezar

1. [Primer paso concreto]
2. [...]

## Palabras que vas a ver

- **[Termino]**: [que es y para que sirve en este ticket, en una linea.]

---

# Especificacion tecnica

> De aca para abajo el ticket es tecnico a proposito. Es la referencia precisa para
> hacer el trabajo: leelo con Claude Code al lado.

## Datos del ticket

- Estimado: N SP (~N horas)
- Depende de: PIT-XX

## Alcance

- [Cambio de modelo de datos / migracion]
- [Endpoint o servicio del backend]
- [Pantalla o componente del frontend]

## Backend

- [Modelo de Prisma, endpoints, validaciones, tests de Jest]

## Frontend

- [Ruta, estado, formulario, query de React Query, comportamiento mobile y desktop]

## Componentes

- [De que componente de shadcn parte cada pieza y que hay que adaptarle, con los
  tokens de design-system.md y los valores concretos]

## Criterios de aceptacion tecnicos

- [Criterio con valores exactos: tokens, pixeles, breakpoints, endpoints, lint, tests]
- [...]

## Fuera de alcance

- [Algo que razonablemente podria interpretarse como parte de la tarea y no lo es.]
```

Las secciones tecnicas se ajustan a lo que el ticket toca de verdad:

- **Sin UI** (backend puro): la `Referencia visual` va como `no aplica (backend)` y
  `## Frontend` y `## Componentes` se omiten enteras.
- **Infraestructura** (CI, deploy, configuracion): la `Referencia visual` va como
  `no aplica (infraestructura)` y `## Backend`, `## Frontend` y `## Componentes` se
  reemplazan por una sola seccion `## Implementacion` con el detalle tecnico: archivos
  de configuracion, orden de los pasos, comandos, y las trampas conocidas.

Una seccion vacia, o rellena con "no aplica" en cada bullet, es peor que no tenerla.

### Los topes del bloque de arriba

| Seccion | Tope |
|---|---|
| Contexto | 2 parrafos, 6 frases entre los dos |
| Objetivo | 1 frase, mas la linea de referencia visual |
| Que tiene que quedar andando | 3 a 6 bullets, 1 linea cada uno |
| Por donde empezar | 3 a 5 pasos, 1 linea cada uno |
| Palabras que vas a ver | 3 a 6 terminos, se omite entera si no hay ninguno |

Estos topes no son una sugerencia. Cuando algo no entra, la respuesta nunca es apretar
mas la letra arriba: es bajarlo al bloque tecnico, que para eso no tiene limite.

### El contexto es la puerta de entrada del ticket

Es lo primero que lee el dev, y lo escribe alguien que ya entendio todo el
problema para alguien que recien arranca. Son dos parrafos cortos, seis frases
como maximo entre los dos: el primero dice **que va a construir**, en terminos de
lo que el usuario final ve o de lo que la app pasa a poder hacer; el segundo dice
**que problema resuelve**, o sea que falta hoy y que se rompe si esto no esta.

Se puede dar por sabido: HTML, CSS, JavaScript y TypeScript, React, componente,
prop, estado, funcion, base de datos, tabla, fila, API, endpoint, request y
response, JSON, Git, rama y pull request.

**No** se puede dar por sabido, y por lo tanto no aparece en el contexto sin
explicarse: guard, interceptor, decorador, upsert, migracion, seed, ORM,
monorepo, CI/CD, ID token, JWT, design system, tokens de diseno, SDK, service
account, bucket, connection string pooled o direct, breakpoint, ring de foco,
PWA, safe area, boilerplate, espejar. Si alguno es inevitable, se aclara ahi
mismo entre parentesis y en cinco palabras.

Nada de hexadecimales, rutas de archivo, nombres de clase ni comandos: eso vive
en el bloque tecnico. Y no es un resumen del alcance: la lista de tareas ya viene
abajo y no hay que repetirla.

### Objetivo y referencia visual

El objetivo es una frase: que queda andando cuando el ticket cierra.

Debajo va la `Referencia visual`, que nombra **la pantalla del prototipo funcionando** y
como se llega a ella ("pantalla de Garage, solapa Informacion"). Va arriba, junto al
objetivo y no enterrada entre las notas, porque es la forma en que un junior entiende
que esta construyendo antes de leer una sola linea tecnica.

### Que tiene que quedar andando

Es la lista de criterios de aceptacion del dev y del QA: lo que se verifica **usando la
app**, sin abrir el codigo.

- Se escribe como lo que el usuario puede hacer, o lo que pasa al tocar algo.
- Cubre mobile y desktop en una frase, en castellano y sin numeros: "el formulario abre
  pegado abajo en el celular y como ventana centrada en la compu".
- Nada de valores: sin hexadecimales, sin tokens, sin clases, sin breakpoints, sin
  nombres de endpoint. Todo eso tiene su lugar abajo.
- Prohibido "funciona correctamente", "queda prolijo" y cualquier cosa que dos personas
  puedan dar por cumplida de manera distinta.

### Por donde empezar

Es el orden de ataque, no un resumen del alcance. Un junior que abre el ticket ya sabe
que hay que hacer; lo que no sabe es que tocar primero.

- 3 a 5 pasos, en el orden en que conviene hacerlos, uno por linea.
- Sigue la vertical del ticket: modelo y migracion, endpoint, pantalla, probar.
- **El ultimo paso es siempre probarlo corriendo la app**, en las dos resoluciones si
  hay UI. Si el ticket toca la API, sus tests de Jest son uno de los pasos.
- Es la **unica seccion del bloque de arriba que puede nombrar** un modelo, una ruta o
  un comando: es el puente hacia el bloque tecnico. Aun asi no lleva valores —ni
  hexadecimales, ni tokens, ni breakpoints— y se queda en una linea por paso.

### Palabras que vas a ver

Cierra el bloque de arriba, y ese lugar es a proposito: el dev se cruza con el glosario
**antes** de entrar en la especificacion, que es donde los terminos lo esperan.

De 3 a 6 terminos, **solo los que realmente aparecen en el cuerpo** y que un dev de
segundo ano probablemente no conoce. Una linea cada uno: que es y para que sirve *en
este ticket*, no la definicion de manual.

Si el ticket no introduce ningun termino nuevo, la seccion se omite entera: no
inventar entradas de relleno. Tampoco repetir lo que ya quedo explicado en el
contexto.

### La especificacion tecnica

Todo lo que esta abajo del separador se escribe para que el trabajo se pueda hacer sin
volver a preguntar nada. Es donde vive el valor del ticket para un dev junior: nombres
concretos de endpoint, modelo y componente **del MVP**, con sus valores exactos.

- **Datos del ticket**: el estimado en SP con su equivalente en horas, y las
  dependencias vigentes como `Depende de: PIT-XX` (ademas del `blockedBy` de Linear).
- **Alcance**: las piezas que se tocan, una por linea.
- **Backend**: modelo de Prisma, endpoints, validaciones y los tests de Jest, que son
  parte del ticket y de la definicion de terminado.
- **Frontend**: ruta, estado, formulario, queries de React Query y que cambia entre
  mobile y desktop.
- **Componentes**: de que componente de shadcn parte cada pieza de UI y que hay que
  adaptarle, con los valores concretos (hexadecimales, pixeles, breakpoints) y los
  nombres de `design-system.md`. Si algo no existe en shadcn, decirlo explicitamente y
  describir como se comporta.

Las tablas grandes —variantes de un componente, tokens de color, estados— van aca y
estan bien: son la parte que hace que el trabajo salga igual al prototipo. Lo que nunca
hay que hacer es ponerlas antes de que el dev sepa que esta construyendo.

**Ninguna seccion tecnica nombra un archivo del prototipo.** Los `.tsx` y `.css` que
leiste son tu fuente, no la del dev: el ve el prototipo corriendo, no su codigo. Si una
nota necesita apoyarse en algo que viste ahi, se escribe el dato, no el archivo
(`el fondo es #fafafa`, no `los tokens de globals.css`). Los unicos archivos que se
pueden nombrar son los del repo del MVP, que es donde el dev va a escribir.

### Criterios de aceptacion tecnicos

Es la version exacta de "Que tiene que quedar andando", mas todo lo que no se ve.

- Cada criterio o **precisa uno simple** con sus valores, o **cubre algo invisible**:
  codigos de respuesta de la API, reglas de lint, tests que tienen que pasar,
  validaciones del backend, comportamiento del foco.
- No tiene tope de cantidad.
- No es copiar la lista de arriba con mas palabras. Si un criterio tecnico no agrega
  ningun dato nuevo respecto del simple, sobra.
- Rige la misma prohibicion: nada de "funciona correctamente".

El mismo criterio en los dos registros, para ver la diferencia:

| Lista | Como se escribe |
|---|---|
| Que tiene que quedar andando | El boton principal se ve rojo, es comodo de tocar en el celular y se llega a el con la tecla Tab. |
| Criterios de aceptacion tecnicos | Boton primario `bg-primary`, hover `red-700`, `h-12` y `rounded-full`; el foco muestra el ring rojo de 3px al 50% y es alcanzable con Tab. |

### El titulo se lee sin abrir el ticket

El titulo dice **que queda funcionando cuando el ticket termina**, y tiene que
entenderse desde el tablero, sin abrirlo.

- Nombres propios de herramientas, si: Firebase, Prisma, Neon, shadcn, GitHub
  Actions. Un junior los googlea y entiende que son.
- Jerga de concepto, no: *guard*, *ID token*, *design system*, *CI*, *espejado*,
  *boilerplate*, *scaffolding*. Si el concepto no se puede evitar, va acompanado
  de lo que hace: "con chequeos automaticos en cada PR", no "con CI".

## Flujo de trabajo

Antes de crear nada en Linear:

1. Determinar la semana a planificar y su fecha limite.
2. Leer `features.yaml` y `team.yaml`.
3. Recorrer el backlog en orden hasta juntar la capacidad de la semana.
4. Leer las descripciones y abrir los archivos del prototipo de cada funcionalidad
   elegida. Si alguna tiene UI y no tiene `prototype`, avisarlo antes de seguir.
5. Inspeccionar los issues de Linear relacionados, incluidos los cancelados.
6. Armar el reparto minimizando bloqueos.
7. **Mostrar el plan de la semana con el titulo final de cada ticket, los SP por
   dev, el total y la fecha limite, y esperar confirmacion.** El titulo se muestra
   tal cual va a quedar en Linear, para que el PM lo pueda objetar antes de que se
   cree nada.
8. Recien ahi crear los tickets.
9. **Actualizar `features.yaml`**: a cada funcionalidad que quedo con ticket se le
   escriben sus `ticket_refs`, se le cambia el `status` de `todo` a **`backlog`** y, si
   sus fechas no coinciden con la semana planificada, se le corrigen `starts` y `ends`.
   Es un paso obligatorio del cierre: es como el PM ve desde la app que ya se
   subieron. Un ticket creado en Linear sin su funcionalidad en `backlog` es un
   trabajo a medias.
10. Informar que tickets quedaron sin asignar y por que.

Nunca marcar una funcionalidad como `in_progress` o `done` al crear su ticket:
`in_progress` lo pone quien empieza a trabajarla y `done` sale cuando la
implementacion cumple la definicion de terminado de `team.yaml` (rama, PR aprobado y
mergeado, build limpio, probado corriendo la app).

Si las herramientas de Linear no estan disponibles, generar el plan completo pero
**no** afirmar que se crearon los tickets.

## Reglas finales

- No duplicar issues. Los PIT-1 a PIT-18 ya existen y son de la Capacitacion: no se
  tocan, no se reestiman y no se reciclan. Los cancelados (PIT-6, PIT-12) quedan
  cancelados.
- La escala vieja de la Capacitacion (1 y 2 puntos) no se normaliza.
- No inventar trabajo terminado.
- No crear tickets de relleno ni artificialmente chicos.
- No generar trabajo para nada de `out_of_scope`.
- No cambiar el orden de prioridad del backlog ni los requerimientos del producto
  mientras se planifica. Eso lo decide el PM desde la app.
