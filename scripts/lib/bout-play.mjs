/**
 * Browser helpers for "Treino no tatame", Tatame v3 "Comando" (docs/lifesim/TATAME-V3.md): the e2e and the shots play a match the way a
 * player does. They pick a card, then tap the commands Bia calls (the `chain` beat) and the defense against the partner's attack (the
 * `defend` beat) on the pads. The live beat comes from `window.__tb.bout.beat` under `?rolltest` (solo builds), else from the pad's own
 * data attributes (`#bout-cmd[data-seq][data-step][data-want]`), so the server build needs no test hook: the server judges every tap on
 * its own clock and `TB_TEST_ROLL` relaxes nothing.
 */
import { sleep, waitFor } from './meveum-play.mjs';

/** Click the mat queue and wait for the partner lobby (the mat camera eases in behind it). */
export async function openBout(page) {
  await page.evaluate(() => window.__tb.interact({ prop: 'fila' }));
  await page.waitForSelector('#bout[data-phase="lobby"]', { timeout: 15_000 });
}

/** Pick a partner (default: the suggested one) and start the match. */
export async function startBout(page, partner) {
  if (partner) await page.click(`.bout-card-partner[data-partner="${partner}"]`);
  // With the test roll on, the intro lasts about half a second. A slow click can return after that
  // beat has already moved on, so waiting only for data-phase="intro" misses a bout that did start.
  const leftLobby = () =>
    page.evaluate(() => {
      const phase = document.querySelector('#bout')?.getAttribute('data-phase');
      return !!phase && phase !== 'lobby';
    });
  try {
    await page.click('#bout-start', { timeout: 8_000 });
  } catch (err) {
    if (!(await leftLobby())) throw err;
  }
  await waitFor(
    page,
    () => {
      const phase = document.querySelector('#bout')?.getAttribute('data-phase');
      return !!phase && phase !== 'lobby';
    },
    null,
    15_000,
    'the bout leaves the lobby',
  );
}

export const boutPhase = (page) => page.evaluate(() => document.querySelector('#bout')?.getAttribute('data-phase') ?? null);

/**
 * What is on the overlay right now: the phase, the pick (its seq and cards), and the pad beat (its seq, the step on screen, the word
 * to press, whether the pad takes presses yet, the chain length).
 */
export function readBeat(page) {
  return page.evaluate(() => {
    const root = document.querySelector('#bout');
    if (!root) return null;
    const phase = root.getAttribute('data-phase');
    const cmd = document.querySelector('#bout-cmd');
    const live = window.__tb?.bout?.beat ?? null;
    const want = live && !live.over ? (live.want[live.step] ?? '') : (cmd?.getAttribute('data-want') ?? '');
    const btn = want ? document.querySelector(`#bout-cmd .pad-btn[data-cmd="${want}"]`) : null;
    const moves = document.querySelector('#bout-moves');
    const res = document.querySelector('#bout-resolve');
    return {
      phase,
      pickSeq: moves?.getAttribute('data-seq') ?? '',
      cards: [...document.querySelectorAll('#bout-moves .bout-move')].map((e) => ({
        id: e.getAttribute('data-move'),
        kind: e.getAttribute('data-kind'),
        chain: Number(e.getAttribute('data-chain') || '1'),
        answers: e.getAttribute('data-answers') === '1',
        disabled: e.hasAttribute('disabled'),
      })),
      seq: cmd?.getAttribute('data-seq') ?? '',
      mode: cmd?.getAttribute('data-mode') ?? '',
      step: Number(cmd?.getAttribute('data-step') ?? '0'),
      total: live ? live.want.length : (document.querySelectorAll('#bout-dots i').length || 1),
      want,
      open: !!btn && !btn.hasAttribute('disabled'),
      live: !!live,
      resolve: res ? { how: res.getAttribute('data-how'), move: res.getAttribute('data-move'), actor: res.getAttribute('data-actor'), correct: res.getAttribute('data-correct') === 'true', ground: res.getAttribute('data-ground') } : null,
    };
  });
}

/** Press a pad button the way a tap does (the click handler; the server grades it). `wrong`: press another button of the same pad. */
export function tapPad(page, { seq, step, want, wrong = false }) {
  return page.evaluate(
    ({ seq, step, want, wrong }) => {
      const cmd = document.querySelector('#bout-cmd');
      if (!cmd || cmd.getAttribute('data-seq') !== String(seq) || cmd.getAttribute('data-step') !== String(step)) return false;
      const pad = [...cmd.querySelectorAll('.bout-pad:not([hidden]) .pad-btn')];
      const btn = wrong ? pad.find((b) => b.getAttribute('data-cmd') !== want) : pad.find((b) => b.getAttribute('data-cmd') === want);
      if (!(btn instanceof HTMLButtonElement) || btn.disabled) return false;
      btn.click();
      return true;
    },
    { seq, step, want, wrong },
  );
}

/** The card a strategy plays: `read` answers the telegraph, `bold` goes for the finish or the best attack, `safe` holds. */
function choose(cards, how) {
  const live = cards.filter((c) => !c.disabled);
  if (how === 'safe' || !live.length) return 'hold';
  if (how === 'read') {
    const answer = live.find((c) => c.answers);
    if (answer) return answer.id;
  }
  return (live.find((c) => c.kind === 'finish') ?? live.find((c) => c.kind === 'attack') ?? live[0]).id;
}

/**
 * Play the match to its end card. `pick` is the card strategy ('read' | 'bold' | 'safe'); `right(n)` says whether the n-th tap (chain or
 * defense, counted from 0) presses the right button; `tapMs` is how long the player waits before a tap (fast taps are Perfeito).
 * `onBeat(info, page)` is awaited once per new beat on screen (a pick, each step of a chain or a defense, a resolve) before acting;
 * `onTap(info, page)` right after each tap. Returns what the end card says and how many beats and taps were played.
 */
export async function playBout(page, { pick = 'bold', right = () => true, tapMs = 120, maxMs = 300_000, onBeat, onTap } = {}) {
  const t0 = Date.now();
  const seen = new Set();
  let moves = 0;
  let taps = 0;
  let drills = 0;
  while (Date.now() - t0 < maxMs) {
    const b = await readBeat(page).catch(() => null);
    if (!b) {
      await sleep(80);
      continue;
    }
    if (b.phase === 'end') break;
    if (b.phase === 'pick' && b.pickSeq && b.cards.length >= 0 && !seen.has(`pick:${b.pickSeq}`)) {
      seen.add(`pick:${b.pickSeq}`);
      if (onBeat) await onBeat({ ...b }, page);
      const id = choose(b.cards, pick);
      const clicked = await page.evaluate(
        ({ id, seq }) => {
          if (document.querySelector('#bout')?.getAttribute('data-phase') !== 'pick') return false;
          if (document.querySelector('#bout-moves')?.getAttribute('data-seq') !== seq) return false;
          const btn = id === 'hold' ? document.querySelector('#bout-hold') : document.querySelector(`#bout-moves .bout-move[data-move="${id}"]`);
          if (!(btn instanceof HTMLButtonElement) || btn.disabled) return false;
          btn.click();
          return true;
        },
        { id, seq: b.pickSeq },
      );
      if (clicked) moves++;
      continue;
    }
    if ((b.phase === 'chain' || b.phase === 'defend' || b.phase === 'drill') && b.seq && b.want && b.open) {
      const key = `${b.seq}:${b.step}`;
      if (!seen.has(key)) {
        seen.add(key);
        if (onBeat) await onBeat({ ...b }, page);
        if (tapMs > 0) await sleep(tapMs);
        const ok = b.phase === 'drill' ? true : right(taps);
        const tapped = await tapPad(page, { seq: b.seq, step: b.step, want: b.want, wrong: !ok });
        if (tapped) {
          taps++;
          if (b.phase === 'drill' && b.step === 0) drills++;
          if (onTap) await onTap({ ...b, right: ok }, page);
        } else seen.delete(key);
        continue;
      }
    }
    if (b.phase === 'resolve' && b.resolve && onBeat) {
      const key = `res:${b.resolve.actor}:${b.resolve.move}:${b.resolve.how}:${moves}:${taps}`;
      if (!seen.has(key)) {
        seen.add(key);
        await onBeat({ ...b }, page);
      }
    }
    await sleep(40);
  }
  await page.waitForSelector('#bout-end', { timeout: 30_000 });
  const end = await page.evaluate(() => {
    const e = document.querySelector('#bout-end');
    return { winner: e.getAttribute('data-winner'), reason: e.getAttribute('data-reason'), perfect: Number(e.getAttribute('data-perfect') || '0'), text: e.textContent };
  });
  return { ...end, moves, taps, drills };
}

/**
 * What the HUD shows right now: the control meter, each side's lit grip chips and brace, your Ritmo, the telegraph, the cards that
 * answer it, and (on a resolve) the ground read.
 */
export function readBoutHud(page) {
  return page.evaluate(() => {
    const chips = (side) => [...document.querySelectorAll(`#bout-grips-${side} .grip-chip.on`)].map((e) => e.getAttribute('data-grip') ?? e.getAttribute('data-brace') ?? '');
    const plan = document.querySelector('#bout-plan');
    return {
      meter: document.querySelector('#bout-ctl') ? Number(document.querySelector('#bout-ctl').getAttribute('data-meter')) : null,
      you: chips('you'),
      partner: chips('partner'),
      ritmo: Number(document.querySelector('#bout-ritmo')?.getAttribute('data-n') ?? '0'),
      plan: plan && !plan.hidden ? { kind: plan.getAttribute('data-kind'), move: plan.getAttribute('data-move'), text: plan.querySelector('.plan-line .pt')?.textContent ?? '' } : null,
      cards: [...document.querySelectorAll('#bout-moves .bout-move')].map((e) => e.getAttribute('data-move')),
      answers: [...document.querySelectorAll('#bout-moves .bout-move[data-answers="1"]')].map((e) => e.getAttribute('data-move')),
      chevrons: [...document.querySelectorAll('#bout-moves .mv-chev')].map((e) => e.textContent),
      ground: document.querySelector('#bout-ground')?.className.replace('bout-ground', '').trim() ?? null,
    };
  });
}

export async function waitBoutPhase(page, phase, timeout = 20_000) {
  await waitFor(page, (p) => document.querySelector('#bout')?.getAttribute('data-phase') === p, phase, timeout, `bout phase ${phase}`);
}
