// Coreto (bandstand) for the praça, visual pass V2: 5x3 footprint, the roof is an overhead part.
// Cream plaster and a wood floor, bottle-green iron columns and railings (the brand sp-green), a terracotta tile roof on a cream fascia,
// festa-junina bunting under the eave and a mustard finial. Lit from the upper left, navy sel-out outline, no gradients.
import { blank, rect, hline, vline, dot, outlineAround, C, K } from './kit.mjs';
import { put } from './paint.mjs';

const W = 80, H = 88, OFF = 20; // base canvas; the platform is drawn at +OFF so the columns have room above it
const RW = 90, RH = 50, RCX = 45, RCY = 33, RRX = 43, RRY = 14, RAPEX = 6; // roof canvas and its eave ellipse
const COL_H = 26;
const IRON = { l: '#689183', m: '#46756a', d: '#32675a' };
const lerp = (a, b, t) => a + (b - a) * t;

function lighten(hex) {
  const p = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return '#' + p.map((v) => Math.min(255, Math.round(v + (255 - v) * 0.35)).toString(16).padStart(2, '0')).join('');
}

export async function coreto() {
  const base = blank(W, H);
  // platform: a chamfered rectangle (an octagon in plan)
  const T0 = 3, T1 = 76, Y0 = 20 + OFF, Y1 = 50 + OFF, CH = 9, SK = 7;
  const inTop = (x, y) => x >= T0 && x <= T1 && y >= Y0 && y <= Y1 && x - T0 + (y - Y0) >= CH && T1 - x + (y - Y0) >= CH && x - T0 + (Y1 - y) >= CH && T1 - x + (Y1 - y) >= CH;
  const inSkirt = (x, y) => y > Y0 && inTop(x, y - SK) && !inTop(x, y);
  // skirt: cream plaster lit on the left, shaded on the right, a terracotta band, a shadow line at the bottom
  for (let y = Y0; y <= Y1 + SK; y++) for (let x = T0; x <= T1; x++) {
    if (!inSkirt(x, y)) continue;
    let r = 0;
    while (inSkirt(x, y - r - 1)) r++;
    let c = x < 28 ? C.cr0 : x > 60 ? C.cr2 : x > 50 ? K.wg0 : C.cr1;
    if (r === 0) c = C.cr0;
    if (r === 2 || r === 3) c = K.te1;
    if (r === SK - 1) c = C.cr3;
    put(base, x, y, c);
  }
  // top face: wood planks, staggered joints, a light rim on the north / west edges, a shaded one south / east
  for (let y = Y0; y <= Y1; y++) for (let x = T0; x <= T1; x++) {
    if (!inTop(x, y)) continue;
    let c = C.w1;
    if ((y - Y0) % 3 === 2) c = C.w2;
    else if ((x + Math.floor((y - Y0) / 3) * 7) % 17 === 0) c = C.w2;
    if (!inTop(x - 1, y) || !inTop(x, y - 1)) c = C.w0;
    if (!inTop(x + 1, y) || !inTop(x, y + 1)) c = C.w3;
    put(base, x, y, c);
  }
  // steps at the front centre, wider toward the viewer
  const FY = Y1 + SK;
  for (let s = 0; s < 3; s++) {
    const half = 8 + s * 2;
    const y = FY - 1 + s * 3;
    for (let x = 40 - half; x < 40 + half; x++) {
      put(base, x, y, C.cr0);
      put(base, x, y + 1, C.cr1);
      put(base, x, y + 2, x < 40 - half + 1 ? C.cr2 : C.cr3);
    }
  }
  outlineAround(base);
  // columns and railings, back to front
  const column = (cx, f) => {
    const t = f - COL_H;
    for (let y = t; y <= f; y++) { put(base, cx - 1, y, IRON.l); put(base, cx, y, IRON.m); put(base, cx + 1, y, IRON.d); }
    rect(base, cx - 2, f - 2, 5, 3, C.cr1); hline(base, cx - 2, f - 2, 5, C.cr0); hline(base, cx - 2, f, 5, C.cr3);
    rect(base, cx - 2, t, 5, 2, C.cr1); hline(base, cx - 2, t, 5, C.cr0);
    hline(base, cx - 2, t - 1, 5, C.navy); vline(base, cx - 3, t, 2, C.navy); vline(base, cx + 3, t, 2, C.navy);
    vline(base, cx - 2, t + 2, f - t - 4, C.navy); vline(base, cx + 2, t + 2, f - t - 4, C.navy);
    vline(base, cx - 3, f - 2, 3, C.navy); vline(base, cx + 3, f - 2, 3, C.navy); hline(base, cx - 2, f + 1, 5, C.navy);
  };
  const railing = (x0, f0, x1, f1) => {
    const n = Math.max(Math.abs(x1 - x0), 1);
    for (let i = 3; i < n - 2; i++) {
      const x = Math.round(lerp(x0, x1, i / n));
      const f = Math.round(lerp(f0, f1, i / n));
      put(base, x, f - 9, IRON.l);
      put(base, x, f - 8, IRON.m);
      put(base, x, f - 1, IRON.d);
      if (i % 3 === 0) for (let y = f - 7; y < f - 1; y++) put(base, x, y, y % 2 ? IRON.m : IRON.d);
    }
  };
  const BF = 26 + OFF, SF = 38 + OFF, FF = 49 + OFF;
  column(11, BF); column(40, BF - 2); column(69, BF);
  railing(11, BF, 40, BF - 2); railing(40, BF - 2, 69, BF);
  railing(5, SF, 11, BF); railing(75, SF, 69, BF);
  column(5, SF); column(75, SF);
  railing(5, SF, 14, FF); railing(75, SF, 66, FF);
  railing(14, FF, 32, FF + 1); railing(48, FF + 1, 66, FF);
  column(14, FF); column(66, FF);

  // the roof (overhead): hip roof of terracotta tiles on a cream fascia, bunting under the eave
  const roof = blank(RW, RH);
  const FACE = ['#e9a875', '#d98a57', '#c96a38', '#b35330', '#9a4128'];
  const inEll = (x, y) => ((x - RCX) / RRX) ** 2 + ((y - RCY) / RRY) ** 2 <= 1;
  const SIDE_Y = 28;
  const inCone = (x, y) => y >= RAPEX && y <= SIDE_Y && Math.abs(x - RCX) <= ((y - RAPEX) / (SIDE_Y - RAPEX)) * RRX;
  const inRoof = (x, y) => inCone(x, y) || inEll(x, y);
  const ylow = (x) => RCY + RRY * Math.sqrt(Math.max(0, 1 - ((x - RCX) / RRX) ** 2));
  for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
    if (!inRoof(x + 0.5, y + 0.5)) continue;
    // faces are wedges from the apex: u is the position across the roof at this row (-1 .. 1), so the hip ridges run apex -> eave
    const hw = Math.max(1.5, Math.min(1, (y - RAPEX) / (SIDE_Y - RAPEX)) * RRX);
    const u = Math.max(-1, Math.min(1, (x + 0.5 - RCX) / hw));
    const f = u < -0.6 ? 0 : u < -0.2 ? 1 : u < 0.2 ? 2 : u < 0.6 ? 3 : 4;
    const course = Math.floor((y - RAPEX) / 3);
    let c = FACE[f];
    if ((y - RAPEX) % 3 === 2) c = FACE[Math.min(4, f + 1)];
    else if ((x + (course % 2) * 2) % 4 === 0 && (y - RAPEX) % 3 === 0) c = FACE[Math.min(4, f + 1)];
    for (const b of [-0.6, -0.2, 0.2, 0.6]) if (Math.abs(u - b) * hw < 0.7) c = b < 0 ? '#f6dcae' : '#e2a06a';
    put(roof, x, y, c);
  }
  for (let x = 0; x < RW; x++) {
    const yl = Math.round(ylow(x + 0.5));
    for (let k = 0; k < 3; k++) if (inRoof(x + 0.5, yl - 1 - k + 0.5) && inEll(x + 0.5, yl - 0.5)) put(roof, x, yl - 1 - k, k === 0 ? C.cr2 : k === 1 ? C.cr1 : C.cr0);
  }
  vline(roof, RCX, 3, 4, C.navy2);
  rect(roof, RCX - 1, 0, 3, 3, C.y3);
  dot(roof, RCX - 1, 0, C.y1); dot(roof, RCX, 0, C.y1); dot(roof, RCX + 1, 2, C.y4); dot(roof, RCX, 2, C.y4);
  outlineAround(roof);
  const FLAGS = [C.r3, C.y2, C.b2, C.g2];
  let n = 0;
  for (let x = 8; x < RW - 6; x += 6) {
    const yl = Math.round(ylow(x + 0.5)) + 1;
    const c = FLAGS[n++ % FLAGS.length];
    for (let k = 0; k < 3; k++) for (let j = -2 + k; j <= 2 - k; j++) put(roof, x + j, yl + 1 + k, k === 0 && j < 0 ? lighten(c) : c);
  }
  const floorCentre = Y0 + (Y1 - Y0) / 2;
  const anchorRow = FY + 4; // the footprint's bottom edge in base coordinates (below the steps)
  const roofAy = Math.round(RCY + (anchorRow - (floorCentre - COL_H)));
  return [
    { img: base, anchor: [40, anchorRow], meta: { overhead: 'props/coreto_roof' } },
    { key: 'props/coreto_roof', img: roof, anchor: [RCX, roofAy], meta: { footprint: [5, 3], overhead: true, shadow: null, cast: undefined } },
  ];
}
