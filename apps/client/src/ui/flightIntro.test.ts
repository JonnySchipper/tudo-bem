import { describe, expect, it } from 'vitest';
import { BODY_TYPES, EXTRA_STYLES, FACE_STYLES, FLIGHT_CABIN, FLIGHT_CALL, HAIR_STYLES, PASSENGER_LOOKS, STARTER_OUTFITS, collectSpokenLines, flightSpokenLines, letterGreeting, randomPassengerLook, withName } from '@tudobem/shared';
import { cabinLayout, cabinRows } from './flightArt';
import { CABIN_MIN_W, CANDIDATE_SEATS, FLIGHT_FRESH_MS, cabinCam, candidateAt, flightScale, irisRadius, shouldPlayFlightIntro } from './flightIntroLogic';

describe('the flight-in cutscene', () => {
  it('scales the pixel canvas by whole numbers that fit the art', () => {
    expect(flightScale(1920, 1080, 150, 130)).toBe(7);
    expect(flightScale(390, 844, 150, 130)).toBe(3);
    expect(flightScale(320, 200, 150, 150)).toBe(1);
    expect(flightScale(100, 100, 150, 150)).toBe(1);
  });

  it('opens the iris past the farthest corner and closes it to nothing', () => {
    expect(irisRadius(0, 200, 100, 0.5, 0.5)).toBe(0);
    expect(irisRadius(1, 200, 100, 0, 0)).toBeGreaterThan(Math.hypot(200, 100));
    expect(irisRadius(2, 200, 100, 0.5, 0.5)).toBe(irisRadius(1, 200, 100, 0.5, 0.5));
  });

  it('asks questions the player can answer, and Lia answers every reply', () => {
    const asks = FLIGHT_CABIN.filter((b) => b.kind === 'ask');
    expect(asks).toHaveLength(3);
    for (const b of asks) {
      expect(b.replies.length).toBeGreaterThanOrEqual(2);
      for (const r of b.replies) expect(r.react.pt && r.react.en && r.pt && r.en).toBeTruthy();
    }
    // the captain calls the descent at the end
    expect(FLIGHT_CABIN.at(-1)!.kind).toBe('captain');
  });

  it('voices every Portuguese line, and the spoken list feeds pnpm tts', () => {
    const spoken = collectSpokenLines();
    for (const l of flightSpokenLines()) expect(spoken.some((s) => s.speaker === l.speaker && s.text === l.text)).toBe(true);
    expect(flightSpokenLines().some((l) => l.speaker === 'comandante')).toBe(true);
  });

  it('greets the player by name in Júlia’s letter', () => {
    expect(letterGreeting('Bia')).toBe('Oi, Bia!');
    expect(letterGreeting('  ')).toBe('Oi!');
  });

  describe('picking who you are', () => {
    it('offers one passenger per candidate seat, each a free look (starter outfits only), neighbours unlike each other', () => {
      expect(PASSENGER_LOOKS.length).toBe(CANDIDATE_SEATS.length);
      for (const a of PASSENGER_LOOKS) {
        expect(BODY_TYPES).toContain(a.body);
        expect(HAIR_STYLES).toContain(a.hair);
        expect(FACE_STYLES).toContain(a.face);
        expect(EXTRA_STYLES).toContain(a.extra);
        expect(STARTER_OUTFITS.some((o) => o.set.top === a.top && o.set.bottom === a.bottom)).toBe(true);
        expect(a.garb).toBeUndefined();
      }
      PASSENGER_LOOKS.slice(1).forEach((a, i) => {
        const b = PASSENGER_LOOKS[i]!;
        expect(a.skin !== b.skin && a.hair !== b.hair && a.body !== b.body).toBe(true);
      });
      expect(PASSENGER_LOOKS).toContainEqual(randomPassengerLook(0.99));
    });

    it('seats every candidate in the front row, fully inside the cabin, and never on the sleeper', () => {
      for (const [w, h] of [[CABIN_MIN_W, 150], [366, 155], [500, 300]] as const) {
        const L = cabinLayout(w, h);
        const front = cabinRows(L, w).front;
        for (const d of CANDIDATE_SEATS) {
          const x = L.mySeat + d;
          expect(front).toContain(x);
          expect(x).not.toBe(L.nextSeat);
          expect(x - 13).toBeGreaterThanOrEqual(0);
          expect(x + 13).toBeLessThanOrEqual(w);
        }
      }
    });

    it('finds the passenger under the pointer', () => {
      const L = cabinLayout(CABIN_MIN_W, 150);
      expect(candidateAt(L.mySeat, L.seatY - 10, L.mySeat, L.seatY)).toBe(CANDIDATE_SEATS.indexOf(0));
      expect(candidateAt(L.mySeat + 93 + 5, L.seatY - 20, L.mySeat, L.seatY)).toBe(4);
      expect(candidateAt(L.nextSeat, L.seatY - 10, L.mySeat, L.seatY)).toBe(-1);
      expect(candidateAt(L.mySeat, L.seatY - 30, L.mySeat, L.seatY)).toBe(-1);
    });

    it('frames the whole row on a wide view, and pans to the passenger in focus on a phone', () => {
      const L = cabinLayout(CABIN_MIN_W, 280);
      const o = { vw: CABIN_MIN_W, mySeat: L.mySeat, aisle: L.aisleX, focus: null, picked: null };
      expect(cabinCam({ ...o, w: CABIN_MIN_W })).toBe(0);
      const wide = cabinCam({ ...o, w: 240 });
      expect(L.mySeat + CANDIDATE_SEATS[0] - 13).toBeGreaterThanOrEqual(wide);
      expect(L.mySeat + CANDIDATE_SEATS[6] + 13).toBeLessThanOrEqual(wide + 240);
      // a phone: the focused passenger is on screen, whichever end of the row they sit at
      for (const focus of [0, 3, 6]) {
        const cam = cabinCam({ ...o, w: 130, focus });
        const x = L.mySeat + CANDIDATE_SEATS[focus]!;
        expect(x - 12).toBeGreaterThanOrEqual(cam);
        expect(x + 12).toBeLessThanOrEqual(cam + 130);
      }
      // picked: the player stays in view, and the camera never leaves the cabin
      for (const picked of [0, 6]) {
        const cam = cabinCam({ ...o, w: 130, picked });
        expect(cam).toBeGreaterThanOrEqual(0);
        expect(cam).toBeLessThanOrEqual(CABIN_MIN_W - 130);
        const x = L.mySeat + CANDIDATE_SEATS[picked]!;
        expect(x).toBeGreaterThanOrEqual(cam);
        expect(x).toBeLessThanOrEqual(cam + 130);
      }
    });

    it('calls the player by name on screen, and voices the line without it', () => {
      expect(withName(FLIGHT_CALL.call.pt, 'Bia')).toBe('Com licença! Bia? Bia?');
      expect(withName(FLIGHT_CALL.where.en, ' Leo ')).toBe('Leo… where are you?');
      expect(withName(FLIGHT_CALL.call.pt, '')).toBe('Com licença!');
      const spoken = flightSpokenLines().map((l) => l.text);
      for (const l of [FLIGHT_CALL.call, FLIGHT_CALL.where]) {
        expect(l.spoken).not.toContain('{nome}');
        expect(spoken).toContain(l.spoken);
      }
      expect(spoken).toContain(FLIGHT_CALL.met.pt);
    });
  });

  describe('the welcome trigger', () => {
    const now = 1_000_000_000_000;
    const fresh = { createdAt: now - 5_000, desembarqueDone: false };
    const base = { room: 'desembarque', justCreated: false, seen: false, profile: fresh, now };

    it('plays for an account the creator just made', () => {
      expect(shouldPlayFlightIntro({ ...base, justCreated: true })).toBe(true);
    });
    it('still plays for a fresh account when the page lost track of the creator (reload, reconnect, redirect)', () => {
      expect(shouldPlayFlightIntro(base)).toBe(true);
    });
    it('never replays once seen', () => {
      expect(shouldPlayFlightIntro({ ...base, justCreated: true, seen: true })).toBe(false);
    });
    it('does not play for existing accounts', () => {
      expect(shouldPlayFlightIntro({ ...base, profile: { createdAt: now - FLIGHT_FRESH_MS - 1, desembarqueDone: false } })).toBe(false);
      expect(shouldPlayFlightIntro({ ...base, profile: { createdAt: now - 5_000, desembarqueDone: true } })).toBe(false);
      expect(shouldPlayFlightIntro({ ...base, profile: { desembarqueDone: false } })).toBe(false);
    });
    it('only lands in the arrivals hall', () => {
      expect(shouldPlayFlightIntro({ ...base, room: 'aeroporto', justCreated: true })).toBe(false);
    });
  });
});
