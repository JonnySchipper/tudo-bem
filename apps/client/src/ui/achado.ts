/**
 * Achado! A word found on a sign. Tapping a sign's star used to open a card and gift the word; now the star itself is the moment:
 *
 *   charge   the world dims to a spotlight on the star, which swells and spins while a ring of light draws in (it waits here for the
 *            server to grant the word; nothing granted in time and the star fizzles back into the world)
 *   burst    a bell (pitched up the pentatonic by the streak of finds), a flash, two shockwaves, slow rays, sparks in the colours of
 *            the Vila; the word's letters shoot out of the star on their own arcs and land one by one above it, each with a glassy note
 *   hold     a shimmer runs across the word, it is spoken, the English slides in under it, and the room's tally fills a pip
 *            ("Rua dos Ipês · 4/9"); the room's last word sets off the finale (every sign of the room pings, confetti, a music-box run)
 *   collect  the letters gather into one chip that flies on an arc, sparkling, into the Diário, which bumps
 *
 * It never takes the pointer: the player can walk on while it plays. It replaces the new-word card for a reading word (`claimReadingWord`).
 * Reduced motion: the word fades in where it hangs with its tally, and fades out. No flight, no sparks.
 */
import { ambience } from '../ambience';
import { speak } from '../audio';
import { h, en, ui } from './dom';
import { flyWord } from './wordFlight';
import { letterSize, lockupSpot, nextStreak, streakSemitones, type Tally } from './achadoLogic';

export interface AchadoOpts {
  hotspotId: string;
  word: { pt: string; en: string };
  /** the sign's star on screen (client px) and its drawn size */
  star: { px: number; py: number; size: number };
  /** the room's name and its hidden words, counting this one */
  roomPt: string;
  tally: Tally;
  /** every sign of the room that hides a word, on screen now (the finale pings them) */
  stars: () => { px: number; py: number }[];
  /** HUD space at the top and bottom of the screen (CSS px) */
  insets: { top: number; bottom: number };
  /** take the world's star over (true) or give it back (false) */
  claim: (on: boolean) => void;
  /** the find is over: the word went into the Diário (`found`), or the star fizzled */
  done: (found: boolean) => void;
}

/** Beats, in ms. Exported for the screenshot script, which pauses on them. */
export const ACHADO_MS = { charge: 460, wait: 3500, letterGap: 55, letterFly: 640, hold: 1500, finale: 1500, gather: 260 } as const;

const SPARK_COLORS = ['#fff6cf', '#f2c230', '#ffd75e', '#3fbf7f', '#4f8ff0', '#ff9f43', '#fff6cf', '#f2c230'];
/** The notes the letters land on: up the major arpeggio. */
const ARPEGGIO = [0, 4, 7, 12, 16, 19, 24, 28, 31];

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const norm = (s: string) => s.normalize('NFC').trim().toLocaleLowerCase('pt-BR');
const canAnimate = (el: HTMLElement) => typeof el.animate === 'function';

let current: Achado | null = null;
let streak: { n: number; at: number } | null = null;

/** Start a find on a sign's star. A find still playing is cut short (its word is already in the Diário). */
export function startAchado(o: AchadoOpts): void {
  current?.finish();
  current = new Achado(o);
}

/** The server's new-word message for a sign: true when a find on screen was waiting for it (it plays instead of the new-word card). */
export function claimReadingWord(m: { pt: string }): boolean {
  const c = current;
  if (!c || c.confirmed || norm(c.o.word.pt) !== norm(m.pt)) return false;
  c.confirm();
  return true;
}

/** True while a find is on screen (the word queue's card waits for it). */
export function achadoPlaying(): boolean {
  return !!current;
}

class Achado {
  confirmed = false;
  private charged = false;
  private over = false;
  private readonly still = reduceMotion();
  private readonly timers: number[] = [];
  private readonly root: HTMLElement;
  private readonly dim: HTMLElement;
  private readonly orb: HTMLElement;
  private lockup: HTMLElement | null = null;

  constructor(readonly o: AchadoOpts) {
    const { px, py, size } = o.star;
    this.dim = h('div', { class: 'ach-dim', style: `--x:${px}px;--y:${py}px` });
    this.orb = h(
      'div',
      { class: `ach-orb${this.still ? ' still' : ''}`, style: `left:${px}px;top:${py}px;--s:${Math.max(14, size)}px` },
      h('i', { class: 'ach-halo' }),
      h('i', { class: 'ach-ring' }),
      h('i', { class: 'ach-ring two' }),
      h('b', { class: 'ach-star' }),
    );
    this.root = h('div', { id: 'achado', 'aria-live': 'polite', role: 'status' }, this.dim, this.orb);
    ui().append(this.root);
    o.claim(true);
    if (!this.still) ambience.achado('charge');
    this.later(() => {
      this.charged = true;
      if (this.confirmed) this.burst();
    }, this.still ? 0 : ACHADO_MS.charge);
    this.later(() => !this.confirmed && this.fizzle(), ACHADO_MS.wait);
  }

  private later(fn: () => void, ms: number) {
    this.timers.push(window.setTimeout(() => !this.over && fn(), ms));
  }

  /** The server granted the word. */
  confirm() {
    this.confirmed = true;
    if (this.charged) this.burst();
  }

  /** Nothing came of it (the word was already had, or the read was refused): the star sighs back into the world. */
  private fizzle() {
    ambience.achado('fizzle');
    this.orb.classList.add('fizzle');
    this.dim.classList.add('out');
    this.later(() => this.end(false), 420);
  }

  private burst() {
    const o = this.o;
    const now = performance.now();
    const n = nextStreak(streak, now);
    streak = { n, at: now };
    ambience.achado('burst', streakSemitones(n));
    this.orb.classList.add('burst');
    if (!this.still) {
      const { px, py } = o.star;
      this.root.append(
        h('i', { class: 'ach-flash', style: `left:${px}px;top:${py}px` }),
        h('i', { class: 'ach-rays', style: `left:${px}px;top:${py}px` }),
        h('i', { class: 'ach-shock', style: `left:${px}px;top:${py}px` }),
        h('i', { class: 'ach-shock two', style: `left:${px}px;top:${py}px` }),
      );
      this.sparks(px, py, 24);
    }
    const landed = this.letters(n);
    this.later(() => this.settle(), landed);
  }

  /** Sparks thrown out of the star, falling a little as they go. */
  private sparks(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (((i * 7919) % 100) / 100) * 0.5;
      const d = 80 + ((i * 37) % 11) * 13;
      const dx = Math.cos(a) * d;
      const dy = Math.sin(a) * d;
      const s = h('i', { class: `ach-spark${i % 3 === 0 ? ' star' : ''}`, style: `left:${x}px;top:${y}px;background:${SPARK_COLORS[i % SPARK_COLORS.length]}` });
      this.root.append(s);
      if (!canAnimate(s)) continue;
      s.animate(
        [
          { transform: 'translate(-50%, -50%) scale(1.2) rotate(0deg)', opacity: 1 },
          { transform: `translate(calc(-50% + ${dx * 0.75}px), calc(-50% + ${dy * 0.75 - 18}px)) scale(1) rotate(200deg)`, opacity: 1, offset: 0.5 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 46}px)) scale(0.2) rotate(380deg)`, opacity: 0 },
        ],
        { duration: 900 + ((i * 53) % 400), easing: 'cubic-bezier(0.15, 0.75, 0.3, 1)', fill: 'forwards' },
      );
    }
  }

  /** The word's letters fly out of the star into place. Returns the ms until the last one has landed. */
  private letters(n: number): number {
    const o = this.o;
    const size = letterSize(o.word.pt, window.innerWidth);
    const chars = [...o.word.pt];
    const spans = chars.map((ch, i) => h('span', { class: `ach-letter${ch === ' ' ? ' sp' : ''}`, style: `--i:${i}` }, ch === ' ' ? ' ' : ch));
    const word = h('b', { class: 'ach-word', lang: 'pt-BR' }, ...spans);
    const gloss = en(o.word.en);
    gloss.classList.add('ach-gloss');
    const kicker = h('div', { class: 'ach-kicker' }, n > 1 ? `Achou! ×${n}` : 'Achou!', h('span', { class: 'en' }, n > 1 ? ` · ${n} in a row` : ' · Found it'));
    const lockup = h('div', { class: 'ach-lockup', style: `--fs:${size}px` }, kicker, word, gloss, this.tallyChip());
    this.lockup = lockup;
    this.root.append(lockup);
    const box = lockup.getBoundingClientRect();
    const at = lockupSpot({ x: o.star.px, y: o.star.py }, { w: box.width, h: box.height }, { w: window.innerWidth, h: window.innerHeight, top: o.insets.top, bottom: o.insets.bottom });
    lockup.style.left = `${at.x}px`;
    lockup.style.top = `${at.y}px`;
    lockup.classList.add('placed');
    if (this.still || !canAnimate(word)) {
      lockup.classList.add('shown');
      return 300;
    }
    let last = 0;
    spans.forEach((sp, i) => {
      if (chars[i] === ' ') return;
      const r = sp.getBoundingClientRect();
      const dx = o.star.px - (r.left + r.width / 2);
      const dy = o.star.py - (r.top + r.height / 2);
      const side = (i % 2 ? 1 : -1) * (24 + ((i * 17) % 30));
      const spin = (i % 2 ? 1 : -1) * (180 + ((i * 41) % 180));
      const delay = 90 + i * ACHADO_MS.letterGap;
      last = Math.max(last, delay + ACHADO_MS.letterFly);
      const anim = sp.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(0.15) rotate(${spin}deg)`, opacity: 0 },
          { opacity: 1, offset: 0.12 },
          { transform: `translate(${dx * 0.4 + side}px, ${dy * 0.4 - 70}px) scale(1.4) rotate(${spin / 4}deg)`, offset: 0.58 },
          { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
        ],
        { duration: ACHADO_MS.letterFly, delay, easing: 'cubic-bezier(0.3, 0.7, 0.25, 1)', fill: 'both' },
      );
      anim.onfinish = () => {
        if (this.over) return;
        sp.classList.add('landed');
        ambience.achado('tick', ARPEGGIO[i % ARPEGGIO.length]!);
      };
    });
    lockup.classList.add('flying');
    return last + 60;
  }

  /** The room's tally: its name, a pip per hidden word (this one pops), and the count. */
  private tallyChip(): HTMLElement {
    const { found, total } = this.o.tally;
    const pips =
      total <= 16
        ? h(
            'span',
            { class: 'ach-pips' },
            ...Array.from({ length: total }, (_, i) => h('i', { class: i < found - 1 ? 'on' : i === found - 1 ? 'on new' : '' })),
          )
        : null;
    const done = found >= total;
    return h(
      'div',
      { class: `ach-tally${done ? ' complete' : ''}` },
      h('span', { class: 'ach-room' }, this.o.roomPt),
      pips,
      h('span', { class: 'ach-count' }, `${found}/${total}`),
      done ? h('span', { class: 'ach-done' }, 'Completa!', h('span', { class: 'en' }, ' · All found')) : null,
    );
  }

  /** Everything has landed: shimmer, say it, show the English and the tally; the room's last word sets off the finale. */
  private settle() {
    const lockup = this.lockup;
    if (!lockup) return;
    lockup.classList.add('shown', 'shine');
    speak(this.o.word.pt);
    const complete = this.o.tally.found >= this.o.tally.total && this.o.tally.total > 1;
    if (complete) this.later(() => this.finale(), 420);
    this.later(() => this.collect(), (this.still ? 2200 : ACHADO_MS.hold) + (complete ? ACHADO_MS.finale : 0));
  }

  /** The room's last hidden word: every sign of the room pings in turn, confetti falls, a music-box run. */
  private finale() {
    ambience.achado('complete');
    if (this.still) return;
    this.o.stars().forEach((p, i) => {
      const ping = h('i', { class: 'ach-ping', style: `left:${p.px}px;top:${p.py}px;animation-delay:${i * 130}ms` });
      this.root.append(ping);
    });
    const w = window.innerWidth;
    for (let i = 0; i < 46; i++) {
      const c = h('i', { class: `ach-confetti${i % 4 === 0 ? ' round' : ''}`, style: `left:${((i * 97) % 100) / 100 * w}px;background:${SPARK_COLORS[i % SPARK_COLORS.length]}` });
      this.root.append(c);
      if (!canAnimate(c)) continue;
      const drift = ((i * 31) % 120) - 60;
      c.animate(
        [
          { transform: `translate(0, -20px) rotate(0deg)`, opacity: 1 },
          { transform: `translate(${drift}px, ${window.innerHeight * 0.55}px) rotate(${360 + i * 25}deg)`, opacity: 1, offset: 0.7 },
          { transform: `translate(${drift * 1.4}px, ${window.innerHeight * 0.8}px) rotate(${540 + i * 25}deg)`, opacity: 0 },
        ],
        { duration: 1700 + ((i * 59) % 900), delay: (i % 12) * 40, easing: 'cubic-bezier(0.2, 0.6, 0.4, 1)', fill: 'both' },
      );
    }
  }

  /** The letters gather into one chip that flies into the Diário. */
  private collect() {
    const lockup = this.lockup;
    this.dim.classList.add('out');
    const word = lockup?.querySelector<HTMLElement>('.ach-word');
    if (!lockup || !word || this.still || !canAnimate(word)) {
      lockup?.classList.add('leaving');
      this.later(() => this.end(true), 360);
      return;
    }
    lockup.classList.add('gathering');
    const wr = word.getBoundingClientRect();
    const cx = wr.left + wr.width / 2;
    for (const sp of word.querySelectorAll<HTMLElement>('.ach-letter')) {
      const r = sp.getBoundingClientRect();
      sp.getAnimations().forEach((a) => a.cancel());
      sp.animate([{ transform: 'translate(0, 0) scale(1)' }, { transform: `translate(${cx - (r.left + r.width / 2)}px, 0) scale(0.5)`, opacity: 0.2 }], {
        duration: ACHADO_MS.gather,
        easing: 'cubic-bezier(0.6, 0, 0.8, 0.5)',
        fill: 'forwards',
      });
    }
    this.later(() => {
      const fs = parseFloat(getComputedStyle(word).fontSize) || 48;
      const target = diaryButton();
      ambience.achado('collect');
      lockup.classList.add('leaving');
      flyWord(
        { rect: new DOMRect(cx - wr.width * 0.2, wr.top, wr.width * 0.4, wr.height), text: this.o.word.pt, fontFamily: getComputedStyle(word).fontFamily, fontSize: fs * 0.55, fontWeight: '400', at: performance.now() },
        () => (target?.isConnected ? target.getBoundingClientRect() : null),
        () => 12,
        () => {
          if (target) {
            target.classList.remove('bump');
            void target.offsetWidth;
            target.classList.add('bump');
            window.setTimeout(() => target.classList.remove('bump'), 500);
          }
          ambience.achado('tick', 24);
        },
      );
      this.later(() => this.end(true), 300);
    }, ACHADO_MS.gather);
  }

  /** Cut short by a newer find. */
  finish() {
    this.end(this.confirmed);
  }

  private end(found: boolean) {
    if (this.over) return;
    this.over = true;
    for (const t of this.timers) window.clearTimeout(t);
    this.root.remove();
    if (!found) this.o.claim(false);
    if (current === this) current = null;
    this.o.done(found);
  }
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
