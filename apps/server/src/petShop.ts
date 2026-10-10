/**
 * Pet Shop do Seu Dito on the server (#234, docs/PET-STORE-PLAN.md §7): adopt, take out, rename, buy, equip, carinho. Every field is checked
 * by hand and answered with `err` (never thrown). Adoption needs `hasPerkAccess` (a paid month, a comp, dev); everything else in the shop is
 * open to everyone. No RV is ever sold; the lojinha takes earned RV.
 */
import {
  PEN_LINES,
  PETSHOP_LINES,
  activePet,
  adoptPet,
  breedById,
  buyPetItem,
  canBuyPetItem,
  equipPetItem,
  hasPerkAccess,
  isBreedCoat,
  newPetId,
  ownedPet,
  penById,
  penLineKey,
  petItemById,
  renameOwnedPet,
  setActivePet,
  tileDistance,
  writePetMirrors,
  type ClientMsg,
  type RoomId,
  type Tile,
} from '@tudobem/shared';
import type { Session } from './world.js';
import type { ProfileStore } from './store.js';

/** The adopt, buy and carinho reach: Chebyshev distance to the interact tile, like the gi and the snacks. */
export const PETSHOP_REACH = 2;

export interface PetShopDeps {
  store: Pick<ProfileStore, 'save'>;
  err: (s: Session, code: string, pt: string, en: string) => void;
  pushProfile: (s: Session) => void;
  broadcastAvatar: (s: Session) => void;
  tileOf: (s: Session) => Tile;
  roomOf: (s: Session) => RoomId | null;
  now: () => number;
  /** The game day (the pens' litter and the pen lines rotate with it). */
  day: () => number;
  /** Shape check + chat classifier + decision, like the old pet names. Resolves to the name, or null after sending the error. */
  moderateName: (s: Session, raw: string) => Promise<string | null>;
  /** The diary's conversation word of a line Seu Dito spoke to this player. */
  earnLine: (s: Session, anchor: string) => void;
  /** Re-send the resting pets of the kitnet `ownerId` (if anyone is in it). */
  homePetsChanged: (ownerId: string) => void;
}

const GATE = PETSHOP_LINES.gate;
type PetMsg = Extract<ClientMsg, { t: 'pet' }>;

export class PetShopSystem {
  constructor(private readonly d: PetShopDeps) {}

  /** Animals petted this visit: `pen:slot`, reset when the player leaves the shop. */
  private petted = new WeakMap<Session, Set<string>>();

  /** The player left the room: the pens can be petted again next visit. */
  leftRoom(s: Session) {
    this.petted.delete(s);
  }

  async handle(s: Session, msg: PetMsg) {
    if (!s.profile || !msg || typeof msg !== 'object') return;
    switch (msg.action) {
      case 'adopt':
        return this.adopt(s, msg.breed, msg.coat, msg.name);
      case 'active':
        return this.active(s, msg.petId);
      case 'rename':
        return this.rename(s, msg.petId, msg.name);
      case 'buy':
        return this.buy(s, msg.itemId);
      case 'equip':
        return this.equip(s, msg.petId, msg.slot, msg.itemId);
      case 'carinho':
        return this.carinho(s, msg.penId, msg.slot);
    }
  }

  /** In the shop and within reach of one of these props' interact tiles. */
  private near(s: Session, propIds: string[]): boolean {
    if (this.d.roomOf(s) !== 'petshop' || !s.instance) return false;
    const tile = this.d.tileOf(s);
    return s.instance.def.props.some((p) => propIds.includes(p.id) && tileDistance(tile, p.interact ?? p) <= PETSHOP_REACH);
  }

  private saved(s: Session, avatar = true) {
    writePetMirrors(s.profile!);
    this.d.store.save(s.profile!.id);
    this.d.pushProfile(s);
    if (avatar) this.d.broadcastAvatar(s);
  }

  private async adopt(s: Session, breedId: unknown, coatId: unknown, rawName: unknown) {
    const p = s.profile!;
    if (!this.near(s, ['balcao', 'cercadinho', 'gatil'])) return this.d.err(s, 'petshop', 'Chegue mais perto do Seu Dito ou dos bichinhos.', 'Get closer to Seu Dito or the animals.');
    if (!hasPerkAccess(p.subscription, this.d.now())) return this.d.err(s, 'petshop', GATE.pt, GATE.en);
    const breed = breedById(breedId);
    if (!breed || !isBreedCoat(breed, coatId)) return;
    if ((p.pets?.length ?? 0) >= 6) return this.d.err(s, 'petshop', PETSHOP_LINES.adopt_full.pt, PETSHOP_LINES.adopt_full.en);
    let name: string | null = null;
    if (typeof rawName === 'string' && rawName.trim()) {
      name = await this.d.moderateName(s, rawName);
      if (name === null) return; // refused: the pet is not adopted, the dialog stays open
    }
    if (s.profile !== p) return;
    const id = newPetId(this.d.now());
    const r = adoptPet(p, breed.id, coatId as string, this.d.now(), id, name);
    if (r === 'full') return this.d.err(s, 'petshop', PETSHOP_LINES.adopt_full.pt, PETSHOP_LINES.adopt_full.en);
    if (r !== 'ok') return;
    const wasOut = p.activePetId ?? null;
    setActivePet(p, id);
    this.saved(s);
    const pet = ownedPet(p, id)!;
    s.send({ t: 'petshop', phase: 'adopted', pet });
    s.send({ t: 'notice', level: 'reward', pt: `Seu Dito: “${PETSHOP_LINES.adopt_done.pt}”`, en: `Seu Dito: “${PETSHOP_LINES.adopt_done.en}”` });
    if (wasOut) this.d.homePetsChanged(p.id);
  }

  private active(s: Session, petId: unknown) {
    const p = s.profile!;
    if (petId !== null && typeof petId !== 'string') return;
    if (petId !== null) {
      if (!ownedPet(p, petId)) return;
      if (!hasPerkAccess(p.subscription, this.d.now())) return this.d.err(s, 'petshop', 'Seus pets estão em casa, na kitnet. Pra passear com eles, apoie a Vila de novo.', 'Your pets are at home in the kitnet. To walk them again, support the Vila again.');
    }
    if (setActivePet(p, petId) !== 'ok') return;
    this.saved(s);
    this.d.homePetsChanged(p.id);
  }

  private async rename(s: Session, petId: unknown, rawName: unknown) {
    const p = s.profile!;
    if (!ownedPet(p, petId) || typeof rawName !== 'string') return;
    const name = await this.d.moderateName(s, rawName);
    if (name === null || s.profile !== p) return;
    renameOwnedPet(p, petId as string, name);
    this.saved(s);
    this.d.homePetsChanged(p.id);
  }

  private buy(s: Session, itemId: unknown) {
    const p = s.profile!;
    const item = petItemById(itemId);
    if (!item) return;
    if (this.d.roomOf(s) !== 'petshop') return this.d.err(s, 'petshop', 'A lojinha fica no Pet Shop do Seu Dito.', 'The little shop is at Seu Dito’s pet shop.');
    if (!this.near(s, ['balcao'])) return this.d.err(s, 'petshop', 'Chegue mais perto do balcão.', 'Get closer to the counter.');
    const ok = canBuyPetItem(p, item.id);
    if (ok === 'owned') return this.d.err(s, 'owned', 'Você já tem esse.', 'You already have this one.');
    if (ok === 'coins') return this.d.err(s, 'coins', PETSHOP_LINES.buy_short.pt, PETSHOP_LINES.buy_short.en);
    if (buyPetItem(p, item.id) !== 'ok') return;
    this.saved(s, false);
    s.send({ t: 'notice', level: 'reward', pt: `Seu Dito: “${PETSHOP_LINES.buy_done.pt}” (${item.pt})`, en: `Seu Dito: “${PETSHOP_LINES.buy_done.en}” (${item.en})` });
  }

  private equip(s: Session, petId: unknown, slot: unknown, itemId: unknown) {
    const p = s.profile!;
    if (typeof petId !== 'string' || (slot !== 'collar' && slot !== 'toy') || (itemId !== null && typeof itemId !== 'string')) return;
    if (!equipPetItem(p, petId, slot, itemId)) return this.d.err(s, 'petshop', 'Esse item não serve pra esse bichinho.', 'That item doesn’t fit this pet.');
    this.saved(s, activePet(p)?.id === petId);
    if (activePet(p)?.id !== petId) this.d.homePetsChanged(p.id);
  }

  /** Pet an animal in a pen: free for everyone, once per animal per visit; Seu Dito says its line, which teaches a word. */
  private carinho(s: Session, penId: unknown, slot: unknown) {
    const pen = penById(penId);
    if (!pen || typeof slot !== 'number' || !Number.isInteger(slot) || slot < 0 || slot >= pen.shows) return;
    if (!this.near(s, [pen.id])) return this.d.err(s, 'petshop', 'Chegue mais perto do cercadinho.', 'Get closer to the pen.');
    const done = this.petted.get(s) ?? new Set<string>();
    this.petted.set(s, done);
    const k = `${pen.id}:${slot}`;
    if (done.has(k)) return;
    done.add(k);
    const key = penLineKey(pen.species, this.d.day(), slot);
    const line = PEN_LINES[key]!;
    s.send({ t: 'npcSay', npc: 'dito', pt: line.pt, en: line.en, anchor: `dito.${key}` });
    this.d.earnLine(s, `dito.${key}`);
  }
}
