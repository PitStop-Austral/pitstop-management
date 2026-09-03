import type { Backlog, Epic, Feature, Plan } from '../types'

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items
  const next = items.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export function allFeatures(backlog: Backlog): { epic: Epic; feature: Feature }[] {
  return backlog.epics.flatMap((epic) => epic.features.map((feature) => ({ epic, feature })))
}

export function findFeature(backlog: Backlog, id: string): { epic: Epic; feature: Feature } | null {
  return allFeatures(backlog).find((entry) => entry.feature.id === id) ?? null
}

/** Devuelve un id libre a partir de un texto, agregando un sufijo si hace falta. */
export function uniqueId(backlog: Backlog, base: string): string {
  const taken = new Set<string>([
    ...backlog.epics.map((epic) => epic.id),
    ...allFeatures(backlog).map((entry) => entry.feature.id),
  ])
  const slug = slugify(base) || 'nuevo'
  if (!taken.has(slug)) return slug
  for (let n = 2; ; n += 1) {
    const candidate = `${slug}-${n}`
    if (!taken.has(candidate)) return candidate
  }
}

export function updateEpic(plan: Plan, epicId: string, patch: Partial<Epic>): Plan {
  return {
    ...plan,
    backlog: {
      ...plan.backlog,
      epics: plan.backlog.epics.map((epic) => (epic.id === epicId ? { ...epic, ...patch } : epic)),
    },
  }
}

export function updateFeature(plan: Plan, featureId: string, patch: Partial<Feature>): Plan {
  return {
    ...plan,
    backlog: {
      ...plan.backlog,
      epics: plan.backlog.epics.map((epic) => ({
        ...epic,
        features: epic.features.map((feature) =>
          feature.id === featureId ? { ...feature, ...patch } : feature,
        ),
      })),
    },
  }
}

/** Mueve una funcionalidad a otra epica, al final de su lista. */
export function moveFeatureToEpic(plan: Plan, featureId: string, targetEpicId: string): Plan {
  const entry = findFeature(plan.backlog, featureId)
  if (!entry || entry.epic.id === targetEpicId) return plan

  return {
    ...plan,
    backlog: {
      ...plan.backlog,
      epics: plan.backlog.epics.map((epic) => {
        if (epic.id === entry.epic.id) {
          return { ...epic, features: epic.features.filter((f) => f.id !== featureId) }
        }
        if (epic.id === targetEpicId) {
          return { ...epic, features: [...epic.features, entry.feature] }
        }
        return epic
      }),
    },
  }
}

export function removeFeature(plan: Plan, featureId: string): Plan {
  return {
    ...plan,
    backlog: {
      ...plan.backlog,
      epics: plan.backlog.epics.map((epic) => ({
        ...epic,
        // Al borrar una funcionalidad hay que sacarla de las dependencias de las demas.
        features: epic.features
          .filter((feature) => feature.id !== featureId)
          .map((feature) => ({
            ...feature,
            depends_on: feature.depends_on.filter((id) => id !== featureId),
          })),
      })),
    },
  }
}

export function removeEpic(plan: Plan, epicId: string): Plan {
  const epic = plan.backlog.epics.find((e) => e.id === epicId)
  const removedIds = new Set(epic?.features.map((f) => f.id) ?? [])

  return {
    ...plan,
    backlog: {
      ...plan.backlog,
      epics: plan.backlog.epics
        .filter((e) => e.id !== epicId)
        .map((e) => ({
          ...e,
          features: e.features.map((feature) => ({
            ...feature,
            depends_on: feature.depends_on.filter((id) => !removedIds.has(id)),
          })),
        })),
    },
  }
}

export function emptyFeature(id: string): Feature {
  return {
    id,
    title: 'Nueva funcionalidad',
    description: '',
    status: 'todo',
    estimate: null,
    // Sin fechas: el cronograma las ofrece calcular cuando la funcionalidad ya tiene
    // su epica y su estimacion.
    starts: null,
    ends: null,
    prototype: [],
    depends_on: [],
    ticket_refs: [],
  }
}

export function emptyEpic(id: string, sprint: number): Epic {
  return {
    id,
    title: 'Nueva epica',
    description: '',
    sprint,
    linear_project: null,
    moscow: 'must',
    status: 'todo',
    features: [],
  }
}

export type EpicStats = {
  total: number
  done: number
  points: number
  pointsDone: number
  pointsInProgress: number
  /** Porcentaje 0-100, calculado sobre story points terminados. */
  progress: number
  withTickets: number
}

export function epicStats(epic: Epic): EpicStats {
  const points = epic.features.reduce((sum, f) => sum + (f.estimate ?? 0), 0)
  const pointsDone = epic.features
    .filter((f) => f.status === 'done')
    .reduce((sum, f) => sum + (f.estimate ?? 0), 0)
  const pointsInProgress = epic.features
    .filter((f) => f.status === 'in_progress')
    .reduce((sum, f) => sum + (f.estimate ?? 0), 0)
  return {
    total: epic.features.length,
    done: epic.features.filter((f) => f.status === 'done').length,
    points,
    pointsDone,
    pointsInProgress,
    progress: points > 0 ? Math.round((pointsDone / points) * 100) : 0,
    withTickets: epic.features.filter((f) => f.ticket_refs.length > 0).length,
  }
}
