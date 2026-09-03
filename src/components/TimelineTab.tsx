import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronDown,
  GitBranch,
  RotateCcw,
  Wrench,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { Epic, Feature, Plan, Sprint } from '../types'
import { daysUntil, formatShort, parseISO, toISO, weekGrid, type TimelineWeek } from '../lib/week'
import {
  effectiveWeeklyCapacity,
  featurePoints,
  withMissingDates,
  withScheduledDates,
} from '../lib/schedule'
import { epicColors, type EpicColor } from '../lib/epicColor'
import { epicStats } from '../lib/plan'
import { Button, ProgressBar, cn } from './ui'

const RAIL = 248
const ZOOMS = [8, 12, 18] as const
const SPRINT_BAND = 30
const WEEK_ROW = 40
const CAPACITY_ROW = 28
const HEADER = SPRINT_BAND + WEEK_ROW + CAPACITY_ROW
const ROW = 34
/** Umbral antes de tomar el arrastre como paneo, para no comerse los clicks. */
const PAN_THRESHOLD = 4

type Row =
  | { kind: 'sprint'; key: string; y: number; sprint: Sprint | null; weeks: TimelineWeek[] }
  | { kind: 'epic'; key: string; y: number; epic: Epic; color: EpicColor; collapsed: boolean }
  | { kind: 'feature'; key: string; y: number; epic: Epic; feature: Feature; color: EpicColor }

export function TimelineTab({
  plan,
  update,
  selectedId,
  onSelect,
  selectedWeek,
  onSelectWeek,
}: {
  plan: Plan
  update: (fn: (plan: Plan) => Plan) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** Jueves de arranque de la semana abierta en el panel, en ISO. */
  selectedWeek: string | null
  onSelectWeek: (weekStart: string | null) => void
}) {
  const [zoom, setZoom] = useState(1)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [allDeps, setAllDeps] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const dayPx = ZOOMS[zoom]

  const colors = useMemo(() => epicColors(plan.backlog.epics), [plan.backlog.epics])
  const capacity = effectiveWeeklyCapacity(plan.team.capacity)

  /** La grilla se estira hasta cubrir la fecha mas lejana que haya cargada. */
  const weeks = useMemo(() => {
    let latest = parseISO(plan.team.sprints.at(-1)?.ends ?? toISO(new Date()))
    for (const epic of plan.backlog.epics) {
      for (const feature of epic.features) {
        if (feature.ends && parseISO(feature.ends) > latest) latest = parseISO(feature.ends)
      }
    }
    return weekGrid(plan.team.sprints, latest)
  }, [plan.team.sprints, plan.backlog.epics])

  const origin = weeks[0]?.start ?? new Date()
  const totalWidth = weeks.length * 7 * dayPx

  /** SP planificados por semana, para la tira de capacidad y el margen. */
  const loadByWeek = useMemo(() => {
    const load = new Map<string, number>()
    for (const epic of plan.backlog.epics) {
      for (const feature of epic.features) {
        if (!feature.starts) continue
        const key = weekKeyOf(weeks, feature.starts)
        if (key) load.set(key, (load.get(key) ?? 0) + featurePoints(feature.estimate))
      }
    }
    return load
  }, [plan.backlog.epics, weeks])

  const rows = useMemo(() => {
    const list: Row[] = []
    let y = 0
    let sprint: number | null | undefined

    for (const epic of plan.backlog.epics) {
      if (epic.sprint !== sprint) {
        sprint = epic.sprint
        const own = weeks.filter((week) => week.sprint?.number === epic.sprint)
        list.push({
          kind: 'sprint',
          key: `sprint-${epic.sprint}`,
          y,
          sprint: own[0]?.sprint ?? null,
          weeks: own,
        })
        y += ROW
      }

      const color = colors.get(epic.id) ?? { bar: '#475569', soft: '#f8fafc' }
      const isCollapsed = collapsed.has(epic.id)
      list.push({ kind: 'epic', key: epic.id, y, epic, color, collapsed: isCollapsed })
      y += ROW

      if (isCollapsed) continue
      for (const feature of epic.features) {
        list.push({ kind: 'feature', key: feature.id, y, epic, feature, color })
        y += ROW
      }
    }
    return list
  }, [plan.backlog.epics, colors, collapsed, weeks])

  const totalHeight = (rows.at(-1)?.y ?? 0) + ROW

  const undated = useMemo(
    () =>
      plan.backlog.epics.flatMap((epic) =>
        epic.features.filter((feature) => !feature.starts || !feature.ends),
      ),
    [plan.backlog.epics],
  )

  const overflow = weeks.filter((week) => !week.sprint)
  const overflowPoints = overflow.reduce(
    (sum, week) => sum + (loadByWeek.get(toISO(week.start)) ?? 0),
    0,
  )

  const x = (iso: string) => Math.max(0, daysUntil(parseISO(iso), origin) * dayPx)

  /** Centra la vista en la semana en curso la primera vez que se abre la pestana. */
  useEffect(() => {
    const node = scroller.current
    if (!node || weeks.length === 0) return
    node.scrollLeft = Math.max(0, daysUntil(new Date(), origin) * dayPx - 240)
    // Solo al montar: a partir de ahi el scroll lo maneja el usuario.
  }, [])

  function toggle(epicId: string) {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(epicId)) next.delete(epicId)
      else next.add(epicId)
      return next
    })
  }

  function recalculate() {
    const total = plan.backlog.epics.reduce((sum, epic) => sum + epic.features.length, 0)
    const message =
      `Recalcular reparte las ${total} funcionalidades segun prioridad, dependencias y ` +
      'capacidad, y pisa las fechas que hayas ajustado a mano. ¿Seguir?'
    if (!confirm(message)) return
    update((current) => withScheduledDates(current))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <CalendarClock className="size-4" />
          <span>
            {weeks.length} semanas · {plan.team.capacity.total_points_per_week} SP por semana, de
            los que se planifican {round(capacity)} y {round(plan.team.capacity.total_points_per_week - capacity)} quedan de margen
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <input
              type="checkbox"
              className="accent-[#e10600]"
              checked={allDeps}
              onChange={(event) => setAllDeps(event.target.checked)}
            />
            <GitBranch className="size-3.5" />
            Todas las dependencias
          </label>
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
            <IconButton
              label="Alejar"
              disabled={zoom === 0}
              onClick={() => setZoom((z) => Math.max(0, z - 1))}
            >
              <ZoomOut className="size-4" />
            </IconButton>
            <IconButton
              label="Acercar"
              disabled={zoom === ZOOMS.length - 1}
              onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))}
            >
              <ZoomIn className="size-4" />
            </IconButton>
          </div>
          <Button onClick={() => setCollapsed(new Set(collapsed.size ? [] : plan.backlog.epics.map((e) => e.id)))}>
            {collapsed.size ? 'Expandir todo' : 'Colapsar todo'}
          </Button>
          <Button onClick={recalculate} icon={<RotateCcw className="size-4" />}>
            Recalcular fechas
          </Button>
        </div>
      </div>

      {undated.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warning-soft px-4 py-2.5">
          <p className="flex items-center gap-2 text-xs text-[#92400e]">
            <AlertTriangle className="size-4 shrink-0" />
            {undated.length === 1
              ? `"${undated[0].title}" todavía no tiene fechas.`
              : `${undated.length} funcionalidades todavía no tienen fechas.`}
          </p>
          <Button onClick={() => update((current) => withMissingDates(current))}>Ubicarlas</Button>
        </div>
      ) : null}

      {overflowPoints > 0 ? (
        <p className="flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-2.5 text-xs text-brand-700">
          <AlertTriangle className="size-4 shrink-0" />
          {overflowPoints} SP quedan fuera de los sprints, después del{' '}
          {formatShort(parseISO(plan.team.sprints.at(-1)?.ends ?? toISO(new Date())))}. Hay que
          recortar alcance, mover funcionalidades de sprint o estirar el último.
        </p>
      ) : null}

      <div className="card overflow-hidden">
        <Panner ref={scroller}>
          <div className="relative" style={{ width: RAIL + totalWidth, height: HEADER + totalHeight }}>
            <Header
              weeks={weeks}
              dayPx={dayPx}
              capacity={capacity}
              loadByWeek={loadByWeek}
              totalWidth={totalWidth}
              selectedWeek={selectedWeek}
              onSelectWeek={onSelectWeek}
            />

            <SelectedWeek
              weeks={weeks}
              dayPx={dayPx}
              selectedWeek={selectedWeek}
              height={HEADER + totalHeight}
            />

            {rows.map((row) =>
              row.kind === 'sprint' ? (
                <SprintRow key={row.key} row={row} dayPx={dayPx} x={x} plan={plan} />
              ) : row.kind === 'epic' ? (
                <EpicRow key={row.key} row={row} x={x} onToggle={() => toggle(row.epic.id)} />
              ) : (
                <FeatureRow
                  key={row.key}
                  row={row}
                  dayPx={dayPx}
                  x={x}
                  selected={row.feature.id === selectedId}
                  onSelect={() => onSelect(row.feature.id === selectedId ? null : row.feature.id)}
                />
              ),
            )}

            <Dependencies
              rows={rows}
              x={x}
              selectedId={selectedId}
              all={allDeps}
              width={RAIL + totalWidth}
              height={HEADER + totalHeight}
            />

            <Today origin={origin} dayPx={dayPx} height={HEADER + totalHeight} />
          </div>
        </Panner>
      </div>
    </div>
  )
}

function round(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',')
}

/** La semana de la grilla a la que pertenece una fecha de inicio. */
function weekKeyOf(weeks: TimelineWeek[], iso: string): string | null {
  const date = parseISO(iso)
  const week = weeks.find((item) => item.start <= date && date < item.due)
  return week ? toISO(week.start) : null
}

/** Contenedor con paneo libre: se arrastra el fondo para moverse. */
function Panner({ ref, children }: { ref: React.RefObject<HTMLDivElement | null>; children: React.ReactNode }) {
  const [panning, setPanning] = useState(false)

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const node = ref.current
    if (!node || event.button !== 0) return

    const from = { x: event.clientX, y: event.clientY }
    const scroll = { left: node.scrollLeft, top: node.scrollTop }
    let active = false

    function onMove(move: PointerEvent) {
      const dx = move.clientX - from.x
      const dy = move.clientY - from.y
      if (!active && Math.abs(dx) + Math.abs(dy) < PAN_THRESHOLD) return
      if (!active) {
        active = true
        setPanning(true)
      }
      node!.scrollLeft = scroll.left - dx
      node!.scrollTop = scroll.top - dy
    }

    function onUp() {
      setPanning(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      className={cn(
        'max-h-[calc(100vh-14rem)] overflow-auto overscroll-x-contain',
        panning ? 'cursor-grabbing select-none' : 'cursor-grab',
      )}
    >
      {children}
    </div>
  )
}

function Header({
  weeks,
  dayPx,
  capacity,
  loadByWeek,
  totalWidth,
  selectedWeek,
  onSelectWeek,
}: {
  weeks: TimelineWeek[]
  dayPx: number
  capacity: number
  loadByWeek: Map<string, number>
  totalWidth: number
  selectedWeek: string | null
  onSelectWeek: (weekStart: string | null) => void
}) {
  const weekPx = 7 * dayPx
  const sprints: { sprint: Sprint | null; from: number; span: number; points: number }[] = []

  for (const week of weeks) {
    const last = sprints.at(-1)
    const same = last && last.sprint?.number === week.sprint?.number
    const points = loadByWeek.get(toISO(week.start)) ?? 0
    if (same) {
      last.span += 1
      last.points += points
    } else {
      sprints.push({ sprint: week.sprint, from: week.index, span: 1, points })
    }
  }

  return (
    <div className="sticky top-0 z-30" style={{ height: HEADER }}>
      <div className="absolute inset-0 bg-card" />

      <div className="absolute top-0" style={{ left: RAIL, width: totalWidth, height: HEADER }}>
        {sprints.map((band) => (
          <div
            key={`${band.sprint?.number ?? 'fuera'}-${band.from}`}
            className={cn(
              'absolute flex items-center gap-2 overflow-hidden border-b border-r border-border px-2 text-[11px] font-semibold',
              band.sprint ? 'bg-muted/60' : 'bg-brand-50 text-brand-700',
            )}
            style={{ left: band.from * weekPx, width: band.span * weekPx, height: SPRINT_BAND }}
          >
            <span className="truncate">
              {band.sprint ? band.sprint.name : 'Fuera de sprint'}
            </span>
            <span className="truncate font-normal text-muted-foreground">
              {band.sprint
                ? `${band.span} sem · ${band.points}/${round(band.span * capacity)} SP · ${band.sprint.theme}`
                : `${band.points} SP sin sprint`}
            </span>
          </div>
        ))}

        {weeks.map((week) => {
          const key = toISO(week.start)
          const used = loadByWeek.get(key) ?? 0
          const free = week.sprint && used === 0
          const open = selectedWeek === key
          return (
            <button
              key={week.index}
              type="button"
              onClick={() => onSelectWeek(open ? null : key)}
              title={`Ver los tickets de la semana del ${formatShort(week.start)}`}
              className={cn(
                'absolute border-r border-border text-left transition',
                open ? 'bg-brand-50' : 'hover:bg-muted/60',
              )}
              style={{ left: week.index * weekPx, width: weekPx, top: SPRINT_BAND }}
            >
              <div
                className="flex flex-col justify-center border-b border-border px-1.5"
                style={{ height: WEEK_ROW }}
              >
                <span className="truncate text-[11px] font-semibold">
                  {week.sprint ? `S${week.sprint.number} · sem ${week.numberInSprint}` : 'Sin sprint'}
                </span>
                <span className="truncate text-[10px] text-muted-foreground">
                  {formatShort(week.start)} → {formatShort(week.due)}
                </span>
              </div>

              <div
                className={cn(
                  'flex flex-col justify-center gap-1 border-b border-border px-1.5',
                  free && 'bg-[repeating-linear-gradient(135deg,#f4f4f5_0_6px,transparent_6px_12px)]',
                )}
                style={{ height: CAPACITY_ROW }}
              >
                <span
                  className={cn(
                    'truncate text-[10px] font-semibold',
                    used > capacity ? 'text-brand-700' : 'text-muted-foreground',
                  )}
                >
                  {free ? 'Libre' : `${used} / ${round(capacity)} SP`}
                </span>
                <span className="block h-1 rounded-full bg-muted">
                  <span
                    className={cn(
                      'block h-1 rounded-full',
                      used > capacity ? 'bg-brand' : 'bg-success',
                    )}
                    style={{ width: `${Math.min(100, (used / capacity) * 100)}%` }}
                  />
                </span>
              </div>
            </button>
          )
        })}
      </div>

      <div
        className="sticky left-0 top-0 z-40 border-b border-r border-border bg-card"
        style={{ width: RAIL, height: HEADER }}
      >
        <p className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Épicas y tickets
        </p>
        <p className="px-3 pt-1 text-[10px] text-muted-foreground">
          Arrastrá el fondo para moverte
        </p>
      </div>
    </div>
  )
}

function Rail({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'sticky left-0 z-20 flex h-full items-center gap-1.5 border-r border-border bg-card px-2',
        className,
      )}
      style={{ width: RAIL, minWidth: RAIL }}
    >
      {children}
    </div>
  )
}

function RowShell({ y, children, className }: { y: number; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn('absolute inset-x-0 flex border-b border-border', className)}
      style={{ top: HEADER + y, height: ROW }}
    >
      {children}
    </div>
  )
}

function SprintRow({
  row,
  dayPx,
  x,
  plan,
}: {
  row: Extract<Row, { kind: 'sprint' }>
  dayPx: number
  x: (iso: string) => number
  plan: Plan
}) {
  const epics = plan.backlog.epics.filter((epic) => epic.sprint === row.sprint?.number)
  const points = epics.reduce(
    (sum, epic) => sum + epic.features.reduce((s, f) => s + featurePoints(f.estimate), 0),
    0,
  )

  return (
    <RowShell y={row.y} className="bg-muted/40">
      <Rail className="bg-muted/40">
        <span className="truncate text-xs font-bold">{row.sprint?.name ?? 'Fuera de sprint'}</span>
        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{points} SP</span>
      </Rail>
      {row.sprint && row.weeks.length > 0 ? (
        <div
          className="absolute inset-y-2 rounded-md bg-foreground/5"
          style={{
            left: RAIL + x(toISO(row.weeks[0].start)) + 2,
            width: Math.max(0, row.weeks.length * 7 * dayPx - 4),
          }}
        />
      ) : null}
    </RowShell>
  )
}

function EpicRow({
  row,
  x,
  onToggle,
}: {
  row: Extract<Row, { kind: 'epic' }>
  x: (iso: string) => number
  onToggle: () => void
}) {
  const dated = row.epic.features.filter((f) => f.starts && f.ends)
  const from = dated.length ? dated.reduce((min, f) => (f.starts! < min ? f.starts! : min), dated[0].starts!) : null
  const to = dated.length ? dated.reduce((max, f) => (f.ends! > max ? f.ends! : max), dated[0].ends!) : null
  const stats = epicStats(row.epic)

  return (
    <RowShell y={row.y}>
      <Rail>
        <button
          type="button"
          onClick={onToggle}
          aria-label={row.collapsed ? 'Expandir' : 'Contraer'}
          className="shrink-0 text-muted-foreground transition hover:text-foreground"
        >
          <ChevronDown className={cn('size-4 transition-transform', row.collapsed && '-rotate-90')} />
        </button>
        <span className="size-2.5 shrink-0 rounded-full" style={{ background: row.color.bar }} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-xs font-semibold" title={row.epic.title}>
            {row.epic.title}
          </span>
          <div className="flex items-center gap-1.5">
            <ProgressBar
              done={stats.pointsDone}
              inProgress={stats.pointsInProgress}
              total={stats.points}
              className="h-1"
            />
            <span className="shrink-0 text-[9px] font-semibold text-muted-foreground">
              {stats.progress}%
            </span>
          </div>
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {row.epic.features.length}
        </span>
      </Rail>

      {from && to ? (
        <div
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full opacity-40"
          style={{ left: RAIL + x(from), width: Math.max(4, x(to) - x(from)), background: row.color.bar }}
        />
      ) : null}
    </RowShell>
  )
}

function FeatureRow({
  row,
  dayPx,
  x,
  selected,
  onSelect,
}: {
  row: Extract<Row, { kind: 'feature' }>
  dayPx: number
  x: (iso: string) => number
  selected: boolean
  onSelect: () => void
}) {
  const { feature, color, epic } = row
  const points = featurePoints(feature.estimate)
  const left = feature.starts ? RAIL + x(feature.starts) : null
  const width =
    feature.starts && feature.ends
      ? Math.max(dayPx * 2, x(feature.ends) - x(feature.starts))
      : 0

  return (
    <RowShell y={row.y} className={cn(selected && 'bg-brand-50/50')}>
      <Rail className={cn(selected && 'bg-brand-50/50')}>
        <span className="w-3.5 shrink-0" />
        <span className="size-1.5 shrink-0 rounded-full" style={{ background: color.bar }} />
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 truncate text-left text-xs hover:underline"
          title={feature.title}
        >
          {feature.title}
        </button>
        <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">{points}</span>
      </Rail>

      {left !== null && width > 0 ? (
        <button
          type="button"
          onClick={onSelect}
          title={`${feature.title} · ${points} SP · ${feature.starts} → ${feature.ends}`}
          className={cn(
            'absolute top-1/2 flex h-6 -translate-y-1/2 items-center gap-1 overflow-hidden rounded-md px-1.5 text-[10px] font-semibold text-white transition',
            'hover:brightness-110',
            selected && 'ring-2 ring-foreground ring-offset-1',
            feature.status === 'done' && 'opacity-55',
          )}
          style={{
            left,
            width,
            background: epic.fixes
              ? `repeating-linear-gradient(135deg, ${color.bar} 0 6px, ${color.bar}bb 6px 12px)`
              : color.bar,
          }}
        >
          {epic.fixes ? <Wrench className="size-3 shrink-0" /> : null}
          {feature.status === 'done' ? <Check className="size-3 shrink-0" /> : null}
          <span className="truncate">{feature.title}</span>
        </button>
      ) : (
        <span
          className="absolute top-1/2 -translate-y-1/2 text-[10px] text-brand-700"
          style={{ left: RAIL + 8 }}
        >
          sin fechas
        </span>
      )}
    </RowShell>
  )
}

/**
 * Flechas de dependencia. Por defecto solo las del ticket seleccionado: casi todas las
 * funcionalidades dependen de alguna, y dibujarlas todas de una tapa el cronograma.
 */
function Dependencies({
  rows,
  x,
  selectedId,
  all,
  width,
  height,
}: {
  rows: Row[]
  x: (iso: string) => number
  selectedId: string | null
  all: boolean
  width: number
  height: number
}) {
  const position = new Map<string, { y: number; from: number; to: number }>()
  const epicOf = new Map<string, string>()

  for (const row of rows) {
    if (row.kind === 'feature' && row.feature.starts && row.feature.ends) {
      position.set(row.feature.id, {
        y: HEADER + row.y + ROW / 2,
        from: RAIL + x(row.feature.starts),
        to: RAIL + x(row.feature.ends),
      })
      epicOf.set(row.feature.id, row.epic.id)
    }
  }

  const links: { from: string; to: string }[] = []
  for (const row of rows) {
    if (row.kind !== 'feature') continue
    for (const dependency of row.feature.depends_on) {
      const involved = selectedId === row.feature.id || selectedId === dependency
      if (!all && !involved) continue
      if (position.has(dependency) && position.has(row.feature.id)) {
        links.push({ from: dependency, to: row.feature.id })
      }
    }
  }

  if (links.length === 0) return null

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 z-10"
      width={width}
      height={height}
      aria-hidden="true"
    >
      <defs>
        <marker id="dep-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0 0 L6 3 L0 6 z" fill="#71717a" />
        </marker>
      </defs>
      {links.map(({ from, to }) => {
        const a = position.get(from)!
        const b = position.get(to)!
        // Si comparten semana las barras se solapan: un gancho quedaria yendo para
        // atras, asi que se las une con un tramo vertical sobre el borde comun.
        const sameWeek = b.from < a.to
        const d = sameWeek
          ? `M ${a.from + 6} ${a.y} V ${b.y}`
          : `M ${a.to} ${a.y} H ${Math.max(a.to + 6, b.from - 10)} V ${b.y} H ${b.from - 4}`
        return (
          <path
            key={`${from}->${to}`}
            d={d}
            fill="none"
            stroke="#71717a"
            strokeWidth="1.5"
            strokeDasharray="3 2"
            markerEnd="url(#dep-arrow)"
          />
        )
      })}
    </svg>
  )
}

/** Resalta de arriba a abajo la semana abierta en el panel. */
function SelectedWeek({
  weeks,
  dayPx,
  selectedWeek,
  height,
}: {
  weeks: TimelineWeek[]
  dayPx: number
  selectedWeek: string | null
  height: number
}) {
  const week = weeks.find((item) => toISO(item.start) === selectedWeek)
  if (!week) return null

  return (
    <div
      className="pointer-events-none absolute top-0 border-x border-brand/40 bg-brand/5"
      style={{ left: RAIL + week.index * 7 * dayPx, width: 7 * dayPx, height }}
    />
  )
}

function Today({ origin, dayPx, height }: { origin: Date; dayPx: number; height: number }) {
  const offset = daysUntil(new Date(), origin)
  if (offset < 0) return null

  return (
    <div
      className="pointer-events-none absolute top-0 z-10 w-px bg-brand"
      style={{ left: RAIL + offset * dayPx, height }}
    >
      <span className="absolute -left-4 top-0 rounded-b bg-brand px-1 py-0.5 text-[9px] font-bold text-white">
        hoy
      </span>
    </div>
  )
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
    >
      {children}
    </button>
  )
}
