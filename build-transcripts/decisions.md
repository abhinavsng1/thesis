# Decisions and tradeoffs

Architecture choices made while building Thesis, with the reasoning and what was given up.

## 1. New repository rather than reuse

The working directory had no repository matching the brief (`~/ai-research-os` is an unrelated curriculum app). A fresh Next.js 16 App Router project (`~/thesis`) was created with `create-next-app`, which enables Cache Components and Partial Prerendering by default. Nothing useful existed to preserve.

## 2. Two-stage pipeline: Parallel for retrieval, Claude for synthesis

- Parallel's Task API is asked for a **structured evidence pack** (facts, metric rows, risks, catalysts, conflicts, missing items) via a JSON `output_schema`, not for prose. Its `basis` array gives per-field citations, which the app maps to each evidence item.
- One bounded Claude call turns that evidence document into the report. (Updated after live testing: Anthropic's strict structured-output mode rejected the report schema as too large to compile into a grammar, so the model now returns a JSON object guided by the schema embedded in the cached system prompt; the server parses it, validates it with Zod, coerces it into the strict schema, and retries once with the validation errors.)

Why not let Parallel write the whole report? Its documented JSON-schema limits (nesting depth, field counts) make the full report shape risky, and prose output would lose the per-claim citation structure. Why not a multi-turn agent? Cost and token discipline: a single call over a deduplicated, size-capped evidence document is predictable, cacheable (fixed system prompt with `cache_control`), and auditable. The tradeoff is that the synthesis model cannot request more evidence; gaps are reported as limitations instead of filled.

Fallback: if the provider returns text instead of the requested JSON, the normalizer still builds a citation-tagged document and synthesis proceeds.

## 3. No database; the provider run id is the job id

Status is proxied from Parallel on every poll; the synthesized report is cached in process memory for an hour; the browser holds the durable copy in `localStorage`. This avoids provisioning a store for a prototype and keeps every state transition tied to a real provider response.

Costs of this choice (documented in README and handoff):
- Live report links do not work in another browser.
- On a cold instance the server does not know the original question, so the browser re-sends it with the report request (`POST …/report`), and a cold start can re-synthesize a report the browser had not yet stored.
- The idempotency map and rate limiter are per instance.

## 4. Idempotency and cost control

The composer generates an `Idempotency-Key` per composition and the server maps it to the run id for an hour; the submit button is disabled in flight; a per-address rate limit (default 6/minute) curbs bursts. Concurrent report requests for one run share a single in-flight synthesis promise. This is best effort rather than a hard guarantee, which is acceptable for a prototype and stated plainly.

## 5. Cancellation is honest, not fake

Parallel's documentation for task runs lists `cancelling`/`cancelled` statuses but no cancel endpoint. "Stop waiting" therefore stops polling only, says the run may complete and be billed, and offers "Resume checking". No fake cancel.

## 6. Observable states only

`queued → researching → synthesizing → completed | failed | cancelled`. "Synthesizing" is a real server stage. The activity log records provider status changes, synthesis start/finish, measured token counts, and errors, with timestamps.

Updated during the build: Parallel's event stream (`GET /v1/tasks/runs/{run_id}/events`) is proxied to the browser, so the workspace shows the agent's plan, searches, documents read, source counts and the provider's own progress meter live, grouped into collapsible steps with only the current one expanded. Synthesis is streamed too: the report request reports evidence received, each section as the model reaches it, and validation. The percentage shown is the provider's, never an estimate.

## 7. Report schema as the single contract

`src/lib/schema/report.ts` is shared by synthesis output, fixtures, the renderer and the Markdown exporter. Every claim carries a `kind` (reported / guidance / consensus / assumption / inference) and `sourceIds`. The server-side quality pass drops unknown citations, removes charts without valid sources or with mixed periods, and collapses duplicates.

## 8. Charts

Recharts with validated structured data only. Teal primary, muted gold comparison, restrained red downside; forecasts dashed (lines) or hatched (bars) and labelled; one axis; rounded tick scales; every figure has a takeaway, source citations, period and unit notes, and a toggleable data table (always shown in print). For cross-calendar comparisons (NVIDIA fiscal vs AMD calendar) the sample uses ordinal period labels and states the mismatch instead of aligning silently.

Palette validation: the dataviz validator passed colour-vision and normal-vision separation for teal/gold/red; the chroma check is marginal by design because the brief asks for muted comparison colours. Every multi-series chart therefore also has a legend and tooltips, so identity never relies on colour alone.

## 9. Visual direction

Translated from actioneer.com's computed styles (teal rgb(4,126,145), petrol rgb(18,61,71), pale panel rgb(234,243,247), 13–16px radii, floating light nav, large serif display) into a light research desk: ivory page, white panels with thin rules, Newsreader for headings and Figtree for UI/body. No photography, no gradients, one panel per idea, uppercase metadata labels only where the brief asks for them.

## 10. Sample reports are hand-compiled from verified figures

No provider credentials were available, so the two samples were compiled by the build agent from figures that research agents read on 2026-11-05 from Microsoft, NVIDIA and AMD investor-relations releases, 10-K filings, call pages and SEC exhibits. Each sample discloses this in a visible notice, lists every source with URL and date, and includes no prices or multiples. They are served only for ids beginning `sample-`, so arbitrary questions are never answered with canned content.

## 11. Synthesis model default

`claude-opus-5-5` at `medium` effort, configurable via environment variables. Opus is the SDK guidance default; medium effort keeps a 1,000-word structured report fast (about 40 s) and inexpensive. The call is streamed so section-by-section progress can be shown; the final message carries the measured token counts.

## 12. Deployment

Vercel, from the CLI. `build-transcripts/` and `tests/` are excluded from the upload via `.vercelignore` so the records are not published as part of the deployment. The deployment ran in demo mode until the user supplied `PARALLEL_API_KEY` and `ANTHROPIC_API_KEY`; it now runs live.

## 13. Things deliberately not built

Authentication, portfolios, trading, live market data, server-side report storage, webhooks (polling is sufficient at this scale and avoids an inbound endpoint to secure), Vercel Workflow (the provider already owns the long-running job; a second durable layer would be unnecessary infrastructure for this prototype).

## 14. Processor choice is not a speed lever

Quick was briefly moved to Parallel's `base` processor to shorten waits; a real run took 5.5 minutes against about 4 for `core` and 3.5 for `pro`, so Quick stayed on `core`. Research time is the provider's; the product's answer to the wait is the live step view, not a faster tier.
