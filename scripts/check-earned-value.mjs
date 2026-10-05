import assert from 'node:assert/strict'
import { calculateEarnedValue, calculateEarnedValueForecast } from '../src/lib/earnedValue.ts'

const points = calculateEarnedValue([
  { week_start: '2026-08-27', pv: 2, ac: 2, ev: 2 },
  { week_start: '2026-08-13', pv: 3, ac: 4, ev: 3 },
])
assert.deepEqual(points.map((point) => point.pv), [3, 2])
assert.deepEqual(points.map((point) => point.evAccumulated), [3, 5])
assert.equal(points[0].spi, 1)
assert.equal(points[0].cpi, 0.75)
const empty = calculateEarnedValue([{ week_start: '2026-08-13', pv: 3, ac: 0, ev: 0 }])
assert.equal(empty[0].cpi, null)
const zeroPv = calculateEarnedValue([{ week_start: '2026-08-13', pv: 0, ac: 0, ev: 0 }])
assert.equal(zeroPv[0].spi, null)
assert.equal(zeroPv[0].cpi, null)
const forecastPoints = calculateEarnedValue([
  { week_start: '2026-10-08', pv: 60, ac: 999, ev: 999 },
  { week_start: '2026-09-24', pv: 40, ac: 50, ev: 40 },
])
assert.deepEqual(calculateEarnedValueForecast(forecastPoints, forecastPoints[0]), { bac: 100, eac: 125 })
assert.deepEqual(calculateEarnedValueForecast(forecastPoints), { bac: 100, eac: null })
assert.deepEqual(calculateEarnedValueForecast(empty, empty[0]), { bac: 3, eac: null })
const noProgress = calculateEarnedValue([{ week_start: '2026-09-24', pv: 40, ac: 50, ev: 0 }])
assert.deepEqual(calculateEarnedValueForecast(noProgress, noProgress[0]), { bac: 40, eac: null })
assert.deepEqual(calculateEarnedValueForecast(points, points.at(-1)), { bac: 5, eac: 6 })
assert.deepEqual(calculateEarnedValueForecast([]), { bac: 0, eac: null })
console.log('earned-value check ok')
