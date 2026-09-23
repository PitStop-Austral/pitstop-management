---
name: pitstop-refresh-earned-value
description: Reconcile PitStop's earned-value data with the real execution history in Linear and the local project plan. Use whenever the user asks to update, calibrate, review, explain, or make the Earned Value, PV, EV, AC, SPI, CPI, or project-performance YAML more realistic; when a sprint's actual progress must be reflected; or before reporting project performance. Always use it for changes to project-plan/earned-value.yaml.
---

# PitStop — Refresh Earned Value

`project-plan/earned-value.yaml` is the weekly source for the Earned Value chart.
It must describe the project's observed history and its approved remaining plan, not a
perfect curve and not a flat copy of team capacity.

## Sources and authority

Read these before changing anything:

- `project-plan/earned-value.yaml` — current weekly record and prior actuals.
- `project-plan/features.yaml` — approved scope, feature estimates, planned dates, and
  `ticket_refs`.
- `project-plan/team.yaml` — team, weekly cadence, capacity, and Linear coordinates.
- `project-plan/risks.yaml` — incidents or risks that explain a material variance.

Then query Linear through the configured MCP for all PIT issues, including:

```
team=PIT
limit=250
includeArchived=true
fields=["id", "title", "estimate", "status", "statusType", "createdAt",
        "startedAt", "completedAt", "canceledAt", "dueDate", "project",
        "assignee", "updatedAt"]
```

Linear is authoritative for issue state, estimate, and completion timestamp. The local
plan is authoritative for scope, feature grouping, and the approved schedule. Do not
write to Linear for this task unless the user explicitly asks for a Linear change.

## Weekly convention

The team works Thursday to Thursday. A planned feature belongs to the row whose
`week_start` equals its `starts` date. Its `ends` date is the due Thursday for that
row.

For completed work, put a ticket in the week in which it was completed. When a ticket
is completed on a shared Thursday boundary, assign it to the earlier week if that is
its `dueDate`; otherwise assign it to the new week. State this convention in the final
summary when it affects a total.

## Historical lock

Treat completed reporting periods as closed. An ordinary refresh may edit only the
current week and, when late evidence arrives, the immediately previous week. Never
rewrite an older row automatically, even when Linear history would produce a different
result today.

If an older discrepancy is found, report it separately with the affected week and the
evidence. Change it only after the user explicitly authorizes a historical correction
or a formal rebaseline. This preserves the project's reporting history instead of
making past performance move every time tickets are cleaned up in Linear.

## Calculate each measure

### PV — Planned Value

PV is planned work, not available capacity. For each future week, sum the estimates of
features whose `starts` date is that week. A week with 7 SP or 0 SP is valid if that is
what the approved plan schedules; do not silently fill it to 18.

For closed historical weeks, preserve the recorded baseline. Rebuild PV only for the
current or immediately previous week, unless the user explicitly asks for a historical
correction or rebaseline.

### EV — Earned Value

EV is the estimate of work that is actually Done. Sum only non-canceled Linear issues
with `statusType=completed`, using their Linear estimate. Map them through
`ticket_refs`; a feature split into several tickets earns each ticket's completed
estimate once.

Do not earn value for Backlog, In Progress, or In Review work. Do not give partial EV
just because a ticket is almost done. Include a completed orphan issue only after
confirming it belongs to the PitStop scope; otherwise report it as an unmapped issue
instead of silently changing the data.

### AC — Actual Cost

Linear timestamps and status changes do not measure hours. Use actual-cost evidence in
this order:

1. Approved time logs or a weekly team report.
2. A documented incident, handoff, rework, or explicit user-provided effort.
3. The existing AC value, if there is no new evidence.

Never invent AC from ticket estimates, dates, or a desire to improve CPI. If a proxy is
explicitly requested, label it as an estimate and keep it plausible: a small overrun
or underrun must be supported by the execution record, not tuned to make the chart
look ideal.

Future rows always have `ac: 0` and `ev: 0`.

## Reconciliation procedure

1. Build a ticket-to-feature map from `ticket_refs`.
2. Compare Linear estimates and dates with the plan. Use Linear completion dates for
   EV; flag material estimate or date mismatches before treating them as a rebaseline.
3. Calculate PV, EV, and evidence-backed AC only for the current and immediately
   previous week. Preserve every older row verbatim and report, rather than apply, any
   discrepancy found there.
4. Update only `project-plan/earned-value.yaml`. Keep the YAML sorted by `week_start`
   and do not add comments: the app rewrites this file.
5. Run `npm run check:earned-value`.
6. Report the changed weeks, the source of each non-zero EV/AC, unresolved orphan
   issues, and the current cumulative SPI/CPI. Explain meaningful variances plainly.

## Guardrails

- A non-perfect curve is normal. Do not force SPI or CPI to 1.00.
- Do not count a ticket twice because it appears in both a feature and a Linear project.
- Do not turn a capacity gap into PV. It is a planning signal, not a calculation error.
- Do not alter product scope, ticket status, estimates, or dates merely to improve the
  metric.
- Do not modify a week older than the previous one without explicit user approval.
- If the result exposes an empty planned week, report it. Move work only when the user
  requests a schedule change.

## Final response

Keep the report concise. Include the updated file, validation result, and any decision
the PM needs to make. Distinguish facts retrieved from Linear from AC values that were
kept because no actual-cost source exists.
