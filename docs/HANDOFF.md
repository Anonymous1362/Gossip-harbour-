# Lantern Quay — handoff

Original mobile puzzle game. Pull pins, let the gold fall into the glass, keep the loft lit.
Reference analysis lives in `docs/REFERENCE_NOTES.md`; this file is the build state.

**Milestone 1 status: complete, plus the phone bug pass.** M2 (room + restoration), M3
(levels 4–10, hazards, stars), M4 (polish, tutorial, settings), M5 (Capacitor APK, Play
Billing) not started.

---

## What exists

- Vite + TypeScript (strict) + Three.js 0.186.1 + matter-js 0.20.0, all pinned.
- `src/physics/` is pure matter-js with no Three imports, so it runs headless in Node.
- Hopper: coral opaque clearcoat shell, half-revolved lathe (back half only) so the gold
  stays visible. Interior light + additive glow sprite stand in for bloom.
- Pins: rods derived by `src/game/pinGeometry.ts`, the single source of truth for both the
  mesh and the matter collider. Every rod is mounted *through* the shell: a socket cap and
  washer at each crossing, a ball head on the outside end. A rod fully inside the glass is
  driven out through the nearest wall; an all-outside decoy stub is driven in through the
  wall by 5 cm. Nothing floats. Gate rods are stacked 12 cm apart in y so they read as a
  lattice instead of one bar.
- Coins: one shared look (`src/render/coinMaterial.ts`) used by the falling field and the
  jar pile: warm gold, metalness 0.45, bright gold emissive, plus an instanced unlit rim
  ring. Two instanced draw calls per view (face + rim), 250 capacity.
- Jar: glass shell + a progressive pile from `src/render/pile.ts` — staggered, jittered
  rows with random spin and slight tilt, tapered to the glass cone, filled bottom-up.
- Sparkles: pooled additive points, one burst per coin that lands.
- HUD: level chip, ticking coin counter with pop, mute toggle; banner for level hints;
  build id in the bottom-left corner.
- Win/lose: 80–85% target per level, 0.7 s grace after the last coin resolves, 6 s stall
  loss when no pins remain and nothing is moving. Stars 3/2/1 at 95%/85%/below.
- 3 playable levels as JSON, difficulty by pin count + decoys + target.
- WebAudio only: pin whoosh, coin clink that rises with combo, win arpeggio, lose slidown,
  quiet room hum. Mute persists.
- Save: versioned `localStorage`, guarded against private-mode throws; best stars per level.
- PWA: manifest, SVG icon, per-build service-worker cache with `skipWaiting()` and
  `clients.claim()`. Navigations bypass the HTTP cache (`no-store`); hashed assets are
  cache-first. The page reloads once when a new worker takes over.
- GitHub Actions: Pages build + deploy (typecheck, test, build). Capacitor APK is a stub
  that intentionally does nothing yet.

## Verification

Run these, all green at the end of the bug pass:

```
npm run typecheck     # tsc --noEmit, strict
npm test              # headless play-test + regression + fix suites
npm run build         # vite build -> dist/, then scripts/verify-build.mjs
```

`npm test` is the important one. It builds each level in matter-js with no browser and
asserts: the bowl holds every authored coin, no coin leaks past the mesh at rest, the
authored solution reaches the target, decoy pins alone do **not** win, and the rules layer
ends the level with stars.

| Level | Spawned | Solution | Decoys alone | Drain |
|---|---|---|---|---|
| 01-first-pour | 60/60 | 95% (needs 80%) | – | 5.2 s |
| 02-two-halves | 72/72 | 99% (needs 85%) | 0% | 5.3 s |
| 03-narrow-neck | 90/90 | 97% (needs 85%) | 0% | 6.4 s |

`tests/regression.test.ts` guards the first-play bug: the win panel painted over the board
on load with dead buttons. It asserts that no level resolves before a pin is pulled, that
the win threshold is always finite and inside (0, 1], that a bowl which spawns no coins
refuses to start, that every panel shipping `hidden` has a `[hidden]` display guard, that
the overlay sits above the HUD and takes its own taps, and that Next/Retry mount the right
level (via `LevelFlow`, exercised against a stub DOM).

`tests/fixes.test.ts` guards the phone bug pass:

- every pin's rod crosses the shell, every crossing has a socket on the surface, every rod
  has a head outside the shell, and the matter collider centre/angle match the drawn rod;
- the jar's collider is the authored width, the pile is deterministic and bottom-up, has
  many distinct x positions and spins (not four columns), and no coin pokes through the
  tapered glass;
- one bright gold material with a rim is shared by the fall and the pile;
- the worker's cache is versioned per build, takes over with `skipWaiting`/`clients.claim`,
  bypasses the HTTP cache for navigations, and the page carries a build badge.

The suite bites: reintroducing the old defects (no sockets, the brown emissive, a fixed
`lantern-quay-v1` cache) fails 11 checks.

The root cause of the first-play overlay was CSS, not logic: `.overlay { display: grid }`
outranks the browser's `[hidden] { display: none }`, so the panel was on screen from the
first frame with the title baked into `index.html`. Anything new that ships `hidden` must
not fight that rule.

**Not verified:** no browser was available, so nothing in `src/render/`, `src/ui/` or
`src/audio/` has been rendered or heard. Those layers typecheck, build their scene graphs
in Node, and pass the geometry/pile/stub-DOM checks, but the first real frame, the
tap-to-pin raycast and all audio are unconfirmed. Check those on a phone.

## Build identity

`vite.config.ts` stamps one id per build (commit SHA on CI, `devxxxx` locally) into
`dist/sw.js` (cache name and `BUILD`) and into the `#build` badge in `dist/index.html`.
`scripts/verify-build.mjs` runs as part of `npm run build` and fails if the badge and the
worker disagree, if the worker still has `__BUILD__`, or if the takeover/cache-busting
calls are missing. If the corner shows the same id after a deploy, the worker is stale —
that is the bug this check exists to prevent.

## Known gaps and deliberate deviations

1. **Pour rate is ~11–14 coins/s; the reference is ~6/s.** Matching it exactly needs a
   mouth under ~3 coin diameters, which jams in matter-js. Pacing instead comes from
   sequential pin pulls. Revisit if levels feel too short.
2. **Parallel rods, not the reference's diamond mesh.** Crossing rods create coin-leak
   paths with no way to guarantee a tight weave; parallel rods give exact, learnable flow
   control. They are now offset in height so the lattice still reads.
3. **Stars come from coins only.** The prompt asks for pin-efficiency weighting; that
   lands with hazards in M3, otherwise a one-pin level could never earn three stars.
4. **Counter sits in the HUD chip, not beside the jar** as in the reference. The projected
   screen position of the jar varies with safe-area and aspect; the chip is always legible.
   Worth moving in M4 once the camera framing is final.
5. **Decoys are stubs inserted through the outer shoulder.** A pin inside the throat gates
   the flow, so a decoy must stop just inside the wall (5 cm) where coins can flow past.
   They still have a socket and a head, so they are mounted, not floating.
6. Room is a flat-shaded box placeholder with no restoration states; that is M2. It has a
   loft, bed, ladder, window, shelves, column, pipe, cats and both characters, all boxes.
7. Bundle is ~671 kB / 176 kB gzip, mostly Three. Fine over the wire for now; split the
   vendor chunk if first paint on 3G matters.
8. `settle()` often runs near its 400-step cap before starting a level (coins keep
   micro-jittering in matter). Cosmetic: the sim pauses for nothing.

## File map

```
index.html                  app shell, HUD, build badge, overlay markup
vite.config.ts              relative base (Pages), port 3000, build-id stamping
tsconfig.json               strict, allowImportingTsExtensions (physics runs in Node)
scripts/verify-build.mjs    post-build check: badge == worker build, takeover calls present
src/main.ts                 bootstrap, level lifecycle, rAF loop, input, save/audio/worker wiring
src/game/types.ts           level schema (quay units, 10x18, y-up)
src/game/levels.ts          JSON loading + structural validation
src/game/pinGeometry.ts     authored pin -> mounted rod (sockets, heads), shared with physics
src/game/session.ts         rules: win ratio, star tiers, stall loss, finish gates
src/game/flow.ts            level index + retry/next, so progression is testable
src/physics/profile.ts      cavity profile -> mirrored wall colliders (shared with render)
src/physics/world.ts        matter world: statics, pins, coins, jar, collection, events
src/render/scene.ts         renderer, camera fit, lights, glow texture helper
src/render/room.ts          placeholder loft set + characters + cats
src/render/hopper.ts        half-revolved shell, inner skin, lip, interior light, glow
src/render/pins.ts          rods, socket caps, heads, flick-away animation, raycast pick
src/render/coinMaterial.ts  the single gold look + face/rim geometry
src/render/pile.ts          pure jar-pile layout (staggered, jittered, tapered)
src/render/coins.ts         instanced fall field, jar + pile, sparkle pool
src/audio/audio.ts          synthesized SFX and ambience
src/ui/ui.ts                HUD, banner, overlay
src/ui/styles.css           theme, safe-area padding, pop animation, build badge
src/save/save.ts            versioned localStorage with try/catch
src/levels/*.json           level data (pins, profile, jar, target, solution)
public/manifest.webmanifest PWA manifest
public/sw.js                per-build service worker
public/icon.svg             app icon
tests/physics.test.ts       headless play-test of all levels + rules layer
tests/regression.test.ts    on-load overlay bug: finish gates, threshold, CSS, buttons
tests/fixes.test.ts         mounted pins, jar pile, coin look, worker versioning
.github/workflows/pages.yml        build + deploy to GitHub Pages
.github/workflows/android-apk.yml  Capacitor stub, does nothing yet
docs/REFERENCE_NOTES.md     frame-by-frame analysis of the reference ad
```

## Physics constants worth knowing

- `PX = 100` — quay units to matter pixels. Matter wants bodies in the tens of pixels.
- `COIN_R = 0.17`, `PIN_COLLIDER_T = 0.11` — pins are ~2.5x thicker than the visual rod so
  fast coins cannot tunnel. Do not thin this.
- `GRAVITY = 0.55` (gravity is negative y; levels are y-up, matter is y-down).
- Fixed step 1/120 s, up to 5 substeps per frame, velocity clamped to 28 px/step.
- Coin `slop: 0.05`: matter's default. A larger slop lets coins overlap and wedge into
  arches that no pulled pin can break — this cost an hour, do not "improve" it.
- Coin spawn uses a seeded PRNG (`mulberry32(seedFrom(level.id))`), so friction jitter and
  spin vary per coin but the play-test stays reproducible.
- Jar walls are `JAR_WALL_T = 0.045` thick and centred *outside* the inner face, so the
  usable width equals `jar.width` (the old walls ate 0.14 of it).
- Lost gold is measured from the jar rim (`jarTop - 0.9`), not the floor, so the live body
  count cannot creep upward when a coin misses.

## Next (M2)

Build the real cutaway room and the restoration states from `REFERENCE_NOTES.md` §6:
amber-cream wall with blue feather wallpaper, pink blanket with gold trim, warm window,
and the 3 prop items. Add the coin-snake purchase effect and the single-coin sunburst
(§5) — that sequence is the most valuable thing in the reference and it is not built yet.
