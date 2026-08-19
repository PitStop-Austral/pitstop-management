import { AlertTriangle, RefreshCw } from 'lucide-react'
import type { Person, Plan } from '../types'
import { Button, Field, SectionTitle, cn } from './ui'

export function TeamTab({ plan, update }: { plan: Plan; update: (fn: (p: Plan) => Plan) => void }) {
  const { people, capacity } = plan.team

  const devs = people.filter((person) => person.takes_tickets)
  const totalPoints = devs.reduce((sum, person) => sum + (person.weekly_points || 0), 0)

  function patchPerson(id: string, changes: Partial<Person>) {
    update((current) => ({
      ...current,
      team: {
        ...current.team,
        people: current.team.people.map((person) =>
          person.id === id ? { ...person, ...changes } : person,
        ),
      },
    }))
  }

  /** La capacidad declarada se mantiene alineada con quienes toman tickets. */
  function syncCapacity() {
    update((current) => ({
      ...current,
      team: {
        ...current.team,
        capacity: {
          ...current.team.capacity,
          developers: devs.length,
          total_points_per_week: totalPoints,
        },
      },
    }))
  }

  const outOfSync =
    capacity.developers !== devs.length || capacity.total_points_per_week !== totalPoints

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section>
        <SectionTitle>Capacidad semanal</SectionTitle>
        <div className="card p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <Stat value={String(devs.length)} label="Devs que toman tickets" />
            <Stat value={`${totalPoints} SP`} label="Capacidad de la semana" />
            <Stat value={`${totalPoints} h`} label="Horas (1 SP = 1 hora)" />
          </div>
          {outOfSync ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-warning-soft px-3 py-2">
              <p className="flex items-start gap-2 text-xs text-[#92400e]">
                <AlertTriangle className="mt-px size-3.5 shrink-0" />
                El yaml declara {capacity.developers} devs y {capacity.total_points_per_week} SP, pero
                las personas suman {devs.length} y {totalPoints} SP.
              </p>
              <Button onClick={syncCapacity} icon={<RefreshCw className="size-3.5" />}>
                Sincronizar
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      <section>
        <SectionTitle>Equipo</SectionTitle>
        <div className="space-y-2">
          {people.map((person) => (
            <article
              key={person.id}
              className={cn('card p-4', person.takes_tickets && 'ring-1 ring-brand/20')}
            >
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_120px]">
                <Field label="Nombre">
                  <input
                    className="field"
                    value={person.name}
                    onChange={(event) => patchPerson(person.id, { name: event.target.value })}
                  />
                </Field>
                <Field label="Rol">
                  <input
                    className="field"
                    value={person.role}
                    onChange={(event) => patchPerson(person.id, { role: event.target.value })}
                  />
                </Field>
                <Field label="SP por semana">
                  <input
                    className="field"
                    type="number"
                    min={0}
                    max={40}
                    value={person.weekly_points}
                    disabled={!person.takes_tickets}
                    onChange={(event) =>
                      patchPerson(person.id, { weekly_points: Number(event.target.value) || 0 })
                    }
                  />
                </Field>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    className="accent-[#e10600]"
                    checked={person.takes_tickets}
                    onChange={(event) =>
                      patchPerson(person.id, {
                        takes_tickets: event.target.checked,
                        weekly_points: event.target.checked ? person.weekly_points || 6 : 0,
                      })
                    }
                  />
                  Toma tickets de desarrollo
                </label>
                <code
                  className={cn(
                    'truncate text-[10px]',
                    person.linear_user_id ? 'text-muted-foreground' : 'text-brand-700',
                  )}
                  title={person.linear_user_id ?? undefined}
                >
                  {person.linear_user_id ?? 'sin linear_user_id: los tickets quedan sin asignar'}
                </code>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Definición de terminado</SectionTitle>
        <ul className="card divide-y divide-border text-sm">
          {plan.team.definition_of_done.map((item) => (
            <li key={item} className="px-4 py-2.5">
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display text-2xl font-bold">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}
