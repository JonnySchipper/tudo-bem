/**
 * Persisted on/off switch for the Feira cart games (`feiraCart.json` beside the profiles).
 * Nothing stored = the shipped default (`defaultFeiraCartConfig`: Tapioca on, the others off). Once an admin
 * switches anything, the stored config wins. A later schedule lives on the same row (`mode: 'rotation'` + `schedule`).
 * Browser-safe: no `fs` and no `process` (the solo build constructs a memory store).
 */
import {
  feiraCartAdminView,
  normalizeFeiraCartConfig,
  withFeiraCartMode,
  type FeiraCartConfig,
  type FeiraCartMode,
  type FeiraCartSchedule,
} from '@tudobem/shared';

export class FeiraCartStore {
  private cfg: FeiraCartConfig;

  constructor(
    private readonly load: () => unknown,
    private readonly save: (cfg: FeiraCartConfig) => void,
  ) {
    this.cfg = normalizeFeiraCartConfig(load());
  }

  config(): FeiraCartConfig {
    return this.cfg;
  }

  view(day: string) {
    return feiraCartAdminView(this.cfg, day);
  }

  /**
   * Set one game. `schedule === undefined` keeps the stored window.
   * False when the id is not in the rotation registry or the schedule is unreadable.
   */
  setMode(id: string, mode: FeiraCartMode, schedule?: FeiraCartSchedule | null): boolean {
    const next = withFeiraCartMode(this.cfg, id, mode, schedule);
    if (!next) return false;
    this.cfg = next;
    this.save(this.cfg);
    return true;
  }

  persist() {
    this.save(this.cfg);
  }
}

/** In-memory store for tests and the solo build. Starts on the shipped default unless `raw` says otherwise (`emptyFeiraCartConfig()` = all off). */
export function memoryFeiraCart(raw?: unknown): FeiraCartStore {
  let blob: unknown = raw;
  return new FeiraCartStore(
    () => blob,
    (cfg) => {
      blob = cfg;
    },
  );
}
