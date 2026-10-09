import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, ROOMS, elevatorLayout } from '@tudobem/shared';
import { roomBounds } from './render/pixel/roomLayout';
import { fitsAt, roomZoom } from './render/pixel/coords';
import { GI_BELT_BASE, lookForAvatar } from './render/pixel/looks';

const phone = { w: 390 * 2, h: 844 * 2 };
const phoneIns = { top: 124 * 2, bottom: 168 * 2, left: 0, right: 0 };

describe('academy gi on the avatar', () => {
  it('wears the academy color and the personal belt for a member, and not for a guest', () => {
    const member = lookForAvatar({
      appearance: DEFAULT_APPEARANCE,
      hat: null,
      gi: false,
      belt: 'marrom',
      academyGi: { color: 'azul', stamp: 'estrela' },
    });
    const guest = lookForAvatar({ appearance: DEFAULT_APPEARANCE, hat: null, gi: true, belt: 'branca' });
    const street = lookForAvatar({ appearance: DEFAULT_APPEARANCE, hat: null });
    const giOf = (look: typeof member) => look.layers.find((l) => l.key.startsWith('npc_gi'));
    expect(giOf(member)?.ramps?.belt).toBe(GI_BELT_BASE.marrom);
    // the member's stamp is on the jacket, the guest's vestiário gi is plain
    expect(member.layers.some((l) => l.key.startsWith('gi_patch'))).toBe(true);
    expect(guest.layers.some((l) => l.key.startsWith('gi_patch'))).toBe(false);
    expect(member.layers.some((l) => l.key.includes('camisa') || l.key.includes('outfit') || l.ramps?.top)).toBe(true);
    expect(giOf(guest)?.ramps?.belt).toBe(GI_BELT_BASE.branca);
    expect(giOf(street)).toBeUndefined();
    const memberTop = member.layers.find((l) => l.ramps?.top)?.ramps?.top;
    const guestTop = guest.layers.find((l) => l.ramps?.top)?.ramps?.top;
    expect(memberTop).not.toBe(guestTop);
  });

  it('fits the empty floor on a 390px-wide phone and stacks the elevator there', () => {
    const z = roomZoom(phone, roomBounds(ROOMS.andar), phoneIns, 2, 2);
    expect(Number.isInteger(z)).toBe(true);
    expect(fitsAt(phone, roomBounds(ROOMS.andar), phoneIns, z)).toBe(true);
    expect(elevatorLayout(390).stacked).toBe(true);
    const css = fs.readFileSync(path.resolve(import.meta.dirname, 'styles.css'), 'utf8');
    expect(css).toMatch(/@media \(max-width: 420px\)/);
    expect(css).toMatch(/\.academy-dir \.academy-actions button/);
    expect(css).toContain('width: 100%');
  });
});
