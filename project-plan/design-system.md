# PitStop — Design System

Fuente de verdad de los colores, las tipografias y los estilos de PitStop. Se escribe
aca, en `project-plan/`, al lado de `features.yaml` y `team.yaml`, porque es contexto
para **escribir tickets**: los devs de Lab2 no tienen el codigo del prototipo, solo lo
ven corriendo, asi que todo lo visual tiene que viajar dentro del ticket.

Stack donde se implementa: **Vite + React + Tailwind CSS v4**. Los tokens se declaran
con `@theme` en `apps/web/src/styles.css`; no hay `tailwind.config.js` ni `next/font`.
Tema **light unicamente**.

---

## 1. Como se usa este documento

Al escribir un ticket que pida crear o modificar una pantalla o un componente, **cada
elemento se describe con los nombres de este documento**, nunca con hexadecimales
sueltos ni con clases de Tailwind inventadas en el momento. Es decir:

- Color: el nombre del token (`primary`, `muted-foreground`, `border`), no `#e10600`.
- Texto: la variante de `Text` (`title`, `body`, `caption-strong`), no `text-sm font-semibold`.
- Icono: el nombre de lucide mas el tamano de la escala (`name="Car" size="md"`).

La unica excepcion es el ticket que **crea** el design system (PIT-23): ahi si van los
hexadecimales, porque es el ticket que los define.

Regla de implementacion que sale de aca y vale para toda la app:

> **Todo texto va dentro de `<Text>` y todo icono dentro de `<Icon>`.** No se escriben
> `<p>`, `<span>` ni `<h1>`-`<h6>` sueltos, ni se pasa el color o el tamano con clases
> de Tailwind. Lo controla una regla de lint en el repo (`react/forbid-elements`).

Los dos componentes viven en `apps/web/src/components/ui/text.tsx` y
`apps/web/src/components/ui/icon.tsx`. La excepcion del lint esta escrita contra la ruta
del `Text`, asi que ese archivo no se mueve.

---

## 2. Tokens de color

Se declaran una vez en `@theme` y se usan siempre por nombre.

### Marca (rojo F1)

| Token     | Hex       | Clases tipicas              | Uso                                                                   |
| --------- | --------- | --------------------------- | --------------------------------------------------------------------- |
| `red-50`  | `#ffebea` | `bg-red-50`                 | Fondo suave de estados de marca, badges leves                         |
| `red-600` | `#e10600` | `bg-red-600` `text-red-600` | **Color primario.** Botones principales, acentos, links, ring de foco |
| `red-700` | `#b30500` | `hover:bg-red-700`          | Hover y pressed del primario, texto rojo intenso                      |

### Neutrales

| Token         | Hex       | Clases tipicas       | Uso                                               |
| ------------- | --------- | -------------------- | ------------------------------------------------- |
| `white`       | `#ffffff` | `bg-card`            | Superficie de tarjetas y popovers                 |
| `neutral-50`  | `#fafafa` | `bg-background`      | Fondo de pagina                                   |
| `neutral-100` | `#f4f4f5` | `bg-neutral-100`     | Superficies secundarias, chips, circulos de icono |
| `neutral-200` | `#e5e5e7` | `border-neutral-200` | Bordes, campos, divisores, handle del sheet       |
| `neutral-400` | `#a1a1aa` | `text-neutral-400`   | Placeholders, iconos deshabilitados               |
| `neutral-500` | `#71717a` | `text-neutral-500`   | Texto secundario                                  |
| `neutral-700` | `#3f3f46` | `text-neutral-700`   | Enfasis medio, labels de formulario               |
| `neutral-900` | `#0a0a0a` | `text-foreground`    | Texto principal                                   |

### Funcionales

| Token                | Hex       | Uso                                         |
| -------------------- | --------- | ------------------------------------------- |
| `success`            | `#16a34a` | Al dia, servicio registrado, confirmaciones |
| `success-foreground` | `#ffffff` | Texto sobre `success`                       |
| `warning`            | `#f59e0b` | Proximo a vencer, avisos                    |
| `warning-foreground` | `#0a0a0a` | Texto sobre `warning`                       |

### Tokens semanticos

Son los que se usan en el dia a dia (`bg-primary`, `text-muted-foreground`,
`border-border`). Los define shadcn y se mapean a los valores de arriba.

| Token                                    | Valor                 | Uso                                    |
| ---------------------------------------- | --------------------- | -------------------------------------- |
| `background`                             | `#fafafa`             | Fondo de la app                        |
| `foreground`                             | `#0a0a0a`             | Texto principal                        |
| `card` / `card-foreground`               | `#ffffff` / `#0a0a0a` | Tarjetas y su texto                    |
| `popover` / `popover-foreground`         | `#ffffff` / `#0a0a0a` | Menus, sheets, modales                 |
| `primary` / `primary-foreground`         | `#e10600` / `#ffffff` | Accion principal                       |
| `secondary` / `secondary-foreground`     | `#f4f4f5` / `#0a0a0a` | Accion secundaria                      |
| `muted` / `muted-foreground`             | `#f4f4f5` / `#71717a` | Superficies apagadas, texto secundario |
| `accent` / `accent-foreground`           | `#f4f4f5` / `#0a0a0a` | Hover de items, resaltados sutiles     |
| `destructive` / `destructive-foreground` | `#e10600` / `#ffffff` | Eliminar, acciones peligrosas          |
| `border`                                 | `#e5e5e7`             | Bordes globales                        |
| `input`                                  | `#e5e5e7`             | Borde de campos                        |
| `ring`                                   | `#e10600`             | Ring de foco                           |

---

## 3. Tipografia

Dos familias, cargadas con `@import` de Google Fonts desde el CSS global:

| Familia        | Fuente                             | Cuando                                                              |
| -------------- | ---------------------------------- | ------------------------------------------------------------------- |
| `font-sans`    | **Inter** (fallback `system-ui`)   | Toda la UI: cuerpo, labels, campos, botones                         |
| `font-display` | **Space Grotesk** (fallback Inter) | Solo titulos y numeros destacados. Da el caracter tecnico/automotor |

El tamano base de la UI es `text-sm`. Los titulos grandes llevan `tracking-[-0.03em]`.

### Variantes de `Text`

**No se elige un tamano: se elige un rol.** Los tamanos, pesos y familias quedan
encapsulados en el componente.

| Variante         | Clases que aplica                                                 | Tag por defecto | Cuando se usa                                               |
| ---------------- | ----------------------------------------------------------------- | --------------- | ----------------------------------------------------------- |
| `display`        | `font-display text-[32px] font-bold tracking-[-0.03em]`           | `h1`            | Cifra hero, pantalla de bienvenida                          |
| `title`          | `font-display text-2xl font-bold tracking-[-0.03em]`              | `h1`            | Titulo de pantalla                                          |
| `heading`        | `font-display text-xl font-bold`                                  | `h2`            | Titulo de seccion, titulo de hoja inferior o modal          |
| `subheading`     | `font-display text-lg font-bold`                                  | `h3`            | Titulo de tarjeta, titulo de estado vacio                   |
| `card-title`     | `font-display text-base font-bold`                                | `h3`            | Nombre de vehiculo en una tarjeta                           |
| `body`           | `font-sans text-sm font-normal`                                   | `p`             | Texto corrido. **Es la base de la UI, el mas usado**        |
| `body-strong`    | `font-sans text-sm font-semibold`                                 | `p`             | Enfasis dentro del cuerpo, valores de una ficha             |
| `label`          | `font-sans text-sm font-medium`                                   | `span`          | Labels de formulario, texto de botones, items de navegacion |
| `caption`        | `font-sans text-xs font-normal`                                   | `span`          | Metadatos, textos de ayuda, fechas                          |
| `caption-strong` | `font-sans text-xs font-semibold`                                 | `span`          | Texto de chips y badges                                     |
| `overline`       | `font-sans text-[11px] font-semibold uppercase tracking-[0.08em]` | `span`          | Encabezado de seccion ("PROXIMOS SERVICIOS")                |
| `numeric`        | `font-display text-4xl font-bold tabular-nums tracking-tight`     | `span`          | Odometro, KPIs, kilometraje                                 |

El prop `as` cambia el tag cuando la semantica del HTML lo pide (por ejemplo un `title`
que en esa pantalla no es el `h1`), sin cambiar como se ve.

---

## 4. Colores de texto y de icono

Los aceptan tanto `Text` como `Icon`, con los mismos nombres.

| Color        | Token / clase                       | Uso                                               |
| ------------ | ----------------------------------- | ------------------------------------------------- |
| `default`    | `text-foreground` `#0a0a0a`         | Texto principal. Es el default                    |
| `muted`      | `text-muted-foreground` `#71717a`   | Texto secundario, subtitulos, hints               |
| `subtle`     | `text-neutral-400` `#a1a1aa`        | Placeholders, iconos deshabilitados o decorativos |
| `emphasis`   | `text-neutral-700` `#3f3f46`        | Enfasis medio, labels de formulario               |
| `primary`    | `text-primary` `#e10600`            | Links, acentos de marca, errores de campo         |
| `on-primary` | `text-primary-foreground` `#ffffff` | Texto e iconos sobre fondo rojo                   |
| `inverse`    | `text-background` `#fafafa`         | Sobre fondo oscuro: toast, chip activo            |
| `success`    | `text-success` `#16a34a`            | Al dia, confirmado                                |
| `warning`    | `text-warning` `#f59e0b`            | Proximo a vencer                                  |
| `danger`     | `text-destructive` `#e10600`        | Vencido, error, eliminar                          |

---

## 5. Iconos

Un unico componente `Icon` sobre `lucide-react`. Recibe el nombre del icono como
string; el tipo es `keyof typeof icons`, o sea que acepta cualquier icono de lucide y
ademas autocompleta.

```tsx
<Icon name="Car" size="md" color="muted" />
```

| Prop          | Valores                                                                   | Default   |
| ------------- | ------------------------------------------------------------------------- | --------- |
| `name`        | Cualquier icono de lucide en PascalCase (`Car`, `Wrench`, `CheckCircle2`) | —         |
| `size`        | `xs` 14px · `sm` 16px · `md` 20px · `lg` 24px · `xl` 28px, o un numero    | `md`      |
| `color`       | Los diez de la tabla anterior                                             | `default` |
| `strokeWidth` | Numero. `2.25` en chips, `1.75` en iconos grandes decorativos             | `2`       |
| `aria-label`  | Si se pasa, el icono es accesible; si no, va `aria-hidden`                | —         |

Escala segun donde va: `xs` dentro de chips y badges, `sm` dentro de botones y campos,
`md` en la navegacion y en las filas de lista, `lg` en estados vacios y encabezados,
`xl` en ilustraciones puntuales.

---

## 6. Border radius

| Token          | Valor  | Donde                                                              |
| -------------- | ------ | ------------------------------------------------------------------ |
| `rounded-sm`   | `10px` | Elementos chicos, botones `xs`                                     |
| `rounded-md`   | `12px` | Botones `sm`                                                       |
| `rounded-lg`   | `16px` | **Default de controles.** Botones, campos                          |
| `rounded-xl`   | `20px` | Tarjeta principal, tarjeta de vehiculo, estado vacio               |
| `rounded-2xl`  | `24px` | Hojas inferiores, modales, contenedores grandes                    |
| `rounded-full` | —      | Chips, badges, avatares, FAB, botones principales, boton de cerrar |

Regla: cuanto mas grande y prominente la superficie, mayor el radio (16 → 20 → 24).
Todo lo que sea un estado o una pastilla va `rounded-full`.

Los campos de formulario usan `rounded-[14px]`, un valor intermedio propio.

---

## 7. Sombras

| Token       | Valor                           | Uso                                              |
| ----------- | ------------------------------- | ------------------------------------------------ |
| `shadow-sm` | `0 1px 2px rgba(10,10,10,.06)`  | Tarjetas en reposo, boton primario               |
| `shadow-md` | `0 4px 16px rgba(10,10,10,.08)` | Hover de tarjetas                                |
| `shadow-lg` | `0 8px 30px rgba(10,10,10,.12)` | Hojas inferiores, modales, toast, barra flotante |

Patron: tarjeta con `shadow-sm` que pasa a `hover:shadow-md`.

---

## 8. Motion

Curva caracteristica: `cubic-bezier(0.32, 0.72, 0, 1)`.

| Clase              | Efecto                    | Uso                                          |
| ------------------ | ------------------------- | -------------------------------------------- |
| `animate-sheet-up` | Entra desde abajo, `0.3s` | Apertura de hojas inferiores                 |
| `animate-fade-in`  | Fade `0.25s`              | Overlays oscurecidos, aparicion de contenido |
| `animate-slide-in` | Slide lateral `0.28s`     | Toast, paneles, items de lista               |

---

## 9. Utilidades propias

| Clase                      | Que hace                                                      |
| -------------------------- | ------------------------------------------------------------- |
| `tabular-nums`             | Numeros de ancho fijo (odometro, KPIs)                        |
| `safe-top` / `safe-bottom` | `env(safe-area-inset-*)`, para el notch cuando corre como PWA |
| `no-scrollbar`             | Oculta la scrollbar sin perder el scroll                      |

---

## 10. Mapa por componente

Lo que un ticket copia tal cual cuando pide usar uno de estos componentes.

### Botones

| Variante       | Fondo / borde                                             | Texto                          | Forma                   |
| -------------- | --------------------------------------------------------- | ------------------------------ | ----------------------- |
| Primario       | `bg-primary`, hover `bg-red-700`, `shadow-sm`             | `on-primary`, variante `label` | `h-12` `rounded-full`   |
| Secundario     | `bg-card` + borde `border`, hover `bg-neutral-100`        | `default`, variante `label`    | `h-12` `rounded-full`   |
| Ghost          | Sin fondo, hover `bg-neutral-100`                         | `default`, variante `label`    | `h-12` `rounded-full`   |
| Destructivo    | `bg-card` + borde `destructive` al 30%, hover `bg-red-50` | `danger`, variante `label`     | `h-12` `rounded-full`   |
| Icono circular | `bg-neutral-100`, hover `bg-neutral-200`                  | Icono `muted` size `sm`        | `size-9` `rounded-full` |

Foco de todos: ring `ring` de 3px al 50%. Deshabilitado: `opacity-50` y sin eventos.

### Campos de formulario

| Elemento                  | Fondo / borde                                                               | Texto                                          | Forma                   |
| ------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------- |
| Label del campo           | —                                                                           | `emphasis`, variante `label`                   | —                       |
| Input / Select / Textarea | `bg-card`, borde `border`; foco borde `primary` + ring `primary` 4px al 10% | `default`, `text-[15px]`; placeholder `subtle` | `h-12` `rounded-[14px]` |
| Flecha del select         | —                                                                           | Icono `ChevronDown` size `sm` color `subtle`   | —                       |
| Hint                      | —                                                                           | `muted`, variante `caption`                    | —                       |
| Error                     | —                                                                           | `danger`, variante `caption`, peso medium      | —                       |
| Checkbox                  | Borde `border`; marcado `bg-primary`                                        | Check `on-primary` size `xs`                   | `rounded-sm`            |

### Superficies

| Elemento                      | Fondo / borde                   | Radio              | Sombra                          |
| ----------------------------- | ------------------------------- | ------------------ | ------------------------------- |
| Tarjeta principal (vehiculo)  | `bg-card` + borde `border`      | `rounded-xl` 20px  | `shadow-sm` → hover `shadow-md` |
| Tarjeta chica / fila de lista | `bg-card` + borde `border`      | `rounded-lg` 16px  | Sin sombra → hover `shadow-sm`  |
| Fila seleccionada             | Borde `primary`, fondo `red-50` | `rounded-lg`       | —                               |
| Contenedor grande / hoja      | `bg-card`                       | `rounded-2xl` 24px | `shadow-lg`                     |

### Componentes propios

**`StatusChip`** — pastilla `rounded-full`, `px-2.5 py-1`, texto variante
`caption-strong`, icono size `xs` con `strokeWidth 2.25`:

| Estado  | Fondo              | Texto               | Icono           |
| ------- | ------------------ | ------------------- | --------------- |
| Al dia  | `#eafaf0`          | `#15803d`           | `CheckCircle2`  |
| Proximo | `#fef3e2`          | `#b45309`           | `AlertTriangle` |
| Vencido | `red-50` `#ffebea` | `primary` `#e10600` | `AlertCircle`   |

**`EmptyState`** — `bg-card`, borde punteado `border`, `rounded-xl`, `px-6 py-12`,
centrado. Icono size `lg` color `subtle` con `strokeWidth 1.75` dentro de un circulo
`size-16 bg-neutral-100 rounded-full`. Titulo variante `subheading` color `default`.
Subtitulo variante `body` color `muted`. Boton opcional abajo.

**`Odometer`** — cifra variante `numeric` color `default`, formateada con
`Intl.NumberFormat('es-AR')` (145000 → "145.000"). Unidad al lado, variante `label`
color `muted`, alineada por `items-baseline`.

**`BottomSheet`** — cambia de forma segun el ancho, con `useMediaQuery('(min-width: 1024px)')`:

- **Mobile (< 1024px):** pegado abajo, ancho completo, `rounded-t-2xl`, `bg-card`,
  `shadow-lg`, entra con `animate-sheet-up`. Handle `h-1.5 w-10 rounded-full
bg-neutral-200` arriba. Titulo variante `heading`, descripcion variante `body` color
  `muted`. Boton de cerrar circular con icono `X` size `sm` color `muted`. Footer fijo
  con borde superior `border` y `safe-bottom`. Alto maximo `92dvh`, cuerpo con
  `no-scrollbar`.
- **Desktop (>= 1024px):** modal centrado, `rounded-2xl`, mismo contenido, sin handle.
- **Los dos:** overlay `bg-black/40` con `animate-fade-in`; cierra con Escape, con la X
  y tocando el overlay; mientras esta abierto el `body` no scrollea.

### Otros

| Componente              | Fondo / borde                                         | Texto                                                  | Forma          |
| ----------------------- | ----------------------------------------------------- | ------------------------------------------------------ | -------------- |
| Chip de filtro inactivo | `bg-card` + borde `border`, hover borde `neutral-400` | `emphasis`, variante `label`                           | `rounded-full` |
| Chip de filtro activo   | `bg-foreground`                                       | `inverse`, variante `label`                            | `rounded-full` |
| Badge                   | `bg-neutral-100` o `bg-red-50` segun el caso          | `emphasis` o `primary`, variante `caption-strong`      | `rounded-full` |
| Tab activo              | Sin fondo, subrayado `primary` de 2px                 | `default`, variante `label`                            | —              |
| Tab inactivo            | Sin fondo                                             | `muted`, variante `label`                              | —              |
| Toast                   | `bg-foreground`, `shadow-lg`, `animate-slide-in`      | `inverse`, variante `label`; icono `success` size `sm` | `rounded-full` |
| Encabezado de seccion   | —                                                     | `muted`, variante `overline`                           | —              |

---

## 11. Reglas para escribir tickets

Todo ticket que pida un componente o una pantalla tiene que dejar respondidas estas
cinco preguntas, con los nombres de este documento:

1. Que **tokens de fondo y de borde** usa, incluido el estado hover.
2. Que **color de texto** y que **variante de `Text`** lleva cada texto de adentro.
3. Que **iconos** (nombre de lucide) y en que **tamano** de la escala.
4. Que **radio** y que **sombra**.
5. Como cambia en **mobile y en desktop**, si cambia.

Si un componente necesita un valor que no esta en este documento, se agrega aca primero
y despues se escribe el ticket. No se inventan colores ni tamanos dentro de un ticket.
