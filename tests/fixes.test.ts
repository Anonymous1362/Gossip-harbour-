import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEVELS } from '../src/game/levels.ts';
import { pinRods } from '../src/game/pinGeometry.ts';
import { radiusAt } from '../src/physics/profile.ts';
import { PhysicsWorld } from '../src/physics/world.ts';
import { pileLayout } from '../src/render/pile.ts';
import { COIN_LOOK, createCoinMaterials } from '../src/render/coinMaterial.ts';
import { createPins } from '../src/render/pins.ts';
import { createCoinField } from '../src/render/coins.ts';

/**
 * Regression suite for the four visual/plumbing bugs reported from the phone:
 *  1. pins floating in mid-air instead of mounted through the shell;
 *  2. the jar pile settling into four rigid columns;
 *  3. fallen coins rendering dark brown while hopper coins stay gold;
 *  4. the service worker serving a stale build.
 *
 * Everything here is headless: pin geometry is pure maths, the pile layout is pure
 * maths, and the shader-free coin look is a material definition. The worker and build
 * stamping are checked as source text, with `scripts/verify-build.mjs` checking the
 * real dist/ output during `npm run build`.
 */

let failures = 0;

function check(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL ${name}\n     ${(err as Error).message.split('\n')[0]}`);
  }
}

const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const viteConfig = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
const coinsSource = readFileSync(new URL('../src/render/coins.ts', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  scripts: Record<string, string>;
};

function insideCavity(levelId: string, p: { x: number; y: number }): boolean {
  const level = LEVELS.find((l) => l.id === levelId);
  assert.ok(level, `no level ${levelId}`);
  return Math.abs(p.x - level.hopper.x) < radiusAt(level.hopper.profile, p.y);
}

/* --------------------------------------------------------------- 1. pins -- */

for (const level of LEVELS) {
  for (const pin of level.pins) {
    check(`${level.id}/${pin.id}: mounted through the shell, not floating`, () => {
      const rod = pinRods(level).find((r) => r.id === pin.id);
      assert.ok(rod, 'no derived rod');

      // Every rod crosses the glass at least once, and every crossing gets a socket.
      assert.ok(rod.sockets.length >= 1, 'rod never passes through the shell');
      assert.ok(rod.heads.length >= 1, 'rod has no end outside the shell (it hangs in space)');

      const axis = level.hopper.x;
      for (const s of rod.sockets) {
        const r = radiusAt(level.hopper.profile, s.y);
        assert.ok(
          Math.abs(Math.abs(s.x - axis) - r) < 0.02,
          `socket at ${s.x.toFixed(2)} is ${Math.abs(Math.abs(s.x - axis) - r).toFixed(3)} from the shell`,
        );
      }

      for (const h of rod.heads) {
        const r = radiusAt(level.hopper.profile, h.y);
        assert.ok(
          Math.abs(h.x - axis) > r + 0.05,
          'a head is not outside the shell',
        );
      }

      // The rod actually reaches into the glass, or is a through-rod (two crossings).
      const startIn = insideCavity(level.id, rod.start);
      const endIn = insideCavity(level.id, rod.end);
      assert.ok(startIn || endIn || rod.sockets.length >= 2, 'rod does not enter the cavity');

      assert.ok(rod.length > 0.2 && Number.isFinite(rod.length), 'degenerate rod');
      const length = Math.hypot(rod.end.x - rod.start.x, rod.end.y - rod.start.y);
      assert.ok(Math.abs(length - rod.length) < 1e-9, 'length does not match the endpoints');
    });
  }
}

check('the pin scene graph is built from the same rods', () => {
  for (const level of LEVELS) {
    const rods = pinRods(level);
    const view = createPins(level);
    assert.equal(view.group.children.length, level.pins.length, `${level.id}: wrong pin count`);
    view.group.children.forEach((g, i) => {
      const rod = rods[i];
      assert.ok(Math.abs(g.position.x - rod.center.x) < 1e-6, 'pin mesh is not on its rod');
      assert.ok(Math.abs(g.position.y - rod.center.y) < 1e-6, 'pin mesh is not on its rod');
      // rod + head(s) + socket cap and washer per crossing + hit box
      const meshes = g.children.filter((c) => (c as { type?: string }).type === 'Mesh');
      assert.ok(
        meshes.length >= 2 + rod.heads.length + rod.sockets.length * 2,
        `${level.id}/${rod.id}: ${meshes.length} meshes, expected sockets and heads`,
      );
    });
    view.dispose();
  }
});

check('the coin field draws a face and a rim for every coin', () => {
  const field = createCoinField();
  field.update([
    { x: 0, y: 1, a: 0 },
    { x: 0.2, y: 0.5, a: 1 },
    { x: -0.1, y: -1, a: 2 },
  ]);
  const [face, rim] = field.group.children as Array<{ count: number }>;
  assert.equal(face.count, 3);
  assert.equal(rim.count, 3, 'rim ring is missing from the fall');
  field.dispose();
});

check('physics colliders are the drawn rods', () => {
  for (const level of LEVELS) {
    const world = new PhysicsWorld(level);
    for (const rod of pinRods(level)) {
      const body = world.pinTransform(rod.id);
      assert.ok(body, `no collider for ${rod.id}`);
      assert.ok(Math.abs(body.x - rod.center.x) < 1e-6, `${level.id}/${rod.id} x drift`);
      assert.ok(Math.abs(body.y - rod.center.y) < 1e-6, `${level.id}/${rod.id} y drift`);
      assert.ok(Math.abs(body.angle - rod.angle) < 1e-6, `${level.id}/${rod.id} angle drift`);
    }
  }
});

/* ---------------------------------------------------------------- 2. jar -- */

check('jar collider is the authored width, not narrowed by its walls', () => {
  for (const level of LEVELS) {
    const world = new PhysicsWorld(level);
    const expected = level.jar.width * 100; // PX
    assert.ok(
      Math.abs(world.jarInnerWidth - expected) < 0.6,
      `${level.id}: inner width ${world.jarInnerWidth.toFixed(1)} != ${expected}`,
    );
  }
});

check('the pile is deterministic and fills bottom-up', () => {
  const a = pileLayout(2.1, 1.7);
  const b = pileLayout(2.1, 1.7);
  assert.deepEqual(a, b, 'two layouts of the same jar differ (it must not flicker)');
  assert.ok(a.length >= 60, `only ${a.length} coins fit the pile`);

  let prev = Number.NEGATIVE_INFINITY;
  for (const c of a) {
    assert.ok(c.y >= prev - 0.06, 'coins are not ordered bottom-up');
    prev = c.y;
  }
});

check('the pile is packed, not four rigid columns', () => {
  const pile = pileLayout(2.1, 1.7);
  const xs = new Set(pile.map((c) => c.x.toFixed(2)));
  const angles = new Set(pile.map((c) => c.a.toFixed(2)));
  assert.ok(xs.size >= 18, `only ${xs.size} distinct x positions: still a column grid`);
  assert.ok(angles.size >= 40, `only ${angles.size} distinct spins: coins look stamped`);

  for (const c of pile) {
    assert.ok(Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.a));
    assert.ok(Math.abs(c.tiltX) <= 0.3 && Math.abs(c.tiltY) <= 0.3, 'tilt is not slight');
    assert.ok(Math.abs(c.z) <= 0.3, 'coin is outside the glass depth');
  }
});

check('the pile fits inside the tapered glass', () => {
  for (const level of LEVELS) {
    const pile = pileLayout(level.jar.width, level.jar.height);
    const topR = level.jar.width / 2;
    const coinR = 0.17;
    for (const c of pile) {
      const t = (c.y + level.jar.height) / level.jar.height; // 0 floor, 1 mouth
      const glassR = (0.82 + 0.18 * Math.min(1, Math.max(0, t))) * topR;
      assert.ok(
        Math.abs(c.x) + coinR <= glassR + 1e-6,
        `coin at x=${c.x.toFixed(2)} pokes through the glass (r=${glassR.toFixed(2)})`,
      );
      assert.ok(c.y <= -0.1 && c.y - coinR >= -level.jar.height - 1e-6, `coin y ${c.y.toFixed(2)} outside the jar`);
    }
  }
});

check('the old four-column pile code is gone', () => {
  assert.ok(!/spanX \/ 3/.test(coinsSource), 'coins.ts still lays out four fixed columns');
  assert.ok(!/for \(let iz = 0; iz < 3/.test(coinsSource), 'coins.ts still has the 4x3 slot grid');
  assert.ok(coinsSource.includes('pileLayout'), 'the jar does not use the pile layout');
});

/* -------------------------------------------------------------- 3. coins -- */

check('every coin uses one bright gold material with a rim', () => {
  const mats = createCoinMaterials();
  const hex = (c: { getHexString(): string }) => c.getHexString().toLowerCase();
  assert.equal(hex(mats.face.color), COIN_LOOK.color.slice(1));
  assert.equal(hex(mats.face.emissive), COIN_LOOK.emissive.slice(1));
  assert.ok(
    mats.face.emissiveIntensity >= 0.9,
    `emissive ${mats.face.emissiveIntensity} is too dim to survive the unlit fall`,
  );
  // The dark-brown bug came from near-full metalness: with no env map, metal reflects
  // nothing and only the (brown) emissive was left.
  assert.ok(mats.face.metalness <= 0.6, `metalness ${mats.face.metalness} will go black in shadow`);
  assert.ok(mats.rim && mats.rim.opacity > 0.5, 'no visible rim highlight');
  assert.ok(!hex(mats.face.emissive).startsWith('5a3a00'), 'the old brown emissive is back');
});

check('the fall and the jar pile share that material', () => {
  const calls = coinsSource.match(/createCoinMaterials\(\)/g) ?? [];
  assert.ok(calls.length >= 1, 'coins.ts does not use the shared coin material');
  assert.ok(coinsSource.includes('makeCoinInstances'), 'the fall and pile are built separately');
  for (const old of ['#ffc531', '#7a4c00', '#5a3a00']) {
    assert.ok(!coinsSource.includes(old), `coins.ts still hard-codes ${old}`);
  }
});

/* -------------------------------------------------------- 4. stale build -- */

check('the service worker cache is versioned per build', () => {
  assert.ok(/const BUILD = '__BUILD__'/.test(sw), 'no build placeholder in sw.js');
  assert.ok(sw.includes('lantern-quay-${BUILD}'), 'cache name is not per-build');
  assert.ok(!/lantern-quay-v\d/.test(sw), 'a fixed cache version is back');
});

check('the worker takes over immediately and bypasses the HTTP cache', () => {
  assert.ok(sw.includes('skipWaiting'), 'no skipWaiting');
  assert.ok(sw.includes('clients.claim'), 'no clients.claim');
  assert.ok(sw.includes('caches.delete'), 'old caches are never deleted');
  assert.ok(sw.includes("cache: 'no-store'"), 'navigations can still be served stale');
  assert.ok(sw.includes("type === 'SKIP_WAITING'"), 'no way to promote a waiting worker');
});

check('the build id is stamped into the page and the worker', () => {
  assert.ok(viteConfig.includes('__BUILD_ID__'), 'vite does not stamp the badge');
  assert.ok(viteConfig.includes('__BUILD__'), 'vite does not stamp the worker');
  assert.ok(viteConfig.includes('GITHUB_SHA'), 'CI builds are not identified by commit');
  assert.ok(pkg.scripts.build.includes('scripts/verify-build.mjs'), 'the build is not verified');
  assert.ok(html.includes('id="build"'), 'index.html has no build badge');
  assert.ok(html.includes('__BUILD_ID__'), 'the badge has no placeholder to stamp');
});

check('the build badge sits in a corner without eating taps', () => {
  const rule = css.match(/\.build\s*\{([^}]*)\}/);
  assert.ok(rule, 'missing .build rule');
  const body = rule[1];
  assert.ok(/position\s*:\s*(absolute|fixed)/.test(body), 'badge is not positioned');
  assert.ok(/left\s*:/.test(body) && /bottom\s*:/.test(body), 'badge is not in a corner');
  assert.ok(/pointer-events\s*:\s*none/.test(body), 'badge would swallow taps');
  const z = Number.parseFloat((body.match(/z-index\s*:\s*(\d+)/) ?? [])[1] ?? 'NaN');
  assert.ok(Number.isFinite(z) && z < 40, `badge z ${z} would sit on top of the win panel`);
});

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nall fix checks passed');
