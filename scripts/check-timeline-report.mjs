import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { createTimelineReport, timelineReportRows } from '../src/lib/timelineReport.ts'

const backlog = parse(readFileSync(new URL('../project-plan/features.yaml', import.meta.url), 'utf8'))
const plan = { backlog }
const rows = timelineReportRows(plan)
assert.equal(rows.length, 14)
assert.deepEqual(rows.map((row) => row.id), ['capacitacion', 'setup', 'auth', 'deploy', 'vehiculos', 'fixes-s1', 'mantenimientos', 'calendario', 'alertas', 'fixes-s2', 'kpis', 'perfil', 'deseos', 'km'])
assert.equal(rows.find((row) => row.id === 'vehiculos').estimatedEnd, '2026-09-24')
assert.ok(!rows.find((row) => row.id === 'vehiculos').epic_ids.includes('inicio'))
assert.equal(rows.find((row) => row.id === 'kpis').completion, 30)

const category = { id: 'test', title: '<Example & category>', epic_ids: ['epic'], baseline_start: '2026-10-01', baseline_end: '2026-10-22', actual_end: null, progress: null }
const fixture = { backlog: { timeline_report: [category], epics: [{ id: 'epic', features: [
  { starts: '2026-10-01', ends: '2026-10-08', status: 'done', estimate: 2 },
  { starts: '2026-10-08', ends: '2026-10-29', status: 'in_progress', estimate: 6 },
] }] } }
assert.equal(timelineReportRows(fixture)[0].completion, 25)
assert.equal(timelineReportRows(fixture)[0].deviation, -7)
fixture.backlog.epics[0].features[1].ends = null
assert.equal(timelineReportRows(fixture)[0].estimatedEnd, null)
assert.equal(timelineReportRows(fixture)[0].deviation, null)
fixture.backlog.epics[0].features[1].status = 'done'
assert.equal(timelineReportRows(fixture)[0].completion, 100)
assert.equal(timelineReportRows(fixture)[0].deviation, null)
category.actual_end = '2026-10-15'
assert.equal(timelineReportRows(fixture)[0].deviation, 7)
assert.equal(category.baseline_end, '2026-10-22')
assert.equal(timelineReportRows({ backlog: {} }).length, 0)
const svg = createTimelineReport(timelineReportRows(fixture), '2026-10-15')
assert.ok(svg.includes('&lt;Example &amp; category&gt;'))
assert.ok(!svg.includes('NaN'))
assert.ok(svg.includes('>+7</text>'))
assert.ok(!createTimelineReport([], '2026-10-15').includes('NaN'))
const team = parse(readFileSync(new URL('../project-plan/team.yaml', import.meta.url), 'utf8'))
const presentation = createTimelineReport(rows, '2026-10-15', team.sprints)
for (const label of ['Fin S1 · 17/09', 'Fin S2 · 15/10', 'Fin S3 · 12/11']) assert.ok(presentation.includes(label))
assert.ok(presentation.includes('viewBox="0 0 2160 1080"'))
assert.ok(!presentation.includes('linearGradient'))
assert.ok(presentation.includes('Línea base'))
assert.ok(presentation.includes('DESVÍO (d)'))
assert.ok(presentation.includes('AVANCE (%)'))
assert.ok(presentation.includes('>30 %</text>'))
assert.equal((presentation.match(/<text x="1935"/g) ?? []).length, rows.length + 1)
assert.ok(!presentation.includes('<rect width="2160"'))
console.log('timeline-report check ok')
