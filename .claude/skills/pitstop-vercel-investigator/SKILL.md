---
name: pitstop-vercel-investigator
description: Investigate reported PitStop deployment failures, build errors, or runtime incidents by correlating Vercel logs with the deployed pitstop-app source revision. Use for Vercel incident diagnosis and evidence-based proposed fixes, not deployment or code changes.
---

# PitStop Vercel investigator

Read [the shared application context](../references/pitstop-app.md) first to locate
the correct repository and follow its instructions.

Keep the investigation read-only. Do not modify code, environment variables,
deployments, aliases, project settings, or local project links. Do not deploy,
redeploy, rollback, run builds, install tools, or execute application requests that
could write data. Describe proposed fixes and verification separately from execution.

## Establish the incident and deployment

1. Extract the issue description and any deployment URL, environment, error, request
   ID, and incident time. Record the time zone and a bounded search window. Proceed
   with available evidence; ask one targeted question only when ambiguity prevents
   selecting the affected deployment, then wait for the answer.
2. Discover available Vercel integrations and their read-only project, deployment,
   build-log, and runtime-log capabilities. Prefer a connected integration. If it
   cannot supply the evidence, use an already installed official Vercel CLI with
   existing authorized access. Read current official documentation and command help
   before selecting commands/flags; never assume log history or filtering support.
   Start with [CLI inspect](https://vercel.com/docs/cli/inspect),
   [CLI logs](https://vercel.com/docs/cli/logs), and
   [Vercel MCP](https://vercel.com/docs/mcp/vercel-mcp).
   Do not invoke bare deployment commands, `link`, `pull`, or authentication/setup
   commands. If tooling/access is missing, report the prerequisite without installing
   or requesting credentials in chat.
3. Resolve the URL/alias to the immutable deployment that served the incident, using
   deployment history if the alias has moved. Record the Vercel team/scope, project
   name/ID, deployment ID/URL, target environment, creation time/status, Git repository,
   full commit SHA and configured root directory. Verify these from metadata rather
   than inferring them from a branch name or today's alias target.
4. Map the project root to `apps/web` or `apps/api`. The application may deploy these
   as separate Vercel projects; inspect the actual configuration. For a web-to-API
   failure, identify both deployments and their commits independently; do not assume
   they share a SHA or environment. Confirm the API target without exposing secrets.
   Mark unknown identity fields explicitly and keep any conclusions conditional
   until the relevant deployment and commit are established.

## Correlate evidence and source

- Retrieve bounded build/deployment logs for build failures and runtime/request logs
  for serving failures. Keep UTC timestamps, request IDs, function/route, status,
  error signature, and relevant sanitized excerpts with source references. Record
  query window, filters, pagination/limits and gaps. A successful build does not
  establish runtime health; missing logs do not establish absence of errors.
- Compare deployment SHA to local HEAD and dirty files. Explicitly flag a mismatch,
  including uncommitted differences in an otherwise matching checkout. Inspect the
  deployed commit's relevant files and configuration through Git objects or a
  read-only remote source view. Use source references with SHA/path/line; local HEAD
  or a local CodeGraph index alone cannot prove deployed behavior. If the deployed
  revision is unavailable, label local-source explanations as hypotheses.
- Trace the observed failure only as far as the evidence supports: Vite client/API
  target and routing, NestJS handlers/authentication, Prisma/Neon access, Firebase,
  or deployment/build configuration as relevant. Separate observed symptoms from a
  causal explanation; correlate request/time/error evidence rather than guessing
  from familiar stack errors. Do not claim an environment value is wrong without
  evidence, or print its contents to prove it.
- If historical logs expired, access is denied, only current live logs are exposed,
  or a time interval/deployment cannot be resolved, state exactly what was checked
  and what remains unavailable. Never replace missing incident evidence with current
  logs or invented findings. Summarize sensitive errors; omit tokens, cookies,
  connection strings, personal data, and private request payloads from all artifacts.

## Concise report

Include the assessment time and deployment identity, then:

- **Impact:** affected user action/component, environment and known time range;
  distinguish reported impact from measured scope.
- **Evidence / confirmed facts:** sanitized log references and deployed source
  references; local revision match/mismatch and collection limitations.
- **Likely cause / hypotheses:** evidence supporting each explanation, confidence,
  and missing evidence that would confirm or reject it.
- **Proposed fix:** smallest supported change, or next evidence to collect when a
  fix cannot yet be justified. Do not apply it.
- **Verification:** concrete checks for the affected flow and environment, including
  regression checks and logs to inspect after a separately requested fix/deployment.

Do not state that an incident is resolved unless evidence actually establishes it.
