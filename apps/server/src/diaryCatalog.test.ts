/**
 * Every one of the 489 catalog words has a real way to be earned, and the way matches its source: a player who does only what the word's
 * row says (stand near the object and shoot it, read the sign, hear the line, win the game) ends with all 489 in the diary, each earned
 * from its own source and none twice.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CLOCK_OFFSET_MS,
  COUNTER_STAND_INS,
  DEFAULT_APPEARANCE,
  DIARY_WORDS,
  GAME_DAY_MS,
  HOTSPOT_READ_RANGE,
  MS_PER_GAME_MINUTE,
  PHOTO_RANGE,
  ROOMS,
  buildGrid,
  diaryLine,
  furnitureById,
  hotspotById,
  isHallObject,
  isWalkable,
  photoSpotById,
  readSpot,
  type ClientMsg,
  type DiaryWord,
  type RoomId,
  type ServerMsg,
} from '@tudobem/shared';
import { World, type Session } from './world.js';
import { ProfileStore } from './store.js';
import { AuthoredNpcDialogue, InMemoryStudentModel, JevStubSafety, MemoryModerationQueue, PhrasebookGloss } from './services/stubs.js';

let clock = 0;
const pending: { fn: () => void; at: number }[] = [];
function setGameTime(h: number) {
  clock = 3 * GAME_DAY_MS + h * 60 * MS_PER_GAME_MINUTE - CLOCK_OFFSET_MS;
  pending.length = 0;
}
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

interface Client {
  s: Session;
  inbox: ServerMsg[];
  send: (m: ClientMsg) => Promise<void>;
  last: <T extends ServerMsg['t']>(t: T) => Extract<ServerMsg, { t: T }> | undefined;
}

async function client(world: World): Promise<Client> {
  const inbox: ServerMsg[] = [];
  const s = world.connect('catalog', (m) => inbox.push(m), () => {});
  const c: Client = { s, inbox, send: (m) => world.handle(s, m), last: (t) => [...inbox].reverse().find((m) => m.t === t) as never };
  await c.send({ t: 'hello' });
  await c.send({ t: 'createProfile', name: 'Catalogo', pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
  await c.send({ t: 'join', room: 'praca' });
  await c.send({ t: 'arrival', action: 'finish' });
  return c;
}

const have = (c: Client) => new Set(c.s.profile!.diary ?? []);

describe('every catalog word can be earned from its own source', () => {
  beforeEach(() => setGameTime(10));

  it('earns all 489, and each only the way its row says', async () => {
    const world = new World(
      new ProfileStore(null),
      { safety: new JevStubSafety(), gloss: new PhrasebookGloss(), npc: new AuthoredNpcDialogue(), student: new InMemoryStudentModel(), moderation: new MemoryModerationQueue() },
      { mgGapMs: 0, now: () => clock, schedule: (fn, ms) => pending.push({ fn, at: clock + ms }), rng: () => 0 },
    );
    const a = await client(world);
    const apartment = ['cadeira_madeira', 'poltrona_verde', 'pufe_amarelo', 'mesinha', 'planta', 'tapete', 'radio', 'ventilador', 'gato', 'luminaria', 'estante', 'quadro', 'rede', 'filtro'];
    a.s.profile!.apartment = apartment.map((itemId, i) => ({ uid: `f${i}`, itemId, x: 1 + (i % 6), y: 2 + Math.floor(i / 6), rot: 0 as const }));
    for (const id of apartment) expect(furnitureById(id), id).toBeDefined();

    let room: RoomId | null = null;
    const goRoom = async (to: RoomId) => {
      if (room === to) return;
      await a.send({ t: 'join', room: to });
      expect(a.last('roomState')?.room).toBe(to);
      room = to;
    };
    const walk = async (x: number, y: number) => {
      await a.send({ t: 'move', x, y });
      for (let t = 0; t < 90_000; t += 1000) advance(1000);
    };
    const nearTile = (r: RoomId, box: { x: number; y: number; w?: number; h?: number }, range: number) => {
      // the kitnet's own furniture is in the way, as it is for the walk
      const grid = buildGrid(ROOMS[r], r === 'kitnet' ? a.s.profile!.apartment : []);
      const spot = readSpot(box, ROOMS[r].spawn, (x, y) => isWalkable(grid, x, y), range);
      if (!spot) throw new Error(`no tile within ${range} of ${JSON.stringify(box)} in ${r}`);
      return spot;
    };

    // ---------------------------------------------------------------- camera: one shot of one object, from within range
    const cameraWords = DIARY_WORDS.filter((w) => w.source === 'camera');
    const objectRoom = (id: string): RoomId | 'hall' => {
      if (isHallObject(id)) return 'hall';
      const spot = photoSpotById(id);
      if (spot) return spot.room;
      if (furnitureById(id)) return 'kitnet';
      const r = (Object.keys(ROOMS) as RoomId[]).find((k) => ROOMS[k].props.some((p) => p.id === id));
      if (!r) throw new Error(`no room for object ${id}`);
      return r;
    };
    const byRoom = new Map<RoomId | 'hall', DiaryWord[]>();
    for (const w of cameraWords) byRoom.set(objectRoom(w.anchor.id), [...(byRoom.get(objectRoom(w.anchor.id)) ?? []), w]);
    for (const [where, words] of byRoom) {
      if (where === 'hall') {
        for (const w of words) await a.send({ t: 'diary', action: 'photo', anchors: [w.anchor.id], hall: true });
      } else {
        await goRoom(where);
        for (const w of words) {
          const id = w.anchor.id;
          const box = ROOMS[where].props.find((p) => p.id === id) ?? photoSpotById(id) ?? { x: ROOMS[where].spawn.x, y: ROOMS[where].spawn.y };
          const t = nearTile(where, box, PHOTO_RANGE);
          await walk(t.x, t.y);
          // film is not what is being tried: a roll a shot
          a.s.profile!.film = 99;
          await a.send({ t: 'diary', action: 'photo', anchors: [id] });
        }
      }
      for (const w of words) expect(have(a).has(w.id), `camera: ${w.pt} (${w.anchor.id}) in ${where}`).toBe(true);
    }

    // ---------------------------------------------------------------- reading: read the sign from within reading range
    for (const w of DIARY_WORDS.filter((x) => x.source === 'reading')) {
      const id = w.anchor.id;
      if (id === 'arrival.kicker') {
        expect(have(a).has(w.id), `reading: ${w.pt}`).toBe(true);
        continue;
      }
      if (id.startsWith('hall_s_')) {
        await a.send({ t: 'diary', action: 'sign', anchor: id });
      } else {
        const h = hotspotById(id)!;
        await goRoom(h.room);
        const t = nearTile(h.room, h, HOTSPOT_READ_RANGE);
        await walk(t.x, t.y);
        await a.send({ t: 'read', hotspotId: id });
      }
      expect(have(a).has(w.id), `reading: ${w.pt} (${id})`).toBe(true);
    }

    // ---------------------------------------------------------------- conversation: hear the line from near whoever says it
    for (const w of DIARY_WORDS.filter((x) => x.source === 'conversation')) {
      const info = diaryLine(w.anchor.id)!;
      if (info.kind === 'arrival') {
        expect(have(a).has(w.id), `conversation: ${w.pt}`).toBe(true);
        continue;
      }
      const home = (Object.keys(ROOMS) as RoomId[]).find((r) => ROOMS[r].npcs.some((n) => n.id === info.npc || (COUNTER_STAND_INS[info.npc] ?? []).includes(n.id)));
      const night = info.npc === 'graca';
      if (night) setGameTime(22);
      else setGameTime(10);
      const vendorAway = info.kind === 'closed';
      const where = home ?? (Object.keys(ROOMS) as RoomId[]).find((r) => ROOMS[r].props.some((p) => p.vendor === info.npc))!;
      if (night || room !== where) {
        room = null;
        await goRoom(where);
      }
      if (vendorAway) {
        const stall = ROOMS[where].props.find((p) => p.vendor === info.npc)!;
        const t = nearTile(where, stall, HOTSPOT_READ_RANGE);
        await walk(t.x, t.y);
      } else {
        const avatar = a.last('roomState')?.avatars.find((v) => v.npc === info.npc || (COUNTER_STAND_INS[info.npc] ?? []).includes(v.npc ?? ''));
        expect(avatar?.npcInteract, `${w.pt}: ${info.npc} is in ${where}`).toBeTruthy();
        await walk(avatar!.npcInteract!.x, avatar!.npcInteract!.y);
      }
      await a.send({ t: 'diary', action: 'line', anchor: w.anchor.id });
      expect(have(a).has(w.id), `conversation: ${w.pt} (${w.anchor.id})`).toBe(true);
    }

    // ---------------------------------------------------------------- game: Dona Lúcia's practice, and Seu Carlos after a won shift
    setGameTime(10);
    room = null;
    await goRoom('escola');
    await a.send({ t: 'diary', action: 'practice' });
    const asked = [...a.inbox].reverse().find((m): m is Extract<ServerMsg, { t: 'diary'; phase: 'practice' }> => m.t === 'diary' && m.phase === 'practice');
    if (!asked || !asked.ok) throw new Error('no practice round');
    const word = DIARY_WORDS.find((w) => have(a).has(w.id) && w.en === asked.en)!;
    await a.send({ t: 'diary', action: 'answer', choice: word.pt });
    const diary = (world as unknown as { diary: { onCorreriaWin: (s: Session, items: string[]) => void } }).diary;
    diary.onCorreriaWin(a.s, ['bolo', 'guarana', 'coxinha', 'pao_de_queijo', 'misto_quente']);
    for (const w of DIARY_WORDS.filter((x) => x.source === 'game')) expect(have(a).has(w.id), `game: ${w.pt}`).toBe(true);

    // all of them, once each
    expect(a.s.profile!.diary).toHaveLength(489);
    expect(new Set(a.s.profile!.diary).size).toBe(489);
    expect(DIARY_WORDS.every((w) => have(a).has(w.id))).toBe(true);
  }, 120_000);
});
