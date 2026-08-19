import type { Sprint } from '../types'

const THURSDAY = 4
const DAY_MS = 86_400_000

/** 'YYYY-MM-DD' -> Date local a medianoche, sin corrimientos por zona horaria. */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toISO(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** El proximo jueves a partir de `from`. Si `from` ya es jueves, devuelve ese mismo dia. */
export function nextThursday(from: Date = new Date()): Date {
  const day = startOfDay(from)
  return addDays(day, (THURSDAY - day.getDay() + 7) % 7)
}

/**
 * Una semana del cronograma: de jueves a jueves. Pertenece al sprint que contiene su
 * fecha limite, que es cuando el trabajo tiene que estar terminado.
 */
export type TimelineWeek = {
  /** 0-based, sobre la grilla completa del proyecto. */
  index: number
  /** Jueves en que los devs arrancan. */
  start: Date
  /** Jueves siguiente: la fecha limite de todos los tickets de la semana. */
  due: Date
  sprint: Sprint | null
  /** 1-based dentro del sprint. Null si la semana cae fuera de todos los sprints. */
  numberInSprint: number | null
  totalWeeksInSprint: number | null
}

function sprintOf(sprints: Sprint[], due: Date): Sprint | null {
  return (
    sprints.find(
      (sprint) => parseISO(sprint.starts) <= due && due <= parseISO(sprint.ends),
    ) ?? null
  )
}

/**
 * La grilla de semanas del proyecto: arranca el primer jueves del primer sprint y
 * termina con la semana que vence el ultimo dia del ultimo sprint.
 *
 * Una semana cuenta para un sprint solo si arranca despues de que el sprint empezo,
 * asi la cantidad coincide con el campo `weeks` de cada sprint en team.yaml.
 *
 * `until` extiende la grilla mas alla del ultimo sprint, para poder dibujar el trabajo
 * que se desborda. Esas semanas quedan con `sprint: null`.
 */
export function weekGrid(sprints: Sprint[], until?: Date): TimelineWeek[] {
  if (sprints.length === 0) return []

  const first = nextThursday(parseISO(sprints[0].starts))
  const lastEnd = sprints.reduce(
    (latest, sprint) => (parseISO(sprint.ends) > latest ? parseISO(sprint.ends) : latest),
    parseISO(sprints[0].ends),
  )
  const limit = until && until > lastEnd ? until : lastEnd

  const weeks: TimelineWeek[] = []
  for (let start = first; start < limit; start = addDays(start, 7)) {
    weeks.push({
      index: weeks.length,
      start,
      due: addDays(start, 7),
      sprint: sprintOf(sprints, addDays(start, 7)),
      numberInSprint: null,
      totalWeeksInSprint: null,
    })
  }

  for (const sprint of sprints) {
    const own = weeks.filter((week) => week.sprint?.number === sprint.number)
    own.forEach((week, index) => {
      week.numberInSprint = index + 1
      week.totalWeeksInSprint = own.length
    })
  }

  return weeks
}

export type PlanningWeek = {
  /** Jueves en que los devs arrancan. */
  start: Date
  /** Jueves siguiente: la fecha limite de todos los tickets de la semana. */
  due: Date
  sprint: Sprint | null
  /** 1-based. Null si la semana cae fuera de todos los sprints. */
  weekNumber: number | null
  totalWeeks: number | null
}

/**
 * La semana a planificar: arranca el proximo jueves y vence el jueves siguiente.
 * Sale de la misma grilla que el cronograma para que las dos pestanas cuenten lo mismo.
 */
export function planningWeek(sprints: Sprint[], from: Date = new Date()): PlanningWeek {
  const start = nextThursday(from)
  const due = addDays(start, 7)
  const week = weekGrid(sprints).find((item) => item.start.getTime() === start.getTime())

  return {
    start,
    due,
    sprint: week?.sprint ?? sprintOf(sprints, due),
    weekNumber: week?.numberInSprint ?? null,
    totalWeeks: week?.totalWeeksInSprint ?? null,
  }
}

const WEEKDAY = new Intl.DateTimeFormat('es-AR', { weekday: 'short' })
const LONG = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

/** "jue 20/08" */
export function formatShort(date: Date): string {
  const weekday = WEEKDAY.format(date).replace(/\.$/, '')
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${weekday} ${day}/${month}`
}

/** "jueves 20 de agosto" */
export function formatLong(date: Date): string {
  return LONG.format(date)
}

export function daysUntil(date: Date, from: Date = new Date()): number {
  return Math.round((startOfDay(date).getTime() - startOfDay(from).getTime()) / DAY_MS)
}
