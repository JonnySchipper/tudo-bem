/**
 * The flight in: the cutscene a brand-new account plays between "Entrar na Praça" (the avatar creator) and the arrivals hall.
 * Animal Crossing's train ride, in Tudo Bem's clothes: the backstory over a night sky (you have never been to Brazil, you have no
 * Portuguese yet, Júlia's letter), the plane over the Atlantic, the cabin (you, in a window seat, and Comissária Lia, who asks you a few
 * questions in Portuguese with replies to pick), the sunrise, the captain calling the descent, the seatbelt, then the descent through the
 * clouds over São Paulo's hills, the touchdown at Vila Ipê, and the title card. Then the arrivals hall, where Lia is waiting.
 *
 * Everything is drawn by ui/flightArt.ts on one small canvas scaled up by a whole number; the characters are the game's own composed
 * sheets. The words live in @tudobem/shared (flightTalk.ts, voiced by `pnpm tts`). It can be skipped at any moment, and it saves nothing.
 */
import { FLIGHT_CABIN, FLIGHT_CAPTION, FLIGHT_PROLOGUE, FLIGHT_PROLOGUE_AFTER, FLIGHT_SEATBELT, FLIGHT_TITLE, JULIA_LETTER, ROOMS, STARTER_OUTFITS, DEFAULT_APPEARANCE, letterGreeting, type Appearance, type FlightBeat, type FlightLine } from '@tudobem/shared';
import { h } from './dom';
import { ambience } from '../ambience';
import { speak, stopSpeaking } from '../audio';
import { sharedCharAssets, type CharAssets } from '../render/pixel/charAssets';
import { composeLook } from '../render/pixel/composeLook';
import { lookForAppearance, lookForNpc, type Look } from '../render/pixel/looks';
import { NOD_S, nodDip } from '../render/pixel/emoteMotion';
import type { FlightSfx } from '../audio/flightSfx';
import {
  cabinLayout,
  drawCabin,
  drawCabinLight,
  drawCloudLayer,
  drawCloudSea,
  drawLand,
  drawMoon,
  drawPlane,
  drawPuffs,
  drawSeatBack,
  drawSeatFront,
  drawSky,
  drawStars,
  drawSun,
  drawTerminal,
  drawTrolley,
  drawZzz,
  makeCloudLayer,
  makeLand,
  makeStars,
  type Puff,
} from './flightArt';
import { flightScale, irisRadius } from './flightIntroLogic';

export interface FlightIntroOpts {
  name: string;
  appearance: Appearance;
}

type Shot = 'prologue' | 'outside' | 'cabin';

/** Thrown through every pending wait when the player skips. */
class Skipped extends Error {}

let active = false;
/** The cutscene is on screen (main.ts holds the room join until it ends). */
export const flightIntroActive = (): boolean => active;

// ---------------------------------------------------------------- characters

interface Sheet {
  canvas: HTMLCanvasElement;
  fw: number;
  fh: number;
}

function composeSheet(assets: CharAssets, look: Look): Sheet {
  const c = document.createElement('canvas');
  c.width = assets.sheetW;
  c.height = assets.sheetH;
  c.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(composeLook(assets, look)), assets.sheetW, assets.sheetH), 0, 0);
  const [fw, fh] = assets.manifest.sheet.frame;
  return { canvas: c, fw, fh };
}

/** The sheet rows (manifest `sheet.anims`): idle 0-3, walk 4-7, sit 8-11 (S W E N), then the emotes facing S. */
const ROW = { idleS: 0, idleW: 1, walkW: 5, walkE: 6, sitS: 8, rir: 14 } as const;

function drawFrame(ctx: CanvasRenderingContext2D, s: Sheet | null, row: number, col: number, footX: number, footY: number, flip = false) {
  if (!s) return;
  const x = Math.round(footX - s.fw / 2);
  const y = Math.round(footY - s.fh);
  if (flip) {
    ctx.save();
    ctx.translate(x + s.fw, y);
    ctx.scale(-1, 1);
    ctx.drawImage(s.canvas, col * s.fw, row * s.fh, s.fw, s.fh, 0, 0, s.fw, s.fh);
    ctx.restore();
  } else ctx.drawImage(s.canvas, col * s.fw, row * s.fh, s.fw, s.fh, x, y, s.fw, s.fh);
}

// ---------------------------------------------------------------- the cutscene

export function playFlightIntro(opts: FlightIntroOpts): Promise<void> {
  if (active) return Promise.resolve();
  active = true;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- DOM
  const canvas = h('canvas', { class: 'fl-canvas', 'aria-hidden': 'true' });
  const stage = h('div', { class: 'fl-stage' });
  const skipBtn = h('button', { class: 'fl-skip', type: 'button', 'aria-label': 'Pular a cena (skip the intro)' }, 'Pular ', h('span', { class: 'fl-skip-en' }, 'Skip'), ' ⏭');
  const root = h('div', { class: 'flight-intro', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Chegada ao Brasil (arrival in Brazil)' }, canvas, stage, skipBtn);
  document.body.append(root);
  const ctx = canvas.getContext('2d')!;

  // ---- world state, read by the render loop
  const S = {
    shot: 'prologue' as Shot,
    phase: 0,
    scroll: 0,
    speed: 26,
    /** the outside shot: the plane's altitude (1 cruising, 0 on the runway) and its place on screen */
    alt: 1,
    planeX: -0.3,
    pitch: 0,
    gear: 0,
    trail: 1,
    landed: false,
    shake: 0,
    whiteout: 0,
    fade: 1,
    iris: 1,
    irisX: 0.5,
    irisY: 0.5,
    sign: false,
    /** Lia in the aisle: x in art px from her mark (positive: still coming in from the right), and what she is doing */
    liaOff: 160,
    liaPose: 'walk' as 'walk' | 'idle' | 'oi' | 'rir' | 'walkOut',
    liaPoseT: 0,
    hop: 0,
    starsAlpha: 1,
    title: 0,
  };
  const puffs: Puff[] = [];
  const stars = makeStars(140);
  const farClouds = makeCloudLayer(3, 7, 520, [70, 22], 0, 0.25);
  const midClouds = makeCloudLayer(11, 5, 640, [96, 30], 0, 0.6);
  const nearClouds = makeCloudLayer(19, 4, 720, [150, 46], 0, 1.4);
  const windowClouds = [makeCloudLayer(5, 6, 300, [30, 10], 26, 0.5), makeCloudLayer(9, 4, 360, [44, 14], 34, 1)];
  const land = makeLand();
  let runwayX = 1e9;
  let terminalX = 1e9;

  // ---- characters
  let me: Sheet | null = null;
  let lia: Sheet | null = null;
  let sleeper: Sheet | null = null;
  const liaDef = ROOMS.desembarque.npcs.find((n) => n.id === 'comissaria');
  void sharedCharAssets()
    .then((assets) => {
      me = composeSheet(assets, lookForAppearance(opts.appearance, { hat: null }));
      lia = composeSheet(assets, lookForNpc('comissaria', liaDef?.appearance));
      sleeper = composeSheet(assets, lookForAppearance({ ...DEFAULT_APPEARANCE, ...STARTER_OUTFITS[0]!.set, skin: 4, hair: 'cacheado', hairColor: 0, topColor: 1, face: 'maduro', extra: 'oculos' }));
    })
    .catch(() => {
      /* the scene still plays: the seats are just empty */
    });

  // ---- tweens
  type Key = keyof typeof S;
  const tweens = new Map<Key, { from: number; to: number; t0: number; dur: number; ease: (k: number) => number; done: () => void }>();
  const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
  const easeOut = (k: number) => 1 - (1 - k) ** 3;
  const linear = (k: number) => k;
  function tween(key: Key, to: number, ms: number, ease = easeInOut): Promise<void> {
    const from = S[key] as number;
    const prev = tweens.get(key);
    prev?.done();
    if (ms <= 0 || reduced) {
      (S[key] as number) = to;
      return Promise.resolve();
    }
    return new Promise((resolve) => tweens.set(key, { from, to, t0: performance.now(), dur: ms, ease, done: resolve }));
  }

  // ---- skipping and waiting
  let skipped = false;
  const waiters = new Set<(e: Error) => void>();
  const wait = (ms: number) =>
    new Promise<void>((resolve, reject) => {
      if (skipped) return reject(new Skipped());
      const id = window.setTimeout(() => {
        waiters.delete(fail);
        resolve();
      }, ms);
      const fail = (e: Error) => {
        window.clearTimeout(id);
        reject(e);
      };
      waiters.add(fail);
    });
  /** Wait for the player (a click, Enter or Space) or `ms`, whichever comes first (ms 0: only the player). */
  let advance: (() => void) | null = null;
  const tap = (ms = 0) =>
    new Promise<void>((resolve, reject) => {
      if (skipped) return reject(new Skipped());
      let id = 0;
      const finish = () => {
        window.clearTimeout(id);
        waiters.delete(fail);
        advance = null;
        resolve();
      };
      const fail = (e: Error) => {
        window.clearTimeout(id);
        advance = null;
        reject(e);
      };
      advance = finish;
      waiters.add(fail);
      if (ms > 0) id = window.setTimeout(finish, ms);
    });
  let onSkip: (e: Error) => void = () => {};
  const skipping = new Promise<never>((_, reject) => (onSkip = reject));
  skipping.catch(() => {});
  /** A tween the film waits for: skipping does not wait for it to finish. */
  const play = (key: Key, to: number, ms: number, ease?: (k: number) => number) => Promise.race([tween(key, to, ms, ease), skipping]);
  const skip = () => {
    if (skipped) return;
    skipped = true;
    onSkip(new Skipped());
    for (const f of [...waiters]) f(new Skipped());
    waiters.clear();
  };
  skipBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    skip();
  });

  // ---- sound
  const sfx = (k: FlightSfx) => ambience.sfx(k);

  // ---- the render loop
  let raf = 0;
  let last = performance.now();
  const t0 = last;
  let scale = 3;
  let W = 256;
  let H = 144;
  const fit = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    scale = flightScale(vw, vh, S.shot === 'cabin' ? 150 : 150, S.shot === 'cabin' ? 130 : 150);
    W = Math.ceil(vw / scale);
    H = Math.ceil(vh / scale);
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    canvas.style.width = `${W * scale}px`;
    canvas.style.height = `${H * scale}px`;
    root.style.setProperty('--fl-scale', String(scale));
  };

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - t0) / 1000;
    for (const [key, tw] of tweens) {
      const k = Math.min(1, (now - tw.t0) / tw.dur);
      (S[key] as number) = tw.from + (tw.to - tw.from) * tw.ease(k);
      if (k >= 1) {
        tweens.delete(key);
        tw.done();
      }
    }
    S.scroll += S.speed * dt;
    S.shake = Math.max(0, S.shake - dt * 2.5);
    fit();
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const sh = reduced ? 0 : S.shake;
    if (sh > 0) ctx.translate(Math.round((Math.random() - 0.5) * 3 * sh), Math.round((Math.random() - 0.5) * 3 * sh));
    if (S.shot === 'cabin') renderCabin(t);
    else renderOutside(t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // the white of a cloud swallowing the plane
    if (S.whiteout > 0.01) {
      ctx.globalAlpha = S.whiteout;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    // the iris: Animal Crossing's circle wipe, centred on what the next shot is about
    if (S.iris < 0.999) {
      const r = irisRadius(S.iris, W, H, S.irisX, S.irisY);
      ctx.fillStyle = '#0b0820';
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.arc(Math.round(S.irisX * W), Math.round(S.irisY * H), Math.max(0, r), 0, Math.PI * 2, true);
      ctx.fill('evenodd');
    }
    if (S.fade > 0.01) {
      ctx.globalAlpha = S.fade;
      ctx.fillStyle = '#0b0820';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    placeBubble();
  };

  function renderOutside(t: number) {
    drawSky(ctx, 0, 0, W, H, S.phase, S.alt > 0.5 ? 0.8 : 0.72);
    drawStars(ctx, stars, 0, 0, W, H * 0.7, t, S.starsAlpha * (1 - Math.min(1, S.phase)), S.scroll);
    // on a tall phone the moon sits lower, clear of the caption
    if (S.phase < 1) drawMoon(ctx, W * 0.78, H * (H > W ? 0.3 : 0.2), 1 - S.phase);
    if (S.phase > 0.3) drawSun(ctx, W * 0.82, H * 0.62 - Math.min(2, S.phase) * H * 0.18, t, Math.min(1, (S.phase - 0.3) * 1.5));
    if (S.shot === 'prologue') {
      drawCloudSea(ctx, S.scroll * 0.4, 0, H * 0.84, W, H, S.phase);
      return;
    }
    // descending: the cloud layers slide up the screen as the plane comes down, and the ground rises to meet it
    const down = 1 - S.alt;
    const groundY = H * 0.72 + S.alt * (H * 0.9 + 90);
    const seaY = H * 0.8 - down * H * 1.6;
    drawCloudLayer(ctx, farClouds, S.scroll, 0, H * 0.62 - down * H * 0.5, W, S.phase, 0.9);
    if (seaY > -30) drawCloudSea(ctx, S.scroll * 0.5, 0, seaY, W, H, S.phase);
    if (groundY < H + 60) {
      drawLand(ctx, land, S.scroll, 0, W, groundY, S.phase, runwayX);
      if (terminalX < 1e8) drawTerminal(ctx, terminalX - S.scroll, groundY, t);
    }
    drawCloudLayer(ctx, midClouds, S.scroll, 0, H * 0.95 - down * H * 1.9, W, S.phase, 0.95);
    const px = S.planeX * W;
    const cruiseY = H * 0.42 + Math.sin(t * 1.3) * 1.5 * S.alt;
    const py = S.landed ? groundY - 13 : cruiseY + (groundY - 13 - cruiseY) * Math.max(0, 1 - S.alt * 4);
    drawPuffs(ctx, puffs, t);
    drawPlane(ctx, { x: px, y: py, pitch: S.pitch, lit: S.phase < 1.2, gear: S.gear, t, lights: true, trail: S.trail });
    drawCloudLayer(ctx, nearClouds, S.scroll, 0, H * 1.3 - down * H * 2.6, W, S.phase, 1);
    // the title card's warm wash
    if (S.title > 0.01) {
      ctx.globalAlpha = S.title * 0.25;
      ctx.fillStyle = '#ffcf6a';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  function renderCabin(t: number) {
    const L = cabinLayout(W, H);
    drawCabin(ctx, W, H, L, { t, phase: S.phase, scroll: S.scroll, stars, clouds: windowClouds, sign: S.sign, shake: S.shake });
    // the row: a sleeping neighbour across the aisle side, the player by the window
    drawSeatBack(ctx, L.mySeat, L.seatY);
    drawSeatBack(ctx, L.nextSeat, L.seatY);
    const breathe = Math.sin(t * 1.4) > 0.6 ? 1 : 0;
    drawFrame(ctx, sleeper, ROW.sitS, 0, L.nextSeat, L.seatY + 2 + breathe);
    drawFrame(ctx, me, ROW.sitS, 0, L.mySeat, L.seatY + 2 - Math.round(S.hop));
    drawSeatFront(ctx, L.mySeat, L.seatY);
    drawSeatFront(ctx, L.nextSeat, L.seatY);
    drawZzz(ctx, L.nextSeat + 5, L.seatY - 20, t);
    // Lia and her trolley in the aisle
    const lx = L.aisleX + S.liaOff;
    drawTrolley(ctx, lx + 8, L.floorY + 2);
    let row: number = ROW.idleS;
    let col = Math.floor(t * 5) % 6;
    let flip = false;
    let nod = 0;
    if (S.liaPose === 'walk') {
      row = ROW.walkW;
      col = Math.floor(t * 10) % 6;
    } else if (S.liaPose === 'walkOut') {
      row = ROW.walkE;
      col = Math.floor(t * 10) % 6;
    } else if (S.liaPose === 'oi') {
      // nobody waves (the oi row raises an arm): Lia greets you with a small nod, turned to you
      const k = (performance.now() - S.liaPoseT) / 1000;
      row = ROW.idleW;
      nod = nodDip(k, reduced);
      if (k >= NOD_S) S.liaPose = 'idle';
    } else if (S.liaPose === 'rir') {
      const k = (performance.now() - S.liaPoseT) / 1000;
      if (k < (4 / 8) * 2) {
        row = ROW.rir;
        col = Math.floor(k * 8) % 4;
      } else S.liaPose = 'idle';
    } else {
      // turned to the player, a little to her right
      row = ROW.idleW;
      flip = false;
    }
    drawFrame(ctx, lia, row, col, lx, L.floorY + 2 + nod, flip);
    drawCabinLight(ctx, W, H, L, S.phase, t);
  }

  // ---- the talking
  const box = h('div', { class: 'fl-box', 'aria-live': 'polite' });
  const choices = h('div', { class: 'fl-choices', role: 'listbox' });
  const bubble = h('div', { class: 'fl-bubble' });
  stage.append(box, choices, bubble);
  let bubbleOn = false;
  function placeBubble() {
    if (!bubbleOn || S.shot !== 'cabin') return;
    const L = cabinLayout(W, H);
    bubble.style.left = `${L.mySeat * scale}px`;
    bubble.style.top = `${(L.seatY - 22) * scale}px`;
  }

  /**
   * Type a line out, letter by letter (by the clock, so a slow frame never slows the words), pausing after punctuation; soft blips under
   * it when nobody is speaking it aloud. A click shows the rest at once. Resolves once it is all on screen.
   */
  async function typeLine(el: HTMLElement, text: string, blips: boolean) {
    const chars = Array.from(text);
    const at: number[] = [];
    let total = 0;
    for (const c of chars) {
      at.push(total);
      total += reduced ? 0 : /[.!?…]/.test(c) ? 240 : c === ',' ? 130 : 30;
    }
    const start = performance.now();
    let rush = false;
    let shown = 0;
    let lastBlip = 0;
    const prevAdvance = advance;
    advance = () => (rush = true);
    try {
      while (shown < chars.length) {
        if (skipped) throw new Skipped();
        const now = performance.now();
        let k = rush ? chars.length : at.findIndex((t) => t > now - start);
        if (k < 0) k = chars.length;
        if (k !== shown) {
          shown = k;
          el.textContent = chars.slice(0, shown).join('');
          if (blips && !rush && now - lastBlip > 65 && /\S/.test(chars[shown - 1] ?? '')) {
            lastBlip = now;
            sfx('blip');
          }
        }
        if (shown < chars.length) await wait(16);
      }
    } finally {
      advance = prevAdvance;
    }
  }

  type Who = 'lia' | 'captain' | 'think' | 'narr';
  async function say(who: Who, line: FlightLine | { en: string }, o: { wait?: boolean } = {}) {
    const pt = 'pt' in line ? line.pt : null;
    box.className = `fl-box fl-${who} is-on`;
    const name = who === 'lia' ? h('div', { class: 'fl-name' }, 'Lia', h('span', { class: 'fl-role' }, 'comissária · flight attendant')) : who === 'captain' ? h('div', { class: 'fl-name fl-name-pa' }, '📢 Comandante', h('span', { class: 'fl-role' }, 'captain')) : null;
    const ptEl = h('p', { class: 'fl-pt', lang: pt ? 'pt-BR' : 'en' });
    const enEl = h('p', { class: 'fl-en' });
    const next = h('div', { class: 'fl-next', 'aria-hidden': 'true' }, '▼');
    box.replaceChildren(...([name, ptEl, pt ? enEl : null, next].filter((x) => x !== null) as HTMLElement[]));
    if (pt) {
      speak(pt, { speaker: who === 'captain' ? 'comandante' : 'comissaria' });
      await typeLine(ptEl, pt, false);
      enEl.textContent = line.en;
      enEl.classList.add('is-on');
    } else await typeLine(ptEl, line.en, true);
    box.classList.add('is-done');
    if (o.wait !== false) await tap();
    box.classList.remove('is-done');
  }

  async function ask(line: FlightLine, replies: { pt: string; en: string }[]): Promise<number> {
    await say('lia', line, { wait: false });
    box.classList.remove('is-done');
    let picked = -1;
    let focus = 0;
    const buttons = replies.map((r, i) =>
      h(
        'button',
        { class: 'fl-choice', type: 'button', role: 'option', onclick: (e: Event) => (e.stopPropagation(), choose(i)) },
        h('span', { class: 'fl-choice-pt', lang: 'pt-BR' }, r.pt),
        h('span', { class: 'fl-choice-en' }, r.en),
      ),
    );
    const mark = () => buttons.forEach((b, i) => b.classList.toggle('is-focus', i === focus));
    choices.replaceChildren(...buttons);
    choices.classList.add('is-on');
    mark();
    let resolvePick: (i: number) => void = () => {};
    const choose = (i: number) => {
      if (picked >= 0) return;
      picked = i;
      resolvePick(i);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') focus = (focus + 1) % replies.length;
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') focus = (focus + replies.length - 1) % replies.length;
      else if (e.key === 'Enter' || e.key === ' ') choose(focus);
      else if (/^[1-9]$/.test(e.key) && Number(e.key) <= replies.length) choose(Number(e.key) - 1);
      else return;
      e.preventDefault();
      e.stopPropagation();
      mark();
    };
    window.addEventListener('keydown', onKey, true);
    try {
      const i = await new Promise<number>((resolve, reject) => {
        resolvePick = resolve;
        const fail = (e: Error) => reject(e);
        waiters.add(fail);
      });
      sfx('pick');
      choices.classList.remove('is-on');
      box.classList.remove('is-on');
      // the player says it: a speech bubble over the seat, and a little hop
      bubble.replaceChildren(h('span', { lang: 'pt-BR' }, replies[i]!.pt));
      bubbleOn = true;
      bubble.classList.add('is-on');
      void tween('hop', 2, 120, easeOut).then(() => tween('hop', 0, 180));
      await wait(1100);
      bubble.classList.remove('is-on');
      bubbleOn = false;
      return i;
    } finally {
      window.removeEventListener('keydown', onKey, true);
    }
  }

  async function narrate(lines: readonly string[]) {
    for (const text of lines) {
      const el = h('p', { class: 'fl-narr' });
      stage.append(el);
      requestAnimationFrame(() => el.classList.add('is-on'));
      await typeLine(el, text, true);
      await tap(2600);
      el.classList.remove('is-on');
      el.classList.add('is-out');
      await wait(450);
      el.remove();
    }
  }

  async function letter() {
    const card = h(
      'div',
      { class: 'fl-letter' },
      h('div', { class: 'fl-envelope', 'aria-hidden': 'true' }, h('div', { class: 'fl-flap' }), h('div', { class: 'fl-stamp' }, h('span', null, '🌼'), h('b', null, JULIA_LETTER.stamp)), h('div', { class: 'fl-postmark' }, JULIA_LETTER.postmark)),
      h(
        'div',
        { class: 'fl-paper' },
        h('p', { class: 'fl-greet', lang: 'pt-BR' }, letterGreeting(opts.name)),
        ...JULIA_LETTER.body.map((p) => h('p', null, p)),
        h('p', { class: 'fl-sign' }, h('span', { lang: 'pt-BR' }, JULIA_LETTER.signoff), h('b', null, JULIA_LETTER.signature), h('span', { class: 'fl-heart', 'aria-hidden': 'true' }, '♥')),
        h('div', { class: 'fl-tap' }, 'Clique para continuar · click to continue'),
      ),
    );
    stage.append(card);
    requestAnimationFrame(() => card.classList.add('is-in'));
    await wait(reduced ? 200 : 900);
    sfx('cloud');
    card.classList.add('is-open');
    await wait(reduced ? 200 : 1300);
    card.classList.add('is-read');
    await tap();
    card.classList.add('is-out');
    await wait(600);
    card.remove();
  }

  function caption(line: { pt: string; en: string }) {
    const el = h('div', { class: 'fl-caption' }, h('b', { lang: 'pt-BR' }, line.pt), h('span', null, line.en));
    stage.append(el);
    requestAnimationFrame(() => el.classList.add('is-on'));
    return () => {
      el.classList.remove('is-on');
      window.setTimeout(() => el.remove(), 800);
    };
  }

  async function seatbelt() {
    await say('lia', FLIGHT_SEATBELT.ask, { wait: false });
    box.classList.remove('is-done');
    const btn = h(
      'button',
      { class: 'fl-belt', type: 'button' },
      h('span', { class: 'fl-belt-icon', 'aria-hidden': 'true' }, '🔒'),
      h('span', { class: 'fl-choice-pt', lang: 'pt-BR' }, FLIGHT_SEATBELT.button.pt),
      h('span', { class: 'fl-choice-en' }, FLIGHT_SEATBELT.button.en),
    );
    choices.replaceChildren(btn);
    choices.classList.add('is-on');
    btn.focus();
    await new Promise<void>((resolve, reject) => {
      btn.addEventListener('click', (e) => (e.stopPropagation(), resolve()), { once: true });
      waiters.add((e) => reject(e));
    });
    sfx('buckle');
    btn.classList.add('is-done');
    void tween('hop', 1, 80).then(() => tween('hop', 0, 120));
    await wait(500);
    choices.classList.remove('is-on');
    S.liaPose = 'oi';
    S.liaPoseT = performance.now();
    await say('lia', FLIGHT_SEATBELT.done);
  }

  async function beat(b: FlightBeat) {
    if (b.kind === 'think') return say('think', { en: b.en });
    if (b.kind === 'captain') {
      sfx('pa');
      await wait(350);
      return say('captain', b.line);
    }
    if (b.kind === 'lia') {
      if (b.mood === 'wave' || b.mood === 'laugh') {
        S.liaPose = b.mood === 'wave' ? 'oi' : 'rir';
        S.liaPoseT = performance.now();
      }
      return say('lia', b.line);
    }
    const i = await ask(b.line, b.replies);
    if (i === 0 || b.replies[i]!.react.pt.startsWith('Tudo bem')) {
      S.liaPose = 'rir';
      S.liaPoseT = performance.now();
    }
    await say('lia', b.replies[i]!.react);
  }

  // ---- input: click or Enter/Space anywhere advances
  const onTap = (e: Event) => {
    if ((e.target as HTMLElement).closest('.fl-choice, .fl-belt, .fl-skip')) return;
    advance?.();
  };
  const onKey = (e: KeyboardEvent) => {
    // the world under the cutscene (chat, hotkeys, walking) hears nothing while it plays
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      skip();
    } else if (e.key === 'Enter' || e.key === ' ') {
      if ((e.target as HTMLElement).closest?.('.fl-choice, .fl-belt, .fl-skip')) return;
      e.preventDefault();
      advance?.();
    }
  };
  root.addEventListener('pointerdown', onTap);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', fit);

  // ---- the film
  async function film() {
    ambience.setScene('voo');
    fit();
    raf = requestAnimationFrame(frame);

    // 1. the backstory, over the night sky
    S.shot = 'prologue';
    S.speed = 10;
    await play('fade', 0, 1600);
    await narrate(FLIGHT_PROLOGUE);
    await letter();
    await narrate(FLIGHT_PROLOGUE_AFTER);

    // 2. the plane over the Atlantic
    await play('fade', 1, 700);
    S.shot = 'outside';
    S.alt = 1;
    S.planeX = -0.35;
    S.speed = 40;
    await play('fade', 0, 900);
    const hideCaption = caption(FLIGHT_CAPTION);
    await play('planeX', 0.5, reduced ? 0 : 5200, easeOut);
    await tap(2200);
    hideCaption();
    // the iris closes on the plane's windows, and opens on the cabin
    S.irisX = 0.5;
    S.irisY = 0.42;
    await play('iris', 0, 900, easeInOut);
    S.shot = 'cabin';
    S.speed = 30;
    S.liaOff = 150;
    S.liaPose = 'walk';
    fit();
    const L = cabinLayout(W, H);
    S.irisX = L.mySeat / W;
    S.irisY = (L.seatY - 14) / H;
    await play('iris', 1, 1100, easeInOut);

    // 3. the cabin
    const walkIn = tween('liaOff', 0, reduced ? 0 : 3200, linear).then(() => {
      S.liaPose = 'idle';
    });
    await beat(FLIGHT_CABIN[0]!);
    await walkIn;
    S.liaPose = 'oi';
    S.liaPoseT = performance.now();
    for (const b of FLIGHT_CABIN.slice(1)) {
      if (b.kind === 'lia' && b.mood === 'wave') void tween('phase', 1, 6500, linear);
      if (b.kind === 'captain' && !S.sign) {
        S.sign = true;
        sfx('seatbelt');
        await wait(1200);
      }
      await beat(b);
    }
    await seatbelt();
    box.classList.remove('is-on');
    S.liaPose = 'walkOut';
    await play('liaOff', 170, reduced ? 0 : 2600, linear);
    await wait(300);

    // 4. down through the clouds, over the hills, onto the runway
    S.irisX = cabinLayout(W, H).mySeat / W;
    S.irisY = 0.4;
    await play('iris', 0, 900);
    S.shot = 'outside';
    S.planeX = 0.42;
    S.phase = 1;
    S.alt = 1;
    S.speed = 70;
    S.pitch = 0.05;
    S.trail = 0;
    S.starsAlpha = 0;
    fit();
    S.irisX = 0.42;
    S.irisY = 0.42;
    void tween('phase', 2, 9000, linear);
    await play('iris', 1, 1000);
    ambience.setBoost(1);
    const descent = 9000;
    runwayX = S.scroll + S.speed * (descent / 1000) + S.planeX * W - 34;
    const brake = 4200;
    // where the plane stops (the braking curve covers a third of speed x time): the terminal stands right behind it
    terminalX = runwayX + 34 + (S.speed * brake) / 3000 - 64;
    const down = tween('alt', 0, descent, (k) => k);
    window.setTimeout(() => !skipped && (sfx('cloud'), void tween('whiteout', 0.85, 500).then(() => tween('whiteout', 0, 900))), descent * 0.18);
    window.setTimeout(() => !skipped && (sfx('gear'), void tween('gear', 1, 1200)), descent * 0.55);
    window.setTimeout(() => !skipped && void tween('pitch', -0.05, 1100), descent * 0.85);
    await down;
    // touchdown
    S.landed = true;
    S.shake = 1;
    sfx('touchdown');
    const tt = (performance.now() - t0) / 1000;
    const groundY = H * 0.72;
    const wx = S.planeX * W;
    for (let i = 0; i < 9; i++) puffs.push({ x: wx - 6 + Math.random() * 6, y: groundY - 2, born: tt + i * 0.05, vx: -26 - Math.random() * 20, vy: -4 - Math.random() * 5, r: 2 + Math.random() * 2 });
    void tween('pitch', 0, 600);
    await wait(250);
    sfx('roar');
    S.shake = 0.6;
    await play('speed', 0, brake, (k) => 1 - (1 - k) * (1 - k));

    // 5. the title card
    ambience.setScene(null);
    ambience.sting('pouso');
    void tween('title', 1, 900);
    const card = h(
      'div',
      { class: 'fl-title' },
      h('div', { class: 'fl-title-big', 'aria-label': FLIGHT_TITLE.big }, ...Array.from(FLIGHT_TITLE.big).map((ch, i) => h('span', { style: `--i:${i}`, 'aria-hidden': 'true' }, ch))),
      h('div', { class: 'fl-title-sub' }, h('b', { lang: 'pt-BR' }, FLIGHT_TITLE.pt), ' · ', FLIGHT_TITLE.en),
      h('div', { class: 'fl-tap' }, 'Clique para continuar · click to continue'),
    );
    stage.append(card);
    requestAnimationFrame(() => card.classList.add('is-on'));
    await wait(1600);
    card.classList.add('is-ready');
    await tap(9000);
  }

  return film()
    .catch((e) => {
      if (!(e instanceof Skipped)) console.error('[flight] the cutscene failed, skipping to the arrivals hall', e);
    })
    .then(async () => {
      stopSpeaking();
      ambience.setScene(null);
      root.classList.add('is-leaving');
      await new Promise((r) => window.setTimeout(r, reduced ? 50 : 700));
      cancelAnimationFrame(raf);
      root.removeEventListener('pointerdown', onTap);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', fit);
      root.remove();
      active = false;
    });
}
