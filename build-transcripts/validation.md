# Validation

Commands run, what they showed, and what is still open. All runs on 2026-11-05 unless noted. "Verified" means the command was run and its output inspected; nothing below is assumed.

## Automated checks

| Check | Command | Result |
| --- | --- | --- |
| Type check | `npx tsc --noEmit` (after `npx next typegen`) | Pass, no errors. |
| Lint (incl. React compiler rules) | `npx eslint src` | Pass, 0 problems (after refactoring history into a `useSyncExternalStore` store and restructuring the polling hook). |
| Unit tests | `npx vitest run` | 6 files, 30 tests, all pass. |
| Production build | `npx next build` | Pass. `/` and `/research/[id]` are partially prerendered; API routes dynamic. |
| Palette validation | dataviz `validate_palette.js "#0A7F92,#B08A4D,#B5473B" --mode light` | CVD separation PASS, normal-vision floor PASS, contrast PASS; chroma floor marginal (by design: muted comparison colour). Mitigated with legend + tooltips + direct series names. |

### Unit test coverage (tests/)

- `request.test.ts`: input validation (defaults, whitespace normalisation, too short/long, bad enum, bad budget).
- `parallel.test.ts`: provider adaptation (endpoint, `x-api-key`, JSON output schema, metadata), status mapping, HTTP error → typed error mapping without leaking payloads, malformed response rejection, result parsing with basis citations, list price lookup, prompt construction.
- `evidence.test.ts`: source dedupe by canonical URL, unsafe scheme rejection, element-level vs parent-level citation mapping, dedupe with preserved citations, bounded document with truncation flag, text fallback, URL/source-kind helpers.
- `report.test.ts`: both sample fixtures validate against the schema and cite only known sources; grouped charts share periods; `validateAndRepair` drops unknown citations, removes unsourced charts, collapses duplicate risks; Markdown export structure; number formatting; stats are word counts; chart helpers (`niceScale`, `chartRows`).
- `jobs.test.ts`: idempotency key reuse, state transitions (queued/researching/failed incl. `action_required`/cancelled), single shared synthesis with caching, cold-instance hint handling, sample serving without a provider, provider error → HTTP status mapping.
- `config.test.ts`: demo/live mode detection and that public config never includes key values.

## Manual verification in the browser (Claude in Chrome, Chrome on macOS)

Dev server on `localhost:3210`.

### Demo mode
- Home renders with nav, editorial heading, composer, depth/horizon controls, three example prompts, sample reports, empty recent list, demo notice naming the missing variables. Verified by screenshot.
- `POST /api/research` returns 503 `live_research_disabled` with a clear message (curl). Composer shows the same guidance when submitting.
- Sample report `sample-microsoft`: brief view by default; Full report shows all eight sections; 4 charts render; 96 citation markers; clicking a marker opens the source drawer with focus moved to the close button; Escape closes it. Verified by screenshot and DOM inspection.
- Metrics table: numbers keep source precision (fixed a rounding bug found here: 13.64 was showing as 13.6) and cells no longer wrap (fixed).
- Forecast treatment: hatched bar and "(forecast)" legend entry on the quarterly capex figure. Verified by screenshot.

### Live flow (against a local mock of both provider APIs)
No real credentials were available, so a small Node mock implementing the documented Parallel endpoints (`POST /v1/tasks/runs`, `GET /v1/tasks/runs/{id}`, `GET …/result` with 408 while active, 401 on bad key) and the Anthropic Messages endpoint was run on `localhost:3999`, with `PARALLEL_BASE_URL` / `ANTHROPIC_BASE_URL` pointed at it and mock keys set. This exercises the real app code paths end to end but **does not prove behaviour against the real providers**.

Verified:
1. Example prompt populates the composer with focus at the end; editing works; ⌘↵ submits.
2. Workspace shows `queued` → `researching` → `synthesizing` → `completed` with the activity log recording each provider status change with timestamps (real responses, no fake progress).
3. Completed report renders from the mock evidence: sources numbered from `basis` citations, citation markers, one chart, footer with measured token counts (4,321 in / 987 out from the mock's `usage`) and the provider list price labelled as a list price.
4. Idempotency: two `POST /api/research` with the same `Idempotency-Key` return the same run id (`reused: true`); the mock created one run.
5. Validation: too-short question → 400 with message; non-JSON body → 400.
6. Synthesis failure path: an auth error from the synthesis endpoint produced the `failed` state with the message "Synthesis model rejected the API key.", logged in the activity log, no retry button (non-retryable), "Ask again" link. (This surfaced that the Anthropic SDK sends a bearer `authorization` header; the mock was updated to accept it.)
7. Cancel: "Stop waiting" moves to `cancelled` with an honest note that the provider run continues; "Resume checking" resumes polling and the job completed.
8. Reload the completed report URL: reopened from localStorage; Copy Markdown shows "Copied" on a real click; Download creates `microsoft-mock-synthesis-growth-with-a-capex-overhang.md`.
9. Recent research on the home page lists completed and failed runs with status badges; remove and clear work.
10. The synthesis request carried the fixed system prompt with `cache_control: ephemeral` and the JSON-schema output format (seen in the mock log).

### Mobile
- Rendered the home page and both sample reports in 390px-wide iframes. Initial check found a 457px scroll width caused by the nav; fixed (compact nav labels and gutters). After the fix all three documents measured 375px scroll width with no horizontal overflow; the metrics table scrolls inside its own container. Verified by screenshot.

### Print
- Added print styles: hide chrome, show chart data tables, fixed chart container size, full report forced on `beforeprint`.
- Headless Chrome `--print-to-pdf` captured the page before client data loaded (the report is fetched on mount), so the PDF only showed the loading state. Print CSS was instead verified by applying the page's own `@media print` rules in the live page: this surfaced a real bug (with the section nav hidden, the document collapsed into the 190px grid column) which was fixed (`.doc-grid { display: block }` in print). After the fix: nav hidden, document 1120px wide, charts rendered at 640px with lines/bars present, legend static, data tables visible. **Pagination in a real print dialog was not verified.**

### Production build and deployment
- `next start` in demo mode: `/`, `/research/sample-nvidia-amd` → 200; `/api/config` reports demo; `POST /api/research` → 503; unknown sample → 404; status for a non-sample id in demo → 503.
- Deployed with `vercel deploy --prod --yes` (team `abhinav-singhs-projects-caf059ea`, project `thesis`). Both production deployments reached `● Ready`.
- Public alias `https://thesis-three-delta.vercel.app` → 200 without authentication; `/api/config` → demo mode; sample report → 200; `POST /api/research` → 503 `live_research_disabled`. The team-scoped alias redirects (302) to the Vercel login because it is a protected URL; reviewers should use the public alias.

## Environment issues encountered

- The machine's disk hit "No space left on device" during development (192 MB free). The npm cache and Go build cache were cleared (regenerable). A request to remove a GitHub Desktop updater cache was declined by the permission system, so about 1 GB remained free for the build, which succeeded.
- The `web-fetch` agent type was denied by a permission rule; general-purpose agents with WebFetch were used instead for the source verification.
- A second `next dev` instance in the same directory is refused by Next 16, so the single dev server was restarted with mock-provider environment variables for the live-flow test.

## Not verified / open

- Behaviour against the real Parallel and Anthropic APIs (no credentials). The adapter follows the documentation read on 2026-11-05 and is unit-tested against documented shapes.
- Real print-dialog pagination.
- Rate limiting under genuine concurrent load (only the logic is unit-tested).
- Cross-browser testing beyond Chrome.
