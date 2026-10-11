import { beforeEach, describe, expect, it } from 'vitest';
import { CHAPA, DAILY_PAID_SHIFTS, DEFAULT_APPEARANCE, ECONOMY, JUICE, MENU_LADDER, POUR, frontOf, type ClientMsg, type CorreriaSnap, type ServerMsg } from '@tudobem/shared';
import { World, type Session } from './world.js';
import { ProfileStore } from './store.js';
import { AuthoredNpcDialogue, InMemoryStudentModel, JevStubSafety, MemoryModerationQueue, PhrasebookGloss } from './services/stubs.js';
import { CORRERIA_RESUME_MS } from './correria.js';
import { act, buildFront, serveFront, waitFront } from './correriaTestKit.js';

let clock = 1_000_000;
const pending: { fn: () => void; at: number }[] = [];
function advance(ms: number) {
  clock += ms;
  for (let guard = 0; guard < 200; guard++) {
    const ready = pending.filter((p) => p.at <= clock);
    if (!ready.length) break;
    for (const p of ready) {
      pending.splice(pending.indexOf(p), 1);
      p.fn();
    }
  }
}
const makeWorld = () =>
  new World(
    new ProfileStore(null),
    { safety: new JevStubSafety(), gloss: new PhrasebookGloss(), npc: new AuthoredNpcDialogue(), student: new InMemoryStudentModel(), moderation: new MemoryModerationQueue() },
    { now: () => clock, schedule: (fn, ms) => pending.push({ fn, at: clock + ms }), testMg: true },
  );

interface Client {
  s: Session;
  inbox: ServerMsg[];
  send: (m: ClientMsg) => Promise<void>;
  last: <T extends ServerMsg['t']>(t: T) => Extract<ServerMsg, { t: T }> | undefined;
  all: <T extends ServerMsg['t']>(t: T) => Extract<ServerMsg, { t: T }>[];
}
let n = 0;
function bare(world: World): Client {
  const inbox: ServerMsg[] = [];
  const s = world.connect(`c${n++}`, (m) => inbox.push(m), () => {});
  return { s, inbox, send: (m) => world.handle(s, m), last: (t) => [...inbox].reverse().find((m) => m.t === t) as never, all: (t) => inbox.filter((m) => m.t === t) as never };
}
async function player(world: World, room: 'padaria' | 'praca' = 'padaria'): Promise<Client> {
  const c = bare(world);
  await c.send({ t: 'hello' });
  await c.send({ t: 'createProfile', name: `Ana${n++}`, pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
  await c.send({ t: 'join', room });
  return c;
}
const states = (c: Client) => c.all('mg').filter((m): m is Extract<typeof m, { phase: 'state' }> => m.phase === 'state');
const snap = (c: Client): CorreriaSnap => states(c).at(-1)!.snap;
const evs = (c: Client) => states(c).flatMap((m) => m.ev);
const endOf = (c: Client) => c.all('mg').find((m): m is Extract<typeof m, { phase: 'end' }> => m.phase === 'end');
async function playShiftOut(world: World, a: Client, max = 90) {
  for (let i = 0; i < max && !endOf(a); i++) await serveFront(world, a, advance);
}

describe('Correria no Balcão, server side', () => {
  beforeEach(() => {
    clock = 1_000_000;
    pending.length = 0;
  });

  it('starts only at the padaria counter and sends the whole picture', async () => {
    const world = makeWorld();
    const off = await player(world, 'praca');
    await off.send({ t: 'mg', action: 'start' });
    expect(off.last('error')!.code).toBe('mg');
    expect(off.s.mg).toBeUndefined();
    const a = await player(world);
    await a.send({ t: 'mg', action: 'start' });
    const s0 = snap(a);
    // a profile's very first shift is two waves of customers (4 + 5)
    expect(s0).toMatchObject({ v: 1, wave: 0, waves: 2, total: 9, level: 0, baker: expect.stringMatching(/carlos|graca/) });
    expect(s0.chapa).toEqual([null]);
    expect(s0.unlocked).toEqual([]);
    expect([...s0.menu].sort()).toEqual(['cafe', 'pao']);
    expect('lesson' in s0).toBe(false);
    expect(s0.payMul).toBe(1);
    expect(s0.bump).toBeNull();
  });

  it('says the pay bump when the menu grows, and keeps no per-item lesson state any more', async () => {
    const world = makeWorld();
    const a = await player(world);
    await a.send({ t: 'mg', action: 'start' });
    await a.send({ t: 'mg', action: 'quit' });
    a.inbox.length = 0;
    await a.send({ t: 'mg', action: 'start' });
    expect(a.s.profile!.correria!.shifts).toBe(0);
    expect(a.s.profile!.correria!.taught).toEqual([]);
    a.s.profile!.correria = { stars: 0, shifts: 2, best: 0 };
    a.inbox.length = 0;
    await a.send({ t: 'mg', action: 'quit' });
    await a.send({ t: 'mg', action: 'start' });
    expect(snap(a).menu).toContain('agua');
    expect('lesson' in snap(a)).toBe(false);
    expect(snap(a).bump?.pt).toBe('+1 item no cardápio: pagamento +6%');
    expect(snap(a).payMul).toBeCloseTo(1.06);
  });

  it('customers arrive over time, one steps up to order, patience runs on the server clock', async () => {
    const world = makeWorld();
    const a = await player(world);
    await a.send({ t: 'mg', action: 'start' });
    advance(1500);
    expect(evs(a).some((e) => e.k === 'arrive')).toBe(true);
    await waitFront(world, a, advance);
    expect(evs(a).some((e) => e.k === 'front')).toBe(true);
    const f = snap(a).customers.find((c) => c.state === 'front')!;
    advance(5000);
    advance(250);
    expect(snap(a).customers.find((c) => c.id === f.id)!.patience).toBeLessThan(f.patience);
    // the order lines are only shown in test mode
    expect(f.debug?.lines.length).toBeGreaterThan(0);
  });

  it('only the real steps fill the tray: a correct tray cannot be sent, a station item cannot be grabbed', async () => {
    const world = makeWorld();
    const a = await player(world);
    a.s.profile!.correria = { stars: 0, shifts: 40, best: 0 };
    await a.send({ t: 'mg', action: 'start' });
    await waitFront(world, a, advance);
    await act(a, { a: 'grab', item: 'pao_na_chapa' });
    expect(evs(a).at(-1)).toMatchObject({ k: 'no', why: 'station' });
    // a forged submit from the old protocol does nothing
    await a.send({ t: 'mg', action: 'submit', tray: { pao: 1 } } as unknown as ClientMsg);
    await a.send({ t: 'mg', action: 'act', act: { a: 'grab', item: 'not_an_item' } } as unknown as ClientMsg);
    await a.send({ t: 'mg', action: 'act', act: 'x' } as unknown as ClientMsg);
    expect(snap(a).tray).toEqual([]);
  });

  it('chapa and coffee timing is judged by the server clock, not the client', async () => {
    const world = makeWorld();
    const a = await player(world);
    a.s.profile!.correria = { stars: 0, shifts: 40, best: 0 };
    await a.send({ t: 'mg', action: 'start' });
    await waitFront(world, a, advance);
    await act(a, { a: 'chapa_put', slot: 0, item: 'pao_na_chapa' });
    advance(500);
    await act(a, { a: 'chapa_take', slot: 0 });
    expect(evs(a).at(-1)).toMatchObject({ k: 'chapa_raw' });
    expect(snap(a).tray).toEqual([]);
    advance(CHAPA.cookMs);
    await act(a, { a: 'chapa_take', slot: 0 });
    expect(snap(a).tray).toEqual(['pao_na_chapa']);
    await act(a, { a: 'chapa_put', slot: 0, item: 'misto_quente' });
    advance(CHAPA.burnMs + 500);
    expect(evs(a).some((e) => e.k === 'chapa_burnt')).toBe(true);
    await act(a, { a: 'chapa_take', slot: 0 });
    expect(snap(a).tray).toEqual(['pao_na_chapa']);
    // pour: tap to start, a quick second tap is short, leaving it spills, tap again in the window fills
    await act(a, { a: 'pour_start', item: 'cafe' });
    advance(200);
    await act(a, { a: 'pour_end' });
    expect(snap(a).tray).toEqual(['pao_na_chapa']);
    await act(a, { a: 'pour_start', item: 'cafe' });
    advance(POUR.fullMs * 0.85);
    await act(a, { a: 'pour_end' });
    expect(snap(a).tray).toEqual(['pao_na_chapa', 'cafe']);
  });

  it('the juicer: suco is not a fridge grab, each tap is one orange on the server clock, the server judges the line', async () => {
    const world = makeWorld();
    const a = await player(world);
    a.s.profile!.correria = { stars: 0, shifts: 40, best: 0, taught: [...MENU_LADDER, 'where'] };
    await a.send({ t: 'mg', action: 'start' });
    await waitFront(world, a, advance);
    await act(a, { a: 'grab', item: 'suco_de_laranja' });
    expect(evs(a).at(-1)).toMatchObject({ k: 'no', why: 'station' });
    const next = snap(a).hopper[0]!;
    await act(a, { a: 'juice_drop' });
    expect(evs(a).at(-1)).toMatchObject({ k: 'juice_drop', size: next, fill: JUICE.sizes[next] });
    // a second tap while it still presses is ignored by the server
    await act(a, { a: 'juice_drop' });
    expect(snap(a).juice?.oranges).toBe(1);
    // taking it short (one orange) throws it out
    advance(JUICE.cycleMs + 20);
    await act(a, { a: 'juice_take' });
    expect(evs(a).at(-1)).toMatchObject({ k: 'juice_bad', why: 'short' });
    expect(snap(a).juice).toBeNull();
    // to the line, then the glass goes on the tray
    for (let i = 0; i < 6 && (snap(a).juice?.fill ?? 0) < JUICE.goodMin; i++) {
      await act(a, { a: 'juice_drop' });
      advance(JUICE.cycleMs + 20);
    }
    await act(a, { a: 'juice_take' });
    expect(evs(a).at(-1)).toMatchObject({ k: 'juice_ok', item: 'suco_de_laranja' });
    expect(snap(a).tray).toEqual(['suco_de_laranja']);
  });

  it('the oranges are one size until cafe_rapido, which the shift ladder hands out', async () => {
    const world = makeWorld();
    const a = await player(world);
    // juicer on the menu (10 shifts), but cafe_rapido (12) not yet
    a.s.profile!.correria = { stars: 0, shifts: 10, best: 0 };
    await a.send({ t: 'mg', action: 'start' });
    expect(snap(a).unlocked).toEqual(['chapa2']);
    expect(snap(a).hopper).toEqual(['m', 'm', 'm']);
    await a.send({ t: 'mg', action: 'quit' });
    a.s.profile!.correria = { stars: 0, shifts: 12, best: 0 };
    await a.send({ t: 'mg', action: 'start' });
    expect(snap(a).unlocked).toContain('cafe_rapido');
  });

  it('a wrong tray is corrected (glossed) and keeps the tray; fixing it scores the second chance', async () => {
    const world = makeWorld();
    const a = await player(world);
    a.s.profile!.correria = { stars: 0, shifts: 40, best: 0 };
    await a.send({ t: 'mg', action: 'start' });
    await waitFront(world, a, advance);
    await act(a, { a: 'grab', item: ['pao', 'bolo', 'guarana'].find((i) => !world.debugOrder(a.s)!.lines.some((l) => l.itemId === i))! });
    await act(a, { a: 'serve' });
    const c = evs(a).at(-1) && [...evs(a)].reverse().find((e) => e.k === 'correct');
    expect(c).toBeTruthy();
    expect((c as { line: { pt: string; en: string } }).line.en.length).toBeGreaterThan(3);
    expect(snap(a).tray).toHaveLength(1);
    await buildFront(world, a, advance);
    await act(a, { a: 'serve' });
    expect(evs(a).at(-1) && [...evs(a)].reverse().find((e) => e.k === 'serve')).toMatchObject({ outcome: 'segunda' });
  });

  it('paid shifts count on the player day: an older UTC key ahead of it is today (the cap holds), an earlier key rolls over (D1)', async () => {
    // 02:00 UTC on 10-09 is 23:00 on 10-08 in São Paulo (UTC-3)
    clock = Date.parse('2026-10-09T02:00:00.000Z');
    const world = makeWorld();
    const a = bare(world);
    await a.send({ t: 'hello', tz: -180 });
    await a.send({ t: 'createProfile', name: `Ana${n++}`, pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
    await a.send({ t: 'join', room: 'padaria' });
    const p = a.s.profile!;
    // the older server counted 10-09 (UTC, a day ahead of her evening) and every paid shift of it was used: still today, no RV
    p.correria = { stars: 6, shifts: 4, best: 50, date: '2026-10-09', paid: DAILY_PAID_SHIFTS };
    await a.send({ t: 'mg', action: 'start' });
    await playShiftOut(world, a);
    const first = endOf(a)!;
    expect(first.end.coins).toBe(0);
    expect(first.end.dailyBlocked).toBe(true);
    // written back as her day, so it rolls over once, at her midnight
    expect(p.correria).toMatchObject({ date: '2026-10-08', paid: DAILY_PAID_SHIFTS, shifts: 5 });
    expect(p.correria!.stars).toBeGreaterThanOrEqual(6);
    // an earlier day's key with the cap used rolls over: the shift pays (stars and shifts stay)
    p.correria!.date = '2026-10-07';
    a.inbox.length = 0;
    await a.send({ t: 'mg', action: 'start' });
    await playShiftOut(world, a);
    const second = endOf(a)!;
    expect(second.end.coins).toBeGreaterThan(0);
    expect(p.correria).toMatchObject({ date: '2026-10-08', paid: 1, shifts: 6 });
  });

  it('a whole shift: 9 customers on the first, 15 after, stars and RV paid once, the tutorial step, the Caderno and the daily gate', async () => {
    const world = makeWorld();
    const a = await player(world);
    const coins0 = a.s.profile!.coins;
    await a.send({ t: 'mg', action: 'start' });
    await playShiftOut(world, a);
    const end = endOf(a)!;
    expect(end.end.served + end.end.left).toBe(9);
    expect(end.end.coins).toBeGreaterThanOrEqual(ECONOMY.minigameMin);
    expect(end.end.stars).toBeGreaterThanOrEqual(1);
    expect(a.s.profile!.coins).toBe(coins0 + end.end.coins);
    expect(a.s.profile!.tutorial.meveum).toBe(true);
    expect(a.s.profile!.correria).toMatchObject({ shifts: 1, stars: end.end.stars, paid: 1 });
    // the end card's ladder is the next shift's: one more shift and água opens
    expect(end.end.ladder).toMatchObject({ open: ['cafe', 'pao'], fresh: [], next: 'agua', nextIn: 1 });
    expect(a.s.mg).toBeUndefined();
    // the second shift is the full three waves
    a.inbox.length = 0;
    await a.send({ t: 'mg', action: 'start' });
    expect(snap(a)).toMatchObject({ waves: 3, total: 15 });
    await a.send({ t: 'mg', action: 'quit' });
    a.inbox.length = 0;
    // more shifts the same day: only the first DAILY_PAID_SHIFTS pay RV, stars always count
    let blocked = 0;
    for (let i = 1; i < DAILY_PAID_SHIFTS + 1; i++) {
      a.inbox.length = 0;
      await a.send({ t: 'mg', action: 'start' });
      await playShiftOut(world, a);
      const e = endOf(a)!;
      if (i < DAILY_PAID_SHIFTS) expect(e.end.coins).toBeGreaterThan(0);
      else {
        expect(e.end.coins).toBe(0);
        expect(e.end.dailyBlocked).toBe(true);
        blocked++;
      }
    }
    expect(blocked).toBe(1);
    expect(a.s.profile!.correria!.shifts).toBe(DAILY_PAID_SHIFTS + 1);
    expect(a.s.profile!.correria!.stars).toBeGreaterThan(end.end.stars);
  });

  it('stars set the level; an old profile keeps the tools its stars earned (pastel/coxinha hint, a second chapa)', async () => {
    const world = makeWorld();
    const a = await player(world);
    a.s.profile!.correria = { stars: 5, shifts: 3, best: 100 };
    await a.send({ t: 'mg', action: 'start' });
    const s0 = snap(a);
    expect(s0.level).toBe(1);
    expect(s0.unlocked).toEqual(['chapa2', 'salgados']);
    expect(s0.chapa).toHaveLength(2);
    expect(s0.menu).toHaveLength(3);
  });

  it('the shifts played open the tools with no stars at all, and the end card names the one just earned', async () => {
    const world = makeWorld();
    const a = await player(world);
    a.s.profile!.correria = { stars: 0, shifts: 9, best: 0 };
    await a.send({ t: 'mg', action: 'start' });
    expect(snap(a).unlocked).toEqual([]);
    expect(snap(a).chapa).toHaveLength(1);
    for (let i = 0; i < 400 && !endOf(a); i++) advance(1000);
    expect(endOf(a)!.end.newUnlocks.map((u) => u.id)).toEqual(['chapa2']);
    expect(a.s.profile!.correria!.shifts).toBe(10);
    a.inbox.length = 0;
    await a.send({ t: 'mg', action: 'start' });
    expect(snap(a).unlocked).toEqual(['chapa2']);
    expect(snap(a).chapa).toHaveLength(2);
    // a profile whose stars already paid for chapa2 is not told about it again
    a.s.profile!.correria = { stars: 4, shifts: 9, best: 0 };
    await a.send({ t: 'mg', action: 'quit' });
    a.inbox.length = 0;
    await a.send({ t: 'mg', action: 'start' });
    for (let i = 0; i < 400 && !endOf(a); i++) advance(1000);
    expect(endOf(a)!.end.newUnlocks).toEqual([]);
  });

  it('an idle player loses everyone and earns nothing, then the shift ends by itself', async () => {
    const world = makeWorld();
    const a = await player(world);
    const coins = a.s.profile!.coins;
    await a.send({ t: 'mg', action: 'start' });
    for (let i = 0; i < 400 && !endOf(a); i++) advance(1000);
    const e = endOf(a)!;
    expect(e.end).toMatchObject({ served: 0, left: 9, coins: 0, stars: 0 });
    expect(a.s.profile!.coins).toBe(coins);
  });

  it('quit settles what was served; quitting before anything just says goodbye', async () => {
    const world = makeWorld();
    const a = await player(world);
    await a.send({ t: 'mg', action: 'start' });
    await a.send({ t: 'mg', action: 'quit' });
    expect(a.last('notice')!.pt).toBe('Até a próxima, ajudante!');
    expect(endOf(a)).toBeUndefined();
    await a.send({ t: 'mg', action: 'start' });
    await serveFront(world, a, advance);
    await serveFront(world, a, advance);
    await a.send({ t: 'mg', action: 'quit' });
    const e = endOf(a)!;
    expect(e.end.served).toBe(2);
    expect(e.end.coins).toBeGreaterThan(0);
    expect(a.s.mg).toBeUndefined();
  });

  it('teaches the word of a served item after a won shift only, sometimes: a quit shift and an empty one teach nothing', async () => {
    const world = makeWorld();
    const a = await player(world);
    const wins: string[][] = [];
    const deps = (world as unknown as { correria: { d: { shiftWon?: (s: Session, items: readonly string[]) => void } } }).correria.d;
    const original = deps.shiftWon;
    deps.shiftWon = (s, items) => {
      wins.push([...items]);
      original?.(s, items);
    };
    (world as unknown as { diary: { d: { rng: () => number } } }).diary.d.rng = () => 0;
    const gameWords = () => a.all('diary').filter((m) => m.phase === 'word' && m.source === 'game');

    await a.send({ t: 'mg', action: 'start' });
    await serveFront(world, a, advance);
    await a.send({ t: 'mg', action: 'quit' });
    expect(wins).toEqual([]);
    expect(gameWords()).toHaveLength(0);

    const b = await player(world);
    await b.send({ t: 'mg', action: 'start' });
    await playShiftOut(world, b);
    expect(endOf(b)).toBeDefined();
    expect(wins).toHaveLength(1);
    expect(wins[0]!.length).toBeGreaterThan(0);
    const teachable: Record<string, string> = { bolo: 'bolo', guarana: 'guaraná', coxinha: 'coxinha', pao_de_queijo: 'queijo', misto_quente: 'misto' };
    const expected = wins[0]!.filter((i) => i in teachable).map((i) => teachable[i]!);
    const taught = b.all('diary').filter((m) => m.phase === 'word' && m.source === 'game').map((m) => (m as { pt: string }).pt);
    expect(taught.sort()).toEqual([...expected].sort());
  });

  it('a tap after the payout does not replace it with a lost slip', async () => {
    const world = makeWorld();
    const a = await player(world);
    await a.send({ t: 'mg', action: 'start' });
    await playShiftOut(world, a);
    const paid = endOf(a)!;
    expect(paid.lost).toBeFalsy();
    expect(paid.end.coins).toBeGreaterThan(0);
    const ends = () => a.all('mg').filter((m) => m.phase === 'end');
    expect(ends()).toHaveLength(1);
    await a.send({ t: 'mg', action: 'sync' });
    await act(a, { a: 'serve' });
    await act(a, { a: 'clear' });
    expect(ends()).toEqual([paid]);

    // Jogar de novo opens a real shift again, and a sync on it is a snapshot.
    a.inbox.length = 0;
    await a.send({ t: 'mg', action: 'start' });
    expect(states(a).length).toBeGreaterThan(0);
    const before = states(a).length;
    await a.send({ t: 'mg', action: 'sync' });
    expect(states(a).length).toBeGreaterThan(before);
    expect(a.all('mg').some((m) => m.phase === 'end')).toBe(false);
  });

  it('a server restart that lost the shift answers sync and actions with a lost card and no RV', async () => {
    const world = makeWorld();
    const a = await player(world);
    const coins = a.s.profile!.coins;
    await a.send({ t: 'mg', action: 'sync' });
    expect(endOf(a)).toMatchObject({ lost: true, carlos: { pt: 'Ih, perdi a comanda! Bora começar um turno novo?' }, end: { coins: 0 } });
    a.inbox.length = 0;
    await act(a, { a: 'serve' });
    expect(endOf(a)).toMatchObject({ lost: true });
    expect(a.s.profile!.coins).toBe(coins);
    expect(a.all('reward')).toHaveLength(0);
  });

  it('a dropped connection resumes the shift on rejoin, and the time away does not burn patience', async () => {
    const world = makeWorld();
    const a = await player(world);
    await a.send({ t: 'mg', action: 'start' });
    await waitFront(world, a, advance);
    const f = snap(a).customers.find((c) => c.state === 'front')!;
    const token = a.s.profile!.token;
    world.disconnect(a.s);
    clock += 9_000;
    const b = bare(world);
    await b.send({ t: 'hello', token });
    await b.send({ t: 'join', room: 'padaria' });
    const st = states(b).at(-1)!;
    expect(st.resync).toBe(true);
    const f2 = st.snap.customers.find((c) => c.id === f.id)!;
    expect(f.patience - f2.patience).toBeLessThan(1000);
    expect(b.s.mg).toBeTruthy();
    // and it keeps running on the new session
    advance(4000);
    advance(250);
    expect(snap(b).t).toBeGreaterThan(st.snap.t);
  });

  it('a sync that beats the rejoin does not call a resumable shift lost; quit on a parked shift settles it', async () => {
    const world = makeWorld();
    const a = await player(world);
    await a.send({ t: 'mg', action: 'start' });
    await serveFront(world, a, advance);
    const token = a.s.profile!.token;
    world.disconnect(a.s);
    const b = bare(world);
    await b.send({ t: 'hello', token });
    await b.send({ t: 'mg', action: 'sync' });
    expect(endOf(b)).toBeUndefined();
    await b.send({ t: 'mg', action: 'quit' });
    expect(endOf(b)).toMatchObject({ end: { served: 1 } });
  });

  it('does not resume after the reconnect window', async () => {
    const world = makeWorld();
    const a = await player(world);
    await a.send({ t: 'mg', action: 'start' });
    const token = a.s.profile!.token;
    world.disconnect(a.s);
    clock += CORRERIA_RESUME_MS + 1;
    const b = bare(world);
    await b.send({ t: 'hello', token });
    await b.send({ t: 'join', room: 'padaria' });
    expect(b.all('mg')).toHaveLength(0);
    await b.send({ t: 'mg', action: 'sync' });
    expect(endOf(b)).toMatchObject({ lost: true });
  });

  it('a second sign-in takes the shift over', async () => {
    const world = makeWorld();
    const a = await player(world);
    await a.send({ t: 'mg', action: 'start' });
    const token = a.s.profile!.token;
    const b = bare(world);
    await b.send({ t: 'hello', token });
    expect(a.s.profile).toBeUndefined();
    await b.send({ t: 'join', room: 'padaria' });
    expect(states(b).at(-1)).toMatchObject({ resync: true });
    expect(frontOf(world.debugShift(b.s)!) ?? true).toBeTruthy();
  });

  it('leaving the padaria drops the shift', async () => {
    const world = makeWorld();
    const a = await player(world);
    await a.send({ t: 'mg', action: 'start' });
    await a.send({ t: 'join', room: 'praca' });
    expect(a.s.mg).toBeUndefined();
  });

  it('serving a regular perfectly pays friendship once the shift is paid', async () => {
    const world = makeWorld();
    const a = await player(world);
    a.s.profile!.bond = { nanda: 40, julia: 30, prof: 20, ze: 20, chico: 20, rosa: 20, tia_lu: 20 };
    await a.send({ t: 'mg', action: 'start' });
    await playShiftOut(world, a);
    const e = endOf(a)!;
    expect(e.end.regulars.length).toBeGreaterThan(0);
    const gained = Object.values(a.s.profile!.bond!).reduce((s, v) => s + (v ?? 0), 0) - 170;
    expect(gained).toBeGreaterThan(0);
  });
});
