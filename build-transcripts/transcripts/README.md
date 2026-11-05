# Agent transcripts

This folder holds exported conversation transcripts of the build agent (Claude Code) sessions used to build Thesis.

## Provenance

- Transcripts here are **verbatim exports** produced by Claude Code's own session storage, copied without edits other than the redactions noted below. They are not summaries written after the fact.
- If a file is missing from this folder, the export was not available at the time of handoff; `session-log.md` is the accurate (non-verbatim) activity record.

## How transcripts are exported

Claude Code stores each session as a JSONL file under `~/.claude/projects/<encoded-working-directory>/<session-id>.jsonl`. The export in this folder was created by copying the session file(s) for this project and redacting secrets:

```bash
# list sessions for the home-directory project (this build ran from ~)
ls -t ~/.claude/projects/-Users-abhinavsingh/*.jsonl | head
# copy the session into the transcripts folder
cp ~/.claude/projects/-Users-abhinavsingh/<session-id>.jsonl build-transcripts/transcripts/
```

Redaction: a scripted pass removes any string matching common API-key patterns (`sk-ant-...`, `PARALLEL_API_KEY=...`, Vercel tokens). The redaction script and its output are described in `../validation.md`.

## What is and is not in a transcript

- Included: user messages, assistant messages, tool calls and tool results as recorded by the harness.
- Not included: hidden chain-of-thought (the harness does not persist raw reasoning), API keys or environment values.
