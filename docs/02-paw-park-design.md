# Paw Park — Game Design

An idle/incremental browser game built on the Egg, Inc. framework (see
`01-egg-inc-teardown.md`). You run a dog park. Pups dig up **Finds**
(sticks, balls, … cosmic bones), a delivery fleet ships them, and you sell them.

The tables in §4 and the constants in §5 were updated to match `src/data/*` after
the v2 balance pass (`scripts/balance.ts` and `scripts/wall.ts`, results in
`04-long-game-afk.md` §7). Any tuning must be made in `src/data/*`, never
hard-coded in engine logic. Where §3 differs from the v2 engine (automation, full
offline simulation, the mailbox count, the squirrel hound, trophies v2),
`04-long-game-afk.md` is authoritative.

---

## 1. Concept mapping

| Egg, Inc. | Paw Park | Notes |
|---|---|---|
| Chickens | **Pups** | population |
| Hatchery button | **Whistle** (adopt) | tap = 1 pup, hold = continuous |
| Hatchery stock/refill | **Adoption Center** stock / refill | |
| Internal hatchery | **Rescue Program** | passive pups/min per built kennel |
| Running Chicken Bonus | **Zoomies** | combo bonus from fast adopting |
| Habs (4 slots) | **Kennels** (4 slots) | 18 tiers |
| Eggs laid | **Finds dug up** | per-pup dig rate |
| Vehicles | **Delivery Fleet** | 4 slots base, up to 12 |
| Egg types | **Find types** | 13-step value ladder |
| Farm Value | **Park Value** | gates find upgrades |
| Common Research | **Training** | 5 tiers, resets on prestige |
| Soul Eggs | **Spirit Paws** | prestige currency |
| Prophecy Eggs | **Legend Collars** | from trophies, compounds paw bonus |
| Golden Eggs | **Golden Bones** | meta currency |
| Epic Research | **Academy** | permanent |
| Boosts | **Treats** | timed multipliers |
| Drones | **Squirrels** | tap to catch for a reward |
| Gifts | **Mail** | arrives every 5 min |
| Silos | **Treat Jar** | offline earnings cap (hours) |
| Prestige | **Open a New Park** | |

## 2. Units and conventions

- Time is in **seconds** inside the engine. Rates in data tables are **per minute**
  where noted (`capacityPerMin`) because the numbers are easier to read.
- Money is a JS `number` (double). The values here stay far below 1e308.
- "Multiplicative stat": each upgrade item gives `1 + perLevel × level`, and items
  for the same stat **multiply** together.
- "Additive stat": each item gives `perLevel × level`, and items **sum**.
- Every stat's mode is fixed globally (see `STAT_MODES` in §6). An upgrade def
  can't change it.

## 3. Core formulas (authoritative)

```
kennelCapacity   = Σ_slots KENNELS[tier].capacity × M(kennelCapacity)
fleetSlots       = BASE_FLEET_SLOTS + A(fleetSlots)                    (≤ MAX_FLEET_SLOTS)
shipPerSec       = Σ_slots VEHICLES[tier].capacityPerMin / 60 × M(shippingCapacity)
digPerPupPerSec  = BASE_DIG_PER_MIN / 60 × M(layRate) × boost(layRate)
digPerSec        = pups × digPerPupPerSec
deliveredPerSec  = min(digPerSec, shipPerSec)
findValue        = FINDS[findIndex].value × M(findValue)
earningsBonus    = 1 + spiritPaws × pawBonus × collarMult
  pawBonus       = BASE_SPIRIT_PAW_BONUS + A(spiritPawBonus)
  collarMult     = (BASE_COLLAR_BONUS + A(collarBonus)) ^ legendCollars   // base 1.05
maxZoomies       = BASE_MAX_ZOOMIES + A(maxZoomies)
zoomieMult       = 1 + floor(zoomies) × (BASE_ZOOMIE_BONUS + A(zoomieBonus))
incomePerSec     = deliveredPerSec × findValue × earningsBonus × zoomieMult × boost(earnings)
parkValue        = deliveredPerSec × findValue × earningsBonus × PARK_VALUE_SECONDS
                   (no zoomies, no boosts → stable)
adoptionCap      = BASE_ADOPTION_CAP + A(adoptionCap)
adoptionRefill   = (BASE_ADOPTION_REFILL + A(adoptionRefill)) × boost(adoption)   // stock/sec
rescuePerSec     = builtKennels × A(rescueRate) / 60 × boost(adoption)           // rescueRate is pups/min/kennel
costMultiplier   = 1 - A(researchDiscount | kennelDiscount | fleetDiscount)      // clamp ≥ 0.25
```

`M(stat)` is the product of every multiplicative source of that stat (training ×
academy). `A(stat)` is the sum of every additive source.

### 3.1 Tick (`dt` seconds)
1. Adoption stock: `stock = min(cap, stock + refill × dt)`.
2. Rescue: `pups = min(capacity, pups + rescuePerSec × dt)`.
3. Zoomies: `zoomieIdle += dt`. If `zoomieIdle > ZOOMIE_GRACE_SEC`, then
   `zoomies = max(0, zoomies − ZOOMIE_DECAY_PER_SEC × dt)`.
4. Earnings: `earned = incomePerSec × dt`. Add it to `cash`, `runEarnings`, and
   `lifetimeEarnings`.
5. Boosts: decrement `remaining`, remove expired ones, and emit `boostExpired`.
6. Squirrels: age the active ones and remove those past their lifetime. Decrement
   `squirrelTimer`. At ≤ 0, spawn one (if fewer than `MAX_ACTIVE_SQUIRRELS`), roll
   its reward now, and reset the timer to
   `rand(SQUIRREL_INTERVAL_MIN, MAX) / M(squirrelRate)`.
7. Mail: decrement `mailTimer`. At ≤ 0, set `mailReady = true`, emit `mailArrived`,
   and reset the timer to `MAIL_INTERVAL_SEC`. (The timer keeps running even when
   mail is already waiting, but it never stacks.)
8. Trophies: for each trophy not yet owned where `pups ≥ pupsRequired`, add it,
   add `collars` to `legendCollars`, and emit `trophy`.
9. If the next find just became affordable (`parkValue ≥ next.unlockParkValue`)
   and it wasn't before, emit `findUpgradeAvailable` once per index.

The tick has to give the same result whether you call it with `dt = 10` or with
`dt = 0.1` 100 times (within ~1%). Large offline `dt` is handled by chunking in
`offline.ts`.

### 3.2 Adopting (whistle)
`adopt(state, n, fromTap)`:
- `k = min(n, floor(stock), floor(capacity − pups))`. If `k ≤ 0`, return 0 and
  leave zoomies unchanged.
- `pups += k`, `stock −= k`, `stats.totalAdopted += k`.
- If `fromTap`: `zoomies = min(maxZoomies, zoomies + k)` and `zoomieIdle = 0`.
- The UI calls `adopt(state, 1, true)` on each tap. While the button is held, it
  calls the same thing at `HOLD_ADOPT_PER_SEC`.

### 3.3 Purchases
- **Kennel slot** `i`: empty → tier 0, or tier `t` → `t+1` (if it exists). Cost =
  `KENNELS[next].cost × costMultiplier(kennelDiscount)`.
- **Vehicle slot** `i` (only when `i < fleetSlots`): same rule with `VEHICLES`.
- **Training** `id`: allowed if its tier is unlocked (`totalTrainingLevels ≥
  TIER.unlockAt`) and `level < maxLevel`.
  `cost(level) = baseCost × costGrowth^level × costMultiplier(researchDiscount)`.
- **Academy** `id`: paid in Golden Bones, `cost(level) = baseCost ×
  costGrowth^level`, rounded up to an integer. No discounts.
- **Find upgrade**: allowed if `findIndex + 1` exists and `parkValue ≥ next.unlockParkValue`.
  It sets `findIndex += 1`. If this is higher than `highestFindIndex` (an all-time
  record), the player also gets `next.unlockReward` Golden Bones and the record
  is updated.
- **Treat (boost)**: costs Golden Bones. Activating a treat that's already active
  **adds** to its remaining duration (it doesn't stack the multiplier).

Every purchase returns `{ ok: false, reason }` and does not touch state if it
can't be afforded or isn't allowed.

### 3.4 Squirrels (drones)
Spawn interval `rand(45, 90)s / M(squirrelRate)`, lifetime `SQUIRREL_LIFETIME_SEC = 7`.
The reward is rolled at spawn time:

| roll | reward |
|---|---|
| 60% | cash = `max(incomePerSec, MIN_SQUIRREL_CASH_RATE) × rand(30, 90)` (sec of income) |
| 35% | Golden Bones = `randInt(1, 3)` |
| 5%  | free treat: a random `BOOSTS` id, at 50% of its duration |

Cash is computed **at catch time**, using the stored seconds-of-income value.
`catchSquirrel` removes the squirrel and applies the reward. `stats.squirrelsCaught++`.

### 3.5 Mail (gifts)
`openMail(state, rng)` requires `mailReady`:

| roll | reward |
|---|---|
| 50% | Golden Bones `randInt(3, 10)` |
| 30% | cash = `max(incomePerSec, MIN_SQUIRREL_CASH_RATE) × 300` |
| 20% | free treat (full duration), random |

### 3.6 Prestige — "Open a New Park"
```
spiritPawsGain = floor( (runEarnings / PRESTIGE_DIVISOR) ^ PRESTIGE_EXPONENT )
```
This is available when the gain is ≥ 1. On prestige, `spiritPaws += gain` and
`prestigeCount++`. Then it **resets**: cash → `START_CASH`, pups → 0, stock → cap,
kennels → `[0, null, null, null]`, vehicles → `[0, null…]`, findIndex → 0,
training → {}, zoomies → 0, runEarnings → 0, active boosts cleared, squirrels
cleared. It **keeps**: goldenBones, academy, spiritPaws, legendCollars, trophies,
highestFindIndex, lifetimeEarnings, stats, mail state.

### 3.7 Offline progress (Treat Jar)
`applyOfflineProgress(state, now)`:
- `elapsed = (now − lastSaved)/1000`. If it's under 5 s, do nothing.
- `capped = min(elapsed, (BASE_OFFLINE_HOURS + A(offlineHours)) × 3600)`.
- Simulate `capped` seconds in chunks of `max(1, capped/600)` s. During this,
  zoomies are 0. Rescue runs at `OFFLINE_RESCUE_BASE + A(offlineRescue)` (≤ 1) of
  normal. Boosts tick down normally, and **do** apply while active. Squirrels
  don't spawn, and their timers don't run. The mail timer does run.
- It returns an `OfflineReport` for the "Welcome back" modal and sets `lastSaved = now`.

## 4. Content tables

These tables mirror `src/data/*` after the v2 balance pass (docs/04 §7). Large
numbers are in scientific notation. If the data and this doc disagree, the data
wins.

### 4.1 Kennels (`src/data/kennels.ts`) — 4 slots, start `[0, null, null, null]`
Cost grows ×12 per tier from tier 2 on, while capacity grows ×2–2.5.
| # | id | name | icon | capacity | cost |
|---|---|---|---|---|---|
| 0 | doghouse | Doghouse | 🏠 | 250 | 50 |
| 1 | twin_doghouse | Twin Doghouse | 🏘️ | 500 | 600 |
| 2 | kennel_shed | Kennel Shed | 🛖 | 1,000 | 7,200 |
| 3 | pup_barn | Pup Barn | 🛖 | 2,000 | 86,000 |
| 4 | bark_lodge | Bark Lodge | 🏡 | 5,000 | 1e6 |
| 5 | doggy_daycare | Doggy Daycare | 🏫 | 10,000 | 1.2e7 |
| 6 | pooch_plaza | Pooch Plaza | 🏬 | 20,000 | 1.5e8 |
| 7 | hound_hall | Hound Hall | 🏛️ | 50,000 | 1.8e9 |
| 8 | canine_complex | Canine Complex | 🏢 | 100,000 | 2.1e10 |
| 9 | woof_warehouse | Woof Warehouse | 🏭 | 200,000 | 2.6e11 |
| 10 | mutt_mansion | Mutt Mansion | 🏰 | 500,000 | 3.1e12 |
| 11 | tail_tower | Tail Tower | 🗼 | 1e6 | 3.7e13 |
| 12 | pupscraper | Pupscraper | 🏙️ | 2e6 | 4.5e14 |
| 13 | bark_bunker | Bark Bunker | ⛰️ | 1e7 | 5.3e15 |
| 14 | sky_kennel | Sky Kennel | ☁️ | 2.5e7 | 6.4e16 |
| 15 | orbital_kennel | Orbital Kennel | 🛰️ | 5e7 | 7.7e17 |
| 16 | moon_pound | Moon Pound | 🌙 | 1e8 | 9.2e18 |
| 17 | planet_paw | Planet Paw | 🪐 | 6e8 | 1.1e20 |

### 4.2 Fleet (`src/data/vehicles.ts`) — 4 slots base, max 12, start `[0, null…]`
Cost grows ×12 per tier from tier 3 on, while capacity grows ×3.
| # | id | name | icon | capacityPerMin | cost |
|---|---|---|---|---|---|
| 0 | bike_basket | Bike Basket | 🚲 | 300 | 100 |
| 1 | wagon | Red Wagon | 🛒 | 1,000 | 1,500 |
| 2 | scooter | Scooter | 🛵 | 3,000 | 30,000 |
| 3 | delivery_van | Delivery Van | 🚐 | 10,000 | 360,000 |
| 4 | pickup | Pickup Truck | 🛻 | 30,000 | 4.3e6 |
| 5 | box_truck | Box Truck | 🚚 | 100,000 | 5.2e7 |
| 6 | semi | Semi | 🚛 | 300,000 | 6.2e8 |
| 7 | double_semi | Double Semi | 🚛 | 1e6 | 7.5e9 |
| 8 | cargo_plane | Cargo Plane | ✈️ | 3e6 | 9e10 |
| 9 | bone_freighter | Bone Freighter | 🚢 | 1e7 | 1.1e12 |
| 10 | hover_hauler | Hover Hauler | 🛸 | 3e7 | 1.3e13 |
| 11 | rocket | Fetch Rocket | 🚀 | 1e8 | 1.5e14 |
| 12 | teleporter | Teleporter | 🌀 | 5e8 | 1.9e15 |

### 4.3 Finds (`src/data/finds.ts`)
Value ladder is ×5 per find early, easing to ×4 at the top. The gates
(`unlockParkValue`) were placed by the calibration loop in docs/04 §7.1 so that
find k is reached on its target day; they are not a smooth geometric series.
| # | id | name | icon | value | unlockParkValue | unlockReward (GB) |
|---|---|---|---|---|---|---|
| 0 | stick | Stick | 🪵 | 0.25 | 0 | 0 |
| 1 | tennis_ball | Tennis Ball | 🎾 | 1.25 | 25,000 | 10 |
| 2 | squeaky_toy | Squeaky Toy | 🧸 | 6.25 | 400,000 | 15 |
| 3 | rawhide | Rawhide Bone | 🦴 | 30 | 1.3e8 | 25 |
| 4 | lost_wallet | Lost Wallet | 👛 | 150 | 6.8e14 | 40 |
| 5 | pirate_coin | Pirate Coin | 🪙 | 700 | 1.1e20 | 60 |
| 6 | dino_fossil | Dino Fossil | 🦕 | 2,750 | 1e23 | 80 |
| 7 | crystal_bone | Crystal Bone | 💎 | 11,000 | 3.3e24 | 130 |
| 8 | meteorite | Meteorite | ☄️ | 42,000 | 6e25 | 180 |
| 9 | ancient_relic | Ancient Relic | 🏺 | 165,000 | 6.6e26 | 250 |
| 10 | moon_rock | Moon Rock | 🌑 | 650,000 | 1.1e28 | 350 |
| 11 | time_bone | Time Bone | ⏳ | 2.5e6 | 3.1e29 | 450 |
| 12 | cosmic_bone | Cosmic Bone | 🌌 | 1e7 | 6e30 | 600 |

Each find also has a one-line `flavor` string.

### 4.4 Training (`src/data/training.ts`) — resets on prestige
Tier unlocks are based on total training levels purchased:
T1 0, T2 12, T3 40, T4 85, T5 130.
Levels are capped low and costs rise steeply, so one park hits a wall within hours
(docs/04 §2, §7.3).

| tier | id | name | stat | perLevel | max | baseCost | growth |
|---|---|---|---|---|---|---|---|
| 1 | comfy_beds | Comfy Beds | layRate | 0.1 | 15 | 25 | 1.5 |
| 1 | premium_kibble | Premium Kibble | findValue | 0.1 | 15 | 40 | 1.5 |
| 1 | louder_whistle | Louder Whistle | adoptionCap | 20 | 10 | 60 | 1.6 |
| 1 | rescue_program | Rescue Program | rescueRate | 2 | 10 | 150 | 1.7 |
| 2 | bigger_holes | Bigger Holes | layRate | 0.1 | 12 | 10,000 | 1.8 |
| 2 | mud_wash | Mud Wash | findValue | 0.1 | 12 | 15,000 | 1.8 |
| 2 | extra_padding | Extra Padding | kennelCapacity | 0.1 | 10 | 20,000 | 1.8 |
| 2 | tune_ups | Tune-Ups | shippingCapacity | 0.1 | 10 | 20,000 | 1.8 |
| 2 | zoomie_training | Zoomie Training | zoomieBonus | 0.01 | 10 | 30,000 | 1.8 |
| 2 | quick_refill | Quick Refill | adoptionRefill | 0.5 | 10 | 30,000 | 1.8 |
| 3 | fleet_expansion | Fleet Expansion | fleetSlots | 1 | 8 | 3e7 | 3 |
| 3 | truffle_noses | Truffle Noses | layRate | 0.2 | 10 | 1e8 | 2 |
| 3 | appraisers | Appraisers | findValue | 0.2 | 10 | 1.5e8 | 2 |
| 3 | bunk_beds | Bunk Beds | kennelCapacity | 0.2 | 10 | 2e8 | 2 |
| 3 | rescue_network | Rescue Network | rescueRate | 5 | 10 | 3e8 | 2.1 |
| 4 | golden_retrievers | Golden Retrievers | findValue | 0.4 | 8 | 1e12 | 2.5 |
| 4 | excavators | Excavators | layRate | 0.4 | 8 | 1e12 | 2.5 |
| 4 | express_lanes | Express Lanes | shippingCapacity | 0.3 | 8 | 2e12 | 2.5 |
| 4 | pup_pods | Pup Pods | kennelCapacity | 0.3 | 8 | 3e12 | 2.5 |
| 4 | rescue_choppers | Rescue Choppers | rescueRate | 30 | 8 | 5e12 | 2.5 |
| 5 | quantum_fetch | Quantum Fetch | layRate | 1 | 6 | 1e17 | 3.5 |
| 5 | celebrity_pups | Celebrity Pups | findValue | 1 | 6 | 1e17 | 3.5 |
| 5 | hyper_shipping | Hyper Shipping | shippingCapacity | 0.6 | 6 | 3e17 | 3.5 |
| 5 | dimension_kennels | Dimension Kennels | kennelCapacity | 0.6 | 6 | 5e17 | 3.5 |
| 5 | pup_portals | Pup Portals | rescueRate | 100 | 6 | 8e17 | 3.5 |

Each item also has an `icon` emoji and a short `description` that the agent
writes. The description is rendered with the effect (e.g. "+10% dig rate per level").

### 4.5 Academy (`src/data/academy.ts`) — Golden Bones, permanent
| id | name | stat | perLevel | max | baseCost | growth |
|---|---|---|---|---|---|---|
| foreman_pup | Foreman Pup | autoBuild | 1 | 1 | 10 | 1 |
| head_trainer | Head Trainer | autoTraining | 1 | 1 | 30 | 1 |
| volunteer_walkers | Volunteer Walkers | autoWhistle | 0.2 | 5 | 8 | 1.4 |
| retirement_planner | Retirement Planner | autoPrestige | 1 | 1 | 500 | 1 |
| bigger_jar | Bigger Treat Jar | offlineHours | 2 | 20 | 5 | 1.2 |
| bigger_mailbox | Bigger Mailbox | mailCapacity | 1 | 6 | 12 | 1.4 |
| squirrel_hound | Squirrel Hound | squirrelHound | 0.05 | 20 | 20 | 1.22 |
| squirrel_spotter | Squirrel Spotter | squirrelRate | 0.04 | 25 | 10 | 1.18 |
| epic_digging | Epic Digging | layRate | 0.05 | 50 | 5 | 1.18 |
| epic_kibble | Epic Kibble | findValue | 0.05 | 50 | 5 | 1.18 |
| spirit_bond | Spirit Bond | spiritPawBonus | 0.005 | 40 | 20 | 1.15 |
| legend_lore | Legend Lore | collarBonus | 0.005 | 30 | 40 | 1.17 |
| max_zoomies | Max Zoomies | maxZoomies | 2 | 25 | 8 | 1.17 |
| bargain_hunter | Bargain Hunter | researchDiscount | 0.02 | 25 | 15 | 1.18 |
| kennel_deals | Kennel Deals | kennelDiscount | 0.02 | 25 | 10 | 1.18 |
| fleet_deals | Fleet Deals | fleetDiscount | 0.02 | 25 | 10 | 1.18 |

`night_shift` / `offlineRescue` no longer exist (rescue runs at 100% offline).
Costs are `ceil(baseCost × growth^level)`.

### 4.6 Treats (`src/data/treats.ts`)
| id | name | icon | effect | multiplier | duration | cost GB |
|---|---|---|---|---|---|---|
| bacon_strip | Bacon Strip | 🥓 | earnings | x2 | 4 h | 40 |
| peanut_kong | Peanut Butter Kong | 🥜 | adoption | x5 | 4 h | 20 |
| steak_dinner | Steak Dinner | 🥩 | layRate | x3 | 4 h | 60 |

### 4.7 Trophies (`src/data/trophies.ts`) — grant Legend Collars and Golden Bones once, ever
| id | name | kind | threshold | collars | GB |
|---|---|---|---|---|---|
| pack_1k | Litter Leader | pups | 1,000 | 0 | 5 |
| pack_10k | Pack Leader | pups | 10,000 | 1 | 10 |
| pack_100k | Top Dog | pups | 100,000 | 1 | 0 |
| pack_1m | Big Kahuna | pups | 1e6 | 1 | 15 |
| pack_10m | Dog Mayor | pups | 1e7 | 2 | 0 |
| pack_100m | Canine Emperor | pups | 1e8 | 2 | 40 |
| pack_1b | Galactic Alpha | pups | 3e8 | 3 | 0 |
| cash_1m | First Million | lifetimeEarnings | 1e6 | 0 | 10 |
| cash_1b | Bone Baron | lifetimeEarnings | 1e9 | 1 | 0 |
| cash_1t | Treat Tycoon | lifetimeEarnings | 1e12 | 1 | 15 |
| cash_1q | Kibble Mogul | lifetimeEarnings | 1e15 | 1 | 0 |
| cash_1Q | Fetch Financier | lifetimeEarnings | 1e18 | 2 | 20 |
| cash_1s | Squeaky Rich | lifetimeEarnings | 1e21 | 2 | 0 |
| cash_1S | Doggone Wealthy | lifetimeEarnings | 1e24 | 3 | 30 |
| cash_1o | Richest Good Boy | lifetimeEarnings | 1e27 | 3 | 0 |
| cash_1n | Bone Billionaire | lifetimeEarnings | 1e30 | 3 | 50 |
| cash_1d | Cosmic Coffers | lifetimeEarnings | 1e33 | 3 | 0 |
| park_1 | New Leash on Life | prestiges | 1 | 0 | 20 |
| park_4 | Serial Park Opener | prestiges | 4 | 1 | 0 |
| park_10 | Park Pioneer | prestiges | 10 | 1 | 20 |
| park_20 | Park Magnate | prestiges | 20 | 2 | 40 |
| park_30 | Eternal Groundskeeper | prestiges | 30 | 3 | 60 |
| find_fossil | Bone Historian | find | 6 | 1 | 50 |
| find_relic | Relic Hunter | find | 9 | 2 | 100 |
| find_legend | Paw Park Legend | find | 12 | 5 | 500 |

## 5. Constants (`src/data/constants.ts`)
```
START_CASH = 0               START_GOLDEN_BONES = 10
KENNEL_SLOTS = 4             BASE_FLEET_SLOTS = 4        MAX_FLEET_SLOTS = 12
BASE_DIG_PER_MIN = 6         BASE_RESCUE_PER_MIN = 2
BASE_ADOPTION_CAP = 50       BASE_ADOPTION_REFILL = 1    HOLD_ADOPT_PER_SEC = 6
BASE_MAX_ZOOMIES = 20        BASE_ZOOMIE_BONUS = 0.05
ZOOMIE_GRACE_SEC = 1.0       ZOOMIE_DECAY_PER_SEC = 10
BASE_SPIRIT_PAW_BONUS = 0.10 BASE_COLLAR_BONUS = 1.05
PRESTIGE_DIVISOR = 1e8       PRESTIGE_EXPONENT = 0.3
PARK_VALUE_SECONDS = 3600
BASE_OFFLINE_HOURS = 8       OFFLINE_MAX_CHUNK_SEC = 60
SQUIRREL_INTERVAL_MIN = 900  SQUIRREL_INTERVAL_MAX = 1800
SQUIRREL_LIFETIME_SEC = 7    MAX_ACTIVE_SQUIRRELS = 2    MIN_SQUIRREL_CASH_RATE = 1
SQUIRREL_BONES_MIN = 1       SQUIRREL_BONES_MAX = 4      (35% of squirrels give bones)
MAIL_INTERVAL_SEC = 7200     BASE_MAIL_CAPACITY = 6
MAIL_BONES_CHANCE = 0.55     MAIL_BONES_MIN = 2          MAIL_BONES_MAX = 7
MAIL_CASH_CHANCE = 0.8 (cumulative)                      MAIL_CASH_SECONDS = 300
MIN_COST_MULTIPLIER = 0.25
AUTOMATION_INTERVAL_SEC = 2  AUTOMATION_MAX_BUYS = 50    AUTO_SPLURGE_FRACTION = 0.1
AUTO_PRESTIGE_MIN_RUN_SEC = 600   DEFAULT_AUTO_PRESTIGE_THRESHOLD = 0.5
AUTOSAVE_INTERVAL_SEC = 10
SAVE_KEY = 'pawpark.save.v1'  SAVE_VERSION = 2
```

## 6. Stat modes
```
mult: layRate, findValue, kennelCapacity, shippingCapacity, squirrelRate
add : adoptionCap, adoptionRefill, rescueRate, fleetSlots, zoomieBonus, maxZoomies,
      spiritPawBonus, collarBonus, offlineHours, mailCapacity, squirrelHound,
      autoBuild, autoTraining, autoPrestige, autoWhistle,
      researchDiscount, kennelDiscount, fleetDiscount
```

## 7. Screens (UI)

The layout is mobile-first and portrait (max-width ~480px, centered on desktop):

```
┌──────────────────────────────┐
│ $1.23M   +$4.5K/s   🦴12  🐾3 │  ← top bar (cash big, income, golden bones, spirit paws)
│ 🎾 Tennis Ball · Park $3.2M   │  ← current find + park value + "Upgrade!" pill when ready
├──────────────────────────────┤
│                              │
│   PARK SCENE (canvas)        │  kennels drawn along the top, pups wandering and digging
│   🐕  🐶   🦮    🐩           │  (render ≤ 60 sprites that represent the population),
│      🐿️ ← tap!               │  squirrels run across (tappable), 📬 mail icon when ready,
│ ═══🚐════🚚═══ road ═════     │  vehicles drive along the road
├──────────────────────────────┤
│ 🐾 1,234 / 2,000 pups  ███░░  │  ← population bar (turns red when full)
│ dig 41/s · ship 50/s ▲bottleneck│  ← shows which pipe is limiting
│      ( 📯 WHISTLE )  stock ▓▓▒ │  ← big hold button + stock meter
│      ZOOMIES x1.45 ████░░      │
├──────────────────────────────┤
│ Training│Kennels│Fleet│Academy│Park│  ← bottom tabs open bottom-sheet panels
└──────────────────────────────┘
```

Panels:
- **Training**: grouped by tier. Locked tiers show "Buy N more levels to unlock".
  Each row has an icon, name, effect text, level/max, and a buy button with cost
  (disabled and dimmed when unaffordable). It also has a buy-max toggle (×1 / ×MAX).
- **Kennels**: 4 slot cards with the current tier, capacity, and next tier + cost.
- **Fleet**: slot cards. Locked slots say "Unlock with Fleet Expansion".
- **Academy**: Golden Bone upgrades plus the Treats shop, with active treat timers.
- **Park**: find ladder (current, next with progress bar toward its park value,
  and an Upgrade button), trophies list, prestige card ("Open a New Park:
  +N Spirit Paws, earnings bonus X → Y"), stats, and settings (export/import
  save, hard reset with confirmation).
- Modals: Welcome Back (offline report), Prestige confirm, Toasts (trophy, find
  unlocked, squirrel reward, mail reward, treat expired).

Feel/juice: income ticks up smoothly. "+$X" floaters appear on squirrel catch.
The whistle button squashes on press. Pups do a little bounce when adopted.
Zoomies make on-screen pups run faster.

## 8. Saving
- JSON in `localStorage[SAVE_KEY]`, with `version: 1`. `deserialize` fills any
  missing fields from `createInitialState` (forward compatibility) and rejects
  bad or unparseable input by returning `null`.
- Autosaves every `AUTOSAVE_INTERVAL_SEC`, on `visibilitychange` → hidden, and
  on `beforeunload`.
- Export/import is a base64 of the JSON.

## 9. Balance targets (superseded)
The v1 first-hour targets (Tennis Ball in 3–6 min, Rawhide in 25–45 min, …) were
replaced by the v2 long-game targets in `04-long-game-afk.md` §5, which `npm run
balance` checks (three profiles over real days). The tuned results are in
`04-long-game-afk.md` §7. In short: Tennis Ball in about 6 minutes, Squeaky Toy in
9, Rawhide in a few hours, first prestige on day 0, the Cosmic Bone on day 110 for
the AFK profile.

## 10. v2 extension points (not in scope now)
Dog Shows (contracts, which are the main Legend Collar source), breeds (cosmetic
plus small bonuses), artifacts, sound.
