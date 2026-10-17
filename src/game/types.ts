/** Level schema and shared value types. All coordinates are in "quay units":
 *  10 wide, 18 tall, origin at the centre of the play field. The physics layer
 *  scales these to pixels (see PX in physics/world.ts). */

export interface Vec2 {
  x: number;
  y: number;
}

export interface PinDef {
  id: string;
  /** Centre of the rod, in quay units. */
  x: number;
  y: number;
  /** Radians. 0 is horizontal, positive is counter-clockwise on screen. */
  angle: number;
  /** Full rod length in quay units. */
  length: number;
}

/** Static rectangle, used for hopper overlays, deflectors and set pieces. */
export interface WallDef {
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
}

export interface HopperDef {
  /** Vertical axis the cavity profile is revolved about. */
  x: number;
  /** Cavity silhouette as [radius, y] pairs, bottom to top. */
  profile: Array<[number, number]>;
}

export interface JarDef {
  x: number;
  /** Y of the jar mouth (the rim). */
  y: number;
  width: number;
  height: number;
}

export interface LevelDef {
  id: string;
  name: string;
  hint: string;
  /** Coins spawned into the hopper. */
  coins: number;
  /** Fraction of coins that must reach the jar to win, 0..1. */
  target: number;
  hopper: HopperDef;
  pins: PinDef[];
  jar: JarDef;
  /** Extra static walls: deflectors, lips, guides. */
  extraWalls?: WallDef[];
  /** Pin ids that solve the level. Used by the headless test only. */
  solution: string[];
  /** Target duration in seconds, for tuning notes. */
  par: number;
}
