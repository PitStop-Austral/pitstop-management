---
name: pitstop-dependency-check
description: Assess security advisories and dependency maintenance across the entire pitstop-app workspace, including transitive packages. Use for PitStop dependency audits, outdated or deprecated package reviews, and upgrade recommendations; this assessment does not install or update packages.
---

# PitStop dependency check

Read [the shared application context](../references/pitstop-app.md) first to locate
the correct repository and follow its instructions.

Assess only: do not install dependencies/tools, change manifests or lockfiles, add
overrides, suppress advisories, or apply automatic fixes. Avoid `install`, `update`,
`audit --fix`, `dlx`/`npx` bootstrapping, and package-manager auto-downloads. Detect
whether a package-manager executable is a shim or would download the pinned version
before invoking it. If tooling requires setup or hydration, report that prerequisite
and continue with lockfile/source evidence where possible. No extra approval is
needed for available read-only checks. Do not run project scripts during assessment;
builds/tests/code generation can write outputs or touch services.

## Establish coverage

1. Record the assessment date (with time zone), repository revision/dirty status,
   actual package-manager version, and evidence sources. Inspect root `package.json`
   (`packageManager` and `devEngines`), workspace configuration/globs, every matching
   workspace manifest including the root, and all relevant lockfiles. Include
   `apps/web`, `apps/api`, and any shared `packages/*`, tooling, optional and peer
   dependencies; don't assume the plan's package list or an empty packages directory
   is current. Resolve conflicting manager/lockfile signals before trusting results.
2. Use manifests for declared ranges and dependency categories, and the lockfile's
   importers/resolutions for the actual direct and transitive graph. Inspect catalogs,
   overrides, patches, resolutions, ignored advisories and registry configuration
   without exposing credentials. Record missing/stale lockfiles or differences
   between installed packages and locked resolutions; do not repair them. Distinguish
   a lockfile assessment from an installed-tree or deployed-artifact assessment.

## Collect security and maintenance evidence

- Use the detected manager's documented read-only audit, outdated, graph/why and
  registry-metadata operations. Verify current official docs and installed-version
  support first. For pnpm start with [audit](https://pnpm.io/cli/audit),
  [outdated](https://pnpm.io/cli/outdated), and [why](https://pnpm.io/cli/why).
  Audit the full workspace including root and development dependencies; confirm
  actual coverage from output rather than assuming recursion. Use production-only
  views as a supplement, not a replacement. Capture command, version, date, exit
  status, coverage, exclusions and errors; findings-related nonzero status differs
  from a failed query. Registry/advisory queries disclose package names/versions:
  respect private-registry restrictions and flag packages not covered.
- Inspect direct and transitive resolutions, including multiple versions of the same
  package and each affected workspace path. Corroborate audit results with current
  package-maintainer security advisories, [GitHub Advisory Database](https://github.com/advisories),
  or [OSV](https://osv.dev/); link exact advisories rather than search pages. Check
  upstream package release notes, registry deprecation metadata and official support
  policies for maintenance. If sources are inaccessible or a tool omits part of the
  graph, report partial coverage rather than a clean result.
- For each vulnerability, record advisory GHSA/CVE/OSV ID and URL, severity,
  package and locked version(s), affected range, patched/resolved version(s) or
  no available fix, full dependency path from workspace importer, and production /
  development / build-tool context. Verify the locked version matches the advisory
  and inspect its trigger conditions against relevant application/configuration code.
  State reachability as confirmed, ruled out for a documented condition, or uncertain
  with the missing evidence. A devDependency can expose CI/build inputs, and a web
  dependency may be bundled into browser code: manifest category alone does not
  establish application exposure. Do not run exploit payloads or probe production.
- Keep known vulnerabilities separate from outdated versions, deprecated packages,
  and unsupported/EOL versions. Age or a newer major release alone proves neither a
  vulnerability nor EOL. Evaluate runtime/engine constraints where they affect the
  workspace. Cite each deprecation/support claim and upstream migration guidance.
- For maintenance, compare the locked version, highest available version allowed by
  the **actual declared range and workspace constraints**, and latest stable version.
  Distinguish updates within the current range (still requiring a later lockfile
  change) from upgrades requiring manifest changes or migrations. Explain constraints
  from overrides, peers, catalogs, engines and coordinated packages. For transitive
  issues, prefer a compatible parent update; evaluate a scoped override only as a
  recommendation with compatibility risk, never apply it during assessment.

## Prioritize and report

Lead with actionable findings ranked by advisory severity, demonstrated application
exposure and upgrade effort; do not treat an unreachable critical advisory and an
exposed moderate advisory as automatically equivalent. Separate security findings
from maintenance work and document uncertainty rather than lowering severity without
evidence. Include:

- Assessment date, checkout/lockfile scope, tool/source provenance and limitations.
- Security findings with the evidence fields above, applicability/reachability,
  specific remediation target and parent/override implications.
- Maintenance findings with current / range-compatible / latest versions, category,
  required manifest or migration work, authoritative advisory/release/migration links,
  and priority/effort rationale. Deduplicate advisories but preserve affected paths.
- Relevant validation commands to run **after a separately requested remediation**.
  Read actual package scripts and official tool docs to propose exact commands:
  workspace typecheck/lint/build, affected API tests, web checks if present, and the
  audit rerun. Coordinate Prisma client/CLI/adapter changes and review migrations;
  distinguish isolated tests from database or service-dependent verification.
  Never execute migration, formatting/fix, install or build commands in this assessment.

Close with concrete next actions and any unavailable evidence/tooling prerequisites.
A clean audit means no known advisories were reported by that check at that time;
it does not prove the application is secure.
