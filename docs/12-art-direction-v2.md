# Paw Park — Art Direction v2: "Egg, Inc. clean"

The designer's feedback was that v1 looked **childish**. The specific complaints
were the **dogs** (big eyes, blush, chibi proportions), the **font and buttons**
(the bubbly rounded font and chunky pastel buttons), and the **emoji icons**.
The park's colours and scene can stay.

The target is the **Egg, Inc.** look from the designer's reference screenshots:
- crisp white panels;
- a **thin, condensed, uppercase** typeface;
- bold flat **blue / purple / green / red** buttons and tabs;
- simple monochrome glyph icons in round white buttons;
- a toy-like 3D world where the animals are small, simple and clean.

This doc overrides `07-art-direction.md` wherever they differ. The 07 rules on
performance, layering and the sprite cache still apply.

## 1. Typography
- **One family:** **Barlow Condensed**, from `@fontsource/barlow-condensed`,
  weights 300/400/500/600. Fallback: `"Arial Narrow", "Roboto Condensed",
  system-ui, sans-serif`.
- **Headings, labels and buttons:** UPPERCASE, weight 400–500, letter-spacing
  0.02em. Egg, Inc.'s titles (ROCKET FUEL, COMFORTABLE NESTS) are thin
  condensed caps.
- **Big numbers:** the cash counter uses weight 300–400 at a large size with
  tabular figures, as in Egg, Inc.'s "77.089 TRESVIGINTILLION". The unit word
  is smaller and in accent blue.
- **Body text:** weight 400, sentence case, size 15–16. Don't use bold for body.
- **Remove Fredoka everywhere,** including the `@fontsource/fredoka` imports.

## 2. Colour tokens (UI chrome)
```
--ui-bg #ffffff          --ui-text #111111        --ui-muted #6b6b6b
--blue  #2f6fdc (tabs, primary panels)   --blue-deep #1f57b8
--purple #7a1fd1 (epic, prestige)        --purple-deep #5e12a8
--green #20a63a (buy, confirm, success)  --green-deep #178a2e
--red   #e8241c (close, hatch/whistle bar, alerts)
--gold  #f2b417 (golden bones, highlights)
--accent-text #2f6fdc (numbers inside descriptions, like Egg, Inc.'s blue "10%")
--disabled #cfd3d8
```
The park scene's colours stay as they are (grass, sky, wood). The UI chrome
moves to these flat, saturated tokens with **no pastel tints**.

## 3. Shapes and buttons
- **Panels:**
  - White, radius 28.
  - Soft shadow `0 6px 24px rgba(0,0,0,.18)`.
  - Coloured **tab headers** sit on top as big solid blocks (blue / green /
    purple) with white caps text, like Egg, Inc.'s FARM | CONTRACTS and
    COMMON | EPIC.
  - The close button is a **red circle with a white ✕** at the panel's top
    right.
- **Buttons:**
  - Flat solid colour, radius 999 (pill) or 18, white caps label, **no 3D
    bottom edge**. Use only a subtle shadow `0 2px 0 rgba(0,0,0,.15)`.
  - Press: scale 0.96 and a darker shade, quick and crisp. No bouncy
    overshoot.
  - Disabled: `--disabled` fill.
  - Round icon buttons are **white circles** (56–64 px) with a **black glyph**
    icon and a soft shadow, as in Egg, Inc.'s bottom row. A notification is a
    small red dot.
- **Whistle (hatch):** a wide **red rounded bar** at the bottom with a white
  dog glyph, like Egg, Inc.'s chicken button, with a slim stock bar inside or
  above it. Above it sits **one row of round white icon buttons**: Research
  (flask), Treats (lightning), Shop (gem), Menu (grid). These replace the
  current bottom tab bar, as in Egg, Inc.
- **Motion:** reduce the springiness. Keep panels sliding and fading at
  180–220 ms ease-out. Drop the overshoots, the "ready" bounce and the paw
  particle rings. Confetti is kept only for real celebrations: a new era, a
  prestige, or a Legendary.
- **HUD (top bar):** one white rounded strip like Egg, Inc.'s:
  - the **current Find badge** in a circle on the left, with a gold ring for
    progress;
  - in the centre, the big cash figure with its unit word, and under it the
    income per second and the pup count;
  - on the right, the golden bones count;
  - a purple **shop** circle button at the far right.

## 4. Icons: no emoji anywhere in the UI
- **Glyphs** come from **Phosphor Icons** (`@phosphor-icons/core`, MIT),
  normally the `fill` weight, inlined as SVG (import `?raw`).
- **Mapping:**

  | Use | Icon |
  |---|---|
  | Golden bone | `bone-fill`, gold |
  | Spirit paw | `paw-print-fill`, purple |
  | Pup Star | `star-fill`, gold |
  | Pups | `dog-fill` |
  | Research | `flask-fill` |
  | Treats/boosts | `lightning-fill` |
  | Kennels | `house-fill` |
  | Fleet | `truck-fill` |
  | Today | `calendar-check-fill` |
  | Trophies | `trophy-fill` |
  | Mail | `envelope-simple-fill` |
  | Settings | `gear-six-fill` |
  | Share | `share-fat-fill` |
  | Prestige | `arrow-counter-clockwise-bold` |
  | Close | `x-bold` |
  | Info | `info-bold` |
  | Lock | `lock-simple-fill` |
  | Check | `check-square-fill`, green, like Egg, Inc.'s maxed check |
  | Portal | `spiral-bold` |
  | Squirrel | (none) |

- **Game objects** are **rendered art, not glyphs** (§5): Finds, kennel tiers,
  vehicle tiers, training items and treats.
- **One helper,** `src/ui/icons.ts`, exports `icon(name, opts?): HTMLElement`
  and `iconSvg(name): string`. No emoji literals should remain in
  `src/ui/**/*.ts`; grep for emoji ranges to check.

## 5. Rendered game art (procedural, cached, used in UI and scene)
`src/ui/render/art.ts` exports these, each returning a cached PNG data URL drawn
procedurally on canvas with the 07 §2 lighting rules:
- `findArt(index, px)`: each Find as a **glossy 3D-looking object**, matching
  the polish of Egg, Inc.'s rendered eggs (soft gradient body, specular
  highlight, subtle shadow). The 13 Finds:
  1. a stick
  2. a tennis ball (felt texture and seam)
  3. a squeaky toy (rubber with a sheen)
  4. a rawhide bone
  5. a leather wallet
  6. a gold pirate coin
  7. an amber fossil
  8. a crystal bone (faceted, translucent)
  9. a meteorite (glowing cracks)
  10. an ancient relic urn
  11. a moon rock (craters)
  12. a time bone (hourglass glow)
  13. a cosmic bone (nebula swirl)
- `kennelArt(tier, px)` and `vehicleArt(tier, px)`: reuse the existing
  building and vehicle sprite renderers, framed as icons.
- `trainingArt(id, px)`: a simple **flat object illustration** per training
  stat family, in Egg, Inc.'s style of research art (a nest, pills, an
  incubator), e.g. a dog bed, a kibble bowl, a whistle, a shovel, a crate.
  Drawn flat with 2–3 tones and no outline. Family-level art is fine: items
  sharing a stat share the art, tinted per tier.
- `treatArt(id, px)`: bacon, a peanut butter toy, steak.

## 6. Dogs: clean, simple, grown-up
Egg, Inc.'s chickens are **small, simple, low-detail toys**. Paw Park's dogs
should read the same way: charming, not cutesy.
- **Proportions:** natural. The head is about **30–35%** of body height, with a
  real snout and leg length in proportion to the breed. No chibi head.
- **Eyes:** a small dark dot or a short almond, with **no** white highlights,
  **no** blush and no open-mouth smile by default. The tongue shows only while
  running.
- **Shading:** 2–3 flat tones (light top, base, shadow underside) with one
  crisp contact shadow. The **fur texture strokes are removed.** Clean shapes
  only, plus a subtle 1 px darker edge on the shadow side. No full outline.
- **Size:** a bit smaller on the lawn, so a populated park reads as a busy
  toy world, as Egg, Inc.'s farms do.
- **Breeds stay distinguishable** by silhouette and markings: ear shape, tail,
  coat pattern (spots, saddle, mask) and size.
- **Poses:** walk, run, sit, dig, nap and sniff stay. Keep the motion smooth but
  make the bob subtler. Napping is a calm curl with no "Z" spam: at most one
  small z, rarely.
- The `?dogsheet=1` debug view stays, for review.

## 7. What stays
- The park scene composition, the buildings, vehicles, sky, lawn and
  time-of-day.
- All game logic and panel structure: the Find panel, Research Common/Epic,
  Today and the store. They are restyled, not restructured, except for the
  bottom bar change in §3.

## 8. Acceptance
- Screenshots at 390×844 and 360×640 of: the main screen, the Find panel,
  Research Common/Epic, the Kennels list, the store, the confirm modal, and a
  dog close-up.
- The look is visibly in the Egg, Inc. family: white panels, condensed caps,
  flat colour blocks, glyph icons and clean dogs.
- `grep` finds no emoji in `src/ui`.
- `renderStats` stays within budget.
