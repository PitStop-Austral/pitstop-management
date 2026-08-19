import { useMemo, useState } from 'react'
import { ChevronDown, FileWarning, Plus, Ticket, Trash2 } from 'lucide-react'
import type { Epic, Feature, Plan } from '../types'
import {
  emptyEpic,
  emptyFeature,
  epicStats,
  moveItem,
  removeEpic,
  uniqueId,
} from '../lib/plan'
import { SortableList, SortableRow } from './Sortable'
import { Button, MoscowBadge, Points, StatusBadge, cn } from './ui'

type Props = {
  plan: Plan
  update: (fn: (plan: Plan) => Plan) => void
  selectedId: string | null
  onSelect: (featureId: string | null) => void
}

export function BacklogTab({ plan, update, selectedId, onSelect }: Props) {
  const [sprintFilter, setSprintFilter] = useState<number | 'todos'>('todos')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const epics = plan.backlog.epics
  const visible = useMemo(
    () => (sprintFilter === 'todos' ? epics : epics.filter((e) => e.sprint === sprintFilter)),
    [epics, sprintFilter],
  )

  /**
   * Con el filtro puesto se reordena dentro del subconjunto visible, pero hay que
   * escribir el movimiento sobre el array completo para no perder las otras epicas.
   */
  function reorderEpics(from: number, to: number) {
    update((current) => {
      const all = current.backlog.epics
      const fromIndex = all.findIndex((e) => e.id === visible[from].id)
      const toIndex = all.findIndex((e) => e.id === visible[to].id)
      return { ...current, backlog: { ...current.backlog, epics: moveItem(all, fromIndex, toIndex) } }
    })
  }

  function reorderFeatures(epicId: string, from: number, to: number) {
    update((current) => ({
      ...current,
      backlog: {
        ...current.backlog,
        epics: current.backlog.epics.map((epic) =>
          epic.id === epicId ? { ...epic, features: moveItem(epic.features, from, to) } : epic,
        ),
      },
    }))
  }

  function addFeature(epicId: string) {
    const id = uniqueId(plan.backlog, `${epicId}-nueva`)
    update((current) => ({
      ...current,
      backlog: {
        ...current.backlog,
        epics: current.backlog.epics.map((epic) =>
          epic.id === epicId ? { ...epic, features: [...epic.features, emptyFeature(id)] } : epic,
        ),
      },
    }))
    onSelect(id)
  }

  function addEpic() {
    const sprint = sprintFilter === 'todos' ? 1 : sprintFilter
    const id = uniqueId(plan.backlog, 'nueva-epica')
    update((current) => ({
      ...current,
      backlog: { ...current.backlog, epics: [...current.backlog.epics, emptyEpic(id, sprint)] },
    }))
  }

  function deleteEpic(epic: Epic) {
    const extra = epic.features.length > 0 ? ` y sus ${epic.features.length} funcionalidades` : ''
    if (!confirm(`Eliminar la epica "${epic.title}"${extra}?`)) return
    update((current) => removeEpic(current, epic.id))
  }

  function toggle(epicId: string) {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(epicId)) next.delete(epicId)
      else next.add(epicId)
      return next
    })
  }

  const sprints = [...new Set(epics.map((e) => e.sprint))].sort((a, b) => a - b)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <FilterChip active={sprintFilter === 'todos'} onClick={() => setSprintFilter('todos')}>
            Todos
          </FilterChip>
          {sprints.map((sprint) => (
            <FilterChip
              key={sprint}
              active={sprintFilter === sprint}
              onClick={() => setSprintFilter(sprint)}
            >
              Sprint {sprint}
            </FilterChip>
          ))}
        </div>
        <Button onClick={addEpic} icon={<Plus className="size-4" />}>
          Épica
        </Button>
      </div>

      <SortableList items={visible} onReorder={reorderEpics}>
        {(epic) => (
          <SortableRow key={epic.id} id={epic.id} className="mb-3">
            <EpicCard
              epic={epic}
              collapsed={collapsed.has(epic.id)}
              selectedId={selectedId}
              onToggle={() => toggle(epic.id)}
              onSelect={onSelect}
              onAddFeature={() => addFeature(epic.id)}
              onDelete={() => deleteEpic(epic)}
              onReorderFeatures={(from, to) => reorderFeatures(epic.id, from, to)}
              onPatch={(patch) =>
                update((current) => ({
                  ...current,
                  backlog: {
                    ...current.backlog,
                    epics: current.backlog.epics.map((e) =>
                      e.id === epic.id ? { ...e, ...patch } : e,
                    ),
                  },
                }))
              }
            />
          </SortableRow>
        )}
      </SortableList>

      {visible.length === 0 ? (
        <p className="card p-8 text-center text-sm text-muted-foreground">
          No hay epicas en este sprint.
        </p>
      ) : null}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
        active
          ? 'border-brand bg-brand text-white'
          : 'border-border bg-card text-muted-foreground hover:bg-muted',
      )}
    >
      {children}
    </button>
  )
}

function EpicCard({
  epic,
  collapsed,
  selectedId,
  onToggle,
  onSelect,
  onAddFeature,
  onDelete,
  onReorderFeatures,
  onPatch,
}: {
  epic: Epic
  collapsed: boolean
  selectedId: string | null
  onToggle: () => void
  onSelect: (id: string) => void
  onAddFeature: () => void
  onDelete: () => void
  onReorderFeatures: (from: number, to: number) => void
  onPatch: (patch: Partial<Epic>) => void
}) {
  const stats = epicStats(epic)

  return (
    <section className="card overflow-hidden">
      <header className="flex items-start gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expandir' : 'Contraer'}
          className="mt-0.5 shrink-0 text-muted-foreground transition hover:text-foreground"
        >
          <ChevronDown className={cn('size-4 transition-transform', collapsed && '-rotate-90')} />
        </button>

        <div className="min-w-0 flex-1">
          <input
            value={epic.title}
            onChange={(event) => onPatch({ title: event.target.value })}
            className="w-full bg-transparent font-display text-[15px] font-bold outline-none
                       focus:rounded focus:bg-muted focus:px-1"
          />
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="rounded bg-muted px-1.5 py-0.5 font-medium">S{epic.sprint}</span>
            <MoscowBadge moscow={epic.moscow} />
            <StatusBadge status={epic.status} />
            <span>
              {stats.done}/{stats.total} listas · {stats.points} SP
            </span>
            {stats.withTickets > 0 ? <span>· {stats.withTickets} con ticket</span> : null}
            <code className="text-[10px] opacity-60">{epic.id}</code>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" onClick={onAddFeature} title="Agregar funcionalidad">
            <Plus className="size-4" />
          </Button>
          <Button variant="ghost" onClick={onDelete} title="Eliminar epica">
            <Trash2 className="size-4 text-brand-700" />
          </Button>
        </div>
      </header>

      {collapsed ? null : (
        <div className="px-3 py-2">
          {epic.features.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              Sin funcionalidades. Agregá la primera con el botón +.
            </p>
          ) : (
            <SortableList items={epic.features} onReorder={onReorderFeatures}>
              {(feature, index) => (
                <SortableRow key={feature.id} id={feature.id}>
                  <FeatureRow
                    feature={feature}
                    position={index + 1}
                    selected={feature.id === selectedId}
                    onClick={() => onSelect(feature.id)}
                  />
                </SortableRow>
              )}
            </SortableList>
          )}
        </div>
      )}
    </section>
  )
}

function FeatureRow({
  feature,
  position,
  selected,
  onClick,
}: {
  feature: Feature
  position: number
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'mb-1 flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition',
        selected ? 'bg-brand-50 ring-1 ring-brand/30' : 'hover:bg-muted',
      )}
    >
      <span className="w-5 shrink-0 text-right font-display text-xs text-muted-foreground">
        {position}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{feature.title}</span>
        {feature.description ? (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {feature.description}
          </span>
        ) : (
          <span className="mt-0.5 flex items-center gap-1 text-xs text-brand-700">
            <FileWarning className="size-3" />
            Falta la descripción
          </span>
        )}
      </span>
      {feature.ticket_refs.length > 0 ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-semibold text-white">
          <Ticket className="size-3" />
          {feature.ticket_refs.join(' ')}
        </span>
      ) : null}
      <Points value={feature.estimate} />
      <StatusBadge status={feature.status} />
    </button>
  )
}
