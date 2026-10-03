import { describe, expect, it } from 'vitest';
import { CARTELA_REWARD, freshCartela } from '@tudobem/shared';
import { CartelaTracker } from './cartela.js';
import { ProfileStore, type StoredProfile } from './store.js';
import { World, type Session } from './world.js';
import { AuthoredNpcDialogue, InMemoryStudentModel, JevStubSafety, MemoryModerationQueue, PhrasebookGloss } from './services/stubs.js';
import { DEFAULT_APPEARANCE, type ServerMsg } from '@tudobem/shared';

const DAY = '2026-10-03';
const NEXT = '2026-10-04';

function profile(id = 'p1'): StoredProfile {
  return {
    id,
    token: 'tok',
    name: 'Ana',
    pronoun: 'ela',
    appearance: {
      body: 'medio',
      skin: 3,
      hair: 'cacheado',
      hairColor: 1,
      top: 'camiseta',
      topColor: 1,
      bottom: 'calca',
      bottomColor: 2,
      shoes: 0,
      face: 'suave',
      extra: 'nenhum',
      idle: 'solto',
    },
    nameplate: 'verde',
    coins: 10,
    hats: [],
    hat: null,
    furniture: {},
    apartment: [],
    parrotOwned: false,
    parrotEquipped: false,
    friends: [],
    tutorial: { andar: true, sentar: true, acenar: true, conversar: true, carlos: true, meveum: true, chapeu: true, cadeira: true },
    tutorialRewarded: true,
    createdAt: 1,
    ageGate18: true,
    daily: { date: DAY, sceneClears: {} },
    lastSeen: 1,
    cartela: freshCartela(),
  };
}

function harness(day = () => DAY) {
  const store = new ProfileStore(null);
  const p = profile();
  store.add(p);
  const inbox: ServerMsg[] = [];
  const s: Session = {
    id: 'c0',
    profile: store.get(p.id),
    send: (m) => inbox.push(m),
    close: () => {},
  };
  const tracker = new CartelaTracker({
    now: () => 0,
    store,
    day,
    reward: (sess, amount) => {
      sess.profile!.coins += amount;
      store.save();
    },
    pushProfile: () => {},
  });
  return { tracker, s, store, p, inbox };
}

describe('CartelaTracker (server)', () => {
  it('stamps each activity once per ET day and pays on the 7th', () => {
    const { tracker, s, store } = harness();
    expect(tracker.tryStamp(s, 'tatame')).toBe(true);
    expect(tracker.tryStamp(s, 'tatame')).toBe(false);
    expect(store.get(s.profile!.id)!.cartela!.stamps).toBe(1);
    store.get(s.profile!.id)!.cartela = { stamps: 6, activityDay: {} };
    s.profile = store.get(s.profile!.id);
    expect(tracker.tryStamp(s, 'balcao')).toBe(true);
    expect(s.profile!.cartela!.stamps).toBe(0);
    expect(s.profile!.coins).toBe(10 + CARTELA_REWARD);
  });

  it('allows the same activity again on a new ET day', () => {
    let d = DAY;
    const { tracker, s } = harness(() => d);
    expect(tracker.tryStamp(s, 'feira')).toBe(true);
    expect(tracker.tryStamp(s, 'feira')).toBe(false);
    d = NEXT;
    expect(tracker.tryStamp(s, 'feira')).toBe(true);
    expect(s.profile!.cartela!.stamps).toBe(2);
  });

  it('persists on the profile across a new store load', () => {
    const adapter = {
      rows: [] as StoredProfile[],
      load() {
        return this.rows;
      },
      save(rows: StoredProfile[]) {
        this.rows = rows;
      },
      describe: () => 'mem',
    };
    const store = new ProfileStore(adapter);
    const p = profile('persist');
    store.add(p);
    const inbox: ServerMsg[] = [];
    const s: Session = {
      id: 'c1',
      profile: store.get(p.id),
      send: (m) => inbox.push(m),
      close: () => {},
    };
    const tracker = new CartelaTracker({
      now: () => 0,
      store,
      day: () => DAY,
      reward: () => {},
      pushProfile: () => {},
    });
    tracker.tryStamp(s, 'conversa');
    store.flush();
    const reloaded = new ProfileStore(adapter);
    expect(reloaded.get('persist')!.cartela).toMatchObject({ stamps: 1, activityDay: { conversa: DAY } });
  });
});

describe('World cartela hooks', () => {
  it('does not stamp feira when only entering the praça', async () => {
    const world = new World(
      new ProfileStore(null),
      { safety: new JevStubSafety(), gloss: new PhrasebookGloss(), npc: new AuthoredNpcDialogue(), student: new InMemoryStudentModel(), moderation: new MemoryModerationQueue() },
      { roomCap: 8, testMg: true, now: () => 1e6, schedule: () => {} },
    );
    const inbox: ServerMsg[] = [];
    const sess = world.connect('x', (m) => inbox.push(m), () => {});
    await world.handle(sess, { t: 'hello' });
    await world.handle(sess, { t: 'createProfile', name: 'Lua', pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
    await world.handle(sess, { t: 'join', room: 'praca' });
    expect(inbox.some((m) => m.t === 'cartela')).toBe(false);
    await world.handle(sess, { t: 'join', room: 'feira' });
    expect(inbox.some((m) => m.t === 'cartela' && m.activity === 'feira')).toBe(true);
  });
});
