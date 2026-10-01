/**
 * Switches for the V5 lighting layers, for perf bisecting and before/after shots: `?v5off=ao,shadow,wet,refl,mirror,water,all` (or `?v5=0` for all of
 * them), changeable at run time through `window.__v5.off`. Everything is on by default; nothing here is a user setting.
 */
export const v5off = new Set<string>();

if (typeof location !== 'undefined') {
  const q = location.search;
  if (/[?&]v5=0/.test(q)) v5off.add('all');
  const m = /[?&]v5off=([a-z,]+)/.exec(q);
  if (m) for (const k of m[1].split(',')) v5off.add(k);
  (window as unknown as { __v5: { off: Set<string> } }).__v5 = { off: v5off };
}

/** True when the named V5 layer is on. */
export const v5on = (name: string): boolean => !v5off.has('all') && !v5off.has(name);
