# Academia do Bairro: roll redesign brief

Owner: Jonny ("visually and gameplay it sucks"). Boss brief, 2026-10-02.

## Locks (do not break)
- **Learning content stays A1 Portuguese.** Prompts are about everyday Portuguese, never BJJ technique trivia (CEO lock, `academia.ts` header, PR #44/#46).
- **No "Oss", "rola" or technique nameplates in learner-facing copy** (Product B scrub, PR #46). That includes the V3 "OSS" wall poster and Bia's "Oss! Bora treinar?" idle line: replace them with neutral copy ("Bora treinar?", a poster reading "RESPEITO · TREINO · AMIZADE").
- **No "Gracie" anywhere** (`academia-branding.test.ts`).
- Position names may appear as **labels**, as they do today (`POSITION_LABELS`). They're places on the mat, not quiz content.
- Server-authoritative: the server owns the bout state; the client presents it.

## What's wrong today
- **Visuals:** a tall modal covers the gym, with smooth vector figures (`render/bjjPoses.ts`) that clash with the pixel world. Disclaimers and "(v0)" labels clutter it.
- **Gameplay:**
  - It's a multiple-choice quiz with a progress bar.
  - The CPU "gets it" 38% of the time at random, with no decision, timing or risk.
  - Nothing feels like a roll.

## The new roll: "Treino no tatame"
The roll happens **in the world, on the academia mat**, with a compact overlay. The camera eases +1 zoom step onto the mat (as the dialogue does). The bleacher CPUs watch and react. Professora Bia referees.

### Match flow (about 2–3 real minutes)
1. **Intro:**
   - The two fighters walk onto the mat and face each other. They bump fists, and Bia calls "Combate!".
   - The scoreboard shows: a pixel board with **Pontos / Vantagens / Tempo**, the player vs the partner, and a "5:00" clock that counts down faster than real time.
2. **Exchanges (the core loop, about 8–12 s each):**
   - a. **Choose an intent:** 2–3 chips of simple A1 PT verbs that fit the current position, for example **Puxar**, **Empurrar**, **Segurar**, **Levantar**, **Girar**, **Esperar**, each with its EN gloss. Each intent has a risk/reward profile (bold intents gain more but cost more on a miss), shown by a tiny icon.
   - b. **Language challenge** with a **timer ring**:
     - kinds: cloze, choice, reorder, **listening** (🔊 hear a short phrase and pick it) and **type one word** (scored with the accept-list rules, accents optional);
     - content: from an expanded A1 bank (60+ items, `needs_br`), weighted by the player's Caderno: words not yet learned show up more.
   - c. **Resolution:** your **correctness + speed** against the partner's **skill profile** (accuracy, speed, aggression) moves a **momentum bar** (tug-of-war).
     - Crossing a threshold changes the **position** on the existing ladder (de pé → guarda / meia-guarda → cem quilos → joelho na barriga → montada / costas), with a pixel transition animation.
     - Points are announced by Bia in PT: "Dois pontos!", "Três pontos!", "Quatro pontos!", "Vantagem!". This doubles as number practice.
   - d. **Grip meter ("pegada"):** each fast correct answer adds to it, and a miss drains it.
3. **Finalização:**
   - When you're in a dominant position (montada/costas) with a full pegada, a **"Finalização!"** chance appears: a harder, multi-step prompt (reorder a full sentence, or 3 quick clozes in a row) under a tight timer.
   - **Success:** the partner taps, the mat flashes, the crowd cheers, Bia raises your hand.
   - **Failure:** the partner escapes back to guard.
   - The partner can do the same to you. Your defense is a quick "escape" challenge.
4. **Time up:** the decision goes on points (then advantages), and Bia announces it in PT.
5. **Outro:** a fist bump, then "Obrigado pela partida". Rewards come from the existing economy: RV, stripes, and the friendship bond with Bia.

### Partners and progression
- **5 partners** drawn from the academia CPUs, each with a clear style:
  - fast but sloppy;
  - slow and precise;
  - aggressive (goes for finishes early);
  - defensive (hard to finish);
  - balanced.
- Each partner has a portrait card and a one-line PT bio.
- Partners unlock with stripes. **Belts:** 4 stripes on the faixa branca earns the **faixa azul** (blue belt), worn on the avatar in the academia and shown on the profile card. Belts can't be bought.
- **Verde-friendly:** generous timers at the start, and "Mostrar inglês" respected. Timers shrink only as the player's stripes grow.

### Feel ("juice")
- A 2–3 frame hit-stop on each scramble.
- A tiny camera nudge (off under `reducedMotion()`).
- Dust puffs on the mat, sweat sparkles in long exchanges.
- The bleacher CPUs pop emote icons (👏 🔥 😮) and short PT shouts: "Vai!", "Isso!", "Segura!", "Boa!".
- Bia's referee hand signals: points held up on her fingers, a wave for advantage.
- Sound: a mat slap on transitions, synthesized crowd swells on points.

### Visual targets
- **Two-person grappling sprites,** in the LimeZu-compatible 16 px style:
  - one composite per position: de pé (grips), guarda fechada, meia-guarda, cem quilos, joelho na barriga, montada, costas;
  - 2–4 idle "struggle" frames each, plus **transition animations** between adjacent positions (3–4 frames);
  - a finish/tap pose, a raised-hand win pose, and the fist bump;
  - **gi colors** are white vs blue. Skin and hair colors of both fighters come from palette-swap ramps (the Phase 3 key-ramp system), so the player looks like their avatar.
- The mat zone gets a pixel **scoreboard** prop, and Bia gets referee poses.
- The **overlay** sits along the bottom, under 35% of the screen on phones:
  - the challenge card with its chips and timer ring;
  - the momentum bar and pegada meter;
  - a compact scoreboard pinned at the top.
- **No modal over the gym.**
- `render/bjjPoses.ts` (vector canvas art) and the old modal are **deleted** at the end.

## Testing
- Pure shared logic (`academia.ts`): the momentum math, intents, the position ladder, scoring, finalização, partner profiles and timers, all deterministic with seeded RNG.
- Server tests for the bout flow and anti-cheat (the server validates answers and timing).
- e2e: the existing `TB_TEST_ROLL` debug hints are updated for the new flow, plus one full match path in `scripts/e2e.mjs`.
- Screenshots: the intro, a mid-exchange, a transition, the finalização chance, the win, and the phone layout.
