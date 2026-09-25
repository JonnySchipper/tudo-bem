# Tudo Bem — Trust & Safety Phase 0 Fixtures

Fixtures and policy only. No application code lives here. Cloud agents implement against these contracts.

**Product:** Tudo Bem — Brazilian Portuguese learning virtual world  
**Audience (Phase 0):** 18+ (CEO/Product lock 2026-09-25; GDD 13+/COPPA deferred)  
**Authority:** CEO constitution + GDD v1.0 §§2.3, 2.4, 12.4, 12.6

## What these fixtures are for

1. **Client regex PII** — first line of defense; block phone/email/handles/Discord/WhatsApp patterns before send.
2. **Stub Jev** — allow / warn / block / escalate on public chat and NPC replies (typed questions + labeled packs).
3. **EN + PT-BR slur / profanity blocklist** — exact + word-boundary matches; family product = mild-to-strong profanity blocks.
4. **Escalate queue** — stub destination for human review (Phase 0: log + flag; later: real ops queue).

Prefer allowing normal conversation. **False-block rate on PT slang is a KPI** — see `blocklists/allowlist-pt-slang.json`.

## Phase 0 stack order (must preserve)

```
client message
  → 1. client regex PII          (pii/regex-fixtures.json)
  → 2. stub Jev allow/warn/block (jev/*-pack.json)
  → 3. EN+PT slur blocklist      (blocklists/en-pt-slurs.json
                                   + dating / substance overlays)
  → 4. escalate queue            (ops/report-mute-kick-phase0.md)
```

Allowlist slang is consulted **before** slur/profanity block so `tá`, `cara`, `legal`, `pra`, `a gente`, etc. never false-block.

Constitution (`constitution.md`) applies **everywhere**: chat, NPC dialogue, furniture labels, store copy.

## Age gate

- Ship **18+** for Phase 0 (CEO/Product lock 2026-09-25).
- Under-13 path is **design only** — see `under13/design-notes.md`. Do not wire into production until COPPA-ready.

## GDD pointers

| Section | Topic |
|---------|--------|
| §2.3 | Safety / community norms |
| §2.4 | Age / COPPA posture |
| §12.4 | Jev typed questions (public chat + NPC packs) |
| §12.6 | Report / mute / kick / ban ops |

## Layout

```
phase0/
  README.md
  constitution.md
  blocklists/
    en-pt-slurs.json
    allowlist-pt-slang.json
    prohibited-substance.json
    dating-flirting.json
  pii/
    regex-fixtures.json
  jev/
    public-chat-pack.json
    npc-reply-pack.json
  ops/
    report-mute-kick-phase0.md
  under13/
    design-notes.md
```

## Implementer notes

- Matchers: prefer Unicode-aware word boundaries; strip zero-width / leetspeak lightly in Phase 0 (full evasion pack is later).
- Accents: PT terms often need accent-insensitive compare (`pô` vs `po`) — see comments on entries.
- Rewrite paths (substance → guaraná / suco / lanchonete) are **hints for NPC/store generators**, not auto-rewrites of player chat in Phase 0 (player chat: block or allow).
