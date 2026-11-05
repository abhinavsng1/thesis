# Assignment brief (as received, 2026-11-05)

The brief below is recorded verbatim from the user's message that started the build session. The visual reference it names (actioneer.com) was inspected in a browser; observations are in `decisions.md`.

---

Build a polished, working full-stack deep-research product for investing and stock-focused questions.

This is an interview assignment. Prioritize:
1. Readability of the final research output.
2. Token efficiency and information density.
3. Clean aesthetics suitable for bankers.
4. Useful, evidence-backed graphs and visuals.
5. A deployed product reviewers can explore.
6. All build-agent transcripts collected in one location.

Deliver working code, not just a plan or mockup. Inspect the repository first, preserve useful existing code, and make reasonable implementation choices without stopping for routine questions.

## 1. Product concept

Name the product "Thesis".

The core flow:
- A user asks an investing question.
- An agent researches relevant sources.
- The product presents a concise investment brief, an expandable detailed thesis, supporting financial visuals, and verifiable citations.

Example questions:
- "What is the investment thesis for Microsoft over the next three years?"
- "Compare Nvidia and AMD on growth, valuation, and execution risk."
- "What could invalidate the bull case for Tesla?"

Build a focused research product rather than a general-purpose chatbot or trading terminal.

## 2. Visual direction: Actioneer

Use https://www.actioneer.com/ as the primary aesthetic reference. Inspect its current appearance with browser tools if available before designing.

Translate its visual language into a light financial research workspace:
- Warm ivory and off-white backgrounds.
- Deep petrol teal typography.
- Restrained teal accents and primary actions.
- Elegant editorial serif headings.
- Clean sans-serif body text and controls.
- Generous whitespace.
- Thin dividers.
- Softly rounded white panels.
- Subtle shadows.
- Compact uppercase metadata labels.
- A restrained floating navigation bar.

Actioneer's homepage uses oversized editorial typography, a floating light navigation panel, teal controls, and rounded information cards. Adapt those elements to this product's research workflow.

Keep the report itself light and highly readable. Prioritize the research composer and document over a full-screen photographic hero.

Create an original brand and interface. Do not copy Actioneer's logo, content, or proprietary assets.

Avoid:
- Purple gradients and generic AI dashboard styling.
- Excessive cards and nested containers.
- Decorative stock tickers or fabricated market prices.
- Oversized empty sections.
- Excessive animation.
- Dense trading-terminal layouts.
- Charts added purely for decoration.

The result should feel like an elegant investment research desk.

## 3. Stack and architecture

Unless the repository already has a suitable stack, use:
- Next.js App Router.
- TypeScript.
- Tailwind CSS.
- Accessible UI primitives where helpful.
- Lucide icons.
- Zod for runtime validation.
- Recharts for financial charts.
- A Next.js-compatible deployment target, preferably Vercel.

Keep architecture appropriate for a prototype. Avoid unnecessary infrastructure.

Separate:
- Research-provider integration.
- Research job lifecycle.
- Evidence normalization.
- Report synthesis.
- Chart data preparation.
- Presentation components.

Keep provider-specific code behind a replaceable server-side interface.

## 4. Initial experience

Create a polished first screen with:
- Compact Thesis branding and navigation.
- An editorial heading such as "Deep research. Clear conviction."
- A short explanation of the product.
- A prominent multiline question composer.
- Optional research depth: Quick or Deep.
- Optional investment horizon.
- Three useful example prompts.
- Recent research.
- An explicitly labeled sample report available without credentials.

Keep the input experience simple. Users should be able to start research without configuring several settings.

Example prompts should populate the composer and allow editing before submission.

## 5. Research workspace

After submission, transition into a dedicated workspace containing:
- The submitted question.
- Actual research status.
- A main research document.
- A compact section navigator on wide screens.
- A source drawer or panel.
- An expandable research activity log.
- Brief/full report controls.
- Copy, export, and print actions.

Provide clear states:
- Empty.
- Queued.
- Researching.
- Synthesizing, if this is an observable backend stage.
- Completed.
- Failed.
- Cancelled, where cancellation is supported.

Do not show fake progress percentages or claim stages that cannot be observed.

Use a responsive layout:
- Desktop: document with a restrained navigation rail or supporting panel.
- Mobile: a readable single column with accessible drawers and controls.
- Keep paragraph widths comfortable for reading.

## 6. Research integration

Use Parallel's deep research API if suitable.

Read current official documentation before implementation. Do not invent endpoints, SDK methods, response fields, pricing, or provider capabilities.

Requirements:
- Keep API credentials server-side.
- Document configuration in `.env.example`.
- Validate user input.
- Handle asynchronous research jobs and polling when required.
- Avoid relying on a single long-running serverless request.
- Handle timeouts, rate limits, malformed responses, and provider failures.
- Preserve citations and source metadata.
- Return safe, useful errors to the browser.
- Prevent duplicate submissions from unintentionally creating duplicate paid jobs.
- Avoid logging secrets.

If a separate synthesis model is needed, make it configurable and document its credentials.

When credentials are absent:
- Provide a clearly labeled demo mode.
- Use realistic fixtures with disclosed dates and sources.
- Let reviewers explore a complete sample report.
- Explain how to enable live research.
- Do not silently answer arbitrary questions using canned content.

## 7. Research quality

Favor primary sources:
- Company filings.
- Earnings releases.
- Investor presentations.
- Earnings call transcripts.
- Regulatory disclosures.
- Official economic or industry datasets.

Use reputable secondary sources for context when necessary.

Preserve:
- Source title.
- URL.
- Publisher.
- Publication date where available.
- Reporting period.
- Retrieval timestamp.
- Relevant evidence.
- Claim-to-source relationships.

Distinguish:
- Reported facts.
- Management guidance.
- Consensus estimates, if available.
- Model assumptions.
- Analytical inference.

Identify conflicting evidence and missing information. Do not make unsupported claims to fill a section.

Do not imply access to live prices or current valuation multiples unless a suitable data source is integrated. Show an "as of" date for time-sensitive information.

## 8. Report structure

Make the answer useful within the first 30 seconds.

Adapt the following structure to the question rather than forcing every report into identical sections.

### Executive brief
Approximately 100–150 words covering:
- Direct answer.
- Main opportunity.
- Main risk.
- Most important uncertainty.

Use a descriptive analytical stance when justified. Avoid an unsupported buy/sell verdict.

### Investment thesis
Three to five distinct points.

For each:
- Concise claim.
- Supporting evidence.
- Investment implication.
- Relevant citations.

### Financial evidence
A compact table of relevant metrics.

Include:
- Reporting periods.
- Currency.
- Units.
- Sources.
- Clear distinction between historical figures and estimates.

### Financial visuals
Include the most useful charts supported by the available evidence.

### Valuation and scenarios
Include only when adequately supported.

Where appropriate:
- Bear, base, and bull scenarios.
- Visible assumptions.
- Valuation methodology.
- Sensitivity to key variables.

Do not invent target prices or imply unsupported precision.

### Risks and counterarguments
Include:
- Evidence against the thesis.
- Execution and financial risks.
- What would invalidate the argument.

### Catalysts and monitoring
Identify:
- Specific developments to watch.
- Relevant metrics.
- Sourced event dates when available.

### Sources and limitations
Include:
- Clickable sources.
- Publication dates when available.
- Research cutoff.
- Missing data.
- Material uncertainty.

For company comparisons, prioritize side-by-side evidence and meaningful differences.

## 9. Graphs and visual storytelling

Use charts when they communicate evidence more clearly than prose.

Possible visuals:
- Revenue and earnings trends.
- Operating margin or free cash flow trends.
- Revenue breakdown by segment or geography.
- Peer comparison charts.
- Historical valuation multiples.
- Bear/base/bull scenario comparisons.
- Valuation sensitivity tables.
- Sourced catalyst timelines.

Choose roughly two to four purposeful visuals for a detailed report when data supports them. Fewer are appropriate when they answer the question adequately.

Do not force charts into reports lacking reliable numerical evidence.

Every chart must:
- Render from validated structured data.
- Show units, currency, reporting periods, and source links.
- Distinguish historical data from forecasts.
- Include a short analytical takeaway.
- Have readable tooltips.
- Offer an accessible underlying data table.
- Work on mobile.
- Remain understandable in print.
- Use consistent scales and colors.

Use:
- Teal for the primary series.
- Muted neutral colors for comparisons.
- Restrained red for downside.
- Dashed lines or another clear treatment for forecasts.

Avoid:
- Generated chart images.
- Invented data.
- Misleading axes.
- Unnecessary dual axes.
- 3D effects.
- Decorative animation.
- Pie charts with too many categories.
- Placing incomparable metrics on the same scale.

Keep the key takeaway visible without requiring hover.

Normalize periods and units before comparisons. Do not silently compare fiscal-year and calendar-year metrics or different currencies.

Let visuals replace repetitive prose while retaining essential conclusions and citations.

## 10. Token efficiency

Treat token efficiency as useful information per token.

Implement:
- A concise brief view by default.
- An expandable full report.
- A configurable output budget.
- A sensible full-report default around 800–1,200 words, adjusted to question complexity.
- Structured intermediate evidence rather than repeated raw text.
- Deduplication of claims and sources.
- Bounded retrieval and synthesis context.
- Removal of boilerplate and repeated conclusions.
- Tables and charts where they reduce explanation.
- A final quality pass for unsupported claims, contradictions, repetition, and mismatched reporting periods.

Do not repeatedly send the entire conversation or research corpus to every model call.

Keep citations attached to the claims they support throughout compression.

Show actual token usage and cost only when provider metadata supports them. Clearly label estimates. If reliable measurements are unavailable, omit them.

A report word count and estimated reading time are useful, but do not present them as exact token usage.

Document the token-efficiency strategy and its tradeoffs in the README.

## 11. Interactions

Implement:
- Clickable citation markers.
- A source drawer showing source title, publisher, date, URL, and relevant evidence when available.
- Brief/full report toggle.
- Copy report as Markdown.
- Download report as Markdown.
- Print-friendly styling for browser PDF export.
- Recent reports.
- Reopen a completed report.
- Clear error and retry controls.
- Cancellation when supported.
- Keyboard submission.
- Visible focus states.
- Accessible labels and sensible contrast.

Local browser storage is acceptable for recent reports in this prototype. Make this behavior clear and handle storage failures gracefully.

Do not add authentication, portfolio management, trading, or other unrelated features unless necessary for the core experience.

Render model output safely. Avoid unsanitized HTML and validate external link schemes.

## 12. Build transcripts

From the start, create one folder:

`/build-transcripts/`

Maintain:
- `README.md`: index of records.
- `user-brief.md`: assignment and design requirements.
- `session-log.md`: chronological record of implementation work.
- `decisions.md`: architecture choices and tradeoffs.
- `validation.md`: commands run, outcomes, and unresolved issues.
- `handoff.md`: setup, deployment status, URL when available, and limitations.
- A `transcripts/` subfolder for actual exported agent conversations.

Save actual agent transcripts when the environment supports exporting them. Do not fabricate transcripts or describe summaries as verbatim records.

If transcript export is unavailable:
- State the limitation.
- Maintain an accurate activity log.
- Explain how the actual session transcript can be exported using supported tooling.

Do not store:
- API keys.
- Credentials.
- Sensitive environment values.
- Hidden chain-of-thought.

Keep build transcripts separate from application research logs.

Application research logs should contain observable events, tool activity, source metadata, and appropriate provider responses rather than hidden reasoning.

Prepare the folder for sharing with the interviewer, but do not email or upload it to a third party automatically.

## 13. Testing and verification

Test:
- Input validation.
- Provider adaptation.
- Research job state transitions.
- Evidence normalization.
- Citation mapping.
- Chart data validation.
- Demo/live mode distinction.
- Provider failure handling.

Verify the complete user journey:
1. Select an example question.
2. Edit and submit it.
3. Observe actual research status.
4. Open the completed report.
5. Switch between brief and full views.
6. Inspect citations.
7. Inspect chart data.
8. Copy and download the report.
9. Reopen it from history.
10. Check the mobile layout.

Run type checks, relevant tests, and a production build.

If browser tools are available:
- Inspect the actual rendered application.
- Check desktop and mobile layouts.
- Check keyboard interactions.
- Fix overflow, awkward spacing, inaccessible controls, and chart issues.
- Inspect print styling.

Never claim a check passed if it was not run.

## 14. Documentation and deployment

Provide:
- Clear README.
- Local setup instructions.
- `.env.example`.
- Architecture overview.
- Research-provider integration notes.
- Token-efficiency approach.
- Demo-mode behavior.
- Data freshness and limitations.
- Deployment instructions.
- Transcript folder index.

Deploy if the environment has suitable authenticated access.

If deployment is blocked:
- Complete all work that does not require that access.
- State the exact blocker.
- Provide precise remaining steps.
- Do not claim deployment succeeded without a verified URL.

Ensure the eventual reviewer link is accessible to the intended audience. Clearly state any login or access restriction.

## 15. Definition of done

The result should:
- Look cohesive and premium.
- Reflect Actioneer's typography, spacing, warm light surfaces, and teal palette.
- Support a real end-to-end research flow when configured.
- Remain explorable through clearly labeled demo reports without credentials.
- Present concise, sourced investment analysis.
- Include useful financial visuals where evidence supports them.
- Preserve citations and expose supporting detail.
- Handle failures honestly.
- Pass relevant checks and production build.
- Collect build records in one location.
- Be deployed or have a clearly documented deployment blocker.

Start by inspecting the repository and visual reference. Then implement the product, validate it, and prepare the final handoff.

In your final response, include:
- What was implemented.
- How to run it.
- Required environment variables.
- Validation results.
- Verified deployment URL, if available.
- Transcript location.
- Remaining limitations.
