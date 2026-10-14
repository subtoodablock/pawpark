# Paw Park — Screens modeled on Egg, Inc.

Built from the designer's reference screenshots of Egg, Inc.'s **Farm (egg)
panel** and **Research panel**. It overrides `08-find-eras.md` §5 where they
conflict.

## 0. Rule: players never see price scaling
Era cost scaling (`costScale`) and duplicate-tier pricing are **invisible**.
Players see prices, and prices are simply bigger in later eras, as in
Egg, Inc. Remove:
- the "Era prices ×N" notes in Training, Kennels and Fleet;
- the "×N Prices" tile in the era confirm modal.

The confirm modal keeps the Find value jump plus the Resets and Keeps lists.

## 1. Find panel (Egg, Inc. "Farm" panel)
It opens by tapping the **current Find icon** in the HUD (the top-left badge,
like Egg, Inc.'s egg badge). It's also reachable from the Park tab. It's a
large rounded card with two tabs at the top: **Park** (this panel) and
**Trophies**. Trophies takes the place of Egg, Inc.'s Contracts tab.

```
┌─────────────────────────────────────┐
│  [ PARK ]         [ TROPHIES ]  (x) │
├─────────────────────────────────────┤
│   ( big Find art )   TENNIS BALL     │  name: display face, accent colour
│                      Value: $1.25    │
│                      flavor text…    │
│                                      │
│  ( < )  • • ● ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ( > )│  13 dots = the Find ladder
│                                      │
│     PARK VALUE: $3.2M  (i)           │
│                                      │
│   [ START NEXT ERA → ]  or locked    │  primary action for the viewed Find
│   [ PRESTIGE INFO → ]  (purple bar)  │
└─────────────────────────────────────┘
```

**Carousel:** the `<` and `>` buttons (or a swipe) browse every Find.
- **Current Find:** the big icon, name, value and flavor. The dot is filled and
  larger.
- **Next Find:** the same card. The action is **"Start next era"**, enabled when
  `parkValue ≥ unlockParkValue`. Otherwise it's a progress bar showing
  "Unlocks at Park Value $X".
- **Past Finds (already reached this prestige):** the full card with the label
  "Completed".
- **Future Finds beyond the next one:** a silhouetted, dimmed icon and "???",
  with the value hidden, and a small dimmed dot. Finds the player has ever
  reached (`highestFindIndex`) show normally even after a prestige, the way
  Egg, Inc. shows discovered eggs.

**Info button** next to Park Value: a short popover, "Park Value is roughly an
hour of your earnings. Reach the next Find's value to start its era."

**Prestige info** is a full-width purple bar button. It opens the prestige
card (existing), with copy explaining the loop: "Back to the 🪵 Stick Era with
+N Spirit Paws (+X% earnings). Spirit Paws are earned from everything you sold
this prestige."

The era confirm modal opens from "Start next era". If the era has already
started (automation got there first), the modal closes quietly and the panel
refreshes. It shows no error toast.

## 2. Research panel (Egg, Inc. "Common / Epic")
Training and Academy merge into one **Research** panel with two big tabs:
- **COMMON** (blue): Training.
- **EPIC** (purple): Academy, plus the Pack (automation) section and Treats,
  as today.

The tab bar gets one **Research** entry with a flask icon, replacing the
separate Training tab. Pack/Academy becomes the Epic tab, so the bottom bar
loses one tab.

**Layout:**
- A panel background in the tab colour, with **"TIER 1" / "TIER 2" …** section
  headers in white display caps.
- A locked tier shows a dim header with "Buy N more upgrades to unlock".

**Each research row is a white rounded card:**
```
┌──────────────────────────────────────────┐
│ [icon]   COMFY BEDS                        │  name: display caps
│  ×25     Increase dig rate by 10%          │  per-level effect, % in accent blue
│  badge   ████████░░░░░░░  +160%            │  level progress bar + TOTAL effect so far
│                                   [ $1.2K ]│  buy button, or a ✓ check when maxed
└──────────────────────────────────────────┘
```
- **Max-level badge** (`×25`): a small pill under the icon.
- **Progress bar:** `level / maxLevel`, green fill. Next to it is the **total
  effect so far**: for mult stats `+perLevel×level×100%`, for add stats the
  added amount in its unit.
- **Buy button:** a chunky green button with the price. It's disabled grey when
  unaffordable, and when maxed it's replaced by a ✓ checkbox icon, like
  Egg, Inc.'s green check.
- The ×1 / ×MAX toggle stays at the top of the Common tab.
- After Tier 1, a **tip card** in the panel colour with lightbulb icons reads
  "Effects of different upgrades multiply together. For example +100% and +100%
  = +300%." Use correct maths for our multiplicative stats.
- **Epic rows** use the same card, paid in 🦴 (Academy). Pack automation rows
  sit at the top of Epic as today. Treats sit at the bottom.

## 3. Bottom controls (light touch toward Egg, Inc.)
Keep the current round whistle and stock ring. Egg, Inc.'s red hatch bar is a
later visual option, not part of this pass. The HUD's top-left **Find badge**
becomes the circular current-Find icon with a ring, as in Egg, Inc. It opens
the Find panel.
