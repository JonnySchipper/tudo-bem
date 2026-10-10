# Event design requirements

**Status:** A standing design rule from Jonny, written 8 Oct 2026 by TB Brainstorm. It applies to every future event brief.
**Owner:** CEO Tudo Bem (with TB Live Ops for the events calendar and TB Curriculum for the word lists).

## Rule 1: every event teaches exclusive words

Every **event, seasonal decoration, holiday, cart game, or limited-time activity** must come with **new Portuguese words that players can only learn by taking part**.

- **The words fit the theme.** For example, Réveillon (New Year's Eve) brings words like *réveillon*, *fogos*, *contagem regressiva*, *pular sete ondas*, *lentilha*, and *roupa branca*.
- **They're only available during the event's window.** New Year's Eve words can be earned only on those two days. Once the window closes, nobody else can earn them until the event comes back.
- **Players earn them by taking part,** not just by being there: playing the cart game, talking to the event NPC, photographing the decoration, finishing the activity.
- **They count toward the "Most words learned" ranking.** That ties events to the dual leaderboards brief, and it's what creates Animal Crossing-style FOMO.
- **Once earned, a word stays.** It's filed in the Diário and keeps coming back in Escola review after the event ends. Only the chance to *earn* it is limited.

## Rule 2: fun first, learning second

Events have to be **fun, memorable, and addicting first**. The learning happens naturally through the words that come with them. An event should never feel like a vocab quiz in costume.

## Checklist for every event brief

- [ ] Theme and the event window (dates in America/New_York, or game-time hours)
- [ ] The list of exclusive words, sent to TB Curriculum and marked `needs_br` in `BR-REVIEW.md`
- [ ] How each word is earned by taking part
- [ ] Words count toward the words-learned ranking
- [ ] Earned words stay in the Diário and Escola review afterward
- [ ] Fun-first hook: what makes it memorable and worth screenshotting
- [ ] Guardrails: the beta is fully free with no real-money gates, chat is never rewritten, belts, nameplates and stripes are untouched, and it's family-room safe (no alcohol)

## Applies to the Feira carts

Each cart game in [feira-carts.md](feira-carts.md) needs its own set of exclusive words that can only be earned on the days that cart is out. That's on top of the everyday food words in each spec.

## Mascot photo souvenirs

**Revised 8 Oct 2026:** there are **no scheduled mascot photo events**. Instead there's **one feature that works the same for every mascot**. The only timing involved is each mascot being out for its own holiday.

### How it works

1. **Mascots live in the game world** like any other NPC, **but only around their own holiday**, not all year. *(Decided 8 Oct 2026.)*
2. **Whenever a player sees a mascot, they can click it** and pick **"Tirar uma foto"** (take a photo).
3. **Add friends (optional):** the player can add other **online players, friends only**, to the photo, up to **six players max per photo**, including the player who started it. **There's no cooldown.** *(Both decided 8 Oct 2026.)*
4. **Friends get a prompt to accept.** Only people who accept are in the shot.
5. **Shared photo screen:** once everyone has accepted, it switches to a shared screen showing everyone together with the mascot.
6. **Each person chooses whether to buy a copy.** Everyone in the photo can decide for themselves. *(Decided 8 Oct 2026.)*
7. **Each person who wants a copy pays the R$ price from their own virtual balance** (RV, the earned in-game currency). **The organizer doesn't pay for everyone.** No real money is ever involved. *(Decided 8 Oct 2026.)*
8. **Premium price:** a photo should feel special, so it isn't cheap. It's a good price that makes it a treat worth saving for. Product sets the number. For scale, from GDD v2: the kimono costs 18 RV, a perfect full-menu Correria shift pays 32 RV, and founding a padaria costs 900 RV. *(Premium pricing decided 8 Oct 2026.)*

### The photo itself

- It shows each player's **actual avatar** in **whatever they were wearing**.
- Clicking it **enlarges** the photo.
- It can be **placed in the player's kitnet** (or room) as a decoration, like the Christmas photo with Papai Noel.

### Mascots

| Holiday | Mascot | Notes |
| --- | --- | --- |
| **Natal** (Christmas) | **Papai Noel** | The reference for this feature. |
| **Páscoa** (Easter) | **Coelhinho da Páscoa** | Brazil's Easter Bunny, who brings chocolate eggs. |
| **Carnaval** | **Rei Momo** | The jolly "king" of Carnaval who gets the keys to the city. |
| **Dia do Saci** (31 October) | **Saci** | The one-legged folklore trickster in a red cap. Brazil's homegrown Halloween. |
| **Festa Junina** | **Caipira noivos** (bride and groom) and **Bumba meu boi** (the costumed festival bull) | Both can be photographed. |
| **Dia das Crianças** (12 October) | **None traditional** | Needs an **original character** before it can join. |

### Exclusive words

Rule 1 still applies. Each mascot has **theme words that can only be earned by taking a photo with that mascot, and only while that mascot is out for its holiday**. For example: *Papai Noel, árvore, presente*; *coelhinho, ovo de chocolate*; *Rei Momo, folia, chave da cidade*; *Saci, perna, gorro*; *noivo, noiva, caipira, fogueira, bumba meu boi*. They go into the Diário and count toward the words-learned ranking. All words are `needs_br`. *(Holiday-window exclusivity decided 8 Oct 2026.)*

## Rotating off-season event roster

These events rotate during stretches with no holiday or seasonal event. Every one of them follows Rule 1 (exclusive words) and Rule 2 (fun first). Sunrise yoga was removed from the roster on 8 Oct 2026.

1. **Food truck.** A visiting food truck parks in the Vila for a limited time, with its own menu and themed words.
2. **Visiting musician.** A musician comes to town and plays. Players can get the musician's **CD** and play it on a **CD player in their kitnet**. The music words, and the CD itself, are only available while the musician is in town.
3. **Rare vendor.** Shows up **one day a week** and sells **exclusive items** you can't buy anywhere else. Their words can only be earned that day.
4. **Fishing tournament** (*torneio de pesca*). A special rotating event. See the fishing note below.
5. **Pipa festival** (*festival de pipa*, a kite festival). For one day, kites fly over the **Praça**. Players can **buy a kite** with R$ (earned RV only) or **build their own**. It has exclusive theme words (for example *pipa, linha, rabiola, vento, carretel*), earned only during the festival. Family-safe: no *cerol* (the glass-coated kite line that's banned in real life) and no kite fights that cut lines.
6. **Night market** (*feira noturna*). **This isn't every night.** It's a **rotating event that happens now and then, roughly once every week or two.** On those nights the **Feira reopens after dark** with a **different set of carts you won't see in daylight**, for example a **moonlight fruit stand** or a **stargazing telescope vendor**. It gives the Feira a second life and rewards night owls. **Announcement:** when a night market is coming, it shows on the **in-game announcements board** (the intro screen players see when they sign in), so they see it when they log on and get excited to come that day. That board is a planned feature and isn't in GDD v2 yet. It has exclusive theme words (for example *lua, estrela, luneta, noite, constelação*), earned only at the night market. *(Note: because it's only occasional, it doesn't solve the everyday after-hours question in [feira-carts.md](feira-carts.md).)*

### Fishing vs the fishing tournament

- **Fishing itself is always available**: at the beach, at the lake, and on the rental boats (see [beach-fishing.md](beach-fishing.md)). It's a regular activity, not an event.
- **The fishing tournament is a separate special event** that only runs on rotation. It has its **own leaderboard for that day**, separate from the main boards, and **special prizes for the winners**. It also has its own exclusive tournament words under Rule 1.

## Future: beach fishing (target late December 2026)

[beach-fishing.md](beach-fishing.md) is a fishing game where you progress by renting boats, from the beach all the way to the party boat. **It isn't needed until late December 2026.** Each boat tier and the party boat have their own exclusive words under this rule.

## Seasonal calendar

The full-year calendar and shared systems (decoration tiers, shop badges, the announcements board, the rotating roster, mascot photos) are in [seasons/03-shared-systems.md](seasons/03-shared-systems.md), with the month-by-month plan in [seasons/01-january-june.md](seasons/01-january-june.md) and [seasons/02-july-december.md](seasons/02-july-december.md).

## Open questions

1. **Recurring events:** when Réveillon comes back next year, do the same words come back, or a new set? The Diário could show a set as "missed, returns in December" to drive FOMO without permanently locking anyone out.
2. **Ranking fairness:** should the words-learned board show event words separately, so a player who missed one event isn't buried for good?
