/**
 * Language diary on the server. The catalog lives in shared data; this only checks the player is
 * next to the anchor and records the word once, from that word's own source.
 */
import {
  HOTSPOT_READ_RANGE,
  PHOTO_RANGE,
  NPC_TALK,
  ROOMS,
  FILM,
  PHOTO_KEEP,
  areaBoard,
  diaryGame,
  diaryGamesIn,
  grantDiaryWord,
  handCartela,
  hotspotDistance,
  isNpcId,
  normalizeFilm,
  normalizePhotos,
  photoImage,
  practiceCorrect,
  practiceRound,
  progressLine,
  tileDistance,
  wordForLine,
  wordForPhoto,
  wordForSign,
  type Bilingual,
  type ClientMsg,
  type DiaryWord,
  type NpcId,
  type RoomId,
  type Tile,
} from '@tudobem/shared';
import type { ProfileStore } from './store.js';
import type { Session } from './world.js';

export interface DiaryDeps {
  store: ProfileStore;
  reward: (s: Session, amount: number, reason: Bilingual) => void;
  pushProfile: (s: Session) => void;
  err: (s: Session, code: string, pt: string, en: string) => void;
  tileOf: (s: Session) => Tile;
  roomOf: (s: Session) => RoomId | null;
  npcsIn: (room: RoomId) => { id: NpcId; tile: Tile; interact: Tile }[];
  rng: () => number;
  now: () => number;
}

function photoAnchors(msg: { anchor?: string; anchors?: string[] }): string[] {
  const raw = [...(msg.anchors ?? []), ...(msg.anchor ? [msg.anchor] : [])];
  const out: string[] = [];
  for (const id of raw) {
    if (typeof id !== 'string' || id.length > 64 || out.includes(id)) continue;
    out.push(id);
    if (out.length >= 8) break;
  }
  return out;
}

interface Round {
  wordId: string;
  gameId: string;
}

/** One open practice round per session. The client never learns which option is correct. */
export class DiaryTracker {
  private readonly rounds = new WeakMap<Session, Round>();

  constructor(private readonly d: DiaryDeps) {}

  /** The plane intro, once. Júlia gives the camera and the cartela do bairro. */
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
    p.hasCamera = true;
    p.diary = p.diary ?? [];
    if (first) p.film = normalizeFilm(p.film) + FILM.starter;
    this.d.store.save();
    this.d.pushProfile(s);
    if (!first) return;
    // needs_br: true
    const waiting = cartela.given ? '' : ' A cartela de carimbos ainda não chegou.';
    s.send({
      t: 'notice',
      level: 'info',
      pt: `Júlia te entrega a câmera e ${FILM.starter} filmes.${waiting}`,
      en: cartela.given
        ? `Júlia hands you the camera and ${FILM.starter} shots of film.`
        : `Júlia hands you the camera and ${FILM.starter} shots of film. The stamp card isn’t on this build yet.`,
    });
  }

  handle(s: Session, msg: Extract<ClientMsg, { t: 'diary' }>) {
    if (msg.action === 'photo') return this.photo(s, msg);
    if (msg.action === 'line') return this.line(s, msg.anchor);
    if (msg.action === 'practice') return this.practice(s);
    if (msg.action === 'buyFilm') return this.buyFilm(s);
    return this.answer(s, msg.choice);
  }

  /** A sign the player just read (distance already checked). Grants its reading word once. */
  onSign(s: Session, signId: string) {
    const word = wordForSign(signId);
    if (!word) return;
    this.earn(s, word, 'reading');
  }

  private photo(s: Session, msg: Extract<ClientMsg, { t: 'diary'; action: 'photo' }>) {
    const p = s.profile;
    if (!p) return;
    if (!p.hasCamera) return this.d.err(s, 'camera', 'Você ainda não tem a câmera.', 'You don’t have the camera yet.');
    const claimed = photoAnchors(msg);
    const room = this.d.roomOf(s);
    const tile = this.d.tileOf(s);
    const inFrame: string[] = [];
    for (const id of claimed) {
      const prop = room ? ROOMS[room].props.find((q) => q.id === id) : undefined;
      if (prop && hotspotDistance(prop, tile) <= PHOTO_RANGE) inFrame.push(id);
    }
    const image = photoImage(msg.image);
    if (!inFrame.length && !image) {
      if (claimed.length) return this.d.err(s, 'far', 'Chegue mais perto pra fotografar.', 'Walk closer to take the photo.');
      return this.d.err(s, 'photo', 'Não deu pra fotografar isso.', 'That can’t be photographed.');
    }
    const film = normalizeFilm(p.film);
    if (film < 1) return this.d.err(s, 'film', 'Sem filme. A Júlia vende rolo na praça.', 'Out of film. Júlia sells rolls in the square.');
    p.film = film - 1;
    let granted: DiaryWord | null = null;
    let seen: DiaryWord | null = null;
    for (const id of inFrame) {
      const word = wordForPhoto(id);
      if (!word) continue;
      const got = grantDiaryWord(p.diary, word.id, 'camera');
      if (got.ok) {
        p.diary = got.earned;
        granted ??= got.word;
      } else if (got.reason === 'already') seen ??= word;
    }
    if (image) {
      p.photos = [{ id: crypto.randomUUID(), at: this.d.now(), image, ...(granted ? { wordId: granted.id } : {}) }, ...normalizePhotos(p.photos)].slice(0, PHOTO_KEEP);
    }
    this.d.store.save();
    this.d.pushProfile(s);
    const left = normalizeFilm(p.film);
    if (granted) {
      const board = areaBoard(granted.area, p.diary);
      s.send({ t: 'diary', phase: 'photo', ok: true, pt: granted.pt, en: granted.en, source: 'camera', areaPt: board.pt, progress: progressLine(board), film: left });
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
    this.d.store.save();
    this.d.pushProfile(s);
    // needs_br: true
    s.send({
      t: 'notice',
      level: 'reward',
      pt: `Júlia: “Toma, mais ${FILM.pack} filmes.”`,
      en: `Júlia: “Here, ${FILM.pack} more shots.”`,
    });
  }

  private line(s: Session, anchor: unknown) {
    if (typeof anchor !== 'string' || anchor.length > 64) return;
    const word = wordForLine(anchor);
    if (!word) return;
    const dot = anchor.indexOf('.');
    const npc = dot < 0 ? '' : anchor.slice(0, dot);
    const node = dot < 0 ? '' : anchor.slice(dot + 1);
    if (!isNpcId(npc) || !NPC_TALK[npc]?.nodes[node]) return;
    const room = this.d.roomOf(s);
    const here = room ? this.d.npcsIn(room).find((n) => n.id === npc) : undefined;
    if (!here) return;
    const tile = this.d.tileOf(s);
    if (tileDistance(tile, here.tile) > HOTSPOT_READ_RANGE && tileDistance(tile, here.interact) > HOTSPOT_READ_RANGE) return;
    this.earn(s, word, 'conversation');
  }

  private earn(s: Session, word: DiaryWord, via: DiaryWord['source']) {
    const p = s.profile;
    if (!p) return;
    const granted = grantDiaryWord(p.diary, word.id, via);
    if (!granted.ok) return;
    p.diary = granted.earned;
    this.d.store.save();
    this.d.pushProfile(s);
    const board = areaBoard(word.area, p.diary);
    const progress = progressLine(board);
    // needs_br: true
    const how = via === 'reading' ? 'leu' : 'ouviu';
    const howEn = via === 'reading' ? 'read' : 'heard';
    s.send({
      t: 'notice',
      level: 'info',
      pt: `Você ${how} “${word.pt}” e guardou no diário. ${board.pt}: ${progress}`,
      en: `You ${howEn} “${word.pt}” (${word.en}) and kept it in the diary. ${board.en}: ${progress}`,
    });
  }

  private practice(s: Session) {
    const p = s.profile;
    const room = this.d.roomOf(s);
    if (!p || !room) return;
    const game = diaryGamesIn(room)[0];
    if (!game) return this.d.err(s, 'escola', 'Aqui não tem aula.', 'There’s no class here.');
    const tile = this.d.tileOf(s);
    const desk = ROOMS[room].props.find((q) => q.action === 'escola');
    const host = this.d.npcsIn(room).find((n) => n.id === game.host.npc);
    const nearDesk = !!desk && hotspotDistance(desk, tile) <= HOTSPOT_READ_RANGE;
    const nearHost = !!host && (tileDistance(tile, host.tile) <= HOTSPOT_READ_RANGE || tileDistance(tile, host.interact) <= HOTSPOT_READ_RANGE);
    if (!nearDesk && !nearHost) return this.d.err(s, 'far', `Chegue mais perto de ${game.host.name}.`, `Walk closer to ${game.host.name}.`);
    const round = practiceRound(p.diary, game, this.d.rng);
    if (!round) {
      // needs_br: true
      s.send({
        t: 'diary',
        phase: 'practice',
        ok: false,
        host: game.host.name,
        pt: 'Traga uma palavra do diário pra praticar.',
        en: 'Bring a diary word to practice.',
      });
      return;
    }
    this.rounds.set(s, { wordId: round.wordId, gameId: game.id });
    s.send({ t: 'diary', phase: 'practice', ok: true, host: game.host.name, en: round.en, options: round.options });
  }

  private answer(s: Session, choice: unknown) {
    const p = s.profile;
    const round = this.rounds.get(s);
    if (!p || !round) return this.d.err(s, 'escola', 'Não tem aula aberta.', 'There’s no class open.');
    const game = diaryGame(round.gameId);
    if (!game) {
      this.rounds.delete(s);
      return;
    }
    const picked = typeof choice === 'string' ? choice.slice(0, 40) : '';
    if (!practiceCorrect(round.wordId, picked)) {
      // needs_br: true
      s.send({
        t: 'diary',
        phase: 'result',
        correct: false,
        host: game.host.name,
        line: { pt: `${game.host.name} diz: quase. Tenta de novo.`, en: `${game.host.name} says: almost. Try again.` },
        granted: null,
      });
      return;
    }
    this.rounds.delete(s);
    let granted: { pt: string; en: string } | null = null;
    if (game.grantWordId) {
      const got = grantDiaryWord(p.diary, game.grantWordId, 'game');
      if (got.ok) {
        p.diary = got.earned;
        granted = { pt: got.word.pt, en: got.word.en };
        this.d.store.save();
        this.d.pushProfile(s);
      }
    }
    if (game.rv > 0) this.d.reward(s, game.rv, { pt: `${game.host.name} paga a aula.`, en: `${game.host.name} pays for the class.` });
    // needs_br: true
    s.send({
      t: 'diary',
      phase: 'result',
      correct: true,
      host: game.host.name,
      line: {
        pt: granted ? `${game.host.name} te ensina: ${granted.pt}.` : `${game.host.name} diz: muito bem!`,
        en: granted ? `${game.host.name} teaches you: ${granted.pt} (${granted.en}).` : `${game.host.name} says: well done!`,
      },
      granted,
    });
  }
}
