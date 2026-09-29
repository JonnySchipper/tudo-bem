/**
 * DOM overlay for the style frame (HOWTO D8, §5.9): nameplates and a speech bubble are HTML positioned over the canvas, so text is
 * crisp at every zoom and accents render (test string: "Pão de queijo, açaí, você, não, avó, Nº 42").
 * Elements are created once and only moved (transform: translate, rounded to whole CSS px) each frame.
 */
import { IDLERS, SITTERS } from './layout';
import type { FrameScene } from './FrameScene';

interface Target {
  el: HTMLElement;
  /** world px anchor (feet) getter */
  at: () => { x: number; y: number };
  /** px above the feet where the label's bottom edge goes */
  lift: number;
}

export interface Labels {
  update(scene: FrameScene): void;
}

export function createLabels(root: HTMLElement): Labels {
  const layer = document.createElement('div');
  layer.id = 'world-labels';
  root.appendChild(layer);
  const targets: Target[] = [];

  const plate = (text: string, kind: 'npc' | 'player' | 'me', at: Target['at'], lift = 27) => {
    const el = document.createElement('div');
    el.className = `plate plate-${kind}`;
    el.textContent = text;
    layer.appendChild(el);
    targets.push({ el, at, lift });
  };
  const bubble = (pt: string, en: string, at: Target['at'], lift = 40) => {
    const el = document.createElement('div');
    el.className = 'bubble';
    const p = document.createElement('div');
    p.className = 'pt';
    p.textContent = pt;
    const e = document.createElement('div');
    e.className = 'en';
    e.textContent = en;
    el.append(p, e);
    layer.appendChild(el);
    targets.push({ el, at, lift });
  };

  let walker = { x: 0, y: 0 };
  plate('Júlia', 'npc', () => walker, 27);
  const nanda = IDLERS[0];
  plate('Nanda', 'npc', () => ({ x: nanda.x * 16, y: nanda.y * 16 }), 27);
  bubble('Boa tarde! Pão de queijo, açaí, você, não, avó, Nº 42', 'Good afternoon! Cheese bread, açaí, you, no, grandma, No. 42', () => ({ x: nanda.x * 16, y: nanda.y * 16 }), 42);
  const mara = SITTERS[1];
  plate('Mara', 'player', () => ({ x: mara.x * 16, y: mara.y * 16 - 3 }), 24);
  const ze = SITTERS[0];
  plate('você', 'me', () => ({ x: ze.x * 16, y: ze.y * 16 - 3 }), 24);

  return {
    update(scene) {
      walker = scene.walkerPos();
      for (const t of targets) {
        const a = t.at();
        const p = scene.worldToClient(a.x, a.y);
        // labels of characters that are off screen are hidden; partially visible ones slide inward instead of being cut off
        const onScreen = p.x > -6 && p.x < window.innerWidth + 6 && p.y > -6 && p.y < window.innerHeight + 30;
        t.el.style.display = onScreen ? '' : 'none';
        if (!onScreen) continue;
        const half = t.el.offsetWidth / 2;
        const x = Math.round(Math.min(Math.max(p.x, half + 6), window.innerWidth - half - 6));
        const y = Math.round(p.y - t.lift * scene.cssScale());
        t.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      }
    },
  };
}
