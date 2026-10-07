import { describe, expect, it } from 'vitest';
import { DIARY_WORDS, HOTSPOTS, ROOMS, TUTORIAL_STEPS, greetingFor, type TutorialStep } from '@tudobem/shared';
import { AIRPORT_STEPS, airportDone, nextAirportStep, passportChips, thanksFor } from './airportTutorialLogic';

const tutorial = (on: TutorialStep[] = []) => Object.fromEntries(TUTORIAL_STEPS.map((s) => [s.id, on.includes(s.id)])) as Record<TutorialStep, boolean>;
const word = (area: string, source: string) => DIARY_WORDS.find((w) => w.area === area && w.source === source)!.id;

describe('the airport tutorial', () => {
  it('walks ten steps, each pointing at something that is in the airport', () => {
    expect(AIRPORT_STEPS.map((s) => s.id)).toEqual(['andar', 'ler', 'celia', 'foto', 'diario', 'passaporte', 'sentar', 'acenar', 'lanche', 'onibus']);
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

  it('reads what the server already knows: walked, the camera from Célia, a Chegada sign and photo, sat, waved', () => {
    const fresh = { tutorial: tutorial(), arrivalIntroDone: false, diary: [] };
    expect([...airportDone(fresh, {})]).toEqual([]);
    expect(nextAirportStep(airportDone(fresh, {}))?.id).toBe('andar');
    const along = { tutorial: tutorial(['andar', 'sentar', 'acenar']), arrivalIntroDone: true, diary: [word('chegada', 'reading'), word('chegada', 'camera')] };
    expect([...airportDone(along, {})].sort()).toEqual(['acenar', 'andar', 'celia', 'foto', 'ler', 'sentar']);
    expect(nextAirportStep(airportDone(along, {}))?.id).toBe('diario');
    // a word from another area is not a Chegada word
    expect(airportDone({ ...fresh, diary: [word('praca', 'camera')] }, {}).has('foto')).toBe(false);
  });

  it('keeps the page-only steps in the flags, and is done once the bus is taken', () => {
    const all = { tutorial: tutorial(['andar', 'sentar', 'acenar']), arrivalIntroDone: true, diary: [word('chegada', 'reading'), word('chegada', 'camera')] };
    expect(nextAirportStep(airportDone(all, { diario: true, passaporte: true, lanche: true }))?.id).toBe('onibus');
    expect(nextAirportStep(airportDone(all, { diario: true, passaporte: true, lanche: true, onibus: true }))).toBeNull();
  });

  it('counts an account from before the airport (no arrival flag on the save) as having its camera', () => {
    expect(airportDone({ tutorial: tutorial(), diary: [] }, {}).has('celia')).toBe(true);
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
