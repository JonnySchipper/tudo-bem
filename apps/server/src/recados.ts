import {
  activeView,
  addBond,
  addToBag,
  advance,
  dayBonusDue,
  dropRecado,
  RECADO_DAY_BONUS_RV,
  BOND_GAIN,
  furnitureById,
  giftFor,
  hearts,
  papoById,
  papoOpen,
  storyOf,
  type BondMilestone,
  describeStep,
  gameDay,
  hotspotById,
  hotspotDistance,
  HOTSPOT_READ_RANGE,
  isNpcId,
  itemById,
  mulberry32,
  npcName,
  offerView,
  RECADO_MAX_ACTIVE,
  sameNpcRole,
  type RoomId,
  RECADOS,
  recadoById,
  rollRecadoDay,
  takeFromBag,
  tileDistance,
  type Bilingual,
  type HotspotDef,
  type NpcId,
  type RecadoDef,
  type RecadoEvent,
  type RecadoState,
  type SceneCtx,
  type Tile,
} from '@tudobem/shared';
import type { ProfileStore, StoredProfile } from './store.js';
import type { Session } from './world.js';
import { readEnv } from './env.js';

export interface RecadoDeps {
  now: () => number;
  store: ProfileStore;
  /** Pays RV through the world's normal reward path (coins, `reward` message, profile push). */
  reward: (s: Session, amount: number, reason: Bilingual) => void;
  pushProfile: (s: Session) => void;
  /** The session's current tile (mid-walk positions are rounded by the world). */
  tileOf: (s: Session) => Tile;
  /** The NPCs standing or walking in a room right now (schedules move them): the tile each has reached and where to stand to talk to it. */
  npcsIn: (room: RoomId) => { id: NpcId; tile: Tile; interact: Tile; activity: string }[];
  /** A hotspot was read (validated: same room, within range). The Caderno counts its cards as seen. */
  onRead?: (s: Session, h: HotspotDef) => void;
}

/** Items a finished Carlos scene ordered ('nada' and unknown ids are dropped). */
export function sceneItems(ctx: Pick<SceneCtx, 'food' | 'drink'>): { itemId: string; qty: number }[] {
  return [ctx.food, ctx.drink].filter((id): id is string => !!itemById(id)).map((itemId) => ({ itemId, qty: 1 }));
}

/** Stable per (player, game day) so the daily offer does not change on reconnect. */
function seedFor(id: string, day: number): number {
  let h = day | 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Recados engine (HOWTO Phase 8). `world.ts` reports what happens through `onEvent`; this class owns the
 * daily board, step progress, the bag, bond gains and rewards. State lives on the profile
 * (`bag`, `recados`, `bond`), so it persists and survives reconnects.
 */
export class RecadoTracker {
  constructor(
    private readonly d: RecadoDeps,
    private readonly defs: readonly RecadoDef[] = RECADOS,
  ) {}

  /** Today's board for this profile; rolls the game day over first (new offer, done cleared, active kept). */
  private board(p: StoredProfile): RecadoState {
    const day = gameDay(this.d.now() + Math.trunc(p.testClockOffsetMs ?? 0));
    const st = rollRecadoDay(p, day, mulberry32(seedFor(p.id, day)), this.defs);
    // test hook (TB_TEST_OFFER=id,id): those recados always sit on today's board, so an e2e can pick its errand
    for (const id of (readEnv('TB_TEST_OFFER') ?? '').split(',').map((x) => x.trim()).filter(Boolean).reverse()) {
      if (recadoById(id, this.defs) && !st.offered.includes(id) && !st.done.includes(id) && !st.active.some((a) => a.id === id)) st.offered.unshift(id);
    }
    p.recados = st;
    return st;
  }

  private err(s: Session, code: string, pt: string, en: string) {
    s.send({ t: 'error', code, pt, en });
  }

  private commit(s: Session) {
    if (s.profile) this.d.store.save(s.profile.id);
    this.d.pushProfile(s);
    this.sendBoard(s);
  }

  sendBoard(s: Session) {
    const p = s.profile;
    if (!p) return;
    const st = this.board(p);
    const busy = new Set([...st.active.map((a) => a.id), ...st.done]);
    s.send({
      t: 'recados',
      day: st.day,
      offered: st.offered.filter((id) => !busy.has(id)).flatMap((id) => recadoById(id, this.defs) ?? []).map(offerView),
      active: st.active.flatMap((a) => {
        const def = recadoById(a.id, this.defs);
        return def ? [activeView(a, def)] : [];
      }),
      done: [...st.done],
      bonus: !!st.bonus,
    });
  }

  /** Something happened in the world. Advances matching recados, pays finished ones. */
  onEvent(s: Session, ev: RecadoEvent) {
    const p = s.profile;
    if (!p) return;
    const st = this.board(p);
    let changed = ev.kind === 'entered';
    if (ev.kind === 'ordered') {
      for (const it of ev.items) p.bag = addToBag(p.bag ?? {}, it.itemId, it.qty);
      changed = ev.items.length > 0;
    }
    if (ev.kind === 'talked' && !st.talked?.includes(ev.npc)) {
      (st.talked ??= []).push(ev.npc);
      this.gain(s, ev.npc, BOND_GAIN.talk);
      changed = true;
    }
    if (ev.kind === 'greeted' && !ev.npc) {
      const near = this.nearbyNpc(s);
      if (near) ev = { ...ev, npc: near };
    }
    for (const a of [...st.active]) {
      const def = recadoById(a.id, this.defs);
      if (!def) {
        st.active.splice(st.active.indexOf(a), 1);
        changed = true;
        continue;
      }
      const res = advance(a, def, ev);
      if (!res.matched) continue;
      changed = true;
      a.step = res.active.step;
      const said = describeStep(def.steps[res.active.step - 1]!);
      s.send({ t: 'notice', level: 'info', pt: `✓ ${said.pt}`, en: said.en, tag: 'recado_step' });
      if (res.done) this.complete(s, st, def);
    }
    if (changed) this.commit(s);
  }

  /** Every step done: RV, bond, optional item, then the giver's thanks. Runs once (the recado leaves `active`). */
  private complete(s: Session, st: RecadoState, def: RecadoDef) {
    const p = s.profile!;
    st.active = st.active.filter((a) => a.id !== def.id);
    if (!st.done.includes(def.id)) st.done.push(def.id);
    p.recadosDoneTotal = (p.recadosDoneTotal ?? 0) + 1;
    this.gain(s, def.giver, def.reward.bond);
    if (def.reward.itemId) p.bag = addToBag(p.bag ?? {}, def.reward.itemId, 1);
    this.d.reward(s, def.reward.rv, { pt: `Favor: ${def.title.pt}`, en: `Favor: ${def.title.en}` });
    const who = npcName(def.giver);
    s.send({ t: 'notice', level: 'reward', pt: `${who}: “${def.thanks.pt}”`, en: `${who}: “${def.thanks.en}”`, tag: 'recado_thanks' });
    // needs_br: true. Three recados in one game day: the neighbourhood's thank-you, once a day
    if (dayBonusDue(st)) {
      st.bonus = true;
      this.d.reward(s, RECADO_DAY_BONUS_RV, { pt: 'Vizinho do dia', en: 'Neighbour of the day' });
      s.send({ t: 'notice', level: 'reward', pt: `★ Vizinho do dia! +${RECADO_DAY_BONUS_RV} RV`, en: `★ Neighbour of the day! +${RECADO_DAY_BONUS_RV} RV`, tag: 'recado_bonus' });
    }
  }

  /** Public door for other features (the academia bout) to pay friendship points; runs the same milestone effects and saves. */
  grantBond(s: Session, npc: NpcId, delta: number) {
    if (!s.profile || !(delta > 0)) return;
    this.gain(s, npc, delta);
    this.commit(s);
  }

  /** Add friendship points and run the milestone effects (name, a new Conversa subject, a furniture gift) for every heart line crossed. */
  private gain(s: Session, npc: NpcId, delta: number) {
    const p = s.profile!;
    const change = addBond(p.bond ?? {}, npc, delta);
    p.bond = change.bond;
    for (const m of change.milestones) this.milestone(s, npc, m);
  }

  // needs_br: true (the milestone notices)
  private milestone(s: Session, npc: NpcId, m: BondMilestone) {
    const p = s.profile!;
    const who = npcName(npc);
    const say = (pt: string, en: string) => s.send({ t: 'notice', level: 'reward', pt: `♥ ${pt}`, en: `♥ ${en}`, tag: 'bond' });
    if (m.kind === 'uses_name') say(`${who} já sabe o seu nome e lembra de você!`, `${who} knows your name now and remembers you!`);
    else if (m.kind === 'story') {
      // only NPCs with a bate-papo have a story to tell; it is the next one they start
      const story = storyOf(npc);
      if (story) say(`${who} quer te contar uma história: “${story.title.pt}”. Vá bater um papo!`, `${who} wants to tell you a story: “${story.title.en}”. Go have a chat!`);
    } else if (m.kind === 'furniture_gift') {
      const given = (p.bondGifts ??= []);
      if (given.includes(npc)) return;
      const item = furnitureById(giftFor(npc));
      if (!item) return;
      given.push(npc);
      p.furniture[item.id] = (p.furniture[item.id] ?? 0) + 1;
      say(`${who} te deu um presente: ${item.pt}! Tá no seu inventário (Decorar).`, `${who} gave you a gift: ${item.en}! It’s in your inventory (Decorate).`);
    }
  }

  /**
   * `papo`: a bate-papo (papos.ts) was talked through to the end. Never graded: it counts as a talk, is remembered as heard (so the next
   * one is new), and pays a little bond once per NPC per game day. The NPC must be in the room and near, and the papo open to the
   * player's hearts. True when it counted.
   */
  papoDone(s: Session, npc: unknown, id: unknown): boolean {
    const p = s.profile;
    const papo = papoById(id);
    if (!p || !s.instance || !papo || npc !== papo.npc) return false;
    const def = this.d.npcsIn(s.instance.def.id).find((n) => n.id === papo.npc);
    if (!def || !papoOpen(papo, hearts(p.bond?.[papo.npc] ?? 0))) return false;
    const tile = this.d.tileOf(s);
    if (tileDistance(tile, def.tile) > HOTSPOT_READ_RANGE && tileDistance(tile, def.interact) > HOTSPOT_READ_RANGE) return false;
    if (!(p.papos ??= []).includes(papo.id)) p.papos.push(papo.id);
    this.onEvent(s, { kind: 'talked', npc: papo.npc });
    const st = this.board(p);
    if (!st.graded?.includes(papo.npc)) {
      (st.graded ??= []).push(papo.npc);
      this.gain(s, papo.npc, BOND_GAIN.papo);
    }
    this.commit(s);
    return true;
  }

  /** `give`: hand what an active recado step asks for to an NPC next to you. Nothing is taken unless a step wants it. */
  give(s: Session, npc: unknown, itemId: unknown) {
    const p = s.profile;
    const inst = s.instance;
    if (!p || !inst) return;
    if (!isNpcId(npc) || !itemById(itemId)) return this.err(s, 'give', 'Não deu pra entregar isso.', 'That can’t be handed over.');
    // NPCs walk their schedules: "here" means where the NPC is right now. Dona Graça stands in for Seu Carlos at the counter (D12).
    const here = this.d.npcsIn(inst.def.id);
    const def = here.find((n) => n.id === npc) ?? here.find((n) => sameNpcRole(npc, n.id));
    if (!def) return this.err(s, 'far', `${npcName(npc)} não está aqui.`, `${npcName(npc)} isn’t here.`);
    // Next to the NPC's current tile, or on the spot where you stand to talk to them (the counter, the stall).
    const tile = this.d.tileOf(s);
    if (tileDistance(tile, def.tile) > 1 && tileDistance(tile, def.interact) > 1)
      return this.err(s, 'far', `Chegue mais perto de ${npcName(npc)}.`, `Walk closer to ${npcName(npc)}.`);
    const id = itemId as string;
    if ((p.bag?.[id] ?? 0) < 1) return this.err(s, 'bag', 'Você não tem isso na mochila.', 'You don’t have that in your bag.');
    const st = this.board(p);
    const want = st.active.flatMap((a) => {
      const step = recadoById(a.id, this.defs)?.steps[a.step];
      return step?.kind === 'entregar' && sameNpcRole(step.npc, npc) && step.itemId === id ? [step.qty] : [];
    })[0];
    if (want === undefined) return s.send({ t: 'notice', level: 'info', pt: 'Não é pra agora. Fica com você!', en: 'Not needed right now. Keep it!' });
    const rest = takeFromBag(p.bag ?? {}, id, want);
    if (!rest) return this.err(s, 'bag', 'Você não tem o bastante na mochila.', 'You don’t have enough in your bag.');
    p.bag = rest;
    this.onEvent(s, { kind: 'gave', npc, itemId: id, qty: want });
  }

  /** `read`: a sign within 3 tiles. Unknown ids and far signs are refused. */
  read(s: Session, hotspotId: unknown) {
    const h = typeof hotspotId === 'string' ? hotspotById(hotspotId) : undefined;
    if (!h) return this.err(s, 'hotspot', 'Não achei essa placa.', 'I can’t find that sign.');
    if (s.instance?.def.id !== h.room || hotspotDistance(h, this.d.tileOf(s)) > HOTSPOT_READ_RANGE)
      return this.err(s, 'far', 'Chegue mais perto pra ler.', 'Walk closer to read it.');
    this.d.onRead?.(s, h);
    this.onEvent(s, { kind: 'read', hotspotId: h.id });
  }

  /** `talk`: the greeting dialogue with an NPC that has no Conversa (Nanda, Júlia) opened; the NPC must be in the room and near. True when it counted. */
  talk(s: Session, npc: unknown): boolean {
    // the NPC as they stand right now (schedules move them)
    const def = isNpcId(npc) && s.instance ? this.d.npcsIn(s.instance.def.id).find((n) => n.id === npc) : undefined;
    if (!def || !s.profile || npc === 'carlos') return false;
    const tile = this.d.tileOf(s);
    if (tileDistance(tile, def.tile) > HOTSPOT_READ_RANGE && tileDistance(tile, def.interact) > HOTSPOT_READ_RANGE) return false;
    this.onEvent(s, { kind: 'talked', npc: def.id });
    return true;
  }

  /**
   * `recados`: 'list' resends the board; 'accept' starts one of today's offers (max 3 at once); 'drop' gives an active one up (it goes back on
   * today's offer, nothing earned is taken back).
   * The game day is 48 real minutes. The board the player is looking at was sent the last time they entered a room,
   * so an accept can arrive after midnight still naming yesterday's errand. That errand was offered to them: take it.
   * Rejecting it left the journal on the old board (the solo e2e hits this whenever the run crosses game midnight).
   */
  request(s: Session, action: 'accept' | 'drop' | 'list', id?: unknown) {
    const p = s.profile;
    if (!p) return;
    const prevDay = p.recados?.day;
    const prevOffered = p.recados?.offered ?? [];
    const st = this.board(p);
    if (action === 'drop') {
      const next = typeof id === 'string' ? dropRecado(st, id) : null;
      if (!next) return this.err(s, 'recado', 'Esse favor não está na sua lista.', 'That favor isn’t on your list.');
      p.recados = next;
      const def = recadoById(id, this.defs);
      if (def) s.send({ t: 'notice', level: 'info', pt: `Favor deixado pra depois: ${def.title.pt}`, en: `Favor put aside: ${def.title.en}` });
      return this.commit(s);
    }
    if (action !== 'accept') return this.sendBoard(s);
    const def = recadoById(id, this.defs);
    const rolled = st.day !== prevDay;
    const onShownBoard = !!def && (st.offered.includes(def.id) || (rolled && prevOffered.includes(def.id)));
    if (!def || !onShownBoard || st.done.includes(def.id) || st.active.some((a) => a.id === def.id)) {
      // midnight just replaced the offer: tell the client, or the journal keeps showing errands that can no longer be taken
      if (rolled) this.sendBoard(s);
      return this.err(s, 'recado', 'Esse favor não está disponível.', 'That favor isn’t available.');
    }
    if (st.active.length >= RECADO_MAX_ACTIVE)
      return this.err(s, 'recado', 'Termine um favor antes de pegar outro.', 'Finish a favor before taking another.');
    st.active.push({ id: def.id, step: 0 });
    // the first thing to do, right away: nobody should have to open the journal to find out
    const first = def.steps[0] ? describeStep(def.steps[0]) : null;
    s.send({
      t: 'notice',
      level: 'info',
      pt: `Favor aceito: ${def.title.pt}${first ? ` → ${first.pt}` : ''}`,
      en: `Favor accepted: ${def.title.en}${first ? ` → ${first.en}` : ''}`,
      tag: 'recado_accept',
    });
    this.commit(s);
  }

  /** The nearest NPC within 3 tiles in the player's room (a greeting said next to someone is said to them). */
  private nearbyNpc(s: Session): NpcId | undefined {
    const tile = this.d.tileOf(s);
    const near = (s.instance ? this.d.npcsIn(s.instance.def.id) : [])
      .map((n) => ({ id: n.id, dist: tileDistance(tile, n.tile) }))
      .filter((n) => n.dist <= 3)
      .sort((a, b) => a.dist - b.dist)[0];
    return near?.id;
  }
}
