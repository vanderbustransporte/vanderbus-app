import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
const viajes = []
let nextId = 1
function apiPlugin() {
  return {
    name: 'api-viajes',
    configureServer(server) {
      server.middlewares.use('/api/viajes', (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        if (req.method === 'GET') {
          res.end(JSON.stringify(viajes))
          return
        }
        if (req.method === 'POST') {
          let body = ''
          req.on('data', chunk => { body += chunk })
          req.on('end', () => {
            const data = body ? JSON.parse(body) : {}
            const viaje = { id: nextId++, ...data }
            viajes.push(viaje)
            res.statusCode = 201
            res.end(JSON.stringify(viaje))
          })
          return
        }
        res.statusCode = 405
        res.end(JSON.stringify({ error: 'Method not allowed' }))
      })
    },
  }
}
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), apiPlugin()],
})