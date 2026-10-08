/**
 * The nameplate colour as a chip: colour and a shape (seedling, sun, drop, star, crown), so it reads for colourblind players too. Used by the
 * HUD, the profile card, the friends list and the escola. The overhead plate draws the same shapes in pixel.css (`wl-tier-*`).
 */
import { tierRule, type Nameplate } from '@tudobem/shared';
import { h } from './dom';

export const TIER_SHAPE: Record<Nameplate, string> = { verde: 'muda', amarelo: 'sol', azul: 'gota', roxo: 'estrela', dourado: 'coroa' };

/** "Verde" / "Amarela": the plate (a placa) is feminine. */
export const tierName = (t: Nameplate) => tierRule(t).pt;

export function tierIcon(t: Nameplate, cls = '') {
  return h('i', { class: `tier-ico tier-ico-${t} ${cls}`.trim(), 'aria-hidden': 'true' });
}

export function tierChip(t: Nameplate, opts: { label?: string; title?: string; id?: string } = {}) {
  const rule = tierRule(t);
  return h(
    'span',
    { class: `tier-chip tier-${t}`, 'data-tier': t, title: opts.title ?? `Placa ${rule.pt} · ${rule.en} nameplate`, ...(opts.id ? { id: opts.id } : {}) },
    tierIcon(t),
    opts.label ?? rule.pt,
  );
}
