/**
 * Safe environment read for server modules that also ship in the browser bundle (the solo build runs `World` in the page through LocalNet,
 * where `process` does not exist). Server-side behavior is identical to reading `process.env` directly.
 */
export function readEnv(name: string): string | undefined {
  return typeof process !== 'undefined' && process.env ? process.env[name] : undefined;
}
