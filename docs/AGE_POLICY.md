# Age policy — Phase 0

**Decision (CEO, Jonny — 25 Sep 2026): Phase 0 of Tudo Bem is an adult game. 18+ only.**

**Update (27 Sep 2026):** the birth-date (month + year) step was removed from the start of the entry flow. Adulthood is now a one-time self-affirmation at signup. No date of birth is collected anywhere.

## What ships

- **Multiplayer (server build):** creating an account (email + password) requires ticking **“Confirmo que tenho 18 anos ou mais / I confirm I am 18 or older.”** The server rejects `/api/auth/register` without `confirm18: true` and records only *when* it was ticked (`confirmed18At`). The avatar creator doesn't ask again.
- **Solo (static build, no accounts):** the avatar creator shows the same checkbox. The `World` rejects `createProfile` without `confirm18: true`.
- **Data minimization:** no birth date is asked for, sent, or stored. Old clients that still send birth fields have them ignored. Profiles keep only `ageGate18: true`.
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
- For under-13s: a real COPPA / GDPR-K consent flow, which would bring back a proper age check at signup.

Until then, `MIN_AGE` stays at 18.
