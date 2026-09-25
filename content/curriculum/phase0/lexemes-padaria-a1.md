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
