# TB Safety v0.1 — verbatim JSON snapshot

A byte-for-byte copy of the JSON packs in `/workspace/tb-safety/phase0/`, as handed over by T&S. Don't edit these files; a new T&S drop replaces them.

The game doesn't read these files. It reads `../phase0/`, where each pack has been converted to the engineering ingest shape (`_meta` / `rules` / `terms` / `patterns`, `_meta.status: safety-v0.1`). `packages/shared/src/safety.test.ts` checks the conversion against this snapshot:

- Every v0.1 blocklist entry is in an engineering rule with the same action. `preto` lives in `blocklists/ethnic-tokens.json` with its color/food contexts (CEO-LOCKS §1).
- Every allowlist term, rewrite hint and explicitly allowed drink is carried over.
- Every PII fixture keeps its examples. A changed regex must carry `canon_regex` and a `hardening` reason.
- Every labeled Jev example (public chat and NPC reply) is a fixture with the same labels. The one exception is pc18, which records the v0.1 value under `canon`.

The v0.1 markdown files (README, constitution, CEO locks, ops, under-13 notes) are used as-is in `../phase0/`.
