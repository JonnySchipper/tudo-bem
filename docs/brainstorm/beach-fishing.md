# Beach fishing (Pesca na Praia)

> **NOT NEEDED UNTIL LATE DECEMBER 2026.** This is a future feature and isn't part of the current beta. Don't schedule it before then.

**Status:** Future feature spec from Jonny, written 8 Oct 2026 by TB Brainstorm. Not built.
**Owner:** CEO Tudo Bem. CEO Tudo Bem can assign **Grok Build or Composer 2.5** when it's time.
**Depends on:** the Praia room, which shows as "Em breve" today (GDD v2 §3 and §8.5). This spec replaces v1's "Praia pesca: Fisgou!" vision.
**Must follow:** [events-requirements.md](events-requirements.md) (exclusive words).

## The idea

A fishing game where you progress by **renting better boats**. Each boat takes you farther out, to new fish and bigger catches. The top tier is the **party boat**, a social trip you share with friends.

## Boat progression

| Tier | How you fish | What you can catch | Feel |
| --- | --- | --- | --- |
| 1. **Da praia** (from the beach) | Cast from the sand | Basic, "lame" fish only | Free, simple, a bit funny |
| 2. **Barquinho a remo** (rowboat rental) | Row out a little | Adds one new fish type | First upgrade |
| 3. **Barco de pesca** (fishing boat rental) | A proper fishing boat | Adds one new fish type | Real fishing |
| 4. **Barco de alto-mar** (deep-sea boat rental) | Out on the open ocean | **Every fish**, plus the biggest catches | The cool experience |
| 5. **Barco de festa** (party boat rental) | Invite friends aboard | Unique items you can't get anywhere else | The exclusive social experience |

- Boats are rented with **RV only**, which is earned in-game. There's never real money.
- The rental price goes up with each tier. Product sets the numbers so that deep sea and the party boat feel like goals worth saving for.

## Party boat (tier 5)

- **Invite friends** to come aboard together.
- **Unique items** that can't be found anywhere else in the game.
- **Friends learn words together**, with shared moments on deck that count for everyone aboard.
- **Captain hat reward:** a special *chapéu de capitão* that only comes from the party boat. It's a wearable status item, never sold.
- It stays family-room safe: a "festa" means music, food, and friends. No alcohol.

## Fish

| Fish | Water | Note |
| --- | --- | --- |
| **Tilápia** | Freshwater | Common |
| **Tambaqui** | Freshwater | A big Amazon fish |
| **Tucunaré** | Freshwater | **The trophy catch** |
| **Robalo** (snook) | Coastal | Near the shore and the mangroves |
| **Garoupa** (grouper) | Coastal | Lives around rocks and reefs |

**Design note:** tilápia, tambaqui, and tucunaré are freshwater fish, so in real life they wouldn't come from the beach or the open ocean. There are two ways to fix this:
- **(a)** Add a freshwater spot, like a *lagoa* or *represa* (a lake or reservoir) next to the Praia. Tucunaré becomes the trophy fish there.
- **(b)** Keep a cartoon rule and let them show up anyway.

Option (a) is more authentic, and authentic Brazil is one of the game's pillars. Here's a suggested tier map (**to confirm with Product and TB Curriculum**):
- **Beach:** a basic fish such as *bagre* (sea catfish), the classic disappointing catch.
- **Rowboat:** robalo.
- **Fishing boat:** garoupa.
- **Deep sea:** everything, plus suggested big catches like *dourado-do-mar* (mahi-mahi) or *atum* (tuna). These two fish are my own suggestion, not part of Jonny's list.
- **Freshwater spot:** tilápia, then tambaqui, then tucunaré.

## Diário fish cards

- Every species you catch gets a **card in the Diário** with its **name** and **where it's found** (the beach, the rowboat, and so on).
- The fish cards could be their own Diário area ("Praia"), the same way the 8 existing areas work.
- Your record catch (the biggest size) could show on the card. That's optional.

## Exclusive words (required)

Per [events-requirements.md](events-requirements.md):
- **Each boat tier has its own theme words** that can only be earned while fishing on that tier. Examples: *anzol, isca, vara* from the beach; *remo, remar* on the rowboat; *rede, convés* on the fishing boat; *alto-mar, onda, profundo* on the deep-sea boat.
- **The party boat has exclusive words** that can only be earned aboard with friends.
- The words go into the Diário and count toward the **words-learned ranking**.
- All words are `needs_br` and go through TB Curriculum.

## Guardrails

- The beta stays fully free, with **no real-money gates**. Boats are rented with earned RV only.
- **Chat is never rewritten.**
- **Belts, nameplates, and stripes are untouched.** The captain hat is a separate wearable.
- Family-room safe: no alcohol on the party boat.

## Fishing vs the fishing tournament

Fishing is **always available** at the beach, the lake, and on the boats. The **fishing tournament** (*torneio de pesca*) is a separate **rotating special event**, with its own day-specific leaderboard, special prizes for the winners, and exclusive words. See the off-season event roster in [events-requirements.md](events-requirements.md).

## Open questions

1. Is the freshwater spot option (a) or the cartoon rule option (b)?
2. Is a rental per trip, or by time (say, one game day)?
3. Party boat: what's the maximum number of friends? Does the host pay, or does everyone chip in?
4. Should the fishing itself be timing-based (reel tension, a "Fisgou!" moment) so it matches the skill-based feel of the Feira carts?
