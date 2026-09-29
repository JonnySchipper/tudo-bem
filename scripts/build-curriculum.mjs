#!/usr/bin/env node
/**
 * Parse the curriculum pack markdown (canonical, owned by TB Curriculum) into cards.json
 * (engineering schema, GDD §5.5), me-ve-um-orders.json (tray tickets) and recados.json (errands).   pnpm content
 *
 * The markdown stays the source of truth; packages/shared/src/curriculum.test.ts fails if
 * either JSON file drifts from it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'content/curriculum/phase0');

/** Read markdown line-ending agnostic: a CRLF checkout (Windows autocrlf) must parse the same as LF. */
const readMd = (f) => fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r\n?/g, '\n');

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
  const padaria = parseLexemes(readMd('lexemes-padaria-a1.md'), 'lexemes-padaria-a1.md');
  const social = parseLexemes(readMd('lexemes-greetings-numbers-a1.md'), 'lexemes-greetings-numbers-a1.md');
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
  const md = readMd('me-ve-um-orders.md');
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

// ---------------------------------------------------------------- Praça ambiance CPU names

/** `**A–D:** Ana, André, …` lines under “## Names” in cpu-name-allowlist.md. */
export function buildCpuNames() {
  const md = readMd('cpu-name-allowlist.md');
  const section = md.split(/^## /m).find((s) => s.startsWith('Names'));
  if (!section) throw new Error('cpu-name-allowlist.md: missing “## Names” section');
  const names = [...section.matchAll(/^\*\*[^*]+:\*\*\s*(.+)$/gm)].flatMap((m) => split(m[1], ','));
  return {
    _meta: {
      generatedBy: 'scripts/build-curriculum.mjs from cpu-name-allowlist.md (markdown is canonical — edit it, then `pnpm content`)',
      status: 'DRAFT — needs BR sign-off. Praça ambiance CPUs only: first name on a Verde plate, no surnames, no CPU chat.',
    },
    names,
  };
}

// ---------------------------------------------------------------- Recados (errands)

/**
 * Ids the recado validator accepts. Mirrors the shared engine (packages/shared/src/rooms.ts, recados.ts,
 * meveum.ts); curriculum.test.ts fails if any list drifts from the code.
 */
export const RECADO_NPC_IDS = ['carlos', 'nanda', 'julia', 'graca', 'tia_lu'];
export const RECADO_ROOM_IDS = ['praca', 'padaria', 'kitnet', 'academia'];
export const RECADO_FLAG_IDS = ['feira', 'dialogue'];
export const RECADO_ITEM_IDS = [
  // the padaria shelf (meveum.ts SHELF)
  'pao', 'pao_na_chapa', 'pastel', 'coxinha', 'bolo', 'cafe', 'cafe_com_leite', 'suco_de_laranja', 'agua', 'pao_de_queijo', 'misto_quente', 'guarana',
  // recados.ts EXTRA_ITEMS
  'jornal', 'flores', 'banana',
];

/** `### id` blocks of `- **field:** value` lines, same shape as the lexeme cards. */
function recadoBlocks(md) {
  const out = [];
  for (const sec of md.split(/^### /m).slice(1)) {
    const lines = sec.split('\n');
    const id = lines[0].trim();
    const f = {};
    for (const l of lines.slice(1)) {
      const m = l.match(/^- \*\*([^:*]+):\*\*\s*(.*?)\s*$/);
      if (m) f[m[1].trim()] = m[2].trim();
    }
    out.push([id, f]);
  }
  return out;
}

/** One step, e.g. `pedir carlos cafe_com_leite 1`. Throws on anything the engine could not run. */
export function parseRecadoStep(text, where) {
  const fail = (why) => {
    throw new Error(`recados.md ${where}: step “${text}”: ${why}`);
  };
  const t = text.trim().split(/\s+/);
  const kind = t[0];
  const npc = (v) => (RECADO_NPC_IDS.includes(v) ? v : fail(`unknown NpcId “${v}”`));
  const item = (v) => (RECADO_ITEM_IDS.includes(v) ? v : fail(`unknown item id “${v}”`));
  const qty = (v) => {
    const n = v === undefined ? 1 : Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 20 ? n : fail(`bad quantity “${v}”`);
  };
  switch (kind) {
    case 'falar':
      if (t.length !== 2) fail('expected: falar <npc>');
      return { kind, npc: npc(t[1]) };
    case 'pedir':
    case 'entregar':
      if (t.length < 3 || t.length > 4) fail(`expected: ${kind} <npc> <item> [qty]`);
      return { kind, npc: npc(t[1]), itemId: item(t[2]), qty: qty(t[3]) };
    case 'ir':
      if (t.length !== 2) fail('expected: ir <room>');
      return { kind, room: RECADO_ROOM_IDS.includes(t[1]) ? t[1] : fail(`unknown room “${t[1]}”`) };
    case 'cumprimentar': {
      const rest = t.slice(1);
      const timeCorrect = rest.includes('timeCorrect');
      const who = rest.filter((x) => x !== 'timeCorrect');
      if (who.length > 1) fail('expected: cumprimentar [<npc>] [timeCorrect]');
      return { kind, ...(who.length ? { npc: npc(who[0]) } : {}), ...(timeCorrect ? { timeCorrect: true } : {}) };
    }
    default:
      return fail('unknown step kind (falar, pedir, entregar, ir, cumprimentar)');
  }
}

export function buildRecados(cards = buildCards().cards) {
  const cardIds = new Set(cards.map((c) => c.id));
  const recados = [];
  for (const [id, f] of recadoBlocks(readMd('recados.md'))) {
    const at = `### ${id}`;
    const need = (k) => {
      if (!f[k]) throw new Error(`recados.md ${at}: missing “${k}”`);
      return f[k];
    };
    if (!/^[a-z][a-z0-9_]*$/.test(id)) throw new Error(`recados.md ${at}: bad id`);
    if (recados.some((r) => r.id === id)) throw new Error(`recados.md ${at}: duplicate id`);
    const giver = need('giver');
    if (!RECADO_NPC_IDS.includes(giver)) throw new Error(`recados.md ${at}: unknown giver “${giver}”`);
    const minBond = Number(need('min_bond'));
    if (!Number.isInteger(minBond) || minBond < 0 || minBond > 100) throw new Error(`recados.md ${at}: bad min_bond`);
    const requires = f.requires;
    if (requires !== undefined && !RECADO_FLAG_IDS.includes(requires)) throw new Error(`recados.md ${at}: unknown requires “${requires}”`);
    if (f.needs_br !== 'true') throw new Error(`recados.md ${at}: every recado must say needs_br: true`);
    const steps = need('steps').split(';').map((s) => parseRecadoStep(s, at));
    const rw = need('reward').match(/^(\d+) RV; (\d+) bond(?:; item (\w+))?$/);
    if (!rw) throw new Error(`recados.md ${at}: reward must read “<n> RV; <n> bond[; item <id>]”`);
    if (rw[3] && !RECADO_ITEM_IDS.includes(rw[3])) throw new Error(`recados.md ${at}: unknown reward item “${rw[3]}”`);
    const cardList = split(need('cards'), ';');
    for (const c of cardList) if (!cardIds.has(c)) throw new Error(`recados.md ${at}: unknown card id “${c}” (do not invent cards; list proposals in the PR)`);
    recados.push({
      id,
      giver,
      minBond,
      ...(requires ? { requires } : {}),
      title: { pt: need('title_pt'), en: need('title_en') },
      ask: { pt: need('ask_pt'), en: need('ask_en') },
      thanks: { pt: need('thanks_pt'), en: need('thanks_en') },
      steps,
      reward: { rv: Number(rw[1]), bond: Number(rw[2]), ...(rw[3] ? { itemId: rw[3] } : {}) },
      cards: cardList,
      needs_br: true,
    });
  }
  if (!recados.length) throw new Error('recados.md: no recados found');
  return {
    _meta: {
      generatedBy: 'scripts/build-curriculum.mjs from recados.md (markdown is canonical — edit it, then `pnpm content`)',
      status: 'DRAFT — every recado needs BR sign-off (needs_br). Gated ones carry requires: feira | dialogue.',
    },
    recados,
  };
}

/** One recado per line keeps the file reviewable in diffs. */
function recadosJson(o) {
  const rows = o.recados.map((x) => `    ${JSON.stringify(x)}`).join(',\n');
  return `{\n  "_meta": ${JSON.stringify(o._meta, null, 2).replace(/\n/g, '\n  ')},\n  "recados": [\n${rows}\n  ]\n}\n`;
}

/** One entry per line keeps the ticket file reviewable in diffs. */
function ordersJson(o) {
  const rows = (arr) => arr.map((x) => `    ${JSON.stringify(x)}`).join(',\n');
  return `{\n  "_meta": ${JSON.stringify(o._meta, null, 2).replace(/\n/g, '\n  ')},\n  "mods": [\n${rows(o.mods)}\n  ],\n  "orders": [\n${rows(o.orders)}\n  ]\n}\n`;
}

// pathToFileURL, not `file://${argv[1]}`: on Windows argv[1] is `C:\...` and the naive compare never matched (`pnpm content` did nothing).
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const out = buildCards();
  fs.writeFileSync(path.join(dir, 'cards.json'), JSON.stringify(out, null, 1) + '\n');
  const orders = buildOrders(out.cards);
  fs.writeFileSync(path.join(dir, 'me-ve-um-orders.json'), ordersJson(orders));
  const recadosOut = buildRecados(out.cards);
  fs.writeFileSync(path.join(dir, 'recados.json'), recadosJson(recadosOut));
  const cpu = buildCpuNames();
  fs.writeFileSync(path.join(dir, 'cpu-names.json'), JSON.stringify(cpu, null, 1) + '\n');
  console.log(`✓ cpu-names.json — ${cpu.names.length} ambiance first names`);
  const pending = out.cards.filter((c) => c.signoff !== 'approved').length;
  console.log(`✓ cards.json — ${out._meta.counts.pack} pack cards (${pending} awaiting BR sign-off)`);
  console.log(`✓ recados.json — ${recadosOut.recados.length} recados (${recadosOut.recados.filter((r) => r.requires).length} gated by requires)`);
  console.log(`✓ me-ve-um-orders.json — ${orders.orders.length} tickets, ${orders.mods.length} modifiers`);
}
