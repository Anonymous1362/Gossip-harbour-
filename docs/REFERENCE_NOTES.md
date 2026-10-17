# Reference notes — frame analysis (complete set)

Source material: `FREEBUFF_PROMPT-1.md`, `AD_FRAMES_TIMELINE.md`, and the clean frame
sheets `ad_frames_clean_1..5.jpg` (3 columns, 1 frame/s, labelled `t=Ns`) plus the motion
sheets `ad_motion_1..6.jpg` (4 columns, 10 fps, labelled `t=N.Ns`).
Purpose: mood, pacing and mechanics reference only. No names, characters, logos or art
are copied. This file records **where the actual frames disagree with the prose docs**, so
the build follows the picture.

Status: **complete** — all 5 clean sheets (t=0 s → t=51 s) and all 6 motion sheets
(t=11.0–15.9 s and t=40.0–45.9 s) analysed.

---

## 1. Measured structure

| Beat | Frames | Duration |
|---|---|---|
| Cold open: macro hand holding a thin dark pin-like object | t=0 | 1 s |
| Snow hook: ruined red-brick wall, woman in red coat + white fur hood with a full sack, cart with a slumped green-capped man, item bubbles | t=1–3 | 3 s |
| Room reveal: dark brick two-level cutaway, hopper materialises from a grid of glowing orange squares, then item bubbles | t=4–8 | 5 s |
| Core loop: hopper pours, pins pulled, jar fills, counter climbs 0 → 100 | t=9–38 | 30 s |
| Build menu: cream card strip on the right, then the purchase FX chain | t=39–42.9 | ~4 s |
| Purchase FX: card flash → coin snake → collapse → sunburst | t=42.5–44.1 | 1.6 s |
| Restore sweep: gold filigree wash, palette flips | t=45.0–45.4 | 0.4 s |
| Sparkle hold + tap-hint cycle over the 3 remaining items | t=45.4–51 | ~5.6 s |
| **Total** | | **~51 s** (prompt says ~55 s) |

Core loop is ~58% of runtime. Hook 4 s, purchase+pay-off 10 s. That ratio is the thing to copy.

## 2. Coin counter, frame by frame (hard numbers)

`0, 2, 6, 10, 15, 15, 17, 25, 31, 31, 40, 49, 56, 58, 67, 70, 75, 81, 86, 92, 97, 100`

- Counter is **absent until the first coin physically lands**, then appears reading `0`
  (t=15.2) and ticks. It scores arrivals, not spawns.
- Two **plateaus**: `15` held a full second (t=19–20), `56→58` (t=27–28). Coins stall while
  a pin still blocks them, then leap once the next pin goes. Reproduce as a brief clog
  before each new pin, never a dead stop longer than ~2 s.
- Flow rate roughly doubles: ~3.9 coins/s (t=15–23) → ~6 coins/s (t=24–35).
- `100` reached at t=36 and holds while the hopper drains (t=36–38). The level ends because
  the **hopper is empty** — jar fill is the target, the jar never overflows.
- Prompt §1's list (10, 17, 40, 68, 86, 100) is a sampled subset, not the real series.

## 3. Pin-pull kinematics (motion 1–3)

- At rest the gold already trickles down the neck and **sits in the lattice** — the hopper is
  pre-fed, coins are visible and held for seconds before scoring.
- First pin pulls at **t=12.5 s**. It exits **up and to the left, along its own axis**, pale
  round head trailing, bright teal rod with a tapered streak. Clears frame in ~0.3–0.4 s,
  streak fades over ~1 s, 1–2 frame green spark left at the slot. Direction is screen-up-left
  regardless of the slot, so it reads as "flicked away", not "extracted".
- Gold leaves the neck single-file, fans over the remaining mesh, exits the **lower right** of
  the hopper and arcs **diagonally down-left** into the glass held up at bottom-left. Layout is
  offset: hopper up-right, jar down-left.
- **Latency: pull at 12.5 s, first coin counted at 15.7 s — 3.2 s.** Ad pacing, not gameplay
  pacing; it would feel unresponsive under a thumb. Ship ~1.0 s (0.8–1.5 s band), keep the
  long visible pour for the look.
- Stream steadily thickens; by t=14.9 only ~5–6 pins remain of the starting ~8.

## 4. Build menu (motion 3 + 4, t=39–42.9)

- Camera pulls back from the hopper crop to the full room cutaway at 39.
- The window **blooms** into a hard yellow rectangle with the purple curtain as a silhouette.
  This bloom is the *menu transition*, not the restoration — it switches off at 42.4.
- Three **cream/paper rounded cards slide in from the right**, staggered ~0.1 s, settled by
  40.5. Each ~14% of screen width, anchored partly **off the right edge**, so the price chips
  read as `100 / 50 / 45` with the last digit clipped. On a phone this means the menu must be
  inset for the safe area — the clipping is an artefact, not a style.
- Window then goes **starry night** (purple sky, white specks) at 42.4–44.9, and only becomes
  the warm amber pane at 45.4. The room passes through night before dawn.
- At **42.5** a small golden burst flashes at the top-right card — the tap confirmation.
- Menu closes: no cards visible from **43.0** onward.

## 5. Purchase FX chain — the best beat in the ad (t=42.5–45.4)

1. **42.5** gold burst at the tapped card.
2. **43.0–43.8** a **coin snake** enters from the off-screen right, sweeps left across the top
   of the frame in a sagging arc, 35–45 visible coins, 2–3 coins thick. Head reaches the bed
   first; the body still trails off-screen.
3. **43.6–44.0** the trail **collapses into its head** — the head anchors at the bed, the body
   reels in, the pile shrinks and slides to the window, compressing to a **single coin**.
4. **44.1** that coin **detonates into a gold sunburst with hard rays**.
5. **44.2–44.9** embers/sparkles hold.
6. **45.0–45.3** a **gold filigree wash** sweeps across the blue wall around the loft — it
   looks like painted flames/leaves, the strongest ornament frame in the ad.
7. **45.4** palette flips and settles: pink bed, amber window, feather wallpaper; loft platform
   gains gold trim; sparkles on the bed.

Two things worth stealing exactly: the **trail-collapse** (head-anchored ribbon that reels
itself in — cheap, and it reads as *spending*) and the **single coin → sunburst** before the
reveal. Both are sub-second and carry the whole premium feel.

Per-purchase this runs 2.6 s end to end, which is too long to repeat on a shop screen; use the
full chain for the final "restore the loft" moment and a ~0.9 s version for individual buys.

## 6. Restoration — the 6 pieces, now fully legible

| # | Piece | Before → after |
|---|---|---|
| 1 | Bed blanket + headboard | maroon/blue → hot pink with gold trim |
| 2 | Window | cool blue moonlight → warm amber pane, wooden mullions, arched brick surround |
| 3 | Left / upper wall | bare blue plaster → **amber-cream with blue feather-frond wallpaper** |
| 4 | Decanter / vase | bubble only → small prop on the loft sill |
| 5 | Terracotta crock | bubble only → prop by the armchair |
| 6 | Bread / biscuit slab | bubble only → plate of crackers on the floor by the girl |

- The wallpaper is **warm amber with blue feather motifs**, not a blue wall — correcting an
  earlier note. It is the single biggest mood carrier in the room.
- Bed, window and wallpaper all flip inside the same 0.4 s at 45.0–45.4: the ad **bundles**
  them into one "restore the loft" moment. In game, one target per burst, or the cause→effect
  link is lost.
- Items 4–6 install as **dressing only**: at t=50 the decanter bubble is consumed with no set
  change; at t=51 the pointer moves to the crock and crackers appear on the floor.
- End card = a fat finger cycling the remaining bubbles. Reuse as the post-win hint loop.
- Grade keeps warming to 51: bright pine floor, warm yellow wall wash.

## 7. Where the frames disagree with the docs

1. **t=0 is not the snowy scene.** 0 s is a macro hand + pin against blurred snow; the wide
   shot starts at 1 s. The ad teases *the pin* before the world.
2. **Item bubbles appear twice before the loop** (house/money-bag t=2–3 with a selection ring;
   door/vase/crock/bread t=5–7). Restore targets are previewed *before* the puzzle.
3. **The hopper materialises** from a grid of glowing orange squares at t=4, in its future
   footprint, ~1 s. Reusable spawn-in for every level.
4. **The hopper is opaque glossy plastic, not glass.** Coral body, darker red ribs, gold heap,
   hard specular rim, no transmission anywhere. Drop the MeshPhysicalMaterial glass from §2.
5. **Pins are a diamond mesh** of thin mint-teal rods (~8) with two decorative **blue bead
   chains** down the outer edges. The beads are ornament, not tappable. Lower chamber is a
   flared funnel with red ribs behind the mesh; silhouette still reads as an hourglass.
6. **Counter has no panel** — gold coin icon + white number above the jar.
7. **The build menu is a right-edge card strip, not a modal**, and coins are spent *visibly*.
8. **Restoration is a sweep at 45.0–45.4**, not a cut at 48 s; the prompt's "48 s" beat is
   actually the hint cycle.
9. Pipes are real: a thick pipe crosses the upper-right wall toward the ladder. Build it plus
   the tall column.
10. Prompt §4 asks for "thick dark-blue outlines with gold fill"; the menu is light cream on a
    dark room. Keep cream **for the build menu only** — that contrast is what makes it pop.

## 8. Set dressing inventory (for milestone 2)

Two-level cutaway, fixed camera, slightly elevated, shallow depth of field.

- Loft (left-centre): bed, sleeper propped on one elbow holding a clear tumbler up, legs
  crossed. Blanket colour is the restoration state flag. A second, smaller character sits at
  the loft's right end by the window; a small lamp sits on a bracket there.
- Window (centre-back): purple curtain; cool moonlight → starry night → warm amber.
- Ladder front-centre-right, floor to loft. Loft platform trim turns gold on restore.
- Right: tall dark column + diagonal pipe; wooden frame at the gameplay crop.
- Left: shelves of jars/bottles, snow-topped woodpile on the floor.
- Floor: grey armchair, woven mat with the small red-jacketed girl cross-legged, black cats
  plus an orange-and-white cat at the ladder foot.

## 9. Milestone 1 implications

- Level-1 read should already look like t=9–20: dark teal room, one blazing hopper, single
  thread of gold, counter beside the jar, everything else silhouette.
- Counter ticks in uneven increments and pops on change; never lerp it.
- Build the spawn shimmer and the pin fly-off streak early — 1 s each, they carry the gloss.
- Pins are a **mesh** of ~8 crossing mint rods with bead trim; coins must rattle through the
  diamonds, so the collider layout follows the visual lattice.
- Pull→coin latency ~1 s, not the ad's 3.2 s.
- 30–90 s level length matches a 30 s loop plus a 3 s reveal.
- Do not build glass, a billboard build modal, or a paneled counter.
- Out of scope for M1 but noted for M2: coin-snake collapse, sunburst, filigree sweep.

## 10. Still useful to see

Additional 10 fps footage would help most in **t=16–35 s** (steady and peak flow): peak
on-screen coin count, stream width, and how densely coins pile on the pins — that sets the
instanced-coin budget and the 250-coin cap. The t=0–8 cutscene has no M1 value.
