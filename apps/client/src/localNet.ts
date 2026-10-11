/**
 * Solo mode: runs the authoritative World (same code as the Node server) inside the page.
 * Used by the static deploy (GitHub Pages / any CDN) so the full Phase 0 play path works without a
 * WebSocket server. Profiles persist in localStorage. Other humans need the server build.
 */
import type { ClientMsg, ServerMsg } from '@tudobem/shared';
import { World, type Session } from '@tudobem/server/world';
import { AcademyStore, type AcademyPersistence } from '@tudobem/server/academy';
import { PadariaStore, type PadariaPersistence } from '@tudobem/server/padaria';
import { ProfileStore, type PersistenceAdapter, type StoredProfile } from '@tudobem/server/store';
import { AuthoredNpcDialogue, InMemoryStudentModel, JevStubSafety, MemoryModerationQueue, PhrasebookGloss } from '@tudobem/server/services';
import { withTz, type NetLike, type NetStatus } from './net';

const KEY = 'tb_solo_profiles_v1';
const ACADEMY_KEY = 'tb_solo_academies_v1';
const PADARIA_KEY = 'tb_solo_padarias_v1';

const localAdapter: PersistenceAdapter = {
  describe: () => 'localStorage',
  load: () => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? '[]') as StoredProfile[];
    } catch {
      return [];
    }
  },
  save: (rows) => localStorage.setItem(KEY, JSON.stringify(rows)),
};

const academyAdapter: AcademyPersistence = {
  describe: () => 'localStorage academies',
  load: () => {
    try {
      const raw = JSON.parse(localStorage.getItem(ACADEMY_KEY) ?? '[]') as unknown;
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  },
  save: (rows) => localStorage.setItem(ACADEMY_KEY, JSON.stringify(rows)),
};

const padariaAdapter: PadariaPersistence = {
  describe: () => 'localStorage padarias',
  load: () => {
    try {
      const raw = JSON.parse(localStorage.getItem(PADARIA_KEY) ?? '[]') as unknown;
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  },
  save: (rows) => localStorage.setItem(PADARIA_KEY, JSON.stringify(rows)),
};

type Handler = (m: ServerMsg) => void;

export class LocalNet implements NetLike {
  readonly solo = true;
  private handlers = new Set<Handler>();
  private world: World | null = null;
  private session: Session | null = null;
  onStatus: (s: NetStatus) => void = () => {};
  onOpen: () => void = () => {};

  retry() {}

  connect() {
    this.world = new World(new ProfileStore(localAdapter), {
      safety: new JevStubSafety(),
      gloss: new PhrasebookGloss(),
      npc: new AuthoredNpcDialogue(),
      student: new InMemoryStudentModel(),
      moderation: new MemoryModerationQueue(),
    }, {
      ambiance: new URLSearchParams(location.search).get('cpu') !== 'off',
      testRollHints: new URLSearchParams(location.search).has('rolltest'),
      testMg: new URLSearchParams(location.search).has('crtest'),
      boutIntroMs: Number(new URLSearchParams(location.search).get('boutintro')) || undefined,
      boutPace: Number(new URLSearchParams(location.search).get('boutpace')) || undefined,
      // test hook, the solo twin of TB_TEST_CLOCK_OFFSET_MIN: `?tbclockmin=<real minutes>` shifts the game clock (schedules, greetings, the sky)
      clockOffsetMs: Number(new URLSearchParams(location.search).get('tbclockmin') ?? 0) * 60_000 || 0,
      academies: new AcademyStore(academyAdapter),
      padarias: new PadariaStore(padariaAdapter),
      padariaOwnership: true,
      // shots/e2e: `?feiraon=pastel` switches that cart game on. The admin flags still default off.
      feiraPin: new URLSearchParams(location.search).get('feiraon') ?? undefined,
    });
    // JSON round-trip mirrors the wire so client state never aliases server state.
    this.session = this.world.connect(
      'solo',
      (m) => {
        const copy = JSON.parse(JSON.stringify(m)) as ServerMsg;
        queueMicrotask(() => this.handlers.forEach((h) => h(copy)));
      },
      () => {},
    );
    this.onStatus('open');
    this.onOpen();
  }

  send(m: ClientMsg) {
    if (!this.world || !this.session) return;
    void this.world.handle(this.session, JSON.parse(JSON.stringify(withTz(m))));
  }

  /** Shot / e2e hook: cart games ship off. Turn one on for this solo session (`caldo`, `tapioca`). */
  enableFeiraGame(id: string): boolean {
    return this.world?.enableFeiraGame(id) ?? false;
  }

  /** Test/shots hook (`?rolltest` only): the live bout of the in-page world (`mat` is the Tatame v3 state), to stage a moment (the top, a grip). */
  debugBout(): { mat: Record<string, unknown>; phase: string } | null {
    return new URLSearchParams(location.search).has('rolltest') ? ((this.session?.bout as unknown as { mat: Record<string, unknown>; phase: string } | undefined) ?? null) : null;
  }

  /** Test/shots hook (`?rolltest` only): the in-page session, to stage a moment (a blue belt unlocks every partner). */
  debugSession(): Session | null {
    return new URLSearchParams(location.search).has('rolltest') ? this.session : null;
  }

  on(h: Handler) {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }
}
