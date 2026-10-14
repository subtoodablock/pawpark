# Paw Park — Art Direction & Visual Framework

The target look is **close to Egg, Inc.**: a bright, clean, toy-like 3/4 top-down
farm with soft shadows and chunky rounded UI, where everything squashes and
bounces a little. We have **no image assets**. Everything is drawn procedurally
(Canvas 2D) and cached into sprites, so the game stays a single self-contained
web app.

Every visual agent follows this doc. If something here is wrong, change it here
first.

---

## 1. Pillars
1. **Toy-like 3D illusion.** Each object has one consistent light direction, a
   lit top, a mid front, a darker side, and a soft contact shadow. That alone
   makes flat shapes read as 3D.
2. **Alive at a glance.** Something is always gently moving: tails wag, clouds
   drift, wheels turn, grass sways. Nothing snaps; everything eases.
3. **Juicy feedback.** Every tap gets a response within 1 frame: squish,
   bounce, particles, a number pop.
4. **Calm UI over a busy world.** UI is white or near-white rounded cards with
   soft elevation, so the scene stays the star.
5. **60 fps on a mid-range phone.** Polish never costs frame rate (§8).

## 2. Light, shadow, depth
- The **light comes from the top-left**: `LIGHT = normalize(-0.6, -0.8)`. For every object:
  - The top and upper-left faces are about 12–18% lighter than the base.
  - The right/side face is about 18–25% darker than the base.
  - A **contact shadow** sits under every actor: an ellipse with a radial
    gradient, black at 0.22 alpha falling to 0, about 1.1× the actor's width
    and 0.35× as tall.
  - A **cast shadow** (buildings and vehicles) is a parallelogram skewed toward
    the bottom-right, black at 0.15 alpha, with a soft edge (draw it with a blur
    once into the sprite cache, never with a per-frame `filter`).
  - A thin **ambient-occlusion line** (darker, 0.25 alpha) runs where a building
    meets the ground.
- **Camera:** an oblique 3/4 top-down view. The lawn is a plane, and screen y is
  depth.
  - Draw actors **sorted by y**.
  - Scale them with depth: `0.85 + 0.3 × (y − lawnTop)/(lawnHeight)`.
  - Far objects get a slight atmospheric haze (blend 6% toward the sky colour).
- **Outlines:** a 1.5–2 px stroke in a darker shade of the fill (never black),
  which gives Egg, Inc.'s clean cartoon edge.

## 3. Palette (design tokens, `src/ui/theme.ts` and CSS variables)
```
sky-top #7cc8ff   sky-bottom #d4f0ff   cloud #ffffff
grass-1 #7fd35b   grass-2 #6cc44a (mow stripes)   grass-dark #4f9e36
dirt #e7c597      path #f1dcb5        wood #b8743d   wood-dark #8a5428
roof-red #ef5a47  roof-blue #4a8fe7   roof-green #47b267  roof-purple #8e6be8
road #5b6270      road-line #fff1b8
ui-bg #ffffff     ui-bg-2 #f4f8f1     ui-text #24342a    ui-muted #6b7d70
btn-green #45c766 / edge #2f9b4c      btn-gold #ffcb3d / edge #e29a00
btn-blue #4aa8ff / edge #2a7fd1       btn-disabled #d5dcd6 / edge #b4bdb6
danger #ff6159    star #ffcf33       bone #fff4dc
```
Dark mode only dims the UI chrome. The park scene stays bright, like Egg, Inc.

## 4. Typography
- **Fredoka** (self-hosted via `@fontsource/fredoka`, weights 500/600/700), with a
  `system-ui` rounded fallback.
- Numbers use `font-variant-numeric: tabular-nums` so counters don't jitter.
- Scale: hero cash 34/700, title 20/700, body 15/500, caption 12/600.

## 5. The dogs (procedural, the most important art)
**Breeds** (`src/ui/render/breeds.ts`) are data: base colour, secondary colour,
pattern, ear type, tail type, body proportions, and size.

| breed | look |
|---|---|
| Golden Retriever | warm gold, feathered tail, floppy ears |
| Dalmatian | white with black spots |
| Corgi | orange/white, short legs, big pointy ears, fluffy rear |
| Husky | grey/white mask, pointy ears, curled tail |
| Beagle | tri-colour, long floppy ears |
| Poodle | cream curls (curly fur style) |
| Shiba | orange with a cream face, curled tail |
| Black Lab | glossy black with a strong highlight |
| Dachshund | long body, short legs, brown |
| Pug | fawn with a dark muzzle, curly tail |

**Construction** (side view, facing right; left-facing is a mirror):
1. Contact shadow.
2. Far legs, darker.
3. Tail (rotated by the wag angle).
4. Body: a rounded capsule with a vertical gradient (lit top, darker belly).
5. Near legs.
6. Head: a circle plus a snout, with ears (floppy hang or pointy triangles).
7. Eye: a dark ellipse plus a 1 px white shine dot. Nose: a dark rounded triangle.
8. Patterns (spots, mask, tri-colour), clipped to the body and head paths.

**Fur:** this is what separates "looks good" from "looks like clip-art".
- The base gets a soft directional gradient (§2).
- Add a **fur texture pass**: 60–150 short curved strokes (1–2 px, 3–6 px long)
  along the body's surface normal, in ±8% lightness variations of the local
  colour. Use a seeded RNG per breed so it's stable.
- Add a **rim light**: a 1 px lighter stroke along the top-left silhouette edge.
- **Fluffy silhouettes** (Husky, Corgi rear, Poodle, Golden tail): replace the
  smooth edge with small overlapping arcs ("scalloped" fur tufts).
- **Curly fur** (Poodle): the body is built from clustered circles, each with
  its own small highlight.
- The fur work is drawn **once per breed × frame into the sprite cache**, never
  per frame.

**Animation frames** (cached): 8-frame walk cycle (diagonal leg pairs on a sine,
body bob ±1.5 px, head bob out of phase), 4-frame run cycle (zoomies: stretched
gallop), sit, dig (2 frames: front paws alternate, head down), and lie down
(sleeping, with a "z" particle). The tail wag is applied **live** as a rotation
of a separately cached tail sprite, so it stays buttery and doesn't multiply
frames.

**Behaviour state machine** (`src/ui/render/PupActor.ts`), with weights:

| state | weight | notes |
|---|---|---|
| wander | 50 | |
| sniff | 10 | stop, head down, tail wag fast |
| dig | 15 | dirt particles, and at the end the current find icon pops up with a sparkle and fades |
| sit | 15 | |
| nap | 5 | |
| play | 5 | two pups chase each other |

While zoomies > 0, the run cycle is used and speed goes up with the zoomies
fraction. Every transition eases, and velocity is lerped and never snaps.

**Adoption run (Egg, Inc.'s signature):** each adopted pup spawns at the
**Adoption Center** building (left side of the lawn) and **runs along an arc**
to the door of a kennel with free space, then fades in as a wanderer or into
the kennel. Use pooled actors, with at most 40 runners at once. While holding
the whistle, a steady stream of pups runs across the lawn.

The pup population is shown by about 30–80 visible actors (scaled to the
population, capped by the performance budget). Every 10th pup per breed can be
a puppy (0.7 scale, bigger head ratio).

## 6. Buildings, vehicles, world

**Kennels.** 18 tiers grouped into 6 families. Each building is drawn as a front
face, a side face (darker) and a roof (lighter), all with outlines, plus a cast
shadow, an ambient-occlusion line, and tier details. Families:

| tiers | family | details |
|---|---|---|
| 0–2 | wooden doghouse | gable roof, name plaque, gets wider per tier |
| 3–5 | barn / lodge | big barn door, hay loft, chimney smoke particles |
| 6–8 | plaza / hall | stone, columns, flags waving |
| 9–11 | complex / warehouse / mansion | many windows, rooftop details |
| 12–14 | tower / scraper / bunker | tall, lit windows, antenna blink |
| 15–17 | sky / orbital / moon / planet | floating platform, glow ring, stars |

- **Upgrade animation:** the old building squashes down to 0.9 and pops up as
  the new one with an overshoot (scale 1.15 → 1), a dust ring, confetti and a
  sparkle burst.
- **Empty slot:** a dashed outline on a dirt pad, with a "+" that pulses gently
  when you can afford it.

**Adoption Center.** A distinct building on the left with a sign and a door that
opens while pups stream out.

**Vehicles.** Each family has a body, cab, wheels that rotate with distance, a
crate stack showing the load, and a contact shadow. They drive left→right on
the road with slight suspension bob. A depot sits on the left; vehicles loop.
An upgrade gives a poof plus the new vehicle sliding in.

**World.** The world has:
- A sky gradient with 3–5 parallax clouds that drift at different speeds.
- A low hill silhouette on the horizon.
- Trees: round canopies (2–3 circles) with a highlight and shadow, swaying
  ±1°.
- Bushes, flowers (small 3-dot clusters) and a wooden fence along the back.
- Mow stripes in the lawn, plus a subtle noise texture baked once.
- A dirt path from the Adoption Center to the kennels.
- Butterflies (2–3, slow Lissajous paths).

**Squirrel.** A procedural sprite (grey-brown, big fluffy tail with fur
strokes) that hops in arcs (a sine hop), stops, looks around, then darts. When
tapped it does a spin plus a reward pop. The **mailbox** is a red post box with a
flag that raises when letters are waiting, plus a count badge.

**Time-of-day tint** (a daily-game touch): a gentle overlay based on local time.
- Morning: warm and light.
- Day: neutral.
- Evening: golden.
- Night: blue, with windows glowing and fireflies.

The overlay is a single fill with `multiply`/`screen`, cheap. It can be turned
off in settings.

## 7. UI motion & components
**Motion tokens:**
```
--dur-fast 120ms  --dur 200ms  --dur-slow 320ms
--ease-out cubic-bezier(.2,.8,.2,1)
--ease-spring cubic-bezier(.34,1.56,.64,1)   (overshoot)
```
Everything respects `prefers-reduced-motion` (durations go to 0 and decorative
loops stop).

**Buttons** (Egg, Inc. "chunky 3D"):
- A rounded rect (radius 14) with a **bottom edge** of 4 px in the darker edge
  colour (`box-shadow: 0 4px 0 edge, 0 6px 12px rgba(0,0,0,.12)`).
- **Press:** `translateY(3px)`, the edge shrinks to 1 px, scale 0.97, in 80 ms.
  **Release:** spring back with overshoot.
- **Hover** (desktop): brightness 1.05 and a lift of 1 px.
- **Becomes affordable:** a single "ready" bounce (scale 1 → 1.08 → 1, spring)
  and a shine sweep (a diagonal white gradient crossing once). It never loops
  forever.
- **Disabled:** grey, flat edge, no animation.
- **Buy success:** a coin/bone burst from the button (6–10 small particles) and
  the level text pops.

**Numbers:**
- Cash counts up smoothly. It interpolates toward the true value at a critical
  damping of about 150 ms, never stepping each tick.
- Big gains show a floating "+$1.2K" that rises and fades.

**Whistle (the hatch button):**
- A **big round** button at the bottom centre (Egg, Inc. style), with the stock
  shown as a **circular progress ring** around it.
- **Hold:** it squishes, a glow pulse starts, and a ring of small paw particles
  emits; pups stream out of the Adoption Center.
- The zoomies meter sits as a flame bar above it.

**Panels and overlays:**
- **Bottom sheet:**
  - It slides up with a spring. The backdrop fades to 35% black.
  - It has a **drag handle**: drag down to dismiss, with velocity-based close.
  - The content scrolls inside it with momentum.
- **Tab bar:** an active pill slides between tabs (FLIP or a translate on one
  indicator element), and the icon bounces on selection.
- **Cards:** white, radius 18, elevation shadow `0 2px 0 rgba(0,0,0,.04), 0 8px
  24px rgba(0,0,0,.08)`. Rows have 12 px gaps.
- **Modals:** scale in from 0.85 with a spring and a backdrop blur where
  supported. Celebration modals (find unlocked, prestige, endgame, streak
  milestone) get a **confetti** burst (canvas overlay, about 120 particles,
  gravity plus spin, 1.5 s).
- **Toasts:** slide down from the top with a spring, auto-dismiss with a fade
  and slide up, and stack with a 6 px gap.

## 8. Performance budget & techniques
- Hold 60 fps on a mid phone. The scene render must stay ≤ 4 ms/frame on desktop
  Chromium at 390×844 @2x with 60 pups (measured in QA via
  `performance.now()` around the draw call; expose
  `window.pawpark.renderStats`).
- **Layers:**
  1. The static background (sky gradient, hills, lawn, stripes, noise, fence,
     trees' trunks) goes in an offscreen canvas, rebuilt only on resize.
  2. Buildings are cached per tier/size and redrawn into an offscreen layer only
     when kennels change.
  3. The dynamic layer (pups, vehicles, particles, swaying canopies, clouds) is
     drawn per frame.
- **Sprite cache:** `SpriteCache.get(key, w, h, drawFn)` keeps an LRU of
  offscreen canvases (OffscreenCanvas if available) at the current DPR.
  Pre-warm breeds lazily, about 1 breed per frame, to avoid a start-up stall.
- Cap DPR at 2. Never use `ctx.filter` or `shadowBlur` per frame; bake them
  into sprites. Pool all particles, with no allocations in the hot loop.
- The render loop uses frame `dt` (clamped to 50 ms) and is separate from the
  fixed 0.1 s simulation. Visual positions interpolate.
- When the tab is hidden, stop drawing.

## 9. File layout (render)
```
src/ui/theme.ts              palette + motion tokens (TS mirror of CSS vars)
src/ui/render/SpriteCache.ts
src/ui/render/shade.ts       colour helpers: lighten/darken/mix, gradients, fur strokes, scallop paths
src/ui/render/breeds.ts      breed data
src/ui/render/dogSprite.ts   draws a breed frame (+ tail sprite)
src/ui/render/PupActor.ts    behaviour state machine + adoption runners (pooled)
src/ui/render/buildings.ts   kennel families, adoption center, depot, mailbox
src/ui/render/vehicles.ts
src/ui/render/world.ts       sky, clouds, hills, lawn, trees, fence, flowers, butterflies, time-of-day
src/ui/render/particles.ts   pooled particle system (dirt, dust, sparkle, confetti, z's, paw bursts)
src/ui/render/squirrel.ts
src/ui/ParkScene.ts          orchestrates layers, hit-testing, input, floaters
src/ui/fx/confetti.ts        DOM-overlay confetti for modals
src/ui/motion.ts             countUp, spring helpers, "ready" bounce trigger, reduced-motion flag
```
