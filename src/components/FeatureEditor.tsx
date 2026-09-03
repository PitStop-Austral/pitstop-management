import { useState } from 'react'
import { AlertTriangle, Plus, Trash2, X } from 'lucide-react'
import { ESTIMATES, MOSCOW, STATUSES, type Feature, type Plan } from '../types'
import { MOSCOW_LABEL, STATUS_LABEL } from '../types'
import { allFeatures, findFeature, moveFeatureToEpic, removeFeature, updateFeature } from '../lib/plan'
import { isActiveRisk, linkRiskFeature, riskScore } from '../lib/risks'
import { Button, Field, cn } from './ui'

type Props = {
  plan: Plan
  featureId: string
  prototypeFiles: string[]
  update: (fn: (plan: Plan) => Plan) => void
  onClose: () => void
}

export function FeatureEditor({ plan, featureId, prototypeFiles, update, onClose }: Props) {
  const entry = findFeature(plan.backlog, featureId)
  if (!entry) return null
  const { epic, feature } = entry

  function patch(changes: Partial<Feature>) {
    update((current) => updateFeature(current, featureId, changes))
  }

  function remove() {
    if (!confirm(`Eliminar la funcionalidad "${feature.title}"?`)) return
    update((current) => removeFeature(current, featureId))
    onClose()
  }

  const others = allFeatures(plan.backlog).filter((item) => item.feature.id !== featureId)

  return (
    <aside className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm">Funcionalidad</h2>
          <code className="text-[11px] text-muted-foreground">{feature.id}</code>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="danger" onClick={remove} icon={<Trash2 className="size-3.5" />}>
            Eliminar
          </Button>
          <Button variant="ghost" onClick={onClose} title="Cerrar">
            <X className="size-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <Field label="Título">
          <input
            className="field"
            value={feature.title}
            onChange={(event) => patch({ title: event.target.value })}
          />
        </Field>

        <Field
          label="Descripción"
          hint="Qué tiene que pasar, en criollo. Es el input principal del ticket: Claude lee esto, mira el prototipo y escribe el cómo."
        >
          <textarea
            className="field min-h-52 resize-y leading-relaxed"
            value={feature.description}
            onChange={(event) => patch({ description: event.target.value })}
            placeholder="El usuario tiene que poder..."
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Estado">
            <select
              className="field"
              value={feature.status}
              onChange={(event) => patch({ status: event.target.value as Feature['status'] })}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Story points" hint="1 SP = 1 hora">
            <select
              className="field"
              value={feature.estimate ?? ''}
              onChange={(event) =>
                patch({ estimate: event.target.value === '' ? null : Number(event.target.value) })
              }
            >
              <option value="">Sin estimar</option>
              {ESTIMATES.map((points) => (
                <option key={points} value={points}>
                  {points} SP
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Inicio estimado">
              <input
                className="field"
                type="date"
                value={feature.starts ?? ''}
                onChange={(event) => patch({ starts: event.target.value || null })}
              />
            </Field>
            <Field label="Fin estimado" hint="Es la fecha límite del ticket.">
              <input
                className="field"
                type="date"
                value={feature.ends ?? ''}
                onChange={(event) => patch({ ends: event.target.value || null })}
              />
            </Field>
          </div>
          {feature.starts && feature.ends && feature.ends < feature.starts ? (
            <p className="mt-1 text-[11px] text-brand-700">
              El fin cae antes que el inicio: en el cronograma se dibuja igual, pero conviene
              corregirlo.
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Mové las fechas y la barra se acomoda sola en el cronograma.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Épica">
            <select
              className="field"
              value={epic.id}
              onChange={(event) =>
                update((current) => moveFeatureToEpic(current, featureId, event.target.value))
              }
            >
              {plan.backlog.epics.map((option) => (
                <option key={option.id} value={option.id}>
                  S{option.sprint} · {option.title}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Prioridad" hint="Vacío = hereda la de la épica">
            <select
              className="field"
              value={feature.moscow ?? ''}
              onChange={(event) =>
                patch({
                  moscow: event.target.value === '' ? undefined : (event.target.value as never),
                })
              }
            >
              <option value="">Hereda ({MOSCOW_LABEL[epic.moscow]})</option>
              {MOSCOW.map((value) => (
                <option key={value} value={value}>
                  {MOSCOW_LABEL[value]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <TokenList
          label="Referencias del prototipo"
          hint="Archivos que muestran cómo está resuelto. Claude los abre antes de escribir el ticket."
          values={feature.prototype}
          onChange={(prototype) => patch({ prototype })}
          suggestions={prototypeFiles}
          placeholder="components/pitstop/screens/garage.tsx"
        />

        <div>
          <span className="label">Depende de</span>
          <p className="mb-2 text-[11px] text-muted-foreground">
            Solo lo que realmente no se puede empezar antes. Cuantas menos dependencias, mejor se
            reparte la semana.
          </p>
          <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-xl border border-border p-1.5">
            {others.map(({ epic: otherEpic, feature: other }) => {
              const checked = feature.depends_on.includes(other.id)
              return (
                <label
                  key={other.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-xs transition',
                    checked ? 'bg-brand-50' : 'hover:bg-muted',
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-[#e10600]"
                    checked={checked}
                    onChange={() =>
                      patch({
                        depends_on: checked
                          ? feature.depends_on.filter((id) => id !== other.id)
                          : [...feature.depends_on, other.id],
                      })
                    }
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{other.title}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      S{otherEpic.sprint} · {otherEpic.title}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        <div>
          <span className="label">Riesgos asociados</span>
          <p className="mb-2 text-[11px] text-muted-foreground">
            Exposiciones que pueden afectar esta funcionalidad. Los críticos aparecen también en el cronograma.
          </p>
          <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-xl border border-border p-1.5">
            {plan.riskRegister.risks.length === 0 ? (
              <p className="px-2 py-2 text-[11px] text-muted-foreground">No hay riesgos cargados todavía.</p>
            ) : plan.riskRegister.risks.map((risk) => {
              const checked = risk.related_feature_ids.includes(featureId)
              const critical = riskScore(risk) >= 15 && isActiveRisk(risk)
              return (
                <label key={risk.id} className={cn('flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-xs transition', checked && 'bg-brand-50')}>
                  <input type="checkbox" className="mt-0.5 accent-[#e10600]" checked={checked} onChange={(event) => update((current) => linkRiskFeature(current, risk.id, featureId, event.target.checked))} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 font-medium"><span className="truncate">{risk.title}</span>{critical ? <AlertTriangle className="size-3 shrink-0 text-brand-700" /> : null}</span>
                    <span className="block text-[10px] text-muted-foreground">{riskScore(risk)} puntos · {risk.status}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        <TokenList
          label="Tickets de Linear"
          hint="Los completa Claude al crear los tickets. Editalos solo para corregir."
          values={feature.ticket_refs}
          onChange={(ticket_refs) => patch({ ticket_refs })}
          placeholder="PIT-42"
        />
      </div>
    </aside>
  )
}

/** Lista de strings editable como chips, con autocompletado opcional. */
function TokenList({
  label,
  hint,
  values,
  onChange,
  suggestions,
  placeholder,
}: {
  label: string
  hint?: string
  values: string[]
  onChange: (values: string[]) => void
  suggestions?: string[]
  placeholder?: string
}) {
  const [draft, setDraft] = useState('')
  const listId = suggestions ? `${label.replace(/\s/g, '-')}-options` : undefined

  function add() {
    const value = draft.trim()
    if (!value || values.includes(value)) return setDraft('')
    onChange([...values, value])
    setDraft('')
  }

  return (
    <div>
      <span className="label">{label}</span>
      {hint ? <p className="mb-2 text-[11px] text-muted-foreground">{hint}</p> : null}

      {values.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {values.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px]"
            >
              <code className="max-w-64 truncate">{value}</code>
              <button
                type="button"
                aria-label={`Quitar ${value}`}
                className="text-muted-foreground hover:text-brand-700"
                onClick={() => onChange(values.filter((item) => item !== value))}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2">
        <input
          className="field"
          list={listId}
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              add()
            }
          }}
        />
        <Button onClick={add} disabled={!draft.trim()} icon={<Plus className="size-3.5" />}>
          Agregar
        </Button>
      </div>

      {suggestions ? (
        <datalist id={listId}>
          {suggestions.map((file) => (
            <option key={file} value={file} />
          ))}
        </datalist>
      ) : null}
    </div>
  )
}
