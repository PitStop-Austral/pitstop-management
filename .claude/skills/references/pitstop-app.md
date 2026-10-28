# Locate the PitStop application

Use this context for PitStop operational investigations and dependency assessments.

- Read `project-plan/team.yaml` in **pitstop-management** for
  `project.repos.monorepo.{url,local_path,apps}` and `project.stack`. Resolve
  `local_path` against that repository's root, not the YAML directory or the shell's
  current directory. The current coordinates are `../pitstop-app`, remote
  `PitStop-Austral/pitstop-app`, with `apps/web` and `apps/api`.
- In a management worktree, that sibling may be absent. Inspect the management
  repository's Git common directory/worktree list to locate its primary checkout,
  then try the configured sibling there. Verify the candidate's Git remote and
  manifests; never silently assess pitstop-management, the template, or the prototype.
  If no verified source is accessible, report that limitation; do not clone or switch
  checkouts as part of these read-only workflows.
- Read applicable `AGENTS.md` instructions in both repositories and nested directories.
  If the application has `.codegraph/`, use CodeGraph before searching or reading
  application code; fall back to ordinary search only if it is unavailable and disclose
  that limitation. Do not create an index.
- Treat the plan as orientation, not installed-state evidence. It describes a pnpm /
  Turborepo workspace, Vite + React + TanStack Router/Query web, NestJS API, Prisma,
  Firebase, Neon PostgreSQL, and Vercel. The Next.js prototype is a UI specification.
  Resolve differences using actual manifests, deployment configuration, and the
  relevant source revision; mention material drift rather than rewriting the plan.
- Record the application root, Git HEAD and dirty status. Read source with Git object
  inspection when a different revision is needed; do not checkout, reset, stash, or
  modify either repository. Read-only discovery needs no extra approval.

For tool-specific syntax, discover the tools available in the current session and
read their schemas. Use Context7 for current tool/library documentation when
available (resolve the library ID before querying); otherwise use current official
documentation. Do not assume a tool is connected or a CLI is installed. Avoid
printing credential-bearing configuration, `.env` files, auth headers, or raw
customer data. Sanitize evidence before returning or saving it.
