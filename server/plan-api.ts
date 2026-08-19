import { existsSync } from 'node:fs'
import { readdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { parse, stringify } from 'yaml'
import type { Plan } from '../src/types'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const FILES = {
  backlog: path.join(root, 'project-plan', 'features.yaml'),
  team: path.join(root, 'project-plan', 'team.yaml'),
}

/** El prototipo vive fuera de este repo; si no esta, el autocompletado queda vacio. */
const PROTOTYPE_ROOT = path.resolve(root, '..', 'PitStop Prototype')

const HEADER = [
  '# Generado por PitStop Management (npm run dev).',
  '# Se puede editar a mano, pero la app reescribe el archivo entero al guardar,',
  '# asi que los comentarios que agregues aca se van a perder.',
  '',
].join('\n')

const STRINGIFY_OPTIONS = { lineWidth: 88, minContentWidth: 24 } as const

async function readYaml<T>(file: string): Promise<T> {
  return parse(await readFile(file, 'utf8')) as T
}

/** Escribe primero en un temporal y despues renombra, para no dejar el yaml a medias. */
async function writeYaml(file: string, data: unknown): Promise<void> {
  const tmp = `${file}.tmp`
  await writeFile(tmp, HEADER + stringify(data, STRINGIFY_OPTIONS), 'utf8')
  await rename(tmp, file)
}

export async function readPlan(): Promise<Plan> {
  const [backlog, team] = await Promise.all([
    readYaml<Plan['backlog']>(FILES.backlog),
    readYaml<Plan['team']>(FILES.team),
  ])
  return { backlog, team }
}

/**
 * Rechaza cualquier cosa que no parezca un plan valido. La app es la unica que
 * escribe estos archivos, asi que un bug en el front no puede vaciarlos.
 */
function validate(plan: unknown): string | null {
  const p = plan as Partial<Plan> | null
  if (!p || typeof p !== 'object') return 'El cuerpo no es un objeto'
  if (!p.backlog || !Array.isArray(p.backlog.epics)) return 'Falta backlog.epics'
  if (!p.team || !Array.isArray(p.team.people)) return 'Falta team.people'
  if (p.backlog.epics.length === 0) return 'El backlog no puede quedar sin epicas'
  if (p.team.people.length === 0) return 'El equipo no puede quedar vacio'

  const ids = new Set<string>()
  for (const epic of p.backlog.epics) {
    if (!epic.id) return 'Hay una epica sin id'
    if (ids.has(epic.id)) return `Id de epica repetido: ${epic.id}`
    ids.add(epic.id)
    if (!Array.isArray(epic.features)) return `La epica ${epic.id} no tiene features`
    for (const feature of epic.features) {
      if (!feature.id) return `Hay una funcionalidad sin id en ${epic.id}`
      if (ids.has(feature.id)) return `Id de funcionalidad repetido: ${feature.id}`
      ids.add(feature.id)
    }
  }
  return null
}

export async function writePlan(plan: Plan): Promise<void> {
  await Promise.all([writeYaml(FILES.backlog, plan.backlog), writeYaml(FILES.team, plan.team)])
}

/** Rutas del prototipo relativas a su raiz, para el autocompletado del editor. */
export async function listPrototypeFiles(): Promise<string[]> {
  if (!existsSync(PROTOTYPE_ROOT)) return []

  const found: string[] = []
  const skip = new Set(['node_modules', '.next', '.git'])

  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || skip.has(entry.name)) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (/\.(tsx|ts|css|md)$/.test(entry.name)) {
        found.push(path.relative(PROTOTYPE_ROOT, full))
      }
    }
  }

  await walk(PROTOTYPE_ROOT)
  return found.sort()
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

/** Middleware que atiende /api/*. Se monta tanto en dev como en preview. */
export async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
): Promise<void> {
  const url = (req.url ?? '').split('?')[0]
  if (!url.startsWith('/api/')) return next()

  try {
    if (url === '/api/plan' && req.method === 'GET') {
      return json(res, 200, await readPlan())
    }

    if (url === '/api/plan' && req.method === 'PUT') {
      const plan = JSON.parse(await readBody(req)) as Plan
      const error = validate(plan)
      if (error) return json(res, 400, { error })
      await writePlan(plan)
      return json(res, 200, { ok: true, savedAt: new Date().toISOString() })
    }

    if (url === '/api/prototype-files' && req.method === 'GET') {
      return json(res, 200, { files: await listPrototypeFiles() })
    }

    return json(res, 404, { error: `Ruta desconocida: ${req.method} ${url}` })
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : String(error) })
  }
}
