# Landing pública antes del inicio de sesión

Publicado como PIT-64 en Backlog · Proyecto: Auth · 4 SP · Prioridad: Medium · Etiquetas: Frontend, Feature · Sin asignar ni fecha hasta ubicarlo en la semana de trabajo.

Código base revisado: `pitstop-app` en `ff6465f`.

## Contexto

Quien abre PitStop sin sesión verá primero una presentación breve del producto, con una foto de marca y dos acciones juntas para crear cuenta o iniciar sesión. Debajo verá tres beneficios concretos y un footer con el logo y los accesos principales.

Hoy el layout protegido lleva a `/login` a quien no tiene sesión. El login ya conserva la pantalla original, pero el registro siempre termina en Inicio y los enlaces entre formularios pierden ese destino. Además, el cierre de sesión vuelve a `/login`.

## Objetivo

Mostrar la landing a visitantes sin sesión y conectar sus acciones con el registro y el login existentes.

**Referencia visual:** pantalla inicial del prototipo al abrirlo sin sesión; bajar hasta los beneficios y el footer. Capturas de celular y escritorio adjuntas al issue.

## Qué tiene que quedar andando

- Al abrir PitStop sin sesión se ve la landing antes del login; con sesión se entra directo a la app.
- “Empezar gratis” y “Crear mi cuenta” llevan al registro; “Iniciar sesión” lleva al login.
- Si alguien abrió un enlace a una pantalla protegida, después de autenticarse vuelve a ese destino.
- El footer muestra el logo y permite volver arriba, iniciar sesión o crear cuenta.
- La landing no tiene cabecera; “Iniciar sesión” aparece como acción secundaria sin fondo junto a “Empezar gratis” sobre la foto. El mensaje entra por partes y se lee en celular y escritorio, también con teclado y movimiento reducido.
- Cerrar sesión vuelve a la landing; el acceso directo a login, registro y recuperación sigue funcionando.
- Desde login se puede volver a la landing; cambiar entre login, registro y recuperación no pierde el destino original.

## Por dónde empezar

1. Crear la ruta pública y ajustar el guard protegido para que lleve allí con el destino original.
2. Construir la landing con los recursos y componentes que ya tiene la app.
3. Conectar login, registro, recuperación y logout sin perder el destino ni las protecciones de sesión.
4. Actualizar las pruebas de redirección y cierre de sesión; probar el recorrido corriendo la app en celular y escritorio.

---

# Especificación técnica

## Datos del ticket

- Estimado: 4 SP (~4 horas con margen).
- Depende de: PIT-31 y PIT-33, ambos Done; no requiere bloqueo activo.
- Proyecto: Auth. Estado inicial: Backlog. Etiquetas: Frontend + Feature.
- Fecha límite y responsable: definir al incorporarlo a la semana, sin desplazar los tickets ya planificados.

## Alcance

- Pantalla pública de presentación, con hero, tres beneficios y footer.
- Navegación entre landing, login, registro, recuperación y rutas protegidas.
- Ajuste del retorno tras login/registro y del destino al cerrar sesión, con las pruebas existentes.
- Sin cambios de API, Firebase ni base de datos; se conservan los campos y validaciones de los formularios.

## Frontend: partir del código actual

1. **Ruta y guard.** `apps/web/src/routes/_app/index.tsx` ya ocupa `/` dentro del layout protegido; dejar ese índice y su pantalla Inicio como están. Crear `apps/web/src/routes/bienvenida.tsx` como ruta pública hermana de `_app` y `_auth`, bajo el `AuthProvider` existente en `routes/__root.tsx`; no envolverla en `AuthLayout`, cuya altura fija y scroll interno son propios de los formularios. En `routes/_app.tsx`, cambiar solamente el destino del `<Navigate>` anónimo de `/login` a `/bienvenida`, manteniendo `replace`, `lastAuthedHrefRef`, `search.redirect`, el loader de `isLoading` y la supresión durante `isSigningOut`. No editar `routeTree.gen.ts`: Vite/TanStack Router lo genera.
2. **Destino seguro.** `lib/redirect.ts` ya tiene `getSafeRedirect()` y pruebas en `redirect.test.ts`. Reutilizarlo en `validateSearch` de `/bienvenida`, `/login`, `/register` y `/forgot-password`. Añadir un helper para el destino posterior a autenticarse que también descarte `/bienvenida`, `/login`, `/register` y `/forgot-password` (con query o hash), evitando que una persona autenticada entre en un bucle de rutas públicas. Usarlo tanto en la landing como en el guard de `_auth.tsx` y al completar login/registro. Mantener el rechazo actual de URL externa, `//` y `/\\`.
3. **Landing y enlaces.** En `routes/bienvenida.tsx`, declarar `createFileRoute('/bienvenida')` con `validateSearch` y usar `useAuth()` para mostrar `FullScreenLoader` durante `isLoading` y redirigir con `replace` al destino seguro o a `/` si ya hay sesión. Importar `apps/web/src/assets/auth-banner.webp` y `pitstop-logo.png`; la foto puede tener `alt=""` porque el texto ya explica el producto y el logo `alt="PitStop"`. Armar hero, beneficios y footer con `Text`, `Icon` y `Button`/`buttonVariants` existentes. Usar `Link` tipado para login y registro, propagando `redirect` validado; “Volver arriba” usa ancla al inicio. No agregar dependencias.
4. **Formularios actuales.** `routes/_auth/login.tsx` ya valida `redirect` y navega a él después de `signInWithEmailAndPassword` + `GET /me`: conservar esa secuencia, `isAuthenticating` y el rollback con Firebase. Pasar `redirect` en su enlace “Registrate” y en “¿Olvidaste tu contraseña?”. `routes/_auth/register.tsx` hoy no declara `validateSearch` y navega siempre a `/`: agregar el parámetro seguro y usarlo al terminar `updateProfile` + `getIdToken(true)` + `GET /me`, sin alterar `accountCreated` ni el reintento. Propagarlo por su enlace de regreso a login. `routes/_auth/forgot-password.tsx` y `components/auth/auth-header.tsx` deben conservar el mismo parámetro en los enlaces/botones de regreso; el login suma una acción de volver a la landing, como en el prototipo. No cambiar validaciones ni mensajes del formulario.
5. **Logout.** En `lib/auth-context.tsx`, el callback `navigateToLogin` de `createSignOut` hoy hace `navigate({ to: '/login', replace: true, search: {} })`; apuntarlo a `/bienvenida` con `replace` y sin `redirect` residual. Renombrar el callback en `lib/sign-out.ts` y `lib/sign-out.test.ts` para reflejar el destino nuevo. Conservar `prepareNotificationLogout`, la limpieza de caché, la deduplicación `inFlight`, la promoción de `unauthorized`, `isSigningOut` y el manejo de errores. No mover navegación a `perfil.tsx`: esa pantalla ya llama `signOut()` del contexto.
6. **Estilos y documentación.** Extender `components/ui/text.tsx` con la variante `landing-headline`; definir en `apps/web/src/styles.css` la animación escalonada y su desactivación con `prefers-reduced-motion`. Usar `min-h-app`/`--app-height` ya existentes para que la PWA instalada tenga altura correcta desde el primer paint. Actualizar `docs/auth.md` con el nuevo recorrido `/bienvenida → /login|/register → destino protegido` y el logout a la landing.

El hero no tiene header ni navegación fija. Sus dos acciones quedan en una fila desde 320 px; en mobile el texto se ancla abajo y desde 1024 px se centra verticalmente. Los beneficios pasan de una a tres columnas desde 768 px y el footer de apilado a horizontal.

## Componentes

- El hero usa imagen de borde a borde, oscurecimiento `neutral-900/95 → neutral-900/15` en desktop y `neutral-900 → neutral-900/25` de abajo hacia arriba en mobile. Sin header. “Empezar gratis” y “Iniciar sesión” se alinean en una fila con separación de 8 px mobile y 12 px desktop; ambos tienen alto mínimo de 48 px.
- Mensaje principal con `Text variant="landing-headline" color="inverse"`, acento `primary` en “siempre al día”. Sobrelinea `overline/inverse`; descripción `body/inverse` al 80%. Añadir `landing-headline` al componente `Text` según `project-plan/design-system.md`. “Empezar gratis” reutiliza `Button primary`, `rounded-full`, `shadow-lg`, hover `red-700`, texto `label/on-primary` e `Icon ArrowRight md/on-primary`. “Iniciar sesión” usa estilo `ghost`, fondo transparente, texto `label/inverse`, `rounded-full`, hover blanco al 10%, sin borde ni sombra; ambos muestran foco visible de alto contraste.
- Beneficios sin tarjetas: borde superior `border`; `Icon CarFront`, `Wrench` y `CalendarDays` tamaño `xl/primary`; título `heading/default`; descripción `body/muted`. El enlace final de registro usa `label/primary`, `ArrowRight sm/primary`, sin sombra.
- Footer `card` con borde superior `border`, logo real, frase `body/muted`, enlaces `label/emphasis` (registro `label/primary`) y copyright `caption/muted`. Borde interno sobre copyright; acciones con hover `primary`. En mobile se apila, en desktop distribuye logo y navegación en dos extremos.
- Foco visible de 2 px con contraste sobre foto y superficies claras. Entrada escalonada: sobrelínea a 80 ms, título a 180 ms, descripción a 310 ms, CTA a 440 ms; cada uno sube 20 px y aparece durante 650 ms. Flecha que se desplaza 4 px al hover; todo desactivado con movimiento reducido.

## Criterios de aceptación técnicos

- Usuario anónimo en `/`, `/garage` o `/calendario` ve `/bienvenida?redirect=...`; usuario autenticado en `/bienvenida` va a Inicio o al destino protegido seguro. No hay parpadeo de login durante `isLoading` ni duplicación de `redirect`.
- Login, registro y recuperación directos siguen accesibles. Cambiar entre ellos conserva el destino; después de login o registro exitoso se abre ese destino. Un `redirect` a URL externa o a ruta pública de auth se descarta y cae en `/`.
- Logout manual exitoso y salida por `401` terminan en `/bienvenida` sin `redirect` viejo. Ante fallo de limpieza del dispositivo, el usuario permanece autenticado y puede reintentar, como hoy.
- Actualizar `lib/redirect.test.ts` para los destinos internos, externos y públicos; actualizar `lib/sign-out.test.ts` para el callback de navegación y conservar sus pruebas de orden, concurrencia y fallos. No añadir una suite que solo duplique el JSX de la landing.
- La imagen, logo, copy, tres beneficios y footer se ven en 320 px y 1440 px. No hay scroll horizontal ni texto sobre una zona de contraste insuficiente.
- Botones, enlaces, foco, Tab, Enter, ancla “Volver arriba” y preferencia de movimiento reducido verificados manualmente.
- Pasan `pnpm --filter web test`, `pnpm format:check`, `pnpm lint`, `pnpm check-types` y `pnpm build` desde la raíz del monorepo.

## Fuera de alcance

- Rediseñar login, registro o recuperación de cuenta; agregar nuevos métodos de autenticación o endpoints.
- Analítica, SEO avanzado, políticas legales o enlaces de redes sociales sin destino real.
