import assert from 'node:assert/strict'
import { calculateEarnedValue, calculateEarnedValueForecast, earnedValueThroughDate } from '../src/lib/earnedValue.ts'

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
const weeklyPoints = calculateEarnedValue([
  { week_start: '2026-10-01', pv: 18, ac: 16, ev: 16 },
  { week_start: '2026-10-08', pv: 18, ac: 20, ev: 20 },
  { week_start: '2026-10-15', pv: 18, ac: 0, ev: 0 },
])
for (const day of [15, 16, 21]) {
  const visible = earnedValueThroughDate(weeklyPoints, new Date(2026, 9, day, 15))
  assert.deepEqual(visible.map((point) => point.week_start), ['2026-10-01', '2026-10-08'])
  assert.equal(visible.at(-1).acAccumulated, 36)
  assert.deepEqual(calculateEarnedValueForecast(weeklyPoints, visible.at(-1)), { bac: 54, eac: 54 })
}
assert.equal(earnedValueThroughDate(weeklyPoints, new Date(2026, 9, 22)).length, 3)
for (const day of [8, 9, 14]) {
  assert.deepEqual(earnedValueThroughDate(weeklyPoints, new Date(2026, 9, day)).map((point) => point.week_start), ['2026-10-01'])
}
assert.deepEqual(earnedValueThroughDate(weeklyPoints, new Date(2026, 9, 1)), [])
assert.deepEqual(earnedValueThroughDate([], new Date(2026, 9, 14)), [])
console.log('earned-value check ok')
