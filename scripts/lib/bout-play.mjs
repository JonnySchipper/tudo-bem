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
  await page.click('#bout-start');
  await page.waitForSelector('#bout[data-phase="intro"]', { timeout: 10_000 });
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
    if ((st.phase === 'intent') && !handled.has(key)) {
      handled.add(key);
      if (onPhase) await onPhase(st.phase, page);
      const choice = await page.evaluate((policy) => {
        const root = document.querySelector('#bout-intents');
        if (!root) return null;
        if (policy !== 'safe' && root.querySelector('.bout-intent.finalizar')) return 'finalizar';
        const posture = document.querySelector('#bout-tell')?.getAttribute('data-posture');
        const verb = posture === 'perto' ? 'empurrar' : 'puxar';
        const buttons = [...root.querySelectorAll('.bout-intent')];
        const id = (el) => el.getAttribute('data-intent');
        const attack = buttons.find((b) => id(b)?.startsWith(`${verb}_`));
        const grab = buttons.find((b) => id(b)?.startsWith('pegar_'));
        if (policy === 'safe') return id(grab ?? buttons[0]);
        return id(attack ?? grab ?? buttons.at(-1));
      }, pick);
      if (choice === 'finalizar') finalizacoes++;
      moves++;
      await page.waitForTimeout(200);
      await page.click(`#bout-intents .bout-intent[data-intent="${choice}"]`);
    } else await sleep(120);
  }
  await page.waitForSelector('#bout-end', { timeout: 20_000 });
  return page.evaluate(() => {
    const e = document.querySelector('#bout-end');
    return { winner: e.getAttribute('data-winner'), reason: e.getAttribute('data-reason'), text: e.textContent };
  }).then((r) => ({ ...r, answers: moves, moves, finalizacoes }));
}

export async function waitBoutPhase(page, phase, timeout = 20_000) {
  await waitFor(page, (p) => document.querySelector('#bout')?.getAttribute('data-phase') === p, phase, timeout, `bout phase ${phase}`);
}
