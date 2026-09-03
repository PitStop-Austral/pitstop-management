import type { ReactNode } from 'react'
import {
  CircleDashed,
  CircleDot,
  CirclePause,
  CircleCheck,
  GripVertical,
  Inbox,
  type LucideIcon,
} from 'lucide-react'
import { MOSCOW_LABEL, STATUS_LABEL, type Moscow, type Status } from '../types'

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

const STATUS_STYLE: Record<Status, string> = {
  todo: 'bg-muted text-muted-foreground',
  backlog: 'bg-[#eef0fb] text-[#4550b8]',
  in_progress: 'bg-warning-soft text-[#92400e]',
  done: 'bg-success-soft text-[#15803d]',
  blocked: 'bg-brand-50 text-brand-700',
}

const STATUS_ICON: Record<Status, LucideIcon> = {
  todo: CircleDashed,
  backlog: Inbox,
  in_progress: CircleDot,
  done: CircleCheck,
  blocked: CirclePause,
}

export function StatusBadge({ status }: { status: Status }) {
  const Icon = STATUS_ICON[status]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        STATUS_STYLE[status],
      )}
    >
      <Icon className="size-3" />
      {STATUS_LABEL[status]}
    </span>
  )
}

export function MoscowBadge({ moscow }: { moscow: Moscow }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        moscow === 'must'
          ? 'border-brand/30 text-brand-700'
          : 'border-border text-muted-foreground',
      )}
    >
      {MOSCOW_LABEL[moscow]}
    </span>
  )
}

export function Points({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="shrink-0 text-[11px] text-muted-foreground">sin SP</span>
  }
  return (
    <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-display text-[11px] font-bold">
      {value} SP
    </span>
  )
}

/**
 * Barra de progreso basada en story points. `done` y `inProgress` se pintan como
 * dos segmentos apilados sobre `total`; si no hay SP la barra queda vacia.
 */
export function ProgressBar({
  done,
  inProgress = 0,
  total,
  className,
}: {
  done: number
  inProgress?: number
  total: number
  className?: string
}) {
  const donePct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
  const inProgressPct =
    total > 0 ? Math.min(100 - donePct, Math.round((inProgress / total) * 100)) : 0
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}
      role="progressbar"
      aria-valuenow={donePct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="flex h-full">
        <span className="block h-full bg-success" style={{ width: `${donePct}%` }} />
        <span className="block h-full bg-warning/70" style={{ width: `${inProgressPct}%` }} />
      </div>
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span> : null}
    </label>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base">{children}</h2>
      {action}
    </div>
  )
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  type = 'button',
  disabled,
  title,
  icon,
}: {
  children?: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  type?: 'button' | 'submit'
  disabled?: boolean
  title?: string
  /** Icono de lucide a la izquierda del texto. */
  icon?: ReactNode
}) {
  const styles = {
    primary: 'bg-brand text-white hover:bg-brand-700',
    secondary: 'border border-border bg-card hover:bg-muted',
    ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
    danger: 'border border-brand/30 text-brand-700 hover:bg-brand-50',
  }[variant]

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition',
        'disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]',
        styles,
      )}
    >
      {icon}
      {children}
    </button>
  )
}

/** Manija de arrastre. El drag se activa solo desde acá, no desde toda la fila. */
export function DragHandle(props: Record<string, unknown>) {
  return (
    <button
      type="button"
      aria-label="Reordenar"
      className="cursor-grab touch-none rounded-md px-1 py-1 text-muted-foreground
                 hover:bg-muted hover:text-foreground active:cursor-grabbing"
      {...props}
    >
      <GripVertical className="size-3.5" aria-hidden="true" />
    </button>
  )
}
