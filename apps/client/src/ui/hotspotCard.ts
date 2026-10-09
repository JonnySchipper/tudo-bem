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

export function openHotspotCard(hs: HotspotDef, opts: HotspotCardOpts): void {
  const cards = heardIds(hs.pt, hs.cards ?? []);
  const title = hotspotTitle(hs);
  const lines = (text: string, cls: string) =>
    text.split('\n').map((l, i) => {
      const lang = cls === 'hs-pt' ? 'pt-BR' : 'en';
      // a menu line "Coxinha R$ 7" is drawn as a price list: name, dotted leader, price
      const priced = /^(.*\S)\s+(R\$\s?\d+(?:[,.]\d{2})?)$/.exec(l);
      if (priced) return h('div', { class: `${cls} priced`, lang }, h('span', { class: 'name' }, priced[1]!), h('span', { class: 'lead' }), h('span', { class: 'price' }, priced[2]!));
      return h('div', { class: `${cls}${i === 0 ? ' first' : ''}`, lang }, l);
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
        bi('Guardar no caderno', 'Save to notebook'),
      )
    : null;
  const close = openModal(
    'hotspot',
    h(
      'div',
      { class: 'panel hotspot-card', 'data-hotspot': hs.id },
      h('button', { class: 'close ghost', onclick: () => close(), 'aria-label': 'Fechar (Close)' }, '✕'),
      h('div', { class: 'hs-kicker' }, '👁 ', title.pt, en(title.en, true)),
      h('div', { class: 'hs-sign' }, ...lines(hs.pt, 'hs-pt')),
      h('div', { class: 'hs-actions' }, h('button', { class: 'speak-btn', id: 'hs-listen', onclick: () => (speak(spokenText(hs), { force: true }), noteHeard(hs.pt, hs.cards ?? [])) }, '🔊 Ouvir ', en('Listen'))),
      h('div', { class: 'hs-gloss' }, ...lines(hs.en, 'hs-en')),
      save ? h('div', { class: 'hs-save' }, save) : null,
    ),
  );
}
