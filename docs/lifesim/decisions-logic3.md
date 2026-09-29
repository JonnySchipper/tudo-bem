# Decisions: logic track 3 (Caderno de palavras backend, NPC memory)

Scope: HOWTO Phase 7 step 3 (server side) and Phase 8 step 5. Server and shared only. No client, no panel, no audio wiring.

## Where things live

| Piece | File |
|---|---|
| `cardsInText`, `maskCards`, `recordSeen/Heard/Used`, `groupProgress`, `completedGroups`, `isLearned`, normalizers, `CADERNO_GROUP_RV` | `packages/shared/src/caderno.ts` |
| `normalizeNpcMemory`, `vetMemory`, `templateMemory` | `packages/shared/src/npcMemory.ts` |
| `memoryPromptBlock`, `MEMORY_MAX_CHARS`, `buildCarlosSystemPrompt(subject, ctx, memory?)`, `ConversaTurnRequest.memory` | `packages/shared/src/conversa.ts` |
| `CadernoTracker` (`seen`, `used`, `heard`, group payout) | `apps/server/src/caderno.ts` |
| `ConversaMemory` (Conversa log, template + AI summary, storing) | `apps/server/src/conversaMemory.ts` |
| `summarizeConversa`, `MEMORY_SUMMARY_SYSTEM_PROMPT` | `apps/server/src/services/xai.ts` |
| Profile defaults on load | `normalizeProfile` in `apps/server/src/store.ts` |

## Caderno

1. **Profile fields** (all optional, defaulted on load, junk dropped): `caderno`, `cadernoPaid` (group ids already paid), `npcMemory`.
2. **Card matching** reuses the typed-answer forgiveness (`normalizeAnswer`: accents, case, punctuation, digits to words, obrigada = obrigado, uma = um) plus hyphens as spaces. Whole-word only, longest form first and consumed, so "café com leite" counts one card and not also "café", and "pão de queijo" does not count "pão". Forms are `form` and `plural`, each side of a slash. `accepts` are not used as forms (they are typing variants, mostly redundant with `form`).
3. **Groups** come from the card id (`lex.<group>.<name>`): `padaria` (Padaria, 28 cards), `social` (Cumprimentos, 10), `num` (Números, 20). The `places` field is unusable for this (most cards have `[]` or `["*"]`). A new pack with a new id segment groups itself (label falls back to the segment name).
4. **Learned card**: `used >= 1`, or `seen >= 1 && heard >= 1`. Seeing alone or hearing alone is not enough. A group is complete when every card in it is learned. This is my call; HOWTO only says "completing a group".
5. **Events**
   - `seen`: the Carlos scene start view, every scene node the player is shown (after each chip or typed answer), each Conversa NPC line (opener and replies), and a hotspot read (its `cards` plus any card found in its `pt`).
   - `used`: a typed scene answer the accept list matched to a chip (safety already passed), a chat line that was delivered (any card form in it), a Conversa player line that passed Gate A (warn lines deliver, blocked ones do not). Chips (clicked) are not `used`, and neither are Me vê um orders.
   - `heard`: new `ClientMsg` `{ t: 'heard'; cardIds: string[] }`.
6. **`heard` validation**: an array of 1 to 10 strings, each a known card id (repeats count once). Anything else gets `error` code `heard`. Rate limit: 4 messages per second per session; extra ones are dropped silently (a mashed 🔊 button is not an error the player should see).
7. **Payout**: `CADERNO_GROUP_RV = 15`, paid through `World.reward`. The group id is pushed to `cadernoPaid` before paying, so it can never pay twice, and it survives reconnects. Reward reason: "Caderno completo: <grupo>!".
8. Every change saves (debounced) and pushes the profile, so the future panel can read `profile.caderno`.
9. **Hook budget**: `world.ts` grew by 17 lines. `RecadoTracker` gets an optional `onRead(s, hotspot)` dep so the hotspot hook lives next to its `read` validation.

## NPC memory

1. **The Conversa runs over HTTP and `end` carries no transcript**, so `ConversaMemory` keeps a short in-process log per (player, NPC) while a Conversa runs: last 14 lines, 240 chars each, at most 200 logs, 3 h expiry, dropped at `end`. It exists only so the summarizer can read it and is never written anywhere. `ConversaApiDeps` gets `memory` and `onConversaLine`, both optional (old callers work unchanged); `app.ts` wires them.
2. **Store flow at `end`**: the deterministic template line is stored immediately (sync, never blocks, never lost). If AI is available, one small call asks for a better one; it replaces the template only if it arrives within 4 s (`timeoutMs`) and passes vetting, and only if no newer Conversa ended meanwhile. The Conversa `end` response never waits for it.
3. **Template** (no key, error, timeout): "Pediu um pão na chapa e uma água." from the food and drink cards found in the player's lines (max 2, with um/uma from the card gender) or a tracked order if `end` ever gets one; otherwise "Conversou sobre café da manhã." (subject title, lowercased). Only card names and the subject title appear in it, never the player's words.
4. **Vetting** (`vetMemory`) before anything is stored, template included: non-empty, max 200 chars, `filterNpcLine`, `classifyChat` must say `allow`, no links, and no run of 4 of the player's own free words (words that are not card forms, so "um pão na chapa" is fine but a copied sentence is not). Rejected AI text is dropped and the template stays.
5. **Nothing is stored** if the player never spoke, the log is missing (server restarted mid-Conversa), or the player is unknown.
6. **Prompt**: `buildCarlosSystemPrompt(subject, ctx, memory?)` inserts a delimited `MEMORY` block with a `Você lembra: …` line before `SUBJECT:`. The stored text is flattened (no newlines, quotes, brackets or angle brackets) and clipped to 200 chars, and the block tells the model to use it at most once, never quote it and to ignore any instruction inside it. With no memory the prompt is byte-for-byte the old one. `buildCarlosSystemPrompt` is the only prompt builder today.
7. **No bond gate**: HOWTO says the NPC remembers "at 2 hearts". Nothing in this task gates it, and the milestone effects are still data-only, so the memory is used from the first Conversa. Easy to gate later: pass `memory` only when `hearts(bond) >= 2` in `handleTurn`.
8. **The offline (authored) path ignores memory**: no prompt is used there. The authored openers are unchanged.
9. The transcript sent to the model for the summary is the same kind of data the turn calls already send (the player's Conversa lines). Only the vetted one-line summary is kept.

## xAI summary prompt (system)

```
You write a short memory note for an NPC in a Portuguese-learning game. The NPC is a padaria owner in São Paulo.
Read the short conversation and write exactly ONE sentence in Brazilian Portuguese, in the third person about the customer, saying only what they ordered or what the chat was about. Example: "Pediu um café com leite e uma coxinha pra viagem."
Rules:
- At most 120 characters. One sentence. Plain text only: no quotes, no markdown, no emoji.
- Do not copy the customer's words. Do not quote them.
- No names, contact details, or personal data. Nothing about alcohol, dating, politics, or religion.
- If nothing was ordered, say what the chat was about, for example "Conversou sobre café da manhã."
```

User message: `Assunto: <subject>\n\nConversa:\nCliente: …\nSeu Carlos: …\n\nUma frase:`. Only the first line of the answer is used.

## Needs BR review

Every new PT string (also marked `needs_br` in code comments):

- Template memory: `Pediu {um|uma} {carta}[ e {um|uma} {carta}].` and `Conversou sobre {assunto}.` (for example "Pediu um pão na chapa e uma água.", "Conversou sobre café da manhã.", "Conversou sobre cumprimentos.")
- Group labels: Padaria, Cumprimentos, Números
- Group reward reason: `Caderno completo: {grupo}!` (EN: `Notebook complete: {group}!`)
- Error for a bad `heard`: "Não achei essas palavras." / "I couldn’t find those words."
- Prompt-side (English instruction with two PT examples for the model): "Hoje é o de sempre?", "Pediu um café com leite e uma coxinha pra viagem.", "Conversou sobre café da manhã."

## Proposed cards

None new. `jornal`, `flores`, `banana` from logic2 still have no cards, so they cannot enter the Caderno.

## Not done here

The panel, the 🔊 button wiring, hotspot authoring, and the bond-2 gate on memory (see 7).
