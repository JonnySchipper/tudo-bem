// Quick look at bjj sets: node scripts/bjj-preview.mjs <out.png> <scale> <set,set,...>
// set = pos:<id> | struggle:<id> | trans:<from>><to> | finish | win | bump | face   (one row of frames per set)
import sharp from 'sharp';
import { positionPose } from '../apps/client/assets-src/custom/bjj-poses.mjs';
import { struggle, transition, finishTap, winRaise, fistbump, faceOff } from '../apps/client/assets-src/custom/bjj-anim.mjs';
import { refFrame, REF_SIGNALS } from '../apps/client/assets-src/custom/bjj-ref.mjs';
import { renderPair, toImage, W, H } from '../apps/client/assets-src/custom/bjj-rig.mjs';
import { swapKeys, KEY_RAMPS, buildRamp, rampMap, mergeTables } from '../apps/client/src/render/pixel/palette.ts';

const tableFor = (r) => mergeTables(...Object.entries(r).map(([n, b]) => rampMap(KEY_RAMPS[n], buildRamp(b, KEY_RAMPS[n].length))));
const [out, scaleS, list] = process.argv.slice(2);
const scale = Number(scaleS ?? 6);
const SWAPS = [
  { skin: '#d9a07a', hair: '#3a2418', skin2: '#8a5a3a', hair2: '#1c1c20', belt: '#f2f2f2' },
  { skin: '#f1c9a5', hair: '#c9a04a', skin2: '#c68642', hair2: '#6b2a12', belt: '#3a6fd0' },
  { skin: '#8a5a3a', hair: '#1c1c20', skin2: '#f1c9a5', hair2: '#d0562a', belt: '#f2f2f2' },
];
const sw0 = 0;
const swapIdx = Number(process.env.SWAP ?? 0);
const table = tableFor(SWAPS[swapIdx]);
const framesOf = (spec) => {
  const [kind, arg] = spec.split(':');
  if (kind === 'ref') return REF_SIGNALS.map((sg) => ({ ref: sg }));
  const n = { pos: 1, struggle: 4, trans: 4, finish: 4, win: 3, bump: 4, face: 2 }[kind];
  return Array.from({ length: n }, (_, k) => {
    if (kind === 'pos') return positionPose(arg);
    if (kind === 'struggle') return struggle(arg, k);
    if (kind === 'trans') { const [a, b] = arg.split('>'); return transition(a, b, k); }
    if (kind === 'finish') return finishTap(k);
    if (kind === 'win') return winRaise(k);
    if (kind === 'bump') return fistbump(k);
    return faceOff(k);
  });
};
const rows = (list ?? 'pos:de_pe').split(',').map(framesOf);
const cols = Math.max(...rows.map((r) => r.length));
const bg = [96, 140, 96];
const isRef = list.startsWith('ref');
const cw = (isRef ? 16 : W) * scale, ch = (isRef ? 32 : H) * scale;
const raw = Buffer.alloc(cw * cols * ch * rows.length * 4);
rows.forEach((frames, r) => frames.forEach((pose, c) => {
  const img = pose.ref ? toImage(refFrame(pose.ref), 0) : toImage(renderPair(pose));
  swapKeys(img.data, table);
  const ox = c * cw, oy = r * ch;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const sx = Math.floor(x / scale), sy = Math.floor(y / scale);
    const si = (sy * img.w + sx) * 4;
    const di = ((oy + y) * cw * cols + ox + x) * 4;
    const a = sx < img.w && sy < img.h ? img.data[si + 3] : 0;
    const edge = x === 0 || y === 0;
    raw[di] = a ? img.data[si] : edge ? 60 : bg[0]; raw[di + 1] = a ? img.data[si + 1] : edge ? 90 : bg[1]; raw[di + 2] = a ? img.data[si + 2] : edge ? 60 : bg[2]; raw[di + 3] = 255;
  }
}));
await sharp(raw, { raw: { width: cw * cols, height: ch * rows.length, channels: 4 } }).png().toFile(out);
console.log('ok', out);
