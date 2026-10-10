/**
 * Language diary on the server. The catalog lives in shared data; this only checks the player is
 * next to the anchor and records the word once, from that word's own source.
 */
import {
  COUNTER_STAND_INS,
  HOTSPOT_READ_RANGE,
  PHOTO_RANGE,
  ROOMS,
  FILM,
  PHOTO_KEEP,
  areaBoard,
  diaryGame,
  diaryLine,
  diaryWord,
  diaryVisible,
  furnitureById,
  grantDiaryWord,
  handCamera,
  handCartela,
  hotspotDistance,
  normalizeDiary,
  normalizeFilm,
  normalizePhotos,
  photoImage,
  photoSpotById,
  progressLine,
  tileDistance,
  wordForLine,
  wordForSign,
  wordsForPhoto,
  type Bilingual,
  type ClientMsg,
  type DiaryWord,
  type NpcId,
  type PlacedFurniture,
  type RoomId,
  type Tile,
} from '@tudobem/shared';
import type { ProfileStore } from './store.js';
import type { Session } from './world.js';

export interface DiaryDeps {
  store: ProfileStore;
  reward: (s: Session, amount: number, reason: Bilingual) => void;
  pushProfile: (s: Session) => void;
  /** The photos changed: send them (they are not in the profile). */
  pushPhotos?: (s: Session) => void;
  err: (s: Session, code: string, pt: string, en: string) => void;
  tileOf: (s: Session) => Tile;
  roomOf: (s: Session) => RoomId | null;
  npcsIn: (room: RoomId) => { id: NpcId; tile: Tile; interact: Tile }[];
  /** The furniture placed in the apartment the player is standing in (the owner's), or nothing outside a kitnet. */
  apartmentOf: (s: Session) => readonly PlacedFurniture[];
  rng: () => number;
  now: () => number;
  /** The game day (the small diary objects and signs rotate by it). */
  day: () => number;
  /** A word just went into the diary (the escola's word mission listens). */
  onWord?: (s: Session, word: DiaryWord) => void;
}

/** Most objects one shot can name (a crowded praça, a dense padaria counter). */
const MAX_ANCHORS = 24;

function photoAnchors(msg: { anchor?: string; anchors?: string[] }): string[] {
  const raw = [...(msg.anchors ?? []), ...(msg.anchor ? [msg.anchor] : [])];
  const out: string[] = [];
  for (const id of raw) {
    if (typeof id !== 'string' || id.length > 64 || out.includes(id)) continue;
    out.push(id);
    if (out.length >= MAX_ANCHORS) break;
  }
  return out;
}

/** Every way a word goes into the diary (the escola lessons are in escola.ts). */
export class DiaryTracker {
  constructor(private readonly d: DiaryDeps) {}

  /** The arrival, once: Célia at the airport's information desk hands over the camera, the cartela do bairro and Júlia's note (its words go into the diary). */
  finishArrival(s: Session) {
    const p = s.profile;
    if (!p) return;
    if (p.arrivalIntroDone && p.hasCamera) {
      this.d.pushProfile(s);
      return;
    }
    const first = p.arrivalIntroDone !== true;
    const cartela = handCartela();
    p.arrivalIntroDone = true;
    p.diary = p.diary ?? [];
    // the same hand-over the catch-up popup uses, so a new arrival and a resident get the same camera and starter roll
    handCamera(p);
    this.d.store.save(p.id);
    this.d.pushProfile(s);
    if (!first) return;
    this.cardWords(s);
    // needs_br: true
    const waiting = cartela.given ? ' e a cartela do bairro' : '';
    s.send({
      t: 'notice',
      level: 'info',
      pt: `Célia te entrega o pacote da Júlia: a câmera, ${FILM.starter} filmes${waiting}.`,
      en: cartela.given
        ? `Célia hands you Júlia’s package: the camera, ${FILM.starter} shots of film and the neighborhood stamp card.`
        : `Célia hands you Júlia’s package: the camera and ${FILM.starter} shots of film.`,
    });
  }

  /** Back at the airport from the diary's Chegada area (accounts from before the airport never had the note): the note's words, if still missing. */
  replayArrival(s: Session) {
    const p = s.profile;
    if (!p || p.arrivalIntroDone !== true) return;
    this.cardWords(s);
  }

  /** The words of Júlia's note (conversation), earned when Célia hands it over. The AEROPORTO letters are read off the airport's glass front. */
  private cardWords(s: Session) {
    const words: { word: DiaryWord; via: DiaryWord['source'] }[] = [];
    for (const id of ['julia.chegada_titulo', 'julia.chegada_aviao', 'julia.chegada_camera', 'julia.chegada_diario']) {
      const word = wordForLine(id);
      if (word) words.push({ word, via: 'conversation' });
    }
    this.earnMany(s, words);
  }

  handle(s: Session, msg: Extract<ClientMsg, { t: 'diary' }>) {
    if (msg.action === 'photo') return this.photo(s, msg);
    if (msg.action === 'line') return this.line(s, msg.anchor);
    if (msg.action === 'buyFilm') return this.buyFilm(s);
  }

  /** A sign the player just read (distance already checked). Grants its reading word once. */
  onSign(s: Session, signId: string) {
    const word = wordForSign(signId);
    const room = this.d.roomOf(s);
    // a sign that is not out today is not there to read
    if (!word || (room && !diaryVisible(room, signId, this.d.day()))) return;
    this.earn(s, word, 'reading');
  }

  /** Is this object inside reach of the player right now? Props and photo spots by distance, furniture by being placed. */
  private reachable(s: Session, id: string, room: RoomId | null, tile: Tile): boolean {
    const prop = room ? ROOMS[room].props.find((q) => q.id === id) : undefined;
    if (prop) return diaryVisible(room!, id, this.d.day()) && hotspotDistance(prop, tile) <= PHOTO_RANGE;
    const spot = photoSpotById(id);
    if (spot) return spot.room === room && hotspotDistance(spot, tile) <= PHOTO_RANGE;
    if (furnitureById(id)) return room === 'kitnet' && this.d.apartmentOf(s).some((f) => f.itemId === id);
    return false;
  }

  private photo(s: Session, msg: Extract<ClientMsg, { t: 'diary'; action: 'photo' }>) {
    const p = s.profile;
    if (!p) return;
    if (!p.hasCamera) return this.d.err(s, 'camera', 'Você ainda não tem a câmera.', 'You don’t have the camera yet.');
    const claimed = photoAnchors(msg);
    const room = this.d.roomOf(s);
    const tile = this.d.tileOf(s);
    const inFrame = claimed.filter((id) => this.reachable(s, id, room, tile));
    // the arrival tutorial's first photos cost no film
    const free = room === 'aeroporto';
    const image = photoImage(msg.image);
    if (!inFrame.length && !image) {
      if (claimed.length) return this.d.err(s, 'far', 'Chegue mais perto pra fotografar.', 'Walk closer to take the photo.');
      return this.d.err(s, 'photo', 'Não deu pra fotografar isso.', 'That can’t be photographed.');
    }
    const film = normalizeFilm(p.film);
    if (!free) {
      if (film < 1) return this.d.err(s, 'film', 'Sem filme. A Júlia vende rolo na praça.', 'Out of film. Júlia sells rolls in the square.');
      p.film = film - 1;
    }
    // every camera word in the frame, in the order the objects were named; a word already in the diary is not given again
    const fresh: DiaryWord[] = [];
    let seen: DiaryWord | null = null;
    for (const id of inFrame) {
      for (const word of wordsForPhoto(id)) {
        const got = grantDiaryWord(p.diary, word.id, 'camera');
        if (got.ok) {
          p.diary = got.earned;
          fresh.push(got.word);
        } else if (got.reason === 'already') seen ??= word;
      }
    }
    if (image) {
      p.photos = [{ id: crypto.randomUUID(), at: this.d.now(), image, ...(fresh[0] ? { wordId: fresh[0].id } : {}) }, ...normalizePhotos(p.photos)].slice(0, PHOTO_KEEP);
    }
    this.d.store.save(p.id);
    this.d.pushProfile(s);
    if (image) this.d.pushPhotos?.(s);
    for (const w of fresh) this.d.onWord?.(s, w);
    const left = normalizeFilm(p.film);
    if (fresh.length) {
      // each word's progress as it stood when that word landed, so the cards count up 1/9, 2/9, 3/9 in the order they are shown
      let running = normalizeDiary(p.diary).filter((id) => !fresh.some((w) => w.id === id));
      const words = fresh.map((w) => {
        running = [...running, w.id];
        const board = areaBoard(w.area, running);
        return { pt: w.pt, en: w.en, areaPt: board.pt, progress: progressLine(board) };
      });
      const first = words[0]!;
      s.send({ t: 'diary', phase: 'photo', ok: true, pt: first.pt, en: first.en, source: 'camera', areaPt: first.areaPt, progress: first.progress, film: left, words });
      return;
    }
    if (seen) {
      s.send({ t: 'diary', phase: 'photo', ok: false, pt: seen.pt, en: seen.en, film: left });
      return;
    }
    s.send({ t: 'diary', phase: 'photo', ok: false, pt: 'Foto guardada.', en: 'Photo saved.', film: left, empty: true });
  }

  /** A pack of film from Júlia, paid in virtual RV. */
  private buyFilm(s: Session) {
    const p = s.profile;
    if (!p) return;
    if (!p.hasCamera) return this.d.err(s, 'camera', 'Você ainda não tem a câmera.', 'You don’t have the camera yet.');
    const room = this.d.roomOf(s);
    const julia = room ? this.d.npcsIn(room).find((n) => n.id === FILM.seller) : undefined;
    const tile = this.d.tileOf(s);
    if (!julia || (tileDistance(tile, julia.tile) > HOTSPOT_READ_RANGE && tileDistance(tile, julia.interact) > HOTSPOT_READ_RANGE))
      return this.d.err(s, 'far', 'Chegue mais perto da Júlia.', 'Walk closer to Júlia.');
    if (p.coins < FILM.price) return this.d.err(s, 'coins', 'Faltam reais virtuais!', 'Not enough RV coins yet.');
    p.coins -= FILM.price;
    p.film = Math.min(99, normalizeFilm(p.film) + FILM.pack);
    this.d.store.save(p.id);
    this.d.pushProfile(s);
    // needs_br: true
    s.send({
      t: 'notice',
      level: 'reward',
      pt: `Júlia: “Toma, mais ${FILM.pack} filmes.”`,
      en: `Júlia: “Here, ${FILM.pack} more shots.”`,
    });
  }

  /** A line the player heard (a talk node, an ambient line, a vendor's greeting, the counter): its conversation word, from near the speaker. */
  private line(s: Session, anchor: unknown) {
    if (typeof anchor !== 'string' || anchor.length > 64) return;
    const word = wordForLine(anchor);
    const info = diaryLine(anchor);
    // a pen line is earned by petting the animal (PetShopSystem.carinho), not by asking for it
    if (!word || !info || info.kind === 'arrival' || info.kind === 'pen') return;
    const room = this.d.roomOf(s);
    if (info.kind === 'closed') {
      // the vendor is away: the note is read at their shut stall
      const stall = room ? ROOMS[room].props.find((q) => q.vendor === info.npc) : undefined;
      if (stall && hotspotDistance(stall, this.d.tileOf(s)) <= HOTSPOT_READ_RANGE) this.earn(s, word, 'conversation');
      return;
    }
    const hosts = [info.npc, ...(COUNTER_STAND_INS[info.npc] ?? [])];
    const here = room ? this.d.npcsIn(room).find((n) => hosts.includes(n.id)) : undefined;
    if (!here) return;
    // every line is heard by talking to its speaker: from the talking distance
    const range = HOTSPOT_READ_RANGE;
    const tile = this.d.tileOf(s);
    if (tileDistance(tile, here.tile) > range && tileDistance(tile, here.interact) > range) return;
    this.earn(s, word, 'conversation');
  }

  /** A line the server itself spoke to this player (a carinho in the pet shop's pens): its conversation word. The caller checked the distance. */
  earnLine(s: Session, anchor: string) {
    const word = wordForLine(anchor);
    if (word) this.earn(s, word, 'conversation');
  }

  private earn(s: Session, word: DiaryWord, via: DiaryWord['source']) {
    const p = s.profile;
    if (!p) return;
    const granted = grantDiaryWord(p.diary, word.id, via);
    if (!granted.ok) return;
    p.diary = granted.earned;
    this.d.store.save(p.id);
    this.d.pushProfile(s);
    this.announce(s, word, via);
    this.d.onWord?.(s, word);
  }

  /** Several words at once: one profile push, and one message that shows them one after another, each counting up in its area. */
  private earnMany(s: Session, list: readonly { word: DiaryWord; via: DiaryWord['source'] }[]) {
    const p = s.profile;
    if (!p) return;
    const got: { word: DiaryWord; via: DiaryWord['source'] }[] = [];
    for (const e of list) {
      const granted = grantDiaryWord(p.diary, e.word.id, e.via);
      if (!granted.ok) continue;
      p.diary = granted.earned;
      got.push(e);
    }
    if (!got.length) return;
    this.d.store.save(p.id);
    this.d.pushProfile(s);
    for (const e of got) this.d.onWord?.(s, e.word);
    if (got.length === 1) return this.announce(s, got[0]!.word, got[0]!.via);
    let running = normalizeDiary(p.diary).filter((id) => !got.some((e) => e.word.id === id));
    const words = got.map((e) => {
      running = [...running, e.word.id];
      const board = areaBoard(e.word.area, running);
      return { pt: e.word.pt, en: e.word.en, areaPt: board.pt, progress: progressLine(board), source: e.via };
    });
    s.send({ t: 'diary', phase: 'words', words });
  }

  /** The new-word moment on the client (the same card a photo gets). */
  private announce(s: Session, word: { pt: string; en: string; area: string }, via: DiaryWord['source']) {
    const board = areaBoard(word.area, s.profile?.diary);
    s.send({ t: 'diary', phase: 'word', pt: word.pt, en: word.en, source: via, areaPt: board.pt, progress: progressLine(board) });
  }

  /** Does a win teach its word this time? Games with no `chance` always do. */
  private rolls(chance: number | undefined): boolean {
    return chance == null || chance >= 1 || this.d.rng() < chance;
  }

  /**
   * A won shift of Correria no Balcão. Seu Carlos teaches the word of an item that shift served, sometimes. The RV is the shift's own
   * payout; showing up with nothing served teaches nothing.
   */
  onCorreriaWin(s: Session, items: readonly string[]) {
    const p = s.profile;
    const game = diaryGame('correria');
    if (!p || !game) return;
    for (const gr of game.grants ?? []) {
      if (!items.includes(gr.item)) continue;
      const word = diaryWord(gr.wordId);
      if (!word || normalizeDiary(p.diary).includes(word.id)) continue;
      if (!this.rolls(game.chance)) continue;
      const got = grantDiaryWord(p.diary, word.id, 'game');
      if (!got.ok) continue;
      p.diary = got.earned;
      this.d.store.save(p.id);
      this.d.pushProfile(s);
      this.announce(s, got.word, 'game');
      this.d.onWord?.(s, got.word);
    }
  }

  /**
   * A finished escola lesson: the practice game's own word (aula), once, when the game's chance allows. The client holds the card until the
   * lesson panel closes (a game word waits for the game to end). Returns the word taught, or null.
   */
  teachLessonWord(s: Session, gameId: string): DiaryWord | null {
    const p = s.profile;
    const game = diaryGame(gameId);
    if (!p || !game?.grantWordId || !this.rolls(game.chance)) return null;
    const got = grantDiaryWord(p.diary, game.grantWordId, 'game');
    if (!got.ok) return null;
    p.diary = got.earned;
    this.d.store.save(p.id);
    this.d.pushProfile(s);
    this.announce(s, got.word, 'game');
    return got.word;
  }
}
