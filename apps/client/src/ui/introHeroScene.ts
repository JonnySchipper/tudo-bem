import { h } from './dom';
import { vilaSnapshot } from './introSnapshot';
import { PAN_ROUTE, introZoom, mapOffset, panCenter } from './introCamera';

/**
 * The title screen's world (Phase 6b): the real Vila Ipê at 17:30, pixel art, panned very slowly behind the sign-in card.
 *
 * Phaser only starts after this gate closes (the WebGL crash fix, DECISIONS "Integration with main"), so the picture is not a second
 * game: `introSnapshot` draws the map once on an offscreen 2D canvas from the game's own atlas and terrain, and this file moves that
 * canvas with CSS transforms at an integer zoom (`image-rendering: pixelated`). The sky gradient underneath is the fallback while the
 * snapshot loads, and stays if it cannot.
 */

export interface SceneLayout {
  /** px from the top of the gate to the sign-in card (in its resting layout). */
  cardTop: number;
  /** px from the top of the gate to the bottom of the wordmark + taglines (sign-in layout). */
  heroBottom: number;
}

export interface IntroHeroScene {
  el: HTMLElement;
  /** Re-frame for the current viewport; call on resize. */
  frame: (layout?: SceneLayout) => void;
  /** Pointer parallax on fine pointers; returns teardown. */
  mountParallax: () => () => void;
  /** The slow pan (a still frame when `reduced`); returns teardown. */
  mountPan: (reduced: boolean) => () => void;
}

/** Largest parallax shift of the picture under the pointer, CSS px. */
const PARALLAX_PX = 7;

export function createIntroHeroScene(): IntroHeroScene {
  const wrap = h('div', { class: 'intro-hero-scene', 'aria-hidden': 'true' });
  wrap.innerHTML = `<div class="intro-sky"></div><div class="intro-sun"></div><div class="intro-rays"></div>
    <div class="intro-map-wrap"><div class="intro-map-shift"></div><div class="intro-map-light"></div></div>
    <div class="intro-grade intro-grade-warm"></div><div class="intro-grade intro-grade-light"></div>`;
  const mapWrap = wrap.querySelector<HTMLElement>('.intro-map-wrap')!;
  const shift = wrap.querySelector<HTMLElement>('.intro-map-shift')!;

  let canvas: HTMLCanvasElement | null = null;
  let zoom = 4;
  let vw = 1;
  let vh = 1;
  let t0 = performance.now();
  let panning = false;
  let raf = 0;
  let parX = 0;
  let parY = 0;
  let parTX = 0;
  let parTY = 0;

  const render = (tSec: number) => {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const o = mapOffset(panCenter(tSec, PAN_ROUTE), zoom, vw, vh, canvas.width, canvas.height, dpr);
    // the pointer nudges the picture by whole device pixels too
    const px = Math.round(parX * dpr) / dpr;
    const py = Math.round(parY * dpr) / dpr;
    canvas.style.transform = `translate3d(${o.tx + px}px, ${o.ty + py}px, 0)`;
  };

  const frame = (layout?: SceneLayout) => {
    vw = wrap.clientWidth || window.innerWidth;
    vh = wrap.clientHeight || window.innerHeight;
    zoom = introZoom(vw, vh);
    if (canvas) {
      canvas.style.width = `${canvas.width * zoom}px`;
      canvas.style.height = `${canvas.height * zoom}px`;
    }
    // portrait: once the card arrives, lift the picture into the strip between the wordmark and the card
    const portrait = vw < 600 || vw / vh < 0.8;
    let lift = 0;
    if (portrait && layout) {
      const strip = (layout.heroBottom + layout.cardTop) / 2;
      lift = Math.min(0, strip - vh / 2);
    }
    wrap.style.setProperty('--cam-shift', `${lift.toFixed(1)}px`);
    if (!panning) render(0);
  };

  void vilaSnapshot()
    .then((c) => {
      canvas = c;
      c.className = 'intro-map';
      shift.append(c);
      frame();
      render((performance.now() - t0) / 1000);
      requestAnimationFrame(() => mapWrap.classList.add('is-ready'));
    })
    .catch(() => {
      /* the sky stays: the sign-in card is what matters */
    });

  const mountPan = (reduced: boolean) => {
    if (reduced) {
      panning = false;
      render(0);
      return () => {};
    }
    panning = true;
    t0 = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      parX += (parTX - parX) * 0.06;
      parY += (parTY - parY) * 0.06;
      render((performance.now() - t0) / 1000);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      panning = false;
      cancelAnimationFrame(raf);
    };
  };

  const mountParallax = () => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};
    const onMove = (e: PointerEvent) => {
      parTX = -((e.clientX / window.innerWidth) * 2 - 1) * PARALLAX_PX;
      parTY = -((e.clientY / window.innerHeight) * 2 - 1) * PARALLAX_PX * 0.5;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  };

  return { el: wrap, frame, mountParallax, mountPan };
}
