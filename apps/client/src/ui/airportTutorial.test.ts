import { describe, expect, it } from 'vitest';
import { DIARY_WORDS, HOTSPOTS, ROOMS, greetingFor } from '@tudobem/shared';
import { AIRPORT_STEPS, airportDone, nextAirportStep, oneWordCard, passportChips, thanksFor } from './airportTutorialLogic';
import { DESEMB_STEPS } from './desembarqueLogic';

const word = (area: string, source: string) => DIARY_WORDS.find((w) => w.area === area && w.source === source)!.id;

describe('the airport tutorial', () => {
  it('walks three steps, each pointing at something that is in the airport; only the photo is optional', () => {
    expect(AIRPORT_STEPS.map((s) => s.id)).toEqual(['celia', 'foto', 'onibus']);
    expect(AIRPORT_STEPS.filter((s) => s.optional).map((s) => s.id)).toEqual(['foto']);
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
    expect(nextAirportStep(airportDone(along, {}))?.id).toBe('onibus');
    // a word from another area is not a Chegada photo
    expect(airportDone({ ...fresh, diary: [word('praca', 'camera')] }, {}).has('foto')).toBe(false);
  });

  it('keeps the bus in the flags, and is done once the bus is taken', () => {
    const all = { arrivalIntroDone: true, diary: [word('chegada', 'camera')] };
    expect(nextAirportStep(airportDone(all, {}))?.id).toBe('onibus');
    expect(nextAirportStep(airportDone(all, { onibus: true }))).toBeNull();
    // an old save's flags for the passport and the snack are simply not steps any more
    const old = { passaporte: true, lanche: true } as Record<string, boolean>;
    expect([...airportDone(all, old)].sort()).toEqual(['celia', 'foto']);
  });

  it('never mentions the cartela: Célia hands over the camera only', () => {
    const text = AIRPORT_STEPS.map((s) => `${s.pt} ${s.en} ${s.how.pt} ${s.how.en}`).join(' ').toLowerCase();
    expect(text).not.toMatch(/cartela|stamp card/);
  });

  it('shows a shot of the plane as one card with every part’s word', () => {
    const card = oneWordCard([
      { pt: 'asa', en: 'wing', areaPt: 'Chegada', progress: '3/12' },
      { pt: 'turbina', en: 'engine', areaPt: 'Chegada', progress: '4/12' },
    ]);
    expect(card).toEqual({ pt: 'asa · turbina', en: 'wing · engine', areaPt: 'Chegada', progress: '4/12' });
    expect(oneWordCard([{ pt: 'cauda', en: 'tail' }])).toEqual({ pt: 'cauda', en: 'tail' });
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
