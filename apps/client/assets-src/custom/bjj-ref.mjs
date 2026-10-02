// Professora Bia as the referee: 16 x 32 frames (white gi, black belt, short dark hair), one per hand signal.
import { F } from './bjj-poses.mjs';
import { renderSingle, stampPattern, FX_COL } from './bjj-rig.mjs';
import { KEY_RAMPS } from '../../../client/src/render/pixel/palette.ts';

const SK = KEY_RAMPS.skin;

const base = () => F({
  rh: 5.5,
  head: [8, 16.2], up: [0, -1], face: 'front', side: [1, 0], hairLine: 0.1,
  chest: [8, 22.4], hip: [8, 26.8], hsp: 0.55, spread: 1.0,
  feet: [[10, 30.5], [6, 30.5]], knees: [[9.6, 28.8], [6.4, 28.8]],
  hands: [[3.4, 27.2], [12.6, 27.2]], elbows: [[3.9, 24.8], [12.1, 24.8]],
  z: {},
});

// finger glyphs (hand raised, back of the hand toward the camera): n separated fingers over a fist
const FINGERS = {
  2: ['s.s', 's.s', 'SSs', 'sss', 'sds'],
  3: ['s.s.s', 's.s.s', 'SSSss', 'sssss', 'sddds'],
  4: ['s.s.s.s', 's.s.s.s', 'SSSSsss', 'sssssss', 'sdddddd'.slice(0, 7)],
};
const OPEN = ['.s.s.s.', 's.s.s.s', 'SSSsss.', 'sssssss', '.sssss.'];
const PALM = ['sSSs', 'SSss', 'sssd', '.dd.'];

const sparkle = (x, y) => (cv, put) => {
  for (const [dx, dy, c] of [[0, 0, FX_COL.w], [-2, 1, FX_COL.y], [2, 1, FX_COL.y], [0, -2, FX_COL.y]]) put(cv, x + dx, y + dy, c);
};

export const REF_SIGNALS = ['combate', 'pontos2', 'pontos3', 'pontos4', 'vantagem', 'parar', 'vitoria'];

export function refFrame(signal) {
  const P = base();
  const fx = [];
  const glyphs = [];
  switch (signal) {
    case 'combate': // both forearms up in front of the chest, hands about to meet
      P.hands = [[6.6, 19.6], [9.4, 19.6]]; P.elbows = [[4.2, 24.6], [11.8, 24.6]];
      P.z = { arm0: 'over', arm1: 'over' };
      break;
    case 'pontos2': case 'pontos3': case 'pontos4': {
      const n = Number(signal.slice(6));
      P.hands = [[3.4, 27.2], [12.8, 13.6]]; P.elbows = [[3.9, 24.8], [13.4, 19.4]];
      P.z = { arm1: 'over' };
      const pat = FINGERS[n];
      glyphs.push([13 - Math.floor(pat[0].length / 2) - (n === 4 ? 0 : 0), 13.6 - pat.length + 1, pat]);
      break;
    }
    case 'vantagem': // arm up, open hand waving: motion ticks either side
      P.hands = [[3.4, 27.2], [13, 13]]; P.elbows = [[3.9, 24.8], [13.6, 19]];
      P.z = { arm1: 'over' };
      glyphs.push([10, 8, OPEN]);
      fx.push((cv, put) => { for (const [x, y] of [[8, 9], [8, 11], [15, 9], [15, 11]]) put(cv, x, y, FX_COL.y); });
      break;
    case 'parar': // both palms out, "stop"
      P.hands = [[2.2, 19.5], [13.8, 19.5]]; P.elbows = [[2.6, 24.6], [13.4, 24.6]];
      P.z = { arm0: 'over', arm1: 'over' };
      glyphs.push([0, 15.2, PALM], [12, 15.2, PALM]);
      break;
    case 'vitoria': // arm straight up, pointing at the winner
      P.hands = [[3.4, 27.2], [12.6, 6.4]]; P.elbows = [[3.9, 24.8], [12.8, 15.2]];
      P.z = { arm1: 'over' };
      glyphs.push([11, 2, ['.s.', 'sSs', 'sSs', 'sss']]);
      fx.push(sparkle(5, 6), sparkle(14, 1));
      break;
    default: throw new Error('unknown ref signal ' + signal);
  }
  const cv = renderSingle(P, 'R', 16, 32, fx);
  for (const [x, y, pat] of glyphs) stampPattern(cv, Math.max(0, x), Math.round(y), pat, SK);
  return cv;
}
