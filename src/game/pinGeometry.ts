import type { LevelDef, PinDef, Vec2 } from './types.ts';
import { radiusAt } from '../physics/profile.ts';

/**
 * Turns an authored pin (centre, angle, length) into a rod that is *mounted in the
 * shell*: one end always reaches past the hopper wall, and every point where the rod
 * crosses the shell gets a socket. Nothing is allowed to hang in mid-air.
 *
 * The same geometry feeds the renderer and the matter collider, so a visible rod and
 * the thing coins actually rest on can never drift apart.
 */

/** How far the rod protrudes past the shell, measured along x. */
export const PIN_PROTRUDE = 0.18;
/** A rod end this close to the wall is snapped through it instead of left as a tip. */
const SNAP_TO_WALL = 0.09;
/** How far a decoy stub pokes into the cavity. Deliberately tiny: it must not gate. */
const STUB_INSIDE = 0.05;
const SCAN_STEP = 0.004;
const SCAN_MARGIN = 1.6;

export interface PinRod {
  id: string;
  /** Radians, 0 = horizontal, positive = counter-clockwise on screen. */
  angle: number;
  /** Inner end: inside the cavity, or the tip of a stub. */
  start: Vec2;
  /** Outer end: past the shell, where the head sits. */
  end: Vec2;
  /** Midpoint, i.e. the matter body's centre. */
  center: Vec2;
  /** Distance from start to end. */
  length: number;
  /** Where the rod passes through the shell; each one gets a socket cap. */
  sockets: Vec2[];
  /** Ends that sit outside the shell; each one gets a head. */
  heads: Vec2[];
}

interface RodLine {
  axisX: number;
  profile: Array<[number, number]>;
  yAt(x: number): number;
  inside(x: number): boolean;
  radius(x: number): number;
  /** Signed distance from the axis minus the cavity radius; > 0 is outside. */
  clear(x: number): number;
}

function rodLine(level: LevelDef, pin: PinDef): RodLine {
  const { x: axisX, profile } = level.hopper;
  if (Math.abs(pin.angle) > 1.2) {
    throw new Error(`Pin "${pin.id}" is too close to vertical to mount in the shell`);
  }
  const tan = Math.tan(pin.angle);
  const yAt = (x: number): number => pin.y + (x - pin.x) * tan;
  const radius = (x: number): number => radiusAt(profile, yAt(x));
  const clear = (x: number): number => Math.abs(x - axisX) - radius(x);
  return {
    axisX,
    profile,
    yAt,
    radius,
    clear,
    inside: (x) => clear(x) < 0,
  };
}

/** Every shell crossing along the rod line, in increasing x. */
function crossings(line: RodLine, from: number, to: number): number[] {
  const out: number[] = [];
  let x0 = from;
  let c0 = line.clear(x0);
  for (let x1 = from + SCAN_STEP; x1 <= to + SCAN_STEP; x1 += SCAN_STEP) {
    const c1 = line.clear(x1);
    if ((c0 < 0) !== (c1 < 0)) {
      let lo = x0;
      let hi = x1;
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if ((line.clear(mid) < 0) === (c0 < 0)) lo = mid;
        else hi = mid;
      }
      out.push((lo + hi) / 2);
    }
    x0 = x1;
    c0 = c1;
  }
  return out;
}

/** Nearest crossing on the side of the axis that `x` sits on. */
function crossingNear(line: RodLine, xs: number[], x: number): number | null {
  const side = Math.sign(x - line.axisX);
  let best: number | null = null;
  for (const c of xs) {
    if (side !== 0 && Math.sign(c - line.axisX) !== side) continue;
    if (best === null || Math.abs(c - x) < Math.abs(best - x)) best = c;
  }
  return best;
}

/** How far the point at `x` is from the wall on its own side, in x units. */
function wallGap(line: RodLine, xs: number[], x: number): number {
  const c = crossingNear(line, xs, x);
  return c === null ? Number.POSITIVE_INFINITY : Math.abs(c - x);
}

/**
 * Moves an end out through the wall on its side, protruding PIN_PROTRUDE past the
 * shell. Used for every anchored end.
 */
function extendOut(line: RodLine, xs: number[], x: number): number {
  const c = crossingNear(line, xs, x);
  if (c === null) return x;
  const side = Math.sign(c - line.axisX) || Math.sign(x - line.axisX) || 1;
  return c + side * PIN_PROTRUDE;
}

/** Pulls a decoy end just inside the cavity, so the stub is visibly embedded. */
function stubIn(line: RodLine, xs: number[], x: number): number {
  const c = crossingNear(line, xs, x);
  if (c === null) return x;
  const side = Math.sign(c - line.axisX) || Math.sign(x - line.axisX) || 1;
  return c - side * STUB_INSIDE;
}

export function pinRod(level: LevelDef, pin: PinDef): PinRod {
  const line = rodLine(level, pin);
  const half = pin.length / 2;
  let x0 = pin.x - half;
  let x1 = pin.x + half;

  const xs = crossings(line, x0 - SCAN_MARGIN, x1 + SCAN_MARGIN);
  if (xs.length === 0) {
    throw new Error(`Pin "${pin.id}" never crosses the hopper shell`);
  }

  const inside0 = line.inside(x0);
  const inside1 = line.inside(x1);

  const spanCrossings = xs.filter((c) => c > Math.min(x0, x1) && c < Math.max(x0, x1));
  if (!inside0 && !inside1 && spanCrossings.length >= 2) {
    // The authored rod already spans the cavity and pokes out both walls: a through
    // rod. Extend both ends and let each wall get a socket.
    x0 = extendOut(line, xs, x0);
    x1 = extendOut(line, xs, x1);
  } else if (!inside0 && !inside1) {
    // Entirely outside the shell: a decoy stub. Drive the near end in through the
    // wall by a hair, and pull the far end back to a sensible overhang. The authored
    // decoy was parked next to the shell with a long spike pointing away from it; a
    // mounted stub is both honest and the shape the socket is drawn for.
    if (wallGap(line, xs, x0) <= wallGap(line, xs, x1)) {
      x0 = stubIn(line, xs, x0);
      x1 = extendOut(line, xs, x1);
    } else {
      x1 = stubIn(line, xs, x1);
      x0 = extendOut(line, xs, x0);
    }
  } else {
    // At least one end is in the cavity. Snap an end that is nearly touching its wall,
    // and make sure the rod is actually anchored at all.
    if (!inside0) x0 = extendOut(line, xs, x0);
    else if (wallGap(line, xs, x0) < SNAP_TO_WALL) x0 = extendOut(line, xs, x0);

    if (!inside1) x1 = extendOut(line, xs, x1);
    else if (wallGap(line, xs, x1) < SNAP_TO_WALL) x1 = extendOut(line, xs, x1);

    const anchored = !line.inside(x0) || !line.inside(x1);
    if (!anchored) {
      // A rod floating in the middle of the glass is the bug this whole module
      // exists to prevent: drive the end nearest a wall through that wall.
      if (wallGap(line, xs, x0) <= wallGap(line, xs, x1)) x0 = extendOut(line, xs, x0);
      else x1 = extendOut(line, xs, x1);
    }
  }

  const lo = Math.min(x0, x1);
  const hi = Math.max(x0, x1);
  const startX = x0 <= x1 ? x0 : x1;
  const endX = x0 <= x1 ? x1 : x0;

  const start = { x: startX, y: line.yAt(startX) };
  const end = { x: endX, y: line.yAt(endX) };
  const center = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

  const sockets: Vec2[] = [];
  for (const c of crossings(line, lo - PIN_PROTRUDE * 2, hi + PIN_PROTRUDE * 2)) {
    if (c < lo - 1e-6 || c > hi + 1e-6) continue;
    sockets.push({ x: c, y: line.yAt(c) });
  }

  const heads: Vec2[] = [];
  for (const p of [start, end]) {
    if (line.clear(p.x) > 0) heads.push({ ...p });
  }

  return {
    id: pin.id,
    angle: Math.atan2(end.y - start.y, end.x - start.x),
    start,
    end,
    center,
    length: Math.hypot(end.x - start.x, end.y - start.y),
    sockets,
    heads,
  };
}

export function pinRods(level: LevelDef): PinRod[] {
  return level.pins.map((pin) => pinRod(level, pin));
}
