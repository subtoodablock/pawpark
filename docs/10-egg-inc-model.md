# Paw Park v5: the Egg, Inc. model

This builds on the research report `reports/Egg Inc incremental design flow.md`
and the designer's decisions of 2026-10-14:
- **Flat prices**, as in Egg, Inc.
- **Weekly Dog Show**, **Pup Rank**, **sled cars** on the top truck, and an
  **offline rescue boost**.

It replaces the `costScale` part of `08-find-eras.md`. The era reset itself
stays, because Egg, Inc. upgrades are soft resets. Where this doc conflicts with
02/04/06/08, this doc wins.

## 1. Where difficulty comes from (the core change)

| | v4 (dropped) | v5 (Egg, Inc.) |
|---|---|---|
| Prices in era k | × costScale_k | **The same in every era.** `costScale = 1` everywhere. The field stays as an optional ≤ ×1.5 tax. |
| Upgrading the Find | Restart with value ×5 and prices ×5–8, so the park ends up about 20% poorer | Restart with value ×4–5 and the same prices. The bottom of the ladder now feels trivially cheap, a power spike that automation plays as a quick rebuild. |
| The wall | Price terrain | **Park Value gates** rising from ×15 to ×1,000 per Find, much faster than value. You reach tiers you have never reached before, so Planet Paw is first *seen* in a late era. |
| Ladder length | Kennels ×12/tier, Training topping out around 1e17 | Kennels **×40/tier** (Planet Paw ≈ 8.6e28), vehicles **×150/tier** (top ≈ 1e28), Training tiers 6–7 ending near 1e30 |

## 2. Economy rules

### 2.1 Price ladders (`src/data`)
- **Kennels:** `cost_t = 50 × 40^t × KENNEL_EXTRA_GROWTH^max(0, t−3)`. The v5
  balance pass steepened the upper ladder (`KENNEL_EXTRA_GROWTH = 3.62`, see §6),
  so Planet Paw is ≈ 1e37 instead of 8.6e28. Capacities are unchanged.
- **Vehicles:** `cost_t = 100 × 150^t × VEHICLE_EXTRA_GROWTH^max(0, t−3)` over 13
  tiers (`VEHICLE_EXTRA_GROWTH = 3`).
- **Duplicate pricing:** per-tier growth `DUPLICATE_GROWTH_BY_TIER[t]`, 1.35 for
  low tiers and rising to ×3–5 for the top three tiers. This replaces the single
  constant.
- **Training:**
  - Add tiers 6 and 7, about 10 items, with base costs around 1e22 and 1e26 and
    ending near 1e30. Balance knob: tier T ≥ 3 base costs are multiplied by
    `TRAINING_TIER_COST_SCALE^(T−2)` (= 20, §6).
  - Tier gates are cumulative levels: 0/12/40/85/130/185/250 (tunable).
  - Each tier gets a few **doublers**, items that give ×2 per level (multiply per
    level, max 2–3 levels, expensive). These follow Egg, Inc.'s Bigger Eggs
    pattern and act as wall-breakers. They need a new effect mode `'double'` on
    the def (`multPerLevel`). See the contract.
  - Growth is ×1.3–1.6 for % items and ×2–4 for flat items.

### 2.2 Park Value (Egg, Inc. structure)
```
shipFrac   = min(1, shipPerSec / digPerSec)
popTerm    = pups·shipFrac + 0.2·pups·(1−shipFrac) + emptyKennelSpace^0.6
             + 0.25 · rescuePerMin · builtKennels · offlineCapMin
parkValue  = findValue · digPerPupPerSec · earningsBonus · maxZoomieMult · popTerm · PARK_VALUE_SECONDS
```
- `maxZoomieMult` uses **max** zoomies, not current ones. Active play then counts
  for gates without being required. No treats.
- `PARK_VALUE_SECONDS` stays the tuning constant (150: with calibrated gates it
  only rescales the gate numbers).
- The three popTerm weights are constants in `src/data/constants.ts`
  (balance pass): `PV_UNSHIPPED_WEIGHT = 0.2`, `PV_EMPTY_SPACE_EXP = 0.5` (was
  0.6) and `PV_RESCUE_FACTOR = 0.03` (was 0.25). With 0.25 the rescue-potential
  term was about 90% of the popTerm in the late game, so a freshly rebuilt park
  with empty kennels already "was worth" its endgame size and the gates fell
  almost for free (Cosmic Bone after 12 hours).

### 2.3 Gates (starting table; the balance pass refits them, see §6 for the table in use)
| Find | Value | Gate | Target (AFK+Daily) |
|---|---|---|---|
| Tennis Ball | 1.25 | 1.2e4 | 10 min |
| Squeaky Toy | 6.25 | 2.3e5 | 30 min |
| Rawhide | 30 | 5.8e6 | 2 h |
| Lost Wallet | 150 | 2.3e8 | end of day 1 |
| Pirate Coin | 700 | 1.4e10 | day 2–3 |
| Dino Fossil | 2,750 | 1.4e12 | day 5 |
| Crystal Bone | 1.1e4 | 2.1e14 | day 9 |
| Meteorite | 4.2e4 | 5.3e16 | day 15 |
| Ancient Relic | 1.65e5 | 2.1e19 | day 24 |
| Moon Rock | 6.5e5 | 1.3e22 | day 36 |
| Time Bone | 2.5e6 | 1.0e25 | day 52 |
| Cosmic Bone | 1e7 | 1.0e28 | day 75 |
| **Endgame**: 4 full Planet Paws, Academy maxed | | | **day 100–120** |

**Discovery tease:** a Find counts as "discovered" (shown in the carousel, no
longer "???") once `parkValue ≥ gate / 6.5`, as Egg, Inc. does with "discover"
versus "upgrade".

### 2.4 Rescue fill (the urgent fix)
- Add a **multiplicative Rescue line**: Training items with stat `rescueMult`
  (mult).
- Add the Academy item **Calm Kennels**, stat `offlineRescueMult`, applied
  **only while offline**. It gives ×3 at max, the equivalent of Egg, Inc.'s
  Internal Hatchery Calm.
- Target: an endgame fill of 4 Planet Paws in **2–4 days AFK**, and hours with
  Treats. Balance pass: Pup Portals +4,500 rescue/min per level (was 100).

### 2.5 Prestige
- `gain = floor(f(runEarnings))`, a **piecewise** curve with exponent 0.3 below
  `PRESTIGE_KNEE` so the first prestiges feel big, then a lower exponent above
  it, continuous at the knee. Balance pass values: `PRESTIGE_KNEE = 1e10`,
  `PRESTIGE_EXP_LATE = 0.12` (was 1e12 and 0.2: at 0.2 the paws, and with them the
  earnings bonus, outran every price ladder after the first day),
  `DEFAULT_AUTO_PRESTIGE_THRESHOLD = 0.25` (was 0.5).
- `+N 🐾 on prestige` shows live (already built).

### 2.6 Pup Rank (friend-comparison status)
- `pupRank = floor(log10(earningsBonus × 100))`, the earnings bonus expressed as
  a percent, as with Egg, Inc.'s farmer roles.
- `PUP_RANK_TITLES`: Pup, Pup II, Pup III, Kilopup, Kilopup II, Kilopup III,
  Megapup …, Gigapup, Terapup, Petapup, Exapup, Zettapup, Yottapup, then
  Legendary Pup.
- Shown next to Park Level in the HUD, and included in the share text.

### 2.7 Sled cars (Hyperloop equivalent)
- The **top vehicle tier** becomes the **Sled Express**: a team sled whose cars
  each carry the tier's `capacityPerMin`.
- A slot holding the top tier starts with 1 car. "Add a car" costs
  `topTierCost × CAR_COST_GROWTH^(carsInSlot)`.
- Max cars per slot = `BASE_MAX_CARS (5) + A(sledCars)`, where Training's
  "Longer Sleds" adds +5.
- State: `vehicleCars[slot]`.

### 2.8 Legend Collars (prophecy eggs): more sources, still scarce
- Trophies: the existing source.
- **Calendar:** a collar every 28th consecutive streak day (1 per "month").
- **Dog Show:** the 3rd medal (§3).
- Target total: about 40–60 collars over 4 months (1.05^50 ≈ 11.5×).

## 3. Weekly Dog Show (the Egg, Inc. contract)
A **separate, temporary show park** runs alongside your home park. It is the
weekly reason to come back, and something to compare with friends.

**Show (same for everyone each week):**
- It opens **Monday 00:00 local** and closes **Sunday 23:59** (ISO week key
  `YYYY-Www`).
- The Featured Find is picked by `seededRng(hash(weekKey))` from Finds 0…max(2,
  highestFindIndex). It has a fun name, e.g. "The Great Tennis Ball Fetch-Off".

**Joining:**
- Joining creates `state.show = { weekKey, findIndex, joinedAt, goals[3], medals, park }`.
- `park` is a **full `GameState`** for a fresh park on the featured Find: Stick
  layout, $0, era-start cash, no training.
- Its meta fields (academy, spiritPaws, legendCollars, premium.shop,
  automation) are **mirrored from home** at each step. That way your Earnings
  Bonus and Academy help, as Egg, Inc. contracts use your EB and epic research.
- The show park has **no** Find upgrades, prestige, daily, mail, squirrels,
  trophies or stars of its own.

**Goals:**
- Goals count total Finds delivered in the show park
  (`park.stats.findsDelivered`).
- Targets are calibrated **at join time** by a deterministic headless sim. The
  engine simulates the show park AFK, with automation as owned, for
  `SHOW_CALIBRATION_DAYS = 7` (was 4; a 4-day reference made a 7-day show 3–6×
  too easy because a fresh park still grows exponentially). The goals are 0.55×,
  1.0× and 1.55× the delivered total (first draft 0.35 / 0.8 / 1.25).
- The third goal needs more than pure AFK: whistle sessions, treats, joining on
  Monday, or check-ins to buy.

**Medals and rewards** (claimed per goal):

| Medal | Reward |
|---|---|
| 🥉 | 10 🦴 |
| 🥈 | a free Bacon Strip + 15 🦴 |
| 🥇 | **1 Legend Collar** + 25 🦴 |

**Simulation and lifecycle:**
- The show park ticks inside `stepSimulation`, online and offline, using the same
  code (a recursive step on `state.show.park`).
- At the week's end, unclaimed completed goals are auto-claimed on the next
  refresh and the show closes (`showEnded` event).
- `showHistory` keeps the last 12 weeks: `{ weekKey, findIndex, medals }`.

**UI:**
- A **Dog Show tab** in the Find panel, in Egg, Inc.'s Contracts slot.
- When joined, a "Switch to Show Park" toggle makes the HUD, scene and shops act
  on the show park. Its HUD tint is gold so players always know which park they
  are on.

**Sharing:** the share text adds `🏆 Dog Show: 🥇🥈⬜`.

**Co-op:** pooling with friends needs a server, so it is deferred and left out of
this build. The weekly show is the same for everyone, so friends can still
compare medals.

## 4. Contract (`types.ts` v5), see the file
New fields and types:
- New stats: `rescueMult` and `offlineRescueMult` (mult), `sledCars` (add).
- `UpgradeDef.multPerLevel?`, the doubler effect.
- `GameState`: `vehicleCars`, `show`, `showHistory`.
- `GameStats.findsDelivered`.
- `DerivedStats`: `pupRank`, `pupRankTitle`, `maxCars`, `discoveredFind`.
- New events: `calendarCollar`, `showGoalReached`, `showEnded`.
- The save version is 5.

## 5. Balance v5 targets
- The `docs/06` §10 profiles and caps are unchanged: Daily ≤1.5×, Active ≥0.7×,
  Whale ≥0.75×, Minnow ≥0.92×, drought ≤3 d.
- The §2.3 timeline and the endgame at day 100–120 for AFK+Daily.
- The bot joins the Dog Show at its first check-in each Monday and claims
  medals. Report medals per week by profile:
  - AFK+Daily usually gets 🥉🥈.
  - Active usually gets 🥇.
- Collars total by day 120: 40–60.
- The Rescue fill of an endgame park takes 2–4 days AFK.
- Each era begins with a fast rebuild: automation rebuilds to the previous era's
  peak kennel tiers within ≤ 15% of the era's length.

## 6. Balance results
Bot: `scripts/balance.ts` v4, seed 12345, `npm run balance` (all six profiles,
about 3.5 minutes; the AFK+Daily bot runs on to the endgame). Simulated days start
Thu 2026-01-01 18:00 UTC. The bot now builds and upgrades the Portal, runs three
expeditions sized to the next check-in, equips the best four relics by estimated
value, crafts 3→1, recycles dominated top-tier relics, joins the Dog Show at the
first check-in each Monday, claims medals, and Active plays the show park's whistle
inside its window. `--calibrate [--write]` fits the Find gates (below), `--fit`
prints the Park Level thresholds.

### 6.1 How the gates were set (and why they are not the §2.3 table)
With the §2.3 table and unmodified ladders the AFK+Daily bot reached the Cosmic
Bone after 12 hours. The saturated park (kennels, training, vehicles) is worth
about 1e17 times the starting park, the training ladders alone multiply to ~1e11,
and the earnings bonus grows by orders of magnitude in the first days, so any
gate that is cheap relative to that falls at once. The fix has three parts:
1. **Park Value weights** (rescue term 0.25 → 0.03, empty-space exponent
   0.6 → 0.5) so a rebuilt, empty park is worth what it has actually built.
2. **Steeper price ladders** so the upper tiers cost days of income instead of
   minutes: kennel extra growth ×3.62 per tier from tier 4 (Planet Paw 5.7e36),
   vehicle extra growth ×3 (top tier 2.6e32), training tiers ≥ 3 ×20^(tier−2)
   (tier 7 bases 3e32…1e34).
3. **Gates calibrated by the bot.** `--calibrate` runs the AFK+Daily bot with all
   later gates off and records the running maximum Park Value inside era k−1. The
   gate is the record that opens closest to the §2.3 target day. This is
   one simulation per gate (about 2.5 minutes for all twelve); the gate is the
   same Park Value the bot actually reaches on that day, so it is exact for the
   seed it was fitted on.

### 6.2 Gate table in use
| Find | Value | Gate (`unlockParkValue`) | §2.3 first draft | Target day | AFK+Daily result |
|---|---|---|---|---|---|
| Tennis Ball | 1.25 | 1.31e4 | 1.2e4 | 10 min | 10.2 min |
| Squeaky Toy | 6.25 | 6.10e5 | 2.3e5 | 30 min | 31.0 min |
| Rawhide | 30 | 6.36e5 | 5.8e6 | 2 h | 2.0 h |
| Lost Wallet | 150 | 8.50e10 | 2.3e8 | day 1 | day 1.0 |
| Pirate Coin | 700 | 4.73e13 | 1.4e10 | day 2–3 | day 2.5 |
| Dino Fossil | 2,750 | 9.49e14 | 1.4e12 | day 5 | day 4.7 |
| Crystal Bone | 1.1e4 | 5.59e17 | 2.1e14 | day 9 | day 9.8 |
| Meteorite | 4.2e4 | 1.50e20 | 5.3e16 | day 15 | day 15.2 |
| Ancient Relic | 1.65e5 | 8.80e23 | 2.1e19 | day 24 | day 24.0 |
| Moon Rock | 6.5e5 | 1.17e29 | 1.3e22 | day 36 | day 35.0 |
| Time Bone | 2.5e6 | 2.26e35 | 1e25 | day 52 | day 50.6 |
| Cosmic Bone | 1e7 | 1.29e41 | 1e28 | day 75 | day 75.1 |

The ratios between gates are uneven (the Park Value is a staircase that jumps at
each prestige), and the Squeaky → Rawhide gate is only 4% higher: at B = 1 the
Squeaky era's park saturates, so Rawhide waits for the first prestige's bonus.
Re-run `--calibrate --write` after any change to ladders, prestige, relics or
the Academy; one pass moves the milestones by well under a day.

### 6.3 AFK+Daily (primary)
| Milestone | Result | Target |
|---|---|---|
| Tennis / Squeaky / Rawhide | 10.2 min / 31 min / 2.0 h | 10 min / 30 min / 2 h |
| Lost Wallet … Cosmic Bone | see §6.2 | §2.3 |
| First prestige | 4.5 h | day 0–1 |
| Retirement Planner (1,000 🦴) | day 13.8 | day 10–20 |
| Collars | 49 at day 108 (trophies 44, calendar 3, Dog Show 2) | 40–60 by day 120 |
| Dog Show medals (14 weeks) | 🥉🥈 in 10, 🥇 in 2, 🥉 in 2 (mean 2.00) | AFK+Daily usually 🥉🥈 |
| Relic power (Park Value ratio, zoomies excluded) | ×2.1 at day 30, ×7.5 at day 100 | ×2–3, ×5–10 |
| Endgame | 4 Planet Paws day 105.3, Academy maxed day 108.0 | day 100–120 |
| Rescue fill of an empty 4-Planet-Paw park, offline | 2.8 days | 2–4 days |
| Era rebuild / era length | median 2.3%, p90 18.6% (83 eras ≥ 30 min) | median ≤ 15% |
| Longest drought | 3.00 d (day 10.8) | ≤ 3 d |
| Longest Academy drought | 1.4 d | ≤ 2 d |
| Park Lv day 1 / 14 / 50 / Lv 100 | 20 / 41 / 72 / day 75.3 | ≥ 20 / ~40 / ~70 / Cosmic ±5 |

Collars are counted at the last simulated day (the run stops when the endgame is
complete); trophies already give all 44 by then, so day 120 adds at most one
calendar collar.

### 6.4 Ratios to AFK+Daily (Cosmic Bone day), seeds 1–4 and 12345
| Profile | 12345 | 1 | 2 | 3 | 4 | cap |
|---|---|---|---|---|---|---|
| AFK+Daily (day) | 75.1 | 80.3 | 78.8 | 75.3 | 74.7 | window 70–80 |
| AFK, no dailies (info) | 1.22 | 1.08 | 1.06 | 1.29 | 1.16 | none |
| Daily | 1.49 | 1.38 | 1.24 | 1.39 | 1.39 | ≤ 1.5 |
| Active | 1.02 | 0.93 | 0.94 | 0.99 | 0.97 | ≥ 0.7 |
| Minnow | 0.96 | 1.01 | 0.97 | 0.99 | 1.08 | ≥ 0.92 |
| Whale | 0.84 | 0.81 | 0.76 | 0.79 | 0.80 | ≥ 0.75 |

Cosmic Bone day per profile, seed 12345: AFK+Daily 75.1, AFK 91.4, Daily 112.1,
Active 76.3, Minnow 72.3, Whale 63.4.

Per-find days, seed 12345:
| Find | AFK+Daily | AFK | Daily | Active | Minnow | Whale |
|---|---|---|---|---|---|---|
| Lost Wallet | 1.0 | 1.1 | 1.8 | 0.7 | 1.0 | 0.7 |
| Pirate Coin | 2.5 | 2.5 | 3.6 | 1.9 | 2.5 | 1.3 |
| Dino Fossil | 4.7 | 6.2 | 6.4 | 4.6 | 4.6 | 2.2 |
| Crystal Bone | 9.8 | 11.5 | 10.0 | 9.0 | 8.0 | 4.7 |
| Meteorite | 15.2 | 15.8 | 16.1 | 12.3 | 12.2 | 8.1 |
| Ancient Relic | 24.0 | 26.4 | 29.6 | 18.9 | 21.6 | 15.1 |
| Moon Rock | 35.0 | 39.2 | 51.8 | 30.8 | 35.4 | 23.6 |
| Time Bone | 50.6 | 61.6 | 80.1 | 51.0 | 55.0 | 43.6 |
| Cosmic Bone | 75.1 | 91.4 | 112.1 | 76.3 | 72.3 | 63.4 |

The gates were fitted on seed 12345; other seeds move the AFK+Daily Cosmic day by
−0.4…+5.2 days and the Time Bone by up to +8 days (seed 1: day 60, window
45–59). The Daily margin is thin on the fitted seed (1.49).

### 6.5 Dog Show
Medals per week, seed 12345 (mean medals, share of weeks with 🥇):
AFK+Daily 2.00 (14%), AFK 2.08 (33%), Daily 1.73 (7%), Active 1.70 (0%),
Minnow 2.11 (11%), Whale 2.63 (63%). The AFK+Daily week string is
`22221322223212`.

**FAIL: Active does not usually get 🥇.** The show park is rescue-limited and
Calm Kennels (×3, only while offline) is what fills it, so an online Active
player is slower in the show park than an AFK player; the whistle adds a few
pups per second to a park that rescues millions. The bot's Active profile
whistles in the show park every minute of its window and still earns 0–22% 🥇.
This needs an engine change (see §6.8), not a data change.

### 6.6 Relic power and Pup Rank by day (AFK+Daily)
| Day | 1 | 7 | 14 | 28 | 42 | 56 | 70 | 84 | 100 | 108 |
|---|---|---|---|---|---|---|---|---|---|---|
| Relic power (PV ratio) | ×1.03 | ×1.25 | ×1.15 | ×2.12 | ×4.00 | ×5.91 | ×7.49 | ×7.49 | ×7.49 | ×7.49 |
| Raw relic product (mult stats) | ×1.02 | ×1.35 | ×1.35 | ×2.34 | ×4.98 | ×9.86 | ×9.82 | ×9.82 | ×9.82 | ×12.18 |
| Pup Rank | 2 | 3 | 4 | 5 | 6 | 7 | 7 | 8 | 8 | 8 |
| log10 earnings bonus | 0.6 | 1.6 | 2.2 | 3.4 | 4.2 | 5.0 | 5.9 | 6.6 | 6.8 | 6.9 |
| Collars | 2 | 8 | 11 | 26 | 31 | 39 | 42 | 49 | 49 | 49 |
| Find reached | 4 | 6 | 7 | 9 | 10 | 11 | 11 | 12 | 12 | 12 |
| Spirit Paws | 31 | 288 | 965 | 5,762 | 14,069 | 42,938 | 131,049 | 255,957 | 319,947 | 319,947 |

### 6.7 Data changes in this pass
| file | change | why |
|---|---|---|
| `constants.ts` | `PV_RESCUE_FACTOR` 0.25 → 0.03, `PV_EMPTY_SPACE_EXP` 0.6 → 0.5 (new constants, `PV_UNSHIPPED_WEIGHT` 0.2) | the rescue-potential term dominated the Park Value |
| `constants.ts` | `PRESTIGE_KNEE` 1e12 → 1e10, `PRESTIGE_EXP_LATE` 0.2 → 0.12, `DEFAULT_AUTO_PRESTIGE_THRESHOLD` 0.5 → 0.25 | earnings bonus outran the ladders; more, smaller prestiges give a 3–7 day late rhythm and more park-prestige trophies |
| `constants.ts` | `KENNEL_EXTRA_GROWTH` 3.62, `VEHICLE_EXTRA_GROWTH` 3, `LADDER_STEEP_FROM` 3, `TRAINING_TIER_COST_SCALE` 20 (new knobs, `kennels.ts`, `vehicles.ts`, `training.ts` derive the costs) | price terrain for the upper tiers |
| `constants.ts` | `ACADEMY_LADDER_COST_SCALE` 1.25 (new) and re-costed ladders in `academy.ts`: epic digging / kibble 5 × 1.075^l, spirit bond 10 × 1.075^l, legend lore 25 × 1.075^l and 0.0015 per level (was 0.005), squirrel hound, spotter, zoomies, discounts at ~1.09–1.12; Retirement Planner 600 → 1,000 🦴 | the full Academy cost 305k 🦴 against a flow of ~17k by day 100. It now costs 18.4k; legend lore at 0.005 per level made 50 collars worth ×9,000 |
| `training.ts` | Pup Portals +100 → +4,500 rescue per min per level | endgame rescue fill 32 days → 2.8 days |
| `finds.ts` | gates 1–12 refitted (§6.2) | §6.1 |
| `daily.ts` | `PARK_LEVEL_THRESHOLDS` refitted with `--fit` | Cosmic day moved |
| `show.ts` | `SHOW_CALIBRATION_DAYS` 4 → 7, goal fractions 0.35/0.8/1.25 → 0.55/1.0/1.55 | AFK+Daily gets 🥉🥈, whales and lucky weeks 🥇 |
| `portal.ts` | crew unlock runs 6/10/15/20/30 → 20/50/100/150/250; loot per run 1–4 items instead of 1–16; layRate / findValue relics use a tier-driven grid; rarity odds, crew-star and craft-XP boosts reduced; fuel ×4 (1,200 / 7,200 / 28,800 s of income); craft fee ×6; recycle bones ÷4 | docs/11 §9 |

### 6.8 Needs an engine change (not done: data-only brief)
1. **Dog Show: online play cannot beat AFK.** Options: apply Calm Kennels to the
   show park while online, or let `stepShow` give online ticks a rescue/dig boost,
   or count zoomies in the delivered total. Until then Active medals ≈ AFK medals.
2. `formatNumber` falls back to exponent notation above 1e42; the gates reach
   1.3e41 and endgame income is ~1e34 per second, which fits, but the next
   ladder extension will not.
