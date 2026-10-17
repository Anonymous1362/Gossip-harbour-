import type { WallDef } from '../game/types.ts';

/** A static rectangle derived from a cavity profile edge. */
export interface ProfileWall extends WallDef {
  /** Outer face of the cavity wall, for debugging. */
  segment: { x1: number; y1: number; x2: number; y2: number };
}

/** Thickness of the hopper shell as a physics collider, in quay units. */
export const HOPPER_WALL_T = 0.22;

/** Radius of the cavity at a given height, by linear interpolation of the profile. */
export function radiusAt(profile: Array<[number, number]>, y: number): number {
  if (profile.length === 0) return 0;
  const first = profile[0] as [number, number];
  const last = profile[profile.length - 1] as [number, number];
  if (y <= first[1]) return first[0];
  if (y >= last[1]) return last[0];
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1] as [number, number];
    const b = profile[i] as [number, number];
    if (y <= b[1]) {
      const t = b[1] === a[1] ? 0 : (y - a[1]) / (b[1] - a[1]);
      return a[0] + (b[0] - a[0]) * t;
    }
  }
  return last[0];
}

function wallFromPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  outward: 1 | -1,
  thickness: number,
): ProfileWall {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 0.0001;
  const ux = dx / len;
  const uy = dy / len;
  // Left normal of the direction of travel. Profile runs bottom -> top on the
  // right side, so its left normal points away from the axis (outward).
  const nx = uy * outward;
  const ny = -ux * outward;
  return {
    x: (x1 + x2) / 2 + nx * (thickness / 2),
    y: (y1 + y2) / 2 + ny * (thickness / 2),
    w: len,
    h: thickness,
    angle: Math.atan2(dy, dx),
    segment: { x1, y1, x2, y2 },
  };
}

/**
 * Turns a [radius, y] cavity profile into mirrored wall colliders. The collider's
 * inner face sits exactly on the profile line, so the visual cavity and the
 * physics cavity agree -- the renderer revolves the same array.
 */
export function profileToWalls(
  axisX: number,
  profile: Array<[number, number]>,
  thickness = HOPPER_WALL_T,
): ProfileWall[] {
  const walls: ProfileWall[] = [];
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1] as [number, number];
    const b = profile[i] as [number, number];
    if (Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6) continue;
    walls.push(wallFromPoints(axisX + a[0], a[1], axisX + b[0], b[1], 1, thickness));
    walls.push(wallFromPoints(axisX - a[0], a[1], axisX - b[0], b[1], -1, thickness));
  }
  return walls;
}
