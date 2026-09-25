> **Status:** engineering-draft — TODO(T&S): replace with the canonical `ops/report-mute-kick-phase0.md` (not in the ingest attachment). This describes what the Phase 0 build actually does today.

# Report / mute / kick — Phase 0 (as built)

Stack step 4 (escalate queue) per `../README.md`.

## What ships in Phase 0

| Event | Trigger | Player sees | Stored |
|---|---|---|---|
| **block** | PII regex, slur/profanity, alcohol, dating/sexual, scam, politics | Message not shown; friendly PT + EN note | `data/moderation.jsonl` (`kind: block`, labels) |
| **warn** | high-FP tokens (gostoso/gostosa/pelada, bar), mild insults, spam | Message shown **verbatim**; note to sender where configured | `kind: warn` |
| **escalate** | self-harm, threats, `preto/preta` outside color/food context | Message not shown; supportive or “sent to review” note | `kind: escalate` + server console warning |
| **report** | “Denunciar” on a player profile card | “Obrigado! Nossa equipe vai dar uma olhada.” | `kind: report`, reporter, target id, last bubble text |

- Player chat is **never rewritten or masked** (CEO-LOCKS §3).
- Rate limit: 5 messages / 10 s per player.
- The solo static preview keeps the queue in memory only (no server).

## Not in Phase 0 (TODO Phase 1)

- Staff console to review `moderation.jsonl` and clear the escalate queue.
- Mute (per-player, timed), kick from instance, temp-ban, permaban.
- Kitnet owner boot.
- Report reasons picker; repeat-offender scoring; hide-on-high-toxicity.
- Metrics: false-block rate on the PT slang allowlist (KPI), queue age, reports per 1k messages.
