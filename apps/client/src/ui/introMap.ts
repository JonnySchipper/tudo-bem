/**
 * The title screen's view of the real Vila Ipê: its own Phaser canvas (not `#world`, and not under the title blur that
 * crashed some GPUs, #48). Destroyed before the game's pixel view boots.
 */
import Phaser from 'phaser';
import { bufferPixels } from '../render/pixel/coords';
import { sharedCharAssets } from '../render/pixel/charAssets';
import { LabelLayer } from '../render/pixel/labels';
import { WorldScene } from '../render/pixel/WorldScene';

export async function mountIntroMap(parent: HTMLElement): Promise<() => void> {
  const canvas = document.createElement('canvas');
  canvas.className = 'intro-map';
  canvas.setAttribute('aria-hidden', 'true');
  parent.prepend(canvas);
  const base = `${import.meta.env.BASE_URL}pixel/`;
  const assets = await sharedCharAssets();
  const labels = new LabelLayer(canvas);
  labels.root.classList.add('intro-labels');
  const buf = bufferPixels(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
  const scene = new WorldScene(assets.manifest, base, assets, {
    labels,
    guides: () => [],
    insets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    lowfx: false,
    debugArt: false,
    intro: true,
  });
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    canvas,
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    backgroundColor: '#1d1b26',
    banner: false,
    audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    scale: { mode: Phaser.Scale.NONE, width: buf.width, height: buf.height, zoom: 1 / buf.dpr },
    scene: [scene],
  });
  let dpr = buf.dpr;
  const onResize = () => {
    const next = bufferPixels(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
    if (next.dpr !== dpr) {
      dpr = next.dpr;
      game.scale.setZoom(1 / dpr);
    }
    if (game.scale.width !== next.width || game.scale.height !== next.height) game.scale.resize(next.width, next.height);
  };
  window.addEventListener('resize', onResize);
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    window.removeEventListener('resize', onResize);
    labels.destroy();
    game.destroy(true);
    canvas.remove();
  };
}
