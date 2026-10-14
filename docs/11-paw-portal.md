# Paw Park v6 — The Paw Portal (Egg, Inc. ships & artifacts, reimagined)

Egg, Inc.'s mid/late game adds **ships**. You launch timed missions (20 min to
hours, 3 at once), and each ship gains experience and unlocks bigger ships. The
missions bring back **artifacts**, permanent boosts you equip, craft upward and
socket with stones. In Paw Park the ship becomes **a portal to other universes**
that dog crews jump through. It's original whimsical sci-fi with no borrowed IP:
no existing show's characters, names, catchphrases or look.

Research basis: `reports/Egg Inc incremental design flow.md` (Contracts, ships
and calendars) and the research notes `contracts_artifacts_pacing.md`. Egg, Inc.
facts used: missions are Short/Standard/Extended (20 min / 1 h / 2 h for the
first ship, longer for later ships), 3 run at once, ships gain experience, the
launch pad unlocks around the Rocket Fuel egg with about 10k Soul Eggs, and
later updates added crafting, stones, targeting and sets.

## 1. Why it fits
- **A check-in heartbeat on real time.** A 30 min / 3 h / 12 h expedition maps
  onto morning, lunch and an overnight trip. That lines up with the
  AFK+Daily player.
- **A second, permanent progression track** that survives prestige. It gives
  the long middle of the game (weeks 2–10) new goals while Find gates get
  steep.
- **Collection and bragging.** Rare relics and full sets are something to
  show friends in the share text.
- **The visual centrepiece:** a swirling portal in the park that dogs leap into
  and come back through carrying glowing loot.

## 2. Unlock
The **Portal Gate** becomes buildable the first time the player reaches the
**Rawhide era** after at least **one prestige**. That's about day 1–2, roughly
Egg, Inc.'s Rocket-Fuel-plus-Soul-Eggs gate. Building it is a one-time cash
cost in the current era. It is permanent and survives prestige.

## 3. Expeditions (missions)
- **3 portal slots.** A 4th slot unlocks with an Academy item later.
- **Crews (the ships):** 6 crew tiers. Each tier unlocks after the previous one
  completes N expeditions, and each crew gains stars (XP), as in Egg, Inc.

  | # | Crew | Unlock | Lengths (short / standard / long) |
  |---|---|---|---|
  | 1 | Puppy Scouts | start | 30 m / 3 h / 12 h |
  | 2 | Fetch Squad | 20 runs of #1 | 1 h / 4 h / 12 h |
  | 3 | Rescue Rangers | 50 runs of #2 | 2 h / 6 h / 16 h |
  | 4 | Sky Hounds | 100 runs of #3 | 3 h / 8 h / 24 h |
  | 5 | Star Retrievers | 150 runs of #4 | 4 h / 12 h / 36 h |
  | 6 | Infinity Pack | 250 runs of #5 | 6 h / 18 h / 48 h |

  (Unlock runs were 6/10/15/20/30 in the first draft; see §9.) Loot per run is
  short 1, standard 1/1/1/2/2/2 and long 2/3/4/5/6/8 items for crews 1…6 (long runs pay well because a one-check-in player can only use long runs).

  Higher crews bring **more and better loot** per run (capacity), and longer
  runs bring more again. Crew stars (from runs completed) add +capacity and
  better rarity odds.
- **Dimensions (destinations):** choose where to send a crew. Each dimension
  biases which relic families drop, which supports Egg, Inc.-style targeting.
  Later dimensions unlock with crew tiers. Starting list:
  - **The Bacon Dimension:** sizzling seas.
  - **Squeakopolis:** a city made of toys.
  - **Tennis Ball Nebula.**
  - **The Upside-Down Dog Park:** dogs walk humans.
  - **Planet Nap.**
  - **The Mailman's Rift:** scary.
  - **Cat Universe:** very scary, best loot.
  - **Bone Zero:** the origin of all bones.
- **AFK and offline:** expeditions run on wall-clock time, including while
  offline. Returns are collected on the next check-in, with one tap to open
  all. A crew that's back waits in the slot until you collect it, and nothing
  is lost.
- **Fuel:** launching costs **Treat Fuel** (cash scaled to the current era, or
  Golden Bones for long runs), so expeditions stay a light decision rather than
  free. Egg, Inc. fuels ships with eggs. We use **cash of the current era**,
  which ties portals to the main park.

## 4. Loot
### 4.1 Relics (artifacts)
- **Equipping:** up to **4 equipped** at once, in a **Relic Collar** with 4
  charms. Equipped relics apply permanent stat boosts that stack into
  `computeStats`.
- **Tiers and rarity:** relics come in **4 tiers** (T1–T4). Each tier rolls a
  rarity: Common, Rare, Epic or Legendary. Rarity scales the effect, and higher
  rarities can hold **stones**.
- **Families** (each boosts one Stat; first-pass numbers for T1 Common → T4
  Legendary, which balance will tune):

  | Relic | Stat | T1 → T4L |
  |---|---|---|
  | Bacon Prism | layRate | +2.5% → +197% (tier-driven grid: `0.025 × 3.3^tier × 1.3^rarity`) |
  | Squeaky Orb | findValue | +2.5% → +197% (same grid) |
  | Pocket Kennel Key | kennelCapacity | +3% → +40% |
  | Wormhole Leash | shippingCapacity | +3% → +100% |
  | Rescue Beacon | rescueMult | +3% → +120% |
  | Time-Fold Collar | offlineHours | +1 h → +12 h |
  | Lucky Acorn | squirrelRate | +10% → +150% |
  | Ancient Bark Tablet | spiritPawBonus | +0.2% → +3% per paw |
  | Cosmic Frisbee | maxZoomies | +5 → +60 |
  | Golden Food Bowl | researchDiscount | −2% → −20% |

### 4.2 Stones
Stones are small gems socketed into Rare+ relics: 1 slot for Rare, 2 for Epic,
3 for Legendary. Each stone adds a small boost of its own stat (+1–5%). Stones
come in 3 tiers and can be crafted.

### 4.3 Crafting
- **Recipe:** combine **3 relics of tier N from the same family** plus a cash
  fee to make one **tier N+1** of that family, with a fresh rarity roll.
  Crafting gives small XP that improves rarity odds, as in Egg, Inc.
- **Duplicates:** spare relics can be **recycled** for Golden Bones (Egg, Inc.
  demotes artifacts into golden eggs).

### 4.4 Sets (later)
Equipping 4 relics from one "dimension set" grants a small set bonus. This is a
v6.1 stretch goal.

## 5. Balance budget
Relics are a real but bounded layer:
- By day 30 an AFK+Daily player's equipped relics give about **×2–3** total
  earnings-equivalent.
- By day 100 it should be about **×5–10**.

The v5 balance (Find gates and endgame at day 100–120) has to be re-fit with
relics included. That means the balance bot launches expeditions at check-ins
and auto-equips the best relics.

**Fairness:**
- Loot is **free and never sold**: no paid loot rolls, no paid crate opening.
- Pup Stars may buy convenience only, and stay inside the existing ≤25% total
  speed-up cap: one extra portal slot, and "rush" (finish a run now) capped at
  once a day.

## 6. UI
- **Park scene:** the **Portal Gate** stands on the lawn, a swirling ring of
  green, violet and teal light with particles.
  - **Launch:** crews line up and leap in.
  - **Return:** dogs tumble back out with a glowing loot bubble.
  - **Idle:** the portal hums and occasionally shows a peek of the destination
    (a bacon sea, a cat silhouette).
- **Portal panel** (opened from the gate, or a new 🌀 tab):
  - **Expeditions:** the 3 slots with countdown rings, a "Collect" button and
    a crew/dimension/length picker.
  - **Relic Collar:** 4 equipped charms.
  - **Collection:** a grid of every family × tier, discovered or silhouetted,
    like Egg, Inc.'s artifact list.
  - **Craft.**
  - **Crews:** tiers, stars and progress to the next crew.
- **Return reveal:** a loot reveal, with relic cards flipping in and a glow by
  rarity. A Legendary gets a big moment and confetti.
- **Welcome Back** adds "Expeditions returned: 3 (1 Epic!)".
- **Share text** adds the best relic: "🌀 Legendary Bacon Prism".

## 7. Data and contract sketch (finalised when v6 starts)
- `GameState.portal`:
  - `built`
  - `slots: Expedition[]`
  - `crews: Record<crewId, {runs, stars}>`
  - `relics: Relic[]` (inventory)
  - `equipped: (relicId | null)[4]`
  - `stones`
  - `craftXp`
- `Relic`: `{ id, family, tier, rarity, stones: StoneId[] }`.
- `Expedition`: `{ crewId, dimensionId, length, launchedAt, returnsAt, loot? }`
  (the loot is rolled at launch from a seeded RNG, so it can't be save-scummed).
- Stats: relic effects fold into the existing `Stat` set. Mult stats multiply
  and add stats add, the same as everything else.

## 8. Build order
Build v6 **after the v5 engine work lands**:
1. Engine: the portal, expeditions, loot and crafting, plus tests.
2. UI: the panel and the portal art in the scene.
3. Balance v5 + v6 together, as one pass that includes relics.
4. Browser QA, then republish the play link.

## 9. Balance results
Measured with `scripts/balance.ts` (docs/10 §6), seed 12345, AFK+Daily unless
noted. The same run fixes the Find gates, so relics are inside the fitted timeline.

| Check | Result | Target |
|---|---|---|
| Relic power at day 30 (Park Value ratio with / without the equipped relics, max-zoomies factor removed) | ×1.9 (raw product of the multiplier relics ×2.1) | ×2–3 |
| Relic power at day 100 | ×7.7 (raw ×23: shipping and rescue relics count there but not in the Park Value) | ×5–10 |
| Portal built | day 0.58 (Rawhide era after the first prestige) | day 1–2 |
| Expeditions in 111 days | 688 launched, 452 skipped for lack of fuel cash, 685 collected | 3 slots kept busy |
| Crafts / recycles | 126 / 823 | |
| Crew runs (crews 1–6) | 21 / 70 / 102 / 233 / 252 / 7 | |
| Best relic tier | T4 (the first T4 relics appear in the first month, driven by the craft chain) | |
| Golden Bones from loot / recycling | 840 / 1,260 over 111 days (≈ 8 + 11 per day) | a small share of the Academy's 19.6k |

What the bot does: launches the plan with the best (loot × quality) per hour that
returns by a check-in (rotating through the three dimensions that favour the
families it values), pays Treat Fuel in cash and skips a slot it cannot afford,
crafts 3 → 1 whenever it can pay the fee, equips the four best families by the
estimated change in income and Park Value (one relic per family) and recycles
dominated T4 relics and any family/tier stack above 9. It does not socket stones.

**Changes (data only, `src/data/portal.ts`)**
| What | First draft | Now | Why |
|---|---|---|---|
| Crew unlock runs (2…6) | 6 / 10 / 15 / 20 / 30 | 20 / 50 / 100 / 150 / 250 | crews 5–6 were open on day 14 and handed out T4 relics (×8) by day 20 |
| Loot per run | short 1…4, standard 2…8, long 4…16 | short 1, standard 1/1/1/2/2/2, long 2/3/4/5/6/8 | the bot launched ~6 runs a day and recycled 3,000 relics worth 72k 🦴 (Academy maxed on day 60) |
| Grid of layRate / findValue | geometric over 16 cells, +5% → +100% | `0.025 × 3.3^tier × 1.3^rarity` (T1 Common +2.5%, T4 Common +90%, T4 Legendary +197%) | tier, not rarity luck, drives power; the big numbers wait behind the craft chain |
| Other families | +5% … | +3% … (shipping, rescue); the rest unchanged | |
| Rarity odds T3 / T4 Legendary | 2% / 5% | 1% / 2% | one lucky roll was worth ×2 at day 20 |
| `RARITY_STAR_BOOST`, craft-XP boost cap | 0.25, 1.5 | 0.08, 0.4 | same |
| `STAR_CAPACITY_BONUS` | 0.12 | 0.08 | |
| Fuel (short / standard / long) | 300 / 1,800 / 7,200 s of income | 1,200 / 7,200 / 28,800 s | expeditions are now a spending decision; the bot often picks shorter plans |
| Craft fee (T1→2 / 2→3 / 3→4) | 900 / 3,600 / 14,400 s of income | 5,400 / 21,600 / 86,400 s | T4 relics arrived on day 14 |
| Recycle bones (T1…T4 × Common…Legendary) | `[1,1,2,4] [2,3,6,12] [4,8,15,30] [10,20,40,80]` | `[1,1,1,2] [1,1,2,3] [1,2,3,4] [1,2,3,4]` | every recycle now pays at least 1 🦴 (the UI showed "+0"); top end cut so recycling stays a small income |

The relic budget is noisy, because a few Epic or Legendary rolls move it
noticeably between seeds (seed 4 reached ×13 at day 100 against ×7.7 on seed 12345).
The figure is a Park Value ratio, so relic families that only act through other
stats (shipping, kennel capacity, rescue, jar hours) are not counted; the "raw
product" counts every multiplier relic.
