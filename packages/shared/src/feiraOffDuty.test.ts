import { describe, expect, it } from 'vitest';
import { FEIRA_CLOSE_MIN, FEIRA_OPEN_MIN, OFF_DUTY, STALL_VENDOR_IDS, VENDOR_OF_NPC, isStallVendor, offDutyLine, vendorTalkMode } from './feira.js';
import { SCHEDULES, scheduleAt } from './schedules.js';
import { numberPt } from './numbers.js';
import { collectSpokenLines } from './spokenLines.js';
import type { NpcId } from './rooms.js';

const at = (h: number, m = 0) => h * 60 + m;
const modeAt = (npc: NpcId, minute: number) => vendorTalkMode(scheduleAt(npc, minute) ?? {}, minute);

describe('feira vendors off duty (#170)', () => {
  it('covers every vendor with a stall and a schedule', () => {
    const scheduled = (Object.keys(SCHEDULES) as NpcId[]).filter((npc) => VENDOR_OF_NPC[npc]);
    expect(scheduled.length).toBeGreaterThan(0);
    for (const npc of scheduled) expect(isStallVendor(npc), npc).toBe(true);
    expect([...STALL_VENDOR_IDS].sort()).toEqual(Object.keys(VENDOR_OF_NPC).sort());
  });

  it('talks shop at the open stall at 08:00', () => {
    for (const npc of STALL_VENDOR_IDS) {
      expect(scheduleAt(npc, at(8))?.room, npc).toBe('feira');
      expect(modeAt(npc, at(8)), npc).toBe('stall');
    }
  });

  it('is off duty at 15:00 wherever a vendor can be met (Tia Lu on her praça bench)', () => {
    expect(scheduleAt('tia_lu', at(15))).toMatchObject({ room: 'praca', activity: 'sentado' });
    for (const npc of STALL_VENDOR_IDS) expect(modeAt(npc, at(15)), npc).toBe('off_duty');
  });

  it('only the open feira, at the stall, working, is on duty', () => {
    const working = { room: 'feira', activity: 'trabalhando' };
    expect(vendorTalkMode(working, FEIRA_OPEN_MIN)).toBe('stall');
    expect(vendorTalkMode(working, FEIRA_CLOSE_MIN - 1)).toBe('stall');
    // the clock already says 13:00 while the vendor is still packing up
    expect(vendorTalkMode(working, FEIRA_CLOSE_MIN)).toBe('off_duty');
    expect(vendorTalkMode(working, FEIRA_OPEN_MIN - 1)).toBe('off_duty');
    expect(vendorTalkMode({ room: 'praca', activity: 'trabalhando' }, at(9))).toBe('off_duty');
    expect(vendorTalkMode({ room: 'feira', activity: 'passeando' }, at(9))).toBe('off_duty');
    expect(vendorTalkMode({ room: 'praca', activity: 'sentado' }, at(9))).toBe('off_duty');
    expect(vendorTalkMode({}, at(9))).toBe('off_duty');
  });

  it('every vendor has a few short bilingual off-duty lines that never sell', () => {
    for (const npc of STALL_VENDOR_IDS) {
      const t = OFF_DUTY[npc];
      expect(t.lines.length, npc).toBeGreaterThanOrEqual(3);
      for (const l of [...t.lines, t.buy]) {
        expect(l.pt.trim(), npc).not.toBe('');
        expect(l.en.trim(), npc).not.toBe('');
      }
      for (const l of t.lines) {
        expect(l.pt.split(/\s+/).length, l.pt).toBeLessThanOrEqual(10);
        expect(l.pt, npc).not.toMatch(/R\$|custa|reais|freguê|freguesa|\bleva\b|minha barraca|aqui na barraca|quer levar/i);
      }
      expect(t.lines.some((l) => /amanhã/i.test(l.pt)), `${npc} mentions tomorrow's feira`).toBe(true);
    }
  });

  it('the buy answer points to tomorrow’s feira hours', () => {
    const open = numberPt(FEIRA_OPEN_MIN / 60);
    const close = numberPt((FEIRA_CLOSE_MIN / 60) % 12, 'f');
    for (const npc of STALL_VENDOR_IDS) {
      const pt = OFF_DUTY[npc].buy.pt.toLowerCase();
      expect(pt, npc).toContain('amanhã');
      expect(pt, npc).toContain(open);
      expect(pt, npc).toContain(close);
    }
  });

  it('cycles through the lines', () => {
    const n = OFF_DUTY.tia_lu.lines.length;
    expect(offDutyLine('tia_lu', 0)).toBe(OFF_DUTY.tia_lu.lines[0]);
    expect(offDutyLine('tia_lu', n)).toBe(OFF_DUTY.tia_lu.lines[0]);
    expect(offDutyLine('tia_lu', n + 1)).toBe(OFF_DUTY.tia_lu.lines[1]);
  });

  it('every off-duty line is a spoken line in the vendor’s own voice', () => {
    const spoken = collectSpokenLines();
    for (const npc of STALL_VENDOR_IDS)
      for (const l of [...OFF_DUTY[npc].lines, OFF_DUTY[npc].buy]) expect(spoken.some((s) => s.speaker === npc && s.text === l.pt), l.pt).toBe(true);
  });
});
