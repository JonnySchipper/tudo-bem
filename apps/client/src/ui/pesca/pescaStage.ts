/**
 * The fishing stage (PRAIA-PLAN.md 2.1, 2.2): a full-screen pixel canvas over the world (the backdrop of the water you fish, the rod, the
 * line, the bobber, the fish's shadow) and one transparent hit layer: press anywhere to hold, let go to release (Space mirrors it, Esc
 * twice leaves). No digits anywhere: the power is an arc, the tension a ring, the size a word. `window.__tb.pesca` drives it in DEV.
 */
import { FISH, JUNK, PESCA_STAGE, SIZE_WORDS, isFishId, runAt, type Bilingual, type PescaOutcome, type ServerMsg, type WaterId } from '@tudobem/shared';
import { imageUrl } from '../../render/pixel/manifest';
import { speak } from '../../audio';
import { h, bi } from '../dom';
import { foodIcon } from '../pixelArt';
import { PescaPlay, type PescaCue } from './pescaPlay';

const W = 320;
const H = 180;

export interface StageHooks {
  cast(power: number): void;
  result(seq: number, events: PescaPlay['events']): void;
  quit(): void;
  /** the stage closed (any way) */
  closed(): void;
  /** the first cast ever shows the "Segura… solta!" label */
  firstCast: boolean;
  /** a rented boat's spot: "Devolver o barco" (Step D) */
  returnBoat?: () => void;
}

const imgCache = new Map<string, HTMLImageElement>();
function img(key: string): HTMLImageElement {
  let i = imgCache.get(key);
  if (!i) {
    i = new Image();
    i.src = imageUrl(key);
    imgCache.set(key, i);
  }
  return i;
}

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export class PescaStage {
  readonly play = new PescaPlay();
  private root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pops: HTMLElement;
  private ring: HTMLElement;
  private label: HTMLElement;
  private card: HTMLElement;
  private raf = 0;
  private shake = 0;
  private escAt = 0;
  private dip = 0;
  private splash: { x: number; y: number; t: number }[] = [];
  private open = true;
  private showingCard = false;

  constructor(
    readonly water: WaterId,
    private readonly hooks: StageHooks,
  ) {
    this.canvas = h('canvas', { class: 'pesca-canvas', width: W, height: H }) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.pops = h('div', { class: 'pesca-pops', 'aria-live': 'polite' });
    this.ring = h('div', { class: 'pesca-ring', hidden: true });
    this.label = h('div', { class: 'pesca-label', hidden: !hooks.firstCast }, bi(PESCA_STAGE.segura.pt, PESCA_STAGE.segura.en));
    this.card = h('div', { class: 'pesca-card', hidden: true });
    const leave = h('button', { class: 'pesca-leave', type: 'button', onclick: (e: Event) => (e.stopPropagation(), this.close()) }, bi('Sair', 'Leave'));
    const back = hooks.returnBoat
      ? h('button', { class: 'pesca-leave pesca-return', type: 'button', onclick: (e: Event) => (e.stopPropagation(), this.close(), hooks.returnBoat!()) }, bi('Devolver o barco', 'Return the boat'))
      : null;
    const hit = h('div', { class: 'pesca-hit', role: 'button', 'aria-label': 'Segure para lançar e puxar, solte para soltar (Hold to cast and reel, let go to release)' });
    hit.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.down();
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) hit.addEventListener(ev, () => this.up());
    this.root = h('div', { id: 'pesca-root', class: `pesca-root pesca-${water}` }, this.canvas, this.ring, this.label, this.pops, hit, this.card, h('div', { class: 'pesca-top' }, back, leave));
    (document.getElementById('ui') ?? document.body).append(this.root);
    document.body.classList.add('pesca-on');
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.fit);
    this.fit();
    this.raf = requestAnimationFrame(this.frame);
  }

  private fit = () => {
    const z = Math.max(1, Math.floor(Math.min(window.innerWidth / W, window.innerHeight / H)));
    this.canvas.style.width = `${W * z}px`;
    this.canvas.style.height = `${H * z}px`;
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) this.down();
    } else if (e.code === 'Escape') {
      const now = performance.now();
      if (now - this.escAt < 900) this.close();
      else this.popText({ pt: 'Esc de novo pra sair', en: 'Esc again to leave' });
      this.escAt = now;
    }
  };
  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') this.up();
  };

  down() {
    if (!this.open) return;
    if (this.showingCard) return this.hideCard();
    this.cues(this.play.press(performance.now()));
  }

  up() {
    if (!this.open) return;
    const r = this.play.release(performance.now());
    this.cues(r.cues);
    if (r.castPower !== null) {
      this.label.hidden = true;
      this.hooks.cast(r.castPower);
    }
  }

  /** The server's cast arrived: the bobber flies out. */
  onCast(m: Extract<ServerMsg, { t: 'pesca'; phase: 'cast' }>) {
    this.play.onCast(m, performance.now());
    const b = this.bobber();
    this.splash.push({ x: b.x, y: b.y, t: performance.now() });
  }

  /** The cast was refused (too soon, busy): aim again. */
  refused() {
    this.play.reset();
  }

  /** The server's verdict: the card. */
  onResult(m: Extract<ServerMsg, { t: 'pesca'; phase: 'result' }>) {
    if (m.line) speak(m.line.pt, { speaker: m.line.speaker });
    this.showCard(m.outcome, m.newSpecies, m.record);
  }

  private cues(list: PescaCue[]) {
    for (const c of list) {
      if (c === 'tangle') {
        this.say(PESCA_STAGE.enrolou);
        this.shakeIt(6);
      } else if (c === 'nibble') this.dip = 3;
      else if (c === 'bite') {
        this.dip = 10;
        this.say(PESCA_STAGE.fisgou);
        navigator.vibrate?.(40);
      } else if (c === 'hooked') this.dip = 0;
      else if (c === 'early') this.say(PESCA_STAGE.cedo);
      else if (c === 'late') this.say(PESCA_STAGE.escapou);
      else if (c === 'run_soon') this.dip = 4;
      else if (c === 'snapped') {
        this.say(PESCA_STAGE.arrebentou);
        this.shakeIt(10);
      } else if (c === 'escaped') this.say(PESCA_STAGE.escapou);
      else if (c === 'landed') {
        const b = this.bobber();
        this.splash.push({ x: b.x, y: b.y, t: performance.now() });
      }
    }
  }

  private say(l: Bilingual) {
    this.popText(l);
    speak(l.pt, { speaker: 'ui' });
  }

  private popText(l: Bilingual) {
    const el = h('div', { class: 'pesca-pop' }, bi(l.pt, l.en));
    this.pops.append(el);
    window.setTimeout(() => el.remove(), 1600);
  }

  private shakeIt(px: number) {
    if (!reduced()) this.shake = px;
  }

  private showCard(o: PescaOutcome, isNew: boolean, record: boolean) {
    const body: (HTMLElement | null)[] = [];
    if (o.kind === 'caught') {
      const d = FISH[o.fish];
      speak(d.pt, { speaker: 'ui' });
      body.push(
        foodIcon(`peixe_${o.fish}`, 6, d.pt, 'pesca-card-fish'),
        h('div', { class: 'pesca-card-name' }, d.pt),
        h('div', { class: 'pesca-card-en' }, d.en),
        h('div', { class: 'pesca-card-size' }, bi(SIZE_WORDS[o.sizeWord].pt, SIZE_WORDS[o.sizeWord].en)),
        isNew ? h('div', { class: 'pesca-card-new' }, bi(PESCA_STAGE.novo.pt, PESCA_STAGE.novo.en)) : null,
        record ? h('div', { class: 'pesca-card-new' }, bi(PESCA_STAGE.recorde.pt, PESCA_STAGE.recorde.en)) : null,
      );
      this.say(PESCA_STAGE.pegou);
    } else if (o.kind === 'junk') {
      const j = JUNK[o.junk];
      speak(j.pt, { speaker: 'ui' });
      body.push(foodIcon(o.junk === 'garrafa' ? 'garrafa_mensagem' : o.junk, 6, j.pt, 'pesca-card-fish'), h('div', { class: 'pesca-card-name' }, j.pt), h('div', { class: 'pesca-card-en' }, j.en));
    } else if (o.kind === 'released') {
      body.push(foodIcon('peixe_baiacu', 6, 'baiacu', 'pesca-card-fish pesca-puff'), h('div', { class: 'pesca-card-name' }, PESCA_STAGE.baiacu.pt), h('div', { class: 'pesca-card-en' }, PESCA_STAGE.devolve.pt, ' ', h('span', { class: 'en' }, PESCA_STAGE.devolve.en)));
      this.say(PESCA_STAGE.baiacu);
    } else {
      // nothing on the hook: the next cast is right away
      this.play.reset();
      return;
    }
    this.card.replaceChildren(h('div', { class: 'pesca-card-inner' }, ...body, h('div', { class: 'pesca-card-tap' }, bi('Toque pra lançar de novo', 'Tap to cast again'))));
    this.card.hidden = false;
    this.showingCard = true;
  }

  private hideCard() {
    this.card.hidden = true;
    this.showingCard = false;
    this.play.reset();
  }

  /** Where the bobber floats: farther (higher, smaller) the harder the cast. */
  private bobber(): { x: number; y: number } {
    const p = this.play.power;
    return { x: Math.round(150 - p * 90), y: Math.round(140 - p * 50) };
  }

  private frame = (now: number) => {
    if (!this.open) return;
    const { cues, done } = this.play.tick(now);
    this.cues(cues);
    if (done) this.hooks.result(this.play.seq, this.play.events);
    this.draw(now);
    this.raf = requestAnimationFrame(this.frame);
  };

  private draw(now: number) {
    const c = this.ctx;
    const sx = this.shake ? Math.round((Math.random() - 0.5) * this.shake) : 0;
    const sy = this.shake ? Math.round((Math.random() - 0.5) * this.shake) : 0;
    this.shake = Math.max(0, this.shake - 0.6);
    c.save();
    c.translate(sx, sy);
    const bg = img(`pesca/fundo_${this.water}`);
    if (bg.complete && bg.naturalWidth) c.drawImage(bg, 0, 0);
    else {
      c.fillStyle = '#3fa9a0';
      c.fillRect(0, 0, W, H);
    }
    const play = this.play;
    // the distance rings (perto, meio, longe) while aiming: faint, never numbered
    if (play.phase === 'aim' || play.phase === 'casting') {
      c.fillStyle = 'rgba(242,250,246,0.35)';
      for (const p of [0.15, 0.5, 0.85]) {
        const x = Math.round(150 - p * 90), y = Math.round(140 - p * 50);
        for (let a = 0; a < 16; a++) c.fillRect(Math.round(x + Math.cos((a / 16) * Math.PI * 2) * 6), Math.round(y + Math.sin((a / 16) * Math.PI * 2) * 2), 1, 1);
      }
    }
    // the rod: its tip bends down with a run, and with the tension
    const tension = play.phase === 'fight' ? play.fight.tension : 0;
    const bend = Math.round(this.dip * 0.6 + tension * 8);
    const tip = { x: 262, y: 88 + bend };
    const rod = img('pesca/vara');
    if (rod.complete && rod.naturalWidth) c.drawImage(rod, 256, 84 + Math.round(bend / 2));
    // the power arc under the tip while the cast is held
    if (play.phase === 'aim' && play.holdStart !== null) {
      c.fillStyle = '#f8d239';
      const n = Math.round(play.power * 20);
      for (let i = 0; i < n; i++) c.fillRect(tip.x - 6 - i * 3, tip.y + 10 + Math.round(Math.sin((i / 20) * Math.PI) * -8), 2, 2);
    }
    // the line, the bobber and the fish
    if (play.phase === 'wait' || play.phase === 'fight' || play.phase === 'sent') {
      let b = this.bobber();
      if (play.phase === 'fight' && play.roll) {
        // the fish comes in as progress grows; it swims sideways while it runs
        const pr = play.fight.progress;
        const running = runAt(play.roll, play.fight.t);
        b = { x: Math.round(b.x + (tip.x - 30 - b.x) * pr + (running ? Math.sin(now / 90) * 6 : 0)), y: Math.round(b.y + (160 - b.y) * pr) };
        c.fillStyle = 'rgba(31,44,74,0.45)';
        c.beginPath();
        c.ellipse(b.x, b.y + 4, 10 + (play.roll.cm > 100 ? 8 : 0), 3, 0, 0, Math.PI * 2);
        c.fill();
      }
      const bob = Math.round(Math.sin(now / 300) * 1) + this.dip;
      this.dip = Math.max(0, this.dip - 0.3);
      c.strokeStyle = 'rgba(248,248,248,0.85)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(tip.x + 0.5, tip.y + 0.5);
      c.quadraticCurveTo((tip.x + b.x) / 2, Math.max(tip.y, b.y) + 12 - tension * 10, b.x + 0.5, b.y + bob + 0.5);
      c.stroke();
      if (play.phase !== 'fight') {
        const bo = img('pesca/boia');
        if (bo.complete && bo.naturalWidth) c.drawImage(bo, b.x - 4, b.y - 6 + bob);
        // three dots over a nibbling bobber
        if (this.dip > 1 && this.dip < 5) {
          c.fillStyle = '#f2faf6';
          for (let i = 0; i < 3; i++) c.fillRect(b.x - 4 + i * 4, b.y - 12, 2, 2);
        }
      }
    }
    // splashes
    this.splash = this.splash.filter((s) => now - s.t < 500);
    c.fillStyle = '#f2faf6';
    for (const s of this.splash) {
      const k = (now - s.t) / 500;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI;
        c.fillRect(Math.round(s.x + Math.cos(a) * 10 * k), Math.round(s.y - Math.sin(a) * 12 * k + 20 * k * k), 2, 2);
      }
    }
    c.restore();
    // the tension ring (DOM): fills while the line is held against a run
    if (play.phase === 'fight') {
      this.ring.hidden = false;
      const deg = Math.round(play.fight.tension * 360);
      this.ring.style.setProperty('--fill', `${deg}deg`);
      this.ring.classList.toggle('hot', play.fight.tension > 0.7);
      this.ring.classList.toggle('held', play.holding);
    } else this.ring.hidden = true;
  }

  /** DEV / e2e driver (window.__tb.pesca). */
  driver() {
    return {
      state: () => ({ phase: this.play.phase, power: this.play.power, tension: this.play.fight.tension, progress: this.play.fight.progress, roll: this.play.roll, card: this.showingCard }),
      press: () => this.down(),
      release: () => this.up(),
      close: () => this.close(),
    };
  }

  close() {
    if (!this.open) return;
    this.open = false;
    if (this.play.phase === 'wait' || this.play.phase === 'fight') {
      this.play.quit(performance.now());
      this.hooks.result(this.play.seq, this.play.events);
    }
    this.hooks.quit();
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.fit);
    document.body.classList.remove('pesca-on');
    this.root.remove();
    this.hooks.closed();
  }
}

export const isFish = isFishId;
