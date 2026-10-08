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

/**
 * The airport comes after the arrivals hall (`desembarque`), which already taught walking, talking, the Diário, reading a sign, waving,
 * picking up and using things, money, the map and doors. So the airport only asks for what is new here: the camera from Célia and a first
 * photo, the passport check, a snack bought with RV, and the bus to the Vila.
 */
export type AirportStepId = 'celia' | 'foto' | 'passaporte' | 'lanche' | 'onibus';

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
    id: 'celia',
    pt: 'Fale com a Célia',
    en: 'Get your camera from Célia',
    how: { pt: 'Ela está no balcão de Informações. A Júlia deixou um pacote pra você!', en: 'She is at the information desk, to your right. Júlia left a package for you: a camera and a stamp card.' },
    guide: { kind: 'npc', id: 'celia', label: 'Célia · Information', lift: 120 },
  },
  {
    id: 'foto',
    pt: 'Tire uma foto do avião',
    en: 'Take a photo of the plane',
    how: { pt: 'Chegue perto da janela, clique em Câmera e depois no avião. Aqui no aeroporto as fotos são de graça.', en: 'Go up to the window, click Câmera, then the plane. Each thing you photograph teaches its word. Photos are free here.' },
    guide: { kind: 'prop', id: 'aviao', label: 'Photograph · Fotografe', lift: 70 },
    hud: '#btn-camera, #btn-burger',
  },
  {
    id: 'passaporte',
    pt: 'Mostre o passaporte',
    en: 'Show your passport',
    how: { pt: 'Fale com o Agente Paulo no controle de passaporte. Cumprimente ele primeiro!', en: 'Talk to Agent Paulo at passport control, south of the gate. Greet him the right way for the time of day!' },
    guide: { kind: 'npc', id: 'agente', label: 'Passport · Passaporte', lift: 120 },
  },
  {
    id: 'lanche',
    pt: 'Compre um pão de queijo',
    en: 'Buy a pão de queijo',
    how: { pt: 'Na lanchonete. Custa R$ 4 dos seus reais virtuais (RV): o saldo fica lá em cima.', en: 'At the café (lanchonete). It costs 4 of your RV: your balance is at the top right.' },
    guide: { kind: 'prop', id: 'lanchonete_aero', label: 'Café · Lanchonete', lift: 70 },
  },
  {
    id: 'onibus',
    pt: 'Pegue o ônibus pra Vila Ipê',
    en: 'Take the bus to Vila Ipê',
    how: { pt: 'Saia pelas portas e clique no ônibus 875. A Júlia te espera na praça!', en: 'Go out the glass doors at the bottom and click bus 875. Júlia is waiting for you in the square!' },
    guide: { kind: 'portal', id: 'aero_vila', label: 'Bus 875 · Vila Ipê', lift: 60 },
  },
];

/** The steps only this page knows about, per profile. */
export type AirportFlags = Partial<Record<'passaporte' | 'lanche' | 'onibus', boolean>>;

type ProfileBits = Pick<PrivateProfile, 'arrivalIntroDone' | 'diary'>;

const chegadaPhoto = (diary: readonly string[] | undefined) =>
  normalizeDiary(diary).some((id) => {
    const w = diaryWord(id);
    return w?.area === 'chegada' && w.source === 'camera';
  });

/** Which steps are done: from the profile (the arrival, a Chegada photo in the diary) and this page's flags. */
export function airportDone(p: ProfileBits | null | undefined, flags: AirportFlags): Set<AirportStepId> {
  const done = new Set<AirportStepId>();
  if (!p) return done;
  // an account from before the airport (no `arrivalIntroDone` on the save) already has its camera
  if (p.arrivalIntroDone !== false) done.add('celia');
  if (chegadaPhoto(p.diary)) done.add('foto');
  for (const k of ['passaporte', 'lanche', 'onibus'] as const) if (flags[k]) done.add(k);
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

/** The airport's "what next" card, shown once when you come out of the arrivals hall. */
export const AIRPORT_NEXT = {
  title: 'You’re in the airport!',
  pt: 'Bem-vindo ao aeroporto!',
  goals: [
    'Get your camera from Célia at the information desk (follow the arrow).',
    'Take a photo, show your passport and grab a snack if you like.',
    'Then go out the glass doors at the bottom and take bus 875 to Vila Ipê, where Júlia is waiting.',
  ],
} as const;
