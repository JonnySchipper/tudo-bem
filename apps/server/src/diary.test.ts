import { beforeEach, describe, expect, it } from 'vitest';
import {
  CLOCK_OFFSET_MS,
  DEFAULT_APPEARANCE,
  ECONOMY,
  FILM,
  GAME_DAY_MS,
  HOTSPOTS,
  MS_PER_GAME_MINUTE,
  ROOMS,
  buildGrid,
  diaryWord,
  hotspotById,
  isWalkable,
  readSpot,
  type ClientMsg,
  type ServerMsg,
} from '@tudobem/shared';
import { World, type Session } from './world.js';
import { ProfileStore } from './store.js';
import { AuthoredNpcDialogue, InMemoryStudentModel, JevStubSafety, MemoryModerationQueue, PhrasebookGloss } from './services/stubs.js';

let clock = 0;
const pending: { fn: () => void; at: number }[] = [];
function setGameTime(h: number, m = 0) {
  clock = 3 * GAME_DAY_MS + (h * 60 + m) * MS_PER_GAME_MINUTE - CLOCK_OFFSET_MS;
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
function run(ms: number) {
  for (let t = 0; t < ms; t += 1000) advance(1000);
}

function makeWorld() {
  return new World(
    new ProfileStore(null),
    { safety: new JevStubSafety(), gloss: new PhrasebookGloss(), npc: new AuthoredNpcDialogue(), student: new InMemoryStudentModel(), moderation: new MemoryModerationQueue() },
    { mgGapMs: 0, now: () => clock, schedule: (fn, ms) => pending.push({ fn, at: clock + ms }) },
  );
}

interface Client {
  s: Session;
  inbox: ServerMsg[];
  send: (m: ClientMsg) => Promise<void>;
  last: <T extends ServerMsg['t']>(t: T) => Extract<ServerMsg, { t: T }> | undefined;
  all: <T extends ServerMsg['t']>(t: T) => Extract<ServerMsg, { t: T }>[];
}

let n = 0;
async function client(world: World): Promise<Client> {
  const inbox: ServerMsg[] = [];
  const s = world.connect(`d${n++}`, (m) => inbox.push(m), () => {});
  const c: Client = {
    s,
    inbox,
    send: (m) => world.handle(s, m),
    last: (t) => [...inbox].reverse().find((m) => m.t === t) as never,
    all: (t) => inbox.filter((m) => m.t === t) as never,
  };
  await c.send({ t: 'hello' });
  await c.send({ t: 'createProfile', name: `Dia${n++}`, pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
  await c.send({ t: 'join', room: 'praca' });
  return c;
}

async function walkTo(c: Client, x: number, y: number) {
  await c.send({ t: 'move', x, y });
  run(60_000);
}

function spotNear(roomId: 'praca', anchor: { x: number; y: number; w?: number; h?: number }) {
  const grid = buildGrid(ROOMS[roomId]);
  const spot = readSpot(anchor, ROOMS[roomId].spawn, (x, y) => isWalkable(grid, x, y));
  if (!spot) throw new Error(`no spot near ${anchor.x},${anchor.y}`);
  return spot;
}

const diaryOf = (m: ServerMsg) => (m.t === 'diary' ? m : undefined);

describe('arrival, camera, diary and the escola', () => {
  beforeEach(() => setGameTime(10));

  it('gives a new account the intro, the camera and the cartela once, then skips it', async () => {
    const world = makeWorld();
    const a = await client(world);
    expect(a.last('welcome')?.profile.arrivalIntroDone).toBe(false);
    expect(a.last('welcome')?.profile.hasCamera).toBe(false);
    expect(a.s.profile?.diary ?? []).toEqual([]);
    await a.send({ t: 'arrival', action: 'finish' });
    expect(a.s.profile).toMatchObject({ arrivalIntroDone: true, hasCamera: true, film: FILM.starter });
    const notice = a.all('notice').map((n) => n.pt).join(' ');
    expect(notice).toMatch(/câmera/);
    // the cartela is on this build: Júlia hands it over in the intro, and the notice no longer says it is missing
    expect(notice).not.toMatch(/ainda não chegou/);
    expect(a.s.profile?.cartela).toMatchObject({ stamps: 0 });
    await a.send({ t: 'arrival', action: 'finish' });
    expect(a.all('notice').filter((n) => n.pt.includes('câmera'))).toHaveLength(1);
  });

  it('sends photo images in their own message, never inside the profile', async () => {
    const world = makeWorld();
    const a = await client(world);
    await a.send({ t: 'arrival', action: 'finish' });
    await a.send({ t: 'diary', action: 'photo', anchors: [], image: 'data:image/jpeg;base64,AAAA' });
    expect(a.last('photos')?.photos.map((p) => p.image)).toEqual(['data:image/jpeg;base64,AAAA']);
    for (const m of a.all('profile')) expect(m.profile.photos).toBeUndefined();
    expect(a.s.profile?.photos).toHaveLength(1);
  });

  it('photographs, reads, and hears each seeded praça word once, and will not take it from another source', async () => {
    const world = makeWorld();
    const a = await client(world);
    await a.send({ t: 'arrival', action: 'finish' });
    const fonte = ROOMS.praca.props.find((p) => p.id === 'fonte')!;
    await walkTo(a, 1, 22);
    await a.send({ t: 'diary', action: 'photo', anchor: 'fonte' });
    expect(a.all('error').some((e) => e.code === 'far')).toBe(true);
    expect(a.s.profile?.film).toBe(FILM.starter);

    const nearFonte = spotNear('praca', fonte);
    await walkTo(a, nearFonte.x, nearFonte.y);
    await a.send({ t: 'diary', action: 'photo', anchor: 'fonte' });
    const shot = [...a.inbox].reverse().find((m) => m.t === 'diary' && m.phase === 'photo');
    expect(shot && diaryOf(shot)).toMatchObject({ ok: true, pt: 'fonte', en: 'fountain', source: 'camera' });
    if (shot && shot.t === 'diary' && shot.phase === 'photo' && shot.ok) {
      expect(shot.progress).toMatch(/^1\/1 /);
      expect(shot.progress).not.toMatch(/\/100\b/);
      expect(shot.areaPt).toBe('Praça');
    }
    expect(a.s.profile?.diary).toEqual(['seed.praca.fonte']);

    await a.send({ t: 'diary', action: 'photo', anchor: 'fonte' });
    const again = [...a.inbox].reverse().find((m) => m.t === 'diary' && m.phase === 'photo');
    expect(again).toMatchObject({ ok: false, pt: 'fonte' });
    expect(a.s.profile?.diary).toEqual(['seed.praca.fonte']);

    await a.send({ t: 'diary', action: 'photo', anchor: 'coreto_placa' });
    expect(a.s.profile?.diary).toEqual(['seed.praca.fonte']);

    const sign = hotspotById('coreto_placa')!;
    expect(HOTSPOTS.some((h) => h.id === 'coreto_placa')).toBe(true);
    const nearSign = spotNear('praca', sign);
    await walkTo(a, nearSign.x, nearSign.y);
    await a.send({ t: 'read', hotspotId: 'fonte_praca' });
    expect(a.s.profile?.diary).toEqual(['seed.praca.fonte']);
    await a.send({ t: 'read', hotspotId: 'coreto_placa' });
    expect(a.s.profile?.diary).toEqual(['seed.praca.fonte', 'seed.praca.coreto']);
    await a.send({ t: 'read', hotspotId: 'coreto_placa' });
    expect(a.s.profile?.diary).toEqual(['seed.praca.fonte', 'seed.praca.coreto']);

    await a.send({ t: 'diary', action: 'line', anchor: 'julia.ajuda' });
    expect(a.s.profile?.diary).not.toContain('seed.praca.guia');
    const julia = a.last('roomState')?.avatars.find((v) => v.npc === 'julia');
    expect(julia?.npcInteract).toBeTruthy();
    await walkTo(a, julia!.npcInteract!.x, julia!.npcInteract!.y);
    await a.send({ t: 'diary', action: 'line', anchor: 'julia.ajuda' });
    expect(a.s.profile?.diary).toEqual(['seed.praca.fonte', 'seed.praca.coreto', 'seed.praca.guia']);
    await a.send({ t: 'diary', action: 'line', anchor: 'julia.oi' });
    expect(a.s.profile?.diary).toEqual(['seed.praca.fonte', 'seed.praca.coreto', 'seed.praca.guia']);
    expect(a.s.profile?.film).toBe(FILM.starter - 2);

    await a.send({ t: 'diary', action: 'buyFilm' });
    expect(a.s.profile?.coins).toBe(ECONOMY.startingCoins - FILM.price);
    expect(a.s.profile?.film).toBe(FILM.starter - 2 + FILM.pack);
    expect(a.all('notice').some((n) => n.pt.includes('Júlia') && n.pt.includes('filme'))).toBe(true);
  });

  it('practices an earned word in the escola: a miss pays nothing, a win pays RV and one game word from the host', async () => {
    const world = makeWorld();
    const a = await client(world);
    await a.send({ t: 'arrival', action: 'finish' });
    const fonte = ROOMS.praca.props.find((p) => p.id === 'fonte')!;
    const near = spotNear('praca', fonte);
    await walkTo(a, near.x, near.y);
    await a.send({ t: 'diary', action: 'photo', anchor: 'fonte' });
    expect(a.s.profile?.coins).toBe(ECONOMY.startingCoins);

    await a.send({ t: 'join', room: 'escola' });
    expect(a.last('roomState')?.room).toBe('escola');
    expect(a.last('roomState')?.avatars.some((v) => v.npc === 'lucia')).toBe(true);
    await a.send({ t: 'diary', action: 'practice' });
    const dealt = [...a.inbox].reverse().find((m) => m.t === 'diary' && m.phase === 'practice');
    expect(dealt).toMatchObject({ ok: true, host: 'Dona Lúcia', en: 'fountain' });
    if (!dealt || dealt.t !== 'diary' || dealt.phase !== 'practice' || !dealt.ok) throw new Error('practice did not start');
    const wrong = dealt.options.find((o) => o.toLowerCase() !== 'fonte')!;
    expect(wrong).toBeTruthy();
    await a.send({ t: 'diary', action: 'answer', choice: wrong });
    const miss = [...a.inbox].reverse().find((m) => m.t === 'diary' && m.phase === 'result');
    expect(miss).toMatchObject({ correct: false, host: 'Dona Lúcia', granted: null });
    expect(a.s.profile?.coins).toBe(ECONOMY.startingCoins);
    expect(a.s.profile?.diary).toEqual(['seed.praca.fonte']);
    expect(a.all('reward')).toHaveLength(0);

    await a.send({ t: 'diary', action: 'answer', choice: 'fonte' });
    const win = [...a.inbox].reverse().find((m) => m.t === 'diary' && m.phase === 'result');
    expect(win).toMatchObject({ correct: true, host: 'Dona Lúcia', granted: { pt: 'aula', en: 'class' } });
    if (win && win.t === 'diary' && win.phase === 'result') expect(win.line.pt).toMatch(/Dona Lúcia/);
    expect(a.all('reward').at(-1)).toMatchObject({ amount: 8 });
    expect(a.all('reward').at(-1)?.reason.pt).toMatch(/Dona Lúcia/);
    expect(a.s.profile?.coins).toBe(ECONOMY.startingCoins + 8);
    expect(a.s.profile?.diary).toEqual(['seed.praca.fonte', 'seed.praca.aula']);
    expect(diaryWord('seed.praca.aula')?.source).toBe('game');

    await a.send({ t: 'diary', action: 'practice' });
    const dealt2 = [...a.inbox].reverse().find((m) => m.t === 'diary' && m.phase === 'practice' && m.ok);
    if (!dealt2 || dealt2.t !== 'diary' || dealt2.phase !== 'practice' || !dealt2.ok) throw new Error('no second round');
    const answer = diaryWord(DIARY_WORDS_EN(dealt2.en))!.pt;
    await a.send({ t: 'diary', action: 'answer', choice: answer });
    const win2 = [...a.inbox].reverse().find((m) => m.t === 'diary' && m.phase === 'result');
    expect(win2).toMatchObject({ correct: true, granted: null });
    expect(a.s.profile?.coins).toBe(ECONOMY.startingCoins + 16);
    expect(a.s.profile?.diary).toEqual(['seed.praca.fonte', 'seed.praca.aula']);
  });
});

function DIARY_WORDS_EN(en: string): string {
  const w = diaryWord('seed.praca.fonte');
  if (w?.en === en) return w.id;
  const aula = diaryWord('seed.praca.aula');
  if (aula?.en === en) return aula.id;
  throw new Error(`unexpected prompt ${en}`);
}
