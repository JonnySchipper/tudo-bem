# Age policy — Phase 0

**Decision (CEO, Jonny — 25 Sep 2026): Phase 0 of Tudo Bem is an adult game. 18+ only.**

## What ships

- **Signup requires both:**
  1. A birth month + year that computes to **18 or older** (checked on the client and again on the server).
  2. An explicit **“Tenho 18 anos ou mais / I am 18 or older”** attestation on register (intro) and on the create-avatar screen for guests. No birth-date calendar on entry. The server rejects `createProfile` without `confirm18: true`.
- Under-18 users see an “adults only” screen with no avatar creator; it is sticky on that browser.
- **Data minimization:** the birth date is never stored. The profile keeps only `ageGate18: true`.
- Profiles created under the earlier 13+ build (no `ageGate18`) are sent back through signup.
- The age threshold is the single constant `MIN_AGE` in `packages/shared/src/constants.ts`.

## What stays exactly the same

The **Disney-safe content constitution** and the **Jev-style chat safety** stay fully in force for adults:

- No alcohol, dating/flirting, sensuality, slurs, politics, or scams in chat, NPC lines, item names, or store copy.
- PII and contact exchange are blocked.
- Self-harm messages are escalated.
- Rate limits and reports stay on.

The adult age gate doesn't relax any filter.

## What we are not building in Phase 0

- No under-13 / COPPA / GDPR-K flows.
- No parental consent or email-a-parent step.
- No kid-specific UI, age bands, or kid-only shards.

## Younger audiences

Younger audiences (teens, and later kids per the GDD’s 10+ vision) are a **later rollout, after thorough testing**. That requires, at minimum:

- A production Jev classifier with a labeled PT+EN safety set and measured precision and recall.
- Human moderation coverage and staff tools.
- Legal review.
- For under-13s: a real COPPA / GDPR-K consent flow.

Until then, `MIN_AGE` stays at 18.
