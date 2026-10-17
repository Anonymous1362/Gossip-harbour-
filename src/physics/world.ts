import Matter from 'matter-js';
import type { LevelDef, PinDef } from '../game/types.ts';
import { pinRod } from '../game/pinGeometry.ts';
import { HOPPER_WALL_T, profileToWalls, radiusAt } from './profile.ts';

const { Engine, Bodies, Body, Composite, Events, Vector } = Matter;

/** Quay units -> matter pixels. Matter is happiest with bodies in the tens of
 *  pixels, so the authored 10x18 play field is scaled up here. */
export const PX = 100;

/** Coin radius in quay units. */
export const COIN_R = 0.17;

/** Pin colliders are thicker than the visual rod so fast coins cannot tunnel. */
export const PIN_COLLIDER_T = 0.11;

/** Matter's default gravity made the gold dump in ~3s. A softer pull gives the
 *  reference's slow thread and puts the first coin in the jar at ~1s, which is the
 *  responsiveness budget the frames point at (see docs/REFERENCE_NOTES.md §3). */
const GRAVITY = 0.55;

const FIXED_DT = 1000 / 120;
const MAX_SUBSTEPS = 5;
/** Velocity clamp in px per step, applied after every substep. */
const MAX_SPEED = 28;
const FLOOR_Y = -8.6;
/** Jar wall thickness in quay units. Thin, because the wall is centred outside the
 *  inner face: the old 0.07 walls ate 0.14 out of the jar's usable width. */
const JAR_WALL_T = 0.045;

/** Deterministic PRNG so a level looks the same every run and the play-test is stable. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export interface CoinXf {
  x: number;
  y: number;
  /** Spin, radians. */
  a: number;
}

export type PhysicsEvent =
  | { type: 'coinJarred' }
  | { type: 'coinLanded'; speed: number }
  | { type: 'pinPulled' };

interface CoinRecord {
  body: Matter.Body;
  collected: boolean;
}

export class PhysicsWorld {
  readonly level: LevelDef;
  private engine: Matter.Engine;
  private coins: CoinRecord[] = [];
  private pinBodies = new Map<string, Matter.Body>();
  private pinDefs = new Map<string, PinDef>();
  private events: PhysicsEvent[] = [];
  private jarCount = 0;
  private lostCount = 0;
  private accumulator = 0;
  private jarLeft: number;
  private jarRight: number;
  private jarTop: number;
  private jarBottom: number;
  private jarInner: number;
  private rand: () => number;

  constructor(level: LevelDef) {
    this.level = level;
    this.engine = Engine.create();
    // Levels are authored y-up (three.js convention); matter's default gravity
    // points at +y (y-down). Flipping it keeps one coordinate system end to end.
    this.engine.gravity.y = -GRAVITY;
    this.engine.positionIterations = 8;
    this.engine.velocityIterations = 6;

    const { x: jarX, y: jarY, width: jarW, height: jarH } = level.jar;
    this.jarLeft = (jarX - jarW / 2) * PX;
    this.jarRight = (jarX + jarW / 2) * PX;
    this.jarTop = jarY * PX;
    this.jarBottom = (jarY - jarH) * PX;
    this.jarInner = this.jarRight - this.jarLeft;
    this.rand = mulberry32(seedFrom(level.id));

    this.buildStatics();
    this.buildJar();
    this.buildPins();
    this.spawnCoins();

    Events.on(this.engine, 'collisionStart', (evt) => {
      for (const pair of evt.pairs) {
        const speed = Math.max(
          Vector.magnitude(pair.bodyA.velocity),
          Vector.magnitude(pair.bodyB.velocity),
        );
        const aIsCoin = this.isCoin(pair.bodyA);
        const bIsCoin = this.isCoin(pair.bodyB);
        if ((aIsCoin || bIsCoin) && speed > 2.2) {
          // Rate-limited by the audio layer, not here.
          this.events.push({ type: 'coinLanded', speed });
        }
      }
    });
  }

  private isCoin(body: Matter.Body): boolean {
    return this.coins.some((c) => c.body === body);
  }

  private buildStatics(): void {
    const bodies: Matter.Body[] = [];
    // Floor and screen edges keep stray coins in the diorama.
    bodies.push(
      Bodies.rectangle(0, (FLOOR_Y - 0.5) * PX, 20 * PX, 1 * PX, {
        isStatic: true,
        friction: 0.6,
        label: 'floor',
      }),
    );
    bodies.push(
      Bodies.rectangle(-5.3 * PX, 0, 1 * PX, 22 * PX, { isStatic: true, label: 'wall-l' }),
    );
    bodies.push(
      Bodies.rectangle(5.3 * PX, 0, 1 * PX, 22 * PX, { isStatic: true, label: 'wall-r' }),
    );

    for (const w of profileToWalls(this.level.hopper.x, this.level.hopper.profile, HOPPER_WALL_T)) {
      bodies.push(
        Bodies.rectangle(w.x * PX, w.y * PX, w.w * PX, w.h * PX, {
          isStatic: true,
          angle: w.angle,
          friction: 0.02,
          label: 'hopper',
        }),
      );
    }

    for (const w of this.level.extraWalls ?? []) {
      bodies.push(
        Bodies.rectangle(w.x * PX, w.y * PX, w.w * PX, w.h * PX, {
          isStatic: true,
          angle: w.angle,
          friction: 0.02,
          restitution: 0.1,
          label: 'guide',
        }),
      );
    }

    Composite.add(this.engine.world, bodies);
  }

  private buildJar(): void {
    const t = JAR_WALL_T * PX;
    const h = this.jarTop - this.jarBottom;
    const midX = (this.jarLeft + this.jarRight) / 2;
    // Wall centres sit *outside* the inner faces, so the usable width is exactly
    // jar.width. Centring them on the inner faces (the old behaviour) narrowed the
    // jar by a full wall thickness on each side.
    const bodies = [
      Bodies.rectangle(this.jarLeft - t / 2, (this.jarTop + this.jarBottom) / 2, t, h, {
        isStatic: true,
        label: 'jar',
      }),
      Bodies.rectangle(this.jarRight + t / 2, (this.jarTop + this.jarBottom) / 2, t, h, {
        isStatic: true,
        label: 'jar',
      }),
      Bodies.rectangle(midX, this.jarBottom - t / 2, this.jarInner + t * 2, t, {
        isStatic: true,
        label: 'jar',
      }),
    ];
    Composite.add(this.engine.world, bodies);
  }

  /** Width of the jar's collider cavity in pixels; a regression check pins this to
   *  the authored width so the walls cannot creep inward again. */
  get jarInnerWidth(): number {
    return this.jarInner;
  }

  private buildPins(): void {
    for (const pin of this.level.pins) {
      this.pinDefs.set(pin.id, pin);
      // Same rod the renderer draws: mounted through the shell, with a socket, so the
      // collider is exactly what the player can see.
      const rod = pinRod(this.level, pin);
      const body = Bodies.rectangle(
        rod.center.x * PX,
        rod.center.y * PX,
        rod.length * PX,
        PIN_COLLIDER_T * PX,
        {
          isStatic: true,
          angle: rod.angle,
          friction: 0.05,
          restitution: 0.08,
          label: `pin:${pin.id}`,
        },
      );
      this.pinBodies.set(pin.id, body);
      Composite.add(this.engine.world, body);
    }
  }

  /** Fills the bowl from the rim down. Returns how many coins actually fit. */
  private spawnCoins(): void {
    const { profile, x: axisX } = this.level.hopper;
    const top = profile[profile.length - 1][1];
    const bottom = profile[0][1];
    const spacing = 0.365;
    const positions: Array<{ x: number; y: number }> = [];

    for (let y = top - 0.32; y > bottom + 0.4; y -= spacing * 0.95) {
      const limit = radiusAt(profile, y) - COIN_R - 0.06;
      if (limit <= COIN_R) continue;
      const perRow = Math.floor((limit * 2) / spacing);
      if (perRow <= 0) continue;
      const rowWidth = perRow * spacing;
      for (let i = 0; i < perRow; i++) {
        const x = axisX - rowWidth / 2 + spacing / 2 + i * spacing;
        positions.push({ x, y });
      }
    }

    const count = Math.min(positions.length, this.level.coins);
    for (let i = 0; i < count; i++) {
      const p = positions[i];
      // Coins are identical circles physically, but a shared spin and friction makes
      // them pack into visible columns and settle in lockstep. A deterministic PRNG
      // gives each coin its own angle and a hair of friction variation, so the heap
      // looks poured rather than stacked -- and the play-test stays reproducible.
      const body = Bodies.circle(p.x * PX, p.y * PX, COIN_R * PX, {
        angle: this.rand() * Math.PI * 2,
        friction: 0.045 + this.rand() * 0.025,
        frictionStatic: 0.1 + this.rand() * 0.05,
        frictionAir: 0.004 + this.rand() * 0.0015,
        restitution: 0.09 + this.rand() * 0.06,
        density: 0.0022,
        // Matter's default slop is 0.05px. Anything larger lets coins overlap and
        // wedge into arches that no pulled pin can break.
        slop: 0.05,
        label: 'coin',
      });
      this.coins.push({ body, collected: false });
      Composite.add(this.engine.world, body);
    }
  }

  /** Coins the level intended to spawn vs. coins that fit in the bowl. */
  get spawned(): number {
    return this.coins.length;
  }

  get total(): number {
    return this.coins.length;
  }

  get coinsInJar(): number {
    return this.jarCount;
  }

  get coinsLost(): number {
    return this.lostCount;
  }

  get pinsRemaining(): number {
    return this.pinBodies.size;
  }

  get pinsTotal(): number {
    return this.pinDefs.size;
  }

  get progress(): number {
    return this.total === 0 ? 0 : this.jarCount / this.total;
  }

  pullPin(id: string): boolean {
    const body = this.pinBodies.get(id);
    if (!body) return false;
    Composite.remove(this.engine.world, body);
    this.pinBodies.delete(id);
    this.events.push({ type: 'pinPulled' });
    return true;
  }

  pullPinAt(x: number, y: number, radius: number): string | null {
    let best: { id: string; d2: number } | null = null;
    for (const [id, body] of this.pinBodies) {
      const d2 = (body.position.x - x) ** 2 + (body.position.y - y) ** 2;
      if (d2 <= radius ** 2 && (!best || d2 < best.d2)) best = { id, d2 };
    }
    if (!best) return null;
    return this.pullPin(best.id) ? best.id : null;
  }

  step(dtSeconds: number): void {
    this.accumulator += Math.min(dtSeconds * 1000, 250);
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_SUBSTEPS) {
      Engine.update(this.engine, FIXED_DT);
      this.clampVelocities();
      this.collect();
      this.accumulator -= FIXED_DT;
      steps++;
    }
    if (steps === MAX_SUBSTEPS) this.accumulator = 0;
  }

  /** Runs until coins come to rest, so a level starts with gold sitting on the mesh. */
  settle(maxSteps = 400): number {
    // Warm-up: the first frames are always slow, so a quiet check at step 0 lies.
    const warmup = 24;
    for (let i = 0; i < maxSteps; i++) {
      Engine.update(this.engine, FIXED_DT);
      this.clampVelocities();
      this.collect();
      if (i >= warmup && this.maxSpeed() < 0.5) return i;
    }
    return maxSteps;
  }

  private clampVelocities(): void {
    for (const { body, collected } of this.coins) {
      if (collected) continue;
      const speed = Vector.magnitude(body.velocity);
      if (speed > MAX_SPEED) {
        const k = MAX_SPEED / speed;
        Body.setVelocity(body, { x: body.velocity.x * k, y: body.velocity.y * k });
      }
    }
  }

  private collect(): void {
    const r = COIN_R * PX;
    for (const record of this.coins) {
      if (record.collected) continue;
      const { x, y } = record.body.position;
      if (x > this.jarLeft && x < this.jarRight && y < this.jarTop - r * 0.2 && y > this.jarBottom) {
        record.collected = true;
        this.jarCount++;
        Composite.remove(this.engine.world, record.body);
        this.events.push({ type: 'coinJarred' });
        continue;
      }
      // Gold that gets past the rim and misses the glass is gone for good. Measuring
      // from the jar (not the floor) keeps the live body count from creeping up.
      if (y < this.jarTop - 0.9 * PX) {
        record.collected = true;
        this.lostCount++;
        Composite.remove(this.engine.world, record.body);
      }
    }
  }

  maxSpeed(): number {
    let max = 0;
    for (const { body, collected } of this.coins) {
      if (collected) continue;
      const s = Vector.magnitude(body.velocity);
      if (s > max) max = s;
    }
    return max;
  }

  /** True when nothing is meaningfully moving; used for the stall/lose check. */
  isQuiet(): boolean {
    return this.maxSpeed() < 1.1;
  }

  coinTransforms(): CoinXf[] {
    const out: CoinXf[] = [];
    for (const { body, collected } of this.coins) {
      if (collected) continue;
      out.push({ x: body.position.x / PX, y: body.position.y / PX, a: body.angle });
    }
    return out;
  }

  pinTransform(id: string): { x: number; y: number; angle: number } | null {
    const body = this.pinBodies.get(id);
    if (!body) return null;
    return { x: body.position.x / PX, y: body.position.y / PX, angle: body.angle };
  }

  livePinIds(): string[] {
    return [...this.pinBodies.keys()];
  }

  drainEvents(): PhysicsEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
}
