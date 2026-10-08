/**
 * Browser helpers for "Treino no tatame" (grip contest on the Academia mat).
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

/** Answer the open challenge right (from the CI hint) or wrong. */
export async function answerChallenge(page, right = true) {
  const info = await page.evaluate(() => {
    const c = document.querySelector('#bout-challenge');
    return c ? { kind: c.getAttribute('data-kind'), hint: JSON.parse(c.getAttribute('data-debug') ?? 'null'), n: c.querySelectorAll('.bout-opt').length } : null;
  });
  if (!info) return false;
  if (info.hint === null) throw new Error('the bout hint is missing: start the server with TB_TEST_ROLL=1 (solo: ?rolltest)');
  if (info.kind === 'reorder') {
    const order = right ? info.hint : [...info.hint].reverse();
    for (const i of order) await page.click(`#bout-bank .bout-token[data-i="${i}"]`);
  } else if (info.kind === 'typed') {
    await page.fill('#bout-typed', right ? String(info.hint) : 'zzz');
    await page.press('#bout-typed', 'Enter');
  } else {
    const idx = right ? info.hint : (info.hint + 1) % Math.max(2, info.n);
    await page.click(`#bout-challenge .bout-opt[data-i="${idx}"]`);
  }
  return true;
}

/**
 * Play the match to its end card. `right(i)` says whether the i-th answer is right, `pick` chooses the intent ('bold' | 'safe'),
 * `onPhase(phase, page)` is called once per prompt (shots). Returns what the end card says.
 */
export async function playBout(page, { right = () => true, pick = 'bold', maxMs = 240_000, onPhase } = {}) {
  const t0 = Date.now();
  const handled = new Set();
  let moves = 0;
  let finalizacoes = 0;
  while (Date.now() - t0 < maxMs) {
    const st = await page.evaluate(() => {
      const root = document.querySelector('#bout');
      if (!root) return null;
      const phase = root.getAttribute('data-phase');
      const seq = document.querySelector('#bout-intents')?.getAttribute('data-seq') ?? document.querySelector('#bout-challenge')?.getAttribute('data-seq') ?? '';
      return { phase, seq };
    });
    if (!st) {
      await sleep(120);
      continue;
    }
    if (st.phase === 'end') break;
    const key = `${st.phase}:${st.seq}`;
    if (st.phase === 'drill' && !handled.has(key)) {
      const drill = await page.$('#bout-drill');
      if (!drill) {
        await sleep(60);
        continue;
      }
      if (!handled.has(`saw:${key}`) && onPhase) {
        handled.add(`saw:${key}`);
        await onPhase(st.phase, page);
      }
      const clicked = await page.evaluate(() => {
        const btn = document.querySelector('#bout-drill');
        if (!(btn instanceof HTMLButtonElement) || btn.disabled) return false;
        btn.click();
        return true;
      });
      if (!clicked) {
        await sleep(60);
        continue;
      }
      handled.add(key);
      moves++;
      continue;
    }
    if (st.phase === 'intent' && !handled.has(key)) {
      // The gag moves stay hidden until their track is open. A pointer click that waits to look
      // "stable" can burn the pick window and let Hold play the beat, so the match ends with
      // fewer than two played beats. Open the track and press the button in the page instead.
      const choice = await page
        .evaluate((how) => {
          const rows = [...document.querySelectorAll('#bout-intents .bout-intent')]
            .map((e) => ({
              id: e.getAttribute('data-intent') || '',
              percent: Number(e.getAttribute('data-percent') || '0'),
              locked: e.getAttribute('data-locked') === '1' || e.hasAttribute('disabled'),
              track: e.getAttribute('data-track') || '',
            }))
            .filter((r) => r.id && r.id !== 'finalizar' && !r.locked);
          if (!rows.length) return null;
          if (how === 'safe') return rows.find((r) => r.id === 'hold') ?? rows[0];
          if (how === 'read') {
            // read the partner's telegraph: play the card that answers it, else the best percent
            const answers = [...document.querySelectorAll('#bout-intents .bout-intent[data-answers="1"]')].map((e) => e.getAttribute('data-intent'));
            const answer = rows.filter((r) => answers.includes(r.id)).sort((a, b) => b.percent - a.percent)[0];
            if (answer) return answer;
          }
          const go = rows.filter((r) => r.id !== 'hold').sort((a, b) => b.percent - a.percent);
          return go[0] ?? rows[0];
        }, pick)
        .catch(() => null);
      if (!choice?.id) {
        await sleep(60);
        continue;
      }
      if (!handled.has(`saw:${key}`) && onPhase) {
        handled.add(`saw:${key}`);
        await onPhase(st.phase, page);
      }
      const clicked = await page.evaluate(({ id, track }) => {
        const root = document.querySelector('#bout');
        if (root?.getAttribute('data-phase') !== 'intent') return false;
        if (track) {
          const tab = document.querySelector(`#gag-bar [data-gag-track="${track}"]`);
          if (tab instanceof HTMLElement && !tab.classList.contains('is-open')) tab.click();
        }
        const btn = [...document.querySelectorAll('#bout-intents .bout-intent')].find((e) => e.getAttribute('data-intent') === id);
        if (!(btn instanceof HTMLButtonElement) || btn.hidden || btn.disabled) return false;
        btn.click();
        return true;
      }, choice);
      if (!clicked) {
        await sleep(60);
        continue;
      }
      const accepted = await page
        .waitForFunction(() => {
          const phase = document.querySelector('#bout')?.getAttribute('data-phase');
          return !!phase && phase !== 'intent' && phase !== 'lobby';
        }, null, { timeout: 2500 })
        .then(() => true)
        .catch(() => false);
      if (!accepted) {
        await sleep(60);
        continue;
      }
      handled.add(key);
      moves++;
    } else await sleep(120);
  }
  await page.waitForSelector('#bout-end', { timeout: 20_000 });
  return page.evaluate(() => {
    const e = document.querySelector('#bout-end');
    return { winner: e.getAttribute('data-winner'), reason: e.getAttribute('data-reason'), text: e.textContent };
  }).then((r) => ({ ...r, answers: moves, moves, finalizacoes }));
}

/**
 * What the Tatame v2 HUD shows right now: the control meter, each side's lit grip chips, braces and tiredness, the telegraph,
 * the cards that answer it, and (on a resolve) the ground read.
 */
export function readBoutHud(page) {
  return page.evaluate(() => {
    const chips = (side) => [...document.querySelectorAll(`#bout-grips-${side} .grip-chip.on`)].map((e) => e.getAttribute('data-grip') ?? e.getAttribute('data-brace') ?? (e.getAttribute('data-tired') ? 'tired' : ''));
    const plan = document.querySelector('#bout-plan');
    return {
      meter: document.querySelector('#bout-ctl') ? Number(document.querySelector('#bout-ctl').getAttribute('data-meter')) : null,
      you: chips('you'),
      partner: chips('partner'),
      plan: plan ? { kind: plan.getAttribute('data-kind'), move: plan.getAttribute('data-move'), text: plan.querySelector('.plan-line .pt')?.textContent ?? '' } : null,
      answers: [...document.querySelectorAll('#bout-intents .bout-intent[data-answers="1"]')].map((e) => e.getAttribute('data-intent')),
      braces: [...document.querySelectorAll('#bout-intents .bout-intent.is-brace')].map((e) => e.getAttribute('data-intent')),
      combos: [...document.querySelectorAll('#bout-intents .bout-intent.is-combo')].map((e) => e.getAttribute('data-intent')),
      ground: document.querySelector('#bout-ground')?.className.replace('bout-ground', '').trim() ?? null,
    };
  });
}

export async function waitBoutPhase(page, phase, timeout = 20_000) {
  await waitFor(page, (p) => document.querySelector('#bout')?.getAttribute('data-phase') === p, phase, timeout, `bout phase ${phase}`);
}
