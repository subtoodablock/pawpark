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
- **Kennels:** `cost_t = 50 × 40^t` (balance may smooth it). Capacities are
  unchanged.
- **Vehicles:** `cost_t = 100 × 150^t` over 13 tiers (balance may smooth it).
- **Duplicate pricing:** per-tier growth `DUPLICATE_GROWTH_BY_TIER[t]`, 1.35 for
  low tiers and rising to ×3–5 for the top three tiers. This replaces the single
  constant.
- **Training:**
  - Add tiers 6 and 7, about 10 items, with base costs around 1e22 and 1e26 and
    ending near 1e30.
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
- `PARK_VALUE_SECONDS` stays the tuning constant.

### 2.3 Gates (starting table; the balance pass refits them)
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
  Treats.

### 2.5 Prestige
- `gain = floor(f(runEarnings))`, a **piecewise** curve with exponent ~0.3 below
  `PRESTIGE_KNEE` (≈1e12) so the first prestiges feel big, then 0.2 above it,
  continuous at the knee.
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
  `SHOW_CALIBRATION_DAYS = 4`. The goals are 0.35×, 0.8× and 1.25× the
  delivered total.
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
