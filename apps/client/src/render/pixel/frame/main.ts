/**
 * Entry of apps/client/lifesim-frame.html: the P1 style frame page. Not linked from the game.
 *
 * URL params (all optional): t=17.5 (game hour), zoom=3 (integer CSS zoom), cx/cy (camera centre in tiles),
 * play=1 (auto-run the slider 17:00 -> 20:00), ui=0 (hide the slider, for clean screenshots).
 */
import Phaser from 'phaser';
import { loadCharAssets } from '../charAssets';
import { loadManifest } from '../manifest';
import { FrameScene } from './FrameScene';
import { formatHour } from '../lighting';
import { createLabels } from './labels';

const q = new URLSearchParams(location.search);
const num = (k: string): number | undefined => {
  const v = q.get(k);
  if (v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const H_MIN = 17;
const H_MAX = 20;

async function boot() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const base = `${import.meta.env.BASE_URL}pixel/`;
  const manifest = await loadManifest(base);
  const assets = await loadCharAssets(base, manifest);
  const hour = Math.min(H_MAX, Math.max(H_MIN, num('t') ?? 17.5));
  const parent = document.getElementById('game');
  if (!parent) throw new Error('#game missing');
  const scene = new FrameScene(manifest, base, assets, { hour, zoom: num('zoom'), cx: num('cx'), cy: num('cy'), dpr });
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent,
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    backgroundColor: '#1d1b26',
    banner: false,
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    scale: { mode: Phaser.Scale.NONE, width: Math.round(window.innerWidth * dpr), height: Math.round(window.innerHeight * dpr), zoom: 1 / dpr },
    scene: [scene],
  });

  // ---- time slider (DOM)
  const slider = document.getElementById('time') as HTMLInputElement;
  const label = document.getElementById('time-label') as HTMLElement;
  const playBtn = document.getElementById('play') as HTMLButtonElement;
  slider.min = String(H_MIN);
  slider.max = String(H_MAX);
  slider.step = '0.01';
  const setHour = (h: number) => {
    scene.setHour(h);
    slider.value = String(h);
    label.textContent = formatHour(h);
  };
  setHour(hour);
  slider.addEventListener('input', () => {
    playing = false;
    playBtn.textContent = '▶';
    setHour(Number(slider.value));
  });
  const labels = q.get('labels') === '0' ? null : createLabels(document.body);
  let playing = q.get('play') === '1';
  let last = performance.now();
  const tick = (now: number) => {
    const dt = (now - last) / 1000;
    last = now;
    if (labels && scene.ready) labels.update(scene);
    if (playing) {
      let h = scene.getHour() + dt * (H_MAX - H_MIN) / 45; // 45 s for the whole range
      if (h > H_MAX) h = H_MIN;
      setHour(h);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  playBtn.textContent = playing ? '❚❚' : '▶';
  playBtn.addEventListener('click', () => {
    playing = !playing;
    playBtn.textContent = playing ? '❚❚' : '▶';
  });
  if (q.get('ui') === '0') document.getElementById('hud')?.classList.add('hidden');

  // debugging / screenshot hooks
  (window as unknown as { __frame: unknown }).__frame = { game, scene, setHour, info: () => scene.info(), artMissing: scene.artMissing };
}

boot().catch((e) => {
  console.error(e);
  const el = document.getElementById('err');
  if (el) el.textContent = String(e);
});
