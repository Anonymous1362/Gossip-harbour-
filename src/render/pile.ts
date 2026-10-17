/**
 * Layout of the coin pile inside the glass.
 *
 * The old jar drew a 4 x 3 x 7 lattice, which read as four rigid columns. This lays
 * coins out bottom-up in staggered rows with per-coin x/y jitter, a random spin and a
 * slight 3D tilt, tapering towards the top so the surface mounds like a poured pile.
 *
 * Pure maths with a seeded PRNG: no three.js, so the regression test can check the
 * shape of the pile in Node.
 */

export interface PileCoin {
  /** Horizontal offset from the jar's centre, in quay units. */
  x: number;
  /** Vertical offset from the jar's mouth (always negative, down to -height). */
  y: number;
  /** Depth inside the glass. */
  z: number;
  /** Spin about the view axis, radians. */
  a: number;
  /** Small out-of-plane tilts so faces catch the light differently. */
  tiltX: number;
  tiltY: number;
}

const ROW_H = 0.185;
const SPACING_X = 0.235;
const LANES = [-0.16, 0.16];
const FLOOR_GAP = 0.22;
/** Coin radius plus the x jitter, so no disc touches the glass. */
const COIN_CLEAR = 0.235;
/** The glass tapers to 82% of its mouth radius at the floor (see createJar). */
const BOTTOM_TAPER = 0.82;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param innerWidth  usable width of the glass (wall to wall)
 * @param innerHeight glass height, mouth to floor
 * @param seed        fixed so every run of a level looks the same
 */
export function pileLayout(innerWidth: number, innerHeight: number, seed = 0x51ed270b): PileCoin[] {
  const rand = mulberry32(seed);
  const rows = Math.max(2, Math.floor((innerHeight - FLOOR_GAP) / ROW_H));
  const coins: PileCoin[] = [];

  for (let row = 0; row < rows; row++) {
    // Taper the top third: the last rows are narrower, so the fill line mounds.
    const t = row / Math.max(rows - 1, 1);
    const taper = t <= 0.62 ? 1 : 1 - 0.55 * ((t - 0.62) / 0.38);
    const y = -innerHeight + FLOOR_GAP + row * ROW_H;
    // Follow the glass: it is narrower at the floor, so the bottom rows must be too.
    const hFrac = (y + innerHeight) / innerHeight;
    const cone = (BOTTOM_TAPER + (1 - BOTTOM_TAPER) * hFrac) * (innerWidth / 2);
    const reach = Math.max(0.12, cone - COIN_CLEAR) * taper;
    // Odd rows are staggered by half a coin so the packing does not line up in columns.
    const start = row % 2 ? -reach + SPACING_X / 2 : -reach;

    for (let xr = start; xr <= reach - (row % 2 ? SPACING_X / 2 : 0) + 1e-6; xr += SPACING_X) {
      for (const lane of LANES) {
        coins.push({
          x: xr + (rand() - 0.5) * 0.07,
          y: y + (rand() - 0.5) * 0.035,
          z: lane + (rand() - 0.5) * 0.05,
          a: rand() * Math.PI * 2,
          tiltX: (rand() - 0.5) * 0.5,
          tiltY: (rand() - 0.5) * 0.5,
        });
      }
    }
  }

  return coins;
}
