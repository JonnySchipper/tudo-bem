#!/usr/bin/env node
/**
 * Prebake Carlos (pt-BR-AntonioNeural) and UI/parrot (pt-BR-FranciscaNeural) lines.
 * No paid TTS. Re-run: node scripts/bake-tts.mjs
 * Requires /workspace/venvs/tts (edge-tts). Skips files already on disk unless --force.
 */
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TTS = process.env.EDGE_TTS ?? '/workspace/venvs/tts/bin/edge-tts';
const AUDIO_DIR = path.join(ROOT, 'apps/client/public/audio/tts');
const MANIFEST = path.join(ROOT, 'apps/client/src/audio/manifest.json');
const FORCE = process.argv.includes('--force');
const VOICES = { carlos: 'pt-BR-AntonioNeural', ui: 'pt-BR-FranciscaNeural' };

/** Fixed Seu Carlos lines (scene, kinship, common orders, Conversa, tray praise). */
const CARLOS = [
  'Bom dia! Tudo bem?',
  'Aqui a gente fala português, tá? Devagarinho: Bom… dia! Tudo… bem?',
  'Pois não. O que vai ser hoje?',
  'Sem pressa.',
  'Sem pressa. Tem pão na chapa, coxinha e pastel quentinho.',
  'Sem pressa, meu filho. Tem pão na chapa, coxinha e pastel quentinho.',
  'Sem pressa, minha filha. Tem pão na chapa, coxinha e pastel quentinho.',
  'Tá bom, meu filho.',
  'Tá bom, minha filha.',
  'Pão na chapa? Coxinha? Pastel? Fala assim: “Me vê um pão na chapa, por favor.”',
  'Café puro ou café com leite? Fala: “Um café com leite, por favor.”',
  'Pronto. Pra comer aqui ou pra viagem?',
  '“To go” é “pra viagem”. E “for here” é “pra comer aqui”.',
  '“Por conta da casa” quer dizer que você não paga nada. É de graça!',
  'Tá na mão. Volte sempre! Quer ajudar no balcão? É o “Me vê um…”.',
  'Tá na mão, meu filho. Volte sempre! Quer ajudar no balcão? É o “Me vê um…”.',
  'Tá na mão, minha filha. Volte sempre! Quer ajudar no balcão? É o “Me vê um…”.',
  'Isso aí! Um pão na chapa saindo. E pra beber? Café com leite, suco de laranja ou água?',
  'Isso aí! Uma coxinha saindo. E pra beber? Café com leite, suco de laranja ou água?',
  'Isso aí! Um pastel saindo. E pra beber? Café com leite, suco de laranja ou água?',
  'Isso aí! Seu pedido saindo. E pra beber? Café com leite, suco de laranja ou água?',
  'Isso aí! Um café com leite saindo. E pra comer? Pão na chapa, coxinha ou pastel?',
  'Isso aí! Um café saindo. E pra comer? Pão na chapa, coxinha ou pastel?',
  'Isso aí! Um suco de laranja saindo. E pra comer? Pão na chapa, coxinha ou pastel?',
  'Isso aí! Uma água saindo. E pra comer? Pão na chapa, coxinha ou pastel?',
  'Isso aí! Seu pedido saindo. E pra comer? Pão na chapa, coxinha ou pastel?',
  ...['três', 'quatro', 'cinco', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis'].map(
    (w, i) => `Deu ${w} reais (R$ ${[3, 4, 5, 8, 9, 10, 11, 12, 13, 14, 15, 16][i]})… Mas hoje é por conta da casa!`,
  ),
  'Bom dia! O que vai ser hoje?',
  'Bom dia! O que posso servir?',
  'E aí, tudo bem? Vai querer o quê?',
  'Pronto. O que posso servir?',
  'Deixa eu anotar — o que vai ser?',
  'Tá com fome? Me fala o pedido.',
  'Oi! Café da manhã pra você?',
  'Oi, beleza?',
  'E aí, tudo bem?',
  'Pão na chapa saindo! E pra beber?',
  'Pão na chapa, anotei. Quer café, suco ou água?',
  'Isso aí, pão na chapa. Deixa eu anotar. E pra beber?',
  'Uma coxinha quentinha! E pra beber?',
  'Coxinha, boa. Deixa eu anotar. E pra beber?',
  'Pastel de carne ou queijo? E pra beber?',
  'Pastel, anotei. Carne ou queijo — e pra beber?',
  'Café com leite saindo! Pra comer aqui ou pra viagem?',
  'Café com leite, tá na mão. Pra comer aqui ou pra viagem?',
  'Anotei o café com leite. Aqui ou pra viagem?',
  'Suco de laranja fresquinho! Pra comer aqui ou pra viagem?',
  'Suco de laranja, anotei. Aqui ou pra viagem?',
  'Uma água geladinha! Pra comer aqui ou pra viagem?',
  'Água, tá na mão. Pra comer aqui ou pra viagem?',
  'Pronto! Tá na mão. Volte sempre!',
  'Tá na mão. Pode sentar. Volte sempre!',
  'Pra viagem, então. Tá na mão. Volte sempre!',
  'Volte sempre!',
  'Volte sempre! Até amanhã.',
  'Bom dia! Tudo bem? O que vai ser hoje?',
  'Bom dia! Beleza? Me conta o que vai ser.',
  'Bom dia! E aí, o que vai querer?',
  'Não entendi bem. O que você quer pedir?',
  'Hmm. Mais alguma coisa?',
  'Quer mais alguma coisa?',
  'Deixa eu anotar. O que mais?',
  'Isso mesmo! Cliente feliz!',
  'Que rapidez! Tá pegando o jeito!',
  'Agora sim! Muito bem.',
  // Conta stamps. Passou is the Art alternate for Mandou bem! — both stay prebaked.
  'Mandou bem!',
  'Passou',
  'Quase!',
  'Tenta de novo',
  'Opa, não é bem isso. Vou repetir devagar…',
  'Tudo bem, acontece! Próximo cliente.',
  'Ih, o cliente cansou de esperar! Próximo.',
  ...Array.from({ length: 13 }, (_, i) => `Valeu pela ajuda! Aqui estão ${i + 8} reais virtuais.`),
];

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

const cards = loadJson('content/curriculum/phase0/cards.json');
const orders = loadJson('content/curriculum/phase0/me-ve-um-orders.json');
const UI = [...cards.cards.map((c) => c.form), ...orders.orders.map((o) => o.pt)];

function idFor(voice, text) {
  return `${voice}-${crypto.createHash('sha1').update(text).digest('hex').slice(0, 10)}`;
}

function synth(voice, text, file) {
  return new Promise((resolve, reject) => {
    const child = spawn(TTS, ['--voice', voice, '--text', text, '--write-media', file], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => (err += d));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${voice} failed (${code}): ${err.slice(0, 400)}`))));
  });
}

async function pool(jobs, n) {
  const q = [...jobs];
  const workers = Array.from({ length: n }, async () => {
    while (q.length) {
      const job = q.shift();
      await job();
    }
  });
  await Promise.all(workers);
}

const lines = [];
const seen = new Set();
for (const [voice, texts] of [
  ['ui', UI],
  ['carlos', CARLOS],
]) {
  for (const text of texts) {
    const key = text.replace(/\s+/g, ' ').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const id = idFor(voice, key);
    lines.push({ id, voice, text: key, file: `${id}.mp3` });
  }
}

fs.mkdirSync(AUDIO_DIR, { recursive: true });
const jobs = [];
let skipped = 0;
for (const line of lines) {
  const dest = path.join(AUDIO_DIR, line.file);
  if (!FORCE && fs.existsSync(dest) && fs.statSync(dest).size > 400) {
    skipped++;
    continue;
  }
  jobs.push(async () => {
    const tmp = `${dest}.part`;
    await synth(VOICES[line.voice], line.text, tmp);
    fs.renameSync(tmp, dest);
    process.stdout.write(`  ${line.voice} ${line.file}\n`);
  });
}

console.log(`Baking ${jobs.length} clips (${skipped} already on disk) → ${path.relative(ROOT, AUDIO_DIR)}`);
await pool(jobs, 5);

const keep = new Set(lines.map((l) => l.file));
for (const name of fs.readdirSync(AUDIO_DIR)) {
  if (name.endsWith('.mp3') && !keep.has(name)) fs.unlinkSync(path.join(AUDIO_DIR, name));
}

const manifest = { version: 1, voices: VOICES, lines };
fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
const carlosN = lines.filter((l) => l.voice === 'carlos').length;
const uiN = lines.filter((l) => l.voice === 'ui').length;
console.log(`Manifest ${carlosN} Carlos + ${uiN} UI → ${path.relative(ROOT, MANIFEST)}`);
