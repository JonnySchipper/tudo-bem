// Test helpers for the Conversa HTTP flow (not part of the server bundle).
import http from 'node:http';
import { DEFAULT_APPEARANCE } from '@tudobem/shared';
import { handleConversaApi, type ConversaApiDeps } from './conversaApi.js';
import { ProfileStore } from './store.js';
import { World, type Session } from './world.js';
import { AuthoredNpcDialogue, InMemoryStudentModel, JevStubSafety, MemoryModerationQueue, PhrasebookGloss } from './services/stubs.js';

export interface Api {
  port: number;
  post: (body: unknown) => Promise<{ status: number; body: Record<string, unknown> }>;
  close: () => Promise<void>;
}

export function listen(deps: ConversaApiDeps): Promise<Api> {
  const server = http.createServer((req, res) => void handleConversaApi(req, res, deps));
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') throw new Error('no port');
      const port = addr.port;
      resolve({
        port,
        close: () => new Promise<void>((done, fail) => server.close((err) => (err ? fail(err) : done()))),
        post: (body) =>
          new Promise((ok, fail) => {
            const req = http.request({ hostname: '127.0.0.1', port, path: '/api/conversa', method: 'POST', headers: { 'content-type': 'application/json' } }, (res) => {
              const chunks: Buffer[] = [];
              res.on('data', (c) => chunks.push(c as Buffer));
              res.on('end', () => ok({ status: res.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown> }));
            });
            req.on('error', fail);
            req.end(JSON.stringify(body));
          }),
      });
    });
  });
}

/** A world with one signed-in player (in the padaria) whose profile lives in `store`. */
export async function worldWithPlayer(store = new ProfileStore(null)): Promise<{ world: World; store: ProfileStore; s: Session; id: string }> {
  const world = new World(
    store,
    { safety: new JevStubSafety(), gloss: new PhrasebookGloss(), npc: new AuthoredNpcDialogue(), student: new InMemoryStudentModel(), moderation: new MemoryModerationQueue() },
    { schedule: () => {} },
  );
  const s = world.connect('kit', () => {}, () => {});
  await world.handle(s, { t: 'hello' });
  await world.handle(s, { t: 'createProfile', name: 'Ana', pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
  return { world, store, s, id: s.profile!.id };
}

export const startBody = (playerId: string, subjectId = 'cafe_da_manha') => ({
  action: 'start' as const,
  npcId: 'carlos' as const,
  subjectId,
  playerName: 'Ana',
  pronoun: 'ela' as const,
  nameplate: 'verde' as const,
  playerId,
  daily: {},
});

export const turnBody = (playerId: string, text: string, turn: number, subjectId = 'cafe_da_manha') => ({
  action: 'turn' as const,
  npcId: 'carlos' as const,
  subjectId,
  playerName: 'Ana',
  pronoun: 'ela' as const,
  nameplate: 'verde' as const,
  playerId,
  text,
  history: [],
  turn,
  priorChips: [],
  daily: {},
});

export const endBody = (playerId: string) => ({
  action: 'end' as const,
  npcId: 'carlos' as const,
  playerId,
  turnCount: 4,
  scores: { portuguese: 3, grammar: 3, conversation: 3 },
  daily: {},
});
