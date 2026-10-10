# BR review pack: every new Portuguese string of the Vila Ipê conversion

For a native Brazilian Portuguese reviewer (informal São Paulo register, A1 for beginners). Compiled in Phase 10 from the `needs_br` markers in content and code, the "Needs BR review" lists in [DECISIONS.md](./DECISIONS.md), and a diff of the branch against `main`. Nothing here has had a native pass yet.

## How to review

- Every row is one string (or one template) the player can see, hear or read. **PT** is what the game says; **EN** is the gloss shown next to it. Rows with no EN are PT-only (typed variants, AI prompt text, painted signs).
- Check: natural São Paulo speech (você, a gente, tá, pra), A1 length and vocabulary, spelling and accents, politeness (Seu / Dona), and that EN matches the meaning. Reply by row number (for example "17: write *Valeu!* instead").
- Rows generated from data (price lines, quantity chips, money in words, greetings) show one rendered sample; if a pattern is wrong, every instance is wrong.
- **Invented facts** (section J) are statements about the neighborhood that the game made up; confirm or change them.
- Strings that still use `{…}` are filled at run time: `{nome}` the player's name, `{obrigad}` obrigado/obrigada (from the pronoun), `{saudacao}` bom dia / boa tarde / boa noite for the game hour.

## Contents

- [A. Time of day, weekdays and weather](#a-time) (24)
- [B. Neighbors: names, roles and idle lines](#b-npcs) (28)
- [C. Talk trees (Nanda, Júlia, Dona Graça, Professora Bia)](#c-talk) (36)
- [D. Conversa: Dona Graça persona and the "O bairro" subject](#d-conversa) (19)
- [E. Seu Carlos scene and Conversa: time-of-day greetings](#e-scene) (3)
- [F. Recados (errands)](#f-recados) (88)
- [G. Item names that are new (bag, tracker, hand-over)](#g-items) (8)
- [H. Friendship (hearts)](#h-bonds) (3)
- [I. Recados: offers, hand-overs, tracker, journal, hearts (client + server)](#i-recados-ui) (29)
- [J. Readable world: signs and hotspot cards](#j-hotspots) (33)
- [K. Hover labels of places and props (praça first)](#k-labels) (29)
- [L. Feira livre](#l-feira) (93)
- [M. Feira: dialogue, tray and server errors (client + server)](#m-feira-ui) (18)
- [N. Caderno de palavras (client panel)](#n-caderno-ui) (13)
- [O. Dialogue box, hotspot card and dialogue chrome (client)](#o-dialogue-ui) (30)
- [P. NPC memory (server)](#p-memory) (3)
- [Q. Other new Portuguese in the interface and in painted signs](#q-misc) (5)
- [S. Arrival, camera, escola and cartela polish (client)](#s-polish) (4)
- [R. Proposed cards for the Curriculum team](#r-proposed-cards)
- [V. Diário: the sticker album (client)](#v-diario) (39)
- [W. Bate-papos and the #229 wording sweep](#w-papos) (24)
- [X. Praia: the beach, fishing, boats and the party boat](#x-praia) (33)
- [Z. Chat hints](#z-chat-hints) (2)
- [AA. Tatame staging](#aa-tatame-staging) (2)

## A. Time of day, weekdays and weather

<a id="a-time"></a>
| # | PT | EN | Where | Note | OK? |
|---|---|---|---|---|---|
| 1 | Dom · domingo | Sunday | `packages/shared/src/clock.ts (WEEKDAYS)` | standard names; clock pill shows the short form | |
| 2 | Seg · segunda-feira | Monday | `packages/shared/src/clock.ts (WEEKDAYS)` | standard names; clock pill shows the short form | |
| 3 | Ter · terça-feira | Tuesday | `packages/shared/src/clock.ts (WEEKDAYS)` | standard names; clock pill shows the short form | |
| 4 | Qua · quarta-feira | Wednesday | `packages/shared/src/clock.ts (WEEKDAYS)` | standard names; clock pill shows the short form | |
| 5 | Qui · quinta-feira | Thursday | `packages/shared/src/clock.ts (WEEKDAYS)` | standard names; clock pill shows the short form | |
| 6 | Sex · sexta-feira | Friday | `packages/shared/src/clock.ts (WEEKDAYS)` | standard names; clock pill shows the short form | |
| 7 | Sáb · sábado | Saturday | `packages/shared/src/clock.ts (WEEKDAYS)` | standard names; clock pill shows the short form | |
| 8 | Bom dia / Boa tarde / Boa noite | Good morning / Good afternoon / Good evening | `packages/shared/src/clock.ts (greetingFor, localizeGreeting)` | swapped into any line that STARTS with a greeting. bom dia 05:00-11:59, boa tarde 12:00-17:59, boa noite 18:00-04:59: check the hour boundaries feel right | |
| 9 | Sol | Sunny | `packages/shared/src/weather.ts (WEATHER_COPY)` | sol | |
| 10 | Nublado | Cloudy | `packages/shared/src/weather.ts (WEATHER_COPY)` | nublado | |
| 11 | Garoa | Drizzle | `packages/shared/src/weather.ts (WEATHER_COPY)` | garoa | |
| 12 | Chuva | Rain | `packages/shared/src/weather.ts (WEATHER_COPY)` | chuva | |
| 13 | Que dia lindo, hein? | What a beautiful day, huh? | `packages/shared/src/weather.ts (WEATHER_IDLE_LINES)` | NPC small talk when it is sol | |
| 14 | Hoje tá um solzão! | It's really sunny today! | `packages/shared/src/weather.ts (WEATHER_IDLE_LINES)` | NPC small talk when it is sol | |
| 15 | Dia bom pra passear. | Good day for a walk. | `packages/shared/src/weather.ts (WEATHER_IDLE_LINES)` | NPC small talk when it is sol | |
| 16 | Hoje tá nublado. | It's cloudy today. | `packages/shared/src/weather.ts (WEATHER_IDLE_LINES)` | NPC small talk when it is nublado | |
| 17 | Acho que vai chover. | I think it will rain. | `packages/shared/src/weather.ts (WEATHER_IDLE_LINES)` | NPC small talk when it is nublado | |
| 18 | Tá meio cinza hoje, né? | It's a bit grey today, isn't it? | `packages/shared/src/weather.ts (WEATHER_IDLE_LINES)` | NPC small talk when it is nublado | |
| 19 | Que garoa, hein? | What a drizzle, huh? | `packages/shared/src/weather.ts (WEATHER_IDLE_LINES)` | NPC small talk when it is garoa | |
| 20 | Tá garoando de novo. | It's drizzling again. | `packages/shared/src/weather.ts (WEATHER_IDLE_LINES)` | NPC small talk when it is garoa | |
| 21 | São Paulo, a terra da garoa! | São Paulo, the land of drizzle! | `packages/shared/src/weather.ts (WEATHER_IDLE_LINES)` | NPC small talk when it is garoa | |
| 22 | Que chuva forte! | What heavy rain! | `packages/shared/src/weather.ts (WEATHER_IDLE_LINES)` | NPC small talk when it is chuva | |
| 23 | Tô sem guarda-chuva! | I don't have an umbrella! | `packages/shared/src/weather.ts (WEATHER_IDLE_LINES)` | NPC small talk when it is chuva | |
| 24 | Vamos ficar aqui até parar. | Let's stay here until it stops. | `packages/shared/src/weather.ts (WEATHER_IDLE_LINES)` | NPC small talk when it is chuva | |

## B. Neighbors: names, roles and idle lines

<a id="b-npcs"></a>
Idle lines of the three original NPCs (Carlos, Nanda, Júlia) pre-date the conversion and are listed for completeness; Dona Graça, Professora Bia, Tia Lu, Seu Zé, Seu Chico and Dona Rosa are new.

| # | PT | EN | Where | Note | OK? |
|---|---|---|---|---|---|
| 25 | Esse boné verde fica legal! | That green cap looks great! | `packages/shared/src/rooms.ts` | idle line of Nanda | |
| 26 | Hoje tem boné verde de graça! | Free green caps today! | `packages/shared/src/rooms.ts` | idle line of Nanda | |
| 27 | Oi! Precisa de ajuda? Fala comigo! | Hi! Need help? Talk to me! | `packages/shared/src/rooms.ts` | idle line of Júlia | |
| 28 | A padaria do Seu Carlos é ali! | Seu Carlos’s bakery is over there! | `packages/shared/src/rooms.ts` | idle line of Júlia | |
| 29 | Tia Lu · Frutas da feira | Fruit at the feira | `packages/shared/src/rooms.ts` | NEW NPC (tia_lu): name and role | |
| 30 | Olha a banana! Três por cinco! | Get your bananas! Three for five! | `packages/shared/src/rooms.ts` | idle line of Tia Lu (new NPC) | |
| 31 | Laranja doce, freguesa! | Sweet oranges, ma’am! | `packages/shared/src/rooms.ts` | idle line of Tia Lu (new NPC) | |
| 32 | Maçã fresquinha, leva uma! | Fresh apples, take one! | `packages/shared/src/rooms.ts` | idle line of Tia Lu (new NPC) | |
| 33 | Seu Zé · Verduras da feira | Vegetables at the feira | `packages/shared/src/rooms.ts` | NEW NPC (ze): name and role | |
| 34 | Olha o tomate! Bem vermelhinho! | Get your tomatoes! Nice and red! | `packages/shared/src/rooms.ts` | idle line of Seu Zé (new NPC) | |
| 35 | Alface fresca, freguesa! | Fresh lettuce, ma’am! | `packages/shared/src/rooms.ts` | idle line of Seu Zé (new NPC) | |
| 36 | Seu Chico · Pastel e caldo de cana | Pastel and sugarcane juice | `packages/shared/src/rooms.ts` | NEW NPC (chico): name and role | |
| 37 | Pastel quentinho! | Nice hot pastel! | `packages/shared/src/rooms.ts` | idle line of Seu Chico (new NPC) | |
| 38 | Caldo de cana geladinho! | Ice-cold sugarcane juice! | `packages/shared/src/rooms.ts` | idle line of Seu Chico (new NPC) | |
| 39 | Dona Rosa · Flores da feira | Flowers at the feira | `packages/shared/src/rooms.ts` | NEW NPC (rosa): name and role | |
| 40 | Flores, freguesa! | Flowers, ma’am! | `packages/shared/src/rooms.ts` | idle line of Dona Rosa (new NPC) | |
| 41 | Flor bonita pra casa, leva! | Pretty flowers for your home, take some! | `packages/shared/src/rooms.ts` | idle line of Dona Rosa (new NPC) | |
| 42 | Pão quentinho saindo! | Warm bread coming out! | `packages/shared/src/rooms.ts` | idle line of Seu Carlos | |
| 43 | Bom dia! Vai um cafezinho? | Good morning! How about a little coffee? | `packages/shared/src/rooms.ts` | idle line of Seu Carlos | |
| 44 | Chega mais, pode pedir! | Come on over, go ahead and order! | `packages/shared/src/rooms.ts` | idle line of Seu Carlos | |
| 45 | Dona Graça · Padeira do turno da noite | Night-shift baker | `packages/shared/src/rooms.ts` | NEW NPC (graca): name and role | |
| 46 | De noite o pão sai quentinho! | Warm bread at night! | `packages/shared/src/rooms.ts` | idle line of Dona Graça (new NPC) | |
| 47 | Boa noite! Bora de cafezinho? | Good evening! How about a little coffee? | `packages/shared/src/rooms.ts` | idle line of Dona Graça (new NPC) | |
| 48 | Ih, a noite é longa. Chega mais! | Oh, the night is long. Come on over! | `packages/shared/src/rooms.ts` | idle line of Dona Graça (new NPC) | |
| 49 | Professora Bia · Professora de jiu-jitsu | Jiu-jitsu teacher | `packages/shared/src/rooms.ts` | NEW NPC (prof): name and role | |
| 50 | Bora treinar? | Ready to train? | `packages/shared/src/rooms.ts` | idle line of Professora Bia (new NPC) | |
| 51 | Respeito primeiro, depois o tatame. | Respect first, then the mat. | `packages/shared/src/rooms.ts` | idle line of Professora Bia (new NPC) | |
| 52 | Água é vida. Bebe bastante! | Water is life. Drink plenty! | `packages/shared/src/rooms.ts` | idle line of Professora Bia (new NPC) | |

## C. Talk trees (Nanda, Júlia, Dona Graça, Professora Bia)

<a id="c-talk"></a>
`{saudacao}` / `{greeting}` become the greeting for the hour, `{nome}` the player's name (from 2 hearts), `{obrigad}` obrigado/obrigada.

| # | PT | EN | Where | Note | OK? |
|---|---|---|---|---|---|
| 53 | {saudacao}, {nome}! Tudo bem? Eu sou a Nanda. | {greeting}, {nome}! How’s it going? I’m Nanda. | `packages/shared/src/npcTalk.ts` | nanda · oi · NPC line | |
| 54 | {saudacao}, Nanda! Tudo bem! | {greeting}, Nanda! All good! | `packages/shared/src/npcTalk.ts` | nanda · oi · reply chip → chapeus | |
| 55 | Beleza! E você? | Cool! And you? | `packages/shared/src/npcTalk.ts` | nanda · oi · reply chip → chapeus | |
| 56 | Tudo ótimo! Gostou dos chapéus? Tem boné, boina e chapéu de sol. | Great! Do you like the hats? There’s a cap, a beret and a sun hat. | `packages/shared/src/npcTalk.ts` | nanda · chapeus · NPC line | |
| 57 | Gostei! Quero ver. | I like them! I want to see. | `packages/shared/src/npcTalk.ts` | nanda · chapeus · reply chip → shop | |
| 58 | Agora não, {obrigad}. | Not now, thanks. | `packages/shared/src/npcTalk.ts` | nanda · chapeus · reply chip → tchau | |
| 59 | Beleza! Volte sempre. Tchau! | Sure thing! Come back anytime. Bye! | `packages/shared/src/npcTalk.ts` | nanda · tchau · NPC line | |
| 60 | Tchau, Nanda! | Bye, Nanda! | `packages/shared/src/npcTalk.ts` | nanda · tchau · reply chip → end | |
| 61 | Valeu! Tchau! | Thanks! Bye! | `packages/shared/src/npcTalk.ts` | nanda · tchau · reply chip → end | |
| 62 | {saudacao}, {nome}! Eu sou a Dona Graça, a padeira da noite. | {greeting}, {nome}! I’m Dona Graça, the night baker. | `packages/shared/src/npcTalk.ts` | graca · oi · NPC line | |
| 63 | {saudacao}, Dona Graça! | {greeting}, Dona Graça! | `packages/shared/src/npcTalk.ts` | graca · oi · reply chip → cafe | |
| 64 | Tudo bem? E a senhora? | How are you? And you, ma’am? | `packages/shared/src/npcTalk.ts` | graca · oi · reply chip → cafe | |
| 65 | Tudo bem! Quer um cafezinho? | All good! Want a little coffee? | `packages/shared/src/npcTalk.ts` | graca · cafe · NPC line | |
| 66 | Quero, por favor. | Yes, please. | `packages/shared/src/npcTalk.ts` | graca · cafe · reply chip → tchau | |
| 67 | Agora não, {obrigad}. | Not now, thanks. | `packages/shared/src/npcTalk.ts` | graca · cafe · reply chip → tchau | |
| 68 | Tá bom! Volte sempre. Tchau! | Okay! Come back anytime. Bye! | `packages/shared/src/npcTalk.ts` | graca · tchau · NPC line | |
| 69 | Tchau, Dona Graça! | Bye, Dona Graça! | `packages/shared/src/npcTalk.ts` | graca · tchau · reply chip → end | |
| 70 | Valeu! Tchau! | Thanks! Bye! | `packages/shared/src/npcTalk.ts` | graca · tchau · reply chip → end | |
| 71 | Oi, {nome}! Tudo bem? Eu sou a professora Bia. | Hi, {nome}! How’s it going? I’m Professor Bia. | `packages/shared/src/npcTalk.ts` | prof · oi · NPC line | |
| 72 | Oi, professora! Tudo bem! | Hi, professor! All good! | `packages/shared/src/npcTalk.ts` | prof · oi · reply chip → tatame | |
| 73 | Beleza! E você? | Cool! And you? | `packages/shared/src/npcTalk.ts` | prof · oi · reply chip → tatame | |
| 74 | Tudo ótimo! O tatame está livre. Quer treinar? | Great! The mat is free. Want to train? | `packages/shared/src/npcTalk.ts` | prof · tatame · NPC line | |
| 75 | Quero, sim! | Yes, I do! | `packages/shared/src/npcTalk.ts` | prof · tatame · reply chip → tchau | |
| 76 | Hoje não, {obrigad}. | Not today, thanks. | `packages/shared/src/npcTalk.ts` | prof · tatame · reply chip → tchau | |
| 77 | Beleza! Até a próxima. | Sure thing! Until next time. | `packages/shared/src/npcTalk.ts` | prof · tchau · NPC line | |
| 78 | Tchau, professora! | Bye, professor! | `packages/shared/src/npcTalk.ts` | prof · tchau · reply chip → end | |
| 79 | Valeu! Até logo! | Thanks! See you later! | `packages/shared/src/npcTalk.ts` | prof · tchau · reply chip → end | |
| 80 | {saudacao}, {nome}! Eu sou a Júlia. Tudo bem? | {greeting}, {nome}! I’m Júlia. How’s it going? | `packages/shared/src/npcTalk.ts` | julia · oi · NPC line | |
| 81 | {saudacao}, Júlia! Tudo bem! | {greeting}, Júlia! All good! | `packages/shared/src/npcTalk.ts` | julia · oi · reply chip → ajuda | |
| 82 | Tudo bom! E você? | All good! And you? | `packages/shared/src/npcTalk.ts` | julia · oi · reply chip → ajuda | |
| 83 | Que bom! Eu sou a guia da praça. Posso te ajudar? | Great! I’m the square’s guide. Can I help you? | `packages/shared/src/npcTalk.ts` | julia · ajuda · NPC line | |
| 84 | Sim, preciso de ajuda. | Yes, I need help. | `packages/shared/src/npcTalk.ts` | julia · ajuda · reply chip → help | |
| 85 | Não, {obrigad}. Estou só passeando. | No, thanks. I’m just strolling. | `packages/shared/src/npcTalk.ts` | julia · ajuda · reply chip → tchau | |
| 86 | Beleza! Aproveite a praça. Tchau! | Sure thing! Enjoy the square. Bye! | `packages/shared/src/npcTalk.ts` | julia · tchau · NPC line | |
| 87 | Tchau, Júlia! | Bye, Júlia! | `packages/shared/src/npcTalk.ts` | julia · tchau · reply chip → end | |
| 88 | Valeu! Até logo! | Thanks! See you later! | `packages/shared/src/npcTalk.ts` | julia · tchau · reply chip → end | |

## D. Conversa: Dona Graça persona and the "O bairro" subject

<a id="d-conversa"></a>
| # | PT | EN | Where | Note | OK? |
|---|---|---|---|---|---|
| 89 | (English prompt text for the AI, with a PT register brief) | You are Dona Graça, who runs the night shift (10 pm to 6 am) at Padaria do Seu Carlos in a São Paulo neighborhood while Seu Carlos is off. You are warm, a joker who teases gently (never at the customer's expense) and you like the quiet of the night. You are at the counter | `packages/shared/src/conversa.ts (CONVERSA_CAST.graca.persona)` | check the character: warm, a gentle joker, night shift | |
| 90 | O bairro | The neighborhood | `packages/shared/src/conversa.ts (o_bairro)` | new Conversa subject, unlocked at 4 hearts | |
| 91 | Converse sobre o bairro: onde você mora, a praça e os vizinhos. | Chat about the neighborhood: where you live, the square and the neighbors. | `packages/shared/src/conversa.ts (o_bairro)` | goal shown to the learner | |
| 92 | E aí, tá gostando do bairro? |  | `packages/shared/src/conversa.ts (o_bairro.seedOpeners)` | opener (offline authored Conversa) | |
| 93 | Você mora aqui perto? |  | `packages/shared/src/conversa.ts (o_bairro.seedOpeners)` | opener (offline authored Conversa) | |
| 94 | Já conheceu a Nanda e a Júlia? |  | `packages/shared/src/conversa.ts (o_bairro.seedOpeners)` | opener (offline authored Conversa) | |
| 95 | A praça tá bonita hoje, né? |  | `packages/shared/src/conversa.ts (o_bairro.seedOpeners)` | opener (offline authored Conversa) | |
| 96 | Gosto muito do bairro! |  | `packages/shared/src/conversa.ts (o_bairro.seedChipSets)` | reply chip, set 1 | |
| 97 | Moro aqui perto. |  | `packages/shared/src/conversa.ts (o_bairro.seedChipSets)` | reply chip, set 1 | |
| 98 | Ainda tô conhecendo. |  | `packages/shared/src/conversa.ts (o_bairro.seedChipSets)` | reply chip, set 1 | |
| 99 | Moro na kitnet, na praça. |  | `packages/shared/src/conversa.ts (o_bairro.seedChipSets)` | reply chip, set 2 | |
| 100 | Moro aqui perto, sim. |  | `packages/shared/src/conversa.ts (o_bairro.seedChipSets)` | reply chip, set 2 | |
| 101 | Não, moro longe. |  | `packages/shared/src/conversa.ts (o_bairro.seedChipSets)` | reply chip, set 2 | |
| 102 | Já conheci, sim! |  | `packages/shared/src/conversa.ts (o_bairro.seedChipSets)` | reply chip, set 3 | |
| 103 | Ainda não conheci. |  | `packages/shared/src/conversa.ts (o_bairro.seedChipSets)` | reply chip, set 3 | |
| 104 | A Nanda vende chapéus! |  | `packages/shared/src/conversa.ts (o_bairro.seedChipSets)` | reply chip, set 3 | |
| 105 | Tá linda mesmo! |  | `packages/shared/src/conversa.ts (o_bairro.seedChipSets)` | reply chip, set 4 | |
| 106 | Gosto da praça. |  | `packages/shared/src/conversa.ts (o_bairro.seedChipSets)` | reply chip, set 4 | |
| 107 | Ainda tô olhando. |  | `packages/shared/src/conversa.ts (o_bairro.seedChipSets)` | reply chip, set 4 | |

## E. Seu Carlos scene and Conversa: time-of-day greetings

<a id="e-scene"></a>
| # | PT | EN | Where | Note | OK? |
|---|---|---|---|---|---|
| 108 | Bom dia! Tudo bem? | Good morning! How’s it going? | `packages/shared/src/carlos.ts` | greeting chip; the greeting word is replaced by the one for the game hour | |
| 109 | bom dia / boa tarde / boa noite (+ seu carlos, + tudo bem) |  | `packages/shared/src/carlos.ts (accept list)` | typed answers accepted for the greeting chip at any hour | |
| 110 | Seu Carlos → Dona Graça |  | `packages/shared/src/conversa.ts` | the authored chips are rewritten client-side when she is on duty (apps/client/src/ui/conversa.ts `addressed`) | |

## F. Recados (errands)

<a id="f-recados"></a>
The 18 recados are authored in `content/curriculum/phase0/recados.md` (all `needs_br: true`); the templated step lines below are built in `describeStep`, so each distinct rendering is listed once.

| # | PT | EN | Where | Note | OK? |
|---|---|---|---|---|---|
| 111 | Café pra Nanda | Coffee for Nanda | `content/curriculum/phase0/recados.md` | carlos_cafe_pra_nanda · title (giver carlos, bond 0) | |
| 112 | Oi! A Nanda ainda não tomou café. Leva um café com leite pra ela? | Hi! Nanda hasn’t had her coffee yet. Can you take her a café com leite? | `content/curriculum/phase0/recados.md` | carlos_cafe_pra_nanda · ask | |
| 113 | Que bom! Ela vai adorar. Valeu! | Great! She’s going to love it. Thanks! | `content/curriculum/phase0/recados.md` | carlos_cafe_pra_nanda · thanks | |
| 114 | Peça 1× café com leite (Seu Carlos). | Order 1× coffee with milk (Seu Carlos). | `packages/shared/src/recados.ts (describeStep)` | carlos_cafe_pra_nanda · step line (tracker and "✓" notice) | |
| 115 | Entregue 1× café com leite pra Nanda. | Hand 1× coffee with milk to Nanda. | `packages/shared/src/recados.ts (describeStep)` | carlos_cafe_pra_nanda · step line (tracker and "✓" notice) | |
| 116 | Coxinha da padaria | Coxinha from the bakery | `content/curriculum/phase0/recados.md` | nanda_coxinha · title (giver nanda, bond 0) | |
| 117 | Tô com fome! Você pede uma coxinha pra mim na padaria? | I’m hungry! Can you get me a coxinha at the bakery? | `content/curriculum/phase0/recados.md` | nanda_coxinha · ask | |
| 118 | Hum, quentinha! Obrigada, viu? | Mmm, still warm! Thank you! | `content/curriculum/phase0/recados.md` | nanda_coxinha · thanks | |
| 119 | Peça 1× coxinha (Seu Carlos). | Order 1× chicken croquette (Seu Carlos). | `packages/shared/src/recados.ts (describeStep)` | nanda_coxinha · step line (tracker and "✓" notice) | |
| 120 | Entregue 1× coxinha pra Nanda. | Hand 1× chicken croquette to Nanda. | `packages/shared/src/recados.ts (describeStep)` | nanda_coxinha · step line (tracker and "✓" notice) | |
| 121 | O cumprimento certo | The right greeting | `content/curriculum/phase0/recados.md` | julia_cumprimento_certo · title (giver julia, bond 0) | |
| 122 | Oi! Cumprimenta alguém do jeito certo pra hora do dia. Depois passa na padaria, tá? | Hi! Greet someone the right way for the time of day. Then stop by the bakery, okay? | `content/curriculum/phase0/recados.md` | julia_cumprimento_certo · ask | |
| 123 | Muito bem! Você tá pegando o jeito! | Well done! You’re getting the hang of it! | `content/curriculum/phase0/recados.md` | julia_cumprimento_certo · thanks | |
| 124 | Cumprimente alguém (bom dia, boa tarde ou boa noite, conforme a hora). | Greet someone (bom dia, boa tarde or boa noite, to match the time). | `packages/shared/src/recados.ts (describeStep)` | julia_cumprimento_certo · step line (tracker and "✓" notice) | |
| 125 | Vá para: Padaria do Seu Carlos. | Go to: Seu Carlos’s Bakery. | `packages/shared/src/recados.ts (describeStep)` | julia_cumprimento_certo · step line (tracker and "✓" notice) | |
| 126 | Pão na chapa pra Júlia | Pão na chapa for Júlia | `content/curriculum/phase0/recados.md` | graca_pao_pra_julia · title (giver graca, bond 0) | |
| 127 | Oi! Aqui é a Graça, do turno da noite. A Júlia vive esquecendo o café da manhã. Leva um pão na chapa pra ela? | Hi! It’s Graça, from the night shift. Júlia is always forgetting breakfast. Can you take her a pão na chapa? | `content/curriculum/phase0/recados.md` | graca_pao_pra_julia · ask | |
| 128 | Pão na chapa é o melhor despertador! Valeu! | Pão na chapa is the best alarm clock! Thanks! | `content/curriculum/phase0/recados.md` | graca_pao_pra_julia · thanks | |
| 129 | Peça 1× pão na chapa (Seu Carlos). | Order 1× grilled buttered bread (Seu Carlos). | `packages/shared/src/recados.ts (describeStep)` | graca_pao_pra_julia · step line (tracker and "✓" notice) | |
| 130 | Entregue 1× pão na chapa pra Júlia. | Hand 1× grilled buttered bread to Júlia. | `packages/shared/src/recados.ts (describeStep)` | graca_pao_pra_julia · step line (tracker and "✓" notice) | |
| 131 | Um oi pro Seu Carlos | A hello for Seu Carlos | `content/curriculum/phase0/recados.md` | nanda_um_oi_pro_carlos · title (giver nanda, bond 0) | |
| 132 | Você passa na padaria e dá um oi pro Seu Carlos por mim? Ele gosta. | Can you stop by the bakery and say hi to Seu Carlos for me? He likes that. | `content/curriculum/phase0/recados.md` | nanda_um_oi_pro_carlos · ask | |
| 133 | Que legal! Você é gente boa. Valeu! | How nice! You’re good people. Thanks! | `content/curriculum/phase0/recados.md` | nanda_um_oi_pro_carlos · thanks | |
| 134 | Cumprimente Seu Carlos. | Greet Seu Carlos. | `packages/shared/src/recados.ts (describeStep)` | nanda_um_oi_pro_carlos · step line (tracker and "✓" notice) | |
| 135 | Banana pra Nanda | Banana for Nanda | `content/curriculum/phase0/recados.md` | tia_lu_banana_pra_nanda · title (giver tia_lu, bond 0) | |
| 136 | Olha a banana! Tá fresquinha! A Nanda adora. Leva uma banana pra ela? | Get your bananas! Nice and fresh! Nanda loves them. Can you take her a banana? | `content/curriculum/phase0/recados.md` | tia_lu_banana_pra_nanda · ask | |
| 137 | Isso aí! Ela vai amar. Valeu, volta sempre! | That’s it! She’s going to love it. Thanks, come back anytime! | `content/curriculum/phase0/recados.md` | tia_lu_banana_pra_nanda · thanks | |
| 138 | Peça 1× banana (Tia Lu). | Order 1× banana (Tia Lu). | `packages/shared/src/recados.ts (describeStep)` | tia_lu_banana_pra_nanda · step line (tracker and "✓" notice) | |
| 139 | Entregue 1× banana pra Nanda. | Hand 1× banana to Nanda. | `packages/shared/src/recados.ts (describeStep)` | tia_lu_banana_pra_nanda · step line (tracker and "✓" notice) | |
| 140 | Água pra Júlia | Water for Júlia | `content/curriculum/phase0/recados.md` | carlos_agua_pra_julia · title (giver carlos, bond 10) | |
| 141 | A Júlia passa o dia na praça, coitada. Leva uma água pra ela? | Júlia spends all day in the square, poor thing. Can you take her a water? | `content/curriculum/phase0/recados.md` | carlos_agua_pra_julia · ask | |
| 142 | Isso aí! Por conta da casa, um pão de queijo. | That’s it! On the house, a pão de queijo. | `content/curriculum/phase0/recados.md` | carlos_agua_pra_julia · thanks | |
| 143 | Peça 1× água (Seu Carlos). | Order 1× water (Seu Carlos). | `packages/shared/src/recados.ts (describeStep)` | carlos_agua_pra_julia · step line (tracker and "✓" notice) | |
| 144 | Entregue 1× água pra Júlia. | Hand 1× water to Júlia. | `packages/shared/src/recados.ts (describeStep)` | carlos_agua_pra_julia · step line (tracker and "✓" notice) | |
| 145 | Pastel pra Nanda | Pastel for Nanda | `content/curriculum/phase0/recados.md` | julia_pastel_pra_nanda · title (giver julia, bond 10) | |
| 146 | A Nanda tá com fome e não sai da barraca. Leva um pastel pra ela? | Nanda is hungry and never leaves her stall. Can you take her a pastel? | `content/curriculum/phase0/recados.md` | julia_pastel_pra_nanda · ask | |
| 147 | Hum, pastel quentinho! Ela vai adorar. Valeu! | Mmm, a warm pastel! She’s going to love it. Thanks! | `content/curriculum/phase0/recados.md` | julia_pastel_pra_nanda · thanks | |
| 148 | Peça 1× pastel (Seu Carlos). | Order 1× fried pastry (savory) (Seu Carlos). | `packages/shared/src/recados.ts (describeStep)` | julia_pastel_pra_nanda · step line (tracker and "✓" notice) | |
| 149 | Entregue 1× pastel pra Nanda. | Hand 1× fried pastry (savory) to Nanda. | `packages/shared/src/recados.ts (describeStep)` | julia_pastel_pra_nanda · step line (tracker and "✓" notice) | |
| 150 | Água pra academia | Water for the gym | `content/curriculum/phase0/recados.md` | graca_agua_pra_academia · title (giver graca, bond 10) | |
| 151 | Ei! Você vai na academia? Leva uma água pra Professora Bia! Quem treina tem que beber água. | Hey! Are you going to the gym? Take a water to Professora Bia! People who work out need to drink water. | `content/curriculum/phase0/recados.md` | graca_agua_pra_academia · ask | |
| 152 | Isso aí! Água é vida. Valeu! | That’s it! Water is life. Thanks! | `content/curriculum/phase0/recados.md` | graca_agua_pra_academia · thanks | |
| 153 | Vá para: Academia do Bairro. | Go to: Neighborhood Academy. | `packages/shared/src/recados.ts (describeStep)` | graca_agua_pra_academia · step line (tracker and "✓" notice) | |
| 154 | Entregue 1× água pra Professora Bia. | Hand 1× water to Professora Bia. | `packages/shared/src/recados.ts (describeStep)` | graca_agua_pra_academia · step line (tracker and "✓" notice) | |
| 155 | Conheça a Nanda | Meet Nanda | `content/curriculum/phase0/recados.md` | julia_conhecer_nanda · title (giver julia, bond 10) | |
| 156 | Você já conhece a Nanda? Ela tem a loja de chapéus. Vai lá e fala com ela! | Have you met Nanda yet? She has the hat stall. Go and talk to her! | `content/curriculum/phase0/recados.md` | julia_conhecer_nanda · ask | |
| 157 | Que bom! A Nanda é super simpática, né? | Great! Nanda is super nice, isn’t she? | `content/curriculum/phase0/recados.md` | julia_conhecer_nanda · thanks | |
| 158 | Fale com Nanda. | Talk to Nanda. | `packages/shared/src/recados.ts (describeStep)` | julia_conhecer_nanda · step line (tracker and "✓" notice) | |
| 159 | Flores pra Júlia | Flowers for Júlia | `content/curriculum/phase0/recados.md` | tia_lu_flores_pra_julia · title (giver tia_lu, bond 10) | |
| 160 | A Júlia adora flores! Leva umas pra ela, vai? | Júlia loves flowers! Why don’t you take her some? | `content/curriculum/phase0/recados.md` | tia_lu_flores_pra_julia · ask | |
| 161 | Que lindas! Ela vai ficar toda feliz. Valeu! | How pretty! She’s going to be so happy. Thanks! | `content/curriculum/phase0/recados.md` | tia_lu_flores_pra_julia · thanks | |
| 162 | Peça 1× flores (Tia Lu). | Order 1× flowers (Tia Lu). | `packages/shared/src/recados.ts (describeStep)` | tia_lu_flores_pra_julia · step line (tracker and "✓" notice) | |
| 163 | Entregue 1× flores pra Júlia. | Hand 1× flowers to Júlia. | `packages/shared/src/recados.ts (describeStep)` | tia_lu_flores_pra_julia · step line (tracker and "✓" notice) | |
| 164 | Uma maçã pra Nanda | An apple for Nanda | `content/curriculum/phase0/recados.md` | nanda_maca · title (giver nanda, bond 10) | |
| 165 | Tô com vontade de uma maçã! A Tia Lu vende na feira. Compra uma pra mim? | I’m craving an apple! Tia Lu sells them at the market. Can you buy me one? | `content/curriculum/phase0/recados.md` | nanda_maca · ask | |
| 166 | Que maçã boa! Valeu, você é gente boa! | What a good apple! Thanks, you’re good people! | `content/curriculum/phase0/recados.md` | nanda_maca · thanks | |
| 167 | Peça 1× maçã (Tia Lu). | Order 1× apple (Tia Lu). | `packages/shared/src/recados.ts (describeStep)` | nanda_maca · step line (tracker and "✓" notice) | |
| 168 | Entregue 1× maçã pra Nanda. | Hand 1× apple to Nanda. | `packages/shared/src/recados.ts (describeStep)` | nanda_maca · step line (tracker and "✓" notice) | |
| 169 | Salada do Seu Zé | Seu Zé’s salad | `content/curriculum/phase0/recados.md` | carlos_salada_do_ze · title (giver carlos, bond 10) | |
| 170 | Preciso de alface e tomate pro lanche. O Seu Zé vende na feira. Traz pra mim? | I need lettuce and tomato for the sandwiches. Seu Zé sells them at the market. Will you bring them to me? | `content/curriculum/phase0/recados.md` | carlos_salada_do_ze · ask | |
| 171 | Isso aí! Agora o lanche vai ficar bom. Valeu! | That’s it! Now the sandwiches will be great. Thanks! | `content/curriculum/phase0/recados.md` | carlos_salada_do_ze · thanks | |
| 172 | Peça 1× alface (Seu Zé). | Order 1× lettuce (Seu Zé). | `packages/shared/src/recados.ts (describeStep)` | carlos_salada_do_ze · step line (tracker and "✓" notice) | |
| 173 | Peça 1× tomate (Seu Zé). | Order 1× tomato (Seu Zé). | `packages/shared/src/recados.ts (describeStep)` | carlos_salada_do_ze · step line (tracker and "✓" notice) | |
| 174 | Entregue 1× alface pra Seu Carlos. | Hand 1× lettuce to Seu Carlos. | `packages/shared/src/recados.ts (describeStep)` | carlos_salada_do_ze · step line (tracker and "✓" notice) | |
| 175 | Entregue 1× tomate pra Seu Carlos. | Hand 1× tomato to Seu Carlos. | `packages/shared/src/recados.ts (describeStep)` | carlos_salada_do_ze · step line (tracker and "✓" notice) | |
| 176 | Manhã de entregas | Morning deliveries | `content/curriculum/phase0/recados.md` | carlos_manha_de_entregas · title (giver carlos, bond 20) | |
| 177 | Hoje tá cheio! Pede um pão na chapa pra Júlia e um café com leite pra Nanda. Uma coisa de cada vez, tá? | It’s busy today! Order a pão na chapa for Júlia and a café com leite for Nanda. One thing at a time, okay? | `content/curriculum/phase0/recados.md` | carlos_manha_de_entregas · ask | |
| 178 | Você me ajudou muito! Por conta da casa, um bolo. | You helped me so much! A cake, on the house. | `content/curriculum/phase0/recados.md` | carlos_manha_de_entregas · thanks | |
| 179 | Pergunta pro Seu Carlos | Ask Seu Carlos | `content/curriculum/phase0/recados.md` | nanda_pergunta_pro_carlos · title (giver nanda, bond 20) | |
| 180 | Pergunta pro Seu Carlos o que tem de bom hoje na padaria. Depois volta aqui e me conta, tá? | Ask Seu Carlos what’s good at the bakery today. Then come back and tell me, okay? | `content/curriculum/phase0/recados.md` | nanda_pergunta_pro_carlos · ask | |
| 181 | Hum, que delícia! Valeu por me contar! | Mmm, sounds delicious! Thanks for telling me! | `content/curriculum/phase0/recados.md` | nanda_pergunta_pro_carlos · thanks | |
| 182 | Fale com Seu Carlos. | Talk to Seu Carlos. | `packages/shared/src/recados.ts (describeStep)` | nanda_pergunta_pro_carlos · step line (tracker and "✓" notice) | |
| 183 | Um cumprimento pra Júlia | A greeting for Júlia | `content/curriculum/phase0/recados.md` | graca_cumprimenta_julia · title (giver graca, bond 30) | |
| 184 | Ei! Vai na praça e cumprimenta a Júlia do jeito certo pra hora do dia. Depois vem na padaria, tá? | Hey! Go to the square and greet Júlia the right way for the time of day. Then come by the bakery, okay? | `content/curriculum/phase0/recados.md` | graca_cumprimenta_julia · ask | |
| 185 | Muito bem! Agora você merece um café! | Well done! Now you deserve a coffee! | `content/curriculum/phase0/recados.md` | graca_cumprimenta_julia · thanks | |
| 186 | Cumprimente Júlia (bom dia, boa tarde ou boa noite, conforme a hora). | Greet Júlia (bom dia, boa tarde or boa noite, to match the time). | `packages/shared/src/recados.ts (describeStep)` | graca_cumprimenta_julia · step line (tracker and "✓" notice) | |
| 187 | Uma volta pela vizinhança | A walk around the neighborhood | `content/curriculum/phase0/recados.md` | julia_volta_pela_vizinhanca · title (giver julia, bond 30) | |
| 188 | Dá uma volta! Vai na academia, volta pra praça e me dá um oi. Eu te espero aqui! | Go for a walk! Go to the gym, come back to the square and say hi to me. I’ll wait for you here! | `content/curriculum/phase0/recados.md` | julia_volta_pela_vizinhanca · ask | |
| 189 | Você voltou! Que bom te ver de novo! | You’re back! So good to see you again! | `content/curriculum/phase0/recados.md` | julia_volta_pela_vizinhanca · thanks | |
| 190 | Vá para: Vila Ipê. | Go to: Ipê Village. | `packages/shared/src/recados.ts (describeStep)` | julia_volta_pela_vizinhanca · step line (tracker and "✓" notice) | |
| 191 | Cumprimente Júlia. | Greet Júlia. | `packages/shared/src/recados.ts (describeStep)` | julia_volta_pela_vizinhanca · step line (tracker and "✓" notice) | |
| 192 | Pastel e caldo pra Professora Bia | Pastel and cane juice for Professora Bia | `content/curriculum/phase0/recados.md` | julia_pastel_caldo_pra_bia · title (giver julia, bond 20) | |
| 193 | A Professora Bia adora pastel com caldo de cana depois do treino. Compra no Seu Chico e leva pra ela? | Professora Bia loves pastel with sugarcane juice after training. Buy them from Seu Chico and take them to her? | `content/curriculum/phase0/recados.md` | julia_pastel_caldo_pra_bia · ask | |
| 194 | Que delícia! Obrigada, viu? | How delicious! Thank you, you know? | `content/curriculum/phase0/recados.md` | julia_pastel_caldo_pra_bia · thanks | |
| 195 | Peça 1× pastel (Seu Chico). | Order 1× fried pastry (savory) (Seu Chico). | `packages/shared/src/recados.ts (describeStep)` | julia_pastel_caldo_pra_bia · step line (tracker and "✓" notice) | |
| 196 | Peça 1× caldo de cana (Seu Chico). | Order 1× sugarcane juice (Seu Chico). | `packages/shared/src/recados.ts (describeStep)` | julia_pastel_caldo_pra_bia · step line (tracker and "✓" notice) | |
| 197 | Entregue 1× pastel pra Professora Bia. | Hand 1× fried pastry (savory) to Professora Bia. | `packages/shared/src/recados.ts (describeStep)` | julia_pastel_caldo_pra_bia · step line (tracker and "✓" notice) | |
| 198 | Entregue 1× caldo de cana pra Professora Bia. | Hand 1× sugarcane juice to Professora Bia. | `packages/shared/src/recados.ts (describeStep)` | julia_pastel_caldo_pra_bia · step line (tracker and "✓" notice) | |

## G. Item names that are new (bag, tracker, hand-over)

<a id="g-items"></a>
| # | PT | EN | Where | Note | OK? |
|---|---|---|---|---|---|
| 199 | jornal | newspaper | `packages/shared/src/recados.ts (EXTRA_ITEMS)` | item jornal (no card yet: see Proposed cards) | |
| 200 | flores | flowers | `packages/shared/src/recados.ts (EXTRA_ITEMS)` | item flores (no card yet: see Proposed cards) | |
| 201 | banana | banana | `packages/shared/src/recados.ts (EXTRA_ITEMS)` | item banana (no card yet: see Proposed cards) | |
| 202 | laranja | orange | `packages/shared/src/recados.ts (EXTRA_ITEMS)` | item laranja (no card yet: see Proposed cards) | |
| 203 | maçã | apple | `packages/shared/src/recados.ts (EXTRA_ITEMS)` | item maca (no card yet: see Proposed cards) | |
| 204 | alface | lettuce | `packages/shared/src/recados.ts (EXTRA_ITEMS)` | item alface (no card yet: see Proposed cards) | |
| 205 | tomate | tomato | `packages/shared/src/recados.ts (EXTRA_ITEMS)` | item tomate (no card yet: see Proposed cards) | |
| 206 | caldo de cana | sugarcane juice | `packages/shared/src/recados.ts (EXTRA_ITEMS)` | item caldo_de_cana (no card yet: see Proposed cards) | |

## H. Friendship (hearts)

<a id="h-bonds"></a>
| # | PT | EN | Where | Note | OK? |
|---|---|---|---|---|---|
| 207 | Usa o seu nome e lembra de você | Uses your name and remembers you | `packages/shared/src/bonds.ts (BOND_MILESTONES)` | 2 hearts | |
| 208 | Novo assunto de Conversa | New Conversa subject | `packages/shared/src/bonds.ts (BOND_MILESTONES)` | 4 hearts | |
| 209 | Presente pra sua kitnet | A gift for your kitnet | `packages/shared/src/bonds.ts (BOND_MILESTONES)` | 6 hearts | |

## I. Recados: offers, hand-overs, tracker, journal, hearts (client + server)

<a id="i-recados-ui"></a>
| # | PT | EN | Where | Note | OK? |
|---|---|---|---|---|---|
| 210 | Pode deixar! | You got it! | `apps/client/src/ui/recados.ts` | accept an errand | |
| 211 | Agora não | Not now | `apps/client/src/ui/recados.ts` | decline | |
| 212 | Recado: {título} | Errand: {title} | `apps/client/src/ui/recados.ts` | offer box header | |
| 213 | {Bom dia / Boa tarde / Boa noite}! Trouxe algo pra mim? | {Good morning / …}! Did you bring me something? | `apps/client/src/ui/recados.ts` | hand-over box | |
| 214 | Entregar {item} | Hand over {item} | `apps/client/src/ui/recados.ts` | hand-over chip | |
| 215 | Só conversar | Just chat | `apps/client/src/ui/recados.ts` | hand-over chip | |
| 216 | Recados: abrir o diário | Errands: open the journal | `apps/client/src/ui/recados.ts` | tracker tooltip | |
| 217 | Bem-vindo à Vila Ipê | Welcome to Vila Ipê | `apps/client/src/ui/recadoView.ts` | welcome chain title (Júlia) | |
| 218 | Quase lá! O bônus já vem. | Almost there! Your bonus is on its way. | `apps/client/src/ui/recadoView.ts` | welcome chain, last step | |
| 219 | Em andamento | In progress | `apps/client/src/ui/recados.ts` | journal section | |
| 220 | Mochila | Bag | `apps/client/src/ui/recados.ts` | journal section (also a proposed card: mochila) | |
| 221 | Hoje na vila | Offered today | `apps/client/src/ui/recados.ts` | journal section | |
| 222 | Feitos hoje: n | Done today: n | `apps/client/src/ui/recados.ts` | journal section | |
| 223 | Amizades | Friendships | `apps/client/src/ui/recados.ts` | journal section | |
| 224 | Nenhum recado agora. Fale com os vizinhos! | No errands right now. Talk to the neighbors! | `apps/client/src/ui/recados.ts` | empty state | |
| 225 | Vazia. Peça algo na padaria! | Empty. Order something at the bakery! | `apps/client/src/ui/recados.ts` | empty bag | |
| 226 | Sem novidades por hoje. | Nothing new today. | `apps/client/src/ui/recados.ts` | empty offers | |
| 227 | {título} · fale com ele(a) pra aceitar | {title} · talk to them to accept | `apps/client/src/ui/recados.ts` | offered card | |
| 228 | 2 ♥ sabe seu nome · 4 ♥ assunto novo · 6 ♥ presente | 2 ♥ knows your name · 4 ♥ a new chat topic · 6 ♥ a gift | `apps/client/src/ui/recados.ts` | hearts legend | |
| 229 | ♥ {NPC} gosta de você! n coração/corações | Your friendship with {NPC} grew: n ♥ | `apps/client/src/ui/recados.ts` | heart-up toast | |
| 230 | Recado aceito: {título} | Errand accepted: {title} | `apps/server/src/recados.ts` | notice | |
| 231 | Recado: {título} | Errand: {title} | `apps/server/src/recados.ts` | reward reason | |
| 232 | {NPC}: “{thanks}” | {NPC}: “{thanks}” | `apps/server/src/recados.ts` | thanks notice (uses the recado's thanks line) | |
| 233 | ✓ {passo} |  | `apps/server/src/recados.ts` | step-done notice (the step line from describeStep) | |
| 234 | Não é pra agora. Fica com você! | Not needed right now. Keep it! | `apps/server/src/recados.ts` | hand-over of something nobody wants | |
| 235 | ♥ {NPC} já sabe o seu nome e lembra de você! | {NPC} knows your name now and remembers you! | `apps/server/src/recados.ts` | 2-heart notice | |
| 236 | ♥ {NPC} tem um assunto novo pra conversar: O bairro! | {NPC} has a new thing to chat about: The neighborhood! | `apps/server/src/recados.ts` | 4-heart notice | |
| 237 | ♥ {NPC} te deu um presente: {móvel}! Tá no seu inventário (Decorar). | {NPC} gave you a gift: {item}! It’s in your inventory (Decorate). | `apps/server/src/recados.ts` | 6-heart notice; furniture names come from the catalog | |
| 238 | O café da manhã é no balcão da padaria. | Breakfast is at the bakery counter. | `apps/server/src/world.ts` | error when the breakfast scene is started outside the padaria | |

## J. Readable world: signs and hotspot cards

<a id="j-hotspots"></a>
INVENTED FACTS to confirm or change (Phase 7 and 9): bus "Linha 875 · Centro", "Fonte de 1985", parking "R$ 5 por hora", "Aceitamos Pix", "Desde 1978", class times "Segunda a sexta: 18h / Sábado: 10h", the banca headlines ("Chuva à noite", "Padaria faz festa"), café "R$ 4" / pão na chapa "R$ 6" / coxinha "R$ 7" / pastel "R$ 8", every feira price, the feira hours "6h às 13h".

| # | PT | EN | Where | Note | OK? |
|---|---|---|---|---|---|
| 239 | PADARIA ⏎ DO SEU CARLOS | Bakery ⏎ of Seu Carlos | `packages/shared/src/hotspots.ts` | padaria_letreiro (praca) | |
| 240 | TUDO BEM? | How’s it going? | `packages/shared/src/hotspots.ts` | empena_tudo_bem (praca) | |
| 241 | EDIFÍCIO IPÊ | Ipê Building | `packages/shared/src/hotspots.ts` | edificio_letreiro (praca) | |
| 242 | Nº 42 | No. 42 | `packages/shared/src/hotspots.ts` | edificio_numero (praca) | |
| 243 | ACADEMIA ⏎ DO BAIRRO | Neighborhood ⏎ academy | `packages/shared/src/hotspots.ts` | academia_letreiro (praca) | |
| 244 | BANCA ⏎ HOJE: Chuva à noite ⏎ Feira livre: todo dia, 6h às 13h ⏎ Padaria faz festa | NEWSSTAND ⏎ Today: Rain tonight ⏎ Street market: every day, 6 am to 1 pm ⏎ Bakery throws a party | `packages/shared/src/hotspots.ts` | banca_manchetes (praca) | |
| 245 | R. DOS IPÊS | Ipê Street | `packages/shared/src/hotspots.ts` | placa_rua_ipes (praca) | |
| 246 | ORELHÃO ⏎ Telefone público | PAYPHONE (“big ear”) ⏎ Public phone | `packages/shared/src/hotspots.ts` | orelhao (praca) | |
| 247 | LIXO | Trash | `packages/shared/src/hotspots.ts` | lixeira_padaria (praca) | |
| 248 | Café R$ 4 ⏎ Pão na chapa R$ 6 | Coffee R$ 4 ⏎ Grilled buttered bread R$ 6 | `packages/shared/src/hotspots.ts` | mesa_cafe_precos (praca) | |
| 249 | BICICLETÁRIO | Bike rack | `packages/shared/src/hotspots.ts` | bicicletario (praca) | |
| 250 | ÔNIBUS ⏎ Linha 875 · Centro | BUS ⏎ Line 875 · Downtown | `packages/shared/src/hotspots.ts` | ponto_onibus (praca) | |
| 251 | ESTACIONAMENTO ⏎ R$ 5 por hora | PARKING ⏎ R$ 5 per hour | `packages/shared/src/hotspots.ts` | parquimetro (praca) | |
| 252 | LIXO | Trash | `packages/shared/src/hotspots.ts` | lixeira_praca (praca) | |
| 253 | Praça Central ⏎ Fonte de 1985 | Central Square ⏎ Fountain from 1985 | `packages/shared/src/hotspots.ts` | fonte_praca (praca) | |
| 254 | CORREIO | Mailbox | `packages/shared/src/hotspots.ts` | caixa_correio (praca) | |
| 255 | FEIRA LIVRE ⏎ Todo dia · 6h às 13h | STREET MARKET ⏎ Every day · 6 am to 1 pm | `packages/shared/src/hotspots.ts` | feira_livre (praca) | |
| 256 | FRUTAS DA TIA LU ⏎ Banana R$ 2 ⏎ 3 bananas R$ 5 ⏎ Laranja R$ 1 ⏎ Maçã R$ 1,50 ⏎ Flores R$ 12 | TIA LU’S FRUIT ⏎ Banana R$ 2 ⏎ 3 bananas R$ 5 ⏎ Orange R$ 1 ⏎ Apple R$ 1.50 ⏎ Flowers R$ 12 | `packages/shared/src/hotspots.ts` | feira_preco_frutas (praca) | |
| 257 | VERDURAS DO SEU ZÉ ⏎ Alface R$ 3,50 ⏎ Tomate R$ 2,50 | SEU ZÉ’S VEGETABLES ⏎ Lettuce R$ 3.50 ⏎ Tomato R$ 2.50 | `packages/shared/src/hotspots.ts` | feira_preco_verduras (praca) | |
| 258 | PASTEL E CALDO DE CANA ⏎ Pastel R$ 6 ⏎ Caldo de cana R$ 5 | PASTEL AND SUGARCANE JUICE ⏎ Pastel R$ 6 ⏎ Sugarcane juice R$ 5 | `packages/shared/src/hotspots.ts` | feira_preco_pastel (praca) | |
| 259 | FLORES DA DONA ROSA ⏎ Buquê R$ 12 | DONA ROSA’S FLOWERS ⏎ Bunch R$ 12 | `packages/shared/src/hotspots.ts` | feira_preco_flores (praca) | |
| 260 | HORTIFRÚTI ⏎ Banana R$ 2 ⏎ Laranja R$ 1 ⏎ Maçã R$ 1,50 ⏎ Alface R$ 3,50 ⏎ Tomate R$ 2,50 ⏎ Flores R$ 12 ⏎ Aberto o dia todo | GREENGROCER ⏎ Banana R$ 2 ⏎ Orange R$ 1 ⏎ Apple R$ 1.50 ⏎ Lettuce R$ 3.50 ⏎ Tomato R$ 2.50 ⏎ Flowers R$ 12 ⏎ Open all day | `packages/shared/src/hotspots.ts` | hortifruti_placa (praca) | |
| 261 | CARDÁPIO ⏎ Pão na chapa R$ 6 ⏎ Coxinha R$ 7 ⏎ Pastel R$ 8 ⏎ Café R$ 4 ⏎ Café com leite R$ 5 ⏎ Suco de laranja R$ 8 ⏎ Água R$ 3 | MENU ⏎ Grilled buttered bread R$ 6 ⏎ Chicken croquette R$ 7 ⏎ Fried pastry R$ 8 ⏎ Coffee R$ 4 ⏎ Coffee with milk R$ 5 ⏎ Orange juice R$ 8 ⏎ Water R$ 3 | `packages/shared/src/hotspots.ts` | padaria_cardapio (padaria) | |
| 262 | PADARIA DO SEU CARLOS ⏎ Desde 1978 | SEU CARLOS’S BAKERY ⏎ Since 1978 | `packages/shared/src/hotspots.ts` | padaria_prateleira (padaria) | |
| 263 | CAIXA ⏎ Aceitamos Pix | CASHIER ⏎ We take Pix (instant transfer) | `packages/shared/src/hotspots.ts` | padaria_caixa (padaria) | |
| 264 | Salgado bem quente! ⏎ Coxinha R$ 7 · Pastel R$ 8 | Nice and hot snacks! ⏎ Chicken croquette R$ 7 · Fried pastry R$ 8 | `packages/shared/src/hotspots.ts` | padaria_estufa (padaria) | |
| 265 | SÃO PAULO ⏎ A cidade que não para | SÃO PAULO ⏎ The city that never stops | `packages/shared/src/hotspots.ts` | kitnet_poster_sp (kitnet) | |
| 266 | Minha família ⏎ e meus amigos | My family ⏎ and my friends | `packages/shared/src/hotspots.ts` | kitnet_fotos (kitnet) | |
| 267 | REGRAS ⏎ 1. Tire os sapatos. ⏎ 2. Respeite o parceiro. ⏎ 3. Cumprimente com um sorriso. | RULES ⏎ 1. Take off your shoes. ⏎ 2. Respect your partner. ⏎ 3. Greet with a smile. | `packages/shared/src/hotspots.ts` | academia_regras (academia) | |
| 268 | TREINO ⏎ COMUNIDADE | TRAINING ⏎ COMMUNITY | `packages/shared/src/hotspots.ts` | academia_mural (academia) | |
| 269 | AULAS ⏎ Segunda a sexta: 18h ⏎ Sábado: 10h | CLASSES ⏎ Monday to Friday: 6 pm ⏎ Saturday: 10 am | `packages/shared/src/hotspots.ts` | academia_horarios (academia) | |
| 270 | FAIXAS ⏎ branca · azul · roxa ⏎ marrom · preta | BELTS ⏎ white · blue · purple ⏎ brown · black | `packages/shared/src/hotspots.ts` | academia_faixas (academia) | |
| 271 | VESTIÁRIO ⏎ Guarde suas coisas aqui | CHANGING ROOM ⏎ Keep your things here | `packages/shared/src/hotspots.ts` | academia_vestiario (academia) | |

## K. Hover labels of places and props (praça first)

<a id="k-labels"></a>
Only labels that exist on a prop are listed; the older ones from the first three rooms are included for completeness.

| # | PT | EN | Where | Note | OK? |
|---|---|---|---|---|---|
| 272 | Padaria do Seu Carlos | Seu Carlos’s bakery | `packages/shared/src/rooms.ts (praca)` | prop padaria | |
| 273 | Edifício Ipê Nº 42 | Ipê Building No. 42 | `packages/shared/src/rooms.ts (praca)` | prop edificio | |
| 274 | Academia do Bairro | Neighborhood Academy | `packages/shared/src/rooms.ts (praca)` | prop academia | |
| 275 | Banca de jornal | Newsstand | `packages/shared/src/rooms.ts (praca)` | prop banca | |
| 276 | Pilha de jornais | Newspaper stack | `packages/shared/src/rooms.ts (praca)` | prop jornais | |
| 277 | Orelhão | Public phone booth (“big ear”) | `packages/shared/src/rooms.ts (praca)` | prop orelhao | |
| 278 | Rua dos Ipês | Ipê Street (street sign) | `packages/shared/src/rooms.ts (praca)` | prop placa | |
| 279 | Mesinha da padaria | Bakery sidewalk table | `packages/shared/src/rooms.ts (praca)` | prop mesa_cafe | |
| 280 | Ponto de ônibus | Bus stop | `packages/shared/src/rooms.ts (praca)` | prop ponto | |
| 281 | Fonte da praça | Square fountain | `packages/shared/src/rooms.ts (praca)` | prop fonte | |
| 282 | Quiosque de missões | Quest kiosk | `packages/shared/src/rooms.ts (praca)` | prop quiosque | |
| 283 | Chapéus da Nanda | Nanda’s Hats | `packages/shared/src/rooms.ts (praca)` | prop barraca | |
| 284 | Poleiro do papagaio | Parrot perch | `packages/shared/src/rooms.ts (praca)` | prop poleiro | |
| 285 | Viralata Caramello | Caramel stray dog (vira-lata) | `packages/shared/src/rooms.ts (praca)` | prop vira_lata | |
| 286 | Feira livre | Street market | `packages/shared/src/rooms.ts (praca)` | prop feira_livre | |
| 287 | Frutas da Tia Lu | Tia Lu’s fruit stall | `packages/shared/src/rooms.ts (praca)` | prop feira_tia_lu | |
| 288 | Verduras do Seu Zé | Seu Zé’s vegetable stall | `packages/shared/src/rooms.ts (praca)` | prop feira_ze | |
| 289 | Pastel e caldo de cana do Seu Chico | Seu Chico’s pastel and sugarcane juice | `packages/shared/src/rooms.ts (praca)` | prop feira_chico | |
| 290 | Flores da Dona Rosa | Dona Rosa’s flowers | `packages/shared/src/rooms.ts (praca)` | prop feira_rosa | |
| 291 | Hortifrúti da banca | Greengrocer at the newsstand | `packages/shared/src/rooms.ts (praca)` | prop hortifruti | |
| 292 | Caixa | Cash register | `packages/shared/src/rooms.ts (padaria)` | prop caixa | |
| 293 | Estufa de salgados | Warm snack display | `packages/shared/src/rooms.ts (padaria)` | prop estufa | |
| 294 | Correria no Balcão | Counter Rush: work the counter | `packages/shared/src/rooms.ts (padaria)` | prop trilho | |
| 295 | Tatame aberto | Open mat | `packages/shared/src/rooms.ts (academia)` | prop tatame | |
| 296 | Fila do tatame | Open-mat queue | `packages/shared/src/rooms.ts (academia)` | prop fila | |
| 297 | Parede de faixas | Belt wall | `packages/shared/src/rooms.ts (academia)` | prop faixas | |
| 298 | Academia do Bairro | Academy photo | `packages/shared/src/rooms.ts (academia)` | prop quadro | |
| 299 | Arquibancada | Bleachers | `packages/shared/src/rooms.ts (academia)` | prop arquibancada | |
| 300 | Vestiário · alongamento | Changing / stretch corner | `packages/shared/src/rooms.ts (academia)` | prop vestiario | |

## L. Feira livre

<a id="l-feira"></a>
| # | PT | EN | Where | Note | OK? |
|---|---|---|---|---|---|
| 301 | Tia Lu |  | `packages/shared/src/feira.ts (VENDORS)` | vendor name (tia_lu) | |
| 302 | Bom dia, freguês! Tá fresquinha a fruta hoje! O que vai ser? | Good morning, customer! The fruit is fresh today! What’ll it be? | `packages/shared/src/feira.ts (VENDORS)` | tia_lu · greeting | |
| 303 | A feira já fechou. Volte amanhã às seis da manhã! | The market has closed. Come back tomorrow at six in the morning! | `packages/shared/src/feira.ts (VENDORS)` | tia_lu · closed line | |
| 304 | Olha a banana! Três por cinco! | Get your bananas! Three for five! | `packages/shared/src/feira.ts (VENDORS)` | tia_lu · street call (floats over the stall) | |
| 305 | Laranja doce, freguesa! | Sweet oranges, ma’am! | `packages/shared/src/feira.ts (VENDORS)` | tia_lu · street call (floats over the stall) | |
| 306 | Maçã fresquinha, leva uma! | Fresh apples, take one! | `packages/shared/src/feira.ts (VENDORS)` | tia_lu · street call (floats over the stall) | |
| 307 | Seu Zé |  | `packages/shared/src/feira.ts (VENDORS)` | vendor name (ze) | |
| 308 | Bom dia! Alface e tomate fresquinhos. O que vai levar? | Good morning! Nice fresh lettuce and tomatoes. What will you take? | `packages/shared/src/feira.ts (VENDORS)` | ze · greeting | |
| 309 | Já fechei a banca. Amanhã tem mais, às seis! | I’ve closed my stall. There’s more tomorrow, at six! | `packages/shared/src/feira.ts (VENDORS)` | ze · closed line | |
| 310 | Olha o tomate! Bem vermelhinho! | Get your tomatoes! Nice and red! | `packages/shared/src/feira.ts (VENDORS)` | ze · street call (floats over the stall) | |
| 311 | Alface fresca, freguesa! | Fresh lettuce, ma’am! | `packages/shared/src/feira.ts (VENDORS)` | ze · street call (floats over the stall) | |
| 312 | Seu Chico |  | `packages/shared/src/feira.ts (VENDORS)` | vendor name (chico) | |
| 313 | Bom dia! Pastel quentinho e caldo de cana gelado! O que vai ser? | Good morning! Hot pastel and cold sugarcane juice! What’ll it be? | `packages/shared/src/feira.ts (VENDORS)` | chico · greeting | |
| 314 | Acabou o pastel por hoje. Volte amanhã às seis! | The pastel is gone for today. Come back tomorrow at six! | `packages/shared/src/feira.ts (VENDORS)` | chico · closed line | |
| 315 | Pastel quentinho! | Nice hot pastel! | `packages/shared/src/feira.ts (VENDORS)` | chico · street call (floats over the stall) | |
| 316 | Caldo de cana geladinho! | Ice-cold sugarcane juice! | `packages/shared/src/feira.ts (VENDORS)` | chico · street call (floats over the stall) | |
| 317 | Dona Rosa |  | `packages/shared/src/feira.ts (VENDORS)` | vendor name (rosa) | |
| 318 | Bom dia! Flores bonitas pra você! Quer levar um buquê? | Good morning! Pretty flowers for you! Want to take a bunch? | `packages/shared/src/feira.ts (VENDORS)` | rosa · greeting | |
| 319 | As flores já descansaram por hoje. Volte amanhã às seis! | The flowers are resting for today. Come back tomorrow at six! | `packages/shared/src/feira.ts (VENDORS)` | rosa · closed line | |
| 320 | Flores, freguesa! | Flowers, ma’am! | `packages/shared/src/feira.ts (VENDORS)` | rosa · street call (floats over the stall) | |
| 321 | Flor bonita pra casa, leva! | Pretty flowers for your home, take some! | `packages/shared/src/feira.ts (VENDORS)` | rosa · street call (floats over the stall) | |
| 322 | Hortifrúti da banca |  | `packages/shared/src/feira.ts (VENDORS)` | vendor name (banca) | |
| 323 | Hortifrúti da banca: fruta, verdura e flores o dia todo. O que vai ser? | The bakery-corner greengrocer: fruit, vegetables and flowers all day. What’ll it be? | `packages/shared/src/feira.ts (VENDORS)` | banca · greeting | |
| 324 | A feira volta amanhã às 6h. | The market is back tomorrow at 6 am. | `packages/shared/src/feira.ts (VENDORS)` | banca · closed line | |
| 325 | A feira volta amanhã às 6h. O hortifrúti da banca está aberto! | The market is back tomorrow at 6 am. The greengrocer at the newsstand is open! | `packages/shared/src/feira.ts (FEIRA_CLOSED_NOTE)` | closed-stall note | |
| 326 | banana / bananas | banana / bananas | `packages/shared/src/feira.ts (GOODS)` | good banana: unit R$ 2.00, 3 for R$ 5.00 | |
| 327 | A banana custa dois reais. Três por cinco reais! | The banana costs two reais. Three for five reais! | `packages/shared/src/feira.ts (priceLine)` | banana · price line (generated) | |
| 328 | Quanto custa a banana? | How much is the banana? | `packages/shared/src/feira.ts (askChip)` | banana · ask chip (typed variants: Quanto é / Quanto fica / Qual é o preço) | |
| 329 | Me vê uma banana, por favor. | I’ll take one banana, please. | `packages/shared/src/feira.ts (qtyChip)` | banana × 1 · quantity chip | |
| 330 | Uma banana: dois reais. | One banana: two reais. | `packages/shared/src/feira.ts (totalLine)` | banana × 1 · total line (generated) | |
| 331 | Me vê três bananas, por favor. | I’ll take three bananas, please. | `packages/shared/src/feira.ts (qtyChip)` | banana × 3 · quantity chip | |
| 332 | Três bananas: cinco reais. | Three bananas: five reais. | `packages/shared/src/feira.ts (totalLine)` | banana × 3 · total line (generated) | |
| 333 | Me vê seis bananas, por favor. | I’ll take six bananas, please. | `packages/shared/src/feira.ts (qtyChip)` | banana × 6 · quantity chip | |
| 334 | Seis bananas: dez reais. | Six bananas: ten reais. | `packages/shared/src/feira.ts (totalLine)` | banana × 6 · total line (generated) | |
| 335 | laranja / laranjas | orange / oranges | `packages/shared/src/feira.ts (GOODS)` | good laranja: unit R$ 1.00 | |
| 336 | A laranja custa um real. | The orange costs one real. | `packages/shared/src/feira.ts (priceLine)` | laranja · price line (generated) | |
| 337 | Quanto custa a laranja? | How much is the orange? | `packages/shared/src/feira.ts (askChip)` | laranja · ask chip (typed variants: Quanto é / Quanto fica / Qual é o preço) | |
| 338 | Me vê uma laranja, por favor. | I’ll take one orange, please. | `packages/shared/src/feira.ts (qtyChip)` | laranja × 1 · quantity chip | |
| 339 | Uma laranja: um real. | One orange: one real. | `packages/shared/src/feira.ts (totalLine)` | laranja × 1 · total line (generated) | |
| 340 | Me vê duas laranjas, por favor. | I’ll take two oranges, please. | `packages/shared/src/feira.ts (qtyChip)` | laranja × 2 · quantity chip | |
| 341 | Duas laranjas: dois reais. | Two oranges: two reais. | `packages/shared/src/feira.ts (totalLine)` | laranja × 2 · total line (generated) | |
| 342 | Me vê quatro laranjas, por favor. | I’ll take four oranges, please. | `packages/shared/src/feira.ts (qtyChip)` | laranja × 4 · quantity chip | |
| 343 | Quatro laranjas: quatro reais. | Four oranges: four reais. | `packages/shared/src/feira.ts (totalLine)` | laranja × 4 · total line (generated) | |
| 344 | maçã / maçãs | apple / apples | `packages/shared/src/feira.ts (GOODS)` | good maca: unit R$ 1.50 | |
| 345 | A maçã custa um real e cinquenta centavos. | The apple costs one real and fifty centavos. | `packages/shared/src/feira.ts (priceLine)` | maca · price line (generated) | |
| 346 | Quanto custa a maçã? | How much is the apple? | `packages/shared/src/feira.ts (askChip)` | maca · ask chip (typed variants: Quanto é / Quanto fica / Qual é o preço) | |
| 347 | Me vê uma maçã, por favor. | I’ll take one apple, please. | `packages/shared/src/feira.ts (qtyChip)` | maca × 1 · quantity chip | |
| 348 | Uma maçã: um real e cinquenta centavos. | One apple: one real and fifty centavos. | `packages/shared/src/feira.ts (totalLine)` | maca × 1 · total line (generated) | |
| 349 | Me vê duas maçãs, por favor. | I’ll take two apples, please. | `packages/shared/src/feira.ts (qtyChip)` | maca × 2 · quantity chip | |
| 350 | Duas maçãs: três reais. | Two apples: three reais. | `packages/shared/src/feira.ts (totalLine)` | maca × 2 · total line (generated) | |
| 351 | Me vê três maçãs, por favor. | I’ll take three apples, please. | `packages/shared/src/feira.ts (qtyChip)` | maca × 3 · quantity chip | |
| 352 | Três maçãs: quatro reais e cinquenta centavos. | Three apples: four reais and fifty centavos. | `packages/shared/src/feira.ts (totalLine)` | maca × 3 · total line (generated) | |
| 353 | alface / alfaces | lettuce / lettuces | `packages/shared/src/feira.ts (GOODS)` | good alface: unit R$ 3.50 | |
| 354 | A alface custa três reais e cinquenta centavos. | The lettuce costs three reais and fifty centavos. | `packages/shared/src/feira.ts (priceLine)` | alface · price line (generated) | |
| 355 | Quanto custa a alface? | How much is the lettuce? | `packages/shared/src/feira.ts (askChip)` | alface · ask chip (typed variants: Quanto é / Quanto fica / Qual é o preço) | |
| 356 | Me vê uma alface, por favor. | I’ll take one lettuce, please. | `packages/shared/src/feira.ts (qtyChip)` | alface × 1 · quantity chip | |
| 357 | Uma alface: três reais e cinquenta centavos. | One lettuce: three reais and fifty centavos. | `packages/shared/src/feira.ts (totalLine)` | alface × 1 · total line (generated) | |
| 358 | Me vê duas alfaces, por favor. | I’ll take two lettuces, please. | `packages/shared/src/feira.ts (qtyChip)` | alface × 2 · quantity chip | |
| 359 | Duas alfaces: sete reais. | Two lettuces: seven reais. | `packages/shared/src/feira.ts (totalLine)` | alface × 2 · total line (generated) | |
| 360 | tomate / tomates | tomato / tomatoes | `packages/shared/src/feira.ts (GOODS)` | good tomate: unit R$ 2.50 | |
| 361 | O tomate custa dois reais e cinquenta centavos. | The tomato costs two reais and fifty centavos. | `packages/shared/src/feira.ts (priceLine)` | tomate · price line (generated) | |
| 362 | Quanto custa o tomate? | How much is the tomato? | `packages/shared/src/feira.ts (askChip)` | tomate · ask chip (typed variants: Quanto é / Quanto fica / Qual é o preço) | |
| 363 | Me vê um tomate, por favor. | I’ll take one tomato, please. | `packages/shared/src/feira.ts (qtyChip)` | tomate × 1 · quantity chip | |
| 364 | Um tomate: dois reais e cinquenta centavos. | One tomato: two reais and fifty centavos. | `packages/shared/src/feira.ts (totalLine)` | tomate × 1 · total line (generated) | |
| 365 | Me vê dois tomates, por favor. | I’ll take two tomatoes, please. | `packages/shared/src/feira.ts (qtyChip)` | tomate × 2 · quantity chip | |
| 366 | Dois tomates: cinco reais. | Two tomatoes: five reais. | `packages/shared/src/feira.ts (totalLine)` | tomate × 2 · total line (generated) | |
| 367 | Me vê três tomates, por favor. | I’ll take three tomatoes, please. | `packages/shared/src/feira.ts (qtyChip)` | tomate × 3 · quantity chip | |
| 368 | Três tomates: sete reais e cinquenta centavos. | Three tomatoes: seven reais and fifty centavos. | `packages/shared/src/feira.ts (totalLine)` | tomate × 3 · total line (generated) | |
| 369 | pastel / pastéis | pastel / pastéis | `packages/shared/src/feira.ts (GOODS)` | good pastel: unit R$ 6.00 | |
| 370 | O pastel custa seis reais. | The pastel costs six reais. | `packages/shared/src/feira.ts (priceLine)` | pastel · price line (generated) | |
| 371 | Quanto custa o pastel? | How much is the pastel? | `packages/shared/src/feira.ts (askChip)` | pastel · ask chip (typed variants: Quanto é / Quanto fica / Qual é o preço) | |
| 372 | Me vê um pastel, por favor. | I’ll take one pastel, please. | `packages/shared/src/feira.ts (qtyChip)` | pastel × 1 · quantity chip | |
| 373 | Um pastel: seis reais. | One pastel: six reais. | `packages/shared/src/feira.ts (totalLine)` | pastel × 1 · total line (generated) | |
| 374 | Me vê dois pastéis, por favor. | I’ll take two pastéis, please. | `packages/shared/src/feira.ts (qtyChip)` | pastel × 2 · quantity chip | |
| 375 | Dois pastéis: doze reais. | Two pastéis: twelve reais. | `packages/shared/src/feira.ts (totalLine)` | pastel × 2 · total line (generated) | |
| 376 | caldo de cana / caldos de cana | sugarcane juice / sugarcane juices | `packages/shared/src/feira.ts (GOODS)` | good caldo_de_cana: unit R$ 5.00 | |
| 377 | O caldo de cana custa cinco reais. | The sugarcane juice costs five reais. | `packages/shared/src/feira.ts (priceLine)` | caldo_de_cana · price line (generated) | |
| 378 | Quanto custa o caldo de cana? | How much is the sugarcane juice? | `packages/shared/src/feira.ts (askChip)` | caldo_de_cana · ask chip (typed variants: Quanto é / Quanto fica / Qual é o preço) | |
| 379 | Me vê um caldo de cana, por favor. | I’ll take one sugarcane juice, please. | `packages/shared/src/feira.ts (qtyChip)` | caldo_de_cana × 1 · quantity chip | |
| 380 | Um caldo de cana: cinco reais. | One sugarcane juice: five reais. | `packages/shared/src/feira.ts (totalLine)` | caldo_de_cana × 1 · total line (generated) | |
| 381 | Me vê dois caldos de cana, por favor. | I’ll take two sugarcane juices, please. | `packages/shared/src/feira.ts (qtyChip)` | caldo_de_cana × 2 · quantity chip | |
| 382 | Dois caldos de cana: dez reais. | Two sugarcane juices: ten reais. | `packages/shared/src/feira.ts (totalLine)` | caldo_de_cana × 2 · total line (generated) | |
| 383 | buquê de flores / buquês de flores | bunch of flowers / bunches of flowers | `packages/shared/src/feira.ts (GOODS)` | good flores: unit R$ 12.00 | |
| 384 | O buquê de flores custa doze reais. | The bunch of flowers costs twelve reais. | `packages/shared/src/feira.ts (priceLine)` | flores · price line (generated) | |
| 385 | Quanto custa o buquê de flores? | How much is the bunch of flowers? | `packages/shared/src/feira.ts (askChip)` | flores · ask chip (typed variants: Quanto é / Quanto fica / Qual é o preço) | |
| 386 | Me vê um buquê de flores, por favor. | I’ll take one bunch of flowers, please. | `packages/shared/src/feira.ts (qtyChip)` | flores × 1 · quantity chip | |
| 387 | Um buquê de flores: doze reais. | One bunch of flowers: twelve reais. | `packages/shared/src/feira.ts (totalLine)` | flores × 1 · total line (generated) | |
| 388 | Me vê dois buquês de flores, por favor. | I’ll take two bunches of flowers, please. | `packages/shared/src/feira.ts (qtyChip)` | flores × 2 · quantity chip | |
| 389 | Dois buquês de flores: vinte e quatro reais. | Two bunches of flowers: twenty-four reais. | `packages/shared/src/feira.ts (totalLine)` | flores × 2 · total line (generated) | |
| 390 | Pronto! Valor certinho. Obrigado! | Done! The exact amount. Thank you! | `packages/shared/src/feira.ts (resultLine)` | payment result sample 1 | |
| 391 | Aqui o seu troco: três reais e cinquenta centavos. Obrigado! | Here’s your change: three reais and fifty centavos. Thank you! | `packages/shared/src/feira.ts (resultLine)` | payment result sample 2 | |
| 392 | Faltam cinquenta centavos. | You’re still fifty centavos short. | `packages/shared/src/feira.ts (resultLine)` | payment result sample 3 | |
| 393 | Você ainda não pagou nada. | You haven’t paid anything yet. | `packages/shared/src/feira.ts (resultLine)` | payment result sample 4 | |

## M. Feira: dialogue, tray and server errors (client + server)

<a id="m-feira-ui"></a>
| # | PT | EN | Where | Note | OK? |
|---|---|---|---|---|---|
| 394 | Pergunte o preço em português… | Ask the price in Portuguese… | `apps/client/src/ui/feira.ts` | placeholder | |
| 395 | Quantos? Responda em português… | How many? Reply in Portuguese… | `apps/client/src/ui/feira.ts` | placeholder | |
| 396 | Só estou olhando, obrigado/a. | I’m just looking, thanks. | `apps/client/src/ui/feira.ts` | chip | |
| 397 | Agora não, obrigado/a. | Not now, thanks. | `apps/client/src/ui/feira.ts` | chip | |
| 398 | Pois não. Mais alguma coisa? | Sure. Anything else? | `apps/client/src/ui/feira.ts` | vendor line | |
| 399 | Pois não! O que mais vai ser? | Sure! What else will it be? | `apps/client/src/ui/feira.ts` | vendor line | |
| 400 | Quero mais uma coisa. | I want one more thing. | `apps/client/src/ui/feira.ts` | chip | |
| 401 | Tchau, valeu! | Bye, thanks! | `apps/client/src/ui/feira.ts` | chip | |
| 402 | Tá bom, obrigado/a! | Okay, thanks! | `apps/client/src/ui/feira.ts` | chip | |
| 403 | Preço · Você deu · Toque nas moedas e notas · Pagar · Limpar | Price · You paid · Tap the coins and notes · Pay · Clear | `apps/client/src/ui/feira.ts` | tray labels | |
| 404 | Hortifrúti · Barraca da feira | Greengrocer · Market stall | `apps/client/src/ui/feira.ts` | role tags in the box | |
| 405 | Dica: pergunte “Quanto custa…?” · Como? Pode repetir? Pergunte: “Quanto custa a banana?” · Tente: “Quanto custa a banana?” | Tip: ask “Quanto custa…?” · What? Can you repeat? Ask: … | `apps/client/src/ui/feira.ts` | hints from scoreAsk in packages/shared/src/feira.ts | |
| 406 | Essa barraca não vende isso. | That stall doesn’t sell that. | `apps/server/src/feira.ts` | error | |
| 407 | A feira fica na rua. | The market is out on the street. | `apps/server/src/feira.ts` | error | |
| 408 | Chegue mais perto do hortifrúti. | Walk closer to the greengrocer. | `apps/server/src/feira.ts` | error | |
| 409 | Não entendi esse pedido. | I didn’t understand that order. | `apps/server/src/feira.ts` | error | |
| 410 | Compra na feira | Shopping at the feira | `apps/server/src/feira.ts` | RV reward reason | |
| 411 | um real / dois reais / cinquenta centavos / três reais e cinquenta centavos … | one real / two reais / fifty centavos / … | `packages/shared/src/feira.ts (moneyPt)` | all money is spoken in words; check the pluralisation and "e" joins | |

## N. Caderno de palavras (client panel)

<a id="n-caderno-ui"></a>
| # | PT | EN | Where | Note | OK? |
|---|---|---|---|---|---|
| 412 | Caderno de palavras | Word notebook · the words you meet in Vila Ipê | `apps/client/src/ui/caderno.ts` | panel title and subtitle | |
| 413 | Caderno | Notebook | `apps/client/src/ui/caderno.ts` | top-bar button label | |
| 414 | Ainda não vista | Not met yet | `apps/client/src/ui/caderno.ts` | word state | |
| 415 | Vista | Seen: press 🔊 to hear it | `apps/client/src/ui/caderno.ts` | word state | |
| 416 | Ouvida | Heard | `apps/client/src/ui/caderno.ts` | word state | |
| 417 | Usada | Used | `apps/client/src/ui/caderno.ts` | word state | |
| 418 | Encontre esta palavra primeiro | Meet this word first | `apps/client/src/ui/caderno.ts` | tooltip on the disabled 🔊 of a hidden word ("???") | |
| 419 | Palavra ainda não encontrada | Word not found yet | `apps/client/src/ui/caderno.ts` | aria-label | |
| 420 | ✓ Completo! | Notebook group complete | `apps/client/src/ui/caderno.ts` | group header when all words are learned; text also "Aprenda todas: +15 RV" (EN Learn them all: +15 RV) | |
| 421 | Aprendida = vista e ouvida, ou usada | Learned = seen and heard, or used | `apps/client/src/ui/caderno.ts` | legend | |
| 422 | Padaria · Cumprimentos · Números | Bakery · Greetings · Numbers | `packages/shared/src/caderno.ts (GROUP_LABELS)` | tab names (groups derived from card ids) | |
| 423 | Caderno completo: {grupo}! | Notebook complete: {group}! | `apps/server/src/caderno.ts` | reward reason (+15 RV) | |
| 424 | Não achei essas palavras. | I couldn’t find those words. | `apps/server/src/caderno.ts` | error for a bad `heard` message | |

## O. Dialogue box, hotspot card and dialogue chrome (client)

<a id="o-dialogue-ui"></a>
Phase 7 UI. Learning text stays in Nunito; these are the labels around it.

| # | PT | EN | Where | Note | OK? |
|---|---|---|---|---|---|
| 425 | Mostrar inglês | Show English | `apps/client/src/ui/dialogue.ts` | switch in the box header | |
| 426 | 🔊 Ouvir | Listen | `apps/client/src/ui/dialogue.ts` | listen button (tooltip "Ouvir / Listen") | |
| 427 | Fechar (Esc) | Close (Esc) | `apps/client/src/ui/dialogue.ts` | close button tooltip | |
| 428 | Seu Carlos está pensando | Seu Carlos is thinking | `apps/client/src/ui/dialogue.ts` | screen-reader label while an AI turn is pending (three dots) | |
| 429 | Clique para completar | Click to finish | `apps/client/src/ui/dialogue.ts` | tooltip on the typing line | |
| 430 | Sua resposta | Your reply | `apps/client/src/ui/dialogue.ts` | aria-label of the reply field | |
| 431 | Responda em português… | Reply in Portuguese… | `apps/client/src/ui/conversa.ts, ui/panels.ts, ui/pedido.ts` | placeholder of the reply field | |
| 432 | Pedido rápido | Quick order | `apps/client/src/ui/conversa.ts` | button on the Conversa box | |
| 433 | Detalhes | Details | `apps/client/src/ui/conversa.ts` | NEW in Phase 10: folds the three meters of the conta on phones | |
| 434 | Padeiro · Pedido rápido | Baker · Quick order | `apps/client/src/ui/pedido.ts` | role tag | |
| 435 | Jogar "Correria no Balcão" | Play Counter Rush | `apps/client/src/ui/pedido.ts` | button after the scene | |
| 436 | Já pediu hoje! Volte amanhã. | You already ordered today! Come back tomorrow. | `apps/client/src/ui/pedido.ts` | daily RV gate | |
| 437 | Loja de chapéus | Hat shop | `apps/client/src/ui/npcTalk.ts, ui/recados.ts` | Nanda's role tag | |
| 438 | Guia da praça | Square guide | `apps/client/src/ui/npcTalk.ts, ui/recados.ts` | Júlia's role tag | |
| 439 | Padeira da noite | Night baker | `apps/client/src/ui/npcTalk.ts, ui/recados.ts` | Dona Graça's role tag | |
| 440 | Professora de jiu-jitsu | Jiu-jitsu teacher | `apps/client/src/ui/npcTalk.ts, ui/recados.ts` | Professora Bia's role tag | |
| 441 | Ver chapéus | See the hats | `apps/client/src/ui/npcTalk.ts` | extra button in Nanda's box | |
| 442 | Claro! O que você quer saber? | Of course! What do you want to know? | `apps/client/src/ui/panels.ts` | Júlia's help menu | |
| 443 | Tchau, Júlia! | Bye, Júlia! | `apps/client/src/ui/panels.ts` | Júlia's help menu | |
| 444 | Sem chapéu também fica ótimo! | No hat looks great too! | `apps/client/src/ui/panels.ts` | Nanda's line in the hat shop | |
| 445 | Não consigo chegar perto disso. | I can’t get close to that. | `apps/client/src/main.ts` | toast when a sign cannot be reached | |
| 446 | Falar com Dona Graça / Falar com Carlos | Talk to Dona Graça / Talk to Seu Carlos | `apps/client/src/main.ts` | guide label over the baker on duty (PT labels: "Fale com a Dona Graça", "Fale com o Seu Carlos") | |
| 447 | Sobre o que a gente conversa hoje? | What shall we chat about today? | `apps/client/src/main.ts` | baker's question when a second subject is open (4 hearts) | |
| 448 | Nanda volta às 8h | Nanda is back at 8 am | `apps/client/src/main.ts` | note in the hat shop when her stall is closed | |
| 449 | Fechado · volta às 8h | Closed · back at 8 | `apps/client/src/render/pixel/WorldScene.ts` | plate over Nanda's closed stall | |
| 450 | Feira fechada · volta às 6h | Market closed · back at 6 | `apps/client/src/render/pixel/WorldScene.ts` | plate over the feira banner outside 06:00-13:00 | |
| 451 | Guardar no caderno | Save to notebook | `apps/client/src/ui/hotspotCard.ts` | button on a sign that teaches words | |
| 452 | Guardado ✓ | Saved ✓ | `apps/client/src/ui/hotspotCard.ts` | after saving | |
| 453 | Recados — errands, bag and friends |  | `apps/client/src/ui/hud.ts` | tooltip of the top-bar button | |
| 454 | Caderno de palavras / Word notebook |  | `apps/client/src/ui/hud.ts` | tooltip of the top-bar button | |

## P. NPC memory (server)

<a id="p-memory"></a>
| # | PT | EN | Where | Note | OK? |
|---|---|---|---|---|---|
| 455 | Pediu {um\|uma} {item}[ e {um\|uma} {item}]. | (template) Ordered a … and a … | `packages/shared/src/npcMemory.ts` | remembered line, stored when no AI summary arrives | |
| 456 | Conversou sobre {assunto}. | (template) Chatted about … | `packages/shared/src/npcMemory.ts` | e.g. Conversou sobre café da manhã. / sobre cumprimentos. | |
| 457 | Pediu um café com leite e uma coxinha pra viagem. · Conversou sobre café da manhã. · Hoje é o de sempre? | (prompt examples for the AI summariser, English instructions) | `apps/server/src/services/xai.ts` | model-facing text, not shown to players | |

## Q. Other new Portuguese in the interface and in painted signs

<a id="q-misc"></a>
| # | PT | EN | Where | Note | OK? |
|---|---|---|---|---|---|
| 458 | ↻ Girar | Turn around (aria: Girar o avatar) | `apps/client/src/ui/onboarding.ts` | avatar creator turn button | |
| 459 | Créditos · Arte · Vozes · Fontes · Motor do mundo · Música e sons | Credits · Art · Voices · Fonts · World engine · Music and sounds | `apps/client/src/ui/creditsData.ts` | credits panel; the notes are Portuguese too (see the file) | |
| 460 | você · portas · vizinhos · Mapa da Vila Ipê · Em breve | you · doors · neighbors · Map of Vila Ipê · Coming soon | `apps/client/src/ui/minimap.ts / panels.ts` | minimap key and labels | |
| 461 | PADARIA · MERCADO · FLORES · LANCHES · SAPATOS · PIZZA · BANCA · DO SEU CARLOS · ACADEMIA DO BAIRRO · ESCOLA · EDIFICIO IPE · Nº 42 · R. DOS IPES · FEIRA LIVRE · TUDO BEM? · EM BREVE · ONIBUS · BUS · SAMPA · METRO · SP · RESPEITO · TREINO · AMIZADE |  | `apps/client/assets-src/custom (painted in pixels, capitals, no accents)` | shop plaques and sign art; the accented forms live in the DOM labels and hotspots. "Seu Carlos", "Seu Zé", "Dona" forms of address: check register | |
| 462 | Dom · 09:04 ☀️ (tooltip in EN: Sunday · 9:04 am · Sunny) |  | `apps/client/src/ui/clockPill.ts` | clock pill shows the PT short weekday; check Seg/Ter/Qua/Qui/Sex/Sáb/Dom | |

## S. Arrival, camera, escola and cartela polish (client)

<a id="s-polish"></a>
Visual pass on the arrival, camera, diary, escola and cartela. Everything else on those screens is existing copy reused as is.

| # | PT | EN | Where | Note | OK? |
|---|---|---|---|---|---|
| 463 | Toma a câmera. | Here, take the camera. | `packages/shared/src/arrival.ts` | **Trimmed, needs a Brazilian read.** Júlia's note at the airport (Célia's hand-over). Was "Toma a câmera e a cartela do bairro."; the cartela is no longer handed over at the airport. | |
| 464 | De novo | Again | `apps/client/src/ui/escola.ts` | Existing label from the tatame rematch, reused for "practice another word" after a right answer at the escola. Check it still fits there. | |
| 465 | Hoje: 1/4 | Today: 1/4 | `apps/client/src/ui/cartela.ts` | Trimmed from "Hoje: 1/4 hoje", which repeated the word. | |
| 466 | peça preta · peça branca | black piece · white piece | `apps/client/src/ui/checkers.ts` | **New, needs a Brazilian read.** Screen-reader labels of the damas pieces (not shown on screen). | |
| 467 | Rua dos Ipês (leste) | Ipê Street (east) | `packages/shared/src/rooms.ts, apps/client/src/ui/panels.ts` | **New, needs a Brazilian read.** Name of the east half of the street (the rua was split in two to run lighter): HUD room name, the edge-portal label, the Mapa tab and card. The west half keeps "Rua dos Ipês". Check "(leste)" reads right as a suffix. | |
| 468 | Academia: leste → · ← Padaria: pela Rua · ← Chapéus: pela Rua · ← Minha kitnet: pela Rua | Academy: east → · ← Bakery: via the Street · ← Hats: via the Street · ← My studio: via the Street | `apps/client/src/main.ts (updateGuides)` | **New, needs a Brazilian read.** Tutorial guide arrows on the two halves of the street. | |

## R. Proposed cards for the Curriculum team

<a id="r-proposed-cards"></a>
No card was added during the conversion (the rule in HOWTO section 8: reference existing card ids, list the rest here). These words and phrases appear in the game and have no card.

| # | Proposed card(s) | Why | Where it shows up |
|---|---|---|---|
| P1 | jornal, flores, banana, mochila | Items that exist in the bag (`ITEMS`) without a card, so they cannot enter the Caderno (logic track 2). | `packages/shared/src/recados.ts` |
| P2 | lex.feira.quanto_custa (Quanto custa …?), lex.feira.troco (troco) | The feira flow teaches both; neither is a card. | `packages/shared/src/feira.ts` |
| P3 | lex.feira.banana, laranja, maca, alface, tomate, caldo_de_cana, flores | The goods sold at the feira (items exist, cards do not). | `packages/shared/src/feira.ts` |
| P4 | numbers above 20, money words (reais, centavos, real) | Prices are spoken in words up to R$ 20 with centavos. | `packages/shared/src/numbers.ts, feira.ts` |
| P5 | lex.social.valeu, lex.social.que_bom, lex.padaria.leva (Leva um … pra ela?) | Used in the recados; "Volta sempre" and "Isso aí" already exist but are not used. | `content/curriculum/phase0/recados.md` |
| P6 | lex.rua.praca, lex.rua.academia (places) | Used in recado steps ("Vá para …"). | `content/curriculum/phase0/recados.md` |
| P7 | Phrases used by recados but not cards: Tô com fome, dá um oi, Pergunta pro …, Leva … pra ela? | Authentic chunks A1 learners will meet. | `content/curriculum/phase0/recados.md` |
| P8 | lex.rua.* and lex.academia.* packs: padaria, banca, orelhão, ônibus, correio, lixo, faixa (white, blue, purple, brown, black), regras | Words on signs that have no card, so those signs have no "Guardar no caderno" button. | `packages/shared/src/hotspots.ts` |
| P9 | moro, gosto, bairro, vizinho/vizinha, recado, mochila, entregar | Words of the O bairro subject, the recados and the journal. | `packages/shared/src/conversa.ts, apps/client/src/ui/recados.ts` |

## T. Fala pra gente (in-game feedback)

<a id="t-feedback"></a>
The HUD chip and the note form. Safety refusals reuse the existing chat notes (no new strings). **needs_br.**

| # | PT | EN | Where | Note | OK? |
|---|---|---|---|---|---|
| 469 | Fala | Feedback | `packages/shared/src/feedback.ts` (`FEEDBACK_COPY.button`) | HUD chip, top right, always visible | |
| 470 | Fala pra gente | A note for us | same, `title` | Form title and the chip's accessible name | |
| 471 | Um recado curto. A gente lê todo dia. | A short note. We read these every day. | same, `lead` | Under the title | |
| 472 | O que você quer contar? | What do you want to tell us? | same, `textLabel` | Note field | |
| 473 | A porta emperrou, uma ideia, ou só um oi. | The door stuck, an idea, or just a hello. | same, `textPlaceholder` | Placeholder | |
| 474 | Se quiser, marca um tipo | If you want, pick a type | same, `kindLabel` | Optional category | |
| 475 | Problema | Something's off | same, `bug` | Category chip | |
| 476 | Ideia | Idea | same, `idea` | Category chip | |
| 477 | Gostei | Something I love | same, `love` | Category chip | |
| 478 | Como te achar (opcional) | How to reach you (optional) | same, `contactLabel` | Guests only. Signed-in players do not see this | |
| 479 | E-mail ou um apelido. Só se você quiser. | An email or a nickname, only if you want. | same, `contactPlaceholder` | | |
| 480 | Você está na sua conta. Não precisa deixar contato. | You're signed in, so no need to leave a contact. | same, `signedIn` | Shown instead of the contact field | |
| 481 | Mandar | Send | same, `send` | | |
| 482 | Valeu! A gente lê isso todo dia. | Thanks! We read these every day. | same, `thanks` | After a saved note | |
| 483 | Escreve um pouquinho, por favor. | Write a short note, please. | same, `empty` / `short` | | |
| 484 | Esse recado ficou longo demais. Encurta um pouco. | That note is too long. Shorten it a little. | same, `long` | | |
| 485 | Escolhe problema, ideia ou gostei. | Pick a problem, an idea, or something you love. | same, `category` | | |
| 486 | Esse contato não parece certo. | That contact doesn't look right. | same, `contact` | | |
| 487 | Deixa o contato no campo de contato, não dentro do recado. | Put a way to reach you in the contact field, not inside the note. | same, `pii` | Note body refused an email or phone | |
| 488 | Calma, já recebemos o seu recado. Tenta de novo mais tarde. | We already got your note. Try again later. | same, `rate` | | |
| 489 | Não deu pra enviar agora. Tenta de novo daqui a pouco. | Couldn't send just now. Try again in a moment. | same, `offline` | | |
| 490 | Não deu pra ler esse recado. | We couldn't read that note. | same, `bad_request` | | |

## U. Feira vendors off duty (issue #170)

<a id="u-off-duty"></a>
What a vendor says away from the open stall (Tia Lu on her praça bench, 13:00-17:00). Small talk, never an offer; "Dá pra comprar?" gets tomorrow's hours (06:00-13:00). All in `packages/shared/src/feira.ts` (`OFF_DUTY`), chips and role in `apps/client/src/ui/feira.ts` (`openFeiraOffDuty`). **needs_br.**

| # | PT | EN | Where | Note | OK? |
|---|---|---|---|---|---|
| 491 | Ai, que bom descansar um pouquinho! | Oh, it’s so nice to rest a little! | `OFF_DUTY.tia_lu` | Tia Lu | |
| 492 | Acordei às quatro hoje. Tô cansada! | I got up at four today. I’m tired! | `OFF_DUTY.tia_lu` | Tia Lu. Invented fact: feirantes get up very early | |
| 493 | Meus netos vêm jantar lá em casa hoje. | My grandkids are coming over for dinner tonight. | `OFF_DUTY.tia_lu` | Tia Lu. Invented fact: she has grandchildren | |
| 494 | Amanhã cedo tô na feira! | I’ll be at the feira early tomorrow! | `OFF_DUTY.*` | All four vendors say it | |
| 495 | Agora não, a feira já fechou! Amanhã tem, das seis à uma da tarde. | Not now, the feira has closed! It’s on tomorrow, from six to one in the afternoon. | `OFF_DUTY.tia_lu.buy` | Tia Lu, answer to the buy chip. Check "das seis à uma" | |
| 496 | Opa! Hoje a feira foi boa. | Hey! The feira went well today. | `OFF_DUTY.ze` | Seu Zé | |
| 497 | Agora é hora de descansar as pernas. | Now it’s time to rest my legs. | `OFF_DUTY.ze` | Seu Zé | |
| 498 | Mais tarde tem jogo de futebol na TV. | There’s a football game on TV later. | `OFF_DUTY.ze` | Seu Zé | |
| 499 | Hoje não dá mais. Amanhã tem feira, das seis à uma da tarde! | Not today anymore. There’s a feira tomorrow, from six to one in the afternoon! | `OFF_DUTY.ze.buy` | Seu Zé | |
| 500 | Hoje vendi tudo! Que dia! | I sold everything today! What a day! | `OFF_DUTY.chico` | Seu Chico | |
| 501 | Tô com cheiro de pastel até agora! | I still smell like pastel! | `OFF_DUTY.chico` | Seu Chico | |
| 502 | Agora eu quero um café e uma soneca. | Now I want a coffee and a nap. | `OFF_DUTY.chico` | Seu Chico | |
| 503 | Pastel só amanhã! A feira abre às seis e vai até a uma. | Pastel only tomorrow! The feira opens at six and goes until one. | `OFF_DUTY.chico.buy` | Seu Chico | |
| 504 | Que bom te ver fora da feira! | How nice to see you away from the feira! | `OFF_DUTY.rosa` | Dona Rosa | |
| 505 | Agora vou cuidar das minhas plantas. | Now I’m going to look after my plants. | `OFF_DUTY.rosa` | Dona Rosa | |
| 506 | Minha neta adora flores, igual a mim. | My granddaughter loves flowers, just like me. | `OFF_DUTY.rosa` | Dona Rosa. Invented fact: she has a granddaughter | |
| 507 | As flores ficam pra amanhã. A feira é das seis à uma da tarde! | The flowers will have to wait for tomorrow. The feira is from six to one in the afternoon! | `OFF_DUTY.rosa.buy` | Dona Rosa | |
| 508 | Dá pra comprar alguma coisa? | Can I buy something? | `OFF_DUTY_ASK` | Player chip | |
| 509 | Até amanhã! | See you tomorrow! | `OFF_DUTY_BYE` | Player chip | |
| 510 | Tá bom, {obrigad}! Até amanhã! | Okay, thanks! See you tomorrow! | `apps/client/src/ui/feira.ts` | Player chip after the buy answer | |
| 511 | Depois da feira | (role line in the box) | `apps/client/src/ui/feira.ts` | Shown under the vendor's name off duty, where the stall box says "Barraca da feira" | |

## V. Diário: the sticker album (client)

<a id="v-diario"></a>
The Diário redone as an álbum de figurinhas: index tabs per place, a numbered slot per word, a card per word. All in `apps/client/src/ui/journal.ts` and `journalView.ts`. None of it is spoken (the card plays the word's existing clip), so it needs no TTS. **needs_br.**

| # | PT | EN | Where | Note | OK? |
|---|---|---|---|---|---|
| 512 | Nova · Aprendendo · Quase lá · Dominada | New · Learning · Almost there · Mastered | `ui/journalView.ts` (`MASTERY_LABEL`) | How far the Escola has taken a word (box 0, 1-2, 3-4, 5) | |
| 513 | Foto · Placa · Conversa · Jogo | Photo · Sign · Talk · Game | `ui/journalView.ts` (`SOURCE_LABEL`) | How a word is found; filter buttons and sticker badges | |
| 514 | Fotografada em: {lugar} | Photographed in: {place} | `ui/journalView.ts` (`howFound`) | {lugar} is the chapter name (Praça, Rua...) | |
| 515 | Fotografe algo em: {lugar} | Photograph something in: {place} | `ui/journalView.ts` (`howFound`) | Hint on an empty slot; never names the object | |
| 516 | Lida numa placa | Read on a sign | `ui/journalView.ts` (`howFound`) |  | |
| 517 | Leia uma placa em: {lugar} | Read a sign in: {place} | `ui/journalView.ts` (`howFound`) | Hint on an empty slot | |
| 518 | Ouvida de {nome} | Heard from {name} | `ui/journalView.ts` (`howFound`) | {nome}: Seu Carlos, Júlia... | |
| 519 | Converse com {nome} | Talk to {name} | `ui/journalView.ts` (`howFound`) | Hint on an empty slot | |
| 520 | Ganha jogando com {nome} | Won in a game with {name} | `ui/journalView.ts` (`howFound`) | Check the agreement: *a palavra* foi ganha | |
| 521 | Vença um jogo com {nome} | Win a game with {name} | `ui/journalView.ts` (`howFound`) | Hint on an empty slot | |
| 522 | Diário de {nome} | {name}'s diary | `ui/journal.ts` (Início) | Title page | |
| 523 | VILA IPÊ · SP | (stamp) | `ui/journal.ts` (Início) | Rubber stamp on the title page | |
| 524 | {n} palavras no seu diário · de {total} | {n} of {total} words found | `ui/journal.ts` (Início) | Big counter in a ring | |
| 525 | dia seguido · dias seguidos | day streak | `ui/journal.ts` (Início) | Escola streak | |
| 526 | pra revisar | due in the Escola | `ui/journal.ts` (Início) |  | |
| 527 | Procurar no diário… · Procurar em {lugar}… | Search your words · Search {place} | `ui/journal.ts` | Search placeholders | |
| 528 | {n} figurinha nova! · {n} figurinhas novas! | New since your last visit | `ui/journal.ts` (Início) | Figurinha = album sticker | |
| 529 | Últimas palavras | Your latest words | `ui/journal.ts` (Início) |  | |
| 530 | Seu diário está esperando a primeira palavra. | Your diary is waiting for its first word | `ui/journal.ts` (Início) | Empty diary | |
| 531 | Capítulos · Capítulo {n} | Chapters · Chapter {n} | `ui/journal.ts` |  | |
| 532 | {n} palavra · {n} palavras · Nenhuma palavra encontrada | found in your diary · Nothing in your diary matches | `ui/journal.ts` (search) |  | |
| 533 | COMPLETO! | (stamp) | `ui/journal.ts` (chapter) | Every word of a place found | |
| 534 | {pct}% · ★ {n} dominadas | {pct}% found · {n} mastered | `ui/journal.ts` (chapter) |  | |
| 535 | Todas | All | `ui/journal.ts` (chapter) | Source filter | |
| 536 | Álbum · Recentes · A–Z · Domínio | Album order · Newest · A to Z · Best known | `ui/journal.ts` (chapter) | Sort buttons | |
| 537 | Mostrar o que falta | Show the empty slots | `ui/journal.ts` (chapter) | Checkbox | |
| 538 | {n} de {total} | words found | `ui/journal.ts` (chapter) | Counter over the stickers | |
| 539 | Nenhuma palavra com isso. · Nada aqui ainda. | No word in this chapter matches · Nothing here yet: go and find some! | `ui/journal.ts` (chapter) |  | |
| 540 | Nova! | (tag) | `ui/journal.ts` (sticker) | On a sticker earned since the last visit | |
| 541 | Ouvir | Listen | `ui/journal.ts` (word card) | Button | |
| 542 | Ainda não encontrada | Not found yet | `ui/journal.ts` (word card) |  | |
| 543 | Você domina esta palavra! | You have mastered this word | `ui/journal.ts` (word card) |  | |
| 544 | A Escola quer revisar esta hoje. | The Escola wants to review it today | `ui/journal.ts` (word card) |  | |
| 545 | Estude na Escola da Praça para fixar. | Study it at the Escola to make it stick | `ui/journal.ts` (word card) |  | |
| 546 | Continue estudando na Escola. | Keep studying it at the Escola | `ui/journal.ts` (word card) |  | |
| 547 | {n} foto · {n} fotos · {n} filme · {n} filmes | shots left · Júlia sells film | `ui/journal.ts` (Fotos) |  | |
| 548 | Nenhuma foto ainda. | No photos yet: open the camera and click something in the world | `ui/journal.ts` (Fotos) |  | |
| 549 | Ver figurinha | See the sticker | `ui/journal.ts` (photo card) | Button | |
| 550 | Início | Overview | `ui/journal.ts` (tabs) | First index tab | |

## W. Bate-papos and the #229 wording sweep

<a id="w-papos"></a>
The bate-papos replace the graded Conversa (sections D, E and P are gone from the game). Every line and chip of each bate-papo is in
`packages/shared/src/papos.ts`; review the whole tree of each one (row = one bate-papo).

| # | PT | EN | Where | Note | OK? |
|---|---|---|---|---|---|
| 551 | Bate-papo · Bater papo · Vamos bater um papo? | Chat · Have a chat · Shall we have a chat? | `ui/papo.ts`, `ui/padariaCounter.ts`, `ui/npcTalk.ts` | Starting a bate-papo | |
| 552 | Acordar cedo | Getting up early | `papos.ts` carlos.cedo | Seu Carlos | |
| 553 | Café ou suco? | Coffee or juice? | `papos.ts` carlos.cafe | Seu Carlos; ends on the counter line "Pra viagem, então…" | |
| 554 | A história da padaria | The bakery’s story | `papos.ts` carlos.historia | 4 ♥ story; invented fact: his father came from the Northeast | |
| 555 | A noite na padaria | Night at the bakery | `papos.ts` graca.noite | Dona Graça | |
| 556 | Bolo de fubá | Cornmeal cake | `papos.ts` graca.bolo | Dona Graça | |
| 557 | A cantora da madrugada | The late-night singer | `papos.ts` graca.historia | 4 ♥ story; invented fact: she sang in a choir | |
| 558 | Sol e chapéu | Sun and hats | `papos.ts` nanda.sol | Nanda | |
| 559 | A fonte da praça | The fountain in the square | `papos.ts` nanda.fonte | Nanda | |
| 560 | O primeiro chapéu | The first hat | `papos.ts` nanda.historia | 4 ♥ story; invented fact: her mother was a seamstress | |
| 561 | O bairro | The neighborhood | `papos.ts` julia.bairro | Júlia | |
| 562 | Por que Vila Ipê? | Why Vila Ipê? | `papos.ts` julia.ipe | Júlia; invented fact: the ipês bloom at the end of winter | |
| 563 | Quando a Júlia chegou | When Júlia arrived | `papos.ts` julia.historia | 4 ♥ story; invented fact: she came from a small town | |
| 564 | O treino | Training | `papos.ts` prof.treino | Professora Bia | |
| 565 | As faixas | The belts | `papos.ts` prof.faixa | Professora Bia | |
| 566 | Por que o jiu-jitsu | Why jiu-jitsu | `papos.ts` prof.historia | 4 ♥ story | |
| 567 | Conta a própria história pra você · 4 ♥ conta a própria história | Tells you their own story | `bonds.ts`, `ui/recados.ts` | The 4-heart milestone | |
| 568 | {nome} quer te contar uma história: “{título}”. Vá bater um papo! | {name} wants to tell you a story… Go have a chat! | `apps/server/src/recados.ts` | 4-heart notice | |
| 569 | Bate-papo na praça | A chat in the square (praça) | `cartela.ts` | Stamp label (was Conversa na praça) | |
| 570 | Favores · Favor: {título} · {nome} quer te pedir um favor! | Favors · Favor · {name} has a favor to ask you! | `ui/recados.ts`, `ui/recadoView.ts`, server `recados.ts` | Recados renamed Favores (ids unchanged) | |
| 571 | Preços em reais virtuais (RV). | Prices in reais virtuais (RV), the game’s play money | `ui/dom.ts` (`rvPriceNote`) | First price in each shop | |
| 572 | FEIRA DE RUA · Feira de rua: todo dia, 6h às 13h | Street market | `hotspots.ts`, `rooms.ts`, banner art | Was feira livre | |
| 573 | Faça uns favores pros vizinhos e jogue a “Correria no Balcão” na padaria. | Do favors for the neighbours… | `juliaTalk.ts` | Spoken; was "recados" | |
| 574 | Preço · Pagar | Price · Pay | `ui/feira.ts` | One tap pays the exact price (no coin counting) | |

## X. Praia: the beach, fishing, boats and the party boat (#239)

<a id="x-praia"></a>
Everything new the Praia says (PRAIA-PLAN.md §0: Brazilian Portuguese only, litoral paulista, never Rio). The plan called this section W;
W was taken by the bate-papos, so it is X. Rows that list several strings are one family (a talk tree, a word list); answer by row and
item. Spoken lines are baked (`pnpm tts`), so a wording change needs a re-bake.

| # | PT | EN | Where | Note | OK? |
|---|---|---|---|---|---|
| 575 | Praia · Praia do Jerivá | Beach · Jerivá Beach | `rooms.ts`, `hotspots.ts` | Invented place: a beach on the litoral paulista (Santos/Guarujá feel) | |
| 576 | ÔNIBUS · Linha 875 · Centro · Aeroporto · Praia · Ônibus para a Praia · Ônibus para a Vila | BUS · Line 875… · Bus to the beach · Bus to the Vila | `hotspots.ts`, `rooms.ts` portals | The bus sign at both stops | |
| 577 | A praia ainda não abriu. · A praia fechou por agora. O ônibus te trouxe de volta. | The beach is not open yet. · The beach has closed for now. The bus brought you back. | `praia.ts`, server `world.ts` | The admin switch | |
| 578 | Prévia da Praia: entre antes de todo mundo quando uma prévia estiver aberta. | Beach preview: get in before everyone when a preview is open. | `ui/support.ts` | Supporter perk row | |
| 579 | PRAIA DO JERIVÁ / Litoral paulista · PÍER / Barcos de aluguel na ponta · PERIGO / Correnteza forte. Não nade aqui. · PROIBIDO PESCAR AQUI / Pesque na beira do mar. · ALUGUEL DE BARCOS / Fale com o Seu Bento. | The signs | `hotspots.ts` | “Proibido pescar aqui” stands by the lifeguard: a joke | |
| 580 | CHURRASCO · REFRI · MÚSICA | BARBECUE · SODA · MUSIC | `hotspots.ts` (party deck) | No alcohol anywhere (§0) | |
| 581 | Seu Bento · Aluguel de barcos; idle: Barco bom é barco que volta. · Hoje o mar tá manso. · Quer ir mais longe? Aluga o de alto-mar. · A maré não dorme, e eu também não. | Boat rental; idle lines | `rooms.ts` | Spoken (bento) | |
| 582 | Dona Neide · Pescadora; idle: Peixe grande gosta de quem tem paciência. · Segura firme, solta quando ele corre. · De manhãzinha o robalo tá acordado. · Chuva fina, peixe bobo. | Fisherwoman; idle lines | `rooms.ts` | Spoken (neide) | |
| 583 | Jô · Barraca da praia; idle: Água de coco geladinha! · Queijo coalho na brasa, meu bem! · Compro peixe fresco! Traz pra cá! · Fechando a barraca, mas o gelo fica. | Beach kiosk; idle lines | `rooms.ts` | Spoken (jo); she calls everyone “meu bem” | |
| 584 | {saudacao}! Eu sou o Bento. Esses barcos aí são todos meus. · Quanto custa alugar? · Qual é o melhor barco? · E o barco de festa? · O barquinho a remo é baratinho. Os outros custam mais. Quer ver? · Pra começar, o barquinho a remo. Pra peixe grande, o de alto-mar. · Esse é pra ir com os amigos. Música, churrasco e muita pescaria. · Quero ver os barcos. · Quero alugar um barco. · Tchau, Seu Bento! | Bento’s talk tree | `npcTalk.ts` bento | | |
| 585 | {saudacao}, {nome}. Senta aí. Já pescou hoje? · Como é que pesca? · Segura pra lançar, e solta. · Quando a boia afunda, é Fisgou! Toca rápido. · Puxa segurando. Ele corre? Solta um pouco. · E depois? · Onde tem peixe grande? · Na lagoa tem tucunaré. No alto-mar tem marlim. Mas cada um no seu dia. · Minha caderneta de pesca · Tchau, Dona Neide! | Neide’s talk tree | `npcTalk.ts` neide | Teaches lançar, fisgar, puxar | |
| 586 | {saudacao}, meu bem! Vai um coco? · Vou querer um lanche. · Quer comprar peixe? · Tem chapéu aí? · Só olhando, {obrigad}! · Quero sim! Mostra o balde. · Tá aqui! · Depois eu volto. | Jô’s talk tree | `npcTalk.ts` jo | | |
| 587 | Tá alugado. Volta antes da maré virar! · RV insuficiente, viu? Pesca na praia e vende pra Jô. · O barco voltou. Como foi lá fora? | Bento at the shack | `pescaLines.ts` BENTO_LINES | Spoken (bento) | |
| 588 | Arrebentou. Da próxima, solta quando ele correr. · Olha isso! Esse vai pro recorde. · Baiacu não se come, se devolve. | Neide’s one-time coaching | `pescaLines.ts` NEIDE_COACH | Spoken (neide) | |
| 589 | Peixe bom! Toma aqui. · Hoje já comprei o que dava. Amanhã tem mais. · Balde vazio, meu bem. Vai pescar! · Compro peixe · Vender · Vender tudo · devolve | Jô buys fish | `pescaLines.ts` JO_SELL, `ui/pesca/index.ts` | Spoken (jo) | |
| 590 | Segura… solta! · Ih, enrolou! · Fisgou! · Cedo demais! · Escapou… · Arrebentou a linha! · Pegou! · Ih, um baiacu! · Volta pro mar, baiacu! · Novo! · Recorde! · Ele corre! Solta! · Puxa! · Boa pescaria! · Toque pra lançar de novo | The fishing stage | `pescaLines.ts` PESCA_STAGE, `pescaStage.ts` | Spoken (ui); never a number on the stage | |
| 591 | pequeno · médio · grande · enorme | small · medium · big · huge | `fish.ts` SIZE_WORDS | The size of a catch, as a word | |
| 592 | um chinelo · uma lata · uma alga · uma garrafa com mensagem | a flip-flop · a can · some seaweed · a message in a bottle | `fish.ts` JUNK | Gag catches | |
| 593 | bagre, sardinha, baiacu, tainha, robalo, corvina, pargo, garoupa, dourado-do-mar, atum, marlim-azul, tilápia, tambaqui, tucunaré | the 14 fish | `fish.ts`, `diary-words.json` | Species words; check the common names used in SP | |
| 594 | anzol, isca, vara, linha, boia, maré · lagoa, água doce, margem, caniço · remo, remar, barquinho, colete, enseada · proa, convés, âncora, pescador, mar aberto · alto-mar, onda, profundo, horizonte, bússola, recorde · capitão, tripulação, convidado, festa, pôr do sol, garrafa com mensagem | The six per-water word lists | `diary-words.json` games `pesca.*` | Earned by fishing moments (§4.3) | |
| 595 | castelo de areia, concha, canoa, gaivota, salva-vidas, barco, cadeira de praia, pegadas, costão, rede de pesca · praia, píer, milho verde, perigo, proibido, aluguel, churrasco · lançar, fisgar, puxar | Camera, reading and heard words | `diary-words.json` | | |
| 596 | Praia · na praia · Pesque na praia · Pesque na lagoa · Pesque no barquinho a remo · Pesque no barco de pesca · Pesque no barco de alto-mar · Pesque no barco de festa · Pesque em: … | Diário chapter and Escola hints | `escola.ts`, `journalView.ts` | | |
| 597 | Pesca na praia · Pesca na lagoa · Barquinho a remo · Barco de pesca · Barco de alto-mar · Barco de festa · Robalo e tainha · em breve | The waters and tiers | `ui/pesca/index.ts`, `pesca.ts` BOATS, `barcoMenu.ts` | Bento’s chips name the new fish in words | |
| 598 | Qual barco vai ser hoje? · Seu barco está lá no píer. Quer devolver? · Devolver o barco · Agora não · O tempo do barco acabou. Ele voltou pro Bento. · Esse barco é de aluguel. Fale com o Seu Bento. · Você já está com um barco. Devolva antes. · Os barcos do Bento ficam no galpão. | Rentals | `barcoMenu.ts`, server `barco.ts`, `pesca.ts` | | |
| 599 | Caderneta de pesca · Recorde: 42 cm · Pescado N vezes | Fishing log | `ui/pesca/index.ts`, `journalView.ts` | The record is the one number of the feature (§4.2) | |
| 600 | Queijo coalho · Milho verde · Picolé · Chapéu de pescador · Viseira de praia · Boné de surfe · Cadeira de praia · Conchinha | Jô’s snacks, rack and kitnet items | `streetSnacks.ts`, `catalog.ts` | Sinks, priced in RV | |
| 601 | Chapéu de capitão · Concha gigante · Rede de pesca · Garrafa com mensagem · Boia salva-vidas · Prancha de surfe | Earned items | `catalog.ts` | Never sold | |
| 602 | Bora pro barco de festa? · {nome} te chamou pro barco de festa. · Aceitar · Agora não | The party invite | `pescaLines.ts` PARTY_LINES, `ui/pesca/party.ts` | Spoken (ui), the name is shown, not spoken | |
| 603 | Barco de festa · N a bordo · quase acabando · Desembarcar · Encerrar a festa? Todo mundo volta pro píer. · Encerrar · Continuar a festa | The HUD pill and the host’s confirm | `ui/pesca/party.ts` | Time left as words, never a countdown | |
| 604 | O barco voltou pro píer. · A bordo · Peixes · Palavras da festa · Você ganhou · Nenhum peixe dessa vez. A festa valeu mesmo assim! · {nome} pescou: {peixe}! | The trip card and the aboard toast | `ui/pesca/party.ts` | | |
| 605 | Convidar pro barco · Desembarcar (profile card) · Você desembarcou no píer. | Friends panel, the host’s remove | `panels.ts`, server `partyBoat.ts` | Neutral notice to the guest only | |
| 606 | Pescaria · Segura pra lançar, solta. Fisgou? Toca. Segura pra puxar, solta quando ele corre. | Fishing · Hold to cast, let go. Bite? Tap. Hold to reel, let go when it runs. | `howToPlayData.ts` pesca | The "?" card on the stage; it never opens by itself (the first cast teaches) | |
| 606 | Convite enviado para {nome}. · {nome} não respondeu. · Só dá pra chamar amigos. · {nome} não está online. · {nome} já está a bordo. · {nome} já está em outro barco. · {nome} está ocupado agora. · Esse convite já passou. · Você já está num barco de festa. · Termine o que está fazendo primeiro. · Alugue o barco de festa primeiro. · O barco de festa ainda não está saindo. · O barco de festa sai do píer do Bento. · Esse barco é de outra turma. · O barco está lotado! | Party boat notices and errors | server `partyBoat.ts` | “ocupado” is masculine for every pronoun today | |
| 607 | Quem lê isso, me manda um “oi” da praia! · Hoje o mar estava calmo e eu estava feliz. · Se você achou esta garrafa, faça um pedido. · Aprendi uma palavra nova hoje: saudade. · O pôr do sol daqui é o mais bonito do mundo. · Não esqueça o protetor solar! · Um dia eu volto pra essa praia. · Peixe grande gosta de gente paciente. · Boa sorte na pescaria, amigo! · Obrigado por ler até aqui. Tenha um bom dia! | The ten bottle messages | `pescaLines.ts` BOTTLE_MESSAGES | Spoken (ui); no names, no contact details | |

## Y. Pet Shop do Seu Dito (#234)

<a id="y-petshop"></a>
The pet shop on Rua dos Ipês (leste): Seu Dito (Benedito Alves, 62, from a sítio in Minas), his talk tree and idle lines (`npcTalk.ts`,
`rooms.ts`), his pen and panel lines (`petShop.ts` `PEN_LINES`, `PETSHOP_LINES`), the breed catalog (`petBreeds.ts`), the lojinha
(`petShop.ts` `PET_ITEMS`), the signs (`hotspots.ts`), the panel (`ui/petShop.ts`) and the Pet Shop chapter of the Diário
(`diary-words.json`, area `petshop`). Everything Seu Dito says is spoken (voice `dito`). **needs_br.**

| # | PT | EN | Where | Note | OK? |
|---|---|---|---|---|---|
| 608 | {saudacao}, {nome}! Bem-vindo ao pet shop. Quer ver os bichinhos? | {greeting}, {name}! Welcome to the pet shop. Want to see the little animals? | `npcTalk.ts` dito.oi | "pet shop" as Brazilians say it; teaches bichinho | |
| 609 | Tem cachorro e gato esperando um lar. Pode fazer carinho, eles adoram. | There are dogs and cats waiting for a home. You can pet them, they love it. | dito.bichos | teaches lar | |
| 610 | Vamos ver quem tá esperando um lar! Escolhe com calma, viu? | Let's see who's waiting for a home! Choose calmly, okay? | dito.adotar | teaches escolher (match escolhe) | |
| 611 | Tem ração, brinquedo, coleira e caminha. Tudo com reais virtuais, {nome}. | There's food, toys, collars and beds. All with virtual reais, {name}. | dito.loja | | |
| 612 | O banho e tosa é ali no canto. O bichinho sai cheiroso! | The bath and grooming is over in the corner. The little one comes out smelling great! | dito.tosa | teaches cheiroso | |
| 613 | Quero ver os bichinhos. · O que tem na loja? · Posso adotar um? · Vou fazer carinho. · Quero ver! · Deixa eu pensar. · Quero ver a lojinha. · E banho e tosa? · Que legal! · {obrigad}, Seu Dito. | (player chips) | dito talk tree | | |
| 614 | Hoje chegou um filhote novo! · Carinho atrás da orelha, eles adoram. · Senta! Isso. Bom menino. · Vira-lata é o cachorro mais fiel que existe. | (idle lines) | `rooms.ts` DITO.idleLines | teach filhote, orelha, senta, vira-lata | |
| 615 | Olha o rabo abanando! Ele gostou de você. | Look at the tail wagging! He liked you. | `petShop.ts` pen_dog_1 | said when you pet a dog; teaches rabo | |
| 616 | Essa aqui adora carinho na barriga. | This one loves a belly rub. | pen_dog_2 | teaches carinho | |
| 617 | Olha esse focinho molhado! Ele quer te dar um beijo. | Look at that wet snout! He wants to give you a kiss. | pen_dog_3 | teaches focinho (nariz is the airplane's word); was "lambe o nariz" in the plan | |
| 618 | Tá ouvindo? Ele tá ronronando. | Hear that? He's purring. | pen_cat_1 | teaches ronronar | |
| 619 | Olha o bigode dela, todo arrepiado. | Look at her whiskers, all bristled. | pen_cat_2 | teaches bigode | |
| 620 | Esse gato brinca com tudo. Até com o rabo! | This cat plays with everything. Even its tail! | pen_cat_3 | teaches brincar | |
| 621 | Esse aqui? Boa escolha. Agora é só dar um nome. · Parabéns! Agora faz parte da família. · Seis já é uma matilha! Deixa um em casa primeiro. | (adoption lines) | `PETSHOP_LINES` | spoken from the panel | |
| 622 | Adoção é pra quem apoia a Vila. Mas carinho é de graça, viu? | Adoption is for those who support the Vila. But petting is free, okay? | `PETSHOP_LINES.gate` | the only supporter copy left in the panel: shown and spoken in the meet view of a non-supporter, instead of the "good choice" line | |
| 623 | Prontinho. Seu bichinho vai adorar. · Faltam uns reais virtuais ainda. Volta depois, sem pressa. · Vai passear? Leva a guia! · Deixa em casa que eu sei que ele fica bem. | (shop and switch lines) | `PETSHOP_LINES` | | |
| 624 | PET SHOP · Do Seu Dito | | `hotspots.ts` petshop_letreiro | facade sign; teaches pet shop | |
| 625 | ADOÇÃO · Adote um amigo | Adoption · Adopt a friend | petshop_adocao | teaches adoção | |
| 626 | RAÇAS · Vira-lata · Fila brasileiro · Poodle · Siamês · Persa | Breeds | petshop_racas | teaches raça | |
| 627 | VETERINÁRIO · Terça e quinta | Vet · Tuesday and Thursday | petshop_vet | teaches veterinário | |
| 628 | BANHO E TOSA | Bath and grooming | petshop_banho_tosa | teaches banho e tosa (one phrase) | |
| 629 | RAÇÃO · PETISCO · BRINQUEDO | Pet food · Treats · Toys | petshop_lojinha | teaches petisco | |
| 630 | cachorro · gatinho · cercadinho · arranhador · aquário · peixe · caminha · brinquedo · bolinha · ossinho · pelúcia · prateleira de ração · banheira · secador · toalhinha · pata | (camera words) | `diary-words.json` petshop | toalhinha because toalha is the kitnet's | |
| 631 | Pet Shop · no pet shop | Pet shop · at the pet shop | diary area, `escola.ts` AREA_IN | chapter name | |
| 632 | Faça carinho nos bichinhos do pet shop. | Pet the animals at the pet shop. | `escola.ts` huntHint | hint when only pen words are missing | |
| 633 | The 38 breed names (Vira-lata caramelo, Fila brasileiro, Terrier brasileiro (Fox Paulistinha), Gato vira-lata (SRD), Frajola, Gata escaminha…) and their coat names | | `petBreeds.ts` | each breed's `pt`, each coat's `pt` | |
| 634 | Coleira vermelha · azul · verde · rosa · Bandana do Brasil · Bolinha · Ratinho de pano · Ossinho · Pelúcia · Caminha xadrez · Caminha azul · Cesta de vime · Saco de ração + pote | (lojinha items) | `PET_ITEMS` | | |
| 635 | Adotar · Meus pets · Lojinha · Na loja hoje · Catálogo de raças · Fazer carinho · Levar · Em casa · Renomear · Comprar · Sem nome · Passeando | (panel) | `ui/petShop.ts` | | |
| 636 | Adoção é pra apoiadores · Apoiadores adotam até 6 bichinhos, levam um pra passear e o resto fica em casa, na kitnet. | Adoption is for supporters… | removed: the inline Apoiar card left the panel (SIMPLIFICATION-REVIEW C4) | | |
| 637 | Nenhum pet ainda. Os bichinhos estão esperando no Pet Shop do Seu Dito. | No pets yet… | `ui/petShop.ts` Meus pets (the lapsed-pets note left the panel; the kitnet card keeps its own) | | |
| 638 | Caminhas e o saco de ração vão pra sua kitnet. Coleiras e brinquedos você põe no bichinho em Meus pets. | Beds and the food bag go to your kitnet… | `ui/petShop.ts` Lojinha | | |
| 639 | Comandos: senta · deita · vem · busca · brinca | sit · lie down · come · fetch · play | `PET_COMMANDS` | now the five lines of the Pet Shop "?" card (`howToPlayData.ts`), no longer in Meus pets | |
| 640 | {nome} quer passear? · Seu bichinho · Fechar | Does {name} want a walk? | `ui/petShop.ts` kitnet card | | |
| 641 | Mais raças no Pet Shop do Seu Dito, na Rua dos Ipês. · Meus pets ({n}) | More breeds at Seu Dito's pet shop… | `ui/support.ts` | Apoiar panel | |
| 642 | A lojinha fica no Pet Shop do Seu Dito. · Chegue mais perto do balcão. · Chegue mais perto do cercadinho. · Você já tem esse. · Esse item não serve pra esse bichinho. · Adote um no Pet Shop do Seu Dito. | (server errors) | `apps/server/src/petShop.ts`, `world.ts` | | |

## Z. Chat hints

<a id="z-chat-hints"></a>
The hint under the chat input while typing (`packages/shared/src/safety.ts` `CHAT_HINTS`, shown by `ui/hud.ts`). It replaces "Vai com aviso", "Vai pra revisão" and "Não pode"; the moderation wording is gone from the player's path. An escalated message (held, queued, unchanged) shows the same line as a block, and `ESCALATE_NOTE` and the `ethnic_review` note now read as it does.

| # | PT | EN | Where | Notes | BR |
|---|---|---|---|---|---|
| 643 | Vai, mas com cuidado | It sends, but go easy | `CHAT_HINTS.warn` | message goes out; was "Vai com aviso" | |
| 644 | Essa não dá, tenta de outro jeito | Not that one, try another way | `CHAT_HINTS.block` | block and escalate; was "Não pode" / "Vai pra revisão"; also `ESCALATE_NOTE` | |

## AA. Tatame staging

<a id="aa-tatame-staging"></a>
The staged first matches on the mat (2026-10-10, `docs/lifesim/TATAME-V3.md` "Staging"): the lobby shows the suggested partner and folds
the others, and the first match with the defense pad has its own coach notes. Read on screen, never spoken (no TTS). The pad match's
other two notes reuse existing lines ("Ele vai atacar! Toque a defesa que a Bia falar." and the end-card tip "Contra o final, toque Sai!
sem parar, rápido."). **needs_br.**

| # | PT | EN | Where | Note | OK? |
| --- | --- | --- | --- | --- | --- |
| 645 | Mais parceiros | More partners | `apps/client/src/ui/bout.ts` lobby | the fold that reveals the other partners | |
| 646 | Agora ele também ataca. O aviso diz o que vem. | Now they attack too. The warning says what is coming. | `apps/client/src/ui/boutLogic.ts` `PAD_COACH_NOTES.pick` | coach note at the first pick of the first match with the defense pad (wins 3) | |

## Totals

646 numbered strings in sections A to Q, S, T, U, V, W, X, Y, Z and AA, plus 9 proposed-card entries.
