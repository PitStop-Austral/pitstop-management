import { useMemo, useState } from 'react'
import { AlertTriangle, ClipboardCheck, Copy, Link2 } from 'lucide-react'
import type { Epic, Feature, Plan } from '../types'
import { daysUntil, formatShort, planningWeek, toISO } from '../lib/week'
import { Button, Points, SectionTitle, cn } from './ui'

type Candidate = {
  epic: Epic
  feature: Feature
  blockedBy: string[]
}

/**
 * Anticipa que va a agarrar la skill: recorre las epicas del sprint en orden de
 * prioridad y acumula funcionalidades pendientes hasta llenar la capacidad.
 * Es una previsualizacion, no la decision final: la toma Claude.
 */
function pickCandidates(plan: Plan, sprintNumber: number | null): Candidate[] {
  if (sprintNumber == null) return []

  const doneIds = new Set(
    plan.backlog.epics.flatMap((epic) =>
      epic.features.filter((f) => f.status === 'done').map((f) => f.id),
    ),
  )

  const capacity = plan.team.capacity.total_points_per_week
  const picked: Candidate[] = []
  let points = 0

  for (const epic of plan.backlog.epics.filter((e) => e.sprint === sprintNumber)) {
    for (const feature of epic.features) {
      // `backlog` o `ticket_refs` significa que el ticket ya se subio a Linear.
      if (feature.status === 'done' || feature.status === 'backlog') continue
      if (feature.status === 'in_progress' || feature.ticket_refs.length > 0) continue
      if (points >= capacity) return picked

      picked.push({
        epic,
        feature,
        blockedBy: feature.depends_on.filter((id) => !doneIds.has(id)),
      })
      points += feature.estimate ?? 3
    }
  }

  return picked
}

export function WeekPanel({ plan }: { plan: Plan }) {
  const [copied, setCopied] = useState(false)
  const week = useMemo(() => planningWeek(plan.team.sprints), [plan.team.sprints])
  const candidates = useMemo(
    () => pickCandidates(plan, week.sprint?.number ?? null),
    [plan, week.sprint],
  )

  const points = candidates.reduce((sum, c) => sum + (c.feature.estimate ?? 3), 0)
  const capacity = plan.team.capacity.total_points_per_week
  const unassigned = plan.team.people.filter((p) => p.takes_tickets && !p.linear_user_id)

  const prompt = [
    `Armá los tickets de la semana del ${formatShort(week.start)} al ${formatShort(week.due)}`,
    week.sprint ? ` (${week.sprint.name}, semana ${week.weekNumber} de ${week.totalWeeks})` : '',
    '.\n',
    `Fecha límite de todos los tickets: ${toISO(week.due)}.\n`,
    'Usá la skill pitstop-create-linear-tickets.',
  ].join('')

  async function copy() {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const days = daysUntil(week.start)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="card overflow-hidden">
        <div className="border-b border-border bg-muted/40 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Semana a planificar
          </p>
          <h2 className="mt-1 font-display text-2xl">
            {formatShort(week.start)} → {formatShort(week.due)}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {week.sprint
              ? `${week.sprint.name} · semana ${week.weekNumber} de ${week.totalWeeks} · ${week.sprint.theme}`
              : 'Esta semana no cae dentro de ningún sprint cargado.'}
          </p>
        </div>

        <div className="grid grid-cols-3 divide-x divide-border text-center">
          <Cell
            value={days === 0 ? 'hoy' : days === 1 ? 'mañana' : `en ${days} días`}
            label="Arranca"
          />
          <Cell value={`${capacity} SP`} label="Capacidad (3 devs × 6)" />
          <Cell value={`${points} SP`} label="Estimado de la selección" warn={points > capacity} />
        </div>
      </section>

      <section>
        <SectionTitle
          action={
            <Button
              variant="primary"
              onClick={copy}
              icon={copied ? <ClipboardCheck className="size-4" /> : <Copy className="size-4" />}
            >
              {copied ? 'Copiado' : 'Copiar prompt'}
            </Button>
          }
        >
          Pedirle los tickets a Claude
        </SectionTitle>
        <pre className="card whitespace-pre-wrap px-4 py-3 font-sans text-sm leading-relaxed">
          {prompt}
        </pre>
        {unassigned.length > 0 ? (
          <p className="mt-2 flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-xs text-[#92400e]">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            {unassigned.map((p) => p.name).join(', ')} no{' '}
            {unassigned.length === 1 ? 'tiene' : 'tienen'} linear_user_id: sus tickets van a quedar
            sin asignar.
          </p>
        ) : null}
      </section>

      <section>
        <SectionTitle>Lo próximo en la fila</SectionTitle>
        <p className="mb-3 text-xs text-muted-foreground">
          Las primeras funcionalidades pendientes del sprint según tu orden de prioridad. Claude
          decide el corte final.
        </p>

        {candidates.length === 0 ? (
          <p className="card p-6 text-center text-sm text-muted-foreground">
            No quedan funcionalidades pendientes sin ticket en este sprint.
          </p>
        ) : (
          <ol className="card divide-y divide-border">
            {candidates.map(({ epic, feature, blockedBy }, index) => (
              <li key={feature.id} className="flex items-start gap-3 px-4 py-3">
                <span className="w-4 shrink-0 pt-0.5 text-right font-display text-xs text-muted-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{feature.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{epic.title}</p>
                  {blockedBy.length > 0 ? (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-brand-700">
                      <Link2 className="size-3 shrink-0" />
                      Depende de: {blockedBy.join(', ')}
                    </p>
                  ) : null}
                  {!feature.description ? (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-brand-700">
                      <AlertTriangle className="size-3 shrink-0" />
                      Sin descripción: el ticket va a salir pobre.
                    </p>
                  ) : null}
                </div>
                <Points value={feature.estimate} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

function Cell({ value, label, warn }: { value: string; label: string; warn?: boolean }) {
  return (
    <div className="px-3 py-4">
      <p className={cn('font-display text-xl font-bold', warn && 'text-brand-700')}>{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}
