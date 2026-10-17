# Lantern Quay — handoff

Original mobile puzzle game. Pull pins, let the gold fall into the glass, keep the loft lit.
Reference analysis lives in `docs/REFERENCE_NOTES.md`; this file is the build state.

**Milestone 1 status: complete.** M2 (room + restoration), M3 (levels 4–10, hazards, stars),
M4 (polish, tutorial, settings), M5 (Capacitor APK, Play Billing) not started.

---

## What exists

- Vite + TypeScript (strict) + Three.js 0.186.1 + matter-js 0.20.0, all pinned.
- `src/physics/` is pure matter-js with no Three imports, so it runs headless in Node.
- Hopper: coral opaque clearcoat shell, half-revolved lathe (back half only) so the gold
  stays visible. Interior light + additive glow sprite stand in for bloom.
- Pin rods: mint capsule + pale head, tap target wider than the visual, flick-away
  animation with a tapered streak and fade.
- Coins: one `InstancedMesh`, 250 capacity, 48 tris each; depth-staggered by index.
- Jar: glass shell + a progressive pile of instanced coins that fills with progress.
- Sparkles: pooled additive points, one burst per coin that lands.
- HUD: level chip, ticking coin counter with pop, mute toggle; banner for level hints.
- Win/lose: 80–85% target per level, 0.7 s grace after the last coin resolves, 6 s stall
  loss when no pins remain and nothing is moving. Stars 3/2/1 at 95%/85%/below.
- 3 playable levels as JSON, difficulty by pin count + decoys + target.
- WebAudio only: pin whoosh, coin clink that rises with combo, win arpeggio, lose slidown,
  quiet room hum. Mute persists.
- Save: versioned `localStorage`, guarded against private-mode throws; best stars per level.
- PWA: manifest, SVG icon, service worker (network-first navigations, cache-first assets).
- GitHub Actions: Pages build + deploy (typecheck, test, build). Capacitor APK is a stub
  that intentionally does nothing yet.

## Verification

Run these, all green at the end of M1:

```
npm run typecheck     # tsc --noEmit, strict
npm test              # headless play-test of every level (see below)
npm run build         # vite build -> dist/
```

`npm test` is the important one. It builds each level in matter-js with no browser and
asserts: the bowl holds every authored coin, no coin leaks past the mesh at rest, the
authored solution reaches the target, decoy pins alone do **not** win, and the rules layer
ends the level with stars. Current numbers:

| Level | Spawned | Solution | Decoys alone | Drain |
|---|---|---|---|---|
| 01-first-pour | 60/60 | 98% (needs 80%) | – | 4.4 s |
| 02-two-halves | 72/72 | 100% (needs 85%) | 0% | 5.3 s |
| 03-narrow-neck | 90/90 | 98% (needs 85%) | 0% | 5.7 s |

**Not verified:** no browser was available, so nothing in `src/render/`, `src/ui/` or
`src/audio/` has been run. Those layers typecheck and bundle, and the dev server serves
them, but the first real render, the tap-to-pin raycast and all audio are unconfirmed.
Check those on a phone before trusting Milestone 1.

## Known gaps and deliberate deviations

1. **Pour rate is ~13–16 coins/s; the reference is ~6/s.** Matching it exactly needs a
   mouth under ~3 coin diameters, which jams in matter-js. Pacing instead comes from
   sequential pin pulls. Revisit if levels feel too short.
2. **Parallel rods, not the reference's diamond mesh.** Crossing rods create coin-leak
   paths with no way to guarantee a tight weave; parallel rods give exact, learnable flow
   control (each pull roughly doubles the gap). Bead trim on the shell edges is kept.
3. **Stars come from coins only.** The prompt asks for pin-efficiency weighting; that
   lands with hazards in M3, otherwise a one-pin level could never earn three stars.
4. **Counter sits in the HUD chip, not beside the jar** as in the reference. The projected
   screen position of the jar varies with safe-area and aspect; the chip is always legible.
   Worth moving in M4 once the camera framing is final.
5. **Decoy pins are mounted on the shell's outer face.** Any pin inside the throat either
   blocks or throttles the flow, which makes it a gate rather than a decoy.
6. Room is a flat-shaded box placeholder with no restoration states; that is M2. It has a
   loft, bed, ladder, window, shelves, column, pipe, cats and both characters, all boxes.
7. Bundle is 665 kB / 174 kB gzip, mostly Three. Fine over the wire for now; split the
   vendor chunk if first paint on 3G matters.
8. `settle()` sometimes runs its full 400-step cap before starting a level (coins never
   fully stop jittering in matter). Cosmetic: the sim pauses for nothing.

## File map

```
index.html                  app shell, HUD and overlay markup
vite.config.ts              relative base (Pages), port 3000, host allowlist from env
tsconfig.json               strict, allowImportingTsExtensions (physics runs in Node)
src/main.ts                 bootstrap, level lifecycle, rAF loop, input, save/audio wiring
src/game/types.ts           level schema (quay units, 10x18, y-up)
src/game/levels.ts          JSON loading + structural validation
src/game/session.ts         rules: win ratio, star tiers, stall loss
src/physics/profile.ts      cavity profile -> mirrored wall colliders (shared with render)
src/physics/world.ts        matter world: statics, pins, coins, jar, collection, events
src/render/scene.ts         renderer, camera fit, lights, glow texture helper
src/render/room.ts          placeholder loft set + characters + cats
src/render/hopper.ts        half-revolved shell, inner skin, lip, interior light, glow
src/render/pins.ts          pin meshes, flick-away animation, raycast pick
src/render/coins.ts         instanced coin field, jar + fill pile, sparkle pool
src/audio/audio.ts          synthesized SFX and ambience
src/ui/ui.ts                HUD, banner, overlay
src/ui/styles.css           theme, safe-area padding, pop animation
src/save/save.ts            versioned localStorage with try/catch
src/levels/*.json           level data (pins, profile, jar, target, solution)
tests/physics.test.ts       headless play-test of all levels + rules layer
public/manifest.webmanifest PWA manifest
public/sw.js                service worker
public/icon.svg             app icon
.github/workflows/pages.yml        build + deploy to GitHub Pages
.github/workflows/android-apk.yml  Capacitor stub, does nothing yet
docs/REFERENCE_NOTES.md     frame-by-frame analysis of the reference ad
```

## Physics constants worth knowing

- `PX = 100` — quay units to matter pixels. Matter wants bodies in the tens of pixels.
- `COIN_R = 0.17`, `PIN_COLLIDER_T = 0.11` — pins are ~2x thicker than the visual rod so
  fast coins cannot tunnel. Do not thin this.
- `GRAVITY = 0.55` (gravity is negative y; levels are y-up, matter is y-down).
- Fixed step 1/120 s, up to 5 substeps per frame, velocity clamped to 28 px/step.
- Coin `slop: 0.05`: matter's default. A larger slop lets coins overlap and wedge into
  arches that no pulled pin can break — this cost an hour, do not "improve" it.
- Lost gold is measured from the jar rim (`jarTop - 0.9`), not the floor, so the live body
  count cannot creep upward when a coin misses.

## Next (M2)

Build the real cutaway room and the restoration states from `REFERENCE_NOTES.md` §6:
amber-cream wall with blue feather wallpaper, pink blanket with gold trim, warm window,
and the 3 prop items. Add the coin-snake purchase effect and the single-coin sunburst
(§5) — that sequence is the most valuable thing in the reference and it is not built yet.
