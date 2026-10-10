import { game } from '../state';
import { takeRvNote } from './rvNote';

type Child = Node | string | null | undefined | false;
type Props = Record<string, unknown> & { class?: string; style?: string };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else if (k === 'class') el.className = String(v);
      else if (k === 'style') el.setAttribute('style', String(v));
      else if (k in el && typeof v !== 'string') (el as unknown as Record<string, unknown>)[k] = v;
      else el.setAttribute(k, String(v === true ? '' : v));
    }
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

/** Portuguese label with an English gloss line underneath. */
export function bi(pt: string, en: string, cls = 'btn-label') {
  return h('span', { class: cls }, h('span', { class: 'pt' }, pt), h('span', { class: 'en' }, en));
}

export function en(text: string, plain = false) {
  return h('span', { class: plain ? 'en plain' : 'en' }, text);
}

/** The one RV explainer (rvNote.ts): the first price list a profile opens shows it, every later one gets nothing. */
export function rvPriceNote(): HTMLElement | undefined {
  const text = takeRvNote(game.profile?.id);
  return text ? h('p', { class: 'rv-price-note' }, en(text, true)) : undefined;
}

export const ui = () => document.getElementById('ui')!;

export function clear(el: HTMLElement) {
  while (el.firstChild) el.removeChild(el.firstChild);
}
