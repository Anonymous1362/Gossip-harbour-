import type { LevelDef } from './types.ts';
import { PhysicsWorld } from '../physics/world.ts';

export type Phase = 'playing' | 'won' | 'lost';

/** A level's win ratio, forced into a range that can never hand out a free win.
 *  Authored levels are validated on import (see levels.ts); this is the second belt. */
export function resolveTarget(target: number): number {
  if (!Number.isFinite(target) || target <= 0) return 1;
  return Math.min(target, 1);
}

/**
 * Wraps the physics world in the level's rules: win ratio, stars, stall loss.
 *
 * Two invariants keep the end-of-level panel honest:
 *  - a session cannot resolve before the player has pulled a pin, so nothing is
 *    ever won or lost on a level that has not been played;
 *  - `total` is fixed when the coins spawn and is always a positive, finite count,
 *    so the win ratio can never be computed from 0 or NaN.
 */
export class Session {
  readonly level: LevelDef;
  readonly world: PhysicsWorld;
  /** Sanitised copy of the level's win threshold: finite and inside (0, 1]. */
  readonly target: number;
  phase: Phase = 'playing';
  stars = 0;

  private readonly totalCoins: number;
  private pulls = 0;
  private idleTimer = 0;
  private finishTimer = 0;

  constructor(level: LevelDef) {
    this.level = level;
    this.target = resolveTarget(level.target);
    this.world = new PhysicsWorld(level);
    // Gold must already be sitting on the mesh when the player first looks.
    this.world.settle();

    this.totalCoins = this.world.total;
    if (!Number.isFinite(this.totalCoins) || this.totalCoins <= 0) {
      throw new Error(
        `Level "${level.id}" spawned no coins: the bowl cannot hold ${level.coins}.`,
      );
    }
  }

  get collected(): number {
    return this.world.coinsInJar;
  }

  get total(): number {
    return this.totalCoins;
  }

  get ratio(): number {
    // totalCoins is proven positive in the constructor, so this is always 0..1.
    return this.collected / this.totalCoins;
  }

  get hasPulled(): boolean {
    return this.pulls > 0;
  }

  get pinsUnpulled(): number {
    return this.world.pinsRemaining;
  }

  get finished(): boolean {
    return this.phase !== 'playing';
  }

  pull(pinId: string): boolean {
    if (this.phase !== 'playing') return false;
    const pulled = this.world.pullPin(pinId);
    if (pulled) this.pulls++;
    return pulled;
  }

  update(dt: number): void {
    if (this.phase !== 'playing') return;
    this.world.step(dt);

    // Untouched levels stay playable forever: no win, no stall loss.
    if (this.pulls === 0) {
      this.idleTimer = 0;
      this.finishTimer = 0;
      return;
    }

    const resolved = this.world.coinsInJar + this.world.coinsLost >= this.totalCoins;
    if (resolved) {
      this.finishTimer += dt;
      if (this.finishTimer >= 0.7) this.finish();
      return;
    }

    // Nothing left to pull and nothing moving: the rest of the gold is stranded.
    if (this.world.pinsRemaining === 0 && this.world.isQuiet()) {
      this.idleTimer += dt;
      if (this.idleTimer >= 6) this.finish();
    } else {
      this.idleTimer = 0;
    }
  }

  private finish(): void {
    if (this.pulls === 0 || this.totalCoins <= 0) return;
    const ratio = this.ratio;
    if (ratio >= this.target - 1e-6) {
      this.phase = 'won';
      // Star tiers come from how much gold actually reached the glass. Pin-efficiency
      // stars arrive with hazards in Milestone 3.
      this.stars = ratio >= 0.95 ? 3 : ratio >= 0.85 ? 2 : 1;
    } else {
      this.phase = 'lost';
      this.stars = 0;
    }
  }
}
