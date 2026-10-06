> **Status:** DRAFT — needs BR sign-off before default-path.

# A1 Padaria lexemes — Phase 0 seed (DRAFT)

Schema fields per GDD §5.5. Audio TBD (pt-BR, two speakers). Status: draft → BR human sign-off.

Accent-flexible accepts follow `accept-list-rules.md`.

---

## Core food (Me vê um…)

### lex.padaria.pao_na_chapa
- **form:** pão na chapa  
- **pos/tags:** noun phrase; food; padaria; A1; geral  
- **gloss_en:** grilled buttered bread  
- **patterns:** Me vê um pão na chapa, por favor.  
- **accepts:** pao na chapa; um pao na chapa; me ve um pao na chapa; me vê um pão na chapa por favor  
- **wrongs:** bread on the grill (EN); pão com manteiga alone if scene cues na chapa; pan tostado (ES)  
- **prereq:** pão; por favor  
- **places:** padaria, lanchonete  

### lex.padaria.pao
- **form:** pão  
- **pos/tags:** noun; food; padaria; A1; masculine  
- **gloss_en:** bread  
- **patterns:** Quero pão. / Um pão, por favor.  
- **accepts:** pao; um pao; o pao  
- **wrongs:** bread; pan  
- **places:** padaria  

### lex.padaria.cafe_com_leite
- **form:** café com leite  
- **pos/tags:** noun phrase; drink; padaria; A1  
- **gloss_en:** coffee with milk  
- **patterns:** Me vê um café com leite.  
- **accepts:** cafe com leite; um cafe com leite; café c/ leite  
- **wrongs:** coffee with milk; latte (as sole answer); leite com café (reorder hint)  
- **prereq:** café  
- **places:** padaria  

### lex.padaria.cafe
- **form:** café  
- **pos/tags:** noun; drink; padaria; A1; masculine  
- **gloss_en:** coffee  
- **accepts:** cafe; um cafe  
- **wrongs:** coffee; cafézinho required (bonus only)  
- **places:** padaria  

### lex.padaria.suco_de_laranja
- **form:** suco de laranja  
- **pos/tags:** noun phrase; drink; padaria; A1  
- **gloss_en:** orange juice  
- **patterns:** Me vê um suco de laranja.  
- **accepts:** suco de laranja; um suco de laranja; suco laranja  
- **wrongs:** orange juice; jugo de naranja  
- **places:** padaria  

### lex.padaria.agua
- **form:** água  
- **pos/tags:** noun; drink; padaria; A1; feminine  
- **gloss_en:** water  
- **patterns:** Uma água, por favor.  
- **accepts:** agua; uma agua; um agua (tolerate + gender hint)  
- **wrongs:** water; aqua  
- **places:** padaria  

### lex.padaria.paozinho
- **form:** pãozinho  
- **pos/tags:** noun; food; padaria; A1; diminutive; bonus  
- **gloss_en:** little roll / soft bread  
- **accepts:** paozinho; um paozinho  
- **note:** bonus synonym; not required for 3/3 on pão cards  

### lex.padaria.bolo
- **form:** bolo  
- **pos/tags:** noun; food; padaria; A1; masculine  
- **gloss_en:** cake  
- **accepts:** bolo; um bolo  
- **wrongs:** cake; pastel (different item — keep distinct)  

### lex.padaria.pastel
- **form:** pastel  
- **pos/tags:** noun; food; padaria; A1; masculine  
- **gloss_en:** fried pastry (savory)  
- **accepts:** pastel; um pastel  
- **wrongs:** pastry alone; cake  

### lex.padaria.coxinha
- **form:** coxinha  
- **pos/tags:** noun; food; padaria; A1; feminine  
- **gloss_en:** chicken croquette  
- **accepts:** coxinha; uma coxinha  
- **wrongs:** chicken nugget as sole gloss target  

---

## Speech acts & modifiers

### lex.padaria.me_ve
- **form:** me vê  
- **pos/tags:** phrase; request; padaria; A1; paulista-friendly  
- **gloss_en:** I’ll take / get me (polite order)  
- **patterns:** Me vê um café, por favor.  
- **accepts:** me ve; me vê; me da (→ score 2 + nudge); quero (→ score 2 in padaria)  
- **wrongs:** give me (EN only)  

### lex.padaria.por_favor
- **form:** por favor  
- **pos/tags:** phrase; politeness; A1; geral  
- **gloss_en:** please  
- **accepts:** por favor; pf; porfavor  
- **wrongs:** please alone as full order  

### lex.padaria.pra_viagem
- **form:** pra viagem  
- **pos/tags:** phrase; modifier; padaria; A1  
- **gloss_en:** to go  
- **accepts:** pra viagem; para viagem; pra viagem por favor  
- **wrongs:** to go; para llevar  

### lex.padaria.pra_comer_aqui
- **form:** pra comer aqui  
- **pos/tags:** phrase; modifier; padaria; A1  
- **gloss_en:** for here  
- **accepts:** pra comer aqui; para comer aqui; pra comer aqui por favor  

### lex.padaria.bem_quente
- **form:** bem quente  
- **pos/tags:** phrase; modifier; padaria; A1  
- **gloss_en:** nice and hot  
- **accepts:** bem quente; bem quentinho (bonus)  

### lex.padaria.sem_acucar
- **form:** sem açúcar  
- **pos/tags:** phrase; modifier; padaria; A1  
- **gloss_en:** no sugar  
- **accepts:** sem acucar; sem açúcar; sem acúcar  
- **wrongs:** no sugar; sin azucar  

### lex.padaria.quentinho
- **form:** quentinho  
- **pos/tags:** adjective; padaria; A1; warm tone  
- **gloss_en:** nice and warm (diminutive)  
- **accepts:** quentinho; bem quentinho  

---

## Transaction glue

### lex.padaria.o_que_vai_ser
- **form:** O que vai ser?  
- **pos/tags:** phrase; NPC; padaria; A1; listen/read  
- **gloss_en:** What’ll it be?  
- **channels focus:** listen, read (player rarely produces)  

### lex.padaria.pronto
- **form:** Pronto.  
- **pos/tags:** interjection; padaria; A1  
- **gloss_en:** Ready / Here you go.  
- **accepts:** pronto  

### lex.padaria.pode_pegar
- **form:** Pode pegar.  
- **pos/tags:** phrase; padaria; A1  
- **gloss_en:** You can take it.  
- **accepts:** pode pegar  

### lex.padaria.volte_sempre
- **form:** Volte sempre.  
- **pos/tags:** phrase; padaria; A1; farewell  
- **gloss_en:** Come back anytime.  
- **accepts:** volte sempre  

### lex.padaria.isso_ai
- **form:** Isso aí.  
- **pos/tags:** phrase; praise; padaria; A1; paulista flavor  
- **gloss_en:** That’s it. / Nice.  
- **accepts:** isso ai; isso aí  

---

## Minigame order templates (audio+text)
Use scheduled cards; hide EN labels at higher levels later.

1. Me vê um pão na chapa.  
2. Me vê um café com leite.  
3. Dois pães na chapa e um café.  
4. Um suco de laranja, por favor.  
5. Uma água e um pastel.  
6. Me vê uma coxinha pra viagem.  
7. Café sem açúcar, bem quente.  
8. Dois pães e uma água.

## Coverage note
This is the Phase 0 **seed** (~25 cards), not the full 300 A1 deck. Next expand: more drinks, savory, numbers in tray combos, and Feira handoff in Phase 1.

---

## Engineering-seed cards — Curriculum review (2026-09-25)

Promoted from `cards.json` engineering-seed. Signoff after this review: **needs_br** only (curriculum accepted; BR human still required). Eng should re-run content build from markdown.

### lex.padaria.pao_de_queijo
- **form:** pão de queijo  
- **plural / gender:** pães de queijo; m  
- **pos/tags:** noun phrase; food; padaria; A1; geral  
- **gloss_en:** cheese bread (cassava cheese roll)  
- **gloss_en_tray:** cheese bread  
- **patterns:** Me vê um pão de queijo, por favor.  
- **accepts:** pao de queijo; um pao de queijo; pães de queijo; paes de queijo  
- **wrongs:** cheese bread (EN only); pão de queso (ES); pão com queijo (different item — nudge)  
- **prereq:** pão  
- **places:** padaria, lanchonete  
- **note:** Minas staple; common SP padaria shelf item. Distinct from pão na chapa.

### lex.padaria.misto_quente
- **form:** misto-quente  
- **plural / gender:** mistos-quentes; m  
- **pos/tags:** noun phrase; food; padaria; A1  
- **gloss_en:** grilled ham and cheese sandwich  
- **gloss_en_tray:** ham & cheese toastie  
- **patterns:** Me vê um misto-quente.  
- **accepts:** misto-quente; misto quente; um misto quente; um misto-quente  
- **wrongs:** grilled cheese (US-only as sole answer); sanduíche alone  
- **places:** padaria, lanchonete  
- **note:** Hyphen optional in accepts; prefer hyphenated form on cards/UI.

### lex.padaria.guarana
- **form:** guaraná  
- **plural / gender:** guaranás; m  
- **pos/tags:** noun; drink; padaria; A1; brand-culture  
- **gloss_en:** guaraná soda  
- **gloss_en_tray:** guaraná  
- **patterns:** Um guaraná, por favor. / Me vê um guaraná.  
- **accepts:** guarana; um guarana; guaraná; um guaraná  
- **wrongs:** soda alone; guarana energy drink as alcohol (never — soft drink only)  
- **places:** padaria, lanchonete  
- **note:** Allowed drink culture (not alcohol). Do not teach brand logos as required form.

### lex.padaria.pois_nao
- **form:** Pois não.  
- **pos/tags:** phrase; NPC; padaria; A1; ack  
- **gloss_en:** Yes? / Coming — how can I help?  
- **patterns:** Pois não. O que vai ser hoje?  
- **accepts:** pois nao; pois não  
- **wrongs:** pode falar as preferred target (CEO lock: Pois não is primary)  
- **places:** padaria  
- **channels:** listen/read (player rarely produces)  
- **note:** Carlos primary ack per voice-seu-carlos.md CEO lock 2026-09-25.

### lex.padaria.ta_na_mao
- **form:** Tá na mão.  
- **pos/tags:** phrase; NPC; padaria; A1; praise / handoff  
- **gloss_en:** Here you go. (friendly handoff)  
- **patterns:** Tá na mão!  
- **accepts:** ta na mao; tá na mão; esta na mao  
- **wrongs:** literal “it’s in the hand” as learner production target  
- **places:** padaria  
- **channels:** listen/read  
- **note:** Carlos praise / tray handoff; pairs with Pronto / Pode pegar.

### lex.padaria.por_conta_da_casa
- **form:** por conta da casa  
- **pos/tags:** phrase; padaria; A1; generosity beat  
- **gloss_en:** on the house  
- **patterns:** Hoje é por conta da casa!  
- **accepts:** por conta da casa; e por conta da casa  
- **wrongs:** free (EN only); por conta do bar (alcohol framing — never)  
- **places:** padaria  
- **note:** Optional reward line only; never implies alcohol tab. Family-safe.

## Player-owned padaria (Fundar room only)

### lex.padaria.brigadeiro
- **form:** brigadeiro
- **pos/tags:** noun; food; padaria; A1; doce
- **gloss_en:** chocolate truffle
- **patterns:** Me vê um brigadeiro, por favor.
- **accepts:** brigadeiro; um brigadeiro; me ve um brigadeiro
- **wrongs:** brownie
- **places:** padaria

### lex.padaria.bolo_de_cenoura
- **form:** bolo de cenoura
- **pos/tags:** noun phrase; food; padaria; A1; doce
- **gloss_en:** carrot cake
- **patterns:** Me vê um bolo de cenoura, por favor.
- **accepts:** bolo de cenoura; me ve um bolo de cenoura
- **wrongs:** carrot bread
- **places:** padaria

### lex.padaria.sonho
- **form:** sonho
- **pos/tags:** noun; food; padaria; A1; doce
- **gloss_en:** cream-filled doughnut
- **patterns:** Me vê um sonho, por favor.
- **accepts:** sonho; um sonho; me ve um sonho
- **wrongs:** dream
- **places:** padaria

### lex.padaria.prato_feito
- **form:** prato feito
- **pos/tags:** noun phrase; food; padaria; A1; restaurante
- **gloss_en:** daily plate lunch
- **patterns:** Me vê um prato feito, por favor.
- **accepts:** prato feito; me ve um prato feito
- **wrongs:** plate made
- **places:** padaria

### lex.padaria.arroz_feijao
- **form:** arroz e feijão
- **pos/tags:** noun phrase; food; padaria; A1; restaurante
- **gloss_en:** rice and beans
- **patterns:** Me vê arroz e feijão, por favor.
- **accepts:** arroz e feijao; me ve arroz e feijao
- **wrongs:** rice with beans
- **places:** padaria

### lex.padaria.bife_acebolado
- **form:** bife acebolado
- **pos/tags:** noun phrase; food; padaria; A1; restaurante
- **gloss_en:** steak with onions
- **patterns:** Me vê um bife acebolado, por favor.
- **accepts:** bife acebolado; me ve um bife acebolado
- **wrongs:** onion steak
- **places:** padaria

### lex.padaria.salada
- **form:** salada
- **pos/tags:** noun; food; padaria; A1; restaurante
- **gloss_en:** salad
- **patterns:** Me vê uma salada, por favor.
- **accepts:** salada; uma salada; me ve uma salada
- **wrongs:** lettuce
- **places:** padaria

### lex.padaria.feijoada
- **form:** feijoada
- **pos/tags:** noun; food; padaria; A1; restaurante
- **gloss_en:** black bean stew
- **patterns:** Me vê uma feijoada, por favor.
- **accepts:** feijoada; uma feijoada; me ve uma feijoada
- **wrongs:** bean stew
- **places:** padaria

### lex.padaria.pudim
- **form:** pudim
- **pos/tags:** noun; food; padaria; A1; restaurante
- **gloss_en:** flan
- **patterns:** Me vê um pudim, por favor.
- **accepts:** pudim; um pudim; me ve um pudim
- **wrongs:** pudding
- **places:** padaria
