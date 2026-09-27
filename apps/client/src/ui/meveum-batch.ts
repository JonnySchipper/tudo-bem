/** How many of the in-hand item a chapa/bebidas click should prep.
 *
 * `still` treats the unit already in hand as pipeline, so the button has to add it
 * back. Without that, “dois …” stays a plain Grelhar/Servir and a ×N click is one short.
 */
export function stationBatchSize(opts: {
  lineQty: number;
  onTray: number;
  queuedSame: number;
  trayTotal: number;
  queuedOther: number;
  maxTray: number;
}): number {
  const pipeline = opts.queuedSame + 1;
  const still = Math.max(0, opts.lineQty - opts.onTray - pipeline);
  const need = still + 1;
  const cap = opts.maxTray - opts.trayTotal - opts.queuedSame - opts.queuedOther;
  return Math.max(1, Math.min(need, cap));
}
