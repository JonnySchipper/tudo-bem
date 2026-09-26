> **DEFERRED:** Phase 0 ships **18+** (CEO/Product 2026-09-25). Under-13 / COPPA path stays design-only; do not wire.

# Under-13 Design Notes — NOT SHIPPING YET

**Status:** Design only. Do not wire into production clients or Jev until COPPA-ready stack + legal sign-off.

## Phase 0 shipping posture

- **13+ worldwide** until real COPPA / parental consent / under-13 product path exists.
- Age gate at account creation: date-of-birth → reject under 13 with age-up message (no data retention of underage attempts beyond minimal compliance logging — legal to confirm).

## Stricter rules when under-13 eventually ships

Relative to 13+ Phase 0:

1. **PII:** tighter regex; block digit runs more aggressively; no street / school / CEP even in “roleplay.”
2. **Off-platform words even as jokes:** `discord`, `whatsapp`, `zap`, `telegram`, `snap`, `instagram`, `tiktok` → **block** in free chat regardless of “just kidding.”
3. **Dating / romance:** no warn tier — **block** all flirting/dating classes.
4. **Voice / UGC:** assume more restricted (out of scope for these fixtures).
5. **DMs:** default off or heavily limited (product decision).

See `pii/regex-fixtures.json` → `under13_stricter` and per-fixture notes.

## What stays the same

- Alcohol / substance ban
- Slur / family profanity ban
- Constitution surfaces (NPC, store, furniture never emit banned content)
- Prefer allow normal learning conversation and PT slang allowlist

## Open legal / product questions (CEO)

- US COPPA only vs multi-region under-13 (LGPD kids, GDPR under-16, etc.)
- Parental consent vendor
- Whether under-13 is a separate app / shard / UI skin

Until answered: **ship 13+ only.**
