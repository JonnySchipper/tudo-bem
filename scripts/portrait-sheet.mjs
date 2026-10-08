#!/usr/bin/env node
/**
 * Portrait contact sheet: per NPC, the in-world sprite (south idle frame, nearest-neighbour 4x), the four new portraits (2x, as the
 * dialogue box shows them) and the old portraits from git (2x) for comparison.
 *
 *   pnpm pixel && node scripts/portrait-sheet.mjs [out.png] [--old=<git ref>]
 *
 * The sprite is composed with the game's own look code (assets-src/custom/lookkit.mjs), the new portraits are read from public/pixel.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { charLayers, npcSheet, sheetFrame } from '../apps/client/assets-src/custom/lookkit.mjs';
import { EXPRESSIONS, NPCS } from '../apps/client/assets-src/custom/portraits.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const OUT = path.resolve(args.find((a) => !a.startsWith('--')) ?? path.join(ROOT, 'docs/lifesim/shots/portraits/contact-sheet.png'));
const OLD_REF = args.find((a) => a.startsWith('--old='))?.slice(6) ?? 'main';
const PIX = path.join(ROOT, 'apps/client/public/pixel');
const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const ids = only ?? NPCS;

const NAMES = { carlos: 'Seu Carlos', nanda: 'Nanda', julia: 'Júlia', graca: 'Dona Graça', tia_lu: 'Tia Lu', prof: 'Professora Bia', ze: 'Seu Zé', chico: 'Chico', rosa: 'Dona Rosa', lucia: 'Dona Lúcia', celia: 'Célia', agente: 'Agente Paulo' };
const PAD = 16, LABEL = 22, SPRITE_W = 64, PORT = 128, GAP = 10;
const colX = { sprite: PAD + 150, new: PAD + 150 + SPRITE_W + 3 * GAP };
colX.old = colX.new + 4 * (PORT + GAP) + 3 * GAP;
const W = colX.old + 4 * (PORT + GAP) + PAD;
const ROW_H = Math.max(PORT, 128) + GAP * 2;
const H = PAD + LABEL + ids.length * ROW_H + PAD;

const layers = await charLayers();
const comps = [];
const texts = [];
const nn = (buf, w, h) => sharp(buf).resize(w, h, { kernel: 'nearest' }).png().toBuffer();
const oldPng = (id, e) => {
  try {
    return execFileSync('git', ['show', `${OLD_REF}:apps/client/public/pixel/portraits/${id}_${e}.png`], { cwd: ROOT, maxBuffer: 1 << 20, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
};

texts.push([colX.sprite, PAD + 14, 'sprite (4x)'], [colX.new, PAD + 14, `new portrait (2x): ${EXPRESSIONS.join(' · ')}`], [colX.old, PAD + 14, `old portrait (${OLD_REF}, 2x)`]);
for (const [r, id] of ids.entries()) {
  const y = PAD + LABEL + r * ROW_H + GAP;
  texts.push([PAD, y + 60, NAMES[id] ?? id], [PAD, y + 80, id, true]);
  const sh = await npcSheet(id, layers);
  const f = sheetFrame(sh, 0, 0);
  const raw = await sharp(Buffer.from(f.data), { raw: { width: f.w, height: f.h, channels: 4 } }).png().toBuffer();
  comps.push({ input: await nn(raw, SPRITE_W, 128), left: colX.sprite, top: y });
  for (const [i, e] of EXPRESSIONS.entries()) {
    const file = path.join(PIX, `portraits/${id}_${e}.png`);
    if (fs.existsSync(file)) comps.push({ input: await nn(fs.readFileSync(file), PORT, PORT), left: colX.new + i * (PORT + GAP), top: y });
    const old = oldPng(id, e);
    if (old) comps.push({ input: await nn(old, PORT, PORT), left: colX.old + i * (PORT + GAP), top: y });
  }
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${texts
  .map(([x, y, t, small]) => `<text x="${x}" y="${y}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${small ? 12 : 15}" font-weight="${small ? 'normal' : 'bold'}" fill="${small ? '#9aa0b4' : '#f1ede4'}">${esc(t)}</text>`)
  .join('')}</svg>`;
comps.push({ input: Buffer.from(svg), left: 0, top: 0 });
fs.mkdirSync(path.dirname(OUT), { recursive: true });
await sharp({ create: { width: W, height: H, channels: 4, background: '#2b2b3a' } }).composite(comps).png({ compressionLevel: 9 }).toFile(OUT);
console.log('wrote', path.relative(ROOT, OUT), `${W}x${H}`);
