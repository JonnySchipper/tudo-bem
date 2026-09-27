/**
 * Solo mode: runs the authoritative World (same code as the Node server) inside the page.
 * Used by the static deploy (GitHub Pages / any CDN) so the full Phase 0 play path works without a
 * WebSocket server. Profiles persist in localStorage. Other humans need the server build.
 */
import type { ClientMsg, ServerMsg } from '@tudobem/shared';
import { World, type Session } from '@tudobem/server/world';
import { ProfileStore, type PersistenceAdapter, type StoredProfile } from '@tudobem/server/store';
import { AuthoredNpcDialogue, InMemoryStudentModel, JevStubSafety, MemoryModerationQueue, PhrasebookGloss } from '@tudobem/server/services';
import type { NetLike, NetStatus } from './net';

const KEY = 'tb_solo_profiles_v1';

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
      rollQueueMs: 600,
      testRollHints: new URLSearchParams(location.search).has('rolltest'),
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
    void this.world.handle(this.session, JSON.parse(JSON.stringify(m)));
  }

  on(h: Handler) {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }
}
