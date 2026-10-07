/**
 * The airport tutorial's steps and rules, with no DOM (ui/airportTutorial.ts draws the checklist and runs the staff dialogues).
 * Needs_br: every Portuguese line here.
 */
import { diaryWord, greetingFor, normalizeDiary, type PrivateProfile, type Pronoun } from '@tudobem/shared';

/** A reply chip (the dialogue box's `BoxChip`). */
export interface Chip {
  pt: string;
  en?: string;
}

export type AirportStepId = 'andar' | 'ler' | 'celia' | 'foto' | 'diario' | 'passaporte' | 'sentar' | 'acenar' | 'lanche' | 'onibus';

export interface AirportGuide {
  kind: 'npc' | 'prop' | 'portal' | 'hotspot';
  id: string;
  label: string;
  lift: number;
}

export interface AirportStep {
  id: AirportStepId;
  /** The checklist line. */
  pt: string;
  en: string;
  /** How, under the line of the current step. */
  how: { pt: string; en: string };
  /** The arrow in the world, or none (a HUD step). */
  guide: AirportGuide | null;
  /** The HUD button(s) the step needs (a selector): they pulse while the step is current. */
  hud?: string;
}

export const AIRPORT_STEPS: readonly AirportStep[] = [
  {
    id: 'andar',
    pt: 'Ande pelo terminal',
    en: 'Walk around the terminal',
    how: { pt: 'Clique no chão pra andar. Setas ou WASD também funcionam.', en: 'Click the floor to walk. Arrow keys or WASD work too.' },
    guide: { kind: 'hotspot', id: 'hall_s_terminal', label: 'Ande até aqui', lift: 40 },
  },
  {
    id: 'ler',
    pt: 'Leia uma placa',
    en: 'Read a sign',
    how: { pt: 'Clique numa placa, como TERMINAL. As palavras que brilham vão pro seu diário.', en: 'Click a sign, like TERMINAL. Sparkling words go into your diary.' },
    guide: { kind: 'hotspot', id: 'hall_s_terminal', label: 'Clique pra ler', lift: 40 },
  },
  {
    id: 'celia',
    pt: 'Fale com a Célia',
    en: 'Talk to Célia',
    how: { pt: 'Ela está no balcão de Informações. A Júlia deixou um pacote pra você!', en: 'She is at the information desk. Júlia left a package for you!' },
    guide: { kind: 'npc', id: 'celia', label: 'Célia · Informações', lift: 120 },
  },
  {
    id: 'foto',
    pt: 'Tire uma foto do avião',
    en: 'Take a photo of the plane',
    how: { pt: 'Chegue perto da janela, clique em Câmera e depois no avião. Aqui no aeroporto as fotos são de graça.', en: 'Go up to the window, click Camera, then the plane. Photos are free here at the airport.' },
    guide: { kind: 'prop', id: 'aviao', label: 'Fotografe o avião', lift: 70 },
    hud: '#btn-camera',
  },
  {
    id: 'diario',
    pt: 'Abra o Diário',
    en: 'Open your Diário',
    how: { pt: 'Clique em Diário: as palavras que você ganhou ficam lá.', en: 'Click Diário: the words you earned live there.' },
    guide: null,
    hud: '#btn-caderno',
  },
  {
    id: 'passaporte',
    pt: 'Mostre o passaporte',
    en: 'Show your passport',
    how: { pt: 'Fale com o Agente Paulo no controle de passaporte. Cumprimente ele primeiro!', en: 'Talk to Agent Paulo at passport control. Greet him first!' },
    guide: { kind: 'npc', id: 'agente', label: 'Controle de passaporte', lift: 120 },
  },
  {
    id: 'sentar',
    pt: 'Sente numa cadeira',
    en: 'Sit down',
    how: { pt: 'Clique numa cadeira pra sentar. Pra levantar, é só andar.', en: 'Click a seat to sit. To get up, just walk.' },
    guide: { kind: 'prop', id: 'cadeiras_6', label: 'Sente aqui', lift: 36 },
  },
  {
    id: 'acenar',
    pt: 'Dê um oi',
    en: 'Wave hello',
    how: { pt: 'Clique em Oi!, embaixo, perto do chat (no celular, abra o rostinho primeiro). Todo mundo por perto vê.', en: 'Click Oi! at the bottom, by the chat (on a phone, open the smiley first). Everyone nearby sees it.' },
    guide: null,
    hud: '#btn-emotes, [data-emote="oi"]',
  },
  {
    id: 'lanche',
    pt: 'Compre um pão de queijo',
    en: 'Buy a pão de queijo',
    how: { pt: 'Na lanchonete. Custa R$ 4 dos seus reais virtuais (RV): o saldo fica lá em cima.', en: 'At the café. It costs R$ 4 of your virtual reais (RV): your balance is at the top.' },
    guide: { kind: 'prop', id: 'lanchonete_aero', label: 'Lanchonete', lift: 70 },
  },
  {
    id: 'onibus',
    pt: 'Pegue o ônibus pra Vila Ipê',
    en: 'Take the bus to Vila Ipê',
    how: { pt: 'Saia pelas portas e clique no ônibus 875. A Júlia te espera na praça!', en: 'Go out the doors and click bus 875. Júlia is waiting for you in the square!' },
    guide: { kind: 'portal', id: 'aero_vila', label: 'Ônibus 875 · Vila Ipê', lift: 60 },
  },
];

/** The steps only this page knows about, per profile. */
export type AirportFlags = Partial<Record<'diario' | 'passaporte' | 'lanche' | 'onibus', boolean>>;

type ProfileBits = Pick<PrivateProfile, 'tutorial' | 'arrivalIntroDone' | 'diary'>;

const chegada = (diary: readonly string[] | undefined, source: 'reading' | 'camera') =>
  normalizeDiary(diary).some((id) => {
    const w = diaryWord(id);
    return w?.area === 'chegada' && w.source === source;
  });

/** Which steps are done: from the profile (walked, sat, waved, the arrival, the Chegada words in the diary) and this page's flags. */
export function airportDone(p: ProfileBits | null | undefined, flags: AirportFlags): Set<AirportStepId> {
  const done = new Set<AirportStepId>();
  if (!p) return done;
  if (p.tutorial?.andar) done.add('andar');
  if (chegada(p.diary, 'reading')) done.add('ler');
  // an account from before the airport (no `arrivalIntroDone` on the save) already has its camera
  if (p.arrivalIntroDone !== false) done.add('celia');
  if (chegada(p.diary, 'camera')) done.add('foto');
  if (p.tutorial?.sentar) done.add('sentar');
  if (p.tutorial?.acenar) done.add('acenar');
  for (const k of ['diario', 'passaporte', 'lanche', 'onibus'] as const) if (flags[k]) done.add(k);
  return done;
}

/** The first step not done yet, in order (the camera has to come from Célia before the photo), or null when all are. */
export function nextAirportStep(done: ReadonlySet<AirportStepId>): AirportStep | null {
  return AIRPORT_STEPS.find((s) => !done.has(s.id)) ?? null;
}

/** How a thank-you agrees with the player (ele: obrigado, ela: obrigada, só o nome: valeu, which needs no agreement). */
export function thanksFor(pronoun: Pronoun | undefined): Chip {
  if (pronoun === 'ele') return { pt: 'Obrigado!', en: 'Thank you! (a man says obrigado)' };
  if (pronoun === 'ela') return { pt: 'Obrigada!', en: 'Thank you! (a woman says obrigada)' };
  return { pt: 'Valeu!', en: 'Thanks! (casual, for anyone)' };
}

export const GREETING_EN = { 'bom dia': 'Good morning', 'boa tarde': 'Good afternoon', 'boa noite': 'Good evening' } as const;
export const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** The three greetings in a fixed order, the right one among them (by the hour). Pure, for the test. */
export function passportChips(minute: number): { chips: Chip[]; right: number } {
  const g = greetingFor(minute);
  const all = ['bom dia', 'boa tarde', 'boa noite'] as const;
  return {
    chips: all.map((x) => ({ pt: `${cap(x)}! Aqui está.`, en: `${GREETING_EN[x]}! Here you go.` })),
    right: all.indexOf(g),
  };
}

