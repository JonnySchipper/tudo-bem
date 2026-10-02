# "Correria no Balcão": redesign of the padaria minigame (formerly "Me vê um…")

Owner: Jonny ("upgrade the me vê um game; the name is horrible, rename it"). Boss brief, 2026-10-02.

## Name
- **New name: "Correria no Balcão"** (EN: "Counter Rush"). *Correria* is everyday Brazilian Portuguese for a frantic rush.
- Rename it **everywhere learner-facing**: the HUD, the guide arrow label, the ticket-rail prop label and hotspot, the tutorial step ("Jogue …"), the recado step text, the Caderno/journal, panel titles, toasts, the README, BR-REVIEW and the e2e/shot expectations.
- **"Me vê um …" stays as the phrase customers use to order.** It's the learning target (curriculum lock: EN "I'll take…", never "Give me…"; there are tests).
- Internal ids (`mg`, `meveum`, file names, protocol `t:'mg'`) may stay to limit churn, or be renamed if it's cheap. Your call, but be consistent.

## Locks
- Order text comes from the curriculum pack (`content/curriculum/phase0/me-ve-um-orders.md/json`) plus the generated combos with number/gender agreement (`numbers.ts`). Don't invent untagged PT: new lines are `needs_br`.
- **Server-authoritative**, with the daily RV gate and shift resume across server restarts (`scripts/e2e-meveum.mjs` restarts the server mid-shift on purpose and must still pass).
- **Time-of-day greetings** (`localizeGreeting`) for customers.
- **D12:** playable at any hour, with whoever is the baker on duty (Carlos or Dona Graça).

## What's wrong today
- A big modal over the padaria, with a grid of 12 item cards, three station boxes and a ticket.
- It works, but it's a form, not a game: no customers, no counter, no rush, no feel.

## The new game
**Behind the counter, in the world.** You step behind the padaria counter (the camera eases +1 zoom onto the counter, as the bout does). Shelves, the estufa, the chapa, the coffee machine and the register are pixel art in front of you, and the overlay stays compact.

### Shift loop (about 3 real minutes, 3 waves)
1. **Customers walk in.**
   - Neighbors and CPU looks queue at the counter, each with a **patience meter** (a little pixel clock or heart over their head). Regulars appear too: Nanda, Júlia, Bia and the vendors, tied to bonds.
   - Each orders in a **speech bubble + TTS**: "Bom dia! Me vê dois pães na chapa e um café com leite, por favor."
   - **Mixed modes, for learning:**
     - **written:** text bubble;
     - **listening:** spoken only, with a 🔊 replay costing a bit of patience;
     - **follow-up:** "Ah, e pra viagem!", or a change of mind: "Não, um suco em vez do café".
2. **Assemble in the world:**
   - click the real items on the shelves/estufa (they hop onto the tray);
   - the **chapa** toasts pão na chapa/misto (a 2–3 s sizzle; leave it too long and it burns);
   - the **coffee machine** pours (hold to pour café / café com leite; a small fill meter);
   - **packing:** bag (pra viagem) or plate (pra comer aqui).
   - Quantities matter ("dois", "três"), as do modifiers (sem açúcar, bem quente).
3. **Serve and get paid:**
   - Hand over the tray. The customer reacts in PT: "Perfeito, obrigado!", or corrects you: "Não, eu pedi DOIS pães…". The correction is a learning moment shown with a gloss.
   - Sometimes they ask **"Quanto é?"** and you answer the total (number practice), choosing or typing it. Then change is counted at the register.
4. **Rush and score:**
   - Waves get faster.
   - **Combos** for consecutive perfect orders; a **tip jar** fills with speed and accuracy.
   - End-of-shift card: customers served, perfect orders, tips, new words met (into the Caderno), and RV via the existing economy and daily gate.
5. **Progression:**
   - Unlock menu items and upgrades with shift stars:
     - a second chapa slot;
     - a faster coffee machine;
     - pastel and coxinha from the estufa;
     - Saturday "feijoada" special orders.
   - These are cosmetic and mechanical, never pay-to-win; they live on the profile, optional and defaulted.
   - **Difficulty** scales with the player's level: Verde gets slower customers, written orders and EN glosses on. Listening and follow-ups ramp in.

### Feel ("juice")
- The tray item hop, the chapa sizzle with steam particles, and the coffee pour stream.
- A bell "ding" on serve, and customer emote pops (😋 ❤️ 😤).
- The tip jar clink, a small screen nudge on a combo, and Seu Carlos/Graça cheering from the side ("Isso aí!").
- Audio is synthesized in the existing Web Audio style.

### Visual targets
- A pixel art **counter work area** (front view or ¾ close-up of the counter, consistent with the padaria interior):
  - shelf/estufa slots with each item (16 px icons exist; draw bigger 24–32 px "on the counter" versions);
  - a tray and paper bag/plate, the chapa with a lid and sizzle frames, the coffee machine with pour frames;
  - the register, the tip jar (fill states) and the bell.
- **Customers** are the existing characters, at the counter.
- **Overlay:** bottom strip, at most 35% of the screen on phones. It holds the order bubble mirror, the tray contents, the serve button and the wave/tip/combo HUD.
- **No modal over the padaria.** The old `meveum-ui.ts` modal is deleted at the end.

## Testing
- Pure shared logic: order generation by difficulty, modes, follow-ups/changes, chapa/coffee timing windows, scoring/combos/tips, totals, and the progression unlocks (seeded and deterministic).
- Server: the shift state machine, validation, the daily gate, **resume after a restart**, and anti-cheat timing.
- e2e: `e2e-meveum.mjs` is updated and still survives the mid-shift restarts, plus one full shift in `e2e.mjs`.
- Screenshots: a customer ordering (written + listening), the chapa and coffee in use, serving, a correction, "Quanto é?", the end card, and the phone layout.
