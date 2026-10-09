import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONVERSA_SUBJECTS, DEFAULT_APPEARANCE, TUTORIAL_STEPS, classifyChat, conversaDateKey, type TutorialStep } from '@tudobem/shared';
import { handleConversaApi } from './conversaApi.js';
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

const passBody = (playerId: string) => ({
  action: 'end' as const,
  npcId: 'carlos' as const,
  playerId,
  turnCount: 4,
  scores: { portuguese: 3, grammar: 3, conversation: 3 },
  daily: {} as Record<string, never>,
});

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

  function listen(current: () => ProfileStore) {
    server = http.createServer((req, res) => {
      void handleConversaApi(req, res, { store: current() });
    });
    return new Promise<number>((resolve) => {
      server!.listen(0, '127.0.0.1', () => {
        const addr = server!.address();
        if (!addr || typeof addr === 'string') throw new Error('no port');
        resolve(addr.port);
      });
    });
  }

  function post(port: number, body: unknown) {
    return new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
      const req = http.request(
        { hostname: '127.0.0.1', port, path: '/api/conversa', method: 'POST', headers: { 'content-type': 'application/json' } },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c as Buffer));
          res.on('end', () => {
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown> });
          });
        },
      );
      req.on('error', reject);
      req.end(JSON.stringify(body));
    });
  }

  it('keeps RV after reload and does not grant again the same day', async () => {
    delete process.env.CONVERSA_DAILY_CAP;
    process.env.CONVERSA_RV_ONCE_PER_DAY = 'on';
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-conversa-'));
    store = new ProfileStore(fileAdapter(dir));
    store.add(profile('p1'));
    store.flush();

    const port = await listen(() => store);
    const first = await post(port, passBody('p1'));
    expect(first.status).toBe(200);
    expect(first.body.grantRv).toBe(true);
    expect(first.body.payout).toBe(20);
    expect(first.body.coins).toBe(120);

    const saved = (openDatabase(dir).prepare('SELECT json FROM profiles').all() as { json: string }[]).map((r) => JSON.parse(r.json) as StoredProfile);
    expect(saved[0]?.coins).toBe(120);
    expect(saved[0]?.daily.conversaRvGranted?.carlos).toBe(conversaDateKey());

    store = new ProfileStore(fileAdapter(dir));
    const second = await post(port, passBody('p1'));
    expect(second.body.grantRv).toBe(false);
    expect(second.body.payout).toBe(0);
    expect(second.body.rvNote).toBe('already_today');
    expect(second.body.coins).toBe(120);
    expect(first.body.rvNote).toBeUndefined();
    expect(store.get('p1')?.coins).toBe(120);

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
    const res = await post(port, passBody('p2'));
    expect(res.body.grantRv).toBe(true);
    expect(res.body.payout).toBe(20);
    expect(store.get('p2')?.coins).toBe(70);
    expect(store.get('p2')?.daily.conversaRvGranted?.carlos).toBe(conversaDateKey());
  });

  it('does not call a short chat an already-earned day', async () => {
    process.env.CONVERSA_RV_ONCE_PER_DAY = 'on';
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-conversa-'));
    store = new ProfileStore(fileAdapter(dir));
    store.add(profile('p4'));
    const port = await listen(() => store);
    const res = await post(port, { ...passBody('p4'), turnCount: 1 });
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
});
