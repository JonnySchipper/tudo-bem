import {
  activeView,
  addBond,
  addToBag,
  advance,
  BOND_GAIN,
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
  RECADOS,
  recadoById,
  rollRecadoDay,
  takeFromBag,
  tileDistance,
  type Bilingual,
  type ConversaGrade,
  type ConversaOrder,
  type NpcId,
  type RecadoDef,
  type RecadoEvent,
  type RecadoState,
  type SceneCtx,
  type Tile,
} from '@tudobem/shared';
import type { ProfileStore, StoredProfile } from './store.js';
import type { Session } from './world.js';

export interface RecadoDeps {
  now: () => number;
  store: ProfileStore;
  /** Pays RV through the world's normal reward path (coins, `reward` message, profile push). */
  reward: (s: Session, amount: number, reason: Bilingual) => void;
  pushProfile: (s: Session) => void;
  /** The session's current tile (mid-walk positions are rounded by the world). */
  tileOf: (s: Session) => Tile;
}

/** Items a finished Carlos scene ordered ('nada' and unknown ids are dropped). */
export function sceneItems(ctx: Pick<SceneCtx, 'food' | 'drink'>): { itemId: string; qty: number }[] {
  return [ctx.food, ctx.drink].filter((id): id is string => !!itemById(id)).map((itemId) => ({ itemId, qty: 1 }));
}

/** Items a Conversa order names (same ids as the padaria shelf). */
export function conversaItems(order: ConversaOrder | undefined): { itemId: string; qty: number }[] {
  return order ? sceneItems(order) : [];
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
    const day = gameDay(this.d.now());
    const st = rollRecadoDay(p, day, mulberry32(seedFor(p.id, day)), this.defs);
    p.recados = st;
    return st;
  }

  private err(s: Session, code: string, pt: string, en: string) {
    s.send({ t: 'error', code, pt, en });
  }

  private commit(s: Session) {
    this.d.store.save();
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
      p.bond = addBond(p.bond ?? {}, ev.npc, BOND_GAIN.talk).bond;
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
      s.send({ t: 'notice', level: 'info', pt: `✓ ${said.pt}`, en: said.en });
      if (res.done) this.complete(s, st, def);
    }
    if (changed) this.commit(s);
  }

  /** Every step done: RV, bond, optional item, then the giver's thanks. Runs once (the recado leaves `active`). */
  private complete(s: Session, st: RecadoState, def: RecadoDef) {
    const p = s.profile!;
    st.active = st.active.filter((a) => a.id !== def.id);
    if (!st.done.includes(def.id)) st.done.push(def.id);
    p.bond = addBond(p.bond ?? {}, def.giver, def.reward.bond).bond;
    if (def.reward.itemId) p.bag = addToBag(p.bag ?? {}, def.reward.itemId, 1);
    this.d.reward(s, def.reward.rv, { pt: `Recado: ${def.title.pt}`, en: `Errand: ${def.title.en}` });
    const who = npcName(def.giver);
    s.send({ t: 'notice', level: 'reward', pt: `${who}: “${def.thanks.pt}”`, en: `${who}: “${def.thanks.en}”` });
  }

  /** The Conversa HTTP flow ended: it counts as a talk, may carry an order, and a 'pass' earns bond (once per NPC per game day). */
  onConversaEnd(s: Session, npc: NpcId, grade: ConversaGrade, order?: ConversaOrder) {
    const p = s.profile;
    if (!p) return;
    this.onEvent(s, { kind: 'talked', npc });
    const items = conversaItems(order);
    if (items.length) this.onEvent(s, { kind: 'ordered', npc, items });
    const st = this.board(p);
    if (grade === 'pass' && !st.graded?.includes(npc)) {
      (st.graded ??= []).push(npc);
      p.bond = addBond(p.bond ?? {}, npc, BOND_GAIN.conversaGood).bond;
      this.commit(s);
    }
  }

  /** `give`: hand what an active recado step asks for to an NPC next to you. Nothing is taken unless a step wants it. */
  give(s: Session, npc: unknown, itemId: unknown) {
    const p = s.profile;
    const inst = s.instance;
    if (!p || !inst) return;
    if (!isNpcId(npc) || !itemById(itemId)) return this.err(s, 'give', 'Não deu pra entregar isso.', 'That can’t be handed over.');
    const def = inst.def.npcs.find((n) => n.id === npc);
    if (!def) return this.err(s, 'far', `${npcName(npc)} não está aqui.`, `${npcName(npc)} isn’t here.`);
    // Next to the NPC, or on the spot where you stand to talk to them (the counter, the stall).
    const tile = this.d.tileOf(s);
    if (tileDistance(tile, def) > 1 && tileDistance(tile, def.interact) > 1)
      return this.err(s, 'far', `Chegue mais perto de ${npcName(npc)}.`, `Walk closer to ${npcName(npc)}.`);
    const id = itemId as string;
    if ((p.bag?.[id] ?? 0) < 1) return this.err(s, 'bag', 'Você não tem isso na mochila.', 'You don’t have that in your bag.');
    const st = this.board(p);
    const want = st.active.flatMap((a) => {
      const step = recadoById(a.id, this.defs)?.steps[a.step];
      return step?.kind === 'entregar' && step.npc === npc && step.itemId === id ? [step.qty] : [];
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
    this.onEvent(s, { kind: 'read', hotspotId: h.id });
  }

  /** `recados`: 'list' resends the board; 'accept' starts one of today's offers (max 3 at once). */
  request(s: Session, action: 'accept' | 'list', id?: unknown) {
    const p = s.profile;
    if (!p) return;
    const st = this.board(p);
    if (action !== 'accept') return this.sendBoard(s);
    const def = recadoById(id, this.defs);
    if (!def || !st.offered.includes(def.id) || st.done.includes(def.id) || st.active.some((a) => a.id === def.id))
      return this.err(s, 'recado', 'Esse recado não está disponível.', 'That errand isn’t available.');
    if (st.active.length >= RECADO_MAX_ACTIVE)
      return this.err(s, 'recado', 'Termine um recado antes de pegar outro.', 'Finish an errand before taking another.');
    st.active.push({ id: def.id, step: 0 });
    s.send({ t: 'notice', level: 'info', pt: `Recado aceito: ${def.title.pt}`, en: `Errand accepted: ${def.title.en}` });
    this.commit(s);
  }

  /** The nearest NPC within 3 tiles in the player's room (a greeting said next to someone is said to them). */
  private nearbyNpc(s: Session): NpcId | undefined {
    const tile = this.d.tileOf(s);
    const near = (s.instance?.def.npcs ?? [])
      .map((n) => ({ id: n.id, dist: tileDistance(tile, n) }))
      .filter((n) => n.dist <= 3)
      .sort((a, b) => a.dist - b.dist)[0];
    return near?.id;
  }
}
