import { SCENE_NODE_IDS, viewNode, type SceneCtx } from './carlos.js';
import { PAPOS } from './papos.js';
import { GOODS, OFF_DUTY, VENDORS, moneyPt, priceLine, resultLine, totalLine, type StallVendorId, type VendorId } from './feira.js';
import { NPC_TALK, fillTalk } from './npcTalk.js';
import { challengeBank, finishBank } from './challenges.js';
import { HOTSPOTS } from './hotspots.js';
import { CARDS } from './cards.js';
import { AUTHORED_ORDERS } from './meveum.js';
import { JULIA_INTRO, JULIA_INTRO_FROM_GREETING, JULIA_TREE } from './juliaTalk.js';
import { localizeGreetingText } from './clock.js';
import { DIARY_WORDS } from './diary.js';
import { luciaSpokenLines } from './escolaCopy.js';
import { airportSpokenLines } from './airportTalk.js';
import { flightSpokenLines } from './flightTalk.js';
import { ROOMS, type NpcId } from './rooms.js';
import { correriaSpokenLines } from './correriaSpeech.js';
import { PEN_LINES, PETSHOP_LINES, PET_COMMANDS } from './petShop.js';

/**
 * Every Portuguese line the game speaks aloud, found by walking the game's own data. The bake script (`pnpm tts`) turns this list into
 * neural clips, and a test fails when new dialogue appears that has no clip. So: write dialogue where the game already keeps it
 * (npcTalk, feira, juliaTalk, hotspots, challenges, carlos…) and run `pnpm tts`; nothing needs registering by hand.
 *
 * A line is spoken by a `speaker` (see content/voices.json for the cast). Lines the player's name would sit in are spoken without it
 * (`spokenNameless`): the name stays on screen, the clip is shared by every player.
 */
/** `comandante`: the captain over the PA in the flight-in cutscene (a voice, not an NPC in the world). */
export type SpeakerId = NpcId | 'parrot' | 'ui' | 'comandante';

export interface SpokenLine {
  speaker: SpeakerId;
  text: string;
  /** Where it was found, for the missing-clip report. */
  source: string;
}

/** Seu Carlos by day, Dona Graça on the night shift: the same authored counter scene, two voices. */
const COUNTER_BAKERS = ['carlos', 'graca'] as const;

/** The three greetings by game minute (bom dia / boa tarde / boa noite). */
const MINUTES = [600, 900, 1200];

/** Prices are spoken as words ("R$ 3,50" -> "três reais e cinquenta centavos"); lines are sentences. */
export const spokenHotspot = (pt: string): string =>
  pt
    .replace(/R\$\s?(\d+)(?:,(\d{2}))?/g, (_m, r: string, c?: string) => moneyPt(Number(r) * 100 + (c ? Number(c) : 0)))
    .split('\n')
    .join('. ');

/** A card form can list variants ("oi / olá"): the first is what is spoken. */
export const spokenForm = (form: string): string => form.split('/')[0]!.trim();

/** What a talk line sounds like while the NPC does not use the name (", {nome}" dropped). */
export const spokenNameless = (text: string, ctx: { pronoun?: string; minute?: number } = {}): string => fillTalk(text, { name: '', ...ctx });

export function collectSpokenLines(): SpokenLine[] {
  const out: SpokenLine[] = [];
  const add = (speaker: SpeakerId, text: string | undefined, source: string) => {
    const t = (text ?? '').replace(/\s+/g, ' ').trim();
    if (t) out.push({ speaker, text: t, source });
  };

  // short authored greetings (Nanda, Júlia, Graça, the professora…): every hour x both pronouns
  for (const [npc, talk] of Object.entries(NPC_TALK)) {
    for (const [id, node] of Object.entries(talk!.nodes)) {
      for (const minute of MINUTES) for (const pronoun of ['ele', 'ela']) add(npc as NpcId, spokenNameless(node.line.pt, { minute, pronoun }), `npcTalk ${npc}.${id}`);
    }
  }

  // Pet Shop do Seu Dito (#234): his panel lines, what he says when you pet an animal, and the pet commands of the cheat sheet
  for (const [id, l] of Object.entries(PETSHOP_LINES)) add('dito', l.pt, `petshop ${id}`);
  for (const [id, l] of Object.entries(PEN_LINES)) add('dito', l.pt, `petshop ${id}`);
  for (const c of PET_COMMANDS) add('ui', c.pt, `petshop command ${c.pt}`);

  // Júlia's guide
  for (const minute of MINUTES) add('julia', spokenNameless(JULIA_INTRO.pt, { minute }), 'juliaTalk intro');
  add('julia', JULIA_INTRO_FROM_GREETING.pt, 'juliaTalk intro');
  JULIA_TREE.forEach((j, i) => add('julia', j.a.pt, `juliaTalk answer ${i}`));

  // the feira: greeting by the hour, prices, totals, change
  for (const [id, v] of Object.entries(VENDORS) as [VendorId, (typeof VENDORS)[VendorId]][]) {
    for (const minute of MINUTES) add(v.npc, localizeGreetingText(v.greet.pt, minute), `feira ${id} greet`);
    add(v.npc, v.closed.pt, `feira ${id} closed`);
  }
  // the vendors away from their stall (small talk, and when the feira is back)
  for (const [npc, t] of Object.entries(OFF_DUTY) as [StallVendorId, (typeof OFF_DUTY)[StallVendorId]][]) {
    t.lines.forEach((l, i) => add(npc, l.pt, `feira ${npc} off duty ${i}`));
    add(npc, t.buy.pt, `feira ${npc} off duty buy`);
  }
  for (const g of GOODS) {
    const speakers = new Set<NpcId>(Object.values(VENDORS).filter((v) => v.goods.includes(g.itemId)).map((v) => v.npc));
    for (const sp of speakers) {
      add(sp, priceLine(g.itemId).pt, `feira price ${g.itemId}`);
      for (const q of g.qtys) add(sp, totalLine(g.itemId, q).pt, `feira total ${g.itemId} x${q}`);
    }
  }
  const verdictCents = Array.from({ length: 40 }, (_, i) => (i + 1) * 50); // R$ 0,50 … R$ 20,00 (the biggest coin)
  for (const npc of ['tia_lu', 'ze', 'chico', 'rosa'] as const) {
    const fem = VENDORS[npc].fem;
    add(npc, resultLine({ kind: 'exact' }, 1, fem).pt, `feira ${npc} exact`);
    add(npc, resultLine({ kind: 'short', missing: 0 }, 0, fem).pt, `feira ${npc} unpaid`);
    for (const c of verdictCents) {
      add(npc, resultLine({ kind: 'change', change: c }, c, fem).pt, `feira ${npc} change`);
      add(npc, resultLine({ kind: 'short', missing: c }, c, fem).pt, `feira ${npc} short`);
    }
  }

  // Seu Carlos' scene: every node under every name form, order, hour and kinship
  for (const nodeId of SCENE_NODE_IDS) {
    for (const pronoun of ['nome', 'ele', 'ela'] as const)
      for (const minute of MINUTES)
        for (const kinUsed of [false, true])
          for (const food of [undefined, 'pao_na_chapa', 'coxinha', 'pastel'])
            for (const drink of [undefined, 'cafe_com_leite', 'cafe', 'suco_de_laranja', 'agua'])
              for (const where of [undefined, 'aqui', 'viagem'] as const) {
                const ctx: SceneCtx = { name: '', pronoun, minute, kinUsed, food, drink, where };
                for (const baker of COUNTER_BAKERS) add(baker, viewNode(nodeId, ctx)?.line.pt, `counter scene ${nodeId}`);
              }
  }
  // the bate-papos (pre-made conversations): every NPC line, every hour x both pronouns, without the name
  for (const papo of PAPOS) {
    for (const [id, node] of Object.entries(papo.nodes)) {
      for (const minute of MINUTES) for (const pronoun of ['ele', 'ela']) add(papo.npc, spokenNameless(node.line.pt, { minute, pronoun }), `papo ${papo.id}.${id}`);
    }
  }

  // signs, menus and posters read with 🔊 Ouvir
  for (const hs of HOTSPOTS) add('ui', spokenHotspot(hs.pt), `hotspot ${hs.id}`);

  // words in the Caderno / from the parrot, and the Me vê um… tray orders
  for (const c of CARDS) {
    add('ui', c.form, `card ${c.id}`);
    add('ui', spokenForm(c.form), `card ${c.id}`);
  }
  for (const o of AUTHORED_ORDERS) add('ui', o.pt, 'me-ve-um order');

  // the bakery counter: fixed lines whole, assembled ones (orders, corrections, prices) as short phrases
  for (const l of correriaSpokenLines()) add('ui', l.text, l.source);

  // listening drills
  for (const item of [...challengeBank(), ...finishBank()]) add('ui', item.listenPt, `challenge ${item.id}`);

  // every diary word (the escola plays it on each reveal, the Caderno on 🔊), and Dona Lúcia at her desk
  for (const w of DIARY_WORDS) add('ui', w.pt, `diary ${w.id}`);
  for (const text of luciaSpokenLines()) add('lucia', text, 'escola lucia');

  // the airport staff (Célia, Agente Paulo), and the line a click-to-talk opens with (an unheard idle line, greeting by the hour)
  for (const l of airportSpokenLines()) add(l.speaker, l.text, `airport ${l.speaker}`);
  // the flight in (the new-account cutscene): Lia in the cabin, the captain over the PA
  for (const l of flightSpokenLines()) add(l.speaker, l.text, `flight ${l.speaker}`);
  for (const room of Object.values(ROOMS))
    for (const npc of room.npcs) npc.idleLines.forEach((l, i) => MINUTES.forEach((minute) => add(npc.id, localizeGreetingText(l.pt, minute), `idle ${npc.id}.idle${i}`)));

  return out;
}
