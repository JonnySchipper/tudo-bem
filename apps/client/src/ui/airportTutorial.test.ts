import { describe, expect, it } from 'vitest';
import { DIARY_WORDS, HOTSPOTS, ROOMS, greetingFor } from '@tudobem/shared';
import { AIRPORT_STEPS, airportDone, nextAirportStep, passportChips, thanksFor } from './airportTutorialLogic';
import { DESEMB_STEPS } from './desembarqueLogic';

const word = (area: string, source: string) => DIARY_WORDS.find((w) => w.area === area && w.source === source)!.id;

describe('the airport tutorial', () => {
  it('walks five steps, each pointing at something that is in the airport', () => {
    expect(AIRPORT_STEPS.map((s) => s.id)).toEqual(['celia', 'foto', 'passaporte', 'lanche', 'onibus']);
    const room = ROOMS.aeroporto;
    for (const s of AIRPORT_STEPS) {
      const g = s.guide;
      if (!g) {
        expect(s.hud, `${s.id} points at the HUD instead`).toBeTruthy();
        continue;
      }
      const there =
        g.kind === 'npc' ? room.npcs.some((n) => n.id === g.id) : g.kind === 'prop' ? room.props.some((p) => p.id === g.id) : g.kind === 'portal' ? room.portals.some((p) => p.id === g.id) : HOTSPOTS.some((h) => h.id === g.id && h.room === 'aeroporto');
      expect(there, `${s.id} → ${g.kind} ${g.id}`).toBe(true);
    }
  });

  it('does not repeat what the arrivals hall already taught', () => {
    const hall = new Set<string>(DESEMB_STEPS.map((s) => s.id));
    for (const s of AIRPORT_STEPS) expect(hall.has(s.id), s.id).toBe(false);
    // walking, reading, the Diário, sitting and waving were airport steps before the hall
    for (const gone of ['andar', 'ler', 'diario', 'sentar', 'acenar']) expect(AIRPORT_STEPS.some((s) => s.id === gone)).toBe(false);
  });

  it('reads what the server already knows: the camera from Célia, a Chegada photo', () => {
    const fresh = { arrivalIntroDone: false, diary: [] };
    expect([...airportDone(fresh, {})]).toEqual([]);
    expect(nextAirportStep(airportDone(fresh, {}))?.id).toBe('celia');
    const along = { arrivalIntroDone: true, diary: [word('chegada', 'reading'), word('chegada', 'camera')] };
    expect([...airportDone(along, {})].sort()).toEqual(['celia', 'foto']);
    expect(nextAirportStep(airportDone(along, {}))?.id).toBe('passaporte');
    // a word from another area is not a Chegada photo
    expect(airportDone({ ...fresh, diary: [word('praca', 'camera')] }, {}).has('foto')).toBe(false);
  });

  it('keeps the page-only steps in the flags, and is done once the bus is taken', () => {
    const all = { arrivalIntroDone: true, diary: [word('chegada', 'camera')] };
    expect(nextAirportStep(airportDone(all, { passaporte: true, lanche: true }))?.id).toBe('onibus');
    expect(nextAirportStep(airportDone(all, { passaporte: true, lanche: true, onibus: true }))).toBeNull();
  });

  it('counts an account from before the airport (no arrival flag on the save) as having its camera', () => {
    expect(airportDone({ diary: [] }, {}).has('celia')).toBe(true);
  });

  it('thanks the way the player asked to be addressed', () => {
    expect(thanksFor('ele').pt).toBe('Obrigado!');
    expect(thanksFor('ela').pt).toBe('Obrigada!');
    expect(thanksFor('nome').pt).toBe('Valeu!');
  });

  it('greets the agent by the hour: one right answer among the three greetings', () => {
    for (const minute of [8 * 60, 14 * 60, 21 * 60]) {
      const { chips, right } = passportChips(minute);
      expect(chips).toHaveLength(3);
      expect(chips[right]!.pt.toLowerCase()).toContain(greetingFor(minute));
    }
  });
});
