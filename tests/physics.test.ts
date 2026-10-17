import assert from 'node:assert/strict';
import { LEVELS } from '../src/game/levels.ts';
import { Session } from '../src/game/session.ts';
import { PhysicsWorld } from '../src/physics/world.ts';
import type { LevelDef } from '../src/game/types.ts';

interface Result {
  level: LevelDef;
  spawned: number;
  jarAtRest: number;
  jarAfter: number;
  lostAfter: number;
  seconds: number;
  drainMaxSpeed: number;
  halfSeconds: number;
  stuck: number;
}

function play(level: LevelDef, pullIds: string[], seconds = 90): Result {
  const world = new PhysicsWorld(level);
  world.settle();
  const jarAtRest = world.coinsInJar;

  for (const id of pullIds) {
    assert.equal(world.pullPin(id), true, `${level.id}: pin "${id}" does not exist`);
  }

  let steps = 0;
  let halfSeconds = -1;
  const half = world.total * 0.5;
  const limit = Math.round(seconds * 60);
  while (steps < limit) {
    world.step(1 / 60);
    steps++;
    if (halfSeconds < 0 && world.coinsInJar >= half) halfSeconds = steps / 60;
    const drained = world.coinsInJar + world.coinsLost >= world.total;
    if (drained && world.isQuiet()) break;
  }

  return {
    level,
    spawned: world.spawned,
    jarAtRest,
    jarAfter: world.coinsInJar,
    lostAfter: world.coinsLost,
    seconds: steps / 60,
    drainMaxSpeed: Math.round(world.maxSpeed() * 100) / 100,
    halfSeconds,
    stuck: world.coinTransforms().length,
  };
}

let failures = 0;

for (const level of LEVELS) {
  const seeded = new PhysicsWorld(level);
  const settleSteps = seeded.settle();
  const spawnLine = `${level.id.padEnd(16)} spawned ${String(seeded.spawned).padStart(3)}/${level.coins}` +
    `  settle ${String(settleSteps).padStart(3)} steps` +
    `  at-rest leak ${seeded.coinsInJar}`;

  if (seeded.spawned !== level.coins) {
    failures++;
    console.error(`FAIL ${spawnLine}  -> bowl cannot hold ${level.coins} coins`);
    continue;
  }
  if (seeded.coinsInJar !== 0) {
    failures++;
    console.error(`FAIL ${spawnLine}  -> coins leak through the pin mesh at rest`);
    continue;
  }
  console.log(`ok   ${spawnLine}`);

  // Intended solution must reach the target.
  const win = play(level, level.solution);
  const ratio = win.jarAfter / win.spawned;
  const ok = ratio >= level.target - 1e-9 && win.seconds < 90;
  console.log(
    `     win  jar ${String(win.jarAfter).padStart(3)}/${win.spawned}` +
      `  (${(ratio * 100).toFixed(0)}%, needs ${(level.target * 100).toFixed(0)}%)` +
      `  lost ${String(win.lostAfter).padStart(2)}  drained in ${win.seconds.toFixed(1)}s` +
      `  half ${win.halfSeconds.toFixed(1)}s  stuck ${win.stuck}` +
      `  (${(win.spawned / Math.max(win.seconds, 0.01)).toFixed(1)}/s)`,
  );
  if (!ok) {
    failures++;
    console.error(
      `FAIL ${level.id}: solution drains to ${(ratio * 100).toFixed(0)}% in ${win.seconds.toFixed(1)}s`,
    );
  }

  // A level whose decoy pins also win has no decision in it.
  const decoys = level.pins.map((p) => p.id).filter((id) => !level.solution.includes(id));
  if (decoys.length > 0) {
    const cheat = play(level, decoys);
    const cheatRatio = cheat.jarAfter / cheat.spawned;
    const pass = cheatRatio < level.target;
    console.log(
      `     decoy ${decoys.join(',')} -> ${(cheatRatio * 100).toFixed(0)}%` +
        `${pass ? ' (correctly loses)' : ' (ALSO WINS)'}`,
    );
    if (!pass) failures++;
  }
}

// Rules layer: the same solution must actually end the level, with stars.
for (const level of LEVELS) {
  const s = new Session(level);
  for (const id of level.solution) s.pull(id);
  for (let i = 0; i < 60 * 40 && !s.finished; i++) s.update(1 / 60);
  const ok = s.phase === 'won' && s.stars >= 1;
  console.log(
    `     rules ${level.id.padEnd(16)} phase=${s.phase} stars=${s.stars}` +
      ` ratio=${(s.ratio * 100).toFixed(0)}%${ok ? '' : '  <-- expected a win'}`,
  );
  if (!ok) failures++;
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nall physics checks passed');
