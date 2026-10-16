import type { EarnedValueWeek } from '../types.ts'
import { addDays, parseISO } from './week.ts'

export type EarnedValuePoint = EarnedValueWeek & {
  pv: number
  pvAccumulated: number
  evAccumulated: number
  acAccumulated: number
  sv: number
  cv: number
  spi: number | null
  cpi: number | null
}

export function calculateEarnedValue(entries: EarnedValueWeek[]): EarnedValuePoint[] {
  let pvAccumulated = 0
  let evAccumulated = 0
  let acAccumulated = 0
  return [...entries].sort((a, b) => a.week_start.localeCompare(b.week_start)).map((entry) => {
    pvAccumulated += entry.pv
    evAccumulated += entry.ev
    acAccumulated += entry.ac
    return {
      ...entry,
      pvAccumulated,
      evAccumulated,
      acAccumulated,
      sv: evAccumulated - pvAccumulated,
      cv: evAccumulated - acAccumulated,
      spi: pvAccumulated > 0 ? evAccumulated / pvAccumulated : null,
      cpi: acAccumulated > 0 ? evAccumulated / acAccumulated : null,
    }
  })
}

export function earnedValueThroughDate(points: EarnedValuePoint[], date: Date): EarnedValuePoint[] {
  const cutoff = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return points.filter((point) => addDays(parseISO(point.week_start), 7) <= cutoff)
}

export function calculateEarnedValueForecast(points: EarnedValuePoint[], latest?: EarnedValuePoint) {
  const bac = points.at(-1)?.pvAccumulated ?? 0
  const eac = latest?.cpi != null && latest.cpi > 0 ? bac / latest.cpi : null
  return { bac, eac }
}
