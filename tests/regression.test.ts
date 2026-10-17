import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEVELS } from '../src/game/levels.ts';
import { Session, resolveTarget } from '../src/game/session.ts';
import { LevelFlow } from '../src/game/flow.ts';
import type { LevelDef } from '../src/game/types.ts';
import * as uiModule from '../src/ui/ui.ts';

/**
 * Regression suite for the "Restored on load, 0 coins, buttons dead" bug.
 *
 * Two independent faults produced that screen:
 *  1. `.overlay { display: grid }` outranked the browser's `[hidden]` rule, so the
 *     win panel was painted from the first frame with the title baked into index.html.
 *  2. The rules layer could finish a level without the player ever pulling a pin, and
 *     an invalid target (0) made 0/0 coins count as a win.
 *
 * Everything here runs in plain Node: no DOM, no three.js.
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

/* ------------------------------------------------------------------ rules -- */

for (const level of LEVELS) {
  check(`${level.id}: no result before a pin is pulled`, () => {
    const s = new Session(level);
    assert.equal(s.phase, 'playing', 'level ended before it was played');
    assert.equal(s.collected, 0);
    assert.equal(s.total, level.coins, `total ${s.total} != authored ${level.coins}`);
    assert.ok(Number.isFinite(s.total) && s.total > 0, `total is ${s.total}`);
    assert.ok(Number.isFinite(s.ratio) && s.ratio === 0, `ratio is ${s.ratio}`);
    assert.equal(s.finished, false);

    // Five seconds of nothing: the gold settles, the level must not.
    for (let i = 0; i < 60 * 5; i++) s.update(1 / 60);
    assert.equal(s.phase, 'playing', `ended as "${s.phase}" with 0 pins pulled`);
  });
}

check('threshold is always a real number inside (0, 1]', () => {
  for (const bad of [0, -0.2, Number.NaN, Infinity, -Infinity]) {
    const t = resolveTarget(bad);
    assert.ok(Number.isFinite(t) && t > 0 && t <= 1, `resolveTarget(${bad}) -> ${t}`);
  }
  for (const level of LEVELS) assert.equal(resolveTarget(level.target), level.target);
});

for (const target of [0, -0.2, Number.NaN, Infinity]) {
  check(`target ${target}: cannot be won`, () => {
    const level: LevelDef = { ...LEVELS[0], target };
    const s = new Session(level);
    for (const id of level.solution) s.pull(id);
    for (let i = 0; i < 60 * 60 && !s.finished; i++) s.update(1 / 60);
    assert.notEqual(s.phase, 'won', 'an invalid target handed out a win');
    assert.ok(Number.isFinite(s.ratio), `ratio is ${s.ratio}`);
  });
}

check('a bowl that holds no gold refuses to start', () => {
  assert.throws(
    () => new Session({ ...LEVELS[0], coins: 0 }),
    /spawned no coins/,
    'a 0-coin level was allowed to run (0 of 0 is not a win)',
  );
});

/* ------------------------------------------------------------- overlay CSS -- */

interface Rule {
  selectors: string[];
  body: string;
}

function parseRules(source: string): Rule[] {
  const out: Rule[] = [];
  for (const m of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = m[1]
      .split(',')
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter((s) => s.length > 0);
    // Skip at-rule preludes and keyframe steps; only element rules matter here.
    if (selectors.some((s) => s.startsWith('@') || /^\d|^from$|^to$/.test(s))) continue;
    out.push({ selectors, body: m[2] });
  }
  return out;
}

function declaration(body: string, prop: string): string | null {
  const m = body.match(new RegExp(`(?:^|;|\\s)${prop}\\s*:\\s*([^;]+)`, 'i'));
  return m ? m[1].trim() : null;
}

function ruleFor(rules: Rule[], selector: string): Rule | undefined {
  return rules.find((r) => r.selectors.includes(selector));
}

const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
// Comments sit in front of selectors and would otherwise become part of them.
const rules = parseRules(css.replace(/\/\*[\s\S]*?\*\//g, ''));

check('every element that ships hidden has a display guard', () => {
  const hiddenTags = [...html.matchAll(/<[^>]*\shidden[\s>][^>]*>/g)].map((m) => m[0]);
  assert.ok(hiddenTags.length >= 3, `only ${hiddenTags.length} hidden elements found`);

  const forced = new Set<string>();
  for (const r of rules) {
    for (const sel of r.selectors) {
      const cls = sel.match(/^\.([A-Za-z0-9_-]+)$/);
      if (cls && declaration(r.body, 'display')) forced.add(cls[1]);
    }
  }

  const atRisk: string[] = [];
  for (const tag of hiddenTags) {
    const cls = tag.match(/class="([^"]*)"/);
    for (const name of cls ? cls[1].split(/\s+/) : []) {
      if (forced.has(name)) atRisk.push(name);
    }
  }
  assert.ok(atRisk.length > 0, 'test is stale: nothing sets display on a hidden element');

  const guard = rules.find(
    (r) =>
      r.selectors.includes('[hidden]') &&
      /display\s*:\s*none/.test(r.body) &&
      /!important/.test(r.body),
  );
  assert.ok(
    guard,
    `${[...new Set(atRisk)].join(', ')} set display and would beat [hidden]; ` +
      'need `[hidden] { display: none !important }`',
  );
});

check('the win panel is above the HUD and takes its own clicks', () => {
  const overlay = ruleFor(rules, '.overlay');
  assert.ok(overlay, 'missing .overlay rule');
  assert.equal(declaration(overlay.body, 'pointer-events'), 'auto', 'overlay must accept clicks');

  const overlayZ = Number.parseFloat(declaration(overlay.body, 'z-index') ?? 'NaN');
  const stage = ruleFor(rules, '#stage');
  const hud = ruleFor(rules, '.hud');
  assert.ok(Number.isFinite(overlayZ), 'overlay has no z-index');
  const stageZ = stage ? Number.parseFloat(declaration(stage.body, 'z-index') ?? '0') : 0;
  const hudZ = hud ? Number.parseFloat(declaration(hud.body, 'z-index') ?? 'NaN') : Number.NaN;
  assert.ok(Number.isFinite(hudZ), 'hud has no z-index');
  assert.ok(overlayZ > hudZ, `overlay z ${overlayZ} is not above hud z ${hudZ}`);
  assert.ok(overlayZ > stageZ, `overlay z ${overlayZ} is not above the canvas`);
});

/* ---------------------------------------------------------- retry / next -- */

check('retry restarts the same level', () => {
  const mounted: Array<{ id: string; index: number }> = [];
  const flow = new LevelFlow(LEVELS, (level, index) => mounted.push({ id: level.id, index }));
  assert.equal(flow.currentIndex, 0, 'flow did not start on level 1');
  assert.deepEqual(mounted, [{ id: LEVELS[0].id, index: 0 }], 'level 1 was never mounted');

  const first = flow.session;
  const again = flow.retry();
  assert.equal(flow.currentIndex, 0, 'retry advanced the level');
  assert.notEqual(again, first, 'retry reused the finished session');
  assert.equal(again.phase, 'playing');
  assert.equal(again.collected, 0);
  assert.equal(again.total, LEVELS[0].coins);
  assert.deepEqual(mounted.at(-1), { id: LEVELS[0].id, index: 0 }, 'retry remounted the wrong level');
});

check('next advances through every level and wraps', () => {
  const mounted: number[] = [];
  const flow = new LevelFlow(LEVELS, (_level, index) => mounted.push(index));
  const seen: number[] = [];
  for (let i = 0; i < LEVELS.length; i++) {
    flow.next();
    seen.push(flow.currentIndex);
  }
  assert.deepEqual(seen, LEVELS.map((_, i) => (i + 1) % LEVELS.length));
  assert.deepEqual(mounted, [0, 1, 2, 0], 'mount order is wrong');
  assert.equal(flow.session.phase, 'playing');
  assert.equal(flow.session.total, LEVELS[0].coins);
});

check('next gives a fresh session after a win', () => {
  const flow = new LevelFlow(LEVELS, () => {});
  const won = flow.session;
  for (const id of LEVELS[0].solution) won.pull(id);
  for (let i = 0; i < 60 * 40 && !won.finished; i++) won.update(1 / 60);
  assert.equal(won.phase, 'won', 'level 1 did not finish, cannot check next');

  const next = flow.next();
  assert.notEqual(next, won);
  assert.equal(next.phase, 'playing');
  assert.equal(next.collected, 0);
  assert.equal(flow.level.id, LEVELS[1].id);
});

/* ------------------------------------------------------------- overlay UI -- */
/* A stub DOM, just enough for createUI: the real bug was that the panel was on
   screen with no handler attached, so the wiring is what needs the exercise. */

class FakeElement {
  hidden = false;
  textContent = '';
  className = '';
  offsetWidth = 0;
  readonly children: FakeElement[] = [];
  readonly attrs = new Map<string, string>();
  private readonly listeners = new Map<string, Array<() => void>>();
  readonly classList = {
    add: (_c: string) => {},
    remove: (_c: string) => {},
    toggle: (_c: string, _on?: boolean) => {},
  };

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }

  appendChild(child: FakeElement): FakeElement {
    this.children.push(child);
    return child;
  }

  addEventListener(type: string, fn: () => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }

  click(): void {
    for (const fn of this.listeners.get('click') ?? []) fn();
  }
}

const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
const dom = new Map<string, FakeElement>(ids.map((id) => [id, new FakeElement()]));
// Mirror the markup: panels that ship hidden start hidden.
const shippedHidden = new Set(
  [...html.matchAll(/<[^>]*\sid="([^"]+)"[^>]*\shidden[\s>][^>]*>/g)].map((m) => m[1]),
);
for (const id of shippedHidden) {
  const node = dom.get(id);
  if (node) node.hidden = true;
}

const g = globalThis as unknown as Record<string, unknown>;
g.document = {
  getElementById: (id: string) => dom.get(id) ?? null,
  createElement: () => new FakeElement(),
};
g.window = { setTimeout: () => 0, clearTimeout: () => {} };

check('the win panel starts hidden and is only shown with live buttons', () => {
  const { createUI } = uiModule;
  const ui = createUI();
  const overlay = dom.get('overlay')!;
  const primary = dom.get('primary')!;
  const secondary = dom.get('secondary')!;
  const title = dom.get('overlay-title')!;

  assert.equal(overlay.hidden, true, 'panel is visible before any level has ended');

  let next = 0;
  let retry = 0;
  ui.showOverlay({
    title: 'Restored',
    detail: '60 of 60 coins in the glass (100%).',
    stars: 3,
    primary: 'Next level',
    onPrimary: () => next++,
    secondary: 'Retry',
    onSecondary: () => retry++,
  });
  assert.equal(overlay.hidden, false);
  assert.equal(title.textContent, 'Restored');
  assert.equal(primary.textContent, 'Next level');

  primary.click();
  assert.equal(next, 1, 'Next did nothing');
  assert.equal(overlay.hidden, true, 'Next left the panel up');

  ui.showOverlay({
    title: 'Restored',
    detail: '',
    stars: 3,
    primary: 'Next level',
    onPrimary: () => next++,
    secondary: 'Retry',
    onSecondary: () => retry++,
  });
  secondary.click();
  assert.equal(retry, 1, 'Retry did nothing');
  assert.equal(overlay.hidden, true, 'Retry left the panel up');

  // Handlers are one-shot and cleared on close, so a stale one can never fire twice.
  primary.click();
  secondary.click();
  assert.equal(next, 1, 'a stale Next fired');
  assert.equal(retry, 1, 'a stale Retry fired');
});

check('a win with no second action hides the Retry button', () => {
  const { createUI } = uiModule;
  const ui = createUI();
  const secondary = dom.get('secondary')!;
  ui.showOverlay({
    title: 'Short of the mark',
    detail: 'Only 40% of the gold reached the glass.',
    stars: 0,
    primary: 'Retry',
    onPrimary: () => {},
  });
  assert.equal(secondary.hidden, true, 'Retry is offered without a handler');
});

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nall regression checks passed');
