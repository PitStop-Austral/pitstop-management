import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Save } from 'lucide-react'
import { Chart } from '@tanstack/charts/react'
import { d3Curve, defineChart, lineY, ruleX, text } from '@tanstack/charts'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { curveMonotoneX } from 'd3-shape'
import type { EarnedValueDocument, EarnedValueWeek } from '../types'
import { calculateEarnedValue } from '../lib/earnedValue'
import { addDays, formatShort, nextThursday, parseISO } from '../lib/week'
import { Button, Field, SectionTitle } from './ui'
import { saveEarnedValue } from '../api'

function number(value: number | null): string {
  return value == null ? '—' : value.toFixed(2)
}

export function EarnedValueTab({ document: data }: { document: EarnedValueDocument }) {
  const [weeks, setWeeks] = useState<EarnedValueWeek[]>(data.weeks)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const points = useMemo(() => calculateEarnedValue(weeks), [weeks])
  const latest = points.at(-1)
  useEffect(() => setWeeks(data.weeks), [data.weeks])

  function updateWeek(week_start: string, field: 'pv' | 'ac' | 'ev', value: number) {
    setWeeks((current) => {
      const existing = current.find((week) => week.week_start === week_start)
      const next = {
        week_start,
        pv: existing?.pv ?? 0,
        ac: existing?.ac ?? 0,
        ev: existing?.ev ?? 0,
        [field]: value,
      }
      return [...current.filter((week) => week.week_start !== week_start), next].sort((a, b) => a.week_start.localeCompare(b.week_start))
    })
    setError(null)
  }

  async function save() {
    setSaving(true)
    try {
      await saveEarnedValue(weeks)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSaving(false)
    }
  }

  async function exportPng() {
    const svg = chartRef.current?.querySelector('svg')
    if (!svg) return
    await document.fonts.ready
    const copy = svg.cloneNode(true) as SVGSVGElement
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    copy.style.fontFamily = getComputedStyle(svg).fontFamily
    const { width: sourceWidth, height: sourceHeight } = svg.viewBox.baseVal
    if (!sourceWidth || !sourceHeight) return
    const exportDocument = createExportSvg({
      chart: copy,
      sourceWidth,
      sourceHeight,
      metrics: [
        ['PV acumulado', `${number(latest?.pvAccumulated ?? 0)} h`],
        ['EV acumulado', `${number(latest?.evAccumulated ?? 0)} h`],
        ['AC acumulado', `${number(latest?.acAccumulated ?? 0)} h`],
        ['SV', `${number(latest?.sv ?? 0)} h`],
        ['CV', `${number(latest?.cv ?? 0)} h`],
        ['SPI', number(latest?.spi ?? null)],
        ['CPI', number(latest?.cpi ?? null)],
      ],
    })
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 1600
      canvas.height = exportDocument.height
      const context = canvas.getContext('2d')
      if (!context) return
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const link = document.createElement('a')
      link.download = 'earned-value.png'
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(exportDocument.source)}`
  }

  const max = Math.max(...points.flatMap((point) => [point.pvAccumulated, point.evAccumulated, point.acAccumulated]), 1)
  const height = 440
  const today = new Date()
  const todayAtMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const chartDate = (week_start: string) => addDays(parseISO(week_start), 7)
  const chartStart = points[0] ? chartDate(points[0].week_start) : null
  const chartEnd = points.at(-1) ? chartDate(points.at(-1)!.week_start) : null
  const currentWeekEnd = nextThursday(todayAtMidnight)
  const todayIsWithinChart = Boolean(chartStart && chartEnd && chartStart < chartEnd && currentWeekEnd >= chartStart && currentWeekEnd <= chartEnd)
  const visiblePoints = points.filter((point) => parseISO(point.week_start) <= todayAtMidnight)
  const series = (key: 'pvAccumulated' | 'evAccumulated' | 'acAccumulated', data: typeof points) =>
    data.map((point) => ({ date: chartDate(point.week_start).getTime(), value: point[key] }))
  const chartDefinition = useMemo(() => defineChart({
    marks: [
      lineY(series('pvAccumulated', points), { x: 'date', y: 'value', stroke: '#71717a', strokeWidth: 2, strokeDasharray: '6 6', curve: d3Curve(curveMonotoneX) }),
      lineY(series('evAccumulated', visiblePoints), { x: 'date', y: 'value', stroke: '#e10600', strokeWidth: 2, curve: d3Curve(curveMonotoneX) }),
      lineY(series('acAccumulated', visiblePoints), { x: 'date', y: 'value', stroke: '#f59e0b', strokeWidth: 2, curve: d3Curve(curveMonotoneX) }),
      ...(todayIsWithinChart ? [
        ruleX([currentWeekEnd.getTime()], { stroke: '#e10600', strokeWidth: 2 }),
        text([{ date: currentWeekEnd.getTime(), value: max, label: 'Hoy' }], { x: 'date', y: 'value', text: 'label', fill: '#e10600', fontSize: 11, fontWeight: 700, anchor: 'start', dx: 8, dy: 14 }),
      ] : []),
    ],
    scales: {
      x: { scale: scaleLinear().domain([chartStart!.getTime(), chartEnd!.getTime()]), grid: { stroke: '#e5e5e7', strokeOpacity: 0.8, strokeDasharray: '3 4' }, axis: { ticks: { values: points.map((point) => chartDate(point.week_start).getTime()), size: 0, padding: 10, format: (value) => formatShort(new Date(value)).replace(/^\w+ /, '') }, tickLabels: { fontSize: 11, fontWeight: 500, thin: { minGap: 8, priority: 'ends' } } } },
      y: { scale: scaleLinear().domain([0, max]), grid: { stroke: '#e5e5e7', strokeOpacity: 0.8 }, axis: { ticks: { count: 5, size: 0, padding: 10 }, tickLabels: { fontSize: 11, fontWeight: 500 } } },
    },
    clip: true,
    theme: { grid: '#e5e5e7', foreground: '#71717a' },
  }), [points, visiblePoints, currentWeekEnd, todayIsWithinChart, max])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionTitle>Earned Value semanal</SectionTitle>
          <p className="text-xs text-muted-foreground">Semanas de jueves a jueves · PV, AC y EV se editan abajo y se guardan</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportPng} icon={<Download className="size-4" />}>Exportar PNG</Button>
          <Button variant="primary" onClick={() => void save()} disabled={saving} icon={<Save className="size-4" />}>{saving ? 'Guardando…' : 'Guardar PV/AC/EV'}</Button>
        </div>
      </div>

      {error ? <p className="rounded-xl bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="PV acumulado" value={`${number(latest?.pvAccumulated ?? 0)} h`} />
        <Metric label="EV acumulado" value={`${number(latest?.evAccumulated ?? 0)} h`} />
        <Metric label="AC acumulado" value={`${number(latest?.acAccumulated ?? 0)} h`} />
        <Metric label="SV" value={`${number(latest?.sv ?? 0)} h`} />
        <Metric label="CV" value={`${number(latest?.cv ?? 0)} h`} />
        <Metric label="SPI" value={number(latest?.spi ?? null)} />
        <Metric label="CPI" value={number(latest?.cpi ?? null)} />
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
          <h3 className="font-display text-sm">Curvas acumuladas</h3>
          <span className="text-xs text-muted-foreground">Escala máxima {number(max)} h</span>
        </div>
        <div className="overflow-x-auto px-5 pt-4">
          <div ref={chartRef} className="min-w-[760px] rounded-xl border border-border bg-muted/30 px-2 py-1">
            <Chart className="earned-value-chart" style={{ fontFamily: 'Inter, system-ui, sans-serif' }} definition={chartDefinition} height={height} initialWidth={1200} ariaLabel="Curvas acumuladas PV EV y AC" />
          </div>
        </div>
        <div className="mt-4 flex gap-5 border-t border-border px-5 py-3 text-xs font-semibold"><Legend color="#71717a" label="PV" dashed /><Legend color="#e10600" label="EV" /><Legend color="#f59e0b" label="AC" /></div>
      </section>

      <section className="card overflow-x-auto">
        <div className="border-b border-border px-4 py-3"><h3 className="font-display text-sm">Carga semanal</h3></div>
            <table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-muted text-muted-foreground"><tr>{['Semana', 'PV plan', 'AC real', 'EV terminado', 'PV acum.', 'EV acum.', 'AC acum.', 'SV', 'CV', 'SPI', 'CPI'].map((label) => <th key={label} className="px-3 py-2 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{points.map((point) => <tr key={point.week_start}><td className="px-3 py-2 font-semibold">{formatShort(parseISO(point.week_start))}–{formatShort(addDays(parseISO(point.week_start), 7))}</td><td className="px-3 py-2"><HourInput value={point.pv} onChange={(value) => updateWeek(point.week_start, 'pv', value)} /></td><td className="px-3 py-2"><HourInput value={point.ac} onChange={(value) => updateWeek(point.week_start, 'ac', value)} /></td><td className="px-3 py-2"><HourInput value={point.ev} onChange={(value) => updateWeek(point.week_start, 'ev', value)} /></td><td className="px-3 py-2">{number(point.pvAccumulated)}</td><td className="px-3 py-2">{number(point.evAccumulated)}</td><td className="px-3 py-2">{number(point.acAccumulated)}</td><td className="px-3 py-2">{number(point.sv)}</td><td className="px-3 py-2">{number(point.cv)}</td><td className="px-3 py-2">{number(point.spi)}</td><td className="px-3 py-2">{number(point.cpi)}</td></tr>)}</tbody></table>
      </section>

    </div>
  )
}

function createExportSvg({ chart, sourceWidth, sourceHeight, metrics }: { chart: SVGSVGElement; sourceWidth: number; sourceHeight: number; metrics: [string, string][] }) {
  const width = 1600
  const inset = 64
  const gap = 20
  const cardWidth = (width - inset * 2 - gap * 3) / 4
  const cardHeight = 88
  const cardsStartY = 48
  const cardRows = Math.ceil(metrics.length / 4)
  const cardsBottom = cardsStartY + cardRows * cardHeight + (cardRows - 1) * 16
  const chartY = cardsBottom + 40
  const chartWidth = width - inset * 2
  const chartHeight = Math.round(chartWidth * (sourceHeight / sourceWidth))
  const legendY = chartY + chartHeight + 46
  const height = legendY + 46
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const cards = metrics.map(([label, value], index) => {
    const column = index % 4
    const row = Math.floor(index / 4)
    const x = inset + column * (cardWidth + gap)
    const y = cardsStartY + row * (cardHeight + 16)
    return `<g><rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="14" fill="none" stroke="#d4d4d8"/><text x="${x + 20}" y="${y + 31}" fill="#71717a" font-size="16" font-weight="600">${escape(label)}</text><text x="${x + 20}" y="${y + 64}" fill="#18181b" font-size="27" font-weight="700">${escape(value)}</text></g>`
  }).join('')
  const legend = [
    ['#71717a', 'PV', '6 6'],
    ['#e10600', 'EV', ''],
    ['#f59e0b', 'AC', ''],
  ].map(([color, label, dash], index) => {
    const x = inset + index * 130
    return `<g><line x1="${x}" y1="${legendY}" x2="${x + 34}" y2="${legendY}" stroke="${color}" stroke-width="3" ${dash ? `stroke-dasharray="${dash}"` : ''}/><text x="${x + 48}" y="${legendY + 6}" fill="#3f3f46" font-size="17" font-weight="600">${label}</text></g>`
  }).join('')
  return {
    height,
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><style>text{font-family:Inter,system-ui,sans-serif}</style>${cards}<svg x="${inset}" y="${chartY}" width="${chartWidth}" height="${chartHeight}" viewBox="0 0 ${sourceWidth} ${sourceHeight}">${chart.innerHTML}</svg>${legend}</svg>`,
  }
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) { return <div className="card p-3"><p className="text-[11px] font-semibold text-muted-foreground">{label}</p><p className="mt-1 font-display text-xl font-bold">{value}</p>{hint ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}</div> }
function Legend({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) { return <span className="inline-flex items-center gap-2"><i className="w-5 border-t-2" style={{ borderColor: color, borderTopStyle: dashed ? 'dashed' : 'solid' }} />{label}</span> }
function HourInput({ value, onChange }: { value: number; onChange: (value: number) => void }) { return <Field label=""><input className="field w-24 py-1" type="number" min="0" step="0.25" value={value || ''} placeholder="0" onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))} /></Field> }
