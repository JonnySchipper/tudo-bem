# Decisions: logic track 2 (recados, bag, bonds)

Scope: HOWTO Phase 8 steps 1, 2 and 4, plus the data model. Server engine only. No client, no schedules (step 6), no NPC memory (step 5), no tutorial re-skin (step 3), no final 15 recados (step 7).

## Where things live

| Piece | File |
|---|---|
| Types, `ITEMS`, bag helpers, step logic (`stepMatches`, `advance`), daily offer (`offerFor`, `rollRecadoDay`), the 4 starter recados, wire views | `packages/shared/src/recados.ts` |
| Bond points, `hearts`, gains, milestones (data only) | `packages/shared/src/bonds.ts` |
| `HOTSPOTS` (empty, typed), range and distance helpers | `packages/shared/src/hotspots.ts` |
| `RecadoTracker` (`onEvent`, `give`, `read`, `request`, `onConversaEnd`) | `apps/server/src/recados.ts` |
| Profile defaults on load | `normalizeProfile` in `apps/server/src/store.ts` |

## Decisions

1. **Item ids reuse the padaria shelf ids** from `meveum.ts` (`pao`, `pao_de_queijo`, `cafe_com_leite`, and the rest of the shelf). There is no `pao_frances`: bread is `pao`. `ITEMS` is the whole shelf (names come from the cards, no invented PT) plus `jornal`, `flores`, `banana`, which have no cards yet (see "Proposed cards").
2. **`give` sends no quantity.** The server hands over exactly what the active `entregar` step asks for (its `qty`). If no active step wants that item for that NPC, nothing is taken (an info notice says so), so a player never loses an item by mistake.
3. **"Adjacent" for `give` = Chebyshev distance <= 1 to the NPC's tile OR to the NPC's `interact` tile.** NPC tiles are blocked and the interact tile is 1-2 tiles away (Seu Carlos at (3,1), counter spot (3,3)), so a strict "<= 1 tile from the NPC" would make Carlos and Nanda impossible to reach. The NPC must be in the player's current room.
4. **`read`**: distance <= 3 (Chebyshev to the nearest tile of the hotspot's footprint), same room, and the id must be in `HOTSPOTS`. Unknown ids get `error: hotspot`; far ones `error: far`. The list is empty today, so every `read` is refused until hotspots are authored.
5. **Bag** is capped at 20 per item (`BAG_MAX_PER_ITEM`). Items enter the bag when an order succeeds: a finished Carlos scene (food and drink from the scene context, `nada` dropped), a correct Me vê um order (its lines), a Conversa order (see 9), or a recado's `reward.itemId`. They leave only through `give`.
6. **`recados.done` means "finished today"** and is cleared at game midnight, so recados come back the next game day (repeatable, and RV is paid on each completion). `active` recados carry over across days. The offer is rolled once per game day from the bond the player has at that moment; a bond that rises mid-day unlocks new recados the next game day. The RNG is seeded from (profile id, game day), so the offer is stable across reconnects.
7. **Extra state fields** (allowed by the task): `recados.talked` (NPCs that already gave the daily talk bond today) and `recados.graded` (NPCs that already gave the good-Conversa bond today). Both reset with the day. A never-rolled profile has `day: -1`.
8. **Max 3 active recados** (`RECADO_MAX_ACTIVE`), matching the "max 3 lines" tracker in the HOWTO. `accept` needs the id to be in today's `offered`.
9. **Conversa runs over HTTP** (`/api/conversa`), not the WebSocket, so the hook is a new optional `onConversaEnd` dep in `conversaApi.ts` (wired in `app.ts` to `World.conversaEnded`). It counts as a talk (+2, once per game day), and a `pass` grade earns +3 (once per NPC per game day). Today the turn responses always carry `order: {}`, so no order items are passed; `onConversaEnd` and `World.conversaEnded` already accept an optional `ConversaOrder` for when the order is tracked.
10. **Talk events exist only for Seu Carlos** (scene start). Nanda and Júlia have no talk interaction yet, so a `falar` step for them cannot complete until the Phase 7 dialogue box adds one (the tracker's `onEvent({ kind: 'talked', npc })` is ready). The starter recados avoid `falar` for that reason, and avoid `ler` (no hotspots yet), so none is a dead end.
11. **Greetings**: `greetingKind(text)` reads bom dia / boa tarde / boa noite / oi / olá (accent- and case-insensitive; the time greetings win). `timeCorrect` requires the greeting to equal `greetingFor(minute)`; plain `oi` never satisfies a `timeCorrect` step. The hook sits next to the daily mission's Cumprimenta check and does not change it. The event carries `company` (someone else was in the room), and a greeting to an empty room does not count unless an NPC is within 3 tiles (the tracker fills `npc` with the nearest NPC within 3 tiles).
12. **Rewards** go through the existing `World.reward` (coins, `reward` message, profile push). Bond is added to the giver. A `notice` (level `reward`) carries the giver's `thanks` line prefixed with the NPC's name. Each step also sends a `✓ <step>` info notice, like the mission does.
13. **Milestones are data only** (`BOND_MILESTONES`, `milestonesCrossed`). No effect and no notice is wired.
14. **Old saves**: `normalizeProfile` runs when the store indexes a profile (load and `add`) and defaults `bag`, `bond`, `recados`, dropping unknown keys and bad values without throwing. Solo mode uses the same store.
15. **Untouched**: `MISSION_*`, the daily mission, tutorial flags and their tests. Recados run alongside them. Making the mission the first recado of the day is not done here (HOWTO step 2 says to keep its copy and RV rule; that is a UI/board concern for a later track).

## Protocol additions

Client to server:
- `{ t: 'give'; npc: NpcId; itemId: string }`
- `{ t: 'read'; hotspotId: string }`
- `{ t: 'recados'; action: 'accept' | 'list'; id?: string }`

Server to client:
- `{ t: 'recados'; day: number; offered: RecadoOfferView[]; active: RecadoActiveView[]; done: string[] }`, sent on `list`, on every join, and after any change. `offered` excludes recados already active or done today. `RecadoActiveView.hint` is the one-line instruction for the current step.
- The bag and bond arrive on the existing `profile` push (`PrivateProfile.bag`, `.bond`, `.recados`). Rewards reuse `reward` and `notice`. Errors reuse `error` (codes `give`, `far`, `bag`, `hotspot`, `recado`).

## Proposed cards (no card exists; not added)

`jornal` (newspaper), `flores` (flowers), `banana`. Also `mochila` (bag) if the client labels the inventory in PT.

## Needs BR review

Listed in the task report; every string is marked `needs_br` in code comments. Includes the four starter recados, the step lines in `describeStep`, the milestone labels, and the error and notice copy in `apps/server/src/recados.ts`.
