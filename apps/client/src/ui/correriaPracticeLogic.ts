/**
 * Pure model of the first-time "Correria no Balcão" tutorial (no DOM): the six steps of the practice order (read the order, the coffee pour,
 * the pão francês, the juicer, Entregar, the pay), which taps each step lets through, what it lights up, and what moves it on.
 * `ui/correriaPractice.ts` runs the practice shift locally and draws the coach card from these.
 */
import { COUNTER_PRICES, JUICE, PRACTICE_MENU, moneyLabel, type Bilingual, type CAct, type CEvent, type CorreriaSnap } from '@tudobem/shared';

export type PracticeStepId = 'read' | 'cafe' | 'pao' | 'suco' | 'serve' | 'paid';

export interface PracticeStep {
  id: PracticeStepId;
  title: Bilingual;
  body: Bilingual;
}

const b = (pt: string, en: string): Bilingual => ({ pt, en });

export const PRACTICE_STEPS: readonly PracticeStep[] = [
  {
    id: 'read',
    title: b('Leia o pedido', 'Read the order'),
    body: b('A Ana pede no balão e no bilhete aqui embaixo: um café, um pão francês e um suco de laranja.', 'Ana orders in the bubble and on the ticket below: a coffee, a French roll and an orange juice.'),
  },
  {
    id: 'cafe',
    title: b('O café: toque duas vezes', 'Coffee: tap twice'),
    body: b('Toque na cafeteira. A xícara enche sozinha. Toque de novo quando aparecer “Agora!” em verde.', 'Tap the coffee machine. The cup fills on its own. Tap again when the green “Agora!” (now!) shows.'),
  },
  {
    id: 'pao',
    title: b('O pão francês', 'The French roll'),
    body: b('Toque no pão na vitrine. Ele vai direto pra bandeja.', 'Tap the bread in the display case. It goes straight onto the tray.'),
  },
  {
    id: 'suco',
    title: b('O suco: o espremedor', 'Juice: the juicer'),
    body: b('Toque no espremedor: cada toque, uma laranja. Quando o suco chegar na linha, toque no copo.', 'Tap the juicer: each tap, one orange. When the juice reaches the line, tap the glass.'),
  },
  {
    id: 'serve',
    title: b('Entregue', 'Serve'),
    body: b('Tudo na bandeja? Toque em Entregar 🔔.', 'Everything on the tray? Tap Entregar 🔔 (Serve).'),
  },
  {
    id: 'paid',
    title: b('Você recebeu!', 'You got paid!'),
    body: b('', ''),
  },
];

export const practiceStep = (id: PracticeStepId): PracticeStep => PRACTICE_STEPS.find((s) => s.id === id)!;
export const practiceIndex = (id: PracticeStepId): number => PRACTICE_STEPS.findIndex((s) => s.id === id);

/** Only the taps the current step teaches go through, so the practice order cannot go wrong. */
export function practiceAllows(step: PracticeStepId, act: CAct): boolean {
  switch (step) {
    case 'cafe':
      return (act.a === 'pour_start' && act.item === 'cafe') || act.a === 'pour_end';
    case 'pao':
      return act.a === 'grab' && act.item === 'pao';
    case 'suco':
      return act.a === 'juice_drop' || act.a === 'juice_take';
    case 'serve':
      return act.a === 'serve';
    default:
      return false;
  }
}

/** The step after these events (the same step until its item is on the tray). */
export function practiceAfter(step: PracticeStepId, ev: readonly CEvent[]): PracticeStepId {
  if (step === 'cafe' && ev.some((e) => e.k === 'pour_ok')) return 'pao';
  if (step === 'pao' && ev.some((e) => e.k === 'grab' && e.item === 'pao')) return 'suco';
  if (step === 'suco' && ev.some((e) => e.k === 'juice_ok')) return 'serve';
  if (step === 'serve' && ev.some((e) => e.k === 'serve')) return 'paid';
  return step;
}

/** A friendly "try again" when a pour or a glass misses (the step stays where it is). */
export function practiceRetry(ev: readonly CEvent[]): Bilingual | null {
  for (const e of ev) {
    if (e.k === 'pour_bad') return e.why === 'short' ? b('Cedo demais! Toque de novo e espere o verde.', 'Too early! Tap again and wait for the green.') : b('Passou! Toque bem no “Agora!”.', 'Too late! Tap right at “Agora!”.');
    if (e.k === 'juice_bad') return e.why === 'short' ? b('Ainda não chegou na linha. Mais laranjas, depois o copo!', 'Not at the line yet. More oranges, then the glass!') : b('Transbordou! Comece outro copo.', 'It overflowed! Start another glass.');
  }
  return null;
}

/** Element ids the step lights up. The juicer step moves the light from the machine to the glass once the juice is at the line. */
export function practiceTargets(step: PracticeStepId, snap: Pick<CorreriaSnap, 'juice' | 'pour'> | null): string[] {
  switch (step) {
    case 'read':
      return ['cr-order'];
    case 'cafe':
      return ['cr-machine'];
    case 'pao':
      return ['cr-item-pao'];
    case 'suco':
      return (snap?.juice?.fill ?? 0) >= JUICE.goodMin ? ['cr-juice-glass'] : ['cr-juicer'];
    case 'serve':
      return ['cr-serve', 'cr-bell'];
    case 'paid':
      return ['cr-points', 'cr-tips'];
  }
}

/** The pay step's lines: what Ana paid, the tip, and that a real shift turns points into RV (the practice pays none). */
export function practicePaid(tip: number, points: number): Bilingual {
  const total = PRACTICE_MENU.reduce((s, id) => s + (COUNTER_PRICES[id] ?? 0), 0);
  return {
    pt: `A Ana pagou ${moneyLabel(total * 100)} e deixou ${moneyLabel(tip * 100)} de gorjeta: +${points} pontos. Num turno de verdade, os pontos viram RV no fim. O treino não paga RV.`,
    en: `Ana paid ${moneyLabel(total * 100)} and left a ${moneyLabel(tip * 100)} tip: +${points} points. In a real shift, points turn into RV at the end. Practice pays no RV.`,
  };
}

export const PRACTICE_BLOCKED: Bilingual = b('Agora não: siga o passo em destaque.', 'Not yet: follow the highlighted step.');

/** The "?" card in a real shift: the same steps, short. */
export const HELP_TITLE: Bilingual = b('Como jogar', 'How to play');
export const HELP_STEPS: readonly Bilingual[] = [
  b('Leia o pedido no bilhete (ou escute).', 'Read the order on the ticket (or listen).'),
  b('Café: toque na cafeteira e de novo no “Agora!”.', 'Coffee: tap the machine, then again at “Agora!”.'),
  b('Vitrine, estufa, geladeira: um toque põe na bandeja.', 'Display case, warmer, fridge: one tap puts it on the tray.'),
  b('Chapa: ponha e tire quando dourar.', 'Grill: put it on, take it off when it browns.'),
  b('Suco: uma laranja por toque; na linha, toque no copo.', 'Juice: one orange per tap; at the line, tap the glass.'),
  b('Entregar 🔔. Os pontos viram RV no fim do turno.', 'Entregar 🔔 (Serve). Points turn into RV at the end of the shift.'),
];

/** Done once: a player who finished (or skipped) the practice, or already played a shift, goes straight to a real one. */
export const PRACTICE_KEY = 'tb_cr_practice';
export function practiceNeeded(stored: string | null, playedShift: boolean): boolean {
  return stored !== '1' && !playedShift;
}
