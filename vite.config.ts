import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { handleApi } from './server/plan-api'

/** Expone la API que lee y escribe los yaml de project-plan/ sin un server aparte. */
function planApi(): Plugin {
  return {
    name: 'plan-api',
    configureServer(server) {
      server.middlewares.use(handleApi)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleApi)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), planApi()],
  server: {
    port: 5180,
    open: true,
    // El autoguardado reescribe estos yaml todo el tiempo. Sin esto, cada guardado
    // dispara un full-reload y se pierde el foco de lo que estabas escribiendo.
    watch: { ignored: ['**/project-plan/**'] },
  },
})
