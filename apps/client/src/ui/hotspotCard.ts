/**
 * The card a sign opens (HOWTO Phase 7 step 2): the full Portuguese text large, 🔊, the English gloss, and "Guardar no caderno". Opening it is
 * what tells the server (`read`, see main.ts): the words on the sign count as seen, and a recado's `ler` step advances.
 */
import { hotspotTitle, moneyPt, type HotspotDef } from '@tudobem/shared';
import { h, en, bi } from './dom';
import { openModal } from './modal';
import { speak } from '../audio';
import { heardIds, noteHeard } from './heard';

export interface HotspotCardOpts {
  /** "Guardar no caderno": the words are already counted as seen by the read; this takes the player to them. */
  onSave: (cardIds: string[]) => void;
}

/** The text read aloud: the lines as sentences, prices as words ("R$ 3,50" -> "três reais e cinquenta centavos"). */
export const spokenText = (s: Pick<HotspotDef, 'pt'>): string =>
  s.pt
    .replace(/R\$\s?(\d+)(?:,(\d{2}))?/g, (_m, r: string, c?: string) => moneyPt(Number(r) * 100 + (c ? Number(c) : 0)))
    .split('\n')
    .join('. ');

/** A sign with a price on any line is a price board: it is drawn as the padaria's chalkboard (lousa) instead of a painted board. */
const PRICED = /^(.*\S)\s+(R\$\s?\d+(?:[,.]\d{2})?)$/;

/** Two cords from a nail down to the board's top corners. Decoration only. */
const cords = () => {
  const el = h('div', { class: 'hs-hang', 'aria-hidden': 'true' });
  el.innerHTML =
    '<svg viewBox="0 0 100 30" preserveAspectRatio="none"><path d="M50 4 L14 30 M50 4 L86 30" vector-effect="non-scaling-stroke"/></svg><i class="hs-nail"></i>';
  return el;
};

export function openHotspotCard(hs: HotspotDef, opts: HotspotCardOpts): void {
  const cards = heardIds(hs.pt, hs.cards ?? []);
  const menu = hs.pt.split('\n').some((l) => PRICED.test(l));
  const lines = (text: string, cls: string) =>
    text.split('\n').flatMap((l, i, all) => {
      const lang = cls === 'hs-pt' ? 'pt-BR' : 'en';
      // a menu line "Coxinha R$ 7" is drawn as a price list: name, dotted leader, price
      const priced = PRICED.exec(l);
      const line = priced
        ? h('div', { class: `${cls} priced`, lang }, h('span', { class: 'name' }, priced[1]!.replace(/\s*·$/, '')), h('span', { class: 'lead' }), h('span', { class: 'price' }, priced[2]!))
        : h('div', { class: `${cls}${i === 0 ? ' first' : ''}`, lang }, l);
      // the sign's name, then a painted rule, then the rest
      return i === 0 && !priced && all.length > 1 && cls === 'hs-pt' ? [line, h('div', { class: 'hs-rule', 'aria-hidden': 'true' })] : [line];
    });
  let saved = false;
  const save = cards.length
    ? h(
        'button',
        {
          class: 'primary',
          id: 'hs-save',
          onclick: (e: Event) => {
            if (saved) return;
            saved = true;
            const b = e.currentTarget as HTMLButtonElement;
            b.disabled = true;
            b.replaceChildren(bi('Guardado ✓', 'Saved'));
            opts.onSave(cards);
          },
        },
        h('span', { class: 'hs-save-icon', 'aria-hidden': 'true' }, '📒'),
        bi('Guardar no caderno', 'Save to notebook'),
      )
    : null;
  const listen = h(
    'button',
    { id: 'hs-listen', 'aria-label': 'Ouvir (Listen)', onclick: () => (speak(spokenText(hs), { force: true }), noteHeard(hs.pt, hs.cards ?? [])) },
    h('span', { class: 'hs-listen-icon', 'aria-hidden': 'true' }, '🔊'),
    bi('Ouvir', 'Listen'),
  );
  const close = openModal(
    'hotspot',
    h(
      'div',
      { class: `panel hotspot-card ${menu ? 'is-menu' : 'is-board'}`, 'data-hotspot': hs.id, role: 'dialog', 'aria-label': `${hotspotTitle(hs).pt} (${hotspotTitle(hs).en})` },
      h('button', { class: 'close ghost', onclick: () => close(), 'aria-label': 'Fechar (Close)' }, '✕'),
      cords(),
      h(
        'div',
        { class: 'hs-sign' },
        h('span', { class: 'hs-kicker' }, menu ? 'Preços' : 'Placa', en(menu ? 'Prices' : 'Sign', true)),
        ...lines(hs.pt, 'hs-pt'),
        h('i', { class: 'hs-screw tl', 'aria-hidden': 'true' }),
        h('i', { class: 'hs-screw tr', 'aria-hidden': 'true' }),
        h('i', { class: 'hs-screw bl', 'aria-hidden': 'true' }),
        h('i', { class: 'hs-screw br', 'aria-hidden': 'true' }),
      ),
      h('div', { class: 'hs-actions' }, listen),
      h('div', { class: 'hs-gloss', lang: 'en' }, h('span', { class: 'hs-gloss-tag' }, 'EN', h('span', null, 'Tradução · Translation')), ...lines(hs.en, 'hs-en')),
      save ? h('div', { class: 'hs-save' }, save) : null,
    ),
  );
}
