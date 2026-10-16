import { useMemo, useState } from 'react'
import { Copy, Download } from 'lucide-react'
import type { Plan, TimelineReportCategory } from '../types'
import { createTimelineReport, timelineReportPng, timelineReportRows } from '../lib/timelineReport'
import { toISO } from '../lib/week'
import { Button } from './ui'

export function TimelineReport({ plan, update }: { plan: Plan; update: (fn: (plan: Plan) => Plan) => void }) {
  const [cutoff, setCutoff] = useState(toISO(new Date()))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const rows = useMemo(() => timelineReportRows(plan), [plan])
  const source = useMemo(() => createTimelineReport(rows, cutoff, plan.team.sprints), [rows, cutoff, plan.team.sprints])
  const canCopy = typeof ClipboardItem !== 'undefined' && Boolean(navigator.clipboard?.write)

  function patch(id: string, values: Partial<TimelineReportCategory>) {
    update((current) => ({ ...current, backlog: { ...current.backlog,
      timeline_report: current.backlog.timeline_report?.map((category) => category.id === id ? { ...category, ...values } : category),
    } }))
  }

  async function exportImage(copy: boolean) {
    setBusy(true)
    setMessage('')
    try {
      const png = timelineReportPng(source)
      if (copy) {
        // Start the clipboard write during the click gesture, including in Safari.
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
        setMessage('Imagen copiada. Ya puedes pegarla en tu presentación.')
      } else {
        const url = URL.createObjectURL(await png)
        const link = document.createElement('a')
        link.href = url
        link.download = `pitstop-cronograma-${cutoff}.png`
        link.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
        setMessage('PNG descargado en 4320 × 2160.')
      }
    } catch (error) {
      setMessage(copy ? 'No se pudo copiar la imagen. Usa Descargar PNG para insertarla en la slide.' : error instanceof Error ? error.message : 'No se pudo exportar la imagen.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="space-y-3" aria-label="Cronograma para presentación">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <label className="text-xs font-semibold text-muted-foreground">Fecha de referencia
        <input className="field mt-1" type="date" required value={cutoff} onChange={(event) => { if (event.target.value) setCutoff(event.target.value) }} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !canCopy || !rows.length} onClick={() => void exportImage(true)} icon={<Copy className="size-4" />}>Copiar imagen</Button>
        <Button disabled={busy || !rows.length} onClick={() => void exportImage(false)} icon={<Download className="size-4" />}>{busy ? 'Preparando…' : 'Descargar PNG'}</Button>
      </div>
    </div>
    <p className="text-xs text-muted-foreground">PNG transparente · 4320 × 2160 px · Estado actual del cronograma.</p>
    {message && <p role="status" className="text-sm">{message}</p>}
    {!canCopy && <p className="text-xs text-muted-foreground">La copia de imágenes requiere un navegador compatible en HTTPS o localhost. Puedes descargar el PNG.</p>}
    <div className="overflow-hidden rounded-xl border border-border [&_svg]:block [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: source }} />
    <details className="rounded-xl border border-border bg-card p-4">
      <summary className="text-sm font-semibold">Datos de comparación y categorías</summary>
      <p className="my-3 text-xs text-muted-foreground">La estimación y el avance automático se actualizan desde las tareas vinculadas. Deja el avance manual vacío para usar SP terminados. La línea base y el fin real se guardan con el plan. El desvío es línea base − fin real, o línea base − estimación si sigue pendiente.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead><tr>{['Categoría / épicas', 'Inicio base', 'Fin base', 'Fin estimado', 'Fin real', 'Avance manual (%)'].map((label) => <th key={label} className="px-2 py-2 font-semibold">{label}</th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id} className="border-t border-border">
            <td className="min-w-48 px-2 py-2"><strong>{row.title}</strong><div className="mt-1 text-muted-foreground">{plan.backlog.epics.filter((epic) => row.epic_ids.includes(epic.id)).map((epic) => epic.title).join(' · ') || 'Sin épicas vinculadas'}</div></td>
            {(['baseline_start', 'baseline_end'] as const).map((key) => <td key={key} className="px-2 py-2"><input type="date" aria-label={`${row.title}: ${key === 'baseline_start' ? 'inicio base' : 'fin base'}`} className="field min-w-36" value={row[key] ?? ''} max={key === 'baseline_start' ? row.baseline_end ?? undefined : undefined} min={key === 'baseline_end' ? row.baseline_start ?? undefined : undefined} onChange={(event) => patch(row.id, { [key]: event.target.value || null })} /></td>)}
            <td className="whitespace-nowrap px-2 py-2">{row.estimatedEnd ?? 'Sin fecha'}</td>
            <td className="px-2 py-2"><input type="date" aria-label={`${row.title}: fin real`} className="field min-w-36" disabled={!row.completed} value={row.actual_end ?? ''} min={row.start ?? undefined} onChange={(event) => patch(row.id, { actual_end: event.target.value || null })} /></td>
            <td className="px-2 py-2"><input type="number" aria-label={`${row.title}: avance manual`} className="field w-28" min="0" max="99" step="1" disabled={row.completed} placeholder={`${row.completion}% auto`} value={row.progress ?? ''} onChange={(event) => patch(row.id, { progress: event.target.value === '' ? null : Math.max(0, Math.min(99, Math.round(Number(event.target.value)))) })} /></td>
          </tr>)}</tbody>
        </table>
      </div>
    </details>
  </section>
}
