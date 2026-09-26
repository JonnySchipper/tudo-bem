# Stub Jev engine config (Phase 0)

`../phase0/` is **TB Safety v0.1**, a verbatim copy of `/workspace/tb-safety/phase0/`. Treat it as read-only; changes come from T&S.

This folder holds what the deterministic stub (`packages/shared/src/safety.ts`) needs on top of that pack. Every rule has a `basis` field naming the canonical file, CEO lock or constitution section it implements.

| File | What it holds |
| --- | --- |
| `engine.json` | Named conditions (`flirt_or_body_directed`, `clear_address_or_place_name`, `color`, `food`), inflection variants (`preta`, `macaca`, …), stub-Jev class rules (insult, threats, self-harm, politics/religion, scam/RMT, flirt-directed), extra blocklist and PII terms, PII pattern hardening, the category → label → `content_class` maps, toxicity scale, player notes, and the list of divergences from canonical labels. |
| `regression-fixtures.json` | Engine regression cases: CEO-lock edges, the e2e chat lines, and false-block guards from the pre-v0.1 build. |

## How the pack is read

1. **PII**: every `pii/regex-fixtures.json` fixture, plus `pii_extra`. A leading `(?i)` becomes the `i` flag. `pii_hardening` replaces two v0.1 patterns that fail their own examples in JavaScript (`social_handle_at`, `school_name_hint`); the reason is recorded next to each.
2. **Stub Jev**: `jev_rules`. The answers are checked against every example in `jev/public-chat-pack.json` (`jevPublicChat`) and `jev/npc-reply-pack.json` (`jevNpcReply`).
3. **Blocklists**: every entry in `en-pt-slurs.json`, `dating-flirting.json` and `prohibited-substance.json`, with its `action`, plus `extra_terms`. `block_if`, `allow_if` and `allowlist_senses` resolve to `conditions`. Terms in `allowlist-pt-slang.json` and the substance pack's `explicitly_allowed` are consulted first: a hit inside an allowlisted word or phrase doesn't count.
4. **Escalate queue**: the server logs every non-allow verdict with the fields from `ops/report-mute-kick-phase0.md` (surface, labels, rule ids, toxicity, `status: pending` for escalations and reports).

`exact` and `word_boundary` both match whole tokens or phrases after normalization (lowercase, accents stripped, light leetspeak). Nothing stems. Actions are allow / warn / block / escalate only. `rewrite_not_used` holds: `rewrite_hints` are for NPC and store generators, and player chat is never rewritten.

## Divergences from v0.1 labels

Listed in `engine.json` → `fixture_divergences`. CI fails if the engine differs from a canonical example anywhere else.

- **pc18** (`vote no candidato X 2026`): v0.1 labels it `escalate`, noting "until dedicated class exists". The engine **blocks**: the constitution surface matrix says player-chat politics = block, and the engine has a dedicated politics rule.

## Questions for T&S (next pack)

- `content_class` has no politics or self-harm choice. The engine answers `insult` for both, as pc18 does for politics. The precise label is still in `SafetyVerdict.labels`.
- `social_handle_at` and `school_name_hint` fail their own examples as written (see `pii_hardening`).
- Several `examples_nomatch` are reviewer notes rather than samples. CI tests any `'quoted'` sample and skips notes with an em dash.
- `pii/regex-fixtures.json` and `under13/design-notes.md` still say "Phase 0 ships 13+". The CEO lock is **18+**. Under-13 rules stay unwired.
