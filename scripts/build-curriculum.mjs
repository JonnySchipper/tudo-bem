#!/usr/bin/env node
/**
 * Parse the curriculum pack markdown (canonical, owned by TB Curriculum) into cards.json
 * (engineering schema, GDD §5.5) and me-ve-um-orders.json (tray tickets).   pnpm content
 *
 * The markdown stays the source of truth; packages/shared/src/curriculum.test.ts fails if
 * either JSON file drifts from it.
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
    const [plural, gender] = f['plural / gender'] ? split(f['plural / gender'], ';') : [];
    const channels = f['channels focus'] ?? f.channels;
    const note = [f.note, f.rule, channels && `channels: ${channels}`].filter(Boolean).join(' · ');
    cards.push({
      id,
      form: f.form,
      ...(plural ? { plural } : {}),
      ...(gender ? { gender } : {}),
      pos: hasPos ? tagList[0] : 'phrase',
      tags: hasPos ? tagList.slice(1) : tagList,
      gloss_en: f.gloss_en,
      ...(f.gloss_en_tray ? { gloss_en_tray: f.gloss_en_tray } : {}),
      patterns: f.patterns ? split(f.patterns, ' / ') : [],
      ...acceptsOf([...(f.accepts ? split(f.accepts, ';') : []), ...(f['reply accepts'] ? split(f['reply accepts'], ';') : [])]),
      wrongs: f.wrongs ? split(f.wrongs, ';') : [],
      prereq: f.prereq ? split(f.prereq, ';') : [],
      places: f.places ? split(f.places, ',') : [],
      ...(note ? { note } : {}),
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
 * Engineering-only fields the markdown doesn't carry: plural/gender for tray agreement (where the
 * card has no `plural / gender` line) and plural EN glosses for generated combo tickets.
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
  'lex.padaria.pao_de_queijo': { gloss_en_plural: 'cheese breads' },
  'lex.padaria.misto_quente': { gloss_en_plural: 'ham & cheese toasties' },
  'lex.padaria.guarana': { gloss_en_plural: 'guaranás' },
};

export function buildCards() {
  const padaria = parseLexemes(fs.readFileSync(path.join(dir, 'lexemes-padaria-a1.md'), 'utf8'), 'lexemes-padaria-a1.md');
  const social = parseLexemes(fs.readFileSync(path.join(dir, 'lexemes-greetings-numbers-a1.md'), 'utf8'), 'lexemes-greetings-numbers-a1.md');
  const cards = [...padaria, ...social].map((c) => ({ ...c, ...(NOUN[c.id] ?? {}) }));
  return {
    _meta: {
      generatedBy: 'scripts/build-curriculum.mjs from lexemes-*.md (markdown is canonical — edit it, then `pnpm content`)',
      status: 'DRAFT — every card needs Brazilian human sign-off before default-path (signoff field)',
      counts: { pack: cards.length },
    },
    cards,
  };
}

// ---------------------------------------------------------------- Me vê um… tickets

/** Modifier toggles on the tray: pt/en come from the lexeme cards, the group is engineering. */
const MOD_GROUPS = { pra_viagem: 'where', pra_comer_aqui: 'where', sem_acucar: 'coffee', bem_quente: 'coffee' };
const COUNT = { um: 1, uma: 1, dois: 2, duas: 2, três: 3, quatro: 4, cinco: 5 };
const FILLER = ['me vê', 'por favor', 'bom dia'];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Structure one canonical PT ticket as tray lines + mods, using only card forms. Throws on any
 * word it can't place, so a ticket Curriculum adds that the shelf can't serve fails `pnpm content`.
 */
export function parseTicket(pt, items, mods) {
  let s = ` ${pt.toLowerCase().replace(/[.,!?;:]/g, ' ').replace(/\s+/g, ' ').trim()} `;
  const found = [];
  for (const m of [...mods].sort((a, b) => b.pt.length - a.pt.length)) {
    const at = s.indexOf(` ${m.pt} `);
    if (at < 0) continue;
    found.push([at, m.id]);
    s = s.replace(` ${m.pt} `, ' ');
  }
  for (const f of FILLER) s = s.replaceAll(` ${f} `, ' ');
  const forms = items.flatMap((i) => [[i.form, i.id], [i.plural, i.id]]).sort((a, b) => b[0].length - a[0].length);
  const byForm = new Map(forms.map(([f, id]) => [f, id]));
  const re = new RegExp(`(?<=\\s)(?:(${Object.keys(COUNT).join('|')})\\s+)?(${forms.map(([f]) => esc(f)).join('|')})(?=\\s)`, 'gu');
  const lines = [];
  for (const m of s.matchAll(re)) lines.push([byForm.get(m[2]), m[1] ? COUNT[m[1]] : 1]);
  const rest = s.replace(re, ' ').replace(/\s(e)(?=\s)/g, ' ').trim();
  if (rest || !lines.length) throw new Error(`me-ve-um-orders.md: can't structure “${pt}” (left over: “${rest}”)`);
  return { lines, mods: found.sort((a, b) => a[0] - b[0]).map(([, id]) => id) };
}

export function buildOrders(cards = buildCards().cards) {
  const md = fs.readFileSync(path.join(dir, 'me-ve-um-orders.md'), 'utf8');
  const padaria = cards.filter((c) => c.id.startsWith('lex.padaria.')).map((c) => ({ ...c, id: c.id.slice('lex.padaria.'.length) }));
  const items = padaria.filter((c) => c.plural);
  const mods = Object.entries(MOD_GROUPS).map(([id, group]) => {
    const card = padaria.find((c) => c.id === id);
    if (!card) throw new Error(`modifier without card: lex.padaria.${id}`);
    return { id, pt: card.form, en: card.gloss_en, group };
  });
  const orders = [];
  let level = null;
  for (const line of md.split('\n')) {
    if (/^## Level Verde/i.test(line)) level = 'verde';
    else if (/^## Level bump/i.test(line)) level = 'bump';
    else if (/^## /.test(line)) level = null;
    const row = level && line.match(/^\|\s*\d+\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/);
    if (row) orders.push({ level, pt: row[1], en: row[2], ...parseTicket(row[1], items, mods) });
  }
  return {
    _meta: {
      generatedBy: 'scripts/build-curriculum.mjs from me-ve-um-orders.md (markdown is canonical — edit it, then `pnpm content`)',
      status: 'DRAFT — needs BR sign-off before default-path. PT + EN ticket glosses by TB Curriculum (review 2026-09-25).',
      structure: "item ids = card ids minus 'lex.padaria.'; lines/mods are parsed from the PT using card forms + plurals.",
    },
    mods,
    orders,
  };
}

/** One entry per line keeps the ticket file reviewable in diffs. */
function ordersJson(o) {
  const rows = (arr) => arr.map((x) => `    ${JSON.stringify(x)}`).join(',\n');
  return `{\n  "_meta": ${JSON.stringify(o._meta, null, 2).replace(/\n/g, '\n  ')},\n  "mods": [\n${rows(o.mods)}\n  ],\n  "orders": [\n${rows(o.orders)}\n  ]\n}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = buildCards();
  fs.writeFileSync(path.join(dir, 'cards.json'), JSON.stringify(out, null, 1) + '\n');
  const orders = buildOrders(out.cards);
  fs.writeFileSync(path.join(dir, 'me-ve-um-orders.json'), ordersJson(orders));
  const pending = out.cards.filter((c) => c.signoff !== 'approved').length;
  console.log(`✓ cards.json — ${out._meta.counts.pack} pack cards (${pending} awaiting BR sign-off)`);
  console.log(`✓ me-ve-um-orders.json — ${orders.orders.length} tickets, ${orders.mods.length} modifiers`);
}
