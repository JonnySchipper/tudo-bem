/**
 * Na foto! A word a photo teaches gets the same moment as a word found on a sign (ui/achado.ts), with the print as the star:
 *
 *   present  the print lifts out of the viewfinder, straightens and glides to the middle of the screen while the world dims to a spotlight
 *            on it and two rings of light draw in onto the picture
 *   burst    a bell (climbing with each word of the shot), a flash over the photo as it develops in full colour, a shine across it, two
 *            shockwaves, slow rays behind it, sparks; the word's letters shoot out of the picture on their own arcs and land above it,
 *            each with a glassy note
 *   hold     a shimmer runs across the word, it is spoken, the English and the place's tally slide in under it
 *   ink      the letters gather into one chip that flies down onto the print and is written on it as its caption
 *   file     after the shot's last word the print, words and all, flies into the Diário, which bumps
 *
 * A shot with several words plays them one after another on the same print (the queue hands them over; the stage stays up between them).
 * It never takes the pointer: the next shot can be taken while it plays. Callers fall back to the plain card under reduced motion.
 */
import { ambience } from '../ambience';
import { speak } from '../audio';
import { h, en, ui } from './dom';
import { flyWord } from './wordFlight';
import { letterSize, streakSemitones } from './achadoLogic';
import { printStage } from './photoFindLogic';
import type { QueuedWord } from './diaryWordQueue';

/** Beats, in ms. */
export const PHOTO_FIND_MS = { present: 560, charge: 300, letterGap: 55, letterFly: 640, hold: 1500, holdMore: 950, holdMany: 520, gather: 260, inked: 650, inkedLast: 1100, linger: 2600 } as const;

const SPARK_COLORS = ['#fff6cf', '#f2c230', '#ffd75e', '#3fbf7f', '#4f8ff0', '#ff9f43', '#fff6cf', '#e25b45'];
/** The notes the letters land on: up the major arpeggio. */
const ARPEGGIO = [0, 4, 7, 12, 16, 19, 24, 28, 31];

const canAnimate = (el: HTMLElement) => typeof el.animate === 'function';
const center = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

/** The print being shown, held up in the middle of the screen across the words of its shot. */
interface Stage {
  print: HTMLElement;
  root: HTMLElement;
  dim: HTMLElement;
  scale: number;
  /** the print's centre on stage */
  at: { x: number; y: number };
  linger: number;
}

let stage: Stage | null = null;

/** True when `print` can carry a find (it is still on screen and motion is allowed). */
export function canPhotoFind(print: unknown): print is HTMLElement {
  if (!(print instanceof HTMLElement) || !print.isConnected || !canAnimate(print)) return false;
  return !(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
}

/**
 * Burst one word of a shot out of its print. `done` runs when the word has been written on the print (the queue hands over the next word);
 * the shot's last word then sends the print into the Diário.
 */
export function playPhotoFind(m: QueuedWord<HTMLElement>, print: HTMLElement, done: () => void): void {
  if (stage && stage.print !== print) fileStage();
  const first = !stage;
  const s = stage ?? openStage(print);
  window.clearTimeout(s.linger);
  // the queue (and the play scripts) see a card up while a word plays
  s.root.id = 'photo-celebrate';
  new PhotoWord(s, m, first, done);
}

/** Lift the print out of the world and onto the stage. */
function openStage(print: HTMLElement): Stage {
  // the eject animation is cut to its end, and the print is re-hung by its centre so it can turn and grow in place
  print.getAnimations().forEach((a) => a.finish());
  const r = print.getBoundingClientRect();
  const c = center(r);
  const w = print.offsetWidth;
  const ph = print.offsetHeight;
  print.removeAttribute('id');
  print.classList.add('staged');
  print.style.left = `${c.x - w / 2}px`;
  print.style.top = `${c.y - ph / 2}px`;
  print.style.rotate = '-4deg';

  const ins = hudInsets();
  const spot = printStage({ w, h: ph }, { w: window.innerWidth, h: window.innerHeight, top: ins.top, bottom: ins.bottom });
  const dim = h('div', { class: 'ach-dim pf-dim', style: `--x:${spot.x}px;--y:${spot.y}px` });
  const root = h('div', { class: 'photo-find', role: 'status', 'aria-live': 'polite' }, dim);
  ui().append(root);
  root.append(print);

  const dx = spot.x - c.x;
  const dy = spot.y - c.y;
  print.style.translate = `${dx}px ${dy}px`;
  print.style.scale = String(spot.scale);
  print.style.rotate = '0deg';
  print.animate(
    [
      { translate: '0px 0px', scale: '1', rotate: '-4deg' },
      { translate: `${dx * 0.55}px ${dy * 0.55 - 28}px`, scale: String(spot.scale * 1.08), rotate: '3deg', offset: 0.6 },
      { translate: `${dx}px ${dy}px`, scale: String(spot.scale), rotate: '0deg' },
    ],
    { duration: PHOTO_FIND_MS.present, easing: 'cubic-bezier(0.3, 0.7, 0.3, 1)' },
  );
  stage = { print, root, dim, scale: spot.scale, at: { x: spot.x, y: spot.y }, linger: 0 };
  return stage;
}

/** The shot is over: the print flies into the Diário and the stage goes. */
function fileStage() {
  const s = stage;
  if (!s) return;
  stage = null;
  window.clearTimeout(s.linger);
  s.root.removeAttribute('id');
  s.dim.classList.add('out');
  const target = diaryButton();
  const pr = s.print.getBoundingClientRect();
  const end = () => {
    s.root.remove();
    if (!target) return;
    target.classList.remove('bump');
    void target.offsetWidth;
    target.classList.add('bump');
    window.setTimeout(() => target.classList.remove('bump'), 500);
  };
  if (!target || !pr.width) {
    s.print.classList.add('leaving');
    window.setTimeout(end, 300);
    return;
  }
  const tc = center(target.getBoundingClientRect());
  const pc = center(pr);
  const [tx, ty] = (s.print.style.translate || '0px 0px').split(' ').map((v) => parseFloat(v) || 0);
  const ex = tx! + tc.x - pc.x;
  const ey = ty! + tc.y - pc.y;
  ambience.achado('collect');
  const anim = s.print.animate(
    [
      { translate: `${tx}px ${ty}px`, scale: String(s.scale), rotate: '0deg', opacity: 1 },
      { translate: `${tx! + (ex - tx!) * 0.4}px ${ty! + (ey - ty!) * 0.4 - 60}px`, scale: String(s.scale * 0.6), rotate: '-8deg', opacity: 1, offset: 0.45 },
      { translate: `${ex}px ${ey}px`, scale: '0.1', rotate: '-16deg', opacity: 0.25 },
    ],
    { duration: 760, easing: 'cubic-bezier(0.5, 0, 0.75, 0.4)', fill: 'forwards' },
  );
  // a trail of sparkles behind it
  const trail = window.setInterval(() => {
    if (!s.print.isConnected) return;
    const p = center(s.print.getBoundingClientRect());
    sparkle(s.root, p.x, p.y);
  }, 45);
  anim.onfinish = () => {
    window.clearInterval(trail);
    end();
  };
}

/** One word of the shot, from burst to caption. */
class PhotoWord {
  private over = false;
  private readonly timers: number[] = [];
  private lockup: HTMLElement | null = null;

  constructor(
    private readonly s: Stage,
    private readonly m: QueuedWord<HTMLElement>,
    first: boolean,
    private readonly done: () => void,
  ) {
    const img = this.imageCenter();
    // rings of light draw in onto the picture (a longer breath for the first word, while the print is still gliding in)
    const charge = first ? PHOTO_FIND_MS.present : PHOTO_FIND_MS.charge;
    ambience.achado('charge');
    const glow = h('i', { class: 'pf-glow', style: `left:${img.x}px;top:${img.y}px` });
    s.root.insertBefore(glow, s.print);
    s.root.append(
      h('i', { class: 'pf-ring', style: `left:${img.x}px;top:${img.y}px;animation-duration:${charge}ms` }),
      h('i', { class: 'pf-ring two', style: `left:${img.x}px;top:${img.y}px;animation-duration:${charge * 0.85}ms` }),
    );
    this.later(() => this.burst(), charge);
  }

  private later(fn: () => void, ms: number) {
    this.timers.push(window.setTimeout(() => !this.over && fn(), ms));
  }

  /** The picture's centre on stage (where the light comes out): the print's centre, raised by half the caption under the picture. */
  private imageCenter() {
    const pic = this.s.print.querySelector<HTMLElement>('.print-img');
    const capH = this.s.print.querySelector<HTMLElement>('.print-cap')?.offsetHeight ?? 0;
    const lift = pic?.offsetHeight ? capH / 2 : 0;
    return { x: this.s.at.x, y: this.s.at.y - lift * this.s.scale };
  }

  private burst() {
    const { s, m } = this;
    const { x, y } = this.imageCenter();
    ambience.achado('burst', streakSemitones(m.index));
    s.print.classList.remove('flare');
    void s.print.offsetWidth;
    s.print.classList.add('flare');
    s.root.insertBefore(h('i', { class: 'ach-rays pf-rays', style: `left:${x}px;top:${y}px` }), s.print);
    s.root.append(
      h('i', { class: 'ach-flash pf-flash', style: `left:${x}px;top:${y}px` }),
      h('i', { class: 'ach-shock', style: `left:${x}px;top:${y}px` }),
      h('i', { class: 'ach-shock two', style: `left:${x}px;top:${y}px` }),
    );
    this.sparks(x, y, 28);
    const landed = this.letters({ x, y });
    this.later(() => this.settle(), landed);
  }

  /** Sparks thrown out of the picture, falling a little as they go. */
  private sparks(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (((i * 7919) % 100) / 100) * 0.5;
      const d = 110 + ((i * 37) % 11) * 15;
      const dx = Math.cos(a) * d;
      const dy = Math.sin(a) * d;
      const sp = h('i', { class: `ach-spark${i % 3 === 0 ? ' star' : ''}`, style: `left:${x}px;top:${y}px;background:${SPARK_COLORS[i % SPARK_COLORS.length]}` });
      this.s.root.append(sp);
      sp.animate(
        [
          { transform: 'translate(-50%, -50%) scale(1.2) rotate(0deg)', opacity: 1 },
          { transform: `translate(calc(-50% + ${dx * 0.75}px), calc(-50% + ${dy * 0.75 - 18}px)) scale(1) rotate(200deg)`, opacity: 1, offset: 0.5 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 46}px)) scale(0.2) rotate(380deg)`, opacity: 0 },
        ],
        { duration: 900 + ((i * 53) % 400), easing: 'cubic-bezier(0.15, 0.75, 0.3, 1)', fill: 'forwards' },
      ).onfinish = () => sp.remove();
    }
  }

  /** The word's letters fly out of the picture into place above the print. Returns the ms until the last one has landed. */
  private letters(from: { x: number; y: number }): number {
    const { s, m } = this;
    const size = letterSize(m.pt, window.innerWidth);
    const chars = [...m.pt];
    const spans = chars.map((ch, i) => h('span', { class: `ach-letter${ch === ' ' ? ' sp' : ''}`, style: `--i:${i}` }, ch === ' ' ? ' ' : ch));
    const word = h('b', { class: 'ach-word', lang: 'pt-BR' }, ...spans);
    const gloss = en(m.en);
    gloss.classList.add('ach-gloss');
    const kicker = h(
      'div',
      { class: 'ach-kicker' },
      m.total > 1 ? `Na foto! ${m.index}/${m.total}` : 'Na foto!',
      h('span', { class: 'en' }, m.total > 1 ? ` · word ${m.index} of ${m.total}` : ' · In the photo'),
    );
    const tally = m.progress
      ? h('div', { class: 'ach-tally' }, m.areaPt ? h('span', { class: 'ach-room' }, m.areaPt) : null, h('span', { class: 'ach-count' }, m.progress))
      : null;
    const lockup = h('div', { class: 'ach-lockup pf-lockup', style: `--fs:${size}px` }, kicker, word, gloss, tally);
    this.lockup = lockup;
    s.root.append(lockup);
    // the word hangs over the print (under it when the print sits too high for that)
    const box = lockup.getBoundingClientRect();
    const half = (s.print.offsetHeight * s.scale) / 2;
    const ins = hudInsets();
    const above = s.at.y - half - 18 - box.height / 2;
    const y = above - box.height / 2 >= ins.top + 8 ? above : Math.min(window.innerHeight - ins.bottom - box.height / 2 - 8, s.at.y + half + 18 + box.height / 2);
    const x = Math.max(16 + box.width / 2, Math.min(window.innerWidth - 16 - box.width / 2, s.at.x));
    lockup.style.left = `${x}px`;
    lockup.style.top = `${y}px`;
    lockup.classList.add('placed', 'flying');
    let last = 0;
    spans.forEach((sp, i) => {
      if (chars[i] === ' ') return;
      const r = sp.getBoundingClientRect();
      const dx = from.x - (r.left + r.width / 2);
      const dy = from.y - (r.top + r.height / 2);
      const side = (i % 2 ? 1 : -1) * (30 + ((i * 17) % 36));
      const spin = (i % 2 ? 1 : -1) * (180 + ((i * 41) % 180));
      const delay = 90 + i * PHOTO_FIND_MS.letterGap;
      last = Math.max(last, delay + PHOTO_FIND_MS.letterFly);
      sp.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(0.15) rotate(${spin}deg)`, opacity: 0 },
          { opacity: 1, offset: 0.12 },
          { transform: `translate(${dx * 0.4 + side}px, ${dy * 0.4 - 80}px) scale(1.45) rotate(${spin / 4}deg)`, offset: 0.58 },
          { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
        ],
        { duration: PHOTO_FIND_MS.letterFly, delay, easing: 'cubic-bezier(0.3, 0.7, 0.25, 1)', fill: 'both' },
      ).onfinish = () => {
        if (this.over) return;
        sp.classList.add('landed');
        ambience.achado('tick', ARPEGGIO[i % ARPEGGIO.length]!);
      };
    });
    return last + 60;
  }

  /** Everything has landed: shimmer, say it, show the English and the tally. */
  private settle() {
    const { m } = this;
    this.lockup?.classList.add('shown', 'shine');
    speak(m.pt);
    const hold = m.index < m.total ? (m.total > 5 ? PHOTO_FIND_MS.holdMany : PHOTO_FIND_MS.holdMore) : PHOTO_FIND_MS.hold;
    this.later(() => this.ink(), hold);
  }

  /** The letters gather into one chip that flies down onto the print and is written there as its caption. */
  private ink() {
    const { s, m } = this;
    const lockup = this.lockup;
    const word = lockup?.querySelector<HTMLElement>('.ach-word');
    const pt = h('b', { class: 'print-pt awaiting', lang: 'pt-BR' }, m.pt);
    const gloss = h('span', { class: 'print-en en plain awaiting' }, m.en);
    s.print.querySelector('.print-cap')?.replaceChildren(...(m.total > 1 ? [h('span', { class: 'print-more' }, `${m.index}/${m.total}`)] : []), pt, gloss);
    s.print.classList.add('new-word');
    if (!lockup || !word) return this.inked(pt, gloss);
    lockup.classList.add('gathering');
    const wr = word.getBoundingClientRect();
    const cx = wr.left + wr.width / 2;
    for (const sp of word.querySelectorAll<HTMLElement>('.ach-letter')) {
      const r = sp.getBoundingClientRect();
      sp.getAnimations().forEach((a) => a.cancel());
      sp.animate([{ transform: 'translate(0, 0) scale(1)' }, { transform: `translate(${cx - (r.left + r.width / 2)}px, 0) scale(0.5)`, opacity: 0.2 }], {
        duration: PHOTO_FIND_MS.gather,
        easing: 'cubic-bezier(0.6, 0, 0.8, 0.5)',
        fill: 'forwards',
      });
    }
    this.later(() => {
      const fs = parseFloat(getComputedStyle(word).fontSize) || 48;
      lockup.classList.add('leaving');
      flyWord(
        { rect: new DOMRect(cx - wr.width * 0.2, wr.top, wr.width * 0.4, wr.height), text: m.pt, fontFamily: getComputedStyle(word).fontFamily, fontSize: fs * 0.55, fontWeight: '400', at: performance.now() },
        () => (pt.isConnected ? pt.getBoundingClientRect() : null),
        () => (parseFloat(getComputedStyle(pt).fontSize) || 17) * s.scale,
        () => this.inked(pt, gloss),
      );
    }, PHOTO_FIND_MS.gather);
  }

  /** The word is on the print: it pops, the print glows, and the next word (or the Diário) comes. */
  private inked(pt: HTMLElement, gloss: HTMLElement) {
    const { s, m } = this;
    pt.classList.remove('awaiting');
    gloss.classList.remove('awaiting');
    pt.classList.add('arrived');
    gloss.classList.add('arrived');
    ambience.achado('tick', 24);
    const at = center(pt.getBoundingClientRect());
    for (let i = 0; i < 10; i++) sparkle(s.root, at.x + ((i * 29) % 60) - 30, at.y + ((i * 13) % 14) - 7);
    s.print.animate([{ scale: String(s.scale) }, { scale: String(s.scale * 1.07), offset: 0.35 }, { scale: String(s.scale) }], { duration: 420, easing: 'ease-out' });
    this.later(() => this.end(), m.index < m.total ? PHOTO_FIND_MS.inked : PHOTO_FIND_MS.inkedLast);
  }

  private end() {
    if (this.over) return;
    this.over = true;
    for (const t of this.timers) window.clearTimeout(t);
    this.lockup?.remove();
    for (const el of this.s.root.querySelectorAll('.pf-glow, .pf-ring, .pf-rays, .pf-flash, .ach-shock')) el.remove();
    const s = this.s;
    s.root.removeAttribute('id');
    if (this.m.index >= this.m.total) {
      if (stage === s) fileStage();
    } else {
      // the next word of the shot bursts out of the same print; if it does not come (a game opened), the print goes to the Diário anyway
      s.linger = window.setTimeout(() => stage === s && fileStage(), PHOTO_FIND_MS.linger);
    }
    this.done();
  }
}

/** A small sparkle that drifts and fades (the same as the heard word's trail). */
function sparkle(root: HTMLElement, x: number, y: number) {
  const i = Math.floor(Math.random() * 1000);
  const el = h('i', { class: `heard-spark${i % 3 === 0 ? ' star' : ''}`, style: `left:${x}px;top:${y}px;--dx:${(i % 21) - 10}px;--dy:${(i % 17) - 4}px` });
  root.append(el);
  window.setTimeout(() => el.remove(), 700);
}

let hudInsets: () => { top: number; bottom: number } = () => ({ top: 64, bottom: 110 });

/** How the page measures the HUD bars at the top and bottom of the screen (CSS px): the print and its word stay clear of them. */
export function setPhotoFindInsets(insets: () => { top: number; bottom: number }) {
  hudInsets = insets;
}

/** The Diário button, or the menu it hides in on a phone. */
function diaryButton(): HTMLElement | null {
  for (const id of ['btn-caderno', 'btn-burger']) {
    const el = document.getElementById(id);
    const r = el?.getBoundingClientRect();
    if (el && r && r.width > 0 && r.height > 0) return el;
  }
  return null;
}
