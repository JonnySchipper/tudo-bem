import { afterEach, describe, expect, it, vi } from 'vitest';
import { FRIEND_REQUESTS_MAX, FriendRequests } from './friendRequests.js';
import { formatIntegrations } from './integrations.js';
import { guarded, safeSchedule } from './safeTimer.js';
import { InMemoryStudentModel } from './services/stubs.js';
import { ProfileStore, toPrivate, type PersistenceAdapter, type StoredProfile } from './store.js';

const profile = (id: string) => ({ id, name: id, token: `t-${id}`, ageGate18: true }) as unknown as StoredProfile;

/** A store over an in-memory "table" that survives a new ProfileStore (a restart). */
function memoryTable(seed: StoredProfile[]) {
  let table = JSON.stringify(seed);
  const adapter: PersistenceAdapter = {
    describe: () => 'memory',
    load: () => JSON.parse(table) as StoredProfile[],
    save: (rows) => void (table = JSON.stringify(rows)),
  };
  return adapter;
}

describe('timer safety', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('logs a throwing callback instead of letting it escape', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      guarded('npc', () => {
        throw new Error('boom');
      })(),
    ).not.toThrow();
    expect(err.mock.calls[0]?.[0]).toContain('[npc]');
  });

  it('the World default schedule keeps running other timers after one throws', () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const ran: string[] = [];
    safeSchedule(() => {
      throw new Error('bad tick');
    }, 10);
    safeSchedule(() => ran.push('next'), 20);
    expect(() => vi.advanceTimersByTime(30)).not.toThrow();
    expect(ran).toEqual(['next']);
  });
});

describe('friend requests', () => {
  it('survive a restart and stay off the client profile', () => {
    const adapter = memoryTable([profile('ana'), profile('beto')]);
    const store = new ProfileStore(adapter);
    const reqs = new FriendRequests(store);
    reqs.add('beto', 'ana');
    store.flush();

    const after = new FriendRequests(new ProfileStore(adapter));
    expect(after.has('beto', 'ana')).toBe(true);
    expect(after.incoming('beto')).toEqual(['ana']);
    expect('friendRequestsIn' in toPrivate(store.get('beto')!)).toBe(false);
  });

  it('caps the pending list and drops answered ones', () => {
    const store = new ProfileStore(null);
    store.add(profile('beto'));
    const reqs = new FriendRequests(store);
    for (let i = 0; i < FRIEND_REQUESTS_MAX + 5; i++) reqs.add('beto', `p${i}`);
    expect(reqs.incoming('beto')).toHaveLength(FRIEND_REQUESTS_MAX);
    expect(reqs.has('beto', 'p0')).toBe(false);
    reqs.delete('beto', `p${FRIEND_REQUESTS_MAX + 4}`);
    expect(reqs.incoming('beto')).toHaveLength(FRIEND_REQUESTS_MAX - 1);
    reqs.add('nobody', 'p1');
    expect(reqs.incoming('nobody')).toEqual([]);
  });
});

describe('in-memory pruning', () => {
  it('drops student stats of players who left', () => {
    const m = new InMemoryStudentModel();
    m.record({ playerId: 'gone', itemIds: ['x'], score: 3, at: 1, place: 'praca' } as never);
    m.record({ playerId: 'here', itemIds: ['x'], score: 3, at: 1, place: 'praca' } as never);
    m.prune(new Set(['here']));
    const stats = (m as unknown as { stats: Map<string, unknown> }).stats;
    expect([...stats.keys()]).toEqual(['here']);
  });
});

describe('boot integrations line', () => {
  it('says on/off only', () => {
    const line = formatIntegrations({ ai: true, googleAuth: false, billing: false, admin: true, githubToken: true });
    expect(line).toBe('[boot] integrations ai=on google_auth=off billing=off admin=on github_token=on');
  });
});
