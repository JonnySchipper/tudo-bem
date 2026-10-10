/**
 * The Praia's admin switch (PRAIA-PLAN.md 1.2): open / preview / closed and the party boat on or off. One kv row (`praia`) beside the
 * profiles; a missing row is the default (open, party boat on: the beta is free). Browser-safe: the solo build builds a memory store.
 */
import { normalizePraiaConfig, PRAIA_DEFAULT, type PraiaConfig } from '@tudobem/shared';

export class PraiaStore {
  private cfg: PraiaConfig;

  constructor(
    load: () => unknown,
    private readonly save: (cfg: PraiaConfig) => void,
  ) {
    this.cfg = normalizePraiaConfig(load());
  }

  config(): PraiaConfig {
    return this.cfg;
  }

  /** Change either field. Returns the new config (unknown values are dropped by `normalizePraiaConfig`). */
  set(patch: Partial<PraiaConfig>): PraiaConfig {
    this.cfg = normalizePraiaConfig({ ...this.cfg, ...patch });
    this.save(this.cfg);
    return this.cfg;
  }

  persist() {
    this.save(this.cfg);
  }
}

/** In-memory store for tests and the solo build. */
export function memoryPraia(raw?: unknown): PraiaStore {
  let blob: unknown = raw ?? { ...PRAIA_DEFAULT };
  return new PraiaStore(
    () => blob,
    (cfg) => {
      blob = cfg;
    },
  );
}
