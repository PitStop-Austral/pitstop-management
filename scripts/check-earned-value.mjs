import assert from 'node:assert/strict'
import { calculateEarnedValue } from '../src/lib/earnedValue.ts'

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
console.log('earned-value check ok')
