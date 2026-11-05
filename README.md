# Thesis

Deep research for investing questions. Ask a question, Thesis researches primary sources through Parallel's Task API, compresses the evidence into a structured report with one bounded Claude call, and presents a sourced executive brief, an expandable full thesis, evidence-backed charts, and clickable citations.

Built as an interview assignment. The visual direction is a light financial research desk adapted from actioneer.com's language (ivory surfaces, deep petrol text, restrained teal actions, editorial serif headings). Brand, content and code are original.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional: add keys to enable live research
npm run dev                   # http://localhost:3000
```

Without credentials the app runs in **demo mode**: the two labelled sample reports are fully explorable and the composer explains how to enable live research. It never answers arbitrary questions with canned content.

### Environment variables

| Variable | Required for | Notes |
| --- | --- | --- |
| `PARALLEL_API_KEY` | Live research | Parallel Task API key. Each run is a paid request. |
| `ANTHROPIC_API_KEY` | Live research | Report synthesis. |
| `THESIS_PARALLEL_PROCESSOR_QUICK` | optional | Default `core`. |
| `THESIS_PARALLEL_PROCESSOR_DEEP` | optional | Default `pro`. |
| `THESIS_SYNTHESIS_MODEL` | optional | Default `claude-opus-5-5`. |
| `THESIS_SYNTHESIS_EFFORT` | optional | `low` / `medium` / `high`, default `medium`. |
| `THESIS_MAX_EVIDENCE_CHARS` | optional | Evidence passed to synthesis, default 36000 characters. |
| `THESIS_RATE_LIMIT_PER_MINUTE` | optional | Research submissions per network address per minute, default 6. |

Both keys are read only on the server. Nothing secret is exposed under `NEXT_PUBLIC_*` or returned by `/api/config`.

### Scripts

```bash
npm run dev        # development server
npm run build      # production build
npm start          # serve the production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint (includes React compiler rules)
npm test           # vitest unit tests
```

## Architecture

```
Browser                         Server (Next.js route handlers)                 Providers
───────                         ──────────────────────────────                 ─────────
Composer ── POST /api/research ─▶ validate (Zod) ─▶ rate limit ─▶ jobs.createJob ─▶ Parallel POST /v1/tasks/runs
Workspace ─ GET /api/research/:id ─▶ jobs.getJobStatus ───────────────────────▶ Parallel GET /v1/tasks/runs/:id
          ─ GET|POST …/:id/report ─▶ jobs.getJobReport
                                     ├─ parallel.getResult ─────────────────▶ Parallel GET …/result?timeout=1
                                     ├─ evidence.normalizeEvidence  (dedupe sources, S1…Sn, citation-tag facts)
                                     ├─ synthesis.synthesizeReport  (one Claude call, Zod-validated output)
                                     └─ validate.validateAndRepair  (citation integrity, chart sanity, dedupe)
localStorage (recent reports)
```

Layers are kept separate on purpose:

| Concern | Where |
| --- | --- |
| Research-provider integration | `src/lib/research/provider.ts` (interface), `src/lib/research/parallel.ts` (adapter) |
| Research job lifecycle | `src/lib/research/jobs.ts`, `src/lib/client/useResearchJob.ts` |
| Evidence normalization | `src/lib/research/evidence.ts`, `src/lib/research/evidence-pack.ts` |
| Report synthesis | `src/lib/research/synthesis.ts` |
| Validation and quality pass | `src/lib/schema/report.ts`, `src/lib/report/validate.ts` |
| Chart data preparation | `src/components/report/ChartFigure.tsx` (`chartRows`, `niceScale`) with data validated by the report schema |
| Presentation | `src/components/home/*`, `src/components/workspace/*`, `src/components/report/*` |
| Export | `src/lib/report/markdown.ts` |
| Sample reports | `src/fixtures/*` (served only for ids beginning `sample-`) |

### Job model

There is no database. The Parallel `run_id` is the job id. Status is proxied from the provider on each poll, the synthesized report is cached in process memory for an hour (best effort on serverless), and the browser keeps the durable copy of its own reports in `localStorage`. If a server instance no longer remembers a run, the browser re-supplies the original question with the report request so synthesis can still complete.

Observable states: `queued` → `researching` → `synthesizing` → `completed`, plus `failed` and `cancelled`. "Synthesizing" is a real stage (the provider has completed and the synthesis call is in flight).

### Live research activity

While a run is in progress the workspace streams what the research agent is doing: its plan, each search objective and query, every source it extracts (linked), tool calls, and the provider's own progress meter and source counts. The server proxies Parallel's `GET /v1/tasks/runs/{run_id}/events` SSE stream through `/api/research/[id]/events`, normalizes the events, and never forwards credentials. The browser consumes it with `EventSource`, deduplicates replayed messages, and persists the trace to local history so the full agent trace is still readable under "Research activity" after the report is ready. Runs are created with `enable_events: true`. The progress percentage shown is the provider's `progress_meter`, not an estimate.

### Duplicate and failure handling

- The browser attaches an `Idempotency-Key` per composition; the server maps it to the run id for an hour, so a double submit does not create a second paid run on a warm instance. The submit button is also disabled while the request is in flight.
- A best-effort per-address rate limit curbs accidental bursts of paid runs.
- Provider HTTP errors are mapped to typed errors with safe, short messages; raw provider payloads are never forwarded. 408 and 429 are retryable; 401, 402, 403, 404, 422 are not.
- Synthesis errors (auth, rate limit, timeout, refusal, schema mismatch, truncation) are surfaced with a retry control when retryable.
- Cancellation: Parallel's docs expose no cancel endpoint for task runs, so "Stop waiting" stops polling only and says so. The run may complete and be billed; "Resume checking" picks it up again.

## Verified against the real providers

With real credentials in `.env.local`, a `core` run for "What is the investment thesis for Microsoft over the next three years?" completed in about four minutes, and synthesis with `claude-opus-5-5` took about 40 seconds, producing a 956-word report citing seven primary sources (FY2026 10-K, SEC exhibits, Microsoft IR releases and the FY27 Q1 call) with two charts and explicit limitations. Measured usage for that call: 4,402 input and 4,880 output tokens.

## Research-provider integration (Parallel)

Implemented against the official documentation read on 2026-11-05:

- Base URL `https://api.parallel.ai`, header `x-api-key`.
- `POST /v1/tasks/runs` with `input`, `processor`, `task_spec.output_schema` (JSON schema for the evidence pack), and `metadata`.
- `GET /v1/tasks/runs/{run_id}` for status (`queued`, `action_required`, `running`, `completed`, `failed`, `cancelling`, `cancelled`).
- `GET /v1/tasks/runs/{run_id}/result?timeout=1` for the result; a 408 means the run is still active.
- Citations come from `output.basis[]` (`field`, `citations[{url,title,excerpts}]`, `reasoning`, `confidence`) and are mapped to the evidence items they support, including element-level fields such as `facts.3`.

The adapter sits behind the `ResearchProvider` interface, so another provider can be dropped in without touching the job layer or UI.

Processors default to `core` for Quick and `pro` for Deep. In testing on 2026-11-05 `core` runs took about 4 minutes, `pro` about 3.5, and `base` about 5.5, so the processor is not a reliable speed lever; research time is set by the provider. The published list prices (docs.parallel.ai pricing page, read 2026-11-05) are shown in the report footer as a list price, clearly labelled as such, because the API does not return a metered charge.

## Token-efficiency strategy

The goal is useful information per token, for the reader and for the model calls.

1. **Structured intermediate evidence.** The provider is asked for a compact evidence pack (facts with periods and kinds, numeric metric rows, risks, catalysts, conflicts, missing items) instead of prose. Each item carries its own citations.
2. **Deduplication before synthesis.** Sources are deduplicated by canonical URL and numbered once; facts, metrics, risks and catalysts are deduplicated while preserving their citations.
3. **Bounded context.** The synthesis model sees only the normalized evidence document, capped at `THESIS_MAX_EVIDENCE_CHARS` (default 36k characters). The raw corpus never reaches the model, and nothing is resent across calls: there is exactly one synthesis call per report.
4. **Stable prefix, cached.** The system prompt is fixed and marked with `cache_control`, so repeated runs reuse the cached prefix.
5. **Schema-guided JSON with a word budget.** The model returns one JSON object following the report's JSON Schema (sent once in the cached system prompt) with a configurable target length (400–2,000 words, default 1,000); the server validates it with Zod and retries once with the errors if needed. Anthropic's strict structured-output mode was tried first and rejected the schema as too large to compile into a grammar, so validation happens server-side instead. Numbers go to the metrics table and charts rather than paragraphs.
6. **Quality pass on the server.** Unknown citations are dropped, charts without valid sources or with mixed periods are removed, duplicate risks and catalysts are collapsed, and uncited sources are noted.
7. **Brief by default.** The workspace opens on the executive brief plus one figure; the full report is one toggle away. Printing always produces the full report.

Tradeoffs: a single synthesis call means the model cannot ask for more evidence, so gaps are reported as limitations rather than filled; the character cap can truncate very long evidence (the report says so); the in-memory caches are per instance, so a cold start re-synthesizes a report that the browser has not yet stored.

Token usage is shown only when measured: the synthesis footer reports the model's own `input_tokens` / `output_tokens`. Word count and reading time are derived from the report text and are not presented as token counts.

## Report structure and quality rules

Executive brief (answer, opportunity, risk, key uncertainty) → investment thesis (3–5 points with evidence, implication, citations) → financial evidence table (periods, currency, units, estimates marked) → financial visuals (2–4 figures with takeaway, sources, forecast treatment, data table) → valuation and scenarios (only when supported; no target prices) → risks and counterarguments (including what would invalidate the thesis) → catalysts and monitoring → sources and limitations (cutoff, missing data, uncertainty, conflicts).

Every claim carries a kind tag: reported, guidance, consensus, assumption, or inference. Charts use teal for the primary series, muted gold for comparisons, restrained red for downside, and dashed/hatched treatment for forecasts; they share one axis and each offers its data table.

## Demo mode and sample reports

When either key is missing, `/api/config` reports `mode: "demo"`, the nav shows a Demo badge, the composer explains what is missing, and `POST /api/research` returns 503 with `live_research_disabled`. Only ids beginning `sample-` are served from fixtures.

The two sample reports (Microsoft; NVIDIA vs AMD) were hand-compiled by the build agent from figures read on 2026-11-05 from the companies' own press releases, 10-K filings, earnings-call pages and SEC exhibits. Each report states this in a visible notice, lists every source with its URL and date, and contains no market prices or valuation multiples.

## Data freshness and limitations

- Live reports are current to the sources the provider retrieves; the "as of" date and research cutoff are shown on every report.
- No market-data source is integrated, so prices and valuation multiples are never implied.
- Recent reports live in the browser's local storage only; links to live reports do not work in other browsers. Sample report links work everywhere.
- The rate limiter and idempotency map are in-memory and per instance.
- Parallel's `action_required` status is surfaced as a failure because the app cannot act on it.

## Deployment

The app deploys to Vercel with no extra configuration. Set the environment variables in the project settings to enable live research; without them the deployment runs in demo mode.

```bash
vercel deploy --prod
```

See `build-transcripts/handoff.md` for the current deployment status and reviewer URL.

## Build transcripts

All build records are in [`build-transcripts/`](build-transcripts/README.md): the brief, a chronological session log, decisions and tradeoffs, validation results, the handoff note, and exported agent transcripts with provenance notes.
