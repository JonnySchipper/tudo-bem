/**
 * Test helpers for the escola: answer whatever exercise the server dealt, right or wrong, from the catalog (the test plays a student who
 * knows the diary). Never imported by the game.
 */
import { DIARY_WORDS, buildLine, lineTiles, diaryKey, type ClientMsg, type ExerciseView, type ServerMsg, type DiaryWord } from '@tudobem/shared';

type Escola = Extract<ServerMsg, { t: 'escola' }>;

export interface EscolaClient {
  inbox: ServerMsg[];
  send: (m: ClientMsg) => Promise<void>;
  held: () => readonly string[];
}

const heldWords = (c: EscolaClient): DiaryWord[] => DIARY_WORDS.filter((w) => c.held().includes(w.id));
const enEq = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The answer a student who knows every diary word gives. */
export function rightAnswer(c: EscolaClient, ex: ExerciseView): ClientMsg[] {
  const held = heldWords(c);
  switch (ex.kind) {
    case 'pick': {
      const w = held.find((x) => enEq(x.en, ex.en) && ex.options.includes(x.pt))!;
      return [{ t: 'escola', action: 'answer', choice: w.pt }];
    }
    case 'pick_en': {
      const w = held.find((x) => x.pt === ex.pt)!;
      return [{ t: 'escola', action: 'answer', choice: ex.options.find((o) => enEq(o, w.en))! }];
    }
    case 'listen': {
      const w = held.find((x) => x.pt === ex.audio)!;
      return [{ t: 'escola', action: 'answer', choice: ex.options.find((o) => enEq(o, w.en))! }];
    }
    case 'type': {
      const w = held.find((x) => enEq(x.en, ex.en) && [...x.pt].length === ex.letters)!;
      return [{ t: 'escola', action: 'answer', text: w.pt }];
    }
    case 'build': {
      const line = held.map((w) => buildLine(w)).find((l) => l?.en === ex.en)!;
      const want = lineTiles(line.pt);
      const used = new Set<number>();
      const order = want.map((t) => {
        const i = ex.tiles.findIndex((x, j) => !used.has(j) && diaryKey(x) === diaryKey(t));
        used.add(i);
        return i;
      });
      return [{ t: 'escola', action: 'answer', order }];
    }
    case 'match':
      return ex.pt.map((pt, i) => {
        const w = held.find((x) => x.pt === pt)!;
        return { t: 'escola', action: 'pair', pt: i, en: ex.en.findIndex((e) => enEq(e, w.en)) };
      });
  }
}

/** A wrong answer (the match race: one wrong tap, then the right pairs). */
export function wrongAnswer(c: EscolaClient, ex: ExerciseView): ClientMsg[] {
  const right = rightAnswer(c, ex);
  switch (ex.kind) {
    case 'pick':
    case 'pick_en':
    case 'listen': {
      const r = (right[0] as { choice: string }).choice;
      return [{ t: 'escola', action: 'answer', choice: ex.options.find((o) => o !== r)! }];
    }
    case 'type':
      return [{ t: 'escola', action: 'answer', text: 'zzz' }];
    case 'build': {
      const order = [...(right[0] as { order: number[] }).order].reverse();
      return [{ t: 'escola', action: 'answer', order }];
    }
    case 'match': {
      const first = right[0] as { pt: number; en: number };
      return [{ t: 'escola', action: 'pair', pt: first.pt, en: (first.en + 1) % ex.en.length }, ...right];
    }
  }
}

const lastEscola = (c: EscolaClient, from: number) => c.inbox.slice(from).filter((m): m is Escola => m.t === 'escola');

/**
 * Play the lesson that was just started to the end. `miss(i)` says which exercises (by order dealt) to get wrong. Returns every escola
 * message and the summary.
 */
export async function playLesson(c: EscolaClient, miss: (i: number, ex: ExerciseView) => boolean = () => false, opening: ClientMsg = { t: 'escola', action: 'start' }) {
  const start = c.inbox.length;
  let seen = start;
  await c.send(opening);
  for (let n = 0; n < 40; n++) {
    const msgs = lastEscola(c, seen);
    seen = c.inbox.length;
    const ex = [...msgs].reverse().find((m) => m.phase === 'exercise');
    const done = msgs.find((m) => m.phase === 'done');
    if (done && done.phase === 'done') return { msgs: lastEscola(c, start), summary: done.summary };
    if (!ex || ex.phase !== 'exercise') throw new Error(`no exercise dealt (got ${msgs.map((m) => m.phase).join(',')})`);
    for (const m of miss(n, ex.ex) ? wrongAnswer(c, ex.ex) : rightAnswer(c, ex.ex)) await c.send(m);
    await c.send({ t: 'escola', action: 'next' });
  }
  throw new Error('the lesson never ended');
}
