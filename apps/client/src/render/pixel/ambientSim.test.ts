import { describe, expect, it } from 'vitest';
import { ROOMS, buildGrid, key } from '@tudobem/shared';
import { gameMinutes } from '@tudobem/shared';
import { AMBIENT } from './ambientData';
import {
  BUS,
  BUS_DWELL_MS,
  BUS_EASE_MS,
  BUS_PERIOD_MS,
  CLOUD_SPEED,
  DOG_SPEED,
  DogSim,
  SCARE_PX,
  SLOT_MS,
  busArrivals,
  busRemaining,
  busX,
  butterfliesActive,
  cloudBlobs,
  cloudShadowAlpha,
  dogModeAt,
  firefliesActive,
  makeFlock,
  pathWithin,
  pickWaypoint,
  pigeonAlpha,
  roamTiles,
  scares,
  stepFlock,
  trafficChance,
  vehiclesAt,
} from './ambientSim';

const room = AMBIENT.rua;
const bus = room.bus!; // split areas: the rua has the street and the bus stop
const praca = AMBIENT.praca; // the vira-lata lives in the praça
const T0 = 1_800_000_000_000;

describe('traffic', () => {
  it('is deterministic: the same time gives the same vehicles', () => {
    for (let i = 0; i < 20; i++) {
      const t = T0 + i * 7311;
      expect(vehiclesAt(room, t, 600)).toEqual(vehiclesAt(room, t, 600));
    }
  });

  it('keeps to the right: eastbound in the lower lane, westbound in the upper lane of each street', () => {
    let seen = 0;
    for (let i = 0; i < 300; i++) {
      for (const v of vehiclesAt(room, T0 + i * 2500, 600)) {
        const s = room.streets.find((st) => st.id === v.street)!;
        const lane = s.lanes.find((l) => l.y === v.laneY)!;
        expect(lane.dir).toBe(v.dir);
        expect(v.key.endsWith(v.dir === 'e' ? (v.key.includes('car') ? '_r' : '_e') : v.key.includes('car') ? '_l' : '_w')).toBe(true);
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(100);
    // lane order: westbound above eastbound on the two-way street (the only street left is Rua dos Ipês)
    expect(room.streets).toHaveLength(1);
    for (const s of room.streets) {
      expect(s.lanes).toHaveLength(2);
      expect(s.lanes[0].dir).toBe('w');
      expect(s.lanes[1].dir).toBe('e');
      expect(s.lanes[0].y).toBeLessThan(s.lanes[1].y);
    }
  });

  it('moves eastbound vehicles right and westbound ones left', () => {
    const at = (t: number) => new Map(vehiclesAt(room, t, 600).map((v) => [v.id, v]));
    let checked = 0;
    for (let i = 0; i < 40; i++) {
      const t = T0 + i * 3000;
      const a = at(t);
      const b = at(t + 500);
      for (const [id, v] of a) {
        const w = b.get(id);
        if (!w || !v.moving || v.bus) continue;
        if (v.dir === 'e') expect(w.x).toBeGreaterThanOrEqual(v.x);
        else expect(w.x).toBeLessThanOrEqual(v.x);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('has no ordinary traffic between 01:00 and 05:00 and some the rest of the day', () => {
    expect(trafficChance(59)).toBeGreaterThan(0);
    for (const m of [60, 120, 180, 240, 299]) expect(trafficChance(m)).toBe(0);
    expect(trafficChance(300)).toBeGreaterThan(0);
    const count = (minute: number) => {
      let n = 0;
      for (let i = 0; i < 100; i++) n += vehiclesAt(room, T0 + i * 3000, minute, { noCars: false }).filter((v) => !v.bus).length;
      return n;
    };
    // a long enough stretch at 03:00: the vehicles alive at t all entered before 01:00 or not at all (gate uses the entry minute)
    expect(count(180 + 60)).toBe(0);
    expect(count(720)).toBeGreaterThan(50);
  });

  it('never lets two vehicles of one lane overlap', () => {
    for (let i = 0; i < 400; i++) {
      const t = T0 + i * 1700;
      const by = new Map<string, { x: number; len: number }[]>();
      for (const v of vehiclesAt(room, t, 700)) {
        const k = `${v.street}:${v.laneY}`;
        by.set(k, [...(by.get(k) ?? []), { x: v.x, len: v.len }]);
      }
      for (const list of by.values()) {
        list.sort((a, b) => a.x - b.x);
        for (let j = 1; j < list.length; j++) expect(list[j].x - list[j - 1].x).toBeGreaterThanOrEqual((list[j].len + list[j - 1].len) / 2 - 0.5);
      }
    }
  });

  it('runs the bus every 6 game hours, stopping 8 seconds at the shelter', () => {
    const a = busArrivals(T0);
    const arrivals: number[] = [];
    for (let k = 0; k < 8; k++) arrivals.push(...busArrivals(T0 + k * BUS_PERIOD_MS / 2).filter((x) => !arrivals.includes(x)));
    arrivals.sort((x, y) => x - y);
    for (let i = 1; i < arrivals.length; i++) expect(arrivals[i] - arrivals[i - 1]).toBe(BUS_PERIOD_MS);
    // it arrives at 05:30, 11:30, 17:30, 23:30 game time
    for (const at of arrivals) expect([330, 690, 1050, 1410]).toContain(gameMinutes(at));
    expect(a.length).toBeGreaterThanOrEqual(0);
    // standing: exactly at the stop for 8 s
    expect(busRemaining(0)).toBe(0);
    expect(busRemaining(BUS_DWELL_MS)).toBe(0);
    expect(busX(bus, BUS_DWELL_MS / 2)).toBe(bus.stopX);
    // approaching from the west, leaving to the east
    expect(busX(bus, -5000)).toBeLessThan(bus.stopX);
    expect(busX(bus, BUS_DWELL_MS + 5000)).toBeGreaterThan(bus.stopX);
    // continuous through the braking and the pull-away
    for (const dt of [-BUS_EASE_MS, 0, BUS_DWELL_MS, BUS_DWELL_MS + BUS_EASE_MS]) {
      expect(Math.abs(busRemaining(dt - 1) - busRemaining(dt + 1))).toBeLessThan(0.2);
    }
  });

  it('shows the bus standing at the stop, in the eastbound lane of Rua dos Ipês, and queues cars behind it', () => {
    const at = 1_000_000 * BUS_PERIOD_MS + 60_000;
    const forced = at;
    const v = vehiclesAt(room, at + 4000, 600, { forcedBusAt: forced }).find((x) => x.bus)!;
    expect(v.x).toBe(bus.stopX);
    expect(v.dir).toBe('e');
    expect(v.moving).toBe(false);
    expect(v.laneY).toBe(room.streets[0].lanes[1].y);
    expect(v.key).toBe(BUS.e);
    // nobody drives through it
    for (let i = 0; i < 200; i++) {
      const list = vehiclesAt(room, at + i * 240, 600, { forcedBusAt: forced }).filter((x) => x.laneY === v.laneY && x.street === 'ipes');
      list.sort((a, b) => a.x - b.x);
      for (let j = 1; j < list.length; j++) expect(list[j].x - list[j - 1].x).toBeGreaterThanOrEqual((list[j].len + list[j - 1].len) / 2 - 0.5);
    }
  });

  it('spawns on the rua street and uses the sprites the manifest has', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) for (const v of vehiclesAt(room, T0 + i * 1900, 700)) seen.add(v.street);
    expect([...seen].sort()).toEqual(['ipes']);
    expect(AMBIENT.praca.streets).toEqual([]); // traffic only on the rua
    expect(AMBIENT.feira.streets).toEqual([]);
    expect(SLOT_MS).toBeGreaterThan(0);
  });
});

const walkableOf = (id: string) => {
  const def = ROOMS[id as keyof typeof ROOMS];
  const g = buildGrid(def, []);
  return { def, walkable: (x: number, y: number) => x >= 0 && y >= 0 && x < g.cols && y < g.rows && !g.blocked.has(key(x, y)) };
};

describe('the vira-lata', () => {
  it('sleeps 12:00-15:00 and 22:00-06:00 and is awake otherwise', () => {
    const asleep = (h: number, m = 0) => dogModeAt(h * 60 + m) === 'sleep';
    for (const h of [0, 1, 3, 5, 12, 13, 14, 22, 23]) expect(asleep(h)).toBe(true);
    expect(asleep(5, 59)).toBe(true);
    expect(asleep(14, 59)).toBe(true);
    for (const h of [6, 7, 9, 11, 15, 16, 18, 21]) expect(asleep(h)).toBe(false);
    expect(asleep(21, 59)).toBe(false);
  });

  it('wanders only on walkable tiles within 6 tiles of its corner, and goes home to nap', () => {
    const { def, walkable } = walkableOf('praca');
    const dogData = praca.dog!;
    const tiles = roamTiles(dogData.home, dogData.radius, walkable);
    expect(tiles.length).toBeGreaterThan(15);
    for (const p of tiles) {
      expect(walkable(p.x, p.y) || (p.x === dogData.home.x && p.y === dogData.home.y)).toBe(true);
      expect(Math.hypot(p.x - dogData.home.x, p.y - dogData.home.y)).toBeLessThanOrEqual(dogData.radius);
    }
    expect(def.props.some((p) => p.id === dogData.propId)).toBe(true);
    const dog = new DogSim(dogData.home, tiles);
    const set = new Set(tiles.map((p) => `${p.x},${p.y}`));
    let walked = false;
    const home = { x: (dogData.home.x + 0.5) * 16, y: (dogData.home.y + 1) * 16 };
    // 07:00-11:59 awake: it must leave its corner and stay in the roam set (the feet's tile)
    for (let s = 0; s < 240; s += 0.25) {
      const st = dog.update(0.25, 480);
      const tile = { x: Math.floor(st.x / 16), y: Math.floor((st.y - 1) / 16) };
      if (st.anim === 'walk') walked = true;
      // between two tiles the dog is on the segment; either end is a roam tile
      expect(set.has(`${tile.x},${tile.y}`) || set.has(`${Math.round(st.x / 16 - 0.5)},${Math.round(st.y / 16 - 1)}`)).toBe(true);
    }
    expect(walked).toBe(true);
    // 22:00: it walks home and sleeps there
    let st = dog.update(0.25, 1320);
    for (let s = 0; s < 400 && st.anim !== 'sleep'; s += 0.25) st = dog.update(0.25, 1320);
    expect(st.anim).toBe('sleep');
    expect(st.x).toBeCloseTo(home.x);
    expect(st.y).toBeCloseTo(home.y);
    // and stays asleep until it is awake hours again
    expect(dog.update(5, 1400).anim).toBe('sleep');
    expect(dog.update(1, 7 * 60).anim).not.toBe('sleep');
  });

  it('walks slowly', () => {
    expect(DOG_SPEED).toBeLessThan(24);
  });

  it('picks waypoints from the tiles it is given, and finds paths inside them', () => {
    const { walkable } = walkableOf('praca');
    const tiles = roamTiles(praca.dog!.home, 6, walkable);
    for (let n = 0; n < 50; n++) {
      const w = pickWaypoint(tiles, n, praca.dog!.home);
      expect(tiles.some((p) => p.x === w.x && p.y === w.y)).toBe(true);
      const path = pathWithin(tiles, praca.dog!.home, w);
      expect(path[0]).toEqual(praca.dog!.home);
      expect(path.at(-1)).toEqual(w);
      for (let i = 1; i < path.length; i++) expect(Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].y - path[i - 1].y)).toBe(1);
    }
    expect(pathWithin(tiles, praca.dog!.home, { x: 100, y: 100 })).toEqual([]);
  });
});

describe('pigeons', () => {
  it('scatter when somebody comes within 2 tiles, not before', () => {
    expect(SCARE_PX).toBe(32);
    const bird = { x: 100, y: 100 };
    expect(scares(bird, [{ x: 100 + 31, y: 100 }])).not.toBeNull();
    expect(scares(bird, [{ x: 100 + 33, y: 100 }])).toBeNull();
    expect(scares(bird, [{ x: 100, y: 100 - 20 }, { x: 300, y: 300 }])).toEqual({ x: 100, y: 80 });
    const flock = makeFlock(100, 100, 4, 3);
    stepFlock(flock, 0.1, [{ x: 100 + 90, y: 100 }]);
    expect(flock.every((p) => p.mode === 'ground')).toBe(true);
    stepFlock(flock, 0.1, [{ x: flock[0].x + 20, y: flock[0].y }]);
    expect(flock.every((p) => p.mode === 'flying')).toBe(true);
  });

  it('fly away from the person and up, fade out, and come back when nobody is near', () => {
    const flock = makeFlock(100, 100, 4, 5);
    const person = { x: flock[0].x - 10, y: flock[0].y };
    stepFlock(flock, 0.05, [person]);
    const startX = flock.map((p) => p.x);
    for (let i = 0; i < 20; i++) stepFlock(flock, 0.1, [person]);
    flock.forEach((p, i) => {
      expect(p.z).toBeGreaterThan(5);
      // they head away from the person on x (the person stands to the west of the flock centre)
      expect(Math.abs(p.x - person.x)).toBeGreaterThan(Math.abs(startX[i] - person.x) - 1);
    });
    for (let i = 0; i < 60; i++) stepFlock(flock, 0.1, [person]);
    expect(flock.every((p) => p.mode === 'away' && pigeonAlpha(p) === 0)).toBe(true);
    // nobody around: they land again after their timers
    for (let i = 0; i < 700; i++) stepFlock(flock, 0.1, []);
    expect(flock.every((p) => p.mode === 'ground')).toBe(true);
    flock.forEach((p) => {
      expect(p.x).toBe(p.homeX);
      expect(p.z).toBe(0);
    });
    // and they do not land under somebody's feet
    const again = makeFlock(100, 100, 3, 6);
    stepFlock(again, 0.05, [{ x: 100, y: 100 }]);
    for (let i = 0; i < 700; i++) stepFlock(again, 0.1, [{ x: 100, y: 100 }]);
    expect(again.every((p) => p.mode === 'away')).toBe(true);
  });
});

describe('small things', () => {
  it('butterflies by day and never in rain; fireflies at night', () => {
    expect(butterfliesActive(12 * 60, 0)).toBe(true);
    expect(butterfliesActive(12 * 60, 0.55)).toBe(false);
    expect(butterfliesActive(3 * 60, 0)).toBe(false);
    expect(butterfliesActive(20 * 60, 0)).toBe(false);
    expect(firefliesActive(21 * 60)).toBe(true);
    expect(firefliesActive(12 * 60)).toBe(false);
    expect(firefliesActive(2 * 60)).toBe(true);
    expect(firefliesActive(7 * 60)).toBe(false);
  });

  it('draws cloud shadows only on sunny days, and lets them go at dusk', () => {
    expect(cloudShadowAlpha(1, 0)).toBeCloseTo(1, 6);
    expect(cloudShadowAlpha(0.28, 0)).toBe(0); // nublado
    expect(cloudShadowAlpha(0.12, 0)).toBe(0); // garoa
    expect(cloudShadowAlpha(0, 0)).toBe(0); // chuva
    expect(cloudShadowAlpha(1, 0.5)).toBe(0);
    const blobs = cloudBlobs(4, 0, 896, 640);
    const later = cloudBlobs(4, 10, 896, 640);
    expect(blobs).toHaveLength(4);
    blobs.forEach((b, i) => expect(later[i].x - b.x).toBeCloseTo(CLOUD_SPEED * 10, 5));
  });
});
