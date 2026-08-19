import type { Capacity, Feature, Plan } from '../types'
import { addDays, parseISO, planningWeek, toISO, weekGrid, type TimelineWeek } from './week'

/** Lo que vale una funcionalidad sin estimar. Mismo default que usa la pestana Semana. */
export const DEFAULT_ESTIMATE = 3

/** Cuantas semanas mas alla del ultimo sprint puede estirarse el desborde. */
const MAX_OVERFLOW_WEEKS = 52

/** Tope de pasadas del reparto. Corta las dependencias circulares. */
const MAX_ROUNDS = 10

/** La capacidad que el cronograma realmente reparte: el resto es el margen del sprint. */
export function effectiveWeeklyCapacity(capacity: Capacity): number {
  return capacity.total_points_per_week * (1 - (capacity.buffer_ratio ?? 0))
}

export function featurePoints(estimate: number | null): number {
  return estimate ?? DEFAULT_ESTIMATE
}

export type ScheduledDates = { starts: string; ends: string }

/**
 * Reparte todas las funcionalidades en semanas y devuelve las fechas de cada una.
 *
 * Recorre epicas y funcionalidades en el orden de los arrays, que es la prioridad que
 * fijo el PM, y mete cada una en la primera semana que cumpla las tres condiciones:
 * pertenece al sprint de su epica o a uno posterior, es posterior a la semana de todo
 * lo que tiene en `depends_on`, y le queda capacidad efectiva libre.
 *
 * Una dependencia empuja hacia adelante pero no obliga a saltear la semana: lo ideal es
 * que el bloqueante termine antes, y si no se puede, los dos van juntos en la misma
 * semana y a la misma persona, que es la excepcion que el equipo ya tiene acordada.
 * Asi no queda una semana a media carga esperando algo que se resuelve en dos dias.
 *
 * Lo que no entra antes del fin del ultimo sprint cae en semanas de desborde, que
 * quedan sin sprint. Es informacion, no un error: significa que el plan no cierra.
 */
export function scheduleFeatures(plan: Plan): Map<string, ScheduledDates> {
  const weeks = weekGrid(plan.team.sprints)
  if (weeks.length === 0) return new Map()

  const capacity = effectiveWeeklyCapacity(plan.team.capacity)
  const maxWeeks = weeks.length + MAX_OVERFLOW_WEEKS

  /** Estira la grilla con semanas fuera de sprint cuando el trabajo se desborda. */
  function weekAt(index: number): TimelineWeek {
    while (weeks.length <= index && weeks.length < maxWeeks) {
      const last = weeks[weeks.length - 1]
      weeks.push({
        index: weeks.length,
        start: addDays(last.start, 7),
        due: addDays(last.due, 7),
        sprint: null,
        numberInSprint: null,
        totalWeeksInSprint: null,
      })
    }
    return weeks[Math.min(index, weeks.length - 1)]
  }

  /** La semana de la grilla en la que cae una fecha. */
  function weekOf(iso: string): number | null {
    const date = parseISO(iso)
    const week = weeks.find((item) => item.start <= date && date < item.due)
    return week ? week.index : null
  }

  const firstWeek = new Map<number, number>()
  const lastWeek = new Map<number, number>()
  for (const week of weeks) {
    if (!week.sprint) continue
    if (!firstWeek.has(week.sprint.number)) firstWeek.set(week.sprint.number, week.index)
    lastWeek.set(week.sprint.number, week.index)
  }

  /**
   * Cuanto deberia llevar cada semana de un sprint para que el sprint quede parejo.
   * Sin esto el reparto amontona todo lo antes posible y deja el final del sprint vacio:
   * el equipo hace 18 SP tres semanas y 6 la cuarta, cuando podria hacer 13 y 13.
   */
  const targets = new Map<number, number>()
  {
    const totals = new Map<number, number>()
    for (const epic of plan.backlog.epics) {
      const points = epic.features.reduce((sum, f) => sum + featurePoints(f.estimate), 0)
      totals.set(epic.sprint, (totals.get(epic.sprint) ?? 0) + points)
    }
    for (const [sprint, total] of totals) {
      const own = weeks.filter((week) => week.sprint?.number === sprint).length
      targets.set(sprint, own > 0 ? Math.min(capacity, Math.ceil(total / own)) : capacity)
    }
  }

  /** El techo blando de una semana: el objetivo de su sprint, o la capacidad si no tiene. */
  function target(index: number): number {
    return targets.get(weeks[index]?.sprint?.number ?? -1) ?? capacity
  }

  // Nada nuevo se planifica en una semana que ya arranco.
  const now = planningWeek(plan.team.sprints).start
  const floor = weeks.find((week) => week.start >= now)?.index ?? 0

  /**
   * Lo ya comprometido no se mueve: si una funcionalidad salio de `todo` y tiene fechas,
   * es trabajo que alguien ya tiene en la mano. El reparto lo respeta y acomoda el resto
   * alrededor. Las epicas de fixes son el margen del sprint, asi que van siempre a su
   * ultima semana.
   */
  function pinnedWeek(epic: Plan['backlog']['epics'][number], feature: Feature): number | null {
    if (epic.fixes) return lastWeek.get(epic.sprint) ?? null
    if (feature.status === 'todo' || !feature.starts) return null
    return weekOf(feature.starts)
  }

  let placed = new Map<string, number>()

  /**
   * Se reparte varias veces porque una funcionalidad puede depender de otra que se
   * define mas abajo en el backlog: en la primera pasada esa dependencia todavia no
   * tiene semana. Cada ronda solo puede empujar trabajo hacia adelante, asi que
   * converge; el tope de rondas es el corte para dependencias circulares.
   */
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const load: number[] = []
    const current = new Map<string, number>()
    let moved = false

    // Las fijas ocupan su lugar antes que nada, para que el resto las esquive.
    for (const epic of plan.backlog.epics) {
      for (const feature of epic.features) {
        const pinned = pinnedWeek(epic, feature)
        if (pinned === null) continue
        load[pinned] = (load[pinned] ?? 0) + featurePoints(feature.estimate)
        current.set(feature.id, pinned)
      }
    }

    for (const epic of plan.backlog.epics) {
      for (const feature of epic.features) {
        if (pinnedWeek(epic, feature) !== null) continue
        const points = featurePoints(feature.estimate)

        let earliest = Math.max(firstWeek.get(epic.sprint) ?? 0, floor)
        for (const id of feature.depends_on) {
          // La ronda en curso manda; si la dependencia todavia no se ubico en esta
          // pasada, vale la semana que tenia en la anterior. Nunca antes que ella,
          // pero la misma semana esta permitido.
          const dependency = current.get(id) ?? placed.get(id)
          if (dependency !== undefined) earliest = Math.max(earliest, dependency)
        }

        // Primero se busca lugar respetando el objetivo del sprint, para repartir
        // parejo. Si asi no entra en ninguna semana del sprint, se vuelve a buscar
        // contra la capacidad real antes que empujarlo a otro sprint.
        const lastOfSprint = lastWeek.get(epic.sprint) ?? weeks.length - 1
        let index = earliest
        while (index <= lastOfSprint && (load[index] ?? 0) + points > target(index)) index += 1

        if (index > lastOfSprint) {
          index = earliest
          while (index < maxWeeks - 1 && (load[index] ?? 0) + points > capacity) index += 1
        }

        const week = weekAt(index)
        load[week.index] = (load[week.index] ?? 0) + points
        if (placed.get(feature.id) !== week.index) moved = true
        current.set(feature.id, week.index)
      }
    }

    placed = current
    if (!moved) break
  }

  const dates = new Map<string, ScheduledDates>()
  for (const [id, index] of placed) {
    const week = weekAt(index)
    dates.set(id, { starts: toISO(week.start), ends: toISO(week.due) })
  }
  return dates
}

/** Aplica el reparto sobre el plan, pisando las fechas que haya. */
export function withScheduledDates(plan: Plan): Plan {
  const dates = scheduleFeatures(plan)
  return {
    ...plan,
    backlog: {
      ...plan.backlog,
      epics: plan.backlog.epics.map((epic) => ({
        ...epic,
        features: epic.features.map((feature) => {
          const scheduled = dates.get(feature.id)
          return scheduled ? { ...feature, ...scheduled } : feature
        }),
      })),
    },
  }
}

/** Igual que el anterior, pero solo para las funcionalidades que no tienen fechas. */
export function withMissingDates(plan: Plan): Plan {
  const dates = scheduleFeatures(plan)
  return {
    ...plan,
    backlog: {
      ...plan.backlog,
      epics: plan.backlog.epics.map((epic) => ({
        ...epic,
        features: epic.features.map((feature) => {
          if (feature.starts && feature.ends) return feature
          const scheduled = dates.get(feature.id)
          return scheduled ? { ...feature, ...scheduled } : feature
        }),
      })),
    },
  }
}
