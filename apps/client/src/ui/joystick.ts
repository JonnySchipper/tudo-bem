import { h, ui } from './dom';

/**
 * On-screen stick for phones. `iso` maps onto the diamond (right = +x/−y).
 * `topdown` maps screen right to +x and screen down to +y.
 */
export function mountJoystick(mode: 'iso' | 'topdown', step: (dx: number, dy: number) => void) {
  const knob = h('div', { class: 'knob' });
  const pad = h('div', { class: 'joystick', id: 'joystick', 'aria-label': 'Andar' }, knob);
  ui().append(pad);

  let pid: number | null = null;
  let vx = 0;
  let vy = 0;
  let timer = 0;

  const place = (clientX: number, clientY: number) => {
    const r = pad.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const max = r.width / 2 - 22;
    const clamped = Math.min(dist, max);
    knob.style.transform = `translate(${(dx / dist) * clamped}px, ${(dy / dist) * clamped}px)`;
    if (dist < 18) {
      vx = 0;
      vy = 0;
      return;
    }
    const sx = dx / dist;
    const sy = dy / dist;
    const tileX = mode === 'topdown' ? sx : sx + sy;
    const tileY = mode === 'topdown' ? sy : -sx + sy;
    const mag = Math.hypot(tileX, tileY) || 1;
    vx = Math.round((tileX / mag) * 3);
    vy = Math.round((tileY / mag) * 3);
    if (vx === 0 && vy === 0) {
      if (Math.abs(tileX) >= Math.abs(tileY)) vx = tileX > 0 ? 2 : -2;
      else vy = tileY > 0 ? 2 : -2;
    }
  };

  const tick = () => {
    if (vx || vy) step(vx, vy);
  };

  const end = (e: PointerEvent) => {
    if (e.pointerId !== pid) return;
    pid = null;
    vx = 0;
    vy = 0;
    knob.style.transform = '';
    window.clearInterval(timer);
  };

  pad.addEventListener('pointerdown', (e) => {
    if (pid !== null) return;
    pid = e.pointerId;
    pad.setPointerCapture(e.pointerId);
    place(e.clientX, e.clientY);
    tick();
    window.clearInterval(timer);
    timer = window.setInterval(tick, 460);
    e.preventDefault();
    e.stopPropagation();
  });
  pad.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pid) return;
    place(e.clientX, e.clientY);
  });
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
}
