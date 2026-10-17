/** Versioned localStorage save. Every access is guarded: private-mode Safari throws
 *  on read as well as write, so a missing save must never break a boot. */
export interface SaveData {
  v: 1;
  /** Best stars per level id. */
  stars: Record<string, number>;
  muted: boolean;
}

const KEY = 'lantern-quay.save';

const DEFAULT: SaveData = { v: 1, stars: {}, muted: false };

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT, stars: {} };
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (parsed.v !== 1) return { ...DEFAULT, stars: {} };
    return {
      v: 1,
      stars: parsed.stars && typeof parsed.stars === 'object' ? { ...parsed.stars } : {},
      muted: Boolean(parsed.muted),
    };
  } catch {
    return { ...DEFAULT, stars: {} };
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage disabled or full: the game still runs, it just forgets.
  }
}

export function recordStars(data: SaveData, levelId: string, stars: number): SaveData {
  const best = Math.max(data.stars[levelId] ?? 0, stars);
  const next: SaveData = { ...data, stars: { ...data.stars, [levelId]: best } };
  writeSave(next);
  return next;
}
