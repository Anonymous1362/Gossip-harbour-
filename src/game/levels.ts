import type { LevelDef } from './types.ts';
// Import attributes keep this file runnable by plain Node (see tests/), not just Vite.
import raw01 from '../levels/01-first-pour.json' with { type: 'json' };
import raw02 from '../levels/02-two-halves.json' with { type: 'json' };
import raw03 from '../levels/03-narrow-neck.json' with { type: 'json' };

/** Levels are authored as JSON. Structural validation happens once here so a bad
 *  file fails loudly at boot instead of halfway through a level. */
function toLevel(raw: unknown): LevelDef {
  const lvl = raw as LevelDef;
  const fail = (msg: string): never => {
    throw new Error(`Level "${lvl?.id ?? '(unknown)'}": ${msg}`);
  };
  if (!lvl.id) fail('missing id');
  if (!Array.isArray(lvl.hopper?.profile) || lvl.hopper.profile.length < 2) fail('bad profile');
  if (!Array.isArray(lvl.pins) || lvl.pins.length === 0) fail('no pins');
  if (!lvl.jar || typeof lvl.jar.x !== 'number') fail('bad jar');
  if (typeof lvl.coins !== 'number' || lvl.coins <= 0) fail('bad coin count');
  if (!Array.isArray(lvl.solution) || lvl.solution.length === 0) fail('no solution');
  return lvl;
}

export const LEVELS: LevelDef[] = [toLevel(raw01), toLevel(raw02), toLevel(raw03)];
