import { BELT_LABELS, STRIPES_PER_BELT, type Belt } from '@tudobem/shared';
import { h, en } from './dom';

/**
 * The belt (and stripes) a player earned in the academia: shown in the bout lobby and on the profile card. Never bought, so it is only ever
 * drawn from `PublicAvatar.belt` / `profile.bjj`. `stripes` is omitted for other players (the wire carries the belt only).
 */
export function beltChip(belt: Belt, stripes?: number): HTMLElement {
  const label = BELT_LABELS[belt];
  return h(
    'span',
    { class: `bout-belt belt-${belt}`, id: 'bout-belt', title: `${label.pt} · ${label.en}` },
    h('i', { class: 'band' }),
    h('span', { class: 'bout-belt-name' }, h('span', { class: 'pt' }, label.pt), en(label.en)),
    stripes === undefined ? null : h('span', { class: 'bout-stripes' }, ...Array.from({ length: STRIPES_PER_BELT }, (_, i) => h('i', { class: i < stripes ? 'on' : '' }))),
  );
}
