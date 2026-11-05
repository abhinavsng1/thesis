# Handoff

## Reviewer link

**https://thesis-three-delta.vercel.app** — public production deployment on Vercel, no login required (verified with an unauthenticated request returning 200 on 2026-11-05).

The deployment runs in **live mode**: Parallel and Anthropic keys are configured in the Vercel project, so reviewers can ask real questions. Reviewers can:
- Ask any investing question. A quick run takes about four minutes of provider research plus about 40 seconds of synthesis; the workspace shows every step live and the page can be left and reopened in the same browser.
- Explore two complete, clearly labelled sample reports (Microsoft three-year thesis; NVIDIA vs AMD comparison) without waiting, including the brief/full toggle, citations and source drawer, charts with data tables, Markdown copy/download, and print.

Each live question costs the project owner roughly $0.03 (Parallel `core`) plus one Claude call. If the keys are removed, the app falls back to a clearly labelled demo mode with the sample reports only.

The team-scoped alias (`thesis-abhinav-singhs-projects-caf059ea.vercel.app`) is behind Vercel's deployment protection and redirects to a login; use the public alias above.

## Rotating or replacing keys

Set both variables in the Vercel project (`abhinav-singhs-projects-caf059ea/thesis`) and redeploy:

```bash
vercel env add PARALLEL_API_KEY production --value "<key>" --yes
vercel env add ANTHROPIC_API_KEY production --value "<key>" --yes
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

## Live research experience

While a run is in progress the workspace shows a phase rail (Plan → Search → Read → Write → Ready), a one-line status of the current activity, collapsible step groups (plan, searches with their queries, documents read with links, notes) where only the current group is expanded, and a sources panel with provider-reported counts and progress. Synthesis streams section-by-section. The full step trace stays with the report under "Research activity".

## Status

| Area | Status |
| --- | --- |
| Home, composer, examples, recent research, sample reports | Complete, verified in browser |
| Research workspace states (queued / researching / synthesizing / completed / failed / cancelled / not found) | Complete, verified against a local provider mock |
| Report document, citations, source drawer, section nav, brief/full, copy, download, print styles | Complete, verified (print pagination not verified in a real dialog) |
| Parallel integration | Verified against the real API with the user's key: two `core` runs completed in about four minutes each |
| Claude synthesis | Verified against the real API: schema-guided JSON validated server-side (strict structured outputs rejected the schema as too large); ~40 s per report |
| Tests, type check, lint, production build | All pass |
| Deployment | Live at the public URL above, live mode, verified end to end on the deployment |

## Limitations

- Live reports are stored only in the browser that created them; their URLs do not open elsewhere. Sample report URLs work everywhere.
- No market-data source: no prices or valuation multiples anywhere.
- Parallel exposes no cancel endpoint for task runs; "Stop waiting" only stops polling.
- In-memory idempotency map, report cache and rate limiter are per server instance.
- The sample reports were hand-compiled by the build agent from figures verified on 2026-11-05 against company filings and releases (no credentials were available at that point); they are not the output of a live research run and say so.
- The disk on the build machine was nearly full during the session; this did not affect the delivered code but is noted in `validation.md`.

## Demo video

`~/Desktop/thesis-demo.mp4` (3 min 4 s, 1440×900, H.264, about 6 MB) shows a real run on the live site: home → example prompt → live research steps → streamed synthesis → the finished report (brief, full report, charts, citation drawer, sources, activity log). It was recorded with a separate headless Chrome against the production URL and is not stored in the repository.

## Transcripts

See `transcripts/README.md`. The session transcript exported from Claude Code's session store is copied into `transcripts/` with API keys and e-mail addresses redacted; the copy is a snapshot taken near the end of the build session (2026-11-05, ~13:48) and does not include the final few actions.
