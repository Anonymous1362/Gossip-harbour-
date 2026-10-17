import type { LevelDef } from './types.ts';
import { PhysicsWorld } from '../physics/world.ts';

export type Phase = 'playing' | 'won' | 'lost';

/** Wraps the physics world in the level's rules: win ratio, stars, stall loss. */
export class Session {
  readonly level: LevelDef;
  readonly world: PhysicsWorld;
  phase: Phase = 'playing';
  stars = 0;

  private idleTimer = 0;
  private finishTimer = 0;

  constructor(level: LevelDef) {
    this.level = level;
    this.world = new PhysicsWorld(level);
    // Gold must already be sitting on the mesh when the player first looks.
    this.world.settle();
  }

  get collected(): number {
    return this.world.coinsInJar;
  }

  get total(): number {
    return this.world.total;
  }

  get ratio(): number {
    return this.world.total === 0 ? 0 : this.world.coinsInJar / this.world.total;
  }

  get pinsUnpulled(): number {
    return this.world.pinsRemaining;
  }

  get finished(): boolean {
    return this.phase !== 'playing';
  }

  pull(pinId: string): boolean {
    if (this.phase !== 'playing') return false;
    return this.world.pullPin(pinId);
  }

  update(dt: number): void {
    if (this.phase !== 'playing') return;
    this.world.step(dt);

    const resolved = this.world.coinsInJar + this.world.coinsLost >= this.world.total;
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
    const ratio = this.ratio;
    if (ratio >= this.level.target - 1e-6) {
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
