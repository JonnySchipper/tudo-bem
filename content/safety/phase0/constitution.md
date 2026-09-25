# Tudo Bem — Safety Constitution (Phase 0)

Applies **everywhere**: public chat, private/party chat (when present), NPC dialogue generation, furniture names/descriptions, store copy, quest text, emotes with text.

Authority: CEO + GDD v1.0. Implementers: treat this as hard product law. Prefer allow normal conversation; false-block on Brazilian slang is a regression.

---

## Banned everywhere

### 1. Alcohol / bars / drunkenness

| Ban | Detail |
|-----|--------|
| Alcoholic drinks | `cerveja`, beer, whiskey, vodka, wine, cachaça, shots, etc. **Never.** |
| Drinking venues | Bars, botecos framed as drinking spots, nightclubs-as-bars |
| Drunkenness | bêbado/bêbada, hungover, “borracho”, tipsy roleplay |

**Rewrite map (NPC / world / store):**

| Instead of | Use |
|------------|-----|
| boteco (drinking) | **lanchonete** |
| cerveja / beer | **guaraná**, **suco**, **água**, **café** |
| bar stool / round of drinks | pastel + suco, café com pão |

**Allowed:** guaraná (soft drink brand/culture), suco, refrigerante, café, chá, água, pastel, coxinha, pão de queijo — food culture without alcohol framing.

### 2. Flirting / dating / sensuality / body comments

- Pickup lines, dating asks, “you’re hot / gostosa / gostoso”, body rating
- Romance quests, sensual NPC tone, “DM me”, crush confessions as gameplay
- Age-ambiguous “boyfriend/girlfriend” roleplay aimed at players

Learning-friendly compliments on **language effort** are OK (“seu português está melhor!”). Compliments on **body / attractiveness** are not.

### 3. Profanity, slurs, political campaigning, religious argument

- Slurs and hate speech (race, ethnicity, nationality, gender, sexuality, disability, religion-as-attack) — **block**
- Mild-to-strong profanity in this family product — **block** (see slur list)
- Political campaigning, candidate recruitment, party slogans in-world — **block**
- Religious argument / proselytizing / mockery — **block**

Neutral geographic or cultural facts in lessons (e.g. “Brasília is the capital”) are fine. Campaigning is not.

### 4. PII / off-platform contact

- Phone numbers, emails, home/school addresses, real full names used as contact bait
- Discord / WhatsApp / Telegram / Instagram / Snap / TikTok handles for meeting off-platform
- “Add me on…”, invite links, QR contact

Client regex runs first; Jev reinforces. Under-13 (future) is stricter — even joking channel names.

### 5. Scam / real-money trading

- Selling accounts, items, or currency for real money
- Phishing, fake giveaways, “send PIX / PayPal / crypto”
- Impersonating staff / Tudo Bem support for credentials

---

## Allowed PT slang (must not false-block)

These are everyday Brazilian Portuguese. Blocklists and Jev must allow:

`tá`, `ta`, `cara`, `legal`, `pra`, `a gente`, `né`, `pô` (mild; see allowlist note vs stronger forms), `obrigado` / `obrigada`, `blz`, `vlw`, `valeu`, `massa`, `show`, `beleza`, `ei`, `opa`, `fala`, `e aí`, `tmj`, `sss`, `kk` / `kkk` (laughter), ` Aff` (mild annoyance — Phase 0 allow unless stacked with insults)

See `blocklists/allowlist-pt-slang.json`. **False-block rate on this set is a KPI.**

---

## Surface matrix

| Surface | Alcohol | Flirting | Slurs/profanity | Politics/religion fight | PII / off-platform | RMT / scam |
|---------|---------|----------|-----------------|-------------------------|--------------------|------------|
| Player chat | block | block/warn | block | block | block | block |
| NPC dialogue | never emit | never emit | never emit | never emit | never emit | never emit |
| Furniture / store | never label | never | never | never | n/a | never |

---

## Escalation

Anything ambiguous after regex + blocklist + stub Jev → `escalate` (human queue later). Phase 0 stub: log, hide from public if toxic-score high, do not silently drop without metric.
