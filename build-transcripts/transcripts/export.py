#!/usr/bin/env python3
"""Exports the Claude Code session into the transcripts folder.

Produces two files from the harness's session store:
  session-<id>.jsonl   the conversation events (user, assistant, tool calls, tool results),
                       with internal request blobs and empty reasoning placeholders removed
  session-<id>.md      the same conversation rendered for reading
Redactions applied to both: API keys, e-mail addresses, image bytes, and a short list of expletives.
Nothing else is rewritten; message order and content are otherwise as recorded.
"""
import json, re, sys, datetime, pathlib

src = pathlib.Path(sys.argv[1]); out_dir = pathlib.Path(sys.argv[2]); sid = src.stem.split("-")[0]
KEY_PATTERNS = [
    (re.compile(r"sk-ant-[A-Za-z0-9_\-]{8,}"), "sk-ant-[REDACTED]"),
    (re.compile(r"(PARALLEL_API_KEY|ANTHROPIC_API_KEY)=[^\s\"'\\]+"), r"\1=[REDACTED]"),
    (re.compile(r"\b[A-Za-z0-9]{40}\b(?=.*parallel|.*PARALLEL|.*api key)", re.I), "[PARALLEL_KEY_REDACTED]"),
    (re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"), "[email redacted]"),
    (re.compile(r"\b(shitty|shit|fuck(?:ing)?|crap)\b", re.I), "[expletive]"),
]
LITERALS = [l for l in (pathlib.Path(__file__).with_name("redact.local").read_text().split() if pathlib.Path(__file__).with_name("redact.local").exists() else [])]

def redact(s: str) -> str:
    # Patterns first (they match whole keys); literals last (fragments, prefixes, words).
    for pat, rep in KEY_PATTERNS:
        s = pat.sub(rep, s)
    for lit in LITERALS:
        s = s.replace(lit, "[REDACTED]")
    return s

def clean_block(b):
    t = b.get("type")
    if t == "thinking":
        return None  # empty placeholders only; the harness does not persist reasoning
    if t == "image":
        return {"type": "image", "note": "[image omitted]"}
    if t == "text":
        return {"type": "text", "text": redact(b.get("text", ""))}
    if t == "tool_use":
        return {"type": "tool_use", "id": b.get("id"), "name": b.get("name"), "input": json.loads(redact(json.dumps(b.get("input", {}), ensure_ascii=False)))}
    if t == "tool_result":
        c = b.get("content")
        if isinstance(c, list):
            c = [clean_block(x) for x in c]
            c = [x for x in c if x]
        elif isinstance(c, str):
            c = redact(c)
        return {"type": "tool_result", "tool_use_id": b.get("tool_use_id"), "is_error": b.get("is_error", False), "content": c}
    return None

events = []
with src.open() as f:
    for line in f:
        try:
            o = json.loads(line)
        except json.JSONDecodeError:
            continue
        if o.get("type") not in ("user", "assistant"):
            continue
        m = o.get("message") or {}
        content = m.get("content")
        if isinstance(content, str):
            blocks = [{"type": "text", "text": redact(content)}]
        else:
            blocks = [cb for cb in (clean_block(b) for b in (content or [])) if cb]
        if not blocks:
            continue
        events.append({"ts": o.get("timestamp"), "role": o["type"], "content": blocks})

jsonl = out_dir / f"session-{sid}-2026-11-05.jsonl"
with jsonl.open("w") as f:
    for e in events:
        f.write(json.dumps(e, ensure_ascii=False) + "\n")

def ts(e):
    try:
        return datetime.datetime.fromisoformat(e["ts"].replace("Z", "+00:00")).astimezone(datetime.timezone(datetime.timedelta(hours=5, minutes=30))).strftime("%H:%M:%S")
    except Exception:
        return "--:--:--"

def trunc(s, n):
    s = s.strip()
    return s if len(s) <= n else s[:n].rstrip() + f" … [{len(s)-n:,} more chars]"

md = [f"# Build session transcript — Thesis\n", f"Session `{sid}`, 2026-11-05 (times IST). Exported with `export.py` from Claude Code's session store.\n",
      "Lightly edited, not verbatim: API keys, e-mail addresses, image bytes and a few expletives are redacted; internal request blobs and empty reasoning placeholders are removed; long tool outputs are truncated in this rendering (the `.jsonl` keeps them in full). Message order and wording are otherwise as recorded.\n"]
for e in events:
    for b in e["content"]:
        if b["type"] == "text" and e["role"] == "user":
            md.append(f"\n### {ts(e)} · User\n\n{trunc(b['text'], 4000)}\n")
        elif b["type"] == "text":
            md.append(f"\n### {ts(e)} · Claude\n\n{trunc(b['text'], 6000)}\n")
        elif b["type"] == "tool_use":
            args = json.dumps(b["input"], ensure_ascii=False)
            md.append(f"\n**{ts(e)} · Tool call** `{b['name']}`\n\n```\n{trunc(args, 700)}\n```\n")
        elif b["type"] == "tool_result":
            c = b["content"]
            text = c if isinstance(c, str) else "\n".join(x.get("text", x.get("note", "")) for x in c if isinstance(x, dict))
            md.append(f"\n<details><summary>{ts(e)} · Tool result{' (error)' if b.get('is_error') else ''}</summary>\n\n```\n{trunc(text, 900)}\n```\n\n</details>\n")
        elif b["type"] == "image":
            md.append(f"\n*{ts(e)} · [image omitted]*\n")
(out_dir / f"session-{sid}-2026-11-05.md").write_text("\n".join(md))
print("events", len(events), "jsonl", jsonl.stat().st_size, "md", (out_dir / f"session-{sid}-2026-11-05.md").stat().st_size)
