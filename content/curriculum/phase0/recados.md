> **Status:** DRAFT — needs BR sign-off before default-path. Every recado below is `needs_br: true`.

# Recados — the first 15 errands (HOWTO Phase 8, step 7)

Small errands the NPCs hand out on the daily board (3 a day, from givers the player has befriended enough). One clear task each, A1 level, informal São Paulo Portuguese (você, tá, pra, a gente). The EN is natural, not a gloss.

Source of truth: this file. `pnpm content` (`scripts/build-curriculum.mjs`) turns it into `recados.json`; `packages/shared/src/curriculum.test.ts` fails if the JSON drifts. The build fails loudly on an unknown NPC, item, room, card, step kind or flag.

## Fields

| Field | Meaning |
|---|---|
| `giver` | NpcId: `carlos`, `nanda`, `julia`, `graca`, `tia_lu` |
| `min_bond` | friendship points (0–100, 10 = 1 heart) with the **giver** before it is offered |
| `requires` | optional feature flag (`feira` or `dialogue`); the offer logic skips the recado until `RECADO_FLAGS[flag]` is on. Omitted = playable now |
| `title_*`, `ask_*`, `thanks_*` | what the giver shows / says when giving the errand / says when it is done |
| `steps` | `;`-separated, in order. `falar <npc>` · `pedir <npc> <item> [qty]` · `entregar <npc> <item> [qty]` · `ir <room>` · `cumprimentar [<npc>] [timeCorrect]` |
| `reward` | `<n> RV; <n> bond` and optionally `; item <itemId>` |
| `cards` | existing curriculum card ids this recado practices (`;`-separated). No new cards here |

Authoring rules that keep every recado finishable today:

- `pedir` items are limited to what the Carlos scene / Conversa can put in the bag: `pao_na_chapa`, `coxinha`, `pastel`, `cafe`, `cafe_com_leite`, `suco_de_laranja`, `agua` (plus `banana` and `flores` at the feira). One scene orders one food and one drink, so two `pedir` steps never sit next to each other.
- The recados of Dona Graça and Tia Lu never send you to talk to or hand something to someone who is not in the world yet. Graça has no room until the NPC schedules exist and Tia Lu has none until the feira (Phase 9).
- `falar` for anyone but Seu Carlos needs the Phase 7 dialogue box: those recados say `requires: dialogue`. The two feira recados say `requires: feira`.

---

## Bond 0 (6)

### carlos_cafe_pra_nanda
- **giver:** carlos
- **min_bond:** 0
- **title_pt:** Café pra Nanda
- **title_en:** Coffee for Nanda
- **ask_pt:** Oi! A Nanda ainda não tomou café. Leva um café com leite pra ela?
- **ask_en:** Hi! Nanda hasn’t had her coffee yet. Can you take her a café com leite?
- **thanks_pt:** Que bom! Ela vai adorar. Valeu!
- **thanks_en:** Great! She’s going to love it. Thanks!
- **steps:** pedir carlos cafe_com_leite 1; entregar nanda cafe_com_leite 1
- **reward:** 10 RV; 4 bond
- **cards:** lex.padaria.cafe_com_leite; lex.padaria.me_ve; lex.padaria.por_favor
- **needs_br:** true

### nanda_coxinha
- **giver:** nanda
- **min_bond:** 0
- **title_pt:** Coxinha da padaria
- **title_en:** Coxinha from the bakery
- **ask_pt:** Tô com fome! Você pede uma coxinha pra mim na padaria?
- **ask_en:** I’m hungry! Can you get me a coxinha at the bakery?
- **thanks_pt:** Hum, quentinha! Obrigada, viu?
- **thanks_en:** Mmm, still warm! Thank you!
- **steps:** pedir carlos coxinha 1; entregar nanda coxinha 1
- **reward:** 12 RV; 4 bond
- **cards:** lex.padaria.coxinha; lex.padaria.me_ve; lex.padaria.quentinho
- **needs_br:** true

### julia_cumprimento_certo
- **giver:** julia
- **min_bond:** 0
- **title_pt:** O cumprimento certo
- **title_en:** The right greeting
- **ask_pt:** Oi! Cumprimenta alguém do jeito certo pra hora do dia. Depois passa na padaria, tá?
- **ask_en:** Hi! Greet someone the right way for the time of day. Then stop by the bakery, okay?
- **thanks_pt:** Muito bem! Você tá pegando o jeito!
- **thanks_en:** Well done! You’re getting the hang of it!
- **steps:** cumprimentar timeCorrect; ir padaria
- **reward:** 10 RV; 4 bond
- **cards:** lex.social.bom_dia; lex.social.boa_tarde; lex.social.boa_noite
- **needs_br:** true

### graca_pao_pra_julia
- **giver:** graca
- **min_bond:** 0
- **title_pt:** Pão na chapa pra Júlia
- **title_en:** Pão na chapa for Júlia
- **ask_pt:** Oi! Aqui é a Graça, do turno da noite. A Júlia vive esquecendo o café da manhã. Leva um pão na chapa pra ela?
- **ask_en:** Hi! It’s Graça, from the night shift. Júlia is always forgetting breakfast. Can you take her a pão na chapa?
- **thanks_pt:** Pão na chapa é o melhor despertador! Valeu!
- **thanks_en:** Pão na chapa is the best alarm clock! Thanks!
- **steps:** pedir carlos pao_na_chapa 1; entregar julia pao_na_chapa 1
- **reward:** 9 RV; 3 bond
- **cards:** lex.padaria.pao_na_chapa; lex.padaria.me_ve; lex.padaria.por_favor
- **needs_br:** true

### nanda_um_oi_pro_carlos
- **giver:** nanda
- **min_bond:** 0
- **title_pt:** Um oi pro Seu Carlos
- **title_en:** A hello for Seu Carlos
- **ask_pt:** Você passa na padaria e dá um oi pro Seu Carlos por mim? Ele gosta.
- **ask_en:** Can you stop by the bakery and say hi to Seu Carlos for me? He likes that.
- **thanks_pt:** Que legal! Você é gente boa. Valeu!
- **thanks_en:** How nice! You’re good people. Thanks!
- **steps:** cumprimentar carlos
- **reward:** 8 RV; 3 bond
- **cards:** lex.social.oi; lex.social.tudo_bem; lex.social.beleza
- **needs_br:** true

### tia_lu_banana_pra_nanda
- **giver:** tia_lu
- **min_bond:** 0
- **requires:** feira
- **title_pt:** Banana pra Nanda
- **title_en:** Banana for Nanda
- **ask_pt:** Olha a banana! Tá fresquinha! A Nanda adora. Leva uma banana pra ela?
- **ask_en:** Get your bananas! Nice and fresh! Nanda loves them. Can you take her a banana?
- **thanks_pt:** Isso aí! Ela vai amar. Valeu, volta sempre!
- **thanks_en:** That’s it! She’s going to love it. Thanks, come back anytime!
- **steps:** pedir tia_lu banana 1; entregar nanda banana 1
- **reward:** 10 RV; 4 bond
- **cards:** lex.padaria.por_favor; lex.social.obrigado
- **needs_br:** true

---

## Bond 10 (5)

### carlos_agua_pra_julia
- **giver:** carlos
- **min_bond:** 10
- **title_pt:** Água pra Júlia
- **title_en:** Water for Júlia
- **ask_pt:** A Júlia passa o dia na praça, coitada. Leva uma água pra ela?
- **ask_en:** Júlia spends all day in the square, poor thing. Can you take her a water?
- **thanks_pt:** Isso aí! Por conta da casa, um pão de queijo.
- **thanks_en:** That’s it! On the house, a pão de queijo.
- **steps:** pedir carlos agua 1; entregar julia agua 1
- **reward:** 12 RV; 5 bond; item pao_de_queijo
- **cards:** lex.padaria.agua; lex.padaria.me_ve; lex.padaria.por_conta_da_casa
- **needs_br:** true

### julia_pastel_pra_nanda
- **giver:** julia
- **min_bond:** 10
- **title_pt:** Pastel pra Nanda
- **title_en:** Pastel for Nanda
- **ask_pt:** A Nanda tá com fome e não sai da barraca. Leva um pastel pra ela?
- **ask_en:** Nanda is hungry and never leaves her stall. Can you take her a pastel?
- **thanks_pt:** Hum, pastel quentinho! Ela vai adorar. Valeu!
- **thanks_en:** Mmm, a warm pastel! She’s going to love it. Thanks!
- **steps:** pedir carlos pastel 1; entregar nanda pastel 1
- **reward:** 12 RV; 4 bond
- **cards:** lex.padaria.pastel; lex.padaria.me_ve; lex.padaria.quentinho
- **needs_br:** true

### graca_agua_pra_academia
- **giver:** graca
- **min_bond:** 10
- **title_pt:** Água pra academia
- **title_en:** Water for the gym
- **ask_pt:** Ei! Você vai na academia? Leva uma água! Quem treina tem que beber água.
- **ask_en:** Hey! Are you going to the gym? Take a water! People who work out need to drink water.
- **thanks_pt:** Isso aí! Água é vida. Valeu!
- **thanks_en:** That’s it! Water is life. Thanks!
- **steps:** pedir carlos agua 1; ir academia
- **reward:** 11 RV; 4 bond
- **cards:** lex.padaria.agua; lex.padaria.me_ve; lex.padaria.por_favor
- **needs_br:** true

### julia_conhecer_nanda
- **giver:** julia
- **min_bond:** 10
- **requires:** dialogue
- **title_pt:** Conheça a Nanda
- **title_en:** Meet Nanda
- **ask_pt:** Você já conhece a Nanda? Ela tem a loja de chapéus. Vai lá e fala com ela!
- **ask_en:** Have you met Nanda yet? She has the hat stall. Go and talk to her!
- **thanks_pt:** Que bom! A Nanda é super simpática, né?
- **thanks_en:** Great! Nanda is super nice, isn’t she?
- **steps:** falar nanda
- **reward:** 9 RV; 3 bond
- **cards:** lex.social.oi; lex.social.tudo_bem; lex.social.beleza
- **needs_br:** true

### tia_lu_flores_pra_julia
- **giver:** tia_lu
- **min_bond:** 10
- **requires:** feira
- **title_pt:** Flores pra Júlia
- **title_en:** Flowers for Júlia
- **ask_pt:** A Júlia adora flores! Leva umas pra ela, vai?
- **ask_en:** Júlia loves flowers! Why don’t you take her some?
- **thanks_pt:** Que lindas! Ela vai ficar toda feliz. Valeu!
- **thanks_en:** How pretty! She’s going to be so happy. Thanks!
- **steps:** pedir tia_lu flores 1; entregar julia flores 1
- **reward:** 15 RV; 6 bond
- **cards:** lex.padaria.por_favor; lex.social.obrigado
- **needs_br:** true

---

## Bond 20–30 (4)

### carlos_manha_de_entregas
- **giver:** carlos
- **min_bond:** 20
- **title_pt:** Manhã de entregas
- **title_en:** Morning deliveries
- **ask_pt:** Hoje tá cheio! Pede um pão na chapa pra Júlia e um café com leite pra Nanda. Uma coisa de cada vez, tá?
- **ask_en:** It’s busy today! Order a pão na chapa for Júlia and a café com leite for Nanda. One thing at a time, okay?
- **thanks_pt:** Você me ajudou muito! Por conta da casa, um bolo.
- **thanks_en:** You helped me so much! A cake, on the house.
- **steps:** pedir carlos pao_na_chapa 1; entregar julia pao_na_chapa 1; pedir carlos cafe_com_leite 1; entregar nanda cafe_com_leite 1
- **reward:** 15 RV; 6 bond; item bolo
- **cards:** lex.padaria.pao_na_chapa; lex.padaria.cafe_com_leite; lex.padaria.por_conta_da_casa
- **needs_br:** true

### nanda_pergunta_pro_carlos
- **giver:** nanda
- **min_bond:** 20
- **requires:** dialogue
- **title_pt:** Pergunta pro Seu Carlos
- **title_en:** Ask Seu Carlos
- **ask_pt:** Pergunta pro Seu Carlos o que tem de bom hoje na padaria. Depois volta aqui e me conta, tá?
- **ask_en:** Ask Seu Carlos what’s good at the bakery today. Then come back and tell me, okay?
- **thanks_pt:** Hum, que delícia! Valeu por me contar!
- **thanks_en:** Mmm, sounds delicious! Thanks for telling me!
- **steps:** falar carlos; falar nanda
- **reward:** 10 RV; 4 bond
- **cards:** lex.social.tudo_bem; lex.social.obrigado
- **needs_br:** true

### graca_cumprimenta_julia
- **giver:** graca
- **min_bond:** 30
- **title_pt:** Um cumprimento pra Júlia
- **title_en:** A greeting for Júlia
- **ask_pt:** Ei! Vai na praça e cumprimenta a Júlia do jeito certo pra hora do dia. Depois vem na padaria, tá?
- **ask_en:** Hey! Go to the square and greet Júlia the right way for the time of day. Then come by the bakery, okay?
- **thanks_pt:** Muito bem! Agora você merece um café!
- **thanks_en:** Well done! Now you deserve a coffee!
- **steps:** cumprimentar julia timeCorrect; ir padaria
- **reward:** 10 RV; 4 bond
- **cards:** lex.social.bom_dia; lex.social.boa_tarde; lex.social.boa_noite
- **needs_br:** true

### julia_volta_pela_vizinhanca
- **giver:** julia
- **min_bond:** 30
- **title_pt:** Uma volta pela vizinhança
- **title_en:** A walk around the neighborhood
- **ask_pt:** Dá uma volta! Vai na academia, volta pra praça e me dá um oi. Eu te espero aqui!
- **ask_en:** Go for a walk! Go to the gym, come back to the square and say hi to me. I’ll wait for you here!
- **thanks_pt:** Você voltou! Que bom te ver de novo!
- **thanks_en:** You’re back! So good to see you again!
- **steps:** ir academia; ir praca; cumprimentar julia
- **reward:** 12 RV; 5 bond
- **cards:** lex.social.oi; lex.social.tchau
- **needs_br:** true
