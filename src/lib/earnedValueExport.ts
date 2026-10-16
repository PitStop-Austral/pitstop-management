type ExportOptions = {
  chart: SVGSVGElement
  sourceWidth: number
  sourceHeight: number
  metrics: [string, string][]
}

const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
export function createEarnedValueExport({ chart, sourceWidth, sourceHeight, metrics }: ExportOptions) {
  const width = 1920
  const chartWidth = width - 112
  const chartHeight = Math.round(chartWidth * sourceHeight / sourceWidth)
  const chartY = 384
  const legendY = chartY + chartHeight + 56
  const height = legendY + 40
  const colors: Record<string, string> = { PV: '#71717a', EV: '#e10600', AC: '#d97706', BAC: '#2563eb', EAC: '#d97706' }
  const descriptions: Record<string, string> = {
    PV: 'Valor planificado', EV: 'Valor ganado', AC: 'Costo real',
    SV: 'Variación del cronograma', CV: 'Variación del costo', SPI: 'Índice del cronograma',
    CPI: 'Índice del costo', BAC: 'Presupuesto total', EAC: 'Estimación al cierre',
  }
  const cards = metrics.map(([label, value], index) => {
    const x = 56 + (index % 3) * 608
    const y = 48 + Math.floor(index / 3) * 100
    const color = colors[label] ?? '#18181b'
    return `<g><rect x="${x}" y="${y}" width="592" height="88" rx="16" fill="#fff" stroke="#e5e5e7"/>
      <rect x="${x + 20}" y="${y + 23}" width="4" height="42" rx="2" fill="${color}"/>
      <text x="${x + 38}" y="${y + 34}" font-size="24" font-weight="700" fill="${color}">${escape(label)}</text>
      <text x="${x + 38}" y="${y + 62}" font-size="19" fill="#71717a">${escape(descriptions[label] ?? '')}</text>
      <text class="display" x="${x + 568}" y="${y + 59}" text-anchor="end" font-size="44" font-weight="700" fill="#18181b">${escape(value)}</text></g>`
  }).join('')

  // Let the original strokes scale with the exported image, including 2x rasterization.
  for (const path of chart.querySelectorAll('[vector-effect="non-scaling-stroke"]')) {
    path.removeAttribute('vector-effect')
  }
  // Enlarge labels without changing the original paths or scales.
  const fontSize = 24 * sourceWidth / chartWidth
  for (const label of chart.querySelectorAll('text')) {
    label.setAttribute('font-size', String(fontSize))
    label.style.fontSize = `${fontSize}px`
  }
  const legend = [
    ['#71717a', 'PV', '6 6'], ['#e10600', 'EV', ''], ['#f59e0b', 'AC', ''],
    ['#2563eb', 'BAC', '3 5'], ['#f59e0b', 'EAC (proyección)', '6 4'],
  ].map(([color, label, dash], index) => {
    const x = 56 + index * 290
    return `<line x1="${x}" y1="${legendY}" x2="${x + 42}" y2="${legendY}" stroke="${color}" stroke-width="3" ${dash ? `stroke-dasharray="${dash}"` : ''}/>
      <text x="${x + 56}" y="${legendY + 9}" font-size="28" font-weight="600" fill="#3f3f46">${label}</text>`
  }).join('')

  return {
    width,
    height,
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <style>text{font-family:Inter,system-ui,sans-serif;font-variant-numeric:tabular-nums}.display{font-family:'Space Grotesk',Inter,system-ui,sans-serif}</style>
      ${cards}
      <svg x="56" y="${chartY}" width="${chartWidth}" height="${chartHeight}" viewBox="0 0 ${sourceWidth} ${sourceHeight}" overflow="visible">${chart.innerHTML}</svg>
      ${legend}
    </svg>`,
  }
}
