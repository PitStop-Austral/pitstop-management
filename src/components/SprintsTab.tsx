import { CalendarRange, CircleSlash, FolderGit2, Repeat } from 'lucide-react'
import type { Plan, Sprint } from '../types'
import { formatLong, parseISO } from '../lib/week'
import { Field, SectionTitle } from './ui'

export function SprintsTab({
  plan,
  update,
}: {
  plan: Plan
  update: (fn: (p: Plan) => Plan) => void
}) {
  function patchSprint(number: number, changes: Partial<Sprint>) {
    update((current) => ({
      ...current,
      team: {
        ...current.team,
        sprints: current.team.sprints.map((sprint) =>
          sprint.number === number ? { ...sprint, ...changes } : sprint,
        ),
      },
    }))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section>
        <SectionTitle>Sprints</SectionTitle>
        <p className="mb-3 text-xs text-muted-foreground">
          Las semanas del equipo van de jueves a jueves. Una semana pertenece al sprint donde cae su
          fecha límite.
        </p>

        <div className="space-y-3">
          {plan.team.sprints.map((sprint) => {
            const epics = plan.backlog.epics.filter((epic) => epic.sprint === sprint.number)
            const points = epics.reduce(
              (sum, epic) => sum + epic.features.reduce((s, f) => s + (f.estimate ?? 0), 0),
              0,
            )
            const capacity = sprint.weeks * plan.team.capacity.total_points_per_week

            return (
              <article key={sprint.number} className="card p-4">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_150px]">
                  <Field label="Tema">
                    <input
                      className="field"
                      value={sprint.theme}
                      onChange={(event) => patchSprint(sprint.number, { theme: event.target.value })}
                    />
                  </Field>
                  <Field label="Arranca">
                    <input
                      className="field"
                      type="date"
                      value={sprint.starts}
                      onChange={(event) =>
                        patchSprint(sprint.number, { starts: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Termina">
                    <input
                      className="field"
                      type="date"
                      value={sprint.ends}
                      onChange={(event) => patchSprint(sprint.number, { ends: event.target.value })}
                    />
                  </Field>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">
                    {sprint.name}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarRange className="size-3" />
                    {formatLong(parseISO(sprint.starts))} al {formatLong(parseISO(sprint.ends))}
                  </span>
                  <span>{sprint.weeks} semanas · {capacity} SP de capacidad</span>
                  <span className={points > capacity ? 'font-semibold text-brand-700' : undefined}>
                    {epics.length} épicas · {points} SP estimados
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                  <Repeat className="size-3" />
                  <code>{sprint.cycle_id ?? 'sin cycle'}</code>
                  {sprint.linear_projects.length > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <FolderGit2 className="size-3" />
                      {sprint.linear_projects.join(', ')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-brand-700">
                      <CircleSlash className="size-3" />
                      sin projects en Linear
                    </span>
                  )}
                </div>

                {sprint.notes ? (
                  <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-[11px] text-muted-foreground">
                    {sprint.notes}
                  </p>
                ) : null}
              </article>
            )
          })}
        </div>
      </section>

      <section>
        <SectionTitle>Fuera de alcance</SectionTitle>
        <p className="mb-3 text-xs text-muted-foreground">
          Del charter. Claude nunca genera tickets para esto.
        </p>
        <ul className="card divide-y divide-border text-sm">
          {plan.backlog.out_of_scope.map((item) => (
            <li key={item} className="flex items-center gap-2 px-4 py-2.5">
              <CircleSlash className="size-3.5 shrink-0 text-muted-foreground" />
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
