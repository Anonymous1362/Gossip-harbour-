import type { LevelDef } from './types.ts';
import { Session } from './session.ts';

/** Called whenever a level becomes live, so the renderer can swap its meshes. */
export type MountLevel = (level: LevelDef, index: number, session: Session) => void;

/**
 * Owns which level is live and the session behind it. Keeping the index maths here
 * (rather than inline in main.ts) is what makes "Retry restarts, Next advances"
 * testable in Node, without a canvas or a DOM.
 */
export class LevelFlow {
  readonly levels: readonly LevelDef[];
  private readonly mount: MountLevel;
  private index = 0;
  private current: Session;

  constructor(levels: readonly LevelDef[], mount: MountLevel) {
    if (levels.length === 0) throw new Error('LevelFlow needs at least one level');
    this.levels = levels;
    this.mount = mount;
    // Boot straight into level 1, exactly like the original startLevel(0).
    this.current = this.build(0);
  }

  get currentIndex(): number {
    return this.index;
  }

  get level(): LevelDef {
    return this.levels[this.index];
  }

  get session(): Session {
    return this.current;
  }

  get isLast(): boolean {
    return this.index === this.levels.length - 1;
  }

  /** Same level, brand new session. */
  retry(): Session {
    return this.build(this.index);
  }

  /** Next level, wrapping back to the first one after the last. */
  next(): Session {
    return this.build(this.index + 1);
  }

  private build(index: number): Session {
    const n = this.levels.length;
    this.index = ((index % n) + n) % n;
    const level = this.levels[this.index];
    this.current = new Session(level);
    this.mount(level, this.index, this.current);
    return this.current;
  }
}
