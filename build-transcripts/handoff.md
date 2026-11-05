# Handoff

## Reviewer link

**https://thesis-three-delta.vercel.app** — public production deployment on Vercel, no login required (verified with an unauthenticated request returning 200 on 2026-11-05).

The deployment runs in **demo mode** because no provider credentials were available at build time. Reviewers can:
- Explore two complete, clearly labelled sample reports (Microsoft three-year thesis; NVIDIA vs AMD comparison) including the brief/full toggle, citations and source drawer, charts with data tables, Markdown copy/download, and print.
- See the demo notice on the home page, which names the missing variables. Submitting a question in demo mode returns an honest "live research is not configured" message rather than canned content.

The team-scoped alias (`thesis-abhinav-singhs-projects-caf059ea.vercel.app`) is behind Vercel's deployment protection and redirects to a login; use the public alias above.

## Enabling live research

Set both variables in the Vercel project (`abhinav-singhs-projects-caf059ea/thesis`) and redeploy:

```bash
echo "<key>" | vercel env add PARALLEL_API_KEY production
echo "<key>" | vercel env add ANTHROPIC_API_KEY production
vercel deploy --prod
```

Optional tuning variables are listed in `.env.example` and the README. Each live run is a paid Parallel request (list price $0.025 for `core`, $0.10 for `pro`) plus one Claude synthesis call.

## Local setup

```bash
cd thesis
npm install
cp .env.example .env.local      # add keys to enable live research
npm run dev                      # http://localhost:3000
npm test && npm run typecheck && npm run lint && npm run build
```

## Repository layout

- `src/app` — routes: `/`, `/research/[id]`, `/api/config`, `/api/research`, `/api/research/[id]`, `/api/research/[id]/report`.
- `src/lib/research` — provider interface, Parallel adapter, evidence pack schema, normalization, synthesis, job lifecycle, config, rate limit.
- `src/lib/schema` — report and request schemas (Zod).
- `src/lib/report` — Markdown export, stats, server-side quality pass.
- `src/lib/client` — localStorage history store, API client, polling hook.
- `src/components` — brand, home, workspace, report (charts, tables, citations, drawer).
- `src/fixtures` — sample reports (served only for ids beginning `sample-`).
- `tests` — vitest unit tests.
- `build-transcripts` — these records (excluded from the Vercel upload by `.vercelignore`).

The project is a local git repository (`~/thesis`) with the history of the build. It has not been pushed to GitHub or shared anywhere; the only upload was the Vercel deployment, which excludes this folder.

## Status

| Area | Status |
| --- | --- |
| Home, composer, examples, recent research, sample reports | Complete, verified in browser |
| Research workspace states (queued / researching / synthesizing / completed / failed / cancelled / not found) | Complete, verified against a local provider mock |
| Report document, citations, source drawer, section nav, brief/full, copy, download, print styles | Complete, verified (print pagination not verified in a real dialog) |
| Parallel integration | Implemented per official docs; unit-tested against documented shapes; **not exercised against the real API** |
| Claude synthesis | Implemented with the official SDK and structured outputs; **not exercised against the real API** |
| Tests, type check, lint, production build | All pass |
| Deployment | Live at the public URL above, demo mode |

## Limitations

- Live reports are stored only in the browser that created them; their URLs do not open elsewhere. Sample report URLs work everywhere.
- No market-data source: no prices or valuation multiples anywhere.
- Parallel exposes no cancel endpoint for task runs; "Stop waiting" only stops polling.
- In-memory idempotency map, report cache and rate limiter are per server instance.
- The sample reports were hand-compiled by the build agent from figures verified on 2026-11-05 against company filings and releases; they are not the output of a live research run and say so.
- The disk on the build machine was nearly full during the session; this did not affect the delivered code but is noted in `validation.md`.

## Transcripts

See `transcripts/README.md`. The session transcript exported from Claude Code's session store is copied into `transcripts/` with API-key patterns and e-mail addresses redacted; the copy is a snapshot taken at the end of the build session and does not include any later activity.
