import { CalendarDays, ChevronRight, Link2, Wrench, X } from 'lucide-react'
import type { Plan } from '../types'
import { addDays, formatShort, parseISO, toISO, weekGrid } from '../lib/week'
import { effectiveWeeklyCapacity, featurePoints } from '../lib/schedule'
import { epicColors } from '../lib/epicColor'
import { Button, MoscowBadge, Points, StatusBadge, cn } from './ui'

/**
 * Los tickets de una semana, uno debajo del otro y agrupados por epica. Es la vista de
 * "que se hace esta semana" del cronograma: se abre al apretar una semana en la grilla.
 */
export function WeekDetail({
  plan,
  weekStart,
  onSelect,
  onClose,
}: {
  plan: Plan
  /** Jueves de arranque, en ISO. */
  weekStart: string
  onSelect: (featureId: string) => void
  onClose: () => void
}) {
  const start = parseISO(weekStart)
  // La grilla se estira una semana de mas para que tambien entren las de desborde.
  const week = weekGrid(plan.team.sprints, addDays(start, 7)).find(
    (item) => toISO(item.start) === weekStart,
  )
  const due = week?.due ?? addDays(start, 7)

  const colors = epicColors(plan.backlog.epics)
  const capacity = effectiveWeeklyCapacity(plan.team.capacity)

  const groups = plan.backlog.epics
    .map((epic) => ({
      epic,
      color: colors.get(epic.id) ?? { bar: '#475569', soft: '#f8fafc' },
      features: epic.features.filter((feature) => feature.starts === weekStart),
    }))
    .filter((group) => group.features.length > 0)

  /**
   * Un ticket que depende de otro de la misma semana no se puede repartir: los dos van
   * a la misma persona. Es la excepcion acordada del equipo, y aca es donde hay que
   * verla, al armar el reparto.
   */
  const sameWeek = new Map<string, string[]>()
  for (const group of groups) {
    for (const feature of group.features) {
      const juntos = feature.depends_on
        .map((id) => plan.backlog.epics.flatMap((e) => e.features).find((f) => f.id === id))
        .filter((dep) => dep?.starts === weekStart)
        .map((dep) => dep!.title)
      if (juntos.length > 0) sameWeek.set(feature.id, juntos)
    }
  }

  const points = groups.reduce(
    (sum, group) => sum + group.features.reduce((s, f) => s + featurePoints(f.estimate), 0),
    0,
  )
  const count = groups.reduce((sum, group) => sum + group.features.length, 0)

  return (
    <aside className="flex h-full flex-col">
      <header className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 truncate text-sm">
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
            Semana del {formatShort(start)}
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {week?.sprint
              ? `${week.sprint.name} · semana ${week.numberInSprint} de ${week.totalWeeksInSprint}`
              : 'Fuera de todos los sprints'}{' '}
            · vence el {formatShort(due)}
          </p>
        </div>
        <Button variant="ghost" onClick={onClose} title="Cerrar">
          <X className="size-4" />
        </Button>
      </header>

      <div className="flex items-baseline justify-between border-b border-border px-4 py-2.5">
        <span className="text-[11px] text-muted-foreground">
          {count} {count === 1 ? 'ticket' : 'tickets'}
        </span>
        <span
          className={cn(
            'font-display text-sm font-bold',
            points > capacity ? 'text-brand-700' : undefined,
          )}
        >
          {points} / {capacity} SP
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {groups.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No hay tickets planificados para esta semana.
          </p>
        ) : (
          groups.map(({ epic, color, features }) => (
            <section key={epic.id}>
              <h3 className="flex items-center gap-1.5 bg-muted/50 px-4 py-1.5 text-[11px] font-semibold">
                <span className="size-2 shrink-0 rounded-full" style={{ background: color.bar }} />
                {epic.fixes ? <Wrench className="size-3 shrink-0 text-muted-foreground" /> : null}
                <span className="truncate">{epic.title}</span>
              </h3>

              <ul className="divide-y divide-border">
                {features.map((feature) => (
                  <li key={feature.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(feature.id)}
                      className="flex w-full items-start gap-2 px-4 py-2.5 text-left transition hover:bg-muted"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{feature.title}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={feature.status} />
                          <MoscowBadge moscow={feature.moscow ?? epic.moscow} />
                          <Points value={feature.estimate} />
                          {feature.ticket_refs.length > 0 ? (
                            <span className="rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-semibold text-white">
                              {feature.ticket_refs.join(' ')}
                            </span>
                          ) : null}
                        </span>
                        {sameWeek.has(feature.id) ? (
                          <span className="mt-1.5 flex items-start gap-1 text-[11px] text-[#92400e]">
                            <Link2 className="mt-px size-3 shrink-0" />
                            Va con {sameWeek.get(feature.id)!.join(' y ')}: misma semana, misma
                            persona.
                          </span>
                        ) : null}
                      </span>
                      <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </aside>
  )
}
