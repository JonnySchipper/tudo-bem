# Treino no tatame v3: "Comando" (the jiu-jitsu overhaul)

Owner: Jonny ("it isn't quite fun yet; complete overhaul; take complete creative freedom"). Design brief, 2026-10-09.
This supersedes the gameplay sections of ACADEMIA-REDESIGN.md and the "Tatame v2" entry in DECISIONS.md. The locks below still hold.

## Locks (unchanged, enforced by tests)
- Learning content is everyday A1 Portuguese, never technique trivia. No "Oss", no "rola", no "Gracie".
- No position or submission names in learner-facing copy or the client bundle (#49, `academia-lock.test.ts`). Pose ids stay internal.
- Server-authoritative: the server owns the state, deals every beat and judges every tap. The client presents.
- Belts and stripes from wins only (5/10/20/40/80 per stripe, four stripes promote). Nothing is bought. The beta stays free.
- `UNLOCK_ORDER` (which move each stripe teaches) and the professor drill stay. The partner cards, bond and RV rewards stay.
- New spoken lines are prebaked (`pnpm tts`), see docs/VOICES.md.

## Why v2 is not fun (the diagnosis)
1. **One tap, then seven seconds of watching.** Cartoon (2 s), partner "thinking" (3.2 s), partner cartoon (2 s). Ten turns of that.
2. **A dice roll decides.** You pick the right card and still lose 40% of the time. Nothing you do with your hands changes the outcome.
3. **No arc.** Five turns each is not enough to climb grip → throw → pass → top → finish. Matches end 2–0 on one takedown. The finish never happens.
4. **Reading, not playing.** Five cards, each with a percent, odds parts, a hint, a badge, a track label and an English gloss, plus a "waiting for a grip" row. The decision is "press the yellow one".
5. **Partners are numbers.** Felipe's speed only changes how long he "thinks".
6. **The Portuguese is passive.** Words sit on cards. Nobody hears or does anything with them.

## The pillars of v3
1. **Your hands decide.** There are no dice. A move lands because you heard the command and hit the right button in time.
2. **Portuguese is the controller.** Professora Bia calls A1 imperatives (Pega! Puxa! Empurra! Gira! Levanta! Aperta!) and the buttons are those words. Hearing → doing (Total Physical Response). The lesson *is* the game.
3. **Every match tells a story.** Sixteen exchanges, enough to go from a grip to the finish. The finish is reachable, risky and spectacular.
4. **Partners are felt in the hands.** Felipe's attacks come fast (short defense windows) but he botches a lot. Helena is slow and clean. Daniel's finish takes one more command and he never panics. Rafael attacks every turn and, from blue belt on, feints.
5. **Nothing to read mid-fight.** At most four cards, one line from Bia, big buttons with one word each.

## The loop: one exchange ≈ 9 s

### A. Sua vez: pick (strategy beat, no pressure)
The server offers at most **four** cards plus a small **Segurar** (hold, passes the turn, keeps a lead). `offerCards()` ranks the legal moves:
1. the move that answers the partner's telegraph ("Responde!"), if any;
2. the best scoring attack from here (highest points reachable; grip follow-ups first);
3. a finish (submission) when legal;
4. a setup or defense (a grip you don't hold, Postura, Base, Recuperar).
A card shows: the PT name, the EN gloss (when English help is on), what it does in plain words (+2 · você por cima / Protege você / Vale a vitória!), and **chevrons for the chain length** (› ›› ›››). No percentages anywhere.
The telegraph stays: one line, "Mateus vai tentar a queda." A 12 s pick timeout plays Segurar, as today.

### B. Executar: the chain (skill beat)
Every move is a **chain of 1–4 commands**. Bia calls each command (voice clip + the word, big) and the player taps it on the **command pad** within the window. The pad is six buttons in a fixed layout, always the same order:

| key | PT | EN |
| --- | --- | --- |
| 1 | Pega! | Grab! |
| 2 | Puxa! | Pull! |
| 3 | Empurra! | Push! |
| 4 | Gira! | Turn! |
| 5 | Levanta! | Lift! |
| 6 | Aperta! | Squeeze! |

Fixed sequences per move (the "technique", learnable like a fighting-game input; the drill teaches it):

| move | chain |
| --- | --- |
| collar_tie, sleeve_grip | Pega |
| posture | Levanta |
| sprawl (Base) | Empurra |
| frame as Recuperar (bottom of guard) | Empurra |
| sleeve_pull (Puxar) | Puxa |
| double_leg (Queda) | Puxa · Levanta |
| body_lock (Abraço) | Pega · Gira |
| collar_drag (Arrastar) | Puxa · Gira |
| hip_throw (Arremesso) | Puxa · Gira · Levanta |
| single_leg (Tornozelo) | Puxa · Levanta · Gira |
| hook_sweep (Gancho) | Puxa · Gira |
| hip_bump (Quadril) | Levanta · Empurra |
| scissor_sweep (Tesoura) | Puxa · Empurra · Gira |
| passar from the guard (3 pts) | Empurra · Levanta · Gira |
| passar from side / knee (to the top, 4 pts) | Empurra · Gira |
| knee_on_belly (Joelho) | Levanta · Empurra |
| back_take (Encaixe) | Puxa · Gira · Pega |
| frame as an escape (side, knee, top), the stripe lesson | Empurra (resets the exchange) |
| escape_back (Sair), the stripe lesson | Empurra · Gira (resets the exchange) |
| virar (Virar), everyone from day one, under side / knee / top | Empurra · Gira (keeps the exchange) |
| virar from the back | Empurra · Gira · Levanta |
| americana | Pega · Empurra · Aperta |
| armbar (Braço) | Pega · Gira · Levanta · Aperta |
| rnc (Pescoço) | Pega · Gira · Aperta |
| hold (Segurar) | no chain |

**Virar** (round 2, 2026-10-09) is the way out from under that every fighter has from day one, like Segurar: it is not in `UNLOCK_ORDER`. It lands in the guard with the escaper underneath, scores nothing and does not start the exchange again (the top fighter cannot farm the same pass by letting it happen). Trava! stops it; the guard brace (Recuperar) does not. Card: "Sai de baixo", kind defense. No new art: it drives the Recuperar clip (Sair's from the back). The stripe lessons stay strictly better: Recuperar is one command and Sair two, and both reset the exchange. The AI values an escape by the ground it recovers, so a partner escapes when it is under and still sweeps once it is in the guard; the player on top gets a Trava! beat while climbing.

Rules of the chain:
- **Window** per command: `cmdWindowMs(level) = round(2200 × max(0.5, 1 − 0.05 × level))` (level = `bjjLevel`: 2.2 s for a new white belt, 1.76 s at blue, 1.1 s floor). A first-ever match (wins 0) gets ×1.4.
- A tap within 45% of the window is **Perfeito!**, within the window **Boa!**, wrong or late is a miss and the chain stops there ("Errou!" / "Tarde!").
- The move **lands only when every command is hit.** A miss plays the move's miss clip from where it broke (the stumble). A missed submission still drops the attacker to the bottom of the guard (the risk that makes the finish a decision).
- **Pegada bonus:** the collar grip makes every throw chain one command shorter (min 1); both grips open Arremesso (as today). The sleeve grip is the shield: your defense windows ×1.35 while you hold it. Grips slip after three of your turns, Postura strips one. Lone-collar punishment and the odds parts are gone.
- **Partner defense stat:** `defense ≥ 0.75` adds one command to your submissions and to any attack worth 3+ points against them (Daniel is hard to put away).
- **Ritmo:** a chain where every tap was Perfeito counts a "perfect". Three perfects in a row: Bia calls "Que ritmo!" and you get a Vantagem. A miss resets the count.
- The stage draws the chain: the clip's wind-up frames (0–3) advance with the taps, and the final tap plays the impact, the landing and the settle (frames 4–7) with the existing flash, dust, hit-stop and word pops. The fighter does the move as you command it.

### C. Vez do parceiro: the defense (reaction beat)
The partner's move was chosen by the existing AI (`planBot` / `botCommit`) and telegraphed during your pick. After your move resolves:
1. If the partner picked a grip or an attack: the stage plays their clip's wind-up (frames 0–3, ~0.7 s), then the **defense pad** appears, four fixed buttons:

| key | PT | EN | stops |
| --- | --- | --- | --- |
| 1 | Postura! | Posture! | a grip (pegada) |
| 2 | Base! | Base! | a takedown or a sweep (queda, raspagem) |
| 3 | Trava! | Block! | a pass or a climb (passagem), or an escape from under (Virar, Recuperar, Sair) |
| 4 | Sai! | Get out! | a finish (final): see below |

   At white belt Bia **calls the right defense** ("Base!") as the pad appears: it is a listening task. From blue belt on she is silent and the telegraph alone says what is coming: it is a reading task (queda → Base). The EN gloss under each button says what it stops while English help is on.
2. The window: `defWindowMs = cmdWindowMs(level) × (0.82 − 0.22 × partner.speed) × (your sleeve grip ? 1.35 : 1)`, and ×1.4 against an escape from under (Virar, Recuperar, Sair: slower than a throw). Felipe's attacks give you 0.62 of a chain window, Rafael's 0.68, Daniel's 0.71, Mateus's 0.72, Helena's 0.75. (Tuned in `matSim.test.ts`; the first draft's 1.1 − 0.4 × speed made every partner a pushover.)
3. Right in time → **Defendeu!** The partner's miss clip plays. If the move was a scoring attack, that is a **Vantagem** for you (the brace rule of v2, now earned by a tap). Wrong or late → the move lands in full (their hit clip, points, the position change).
4. A **brace** you put up on your turn (Postura / Base / Recuperar) still auto-blocks the matching attack with no tap needed and gives the Vantagem. That is the strategic trade: spend your turn for a sure block, or attack and trust your reaction.
5. **Partner clean chance:** `clean = min(0.95, accuracy + 0.2 − 0.04 × (chainLength − 1))` (tuned: Felipe 0.74 on a grip and 0.70 on a two-command move, Mateus 0.80, Helena, Daniel and Rafael 0.92–0.95). A partner that is not clean botches on their own: Bia says "Errou!", the miss clip plays, no defense beat (sloppy Felipe feels sloppy). This replaces the old accuracy edge.
6. **Partner submission on you:** three windows of **Sai!** in a row (an escape mash). Miss any and you tap out ("Final!" for them). Daniel's (defense ≥ 0.75) is four.
7. **Feints:** from blue belt, a partner with aggression ≥ 0.5 feints with chance `0.15 × aggression`: the telegraph names one kind, the move is another legal one (the server picks the second-best plan of a different attack kind). Bia does not warn. A feint that you still block is a normal block.
8. The partner's hold ("Mateus segura.") is a half-second beat with no pad.

### D. The finish
A submission chain ends with **Aperta!** on a tight final window (×0.8). While the chain runs the partner's **escape bar** fills over the chain's total time; the last tap in time beats it. Success: slow-motion impact, mat flash, crowd roar, Bia raises your hand, "Final! Vitória sua!". Failure: "Escapou!", you end on the bottom of the guard.

### E. The match
- `MAT_TURNS` 10 → **16** (eight attacks each). The clock prop counts down 2:00 of game time, 7.5 s per exchange. With ~9 s per cycle a match is about 1:40 real time plus intro and outro.
- Points and advantages unchanged (2 takedown/sweep, 3 pass, 2 knee, 4 top, submission ends it; advantages break ties). The control meter stays as the read.
- Dead time removed: no 3.2 s "thinking" pause (the defense beat is the partner's turn); clips are driven by the taps; a resolve beat is 0.6–0.9 s.

### F. Learning payload and the end card
- Every command heard or tapped is a Caderno `heard` / `used` event (`deps.caderno`), so the mat feeds the player's notebook (cards: see `content/curriculum`; add the imperatives to `cards.json` if missing, `needs_br`).
- The end card adds **Palavras de hoje** (the commands used, PT with EN) and **Comandos perfeitos: N**, next to the existing score, RV, belt row, bond line, next stripe, coach tip and diary word.
- The stripe **drill** teaches a new move as its chain with no timer: Bia calls each command slowly, the player taps, the clip advances. "Agora você."
- First match ever: three one-line coach notes (at the first pick, the first chain, the first defense). Never again after wins ≥ 1 (`profile.bjj.coached` is not needed: wins 0 is the condition).

### G. Voice (Bia, speaker `prof`)
Commands: Pega!, Puxa!, Empurra!, Gira!, Levanta!, Aperta!, Postura!, Base!, Trava!, Sai!. Grades and calls: Perfeito!, Boa!, Errou!, Tarde!, Defendeu!, Escapou!, Que ritmo!, Agora você., Combate! and the point calls already baked. All listed in `content/tts/extra-lines.json` and baked with `pnpm tts` (the clips are short so they keep up with a 1.2 s cadence). `speak()` cancels the previous clip, which is what a fast chain wants.

### H. HUD and layout
- Top: the existing scoreboard prop cells: PONTOS · VANT · TEMPO, names, belt.
- Bottom overlay, under 38% of a phone screen, built once per match, states swapped in place:
  - **pick:** telegraph line, ≤4 cards in one row (phone: two rows of two), Segurar as a text button, the quit ×;
  - **chain:** the command word (huge, PT; EN small under it when English help is on), a timer ring around it (a bar under reduced motion), step dots (● ○ ○), the 6-button pad (phone: two rows of three, ≥ 56 px tall), grade pops (Perfeito! / Boa! / Errou!);
  - **defense:** "Defenda!" + the attack line, the 4-button pad in one row, the ring;
  - **resolve:** Bia's call (Dois pontos! / Vantagem! / Defendeu!) and the ground read, ≤ 0.9 s.
- Desktop keys: 1–4 cards, H holds, 1–6 the command pad, 1–4 the defense pad, Enter starts, Esc arms quit. Buttons have aria-labels; the word is always on screen, never audio-only.
- Grip chips (Gola / Manga with their pips), the brace shield and the control meter stay from v2, in a single thin row.
- `reducedMotion()`: no ring sweep, no shake, no slow-motion; frames still change.

### I. Server, protocol, anti-cheat
- `BOUT_PROTOCOL_VERSION` → 2. Client actions: `open`, `start`, `pick {seq, move}`, `tap {seq, step, cmd, ms}`, `defend {seq, cmd, ms}`, `quit`. (`intent` and `answer` are gone.)
- Server phases: `lobby`, `intro`, `pick`, `chain`, `defend`, `resolve`, `drill`, `end`.
- `chain` carries the whole sequence (`cmds[]`, `windowMs[]`, the move, the clip to drive) so the client runs the rhythm locally. The server validates each tap: the step order, the command, and `ms` against its own clock (issue time + the windows so far + 450 ms of network grace, `TB_TEST_ROLL` relaxes nothing: the e2e taps the commands it is sent). A late or wrong tap, or the server deadline passing with no tap, resolves the chain as a miss at that step. The same for `defend`.
- The AI's expected value no longer reads a percent table. `landChance(move, side)` is: for the partner, its clean chance × (1 − the player's observed block rate this match, starting at 0.5); for the player's replies, the player's observed chain success rate this match (starting at 0.7). Both are tracked in the bout session.
- The drill: `chain` with `drill: true` (no windows), then the existing `completeDrill`.
- The simulation (`matSim.test.ts`) models a player by `tapAccuracy` and `reactionShare` and reports win rates per partner for weak (0.6), average (0.8) and strong (0.95) players. Targets (round 2): Mateus weak 25–35%, average 45–60%, strong over 75%; Felipe average 45–60%; Helena and Daniel average 40–55%; Rafael (blue belt) average 25–40%, strong under 70%, weak at least 10%; a finish in over 10% of average-vs-Mateus matches.

  The tuned result (300 matches per cell, white belt unless noted):

  | partner | weak 0.6 | average 0.8 | strong 0.95 |
  | --- | --- | --- | --- |
  | Mateus | 10% | 59% (finish 11%) | 96% |
  | Felipe | 7% | 48% | 92% |
  | Helena | 6% | 51% | 96% |
  | Daniel | 4% | 45% | 92% |
  | Rafael (blue) | 0% | 27% | 76% |

  Every average target and Mateus-strong are met. Three are out of reach with the defense-window knobs: the weak player against Mateus (10%, target 25–35%) and against Rafael (0%, target ≥ 10%), because a 0.6 player misses 40% of its taps whatever the window and with Virar it has to win each position again (wider windows lift it to 23–37% only with the average player at 79–88%); and the strong player against Rafael (76%, target < 70%), because the speed term that would pull Rafael down sinks Felipe below 40% first.

### J. Removed
- The percent table, `matOdds` parts, `movePercent`, the "waiting for a grip" row, the carousel of five cards, `MAT_THINK_MS`, the v1 quiz phases (`challenge`, `finish_end`) and the client code that drew them, the momentum simulation in `bout.ts` that nothing calls (keep the referee lines, crowd cues, clock format and event types that the stage still uses).

## Testing
- Shared: chains per move, windows per level, grading, the land / miss rules, grips and braces, Ritmo, feints, the AI with observed rates; all deterministic with seeded RNG.
- Server: a full match driven by taps (right, late, wrong), the deadline auto-miss, the defense with and without a brace, the partner's own botch, the submission escape mash, the drill, rewards unchanged, protocol v1 rejected.
- Client: `boutLogic.test.ts` for the cues and the pad state; `academia-lock.test.ts` stays green (the bundle must still contain no position names).
- e2e: `scripts/lib/bout-play.mjs` taps the commands the `chain` / `defend` messages carry (`window.__tb.bout` exposes the live beat under `?rolltest`); `scripts/e2e.mjs` plays one full match; `scripts/jiu-jitsu-shots.mjs` shoots the pick, a chain mid-way, a Perfeito, a defense, a Defendeu, a throw landing, the finish and the end card, desktop and phone.
