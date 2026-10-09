import { describe, expect, it } from 'vitest';
import { ECONOMY, FURNITURE, ROOMS, STARTER_FURNITURE, canPlaceFurniture, type PlacedFurniture } from '@tudobem/shared';
import {
  KITNET_GUIDE_STEPS,
  NO_PROGRESS,
  boughtBetween,
  cheapestFurniture,
  kitnetGuideDone,
  kitnetGuideStep,
  pointerFor,
  shouldAutoStart,
  suggestPurchase,
  suggestTile,
  type KitnetGuideView,
} from './kitnetGuideLogic';

const closed: KitnetGuideView = { editMode: false, tab: 'meus', placing: false };
const meus: KitnetGuideView = { editMode: true, tab: 'meus', placing: false };
const loja: KitnetGuideView = { ...meus, tab: 'loja' };
const holding: KitnetGuideView = { ...meus, placing: true };

describe('the kitnet first-visit guide', () => {
  it('walks open → Atelier → buy → My items → pick → place → rotate → leave, every line in PT and EN', () => {
    expect(KITNET_GUIDE_STEPS.map((s) => s.id)).toEqual(['abrir', 'loja', 'comprar', 'meus', 'escolher', 'colocar', 'girar', 'sair']);
    for (const s of KITNET_GUIDE_STEPS) for (const t of [s.pt, s.en, s.how.pt, s.how.en]) expect(t.trim().length, s.id).toBeGreaterThan(3);
  });

  it('follows a fresh player through one purchase and placement', () => {
    let p = { ...NO_PROGRESS };
    expect(kitnetGuideStep(closed, p)).toBe('abrir');
    expect(kitnetGuideStep(meus, p)).toBe('loja');
    expect(kitnetGuideStep(loja, p)).toBe('comprar');
    p = { ...p, bought: true };
    expect(kitnetGuideStep(loja, p)).toBe('meus');
    expect(kitnetGuideStep(meus, p)).toBe('escolher');
    expect(kitnetGuideStep(holding, p)).toBe('colocar');
    p = { ...p, placed: true };
    expect(kitnetGuideStep(meus, p)).toBe('girar');
    p = { ...p, rotated: true };
    expect(kitnetGuideStep(meus, p)).toBe('sair');
    expect(kitnetGuideStep(closed, p)).toBeNull();
    expect(kitnetGuideDone(closed, p).size).toBe(KITNET_GUIDE_STEPS.length);
  });

  it('closing Decorar halfway sends you back to "open Decorar" without losing what is done', () => {
    const p = { ...NO_PROGRESS, bought: true };
    expect(kitnetGuideStep(closed, p)).toBe('abrir');
    expect(kitnetGuideDone(closed, p).has('comprar')).toBe(true);
    expect(kitnetGuideStep(closed, { ...p, placed: true })).toBe('abrir');
  });

  it('there is no way to skip buying, and the 10 RV kitnet gift pays for the cheapest piece', () => {
    expect(suggestPurchase(0)).toBeNull();
    expect(suggestPurchase(cheapestFurniture().price)).toBe(cheapestFurniture().id);
    expect(ECONOMY.kitnetGift).toBe(10);
    expect(ECONOMY.kitnetGift).toBeGreaterThanOrEqual(cheapestFurniture().price);
    expect(kitnetGuideStep(loja, NO_PROGRESS)).toBe('comprar');
  });

  it('never suggests an earned piece (the founders banner is not for sale)', () => {
    for (const coins of [0, 10, 50, 1000]) {
      const id = suggestPurchase(coins);
      if (id) expect(FURNITURE.find((d) => d.id === id)?.earned).toBeFalsy();
    }
    expect(cheapestFurniture().earned).toBeFalsy();
    expect(cheapestFurniture().price).toBeGreaterThan(0);
  });

  it('a purchase is more pieces in storage for fewer RV (placing a piece is not)', () => {
    const before = { coins: ECONOMY.startingCoins, furniture: { ...STARTER_FURNITURE } };
    expect(boughtBetween(before, { coins: before.coins - 10, furniture: { cadeira_madeira: 2 } })).toBe(true);
    expect(boughtBetween(before, { coins: before.coins, furniture: { cadeira_madeira: 0 } })).toBe(false);
    expect(boughtBetween(before, { coins: before.coins + 5, furniture: before.furniture })).toBe(false);
  });

  it('suggests a free kitnet tile that is not under the player', () => {
    const room = ROOMS.kitnet;
    const t = suggestTile(room, [], [])!;
    expect(t).toBeTruthy();
    expect(canPlaceFurniture(room, [], t.x, t.y)).toBe(true);
    const busy: PlacedFurniture[] = [{ uid: 'a', itemId: 'cadeira_madeira', x: t.x, y: t.y, rot: 0 }];
    const u = suggestTile(room, busy, [])!;
    expect(u).not.toEqual(t);
    expect(canPlaceFurniture(room, busy, u.x, u.y)).toBe(true);
    expect(suggestTile(room, [], [t])).not.toEqual(t);
  });

  it('shows by itself once: own kitnet, never seen, and the free chair not down yet', () => {
    expect(shouldAutoStart({ ownKitnet: true, seen: false, placedChair: false })).toBe(true);
    expect(shouldAutoStart({ ownKitnet: true, seen: true, placedChair: false })).toBe(false);
    expect(shouldAutoStart({ ownKitnet: true, seen: false, placedChair: true })).toBe(false);
    expect(shouldAutoStart({ ownKitnet: false, seen: false, placedChair: false })).toBe(false);
  });

  it('points the arrow up at a top-bar button, beside a right-hand panel control, and down otherwise', () => {
    const view = { w: 1280, h: 800 };
    expect(pointerFor({ left: 1000, top: 10, right: 1060, bottom: 50 }, view, 40).dir).toBe('up');
    expect(pointerFor({ left: 1000, top: 300, right: 1260, bottom: 340 }, view, 40)).toEqual({ x: 996, y: 320, dir: 'right' });
    expect(pointerFor({ left: 10, top: 600, right: 380, bottom: 640 }, { w: 390, h: 844 }, 40)).toEqual({ x: 195, y: 596, dir: 'down' });
  });
});
