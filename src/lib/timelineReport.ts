import type { Plan, Sprint, TimelineReportCategory } from '../types'
import { addDays, daysUntil, parseISO, toISO } from './week.ts'

export type ReportRow = TimelineReportCategory & {
  start: string | null
  estimatedEnd: string | null
  completion: number
  completed: boolean
  deviation: number | null
  featureCount: number
}

export function timelineReportRows(plan: Plan): ReportRow[] {
  return (plan.backlog.timeline_report ?? []).map((category) => {
    const features = plan.backlog.epics.filter((epic) => category.epic_ids.includes(epic.id)).flatMap((epic) => epic.features)
    const starts = features.flatMap((feature) => feature.starts ? [feature.starts] : []).sort()
    const ends = features.flatMap((feature) => feature.ends ? [feature.ends] : []).sort()
    const points = features.reduce((sum, feature) => sum + (feature.estimate ?? 3), 0)
    const done = features.filter((feature) => feature.status === 'done').reduce((sum, feature) => sum + (feature.estimate ?? 3), 0)
    const completed = features.length > 0 && features.every((feature) => feature.status === 'done')
    const completion = completed ? 100 : Math.min(99, category.progress ?? (points ? Math.round(done / points * 100) : 0))
    // A partially dated category has no reliable finish forecast.
    const estimatedEnd = features.length > 0 && ends.length === features.length ? ends.at(-1)! : null
    const finish = completed ? category.actual_end : estimatedEnd
    return {
      ...category, start: starts[0] ?? null, estimatedEnd, completion, completed,
      deviation: finish && category.baseline_end ? daysUntil(parseISO(category.baseline_end), parseISO(finish)) : null,
      featureCount: features.length,
    }
  })
}

const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const short = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
export const REPORT_WIDTH = 2160
export const REPORT_HEIGHT = 1080

/** Transparent slide graphic; the schedule remains the source of bar dates. */
export function createTimelineReport(rows: ReportRow[], cutoff: string, sprints: Sprint[] = []): string {
  const left = 470, right = 1840, top = 150, bottom = 1048
  const rowHeight = (bottom - top) / Math.max(1, rows.length)
  const allDates = rows.flatMap((row) => [row.start, row.estimatedEnd, row.baseline_start, row.baseline_end, row.completed ? row.actual_end : null]).filter((date): date is string => Boolean(date))
  allDates.push(cutoff, ...sprints.map((sprint) => sprint.ends))
  allDates.sort()
  const first = parseISO(allDates[0])
  const origin = addDays(first, -((first.getDay() - 4 + 7) % 7))
  const last = parseISO(allDates.at(-1)!)
  const days = Math.max(7, Math.ceil(daysUntil(last, origin) / 7) * 7)
  const x = (iso: string) => left + daysUntil(parseISO(iso), origin) / days * (right - left)
  const text = (value: string, tx: number, ty: number, size = 18, fill = '#080808', weight = 700, anchor = 'start', display = false) =>
    `<text x="${tx}" y="${ty}" font-size="${size}" fill="${fill}" font-weight="${weight}" text-anchor="${anchor}" font-family="${display ? 'Unbounded' : 'Arial, sans-serif'}">${escape(value)}</text>`
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const weekWidth = (right - left) * 7 / days
  let grid = ''
  for (let day = 0; day <= days; day += 7) {
    const date = addDays(origin, day)
    const dx = x(toISO(date))
    grid += `<line x1="${dx}" x2="${dx}" y1="${top}" y2="${bottom}" stroke="#e8e8e8" stroke-width="1"/>`
    if (day < days) grid += text(`${date.getDate()} ${months[date.getMonth()]}`, dx + weekWidth / 2, 128, 18, '#080808', 700, 'middle')
  }
  for (let index = 0; index <= rows.length; index += 1) {
    const y = top + index * rowHeight
    grid += `<line x1="${left}" x2="${right}" y1="${y}" y2="${y}" stroke="#e8e8e8" stroke-width="1"/>`
  }
  const bands = sprints.map((sprint, index) => {
    const start = index === 0 ? toISO(origin) : sprints[index - 1].ends
    const from = Math.max(left, x(start)), to = Math.min(right, x(sprint.ends))
    if (to <= from) return ''
    return text(`Sprint ${sprint.number}`, (from + to) / 2, 88, 24, '#080808', 700, 'middle') +
      `<line x1="${to}" x2="${to}" y1="${top}" y2="${bottom}" stroke="#333" stroke-width="2"/>` +
      text(`Fin S${sprint.number} · ${short(sprint.ends)}`, to, 1074, 15, '#333333', 700, to >= right - 70 ? 'end' : 'middle')
  }).join('')
  const bars = rows.map((row, index) => {
    const y = top + index * rowHeight
    const finish = row.completed ? row.actual_end ?? row.estimatedEnd : row.estimatedEnd
    const start = row.start ?? row.baseline_start
    const barHeight = Math.min(44, rowHeight - 16)
    const barY = y + (rowHeight - barHeight) / 2
    let marks = ''
    if (start && finish) {
      const bx = x(start), width = Math.max(4, x(finish) - bx)
      const color = row.completed ? '#00bf63' : row.completion > 0 ? '#ffe8c5' : '#d4d4d4'
      marks = `<rect x="${bx}" y="${barY}" width="${width}" height="${barHeight}" rx="14" fill="${color}"/>`
      if (!row.completed && row.completion > 0) {
        const progressWidth = width * row.completion / 100
        marks += `<rect x="${bx}" y="${barY}" width="${progressWidth}" height="${barHeight}" rx="${Math.min(14, progressWidth / 2)}" fill="#ffbd59"/>`
      }
    }
    if (row.baseline_start && row.baseline_end) {
      marks += `<line x1="${x(row.baseline_start)}" x2="${x(row.baseline_end)}" y1="${barY + barHeight + 6}" y2="${barY + barHeight + 6}" stroke="#737373" stroke-width="7" stroke-linecap="round"/>`
    }
    const delta = row.deviation === null ? '—' : row.deviation > 0 ? `+${row.deviation}` : String(row.deviation)
    const deltaColor = row.deviation === null || row.deviation === 0 ? '#555555' : row.deviation > 0 ? '#008846' : '#b90800'
    marks += text(`${row.completed ? '✓ ' : ''}${row.completion} %`, 1935, y + rowHeight / 2 + 10, 29, row.completed ? '#008846' : '#080808', 700, 'middle')
    marks += text(delta, 2070, y + rowHeight / 2 + 10, 29, deltaColor, 700, 'middle')
    const status = row.completed ? 'Finalizado' : row.completion > 0 ? 'En curso' : 'Pendiente'
    return `<g><title>${escape(`${row.title}. ${status}. Avance: ${row.completion}%. Fin: ${finish ?? 'sin fecha'}.`)}</title>
      ${text(row.title.toLocaleUpperCase('es-AR'), 438, y + rowHeight / 2 + 9, 25, '#000000', 900, 'end', true)}${marks}</g>`
  }).join('')
  const todayX = x(cutoff)
  const badgeWidth = 180
  const badgeX = Math.max(left, Math.min(right - badgeWidth, todayX - badgeWidth / 2))
  const markerLabel = cutoff === toISO(new Date()) ? 'Hoy' : short(cutoff)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${REPORT_WIDTH}" height="${REPORT_HEIGHT}" viewBox="0 0 ${REPORT_WIDTH} ${REPORT_HEIGHT}" role="img" aria-label="Cronograma del proyecto PitStop por categorías">
    <line x1="80" x2="120" y1="121" y2="121" stroke="#737373" stroke-width="7" stroke-linecap="round"/>
    ${text('Línea base', 132, 127, 18, '#555555', 400)}
    ${text('AVANCE (%)', 1935, 128, 18, '#080808', 700, 'middle')}
    ${text('DESVÍO (d)', 2070, 128, 18, '#080808', 700, 'middle')}
    ${grid}${bands}${bars}
    <line x1="${todayX}" x2="${todayX}" y1="54" y2="${bottom}" stroke="#b90800" stroke-width="8" stroke-linecap="round"/>
    <rect x="${badgeX}" y="10" width="${badgeWidth}" height="60" rx="30" fill="#b90800"/>
    ${text(markerLabel, badgeX + badgeWidth / 2, 51, 34, '#ffffff', 700, 'middle')}
  </svg>`
}

export async function timelineReportPng(source: string): Promise<Blob> {
  await document.fonts.load('700 48px Unbounded')
  await document.fonts.load('900 25px Unbounded')
  const parsed = new DOMParser().parseFromString(source, 'image/svg+xml')
  const labels = [...parsed.querySelectorAll('text')]
  // Draw text with loaded browser fonts so SVG image font restrictions cannot change the export.
  labels.forEach((label) => label.remove())
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(parsed)], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = REPORT_WIDTH * 2
    canvas.height = REPORT_HEIGHT * 2
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se pudo crear la imagen.')
    context.scale(2, 2)
    context.drawImage(image, 0, 0)
    labels.forEach((label) => {
      context.font = `${label.getAttribute('font-weight')} ${label.getAttribute('font-size')}px ${label.getAttribute('font-family')}`
      context.fillStyle = label.getAttribute('fill') ?? '#fff'
      context.textAlign = label.getAttribute('text-anchor') === 'middle' ? 'center' : label.getAttribute('text-anchor') === 'end' ? 'right' : 'left'
      context.fillText(label.textContent ?? '', Number(label.getAttribute('x')), Number(label.getAttribute('y')))
    })
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No se pudo generar el PNG.')), 'image/png'))
  } finally {
    URL.revokeObjectURL(url)
  }
}
