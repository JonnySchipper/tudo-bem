#!/usr/bin/env node
/**
 * Parse the curriculum pack markdown (canonical, owned by TB Curriculum) into cards.json
 * (engineering schema, GDD §5.5).   pnpm content
 *
 * The markdown stays the source of truth; packages/shared/src/curriculum.test.ts fails if
 * cards.json drifts from it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'content/curriculum/phase0');

const split = (v, sep) =>
  v
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);

/** "valeu (score 2 + optional strengthen)" → accept "valeu" + curriculum note kept alongside. */
function acceptsOf(items) {
  const accepts = [];
  const accept_notes = {};
  for (const it of items) {
    const m = it.match(/^(.*?)\s*\((.+)\)$/);
    const text = (m ? m[1] : it).trim();
    if (!text) continue;
    accepts.push(text);
    if (m) accept_notes[text] = m[2].trim();
  }
  return Object.keys(accept_notes).length ? { accepts, accept_notes } : { accepts };
}

/** Parse `### lex.x.y` sections and the numbers table. */
export function parseLexemes(md, source) {
  const cards = [];
  const sections = md.split(/^### /m).slice(1);
  for (const sec of sections) {
    const lines = sec.split('\n');
    const id = lines[0].trim();
    if (!id.startsWith('lex.')) continue;
    const f = {};
    for (const l of lines.slice(1)) {
      const m = l.match(/^- \*\*([^:*]+):\*\*\s*(.*?)\s*$/);
      if (m) f[m[1].trim()] = m[2].trim();
    }
    if (f['alias of']) continue;
    const tagField = f['pos/tags'] ?? f.tags ?? '';
    const tagList = split(tagField, ';');
    const hasPos = 'pos/tags' in f;
    cards.push({
      id,
      form: f.form,
      pos: hasPos ? tagList[0] : 'phrase',
      tags: hasPos ? tagList.slice(1) : tagList,
      gloss_en: f.gloss_en,
      patterns: f.patterns ? split(f.patterns, ' / ') : [],
      ...acceptsOf([...(f.accepts ? split(f.accepts, ';') : []), ...(f['reply accepts'] ? split(f['reply accepts'], ';') : [])]),
      wrongs: f.wrongs ? split(f.wrongs, ';') : [],
      prereq: f.prereq ? split(f.prereq, ';') : [],
      places: f.places ? split(f.places, ',') : [],
      ...(f.note || f.rule || f['channels focus'] ? { note: [f.note, f.rule, f['channels focus'] && `channels: ${f['channels focus']}`].filter(Boolean).join(' · ') } : {}),
      source,
      signoff: 'needs_br',
    });
  }
  for (const row of md.matchAll(/^\| (lex\.num\.\d+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm)) {
    const [, id, form, gloss, extra] = row;
    cards.push({
      id,
      form: form.trim(),
      pos: 'number',
      tags: ['number', 'A1'],
      gloss_en: gloss.trim(),
      patterns: [],
      ...acceptsOf([...split(form, '/'), ...split(extra, ';')]),
      wrongs: [],
      prereq: [],
      places: ['*'],
      source,
      signoff: 'needs_br',
    });
  }
  return cards;
}

/**
 * Engineering-only fields the markdown doesn't carry (plural/gender for tray agreement) and
 * cards the game already used that are NOT in the curriculum pack (flagged for review).
 */
const NOUN = {
  'lex.padaria.pao': { plural: 'pães', gender: 'm', gloss_en_plural: 'bread rolls', gloss_en_tray: 'bread roll' },
  'lex.padaria.pao_na_chapa': { plural: 'pães na chapa', gender: 'm', gloss_en_plural: 'grilled buttered breads' },
  'lex.padaria.cafe': { plural: 'cafés', gender: 'm', gloss_en_plural: 'coffees' },
  'lex.padaria.cafe_com_leite': { plural: 'cafés com leite', gender: 'm', gloss_en_plural: 'coffees with milk' },
  'lex.padaria.suco_de_laranja': { plural: 'sucos de laranja', gender: 'm', gloss_en_plural: 'orange juices' },
  'lex.padaria.agua': { plural: 'águas', gender: 'f', gloss_en_plural: 'waters' },
  'lex.padaria.paozinho': { plural: 'pãezinhos', gender: 'm', gloss_en_plural: 'little rolls' },
  'lex.padaria.bolo': { plural: 'bolos', gender: 'm', gloss_en_plural: 'cakes', gloss_en_tray: 'slice of cake' },
  'lex.padaria.pastel': { plural: 'pastéis', gender: 'm', gloss_en_plural: 'fried pastries' },
  'lex.padaria.coxinha': { plural: 'coxinhas', gender: 'f', gloss_en_plural: 'chicken croquettes' },
};

const SEEDS = [
  {
    id: 'lex.padaria.pao_de_queijo', form: 'pão de queijo', plural: 'pães de queijo', gender: 'm', pos: 'noun phrase', tags: ['food', 'padaria', 'A1'],
    gloss_en: 'cheese bread', gloss_en_plural: 'cheese breads', patterns: ['Me vê um pão de queijo, por favor.'], accepts: ['pao de queijo', 'um pao de queijo'],
    wrongs: ['pão de queso'], prereq: ['lex.padaria.pao'], places: ['padaria', 'lanchonete'],
  },
  {
    id: 'lex.padaria.misto_quente', form: 'misto-quente', plural: 'mistos-quentes', gender: 'm', pos: 'noun phrase', tags: ['food', 'padaria', 'A1'],
    gloss_en: 'grilled ham & cheese', gloss_en_plural: 'grilled ham & cheeses', patterns: ['Me vê um misto-quente.'], accepts: ['misto quente', 'um misto quente'],
    wrongs: [], prereq: [], places: ['padaria', 'lanchonete'],
  },
  {
    id: 'lex.padaria.guarana', form: 'guaraná', plural: 'guaranás', gender: 'm', pos: 'noun', tags: ['drink', 'padaria', 'A1', 'brand-culture'],
    gloss_en: 'guaraná soda', gloss_en_plural: 'guaraná sodas', patterns: ['Um guaraná, por favor.'], accepts: ['guarana', 'um guarana'],
    wrongs: [], prereq: [], places: ['padaria', 'lanchonete'], note: 'constitution.md lists guaraná as allowed drink culture',
  },
  {
    id: 'lex.padaria.pois_nao', form: 'Pois não.', pos: 'phrase', tags: ['NPC', 'padaria', 'A1', 'ack'],
    gloss_en: 'Yes? / How can I help? (service acknowledgement)', patterns: ['Pois não. O que vai ser hoje?'], accepts: ['pois nao'],
    wrongs: [], prereq: [], places: ['padaria'], note: 'Carlos primary ack per voice-seu-carlos.md (CEO lock); listen/read focus',
  },
  {
    id: 'lex.padaria.por_conta_da_casa', form: 'por conta da casa', pos: 'phrase', tags: ['padaria', 'A1'],
    gloss_en: 'on the house', patterns: ['Hoje é por conta da casa!'], accepts: ['por conta da casa'], wrongs: [], prereq: [], places: ['padaria'],
  },
  {
    id: 'lex.padaria.ta_na_mao', form: 'Tá na mão.', pos: 'phrase', tags: ['NPC', 'padaria', 'A1', 'praise'],
    gloss_en: 'Here you go. (lit. “it’s in your hand”)', patterns: ['Tá na mão!'], accepts: ['ta na mao'], wrongs: [], prereq: [], places: ['padaria'],
    note: 'Carlos praise per voice-seu-carlos.md; no lexeme card in pack yet',
  },
].map((c) => ({ ...c, source: 'engineering-seed', signoff: 'needs_curriculum_and_br' }));

export function buildCards() {
  const padaria = parseLexemes(fs.readFileSync(path.join(dir, 'lexemes-padaria-a1.md'), 'utf8'), 'lexemes-padaria-a1.md');
  const social = parseLexemes(fs.readFileSync(path.join(dir, 'lexemes-greetings-numbers-a1.md'), 'utf8'), 'lexemes-greetings-numbers-a1.md');
  const cards = [...padaria, ...social].map((c) => ({ ...c, ...(NOUN[c.id] ?? {}) }));
  return {
    _meta: {
      generatedBy: 'scripts/build-curriculum.mjs from lexemes-*.md (markdown is canonical — edit it, then `pnpm content`)',
      status: 'DRAFT — every card needs Brazilian human sign-off before default-path (signoff field)',
      counts: { pack: cards.length, engineering_seed: SEEDS.length },
    },
    cards: [...cards, ...SEEDS],
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = buildCards();
  fs.writeFileSync(path.join(dir, 'cards.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(`✓ cards.json — ${out._meta.counts.pack} pack cards + ${out._meta.counts.engineering_seed} engineering seeds (flagged)`);
}
