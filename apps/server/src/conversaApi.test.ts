import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONVERSA_SUBJECTS, DEFAULT_APPEARANCE, TUTORIAL_STEPS, classifyChat, conversaDateKey, type TutorialStep } from '@tudobem/shared';
import { CONVERSA_MAX_BODY, handleConversaApi, type ConversaApiDeps } from './conversaApi.js';
import { ConversaSessions } from './conversaSessions.js';
import { fileAdapter } from './fileStore.js';
import { closeDatabase, openDatabase } from './sqliteDb.js';
import { ProfileStore, type StoredProfile } from './store.js';

function profile(id: string, coins = 100, granted?: string): StoredProfile {
  const tutorial = Object.fromEntries(TUTORIAL_STEPS.map((t) => [t.id, false])) as Record<TutorialStep, boolean>;
  return {
    id,
    token: `tok-${id}`,
    ageGate18: true,
    name: 'Ana',
    pronoun: 'ela',
    appearance: DEFAULT_APPEARANCE,
    nameplate: 'verde',
    coins,
    hats: [],
    hat: null,
    furniture: {},
    apartment: [],
    parrotOwned: false,
    parrotEquipped: false,
    friends: [],
    tutorial,
    tutorialRewarded: false,
    createdAt: 1,
    daily: {
      date: '2026-09-26',
      sceneClears: {},
      ...(granted ? { conversaRvGranted: { carlos: granted } } : {}),
    },
    lastSeen: 1,
  };
}

/** What a forged client sends: perfect scores it never earned. */
const passBody = (playerId: string, npcId = 'carlos') => ({
  action: 'end' as const,
  npcId,
  playerId,
  turnCount: 6,
  scores: { portuguese: 3, grammar: 3, conversation: 3 },
  daily: {} as Record<string, never>,
});

const startReq = (playerId: string, npcId = 'carlos') => ({ action: 'start', npcId, playerName: 'Ana', pronoun: 'ela', nameplate: 'verde', playerId, daily: {} });
const turnReq = (playerId: string, text: string, npcId = 'carlos') => ({ action: 'turn', npcId, subjectId: 'cafe_da_manha', playerId, text, history: [], turn: 1, priorChips: [], daily: {} });

describe('Conversa RV persist', () => {
  const prevCap = process.env.CONVERSA_DAILY_CAP;
  const prevRv = process.env.CONVERSA_RV_ONCE_PER_DAY;
  let dir = '';
  let server: http.Server | null = null;
  let store: ProfileStore;

  afterEach(async () => {
    if (prevCap === undefined) delete process.env.CONVERSA_DAILY_CAP;
    else process.env.CONVERSA_DAILY_CAP = prevCap;
    if (prevRv === undefined) delete process.env.CONVERSA_RV_ONCE_PER_DAY;
    else process.env.CONVERSA_RV_ONCE_PER_DAY = prevRv;
    if (server) {
      const closing = server;
      server = null;
      await new Promise<void>((resolve, reject) => closing.close((err) => (err ? reject(err) : resolve())));
    }
    if (dir) {
      closeDatabase(dir);
      fs.rmSync(dir, { recursive: true, force: true });
    }
    dir = '';
  });

  function listen(current: () => ProfileStore, extra: Partial<ConversaApiDeps> = {}) {
    const sessions = extra.sessions ?? new ConversaSessions();
    server = http.createServer((req, res) => {
      void handleConversaApi(req, res, { store: current(), sessions, ...extra });
    });
    return new Promise<number>((resolve) => {
      server!.listen(0, '127.0.0.1', () => {
        const addr = server!.address();
        if (!addr || typeof addr === 'string') throw new Error('no port');
        resolve(addr.port);
      });
    });
  }

  function post(port: number, body: unknown, headers: Record<string, string> = {}) {
    return new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
      const req = http.request(
        { hostname: '127.0.0.1', port, path: '/api/conversa', method: 'POST', headers: { 'content-type': 'application/json', ...headers } },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c as Buffer));
          res.on('end', () => {
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown> });
          });
        },
      );
      req.on('error', reject);
      req.end(typeof body === 'string' ? body : JSON.stringify(body));
    });
  }

  /** A real Conversa the server answers: start, `lines` turns, end. Offline (no xAI key) every turn scores 2/2/2, an "almost". */
  async function play(port: number, playerId: string, lines = ['Bom dia!', 'Um pão na chapa, por favor.', 'Um café com leite, por favor.']) {
    expect((await post(port, startReq(playerId))).body.phase).toBe('open');
    for (const text of lines) expect((await post(port, turnReq(playerId, text))).body.phase).toBe('turn');
    return post(port, passBody(playerId));
  }

  it('keeps RV after reload and does not grant again the same day', async () => {
    delete process.env.CONVERSA_DAILY_CAP;
    process.env.CONVERSA_RV_ONCE_PER_DAY = 'on';
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-conversa-'));
    store = new ProfileStore(fileAdapter(dir));
    store.add(profile('p1'));
    store.flush();

    const port = await listen(() => store);
    const first = await play(port, 'p1');
    expect(first.status).toBe(200);
    // graded from the server's own turn scores (offline 2/2/2), not the 3/3/3 the body claims
    expect(first.body.grade).toBe('almost');
    expect(first.body.grantRv).toBe(true);
    expect(first.body.payout).toBe(5);
    expect(first.body.coins).toBe(105);

    const saved = (openDatabase(dir).prepare('SELECT json FROM profiles').all() as { json: string }[]).map((r) => JSON.parse(r.json) as StoredProfile);
    expect(saved[0]?.coins).toBe(105);
    expect(saved[0]?.daily.conversaRvGranted?.carlos).toBe(conversaDateKey());

    store = new ProfileStore(fileAdapter(dir));
    const second = await play(port, 'p1');
    expect(second.body.grantRv).toBe(false);
    expect(second.body.payout).toBe(0);
    expect(second.body.rvNote).toBe('already_today');
    expect(second.body.coins).toBe(105);
    expect(first.body.rvNote).toBeUndefined();
    expect(store.get('p1')?.coins).toBe(105);

    const start = await post(port, {
      action: 'start',
      npcId: 'carlos',
      playerName: 'Ana',
      pronoun: 'ela',
      nameplate: 'verde',
      playerId: 'p1',
      daily: {},
    });
    expect(start.body.phase).toBe('open');
    expect(CONVERSA_SUBJECTS.cafe_da_manha.seedOpeners).toContain(start.body.line && (start.body.line as { pt: string }).pt);
  });

  it('grants again when the stored day is not today', async () => {
    process.env.CONVERSA_RV_ONCE_PER_DAY = 'on';
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-conversa-'));
    store = new ProfileStore(fileAdapter(dir));
    store.add(profile('p2', 50, '2020-01-01'));
    store.flush();
    const port = await listen(() => store);
    const res = await play(port, 'p2');
    expect(res.body.grantRv).toBe(true);
    expect(res.body.payout).toBe(5);
    expect(store.get('p2')?.coins).toBe(55);
    expect(store.get('p2')?.daily.conversaRvGranted?.carlos).toBe(conversaDateKey());
  });

  it('does not call a short chat an already-earned day', async () => {
    process.env.CONVERSA_RV_ONCE_PER_DAY = 'on';
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-conversa-'));
    store = new ProfileStore(fileAdapter(dir));
    store.add(profile('p4'));
    const port = await listen(() => store);
    const res = await play(port, 'p4', ['Bom dia!']);
    expect(res.body.grantRv).toBe(false);
    expect(res.body.payout).toBe(0);
    expect(res.body.grade).toBe('tryAgain');
    expect(res.body.rvNote).toBeUndefined();
  });

  it('answers a turn when history is missing instead of throwing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no network in unit test'));
    try {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-conversa-'));
      store = new ProfileStore(fileAdapter(dir));
      store.add(profile('p3'));
      const port = await listen(() => store);
      await post(port, startReq('p3'));
      const res = await post(port, {
        action: 'turn',
        npcId: 'carlos',
        subjectId: 'cafe_da_manha',
        playerName: 'Ana',
        pronoun: 'ela',
        nameplate: 'verde',
        playerId: 'p3',
        text: 'Oi tudo bom',
        turn: 1,
      });
      expect(res.status).toBe(200);
      expect(res.body.phase).toBe('turn');
      expect(res.body.mode === 'ai' || res.body.mode === 'authored').toBe(true);
      const line = res.body.line as { pt?: string };
      expect(typeof line?.pt).toBe('string');
      expect(line.pt!.length).toBeGreaterThan(0);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('Gate A exact warn returns a warn toast and Carlos continues; alcohol is a block toast', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no network in unit test'));
    try {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-conversa-'));
      store = new ProfileStore(fileAdapter(dir));
      store.add(profile('p4'));
      const port = await listen(() => store);
      await post(port, startReq('p4'));
      const turn = (text: string) =>
        post(port, {
          action: 'turn',
          npcId: 'carlos',
          subjectId: 'cafe_da_manha',
          playerName: 'Ana',
          pronoun: 'ela',
          nameplate: 'verde',
          playerId: 'p4',
          text,
          history: [],
          turn: 1,
          priorChips: [],
          daily: {},
        });

      const coxinha = 'Essa coxinha tá gostosa!';
      const warned = classifyChat(coxinha);
      const warn = await turn(coxinha);
      expect(warn.status).toBe(200);
      expect(warn.body.phase).toBe('turn');
      expect(warned.action).toBe('warn');
      expect(warned.text).toBe(coxinha);
      expect(warn.body.notice).toEqual({ level: 'warn', pt: warned.note?.pt, en: warned.note?.en });
      const line = warn.body.line as { pt?: string };
      expect(line.pt && line.pt.length).toBeGreaterThan(0);

      const alcohol = 'bora tomar uma cerveja';
      const blocked = classifyChat(alcohol);
      const block = await turn(alcohol);
      expect(block.status).toBe(200);
      expect(block.body.phase).toBe('blocked');
      expect(block.body.reason).toBe('safety');
      expect(blocked.text).toBe('');
      expect(block.body.pt).toBe(blocked.note?.pt);
      expect(block.body.en).toBe(blocked.note?.en);
      expect(block.body.line).toBeUndefined();

      const allow = await turn('Pra comer aqui, por favor.');
      expect(allow.body.phase).toBe('turn');
      expect(allow.body.notice).toBeUndefined();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('a forged end (no start, no turns, perfect scores) grants nothing, 50 times over', async () => {
    process.env.CONVERSA_RV_ONCE_PER_DAY = 'off';
    store = new ProfileStore(null);
    store.add(profile('f1'));
    const ended: string[] = [];
    const port = await listen(() => store, { onConversaEnd: (_p, npc, grade) => ended.push(`${npc}:${grade}`) });
    for (let i = 0; i < 50; i++) {
      const res = await post(port, passBody('f1'));
      expect(res.status).toBe(200);
      expect(res.body.payout).toBe(0);
      expect(res.body.grantRv).toBe(false);
    }
    // a start with no answered turn is not a Conversa either
    await post(port, startReq('f1'));
    expect((await post(port, passBody('f1'))).body.payout).toBe(0);
    expect(store.get('f1')?.coins).toBe(100);
    expect(store.get('f1')?.daily.conversaClears).toBeUndefined();
    expect(ended).toEqual([]);
  });

  it('each Conversa ends once: a repeated end pays nothing more', async () => {
    process.env.CONVERSA_RV_ONCE_PER_DAY = 'off';
    store = new ProfileStore(null);
    store.add(profile('f2'));
    const port = await listen(() => store);
    expect((await play(port, 'f2')).body.payout).toBe(5);
    expect((await post(port, passBody('f2'))).body.payout).toBe(0);
    expect(store.get('f2')?.coins).toBe(105);
  });

  it('ignores the client daily when there is a profile', async () => {
    store = new ProfileStore(null);
    store.add(profile('f3'));
    const port = await listen(() => store);
    await post(port, startReq('f3'));
    await post(port, turnReq('f3', 'Bom dia!'));
    await post(port, turnReq('f3', 'Uma coxinha, por favor.'));
    await post(port, turnReq('f3', 'Um suco de laranja, por favor.'));
    const res = await post(port, { ...passBody('f3'), daily: { conversaRvGranted: { carlos: '2020-01-01' }, conversaClears: { carlos: '2020-01-01' } } });
    expect(res.body.payout).toBe(5);
    expect(store.get('f3')?.daily.conversaRvGranted?.carlos).toBe(conversaDateKey());
  });

  it('rejects an npcId outside the Conversa cast, and turns/ends with a disabled NPC', async () => {
    store = new ProfileStore(null);
    store.add(profile('n1'));
    const port = await listen(() => store);
    for (const npcId of ['fake_npc', '__proto__', 'toString', 42, null]) {
      for (const body of [startReq('n1', npcId as string), turnReq('n1', 'Oi', npcId as string), passBody('n1', npcId as string)]) {
        const res = await post(port, body);
        expect(res.status).toBe(400);
      }
    }
    expect((await post(port, startReq('n1', 'nanda'))).body).toMatchObject({ phase: 'blocked', reason: 'unavailable' });
    expect((await post(port, turnReq('n1', 'Oi', 'nanda'))).status).toBe(400);
    expect((await post(port, passBody('n1', 'nanda'))).body.payout).toBe(0);
    expect(store.get('n1')?.coins).toBe(100);
  });

  it('malformed bodies get a 400, never a crash', async () => {
    store = new ProfileStore(null);
    store.add(profile('m1'));
    const port = await listen(() => store);
    await post(port, startReq('m1'));
    const bad: unknown[] = [
      'not json',
      '[]',
      'null',
      '"turn"',
      { action: 'turn' },
      { action: 'turn', npcId: 'carlos', playerId: 'm1' },
      { ...turnReq('m1', 'Oi'), text: 42 },
      { ...turnReq('m1', 'Oi'), text: '   ' },
      { ...turnReq('m1', 'Oi'), text: 'a'.repeat(281) },
      { ...turnReq('m1', 'Oi'), history: 'oops' },
      { ...turnReq('m1', 'Oi'), history: [{ who: 'npc' }] },
      { ...turnReq('m1', 'Oi'), history: Array.from({ length: 40 }, () => ({ who: 'player', pt: 'oi' })) },
      { ...turnReq('m1', 'Oi'), priorChips: 'x' },
      { ...turnReq('m1', 'Oi'), turn: 'one' },
      { ...turnReq('m1', 'Oi'), daily: 'today' },
      { ...turnReq('m1', 'Oi'), daily: { conversaClears: { carlos: 7 } } },
      { ...turnReq('m1', 'Oi'), pronoun: 'they' },
      { ...turnReq('m1', 'Oi'), nameplate: 'platina' },
      { ...turnReq('m1', 'Oi'), playerName: 'x'.repeat(500) },
      { ...passBody('m1'), scores: 'perfect' },
      { action: 'dance', npcId: 'carlos' },
    ];
    for (const body of bad) {
      const res = await post(port, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    // an end with no scores at all is fine (they are not read): it just ends nothing
    const { scores: _s, turnCount: _t, ...noScores } = passBody('m1');
    expect((await post(port, noScores)).status).toBe(200);
  });

  it('caps the body size and checks origin and content type before anything else', async () => {
    store = new ProfileStore(null);
    store.add(profile('b1'));
    let authCalls = 0;
    const port = await listen(() => store, { playerIdFor: () => (authCalls++, 'b1') });
    const big = await post(port, { ...turnReq('b1', 'Oi'), pad: 'x'.repeat(CONVERSA_MAX_BODY + 10) });
    expect(big.status).toBe(413);
    expect((await post(port, startReq('b1'), { origin: 'https://evil.example' })).status).toBe(403);
    expect((await post(port, startReq('b1'), { 'content-type': 'text/plain' })).status).toBe(403);
    expect((await post(port, startReq('b1'))).status).toBe(200);
    expect(authCalls).toBe(2);
  });

  it('answers 401 without reading the body when signed out', async () => {
    store = new ProfileStore(null);
    const port = await listen(() => store, { playerIdFor: () => undefined });
    expect((await post(port, 'not even json')).status).toBe(401);
  });

  it('rate-limits turns per player and stops at the turn cap', async () => {
    store = new ProfileStore(null);
    store.add(profile('r1'));
    store.add(profile('r2'));
    let now = 1_000_000;
    const sessions = new ConversaSessions({ now: () => now, turnsPerMinute: 3, turnsPerDay: 8 });
    const port = await listen(() => store, { sessions });
    await post(port, startReq('r1'));
    for (let i = 0; i < 3; i++) expect((await post(port, turnReq('r1', 'Oi'))).status).toBe(200);
    expect((await post(port, turnReq('r1', 'Oi'))).status).toBe(429);
    // another player has their own budget
    await post(port, startReq('r2'));
    expect((await post(port, turnReq('r2', 'Oi'))).status).toBe(200);
    // a minute later r1 may talk again, up to the 6-message cap
    now += 61_000;
    for (let i = 0; i < 3; i++) expect((await post(port, turnReq('r1', 'Oi'))).status).toBe(200);
    expect((await post(port, turnReq('r1', 'Oi'))).status).toBe(409);
    // a new Conversa resets the cap but not the day budget (8; refused requests do not count): 2 more turns, then 429
    now += 61_000;
    await post(port, startReq('r1'));
    expect((await post(port, turnReq('r1', 'Oi'))).status).toBe(200);
    expect((await post(port, turnReq('r1', 'Oi'))).status).toBe(200);
    expect((await post(port, turnReq('r1', 'Oi'))).status).toBe(429);
  });

  it('a turn without a started Conversa is refused, and so is one after the session expires', async () => {
    store = new ProfileStore(null);
    store.add(profile('t1'));
    let now = 5_000_000;
    const sessions = new ConversaSessions({ now: () => now, ttlMs: 60_000 });
    const port = await listen(() => store, { sessions });
    expect((await post(port, turnReq('t1', 'Oi'))).status).toBe(409);
    await post(port, startReq('t1'));
    expect((await post(port, turnReq('t1', 'Oi'))).status).toBe(200);
    now += 120_000;
    expect((await post(port, turnReq('t1', 'Oi'))).status).toBe(409);
    expect((await post(port, passBody('t1'))).body.payout).toBe(0);
  });

  it('Dona Graça is addressed by her own name in the offline chips', async () => {
    store = new ProfileStore(null);
    store.add(profile('g1'));
    const port = await listen(() => store);
    const seen: string[] = [];
    for (let i = 0; i < 8; i++) {
      const start = await post(port, startReq('g1', 'graca'));
      seen.push(...(start.body.chips as { pt: string }[]).map((c) => c.pt));
      for (const text of ['Um café com leite, por favor.', 'Pra viagem, por favor.']) {
        const t = await post(port, turnReq('g1', text, 'graca'));
        seen.push(...(t.body.chips as { pt: string }[]).map((c) => c.pt));
      }
    }
    expect(seen.join(' | ')).not.toContain('Seu Carlos');
  });
});
