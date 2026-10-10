import { beforeEach, describe, expect, it } from 'vitest';
import {
  CLOCK_OFFSET_MS,
  DEFAULT_APPEARANCE,
  DIARY_WORDS,
  ECONOMY,
  FILM,
  GAME_DAY_MS,
  HOTSPOTS,
  MS_PER_GAME_MINUTE,
  ROOMS,
  buildGrid,
  dailyDiaryIds,
  diaryDayFor,
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
function setGameTime(h: number, day = 3, m = 0) {
  clock = day * GAME_DAY_MS + (h * 60 + m) * MS_PER_GAME_MINUTE - CLOCK_OFFSET_MS;
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

function makeWorld(rng?: () => number) {
  return new World(
    new ProfileStore(null),
    { safety: new JevStubSafety(), gloss: new PhrasebookGloss(), npc: new AuthoredNpcDialogue(), student: new InMemoryStudentModel(), moderation: new MemoryModerationQueue() },
    { mgGapMs: 0, now: () => clock, schedule: (fn, ms) => pending.push({ fn, at: clock + ms }), ...(rng ? { rng } : {}) },
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

/** The ids of the praça words a player holds (the arrival card's words are the Chegada area's). */
const inPraca = (c: Client) => (c.s.profile?.diary ?? []).filter((id) => diaryWord(id)?.area === 'praca');
const photoMsgs = (c: Client) => c.all('diary').filter((m): m is Extract<typeof m, { phase: 'photo' }> => m.phase === 'photo');
const wordsMsgs = (c: Client) => c.all('diary').filter((m): m is Extract<typeof m, { phase: 'words' }> => m.phase === 'words');
const wordMsgs = (c: Client) => c.all('diary').filter((m): m is Extract<typeof m, { phase: 'word' }> => m.phase === 'word');
const CARD_WORDS = ['brasil', 'avião', 'câmera', 'diário'];
const ptOf = (ids: readonly string[] | undefined) => (ids ?? []).map((id) => diaryWord(id)!.pt);

describe('arrival, camera, diary and the escola', () => {
  beforeEach(() => setGameTime(10));

  it('gives a new account the intro, the camera, the cartela and the card’s words once, then skips it', async () => {
    const world = makeWorld();
    const a = await client(world);
    expect(a.last('welcome')?.profile.arrivalIntroDone).toBe(false);
    expect(a.last('welcome')?.profile.hasCamera).toBe(false);
    expect(a.s.profile?.diary ?? []).toEqual([]);
    await a.send({ t: 'arrival', action: 'finish' });
    expect(a.s.profile).toMatchObject({ arrivalIntroDone: true, hasCamera: true, film: FILM.starter });
    const notice = a.all('notice').map((n) => n.pt).join(' ');
    expect(notice).toMatch(/câmera/);
    // the cartela is on this build: Célia hands it over at the airport, and the notice no longer says it is missing
    expect(notice).not.toMatch(/ainda não chegou/);
    expect(a.s.profile?.cartela).toMatchObject({ stamps: 0 });
    // Júlia's note comes with them, once, and its four lines go into the diary (the AEROPORTO letters are read off the airport's glass)
    expect(ptOf(a.s.profile?.diary).sort()).toEqual([...CARD_WORDS].sort());
    // ...as one message, shown one after another and counting up in the Chegada area
    expect(wordMsgs(a)).toHaveLength(0);
    const card = wordsMsgs(a);
    expect(card).toHaveLength(1);
    expect(card[0]!.words.map((w) => [w.pt, w.source])).toEqual([
      ['brasil', 'conversation'],
      ['avião', 'conversation'],
      ['câmera', 'conversation'],
      ['diário', 'conversation'],
    ]);
    expect(card[0]!.words.map((w) => w.progress)).toEqual([
      // the fifth conversation word, bem-vindo, is the comissária's in the arrivals hall
      '0/20 câmera · 0/6 leitura · 1/5 conversa',
      '0/20 câmera · 0/6 leitura · 2/5 conversa',
      '0/20 câmera · 0/6 leitura · 3/5 conversa',
      '0/20 câmera · 0/6 leitura · 4/5 conversa',
    ]);
    await a.send({ t: 'arrival', action: 'finish' });
    expect(a.all('notice').filter((n) => n.pt.includes('câmera'))).toHaveLength(1);
    expect(wordsMsgs(a)).toHaveLength(1);
  });

  it('gives Júlia’s note words on a visit back to the airport, never twice, and never before the arrival is done', async () => {
    const world = makeWorld();
    const a = await client(world);
    await a.send({ t: 'arrival', action: 'replay' });
    expect(a.s.profile?.diary ?? []).toEqual([]);
    // an account from before the intro: home already, no card words
    a.s.profile!.arrivalIntroDone = true;
    a.s.profile!.hasCamera = true;
    await a.send({ t: 'arrival', action: 'replay' });
    expect(ptOf(a.s.profile?.diary).sort()).toEqual([...CARD_WORDS].sort());
    await a.send({ t: 'arrival', action: 'replay' });
    expect(wordsMsgs(a)).toHaveLength(1);
    expect(a.s.profile?.film ?? 0).toBe(0);
  });

  it('gives the camera to someone who already lived here, once, and not to a brand-new arrival', async () => {
    const world = makeWorld();
    const fresh = await client(world);
    await fresh.send({ t: 'grant', id: 'camera' });
    expect(fresh.s.profile).toMatchObject({ arrivalIntroDone: false, hasCamera: false, film: 0 });
    expect(fresh.all('notice').some((n) => n.pt.includes('câmera'))).toBe(false);

    const world2 = makeWorld();
    const home = await client(world2);
    home.s.profile!.arrivalIntroDone = true;
    home.s.profile!.hasCamera = false;
    home.s.profile!.film = 0;
    await home.send({ t: 'grant', id: 'camera' });
    expect(home.s.profile).toMatchObject({ hasCamera: true, film: FILM.starter });
    expect(home.all('notice').map((n) => n.pt).join(' ')).toMatch(/câmera/);
    expect(home.last('profile')?.profile.hasCamera).toBe(true);
    await home.send({ t: 'grant', id: 'camera' });
    expect(home.s.profile?.film).toBe(FILM.starter);
    await home.send({ t: 'grant', id: 'not-a-feature' });
    expect(home.s.profile?.film).toBe(FILM.starter);
    expect(home.all('error')).toHaveLength(0);
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
      // the denominators come from the catalog: the praça has 98 camera words, 15 to read (wifi moved to padaria), 9 to hear
      expect(shot.progress).toBe('1/98 câmera · 0/15 leitura · 0/9 conversa');
      expect(shot.progress).not.toMatch(/\/100\b/);
      expect(shot.areaPt).toBe('Praça');
    }
    expect(inPraca(a)).toEqual(['seed.praca.fonte']);

    await a.send({ t: 'diary', action: 'photo', anchor: 'fonte' });
    const again = [...a.inbox].reverse().find((m) => m.t === 'diary' && m.phase === 'photo');
    expect(again).toMatchObject({ ok: false, pt: 'fonte' });
    expect(inPraca(a)).toEqual(['seed.praca.fonte']);

    await a.send({ t: 'diary', action: 'photo', anchor: 'coreto_placa' });
    expect(inPraca(a)).toEqual(['seed.praca.fonte']);

    const sign = hotspotById('coreto_placa')!;
    expect(HOTSPOTS.some((h) => h.id === 'coreto_placa')).toBe(true);
    const nearSign = spotNear('praca', sign);
    await walkTo(a, nearSign.x, nearSign.y);
    await a.send({ t: 'read', hotspotId: 'fonte_praca' });
    expect(inPraca(a)).toEqual(['seed.praca.fonte', 'diary.praca.praca']);
    const wordsBefore = wordMsgs(a).length;
    await a.send({ t: 'read', hotspotId: 'coreto_placa' });
    expect(inPraca(a)).toEqual(['seed.praca.fonte', 'diary.praca.praca', 'seed.praca.coreto']);
    // a word read off a sign gets the same new-word moment as a photo (once)
    expect(wordMsgs(a).length).toBe(wordsBefore + 1);
    expect(wordMsgs(a).at(-1)).toMatchObject({ pt: 'coreto', source: 'reading' });
    await a.send({ t: 'read', hotspotId: 'coreto_placa' });
    expect(wordMsgs(a).length).toBe(wordsBefore + 1);

    await a.send({ t: 'diary', action: 'line', anchor: 'julia.ajuda' });
    expect(inPraca(a)).not.toContain('seed.praca.guia');
    const julia = a.last('roomState')?.avatars.find((v) => v.npc === 'julia');
    expect(julia?.npcInteract).toBeTruthy();
    await walkTo(a, julia!.npcInteract!.x, julia!.npcInteract!.y);
    await a.send({ t: 'diary', action: 'line', anchor: 'julia.ajuda' });
    expect(inPraca(a)).toEqual(['seed.praca.fonte', 'diary.praca.praca', 'seed.praca.coreto', 'seed.praca.guia']);
    await a.send({ t: 'diary', action: 'line', anchor: 'julia.oi' });
    expect(inPraca(a)).toHaveLength(4);
    expect(a.s.profile?.film).toBe(FILM.starter - 2);

    await a.send({ t: 'diary', action: 'buyFilm' });
    expect(a.s.profile?.coins).toBe(ECONOMY.startingCoins - FILM.price);
    expect(a.s.profile?.film).toBe(FILM.starter - 2 + FILM.pack);
    expect(a.all('notice').some((n) => n.pt.includes('Júlia') && n.pt.includes('filme'))).toBe(true);
  });

  it('gives every new word of one shot, one after another, from a single film, and only what the diary does not have', async () => {
    const world = makeWorld();
    const a = await client(world);
    await a.send({ t: 'arrival', action: 'finish' });
    await walkTo(a, 17, 8);
    const film = a.s.profile!.film!;
    // the fountain, a bench, the bandstand (its roof and its stage) and a bin: five words from one shot
    const anchors = ['fonte', 'banco_1', 'coreto', 'lixeira_p1'];
    await a.send({ t: 'diary', action: 'photo', anchors });
    const shot = photoMsgs(a).at(-1)!;
    expect(shot.ok).toBe(true);
    if (!shot.ok) return;
    // in the order the objects were named, the counter climbing 1, 2, 3, 4, 5 of the praça's 98
    expect(shot.words?.map((w) => w.pt)).toEqual(['fonte', 'banco', 'telhado', 'palco', 'lixeira']);
    expect(shot.words?.map((w) => w.progress.split(' ')[0])).toEqual(['1/98', '2/98', '3/98', '4/98', '5/98']);
    expect(shot.words?.every((w) => w.areaPt === 'Praça')).toBe(true);
    expect(shot).toMatchObject({ pt: 'fonte', progress: shot.words![0]!.progress });
    expect(inPraca(a)).toHaveLength(5);
    expect(a.s.profile?.film).toBe(film - 1);

    // the same shot again teaches nothing new and says so
    await a.send({ t: 'diary', action: 'photo', anchors });
    expect(photoMsgs(a).at(-1)).toMatchObject({ ok: false });
    expect(inPraca(a)).toHaveLength(5);
    expect(a.s.profile?.film).toBe(film - 2);

    // a shot that mixes words the diary has with one it does not gives only the new one
    await a.send({ t: 'diary', action: 'photo', anchors: ['banco_1', 'canteiro_1', 'fonte'] });
    const mixed = photoMsgs(a).at(-1)!;
    expect(mixed.ok && mixed.words?.map((w) => w.pt)).toEqual(['canteiro']);
    expect(mixed.ok && mixed.words?.[0]?.progress.split(' ')[0]).toBe('6/98');

    // an object out of reach is not in the shot, and does not cost a word
    await walkTo(a, 1, 22);
    await a.send({ t: 'diary', action: 'photo', anchors: ['ipe_centro'] });
    expect(a.all('error').some((e) => e.code === 'far')).toBe(true);
    expect(inPraca(a)).toHaveLength(6);
  });

  it('lets a small diary object or sign be photographed or read only on the days it is out', async () => {
    const world = makeWorld();
    const a = await client(world);
    await a.send({ t: 'arrival', action: 'finish' });
    await walkTo(a, 17, 8);
    const day = diaryDayFor('d_pombo', 3);
    const off = [3, 4, 5, 6, 7, 8].find((d) => !dailyDiaryIds('praca', d).has('d_pombo'))!;
    setGameTime(10, off);
    await a.send({ t: 'diary', action: 'photo', anchors: ['d_pombo'] });
    expect(a.all('error').some((e) => e.code === 'far')).toBe(true);
    expect(inPraca(a)).toEqual([]);
    setGameTime(10, day);
    await a.send({ t: 'diary', action: 'photo', anchors: ['d_pombo'] });
    expect(inPraca(a)).toEqual(['diary.praca.pombo']);
  });

  it('makes the airport a room like any other: its things to photograph (free of film), its signs to read, nothing from elsewhere', async () => {
    const world = makeWorld();
    const a = await client(world);
    await a.send({ t: 'arrival', action: 'finish' });
    const film = a.s.profile!.film!;
    // the airport's things are in the airport, not in the praça
    await a.send({ t: 'diary', action: 'photo', anchors: ['hall_mala', 'hall_esteira'] });
    expect(a.all('error').some((e) => e.code === 'far')).toBe(true);
    await a.send({ t: 'join', room: 'aeroporto' });
    expect(a.last('roomState')?.room).toBe('aeroporto');
    await a.send({ t: 'diary', action: 'photo', anchors: ['fonte'] });
    expect(a.all('error').filter((e) => e.code === 'far')).toHaveLength(2);

    // down by the baggage belt: a shot there costs no film and keeps the picture
    await walkTo(a, 5, 20);
    await a.send({ t: 'diary', action: 'photo', anchors: ['hall_mala', 'hall_esteira', 'hall_etiqueta'], image: 'data:image/jpeg;base64,AAAA' });
    const shot = photoMsgs(a).at(-1)!;
    expect(shot.ok && shot.words?.map((w) => w.pt)).toEqual(['mala', 'esteira', 'etiqueta']);
    expect(shot.ok && shot.areaPt).toBe('Chegada');
    expect(a.s.profile?.film).toBe(film);
    expect(a.s.profile?.photos ?? []).toHaveLength(1);

    // the BAGAGEM sign over the belt is read like any sign
    await a.send({ t: 'read', hotspotId: 'hall_s_bagagem' });
    expect(wordMsgs(a).at(-1)).toMatchObject({ pt: 'bagagem', source: 'reading' });
    await a.send({ t: 'read', hotspotId: 'hall_s_bagagem' });
    expect(ptOf(a.s.profile?.diary)).toEqual([...CARD_WORDS, 'mala', 'esteira', 'etiqueta', 'bagagem']);

    // the plane, through the glass, from the gate
    await walkTo(a, 6, 11);
    await a.send({ t: 'diary', action: 'photo', anchors: ['hall_asa', 'hall_turbina', 'hall_ponte'] });
    const plane = photoMsgs(a).at(-1)!;
    // the engine is a turbina and a motor (one photo teaches both)
    expect(plane.ok && plane.words?.map((w) => w.pt)).toEqual(['asa', 'turbina', 'motor', 'ponte']);
    // and any other part of the plane teaches its own word: the tail, the nose, a window, the door, a wheel, the body
    await a.send({ t: 'diary', action: 'photo', anchors: ['hall_cauda', 'hall_nariz', 'hall_janela', 'hall_porta', 'hall_roda', 'hall_fuselagem'] });
    expect(photoMsgs(a).at(-1)!.words?.map((w) => w.pt)).toEqual(['cauda', 'nariz', 'janela', 'porta', 'roda', 'fuselagem']);
    expect(a.s.profile?.film).toBe(film);
  });

  it('photographs wall decor and placed furniture in the kitnet, not furniture that is still in the box', async () => {
    const world = makeWorld();
    const a = await client(world);
    await a.send({ t: 'arrival', action: 'finish' });
    await a.send({ t: 'join', room: 'kitnet' });
    expect(a.last('roomState')?.room).toBe('kitnet');
    await a.send({ t: 'diary', action: 'photo', anchors: ['cadeira_madeira'] });
    expect(a.all('error').some((e) => e.code === 'far')).toBe(true);
    await a.send({ t: 'buy', kind: 'furniture', itemId: 'cadeira_madeira' });
    await a.send({ t: 'furniture', action: 'place', itemId: 'cadeira_madeira', x: 3, y: 4, rot: 0 });
    await a.send({ t: 'diary', action: 'photo', anchors: ['cadeira_madeira', 'janela_rua', 'kitnet_parede', 'cama', 'poltrona_verde'] });
    const shot = photoMsgs(a).at(-1)!;
    expect(shot.ok && shot.words?.map((w) => w.pt)).toEqual(['cadeira', 'janela', 'parede', 'cama']);
    expect(shot.ok && shot.areaPt).toBe('Kitnet');
  });

  it('teaches a line only to somebody next to the speaker: a vendor’s greeting at the stall, the counter line at the counter, an NPC’s own line when talked to', async () => {
    const world = makeWorld();
    const a = await client(world);
    await a.send({ t: 'arrival', action: 'finish' });
    const julia = a.last('roomState')?.avatars.find((v) => v.npc === 'julia')!;
    expect(julia.npcInteract).toBeTruthy();
    // across the square, or even a few tiles off (passing by), nothing is learned from her lines
    await walkTo(a, 1, 22);
    await a.send({ t: 'diary', action: 'line', anchor: 'julia.idle0' });
    await walkTo(a, julia.npcInteract!.x, julia.npcInteract!.y + 6);
    await a.send({ t: 'diary', action: 'line', anchor: 'julia.idle0' });
    await a.send({ t: 'diary', action: 'line', anchor: 'julia.ajuda' });
    expect(ptOf(a.s.profile?.diary)).not.toContain('ajuda');
    expect(ptOf(a.s.profile?.diary)).not.toContain('guia');
    // next to her, as when the player walked up and talked
    await walkTo(a, julia.npcInteract!.x, julia.npcInteract!.y);
    await a.send({ t: 'diary', action: 'line', anchor: 'julia.idle0' });
    expect(wordMsgs(a).at(-1)).toMatchObject({ pt: 'ajuda', source: 'conversation' });
    await a.send({ t: 'diary', action: 'line', anchor: 'julia.idle2' });
    await a.send({ t: 'diary', action: 'line', anchor: 'julia.idle3' });
    expect(ptOf(a.s.profile?.diary).slice(-3)).toEqual(['ajuda', 'vizinho', 'passeio']);
    // a line that is not a line of anyone, and the arrival card's own (taken with the card), teach nothing
    await a.send({ t: 'diary', action: 'line', anchor: 'julia.idle99' });
    await a.send({ t: 'diary', action: 'line', anchor: 'julia.chegada_titulo' });
    expect(ptOf(a.s.profile?.diary)).toHaveLength(7);

    await a.send({ t: 'join', room: 'feira' });
    await a.send({ t: 'diary', action: 'line', anchor: 'tia_lu.greet' });
    expect(ptOf(a.s.profile?.diary)).not.toContain('freguês');
    const tia = a.last('roomState')?.avatars.find((v) => v.npc === 'tia_lu')!;
    expect(tia?.npcInteract).toBeTruthy();
    await walkTo(a, tia.npcInteract!.x, tia.npcInteract!.y);
    await a.send({ t: 'diary', action: 'line', anchor: 'tia_lu.greet' });
    await a.send({ t: 'diary', action: 'line', anchor: 'tia_lu.closed' });
    await a.send({ t: 'diary', action: 'line', anchor: 'tia_lu.idle0' });
    expect(ptOf(a.s.profile?.diary).slice(-3)).toEqual(['freguês', 'amanhã', 'banana']);

    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'diary', action: 'line', anchor: 'carlos.viagem' });
    const carlos = a.last('roomState')?.avatars.find((v) => v.npc === 'carlos')!;
    expect(carlos?.npcInteract).toBeTruthy();
    await walkTo(a, carlos.npcInteract!.x, carlos.npcInteract!.y);
    await a.send({ t: 'diary', action: 'line', anchor: 'carlos.viagem' });
    expect(wordMsgs(a).at(-1)).toMatchObject({ pt: 'viagem', source: 'conversation' });
  });

  it('teaches a Correria word only after a won shift that served its item, sometimes, and never twice', async () => {
    const lucky = makeWorld(() => 0);
    const a = await client(lucky);
    const diary = (lucky as unknown as { diary: { onCorreriaWin: (s: Session, items: string[]) => void } }).diary;
    diary.onCorreriaWin(a.s, ['cafe', 'agua']);
    expect(wordMsgs(a)).toHaveLength(0);
    diary.onCorreriaWin(a.s, ['bolo', 'coxinha', 'cafe']);
    expect(wordMsgs(a).map((m) => [m.pt, m.source])).toEqual([['bolo', 'game'], ['coxinha', 'game']]);
    diary.onCorreriaWin(a.s, ['bolo', 'guarana', 'pao_de_queijo', 'misto_quente']);
    expect(wordMsgs(a).map((m) => m.pt)).toEqual(['bolo', 'coxinha', 'guaraná', 'queijo', 'misto']);
    expect(ptOf(a.s.profile?.diary)).toEqual(['bolo', 'coxinha', 'guaraná', 'queijo', 'misto']);
    diary.onCorreriaWin(a.s, ['bolo', 'guarana']);
    expect(wordMsgs(a)).toHaveLength(5);

    // an unlucky win teaches nothing, and the word is still there for the next one
    const unlucky = makeWorld(() => 0.99);
    const b = await client(unlucky);
    const diaryB = (unlucky as unknown as { diary: { onCorreriaWin: (s: Session, items: string[]) => void } }).diary;
    diaryB.onCorreriaWin(b.s, ['bolo']);
    expect(wordMsgs(b)).toHaveLength(0);
    expect(DIARY_WORDS.filter((w) => w.source === 'game')).toHaveLength(6);
  });

  // the escola (Dona Lúcia's lessons over these words) is tested in escola.test.ts
});
