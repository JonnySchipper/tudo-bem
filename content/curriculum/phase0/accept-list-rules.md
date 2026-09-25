> **Status:** DRAFT — needs BR sign-off before default-path.

# Accept-list rules (DRAFT)

Used by Jev / typed scoring for Phase 0 padaria scene + Me vê um…. Engineering owns schema; curriculum owns the lists.

## Global forgiveness (always on for Verde/Amarelo typed answers)
1. **Accents optional:** pao ≡ pão, cafe ≡ café, voce ≡ você, tambem ≡ também
2. **Case insensitive**
3. **Trailing punctuation ignored:** `! ? . , …`
4. **Extra spaces collapsed**
5. **Final -o/-a gender for self-reference:** obrigado ≡ obrigada (both accept when intent is thanks)
6. **Articles flexible when not the teaching target:** um pão na chapa ≡ pão na chapa (if card target is the food NP)
7. **Diminutives not required:** pãozinho accepted as bonus synonym only where listed; never required for 3/3

## Me vê construction
Accept near-equivalents when the scene teaches the speech act, not the exact string:
- Me vê um…
- Me dá um… (accept + soft strengthen toward me vê in padaria context)
- Quero um… (accept at score 2 if items correct; chip nudge to me vê)
- Um …, por favor (accept)

Reject as English-only or off-intent:
- Pure English orders (“two breads and a coffee”)
- Rude bare imperatives without softener when chips offered por favor (score 1 → rephrase)

## Numbers (tray / counts)
- Digits OK: `2` ≡ dois
- Gendered forms: dois pães / duas águas when noun gender is cued
- Accent-flexible: tres ≡ três

## Coffee & milk phrases
Accept: café com leite, cafe com leite, um café com leite  
Common wrongs (hint, don’t shame): coffee with milk; café con leche; leite com café (reorder hint)

## Never auto-accept
- Items on do-not-teach
- EU defaults as “correct” (telemóvel, autocarro, pequeno-almoço)
- Slur variants

## Scoring map (reminder)
- 3 = intent + form OK + target used  
- 2 = intent OK, form fuzzy → small coins + hint  
- 1 = NPC rephrases slower  
- 0 = chips only, smile, no shame
