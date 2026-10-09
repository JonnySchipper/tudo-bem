// Node module hooks for the review scripts that load the client's and shared .ts modules directly (node strips the types): an
// extensionless relative import (`./palette`) or a `.js` one that is really a `.ts` file (`./looks.js` in packages/shared) resolves to
// the .ts file. Register with `register('./lib/ts-resolve.mjs', import.meta.url)` before importing them dynamically.
export async function resolve(spec, ctx, next) {
  try {
    return await next(spec, ctx);
  } catch (e) {
    if (spec.startsWith('.') && !/\.\w+$/.test(spec)) return next(`${spec}.ts`, ctx);
    if (spec.startsWith('.') && spec.endsWith('.js')) return next(`${spec.slice(0, -3)}.ts`, ctx);
    throw e;
  }
}
