#!/usr/bin/env node
// Compara el backlog local (project-plan/) contra un volcado de Linear y reporta
// todo lo que no coincide. No escribe nada: el que decide y aplica es el agente.
//
//   node reconcile.mjs --linear <dump.json> [--plan <dir>] [--json]
//
// El dump es la respuesta cruda de las herramientas MCP de Linear, en un solo
// objeto: { "issues": [...], "projects": [...] }.

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const argv = process.argv.slice(2)
const arg = (name, def) => {
  const i = argv.indexOf(name)
  return i === -1 ? def : argv[i + 1]
}
const asJson = argv.includes('--json')
const escalaVieja = new Set(
  (arg('--escala-vieja', '') || '').split(',').map((x) => x.trim()).filter(Boolean),
)
const planDir = path.resolve(arg('--plan', 'project-plan'))
const linearPath = arg('--linear')

if (!linearPath) {
  console.error('Falta --linear <dump.json>')
  process.exit(2)
}

// El paquete `yaml` vive en el node_modules de pitstop-management.
const require = createRequire(path.join(planDir, '..', 'package.json'))
const YAML = require('yaml')

const plan = YAML.parse(fs.readFileSync(path.join(planDir, 'features.yaml'), 'utf8'))
const team = YAML.parse(fs.readFileSync(path.join(planDir, 'team.yaml'), 'utf8'))
const dump = JSON.parse(fs.readFileSync(path.resolve(linearPath), 'utf8'))

const issues = dump.issues ?? []
const projects = dump.projects ?? []

// PIT-1 a PIT-4 son los issues de ejemplo que Linear crea al abrir un workspace.
const IGNORAR = new Set(['PIT-1', 'PIT-2', 'PIT-3', 'PIT-4'])

const CANCELADO = new Set(['Canceled', 'Cancelled', 'Duplicate'])
const TERMINADO = new Set(['Done', 'Completed'])
const EMPEZADO = new Set(['In Progress', 'In Review'])

const byId = new Map(issues.map((i) => [i.id, i]))
const feats = []
for (const e of plan.epics ?? []) for (const f of e.features ?? []) feats.push({ epic: e, f })

const refDe = new Map() // PIT-XX -> feature.id
for (const { f } of feats) for (const r of f.ticket_refs ?? []) refDe.set(r, f.id)

const hallazgos = []
const add = (tipo, gravedad, donde, detalle, arreglo) =>
  hallazgos.push({ tipo, gravedad, donde, detalle, arreglo })

// Estado que le corresponde a la funcionalidad segun sus tickets vivos.
function estadoDerivado(refs) {
  const vivos = refs.map((r) => byId.get(r)).filter((i) => i && !CANCELADO.has(i.status))
  if (vivos.length === 0) return 'todo'
  if (vivos.every((i) => TERMINADO.has(i.status))) return 'done'
  if (vivos.some((i) => EMPEZADO.has(i.status) || TERMINADO.has(i.status))) return 'in_progress'
  return 'backlog'
}

for (const { epic, f } of feats) {
  const refs = f.ticket_refs ?? []

  for (const r of refs) {
    const t = byId.get(r)
    if (!t) {
      add('ref colgante', 'alta', f.id,
        `${r} esta en ticket_refs pero no existe en Linear`,
        `borrarlo de ticket_refs, o volver a crear el ticket si se borro por error`)
      continue
    }
    if (CANCELADO.has(t.status)) {
      add('ticket cancelado', 'alta', f.id,
        `${r} esta cancelado en Linear y sigue en ticket_refs`,
        `sacarlo de ticket_refs; si la funcionalidad queda sin tickets, status vuelve a todo`)
    }
    const proyEsperado = epic.linear_project
    if (t.project && proyEsperado && t.project !== proyEsperado) {
      add('project cruzado', 'media', f.id,
        `${r} esta en el project "${t.project}" y su epica apunta a "${proyEsperado}"`,
        `mover el ticket al project de la epica, o corregir linear_project`)
    }
    if (t.dueDate && f.ends && t.dueDate !== f.ends) {
      add('fecha', 'media', f.id,
        `${r} vence ${t.dueDate} y la funcionalidad termina ${f.ends}`,
        `alinear ends con la dueDate del ticket (la dueDate es lo que ve el dev)`)
    }
  }

  // La estimacion solo se puede comparar cuando hay un ticket por funcionalidad.
  const vivos = refs.map((r) => byId.get(r)).filter((i) => i && !CANCELADO.has(i.status))
  if (vivos.length === 1 && !escalaVieja.has(epic.id)) {
    const e = vivos[0].estimate?.value ?? vivos[0].estimate
    if (e != null && f.estimate != null && e !== f.estimate) {
      add('estimacion', 'media', f.id,
        `${vivos[0].id} vale ${e} SP en Linear y ${f.estimate} SP en el plan`,
        `decidir cual es la buena y escribirla en los dos lados`)
    }
    const t = vivos[0]
    if (t.title && f.title && t.title.trim() !== f.title.trim()) {
      add('titulo', 'baja', f.id,
        `${t.id}: "${t.title}" / plan: "${f.title}"`,
        `no siempre es un error, pero si el alcance cambio hay que alinear los dos`)
    }
  }

  const derivado = estadoDerivado(refs)
  if (derivado !== f.status) {
    // blocked lo pone una persona a mano y Linear no lo representa.
    if (f.status !== 'blocked') {
      add('estado', 'alta', f.id,
        `el plan dice ${f.status} y sus tickets en Linear dan ${derivado}`,
        `poner status: ${derivado}`)
    }
  }
  if (refs.length === 0 && f.status === 'backlog') {
    add('estado', 'alta', f.id,
      `esta en backlog pero no tiene ticket_refs`,
      `crear el ticket, o volver el status a todo`)
  }
}

// Tickets de Linear que no pertenecen a ninguna funcionalidad.
for (const t of issues) {
  if (IGNORAR.has(t.id)) continue
  if (refDe.has(t.id)) continue
  if (CANCELADO.has(t.status)) continue
  add('ticket huerfano', 'alta', t.id,
    `"${t.title}" (${t.project ?? 'sin project'}, ${t.status}) no figura en ningun ticket_refs`,
    `agregarlo a la funcionalidad que le corresponde, o crear esa funcionalidad si falta`)
}

// Epicas y projects.
const proyPorNombre = new Map(projects.map((p) => [p.name, p]))
for (const e of plan.epics ?? []) {
  if (!e.linear_project) {
    add('project', 'alta', e.id, `la epica no tiene linear_project`,
      `crear el project en Linear y anotar su nombre en la epica`)
    continue
  }
  const p = proyPorNombre.get(e.linear_project)
  if (!p) {
    add('project', 'alta', e.id,
      `"${e.linear_project}" no existe en Linear`,
      `crearlo, o corregir el nombre en la epica (tiene que coincidir exacto)`)
    continue
  }
  const fechas = (e.features ?? []).flatMap((f) => [f.starts, f.ends]).filter(Boolean).sort()
  if (fechas.length) {
    const [ini, fin] = [fechas[0], fechas[fechas.length - 1]]
    if (p.startDate !== ini || p.targetDate !== fin) {
      add('fechas del project', 'media', e.id,
        `Linear: ${p.startDate} → ${p.targetDate} | plan: ${ini} → ${fin}`,
        `actualizar las fechas del project en Linear`)
    }
  }
}

// Projects de Linear que no son de ninguna epica.
const proyDeEpica = new Set((plan.epics ?? []).map((e) => e.linear_project).filter(Boolean))
for (const p of projects) {
  if (!proyDeEpica.has(p.name)) {
    add('project huerfano', 'media', p.name,
      `existe en Linear y ninguna epica lo referencia`,
      `asignarlo a una epica, o archivarlo si quedo de una version vieja del plan`)
  }
}

// Sprints: los linear_projects de team.yaml tienen que existir.
for (const s of team.sprints ?? []) {
  for (const nombre of s.linear_projects ?? []) {
    if (!proyPorNombre.has(nombre)) {
      add('sprint', 'media', `Sprint ${s.number}`,
        `team.yaml lista el project "${nombre}" y no existe en Linear`,
        `crearlo o corregir el nombre en team.yaml`)
    }
  }
}

if (asJson) {
  console.log(JSON.stringify({ hallazgos }, null, 2))
  process.exit(hallazgos.length ? 1 : 0)
}

const orden = { alta: 0, media: 1, baja: 2 }
hallazgos.sort((a, b) => orden[a.gravedad] - orden[b.gravedad] || a.tipo.localeCompare(b.tipo))

if (!hallazgos.length) {
  console.log('Todo sincronizado: no hay diferencias entre Linear y el plan.')
  process.exit(0)
}
console.log(`${hallazgos.length} diferencia(s) entre Linear y el plan\n`)
let actual = null
for (const h of hallazgos) {
  if (h.gravedad !== actual) {
    actual = h.gravedad
    console.log(`\n── ${actual.toUpperCase()} ──`)
  }
  console.log(`\n[${h.tipo}] ${h.donde}`)
  console.log(`  ${h.detalle}`)
  console.log(`  → ${h.arreglo}`)
}
console.log('')
process.exit(1)
