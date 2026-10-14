# Egg, Inc. core farm loop: hatching, habs, vehicles/shipping, farm value, offline play

Source notes (read first):
- **Primary numeric source: the wasmegg / "carpetsage/egg" open-source community toolkit** (successor to fanaticscripter's wasmegg; powers the community calculators). I shallow-cloned it at commit `f57a8f3`, dated **2026-10-13**, so this is the most current data I found. It hard-codes game constants (research ids, levels, per-level effects, hab/vehicle capacities, per-copy prices) that the community extracts from the game's protobuf/config data. It is **community-maintained, not official Auxbrain**, but it is used to decode real player saves, so it is the most reliable source available. Files cited:
  - Habs: https://github.com/carpetsage/egg/blob/main/lib/farm/hab_space.ts
  - Vehicles: https://github.com/carpetsage/egg/blob/main/lib/farm/shipping_capacity.ts
  - Laying: https://github.com/carpetsage/egg/blob/main/lib/farm/laying_rate.ts
  - Internal hatchery: https://github.com/carpetsage/egg/blob/main/lib/farm/internal_hatchery.ts
  - Silos: https://github.com/carpetsage/egg/blob/main/lib/farm/silos.ts
  - Running chicken bonus (RCB): https://github.com/carpetsage/egg/blob/main/lib/farm/max_rcb.ts
  - Population/offline hab fill: https://github.com/carpetsage/egg/blob/main/lib/farm/population.ts
  - Min(lay, ship): https://github.com/carpetsage/egg/blob/main/lib/farm/farm.ts and https://github.com/carpetsage/egg/blob/main/wasmegg/ascension-planner/src/calculations/effectiveLayRate.ts
  - Earnings (online/offline): https://github.com/carpetsage/egg/blob/main/wasmegg/ascension-planner/src/calculations/earnings.ts
  - Research table (ids, levels, effects, prices): https://github.com/carpetsage/egg/blob/main/lib/researches.json
  - Train cars / vehicle pricing: https://github.com/carpetsage/egg/blob/main/wasmegg/ascension-planner/src/lib/vehicles.ts
  - Save-file schema (what state the game stores): https://github.com/carpetsage/egg/blob/main/protobuf/ei.proto
- The fandom wiki (egg-inc.fandom.com) and miraheze mirror could not be fetched (DNS blocked). Wiki facts below come from search-engine snippets, and **several wiki pages are flagged "Needs update" (about 441 days old as of Oct 2026)**.
- Labels used: **[CONFIRMED-code]** = constant in the 2026 community code; **[WIKI]** = fandom snippet; **[COMMUNITY]** = forum or guide claim; **[DERIVED]** = my arithmetic from confirmed constants; **[UNKNOWN]**.

---

## Q1. Hatchery: chicken button, capacity/refill, running chicken bonus, internal hatchery, full habs

### Takeaway
The player taps or holds a big button that spends chickens from a hatchery buffer. The buffer holds 250 (max 500) and refills at a slow rate, so active hatching can't continue indefinitely. Running chickens give a temporary multiplier on income, the running chicken bonus (RCB), with a base cap of 5x and a max of 540x through research. The internal hatchery is the passive, AFK population source: a flat number of chickens per minute **per hab** from research, with an epic-research multiplier that applies only while away ("Internal Hatchery Calm"). Population is hard-capped by total hab space.

### Cited Findings
**Chicken button (tap vs hold)**
- Wikipedia describes the core mechanic: when the button is pressed or held, chickens are released, and money is made from the eggs they produce. — [Wikipedia: Egg, Inc.](https://en.wikipedia.org/wiki/Egg,_Inc.)
- Epic research "Hold to Hatch": "Hold chicken button for +2 chickens per second", 15 levels (+30/s). Costs 10 to 500 golden eggs. [CONFIRMED-code] — [researches.json](https://github.com/carpetsage/egg/blob/main/lib/researches.json)
- Wiki: base hold output is 2 chickens/s without Hold to Hatch. Max with Hold to Hatch is **32 chickens/s**, or 47/s with a legendary actuator artifact (62/s on the Enlightenment farm with clarity stones). [WIKI] — [Hatchery (fandom)](https://egg-inc.fandom.com/wiki/Hatchery). This is consistent with the code: 2 + 15×2 = 32 [DERIVED].
- Community: once Hold to Hatch exceeds about +20/s, holding beats tapping, since about 20 taps/s is roughly the two-finger tapping limit. [COMMUNITY] — [fandom forum post](https://egg-inc.fandom.com/f/p/4400000000000021399)
- "Tapping super fast doesn't give a huge advantage… because of the hatchery's required cooldown time when you run out of chickens." [COMMUNITY] — [Level Winner guide](https://www.levelwinner.com/egg-inc-ultimate-guide-tips-tricks-running-egg-empire/)

**Hatchery capacity and refill**
- Base hatchery capacity is **250 chickens**, with a max of **500** via Hatchery Expansion, Hatchery Rebuild and Compact Incubators. [WIKI] — [Hatchery (fandom)](https://egg-inc.fandom.com/wiki/Hatchery); the base of 250 also appears on [Hatchery (miraheze)](https://egginc.miraheze.org/wiki/Hatchery)
- Capacity research [CONFIRMED-code] — [researches.json](https://github.com/carpetsage/egg/blob/main/lib/researches.json):
  - Hatchery Expansion (tier 2): +10 capacity per level, 10 levels.
  - Hatchery Rebuild (tier 4): +50, 1 level.
  - Compact Incubators (tier 5): +10 per level, 10 levels.
  - Total: 250 + 100 + 50 + 100 = 500 [DERIVED].
- Refill research [CONFIRMED-code] — same file:
  - Better Incubators (tier 1): "Hatchery will refill 10% faster", 15 levels.
  - Rooster Booster (tier 3): +5%, 25 levels.
  - Epic Hatchery (epic): +10%, 20 levels.
  - Max multiplier = 2.5 × 2.25 × 3.0 = **16.875x** [DERIVED]. This matches the wiki's figure of "base × 16.875 ≈ 50.6 chickens/s", which implies a base refill of about **3 chickens/s**. [WIKI] — [Hatchery (fandom)](https://egg-inc.fandom.com/wiki/Hatchery). Miraheze lists the base refill as "unknown", so treat 3/s as a community figure.
- The save file stores `hatchery_population` as a double, so the buffer refills fractionally and continuously. It also stores `num_chickens`, `num_chickens_unsettled` and `num_chickens_running`, which suggests chickens pass through a "running/unsettled" state before settling into habs. [CONFIRMED-code schema] — [ei.proto](https://github.com/carpetsage/egg/blob/main/protobuf/ei.proto)

**Running chicken bonus (RCB)**
- Base max RCB is **5x** (`baseMaxRunningChickenBonus = 5`). Research adds to the cap additively [CONFIRMED-code] — [max_rcb.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/max_rcb.ts):
  - Coordinated Clucking: +0.2x per level × 50.
  - Motivational Clucking: +0.5x × 50.
  - Enlightened Chickens: +2x × 150.
  - Epic Multiplier: +2x × 100.
  - Max = 5 + 10 + 25 + 300 + 200 = **540x** [DERIVED]. A community forum post also reports "540x… with max research and no artifacts" ([fandom user forum](https://egg-inc.fandom.com/f/u/47075909)). Artifacts can add more.
- Per-chicken contribution research [CONFIRMED-code] — [researches.json](https://github.com/carpetsage/egg/blob/main/lib/researches.json):
  - Excitable Chickens (tier 1): "+0.1% egg value bonus for each running chicken", 25 levels.
  - Epic Clucking: same effect, 20 levels.
  - The wiki clarifies that Excitable Chickens actually "increas[es] the amount by which each chicken contributes to your Running Chicken Bonus" rather than adding egg value directly. [WIKI] — [Research (fandom)](https://egg-inc.fandom.com/wiki/Research)
- History of the cap:
  - 2016 player: the per-second meter sat at 16x "because of the chicken bonus". [COMMUNITY] — [TouchArcade forum](https://devforums.toucharcade.com/threads/egg-inc-by-auxbrain-inc.290886/page-4)
  - Patch 1.12.2: "Running chicken bonus lowered, but now increases farm value and drone rewards". — [Softpedia 1.12.2 notes](https://mobile.softpedia.com/apk/egg-inc/1.12.2/)
  - 2019: the max RCB was reduced from 1600x to 1040x. — [Egg Centric on X](https://x.com/egg_centric/status/1128782458965680130?lang=en)
  - The current code gives a 540x research max, so the cap has been retuned several times.
- Drone reward = Farm Value × sqrt(current RCB) at the moment the drone lands. [WIKI] — [Drones (fandom)](https://egg-inc.fandom.com/wiki/Drones)
- One guide notes the displayed income/sec is not affected by the 2x video boost or the clucking multiplier. [COMMUNITY] — [patashu guide (mirror)](https://lr.eu.psf.lt/r/EggsInc/wiki/patashu_guide)

**Internal hatchery (IHR)**
- Rates are in **chickens per minute per hab**, summed additively from common research [CONFIRMED-code] — [internal_hatchery.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/internal_hatchery.ts):

  | Research | Effect | Levels |
  |---|---|---|
  | Internal Hatcheries | +2/min | 10 |
  | Internal Hatchery Upgrades | +5 | 10 |
  | Internal Hatchery Expansion (tier 5) | +10 | 15 |
  | Internal Hatchery Expansion (tier 7) | +25 | 30 |
  | Machine Learning Incubators | +5 | 250 |
  | Neural Linking | +50 | 30 |

  - Research max = 20 + 50 + 150 + 750 + 1,250 + 1,500 = **3,720 chickens/min/hab** [DERIVED].
- Epic multipliers (multiplicative) [CONFIRMED-code], same file:
  - Epic Int. Hatcheries: +5% per level × 20 = ×2.0, applies at all times.
  - **Internal Hatchery Calm**: +10% per level × 20 = **×3.0, applied "while away" only** (`offlineOnly: true`).
  - Fully researched: 7,440/min/hab online and 22,320/min/hab offline [DERIVED], before artifacts and boosts. Boosts (Tachyon Prisms, Boost Beacons) multiply IHR further.
- Epic **Internal Hatchery Sharing**: "Full habs' internal hatcheries send +10% chicks to other habs", 10 levels. Without it, a full hab's internal hatchery output is partly wasted. [CONFIRMED-code] — [researches.json](https://github.com/carpetsage/egg/blob/main/lib/researches.json). The wiki says that with Sharing, the hab count is treated as 4 for farm-value calculations. [WIKI] — [Farm Value (fandom)](https://egg-inc.fandom.com/wiki/Farm_Value)
- Offline population growth is modelled as `pop = min(lastPop + offlineIHR/min × minutes elapsed, max(lastPop, totalHabSpace))`, so growth is linear until habs are full. Time to "hab lock" = 60 × (habSpace − pop) / IHR seconds. [CONFIRMED-code] — [population.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/population.ts)
- Silos are used "for earning Bocks, gaining chickens from Internal Hatcheries, and collecting Boost Tokens while offline", so offline IHR is also capped by silo time. [WIKI] — [Grain Silos (fandom)](https://egg-inc.fandom.com/wiki/Grain_Silos)
- The patashu guide says maxing silo capacity "multiplies internal hatchery efficiency by ~1.11x" for a player who is awake about 16 hours per day. It also gives about 6,000 per hab as the benchmark for maxed IHR. That figure is from an older version, and its unit is unclear in the snippet. [COMMUNITY] — [patashu guide (mirror)](https://lr.eu.psf.lt/r/EggsInc/wiki/patashu_guide)

**When habs are full**
- Population is clamped to total hab space (see the formula above). The game stores a per-hab `hab_population` array and caps each hab individually. Each hab's capacity is rounded up separately. [CONFIRMED-code] — [hab_space.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/hab_space.ts), [ei.proto](https://github.com/carpetsage/egg/blob/main/protobuf/ei.proto)
- Community strategy: "once internal hatchery boosts expire, or when your habs are full… finish remaining research and make sure transport is sufficient", which is a typical prestige trigger. [WIKI] — [Prestige (fandom)](https://egg-inc.fandom.com/wiki/Prestige)

### Inferences
- The design creates three population inputs with different engagement profiles:
  - Burst: a finite hatchery buffer spent by tapping or holding.
  - Sustained active: refill rate plus Hold to Hatch.
  - Passive: IHR per hab, which scales with the **number of habs, not their size**. That is a reason to fill all 4 hab slots early.
- Making Calm offline-only rewards *leaving* the game, a deliberate AFK incentive.
- The RCB rewards active play with a large temporary income multiplier. It also inflates farm value and drone payouts, which links active play to progression gating.

### Gaps
- The exact RCB build rate (how much each running chicken adds before research), the decay speed when tapping stops, and how long a chicken counts as "running" were not found. No source snippet gave the per-chicken base contribution or a decay curve. [UNKNOWN]
- The base hatchery refill rate (about 3/s) is only a wiki figure; miraheze lists it as unknown.
- What happens to button presses when habs are full (blocked, or chickens lost) was not confirmed by any source.
- The snippets did not say whether RCB applies to offline earnings; my inference is that it does not.

---

## Q2. Habs: tiers, capacities, prices, slots, duplicate pricing, capacity research

### Takeaway
There are 19 hab tiers, from Coop (250) to Chicken Universe (600M), and **4 hab slots**. Capacity doubles or more at each tier, and price rises about 100x per tier. Each tier has a fixed **4-entry price table indexed by how many of that tier you already own**. The tables show no single multiplier: copies 2 to 4 cost roughly 1.5x to 4x the previous copy. Four capacity researches give up to ×3.15 for all habs, and ×4.725 for Planet Portal and Chicken Universe.

### Cited Findings
- Full tier list from [hab_space.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/hab_space.ts) [CONFIRMED-code]. Prices are bocks (in-game currency) for the 1st, 2nd, 3rd and 4th copy of that tier on the normal farm. The code cites https://egg-inc.fandom.com/wiki/Habitats as its source.

  | # | Hab | Base capacity | Price, copies 1 / 2 / 3 / 4 |
  |---|---|---|---|
  | 0 | Coop | 250 | 0 / 29.12 / 56.37 / 96.56 |
  | 1 | Shack | 500 | 467 / 803 / 1,256 / 1,861 |
  | 2 | Super Shack | 1,000 | 12,267 / 23,531 / 40,899 / 66,811 |
  | 3 | Short House | 2,000 | 340,829 / 733,773 / 1.419M / 2.551M |
  | 4 | The Standard | 5,000 | 2.144e7 / 6.813e7 / 1.782e8 / 4.090e8 |
  | 5 | Long House | 10,000 | 2.321e9 / 5.957e9 / 1.335e10 / 2.720e10 |
  | 6 | Double Decker | 20,000 | 1.483e11 / 3.923e11 / 9.005e11 / 1.867e12 |
  | 7 | Warehouse | 50,000 | 1.780e13 / 6.609e13 / 1.941e14 / 4.859e14 |
  | 8 | Center | 100,000 | 3.24e15 / 8.75e15 / 2.04e16 / 4.29e16 |
  | 9 | Bunker | 200,000 | 2.50e17 / 6.77e17 / 1.58e18 / 3.32e18 |
  | 10 | Eggkea | 500,000 | 3.26e19 / 1.22e20 / 3.60e20 / 9.04e20 |
  | 11 | HAB 1000 | 1,000,000 | 6.05e21 / 1.63e22 / 3.80e22 / 7.98e22 |
  | 12 | Hangar | 2,000,000 | 4.63e23 / 1.25e24 / 2.90e24 / 6.10e24 |
  | 13 | Tower | 5,000,000 | 5.93e25 / 2.20e26 / 6.39e26 / 1.58e27 |
  | 14 | HAB 10,000 | 10,000,000 | 1.25e28 / 3.79e28 / 9.60e28 / 2.15e29 |
  | 15 | Eggtopia | 25,000,000 | 2.93e30 / 1.29e31 / 4.19e31 / 1.13e32 |
  | 16 | Monolith | 50,000,000 | 2.8e33 / 1.56e34 / 5.92e34 / 1.75e35 |
  | 17 | Planet Portal | 100,000,000 | 8.57e36 / 5.87e37 / 2.39e38 / 7.18e38 |
  | 18 | Chicken Universe | 600,000,000 | 3.22e41 / 3.59e42 / 1.94e43 / 7.12e43 |

- The code also stores a separate `virtueCost` table for the "Path of Virtue" (Virtue Gems) mode. The [Egg of Integrity (fandom) page](https://egg-inc.fandom.com/wiki/Path_of_Virtue/Egg_of_Integrity) confirms that gem costs for habs and vehicles there are "significantly altered".
- Wiki snippets match this table: Coop 250, Shack 500, Eggtopia 25M, Monolith 50M, Planet Portal 100M, Chicken Universe 600M. Planet Portal copy prices are 8.572U / 58.682U / 238.756U / 718.322U, where U is the game's suffix for 1e36. [WIKI] — [Habitats (fandom)](https://egg-inc.fandom.com/wiki/Habitats). A wiki snippet lists the first Coop at about 11.26 bocks (total 193.32 for 4). The code lists the first Coop as 0, because the starting coop is free.
- **4 hab slots** [CONFIRMED-code + WIKI]:
  - Each tier's price table has exactly 4 entries.
  - The save file uses id 19 as a placeholder for an unpurchased slot ([hab_space.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/hab_space.ts)).
  - The wiki's maximum capacity figure of 11.34B equals 4 Chicken Universes ([Habitats (fandom)](https://egg-inc.fandom.com/wiki/Habitats)).
- **Duplicate pricing** [CONFIRMED-code]: price depends on how many of *that same tier* you already own, through a lookup table rather than a formula. Copy-to-copy ratios [DERIVED]:
  - Shack ≈ 1.72x / 1.56x / 1.48x.
  - The Standard ≈ 3.18x / 2.62x / 2.30x.
  - Chicken Universe ≈ 11.2x / 5.4x / 3.7x.
  - Ratios shrink with each copy and grow at higher tiers. No single multiplier was found.
- Cost reductions:
  - Epic "Cheaper Contractors": −5% hab cost per level × 10 (−50%). [CONFIRMED-code] — [researches.json](https://github.com/carpetsage/egg/blob/main/lib/researches.json)
  - Colleggtibles: hab cost ×0.75 to 1.0. — [ascension-planner habs.ts](https://github.com/carpetsage/egg/blob/main/wasmegg/ascension-planner/src/lib/habs.ts)
- **Capacity research** (multiplicative across researches, additive within one) [CONFIRMED-code] — [hab_space.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/hab_space.ts):
  - Hen House Remodel: +5% × 8.
  - Microlux Chicken Suites: +5% × 10.
  - Grav Plating: +2% × 25.
  - Wormhole Dampening: +2% × 25, **Planet Portal and Chicken Universe only**.
  - Max ×3.15 for all habs, ×4.725 for portal habs [DERIVED]. Hab-space artifacts multiply further.
  - Check: Chicken Universe 600M × 4.725 × 4 = 11.34B, which matches the wiki's "maximum chicken capacity of 11.34 billion" (as of 1.12.11). — [Habitats (fandom)](https://egg-inc.fandom.com/wiki/Habitats)
- A Chicken Universe capacity of 1.8B after "mastering Tier 9" appears in a missions context. [WIKI-other] — [NamuWiki missions](https://en.namu.wiki/w/Egg,%20Inc./%EB%AF%B8%EC%85%98)

### Inferences
- Capacity grows only about 2x to 2.5x per tier while price grows about 100x per tier. Most of the late-game hab gap is closed by multiplicative research, not by hab tier.
- The design pattern is: few slots (4), many tiers, and replacement upgrades. The player sells or upgrades a slot to a higher tier rather than adding slots, so each purchase is a visible chunky jump.

### Gaps
- No closed-form duplicate multiplier; the game uses explicit tables.
- Whether replacing a hab refunds anything was not confirmed. My belief, unsourced, is that there is no refund.

---

## Q3. Vehicles: tiers, capacity, slots, Hyperloop cars, duplicate pricing, overflow

### Takeaway
There are 12 vehicle tiers, from Trike (5,000 eggs/min) to Hyperloop Train (50M/min per car). Fleet size goes from a base of 4 slots to 17 with research. The Hyperloop is a train: the engine carries 50M/min, and you add cars of the same capacity, from 5 cars base to 10 max. Vehicle prices, like habs, come from a per-tier table indexed by how many of that tier you own (17 entries). Eggs laid beyond shipping capacity earn nothing.

### Cited Findings
- Base shipping capacity, in eggs/min, before research [CONFIRMED-code] — [shipping_capacity.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/shipping_capacity.ts) (cites https://egg-inc.fandom.com/wiki/Vehicles):
  - Trike 5,000
  - Transit Van 15,000
  - Pickup 50,000
  - 10 Foot 100,000
  - 24 Foot 250,000
  - Semi 500,000
  - Double Semi 1,000,000
  - Future Semi 5,000,000
  - Mega Semi 15,000,000
  - Hover Semi 30,000,000
  - Quantum Transporter 50,000,000
  - Hyperloop Train 50,000,000 **per car**
  - The same list appears on the wiki, which says prices are "accurate as of Version 1.22.4". [WIKI] — [Vehicles (fandom)](https://egg-inc.fandom.com/wiki/Vehicles?oldid=8651)
- **Fleet slots** [CONFIRMED-code + DERIVED]: fleet research adds 2 + 2 + 2 + 2 + 5 = 13 slots — [researches.json](https://github.com/carpetsage/egg/blob/main/lib/researches.json):
  - Vehicle Reliability (tier 3): +1 × 2.
  - Exoskeletons ("excoskeletons", tier 5): +1 × 2.
  - Traffic Management (tier 6): +1 × 2.
  - Egg Loading Bots (tier 7): +1 × 2.
  - Autonomous Vehicles (tier 10): +1 × 5.
  - Each vehicle's price table has 17 entries (`virtueCost` arrays), so the max fleet is **17** and the base is **4**.
- **Hyperloop** [WIKI]:
  - Buying trains first requires a one-time Hyperloop purchase of 50,000 (Golden Eggs).
  - Trains and cars must be repurchased on each new farm.
  - The train "can take 4 more cars with identical capacity", upgradable to 9 extra cars with Graviton Coupling, "effectively multiplying total shipping capacity by 10". — [Vehicles (fandom)](https://egg-inc.fandom.com/wiki/Vehicles?oldid=8651), [Hyper Loop (fandom)](https://egg-inc.fandom.com/wiki/Hyper_Loop)
- **Hyperloop** [CONFIRMED-code]:
  - `MAX_TRAIN_LENGTH = 10`, and the first car comes free with the train. — [ascension-planner vehicles.ts](https://github.com/carpetsage/egg/blob/main/wasmegg/ascension-planner/src/lib/vehicles.ts)
  - Research "Micro-Coupling" (tier 12): "Increase max hyperloop train length by 1", 5 levels — [researches.json](https://github.com/carpetsage/egg/blob/main/lib/researches.json). This takes the train from 5 to 10 cars [DERIVED].
  - Capacity = base × `trainLength` — [shipping_capacity.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/shipping_capacity.ts).
  - Car prices rise steeply per car (Virtue-mode table: 1.13e26, 6.86e26, 2.52e27 … 1.70e29 for cars 2 to 10).
- **Duplicate pricing** [CONFIRMED-code]:
  - `getDiscountedVehiclePrice(vehicleId, purchaseIndex)`, where purchaseIndex = "which purchase of this vehicle type (0-16)", looks up a table. Price depends on how many of that type you already own.
  - Example (Virtue table, Trike): 0, 309, 513, 760, 1,058 … 11,896.
  - The normal-farm bock price tables were **not** in the code; only Virtue tables were.
  - Epic "Bust Unions" gives −5% vehicle cost per level × 10.
  - Sources: [ascension-planner vehicles.ts](https://github.com/carpetsage/egg/blob/main/wasmegg/ascension-planner/src/lib/vehicles.ts), [researches.json](https://github.com/carpetsage/egg/blob/main/lib/researches.json)
- **Shipping research** (multiplicative across researches) [CONFIRMED-code] — [shipping_capacity.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/shipping_capacity.ts):
  - Improved Leafsprings: +5% × 30.
  - Lightweight Boxes: +10% × 40.
  - Driver Training: +5% × 30.
  - Super Alloy Frames: +5% × 50.
  - Quantum Egg Storage: +5% × 20.
  - Dark Containment: +5% × 25.
  - Neural Net Refinement: +5% × 25.
  - Transportation Lobbyists (epic): +5% × 30.
  - Hover Upgrades: +5% × 25, **Hover Semi / Quantum / Hyperloop only**.
  - Hyper Portalling: +5% × 25, **Hyperloop only**.
  - Max ×2,768.6 for all vehicles, ×6,229 for hover vehicles, and **×14,016 for Hyperloop** [DERIVED].
- **Overflow**: income uses `eggsPerHour = Math.min(layableEggsPerHour, shippableEggsPerHour)`. Eggs beyond capacity add no income, and the planner labels the farm "limitedBy: shipping". [CONFIRMED-code] — [farm.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/farm.ts), [effectiveLayRate.ts](https://github.com/carpetsage/egg/blob/main/wasmegg/ascension-planner/src/calculations/effectiveLayRate.ts)

### Inferences
- Shipping is a second, independently-upgraded throughput cap. It forces the player to balance two purchase tracks (habs and laying versus vehicles), which is the core "physical bottleneck" tension.
- The Hyperloop "add a car" mechanic gives a late-game incremental purchase inside a single slot.

### Gaps
- Normal-farm (bock) vehicle price tables, and the exact Hyperloop car prices in bocks. Only Virtue tables and the 1.22.4-era wiki note were found.
- Whether excess eggs are visibly lost or simply never counted. The code treats them as not counted at all; there is no stockpile.

---

## Q4. Laying rate and income: min(laid, shipped)

### Takeaway
Base laying rate is **1 egg per chicken per 30 seconds** (2/min). Income per second = egg value × min(chickens × lay rate, shipping capacity) × earnings multipliers, plus RCB and video/event multipliers while online.

### Cited Findings
- `baseEggLayingRate = 1 / 30; // 1 egg per 30 seconds`, and `layableEggsPerSecond = numChickens × base × ∏(1 + perLevel×level) × artifacts`. [CONFIRMED-code] — [laying_rate.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/laying_rate.ts)
- Laying research [CONFIRMED-code], same file:
  - Comfortable Nests: +10% × 50.
  - Hen House A/C: +5% × 50.
  - Improved Genetics: +15% × 30.
  - Time Compression: +10% × 20.
  - Timeline Diversion: +2% × 50.
  - Relativity Optimization: +10% × 10.
  - Epic Comfy Nests: +5% × 20.
  - Max ×2,772, so a maxed chicken lays about 5,544 eggs/min [DERIVED].
- `eggsPerHour = min(layableEggsPerHour, shippableEggsPerHour)`. [CONFIRMED-code] — [farm.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/farm.ts)
- Earnings model [CONFIRMED-code] — [earnings.ts](https://github.com/carpetsage/egg/blob/main/wasmegg/ascension-planner/src/calculations/earnings.ts):
  - `base = eggValue × effectiveLayRate × 1.1^TE` (TE = Truth Eggs, a 2025+ mechanic).
  - `online = base × earningsMultiplier × videoDoubler × event`.
  - `offline = online × awayEarningsMultiplier × artifactAway`.
  - The earnings multiplier carries the prestige bonus (Soul Eggs / Prophecy Eggs, "Earnings Bonus").
- Egg value research includes 16 egg-value common researches in the data. The RCB is applied as an egg-value-like multiplier while chickens are running. [CONFIRMED-code category counts] — [researches.json](https://github.com/carpetsage/egg/blob/main/lib/researches.json)

### Inferences
- The three physical stocks and flows are: population (hab-capped), lay rate (per chicken), and shipping (per vehicle). The binding constraint shifts as the player buys. The game surfaces this through separate on-screen stats, so the player diagnoses which one to fix. A dog clone could mirror this: dogs in kennels → "fetches" per dog → delivery vans.

### Gaps
- Exact base egg values for each egg type (Edible $0.25 etc.) were not retrieved here; this is outside this scope.

---

## Q5. Farm value

### Takeaway
Farm value is a valuation of the *current* farm. Roughly, it is egg value × laying rate × earnings bonus × max RCB × a weighted "population" term that includes hab vacancy and IHR × away time. It gates unlocking the next egg (and drone/box payouts), so progression rewards building *capacity and future growth potential*, not just current cash.

### Cited Findings
- Farm Value "determines when you can unlock new eggs and how much money drones, boxes and other boosts give you." [WIKI] — [Farm Value (fandom)](https://egg-inc.fandom.com/wiki/Farm_Value)
- The "Current Approximate Formula" (page tagged "Needs update") is a product of these factors [WIKI] — [Farm Value (fandom)](https://egg-inc.fandom.com/wiki/Farm_Value):
  - the Accounting Tricks multiplier
  - egg value
  - the per-second laying rate (excluding colleggtibles)
  - the earnings-bonus multiplier from Soul and Prophecy eggs (EB% / 100 + 1)
  - **max** RCB (unaffected by Terra stones)
  - a population term
- The population term is a sum of four parts:
  - 1.00 × effective population
  - 0.20 × ineffective population (chickens beyond what shipping can serve, "limited by shipping rate")
  - (hab vacancy)^0.6
  - 0.25 × IHR × number of habs × max away time (minutes)
- Wiki notes on the formula:
  - With Internal Hatchery Sharing, the hab count is treated as 4.
  - Only lens artifacts modify farm value.
  - Truth Eggs affect it only indirectly.
- Epic "Accounting Tricks": "Increase farm valuation by 5%", 20 levels (+100%). [CONFIRMED-code] — [researches.json](https://github.com/carpetsage/egg/blob/main/lib/researches.json)
- The patashu guide says "Increasing internal hatchery rate gives a small, negligible boost to farm value." [COMMUNITY, older] — [patashu guide (mirror)](https://lr.eu.psf.lt/r/EggsInc/wiki/patashu_guide)
- RCB has fed into farm value since v1.12.2. — [Softpedia 1.12.2 notes](https://mobile.softpedia.com/apk/egg-inc/1.12.2/)
- Drone payout = Farm Value × sqrt(RCB). [WIKI] — [Drones (fandom)](https://egg-inc.fandom.com/wiki/Drones)

### Inferences
- The dominant inputs are multiplicative: egg value, lay rate, earnings bonus and max RCB, times effective (shipped) population.
- Empty hab space counts for something (vacancy^0.6), and so does growth potential (IHR × silo time). Building habs and silos ahead of population therefore raises farm value.
- Unshipped chickens count at only 20%, which pushes players to fix shipping.
- Gating egg unlocks on farm value rather than cash prevents "save up cash and skip" strategies and rewards a balanced farm.

### Gaps
- The exact current coefficients. The wiki formula is "approximate" and stale, and Auxbrain has not published one. The farm-value thresholds for each egg unlock were not retrieved.

---

## Q6. Offline: silos, offline earnings, IHR offline, AFK design

### Takeaway
Each silo stores **60 minutes** of away time, plus 6 min per Silo Capacity epic level (max +120, for 180 min per silo). Silos stack additively; the community wiki says up to 10 silos (Pro Permit), giving 30 h max. Offline earnings run at 0.5x (Standard Permit) or 1x (Pro Permit) of the online rate, and stop when silo time runs out. The internal hatchery keeps working offline, with the Calm bonus, until silo time runs out or habs are full.

### Cited Findings
- `baseSiloMinutes = 60`. Silo Capacity epic research gives +6 min per level × 20. Total away time = (60 + 6×level) × silosOwned. [CONFIRMED-code] — [silos.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/silos.ts); Silo Capacity epic costs 500 to 1,000 golden eggs per level — [researches.json](https://github.com/carpetsage/egg/blob/main/lib/researches.json)
- Next silo cost = **100,000,000 × n^(3n+15)**, where n = silos already owned, and the first silo is free. [CONFIRMED-code] — [silos.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/silos.ts)
  - 2nd silo: 1e8.
  - 3rd: 2.1e14.
  - 4th: 2.8e19.
  - 5th: 1.8e24.
  - 10th: about 1.2e48 bocks [DERIVED].
- Silo permits and offline rate [WIKI] — [Grain Silos (fandom)](https://egg-inc.fandom.com/wiki/Grain_Silos):
  - Standard Permit allows 2 silos; Pro Permit (the paid upgrade) allows 10.
  - Standard Permit earns offline at half the online rate; Pro Permit earns at the same rate as online.
  - Each silo adds a base of 1 hour, and Silo Capacity adds up to 2 hours more per silo.
  - Silos cover offline bocks, IHR chickens and boost tokens.
- Offline earnings = online earnings × away multiplier × artifact away multiplier. [CONFIRMED-code] — [earnings.ts](https://github.com/carpetsage/egg/blob/main/wasmegg/ascension-planner/src/calculations/earnings.ts)
- IHR works offline, boosted ×(1 + 0.1 × Calm level), and offline population is capped by hab space. [CONFIRMED-code] — [internal_hatchery.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/internal_hatchery.ts), [population.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/population.ts)
- Epic "Video Doubler Time": +30 min per level × 12 to the length of the video (ad) 2x earnings buff. [CONFIRMED-code] — [researches.json](https://github.com/carpetsage/egg/blob/main/lib/researches.json)
- Guide: internal hatcheries are good "if you plan to be away… it will slowly add chickens while you're away." Holding the button until the hatchery runs out is the active pattern. [COMMUNITY] — [Player Assist guide](https://playerassist.com/egg-inc-guide-tips-and-tricks/)
- The patashu guide: high silo capacity "reduces how often you need to open the game". [COMMUNITY] — [patashu guide (mirror)](https://lr.eu.psf.lt/r/EggsInc/wiki/patashu_guide)
- The save file stores `last_step_time`; the game simulates the elapsed time on return. It also tracks `time_cheats_detected` and `time_cheat_debt`, so clock manipulation is detected and penalised. [CONFIRMED-code schema] — [ei.proto](https://github.com/carpetsage/egg/blob/main/protobuf/ei.proto)

### Inferences
**AFK-friendly elements:**
- IHR plus Calm (offline growth is 3x faster than online when maxed).
- Silos give up to 30 h of offline earnings.
- The Pro Permit is the monetised 1x offline rate.
- Offline income is a simple "online rate × multiplier × min(elapsed, silo time)".

**Check-in drivers:**
- The silo cap: the player must return before the silos run out.
- The finite hatchery buffer and RCB reward short active sessions.
- Drones and boxes are paid by farm value × sqrt(RCB), so they reward active RCB.
- Video doubler timers.
- Hab-full and shipping-limited states need purchases to continue growth.

### Gaps
- Exact current silo maximum: code does not hard-cap it; the wiki says 10 with Pro Permit. Whether the Standard Permit's 2-silo/0.5x rule still applies in 2026 is not independently confirmed.
- Whether RCB, drones or boost timers pause offline was not sourced.
- Whether offline earnings are computed with the population growing linearly over the offline period or with the start population was not stated by any source. The code models population growth separately from earnings.

---

## Q7 (designer extra focus). Full hab/vehicle ladders with looks, how scaling creates time, and the on-farm visual flow

### Takeaway
- **Numbers.** Capacities and per-copy prices are confirmed from the community code above.
- **Looks.** Could **not** be source-verified. Fandom and NamuWiki pages, and the community icon CDN (eggincassets.pages.dev, proxy-blocked), were all unreachable. The appearance notes below are **[UNVERIFIED: from tier names and general recall]** and should be checked against screenshots or the App Store page before art direction.
- **Time.** Time is created by geometric scaling: each hab tier costs roughly 30x to 450x the previous tier's last copy but adds only about 2x to 6x capacity. Fill time is (hab space − population) / (IHR per hab × number of habs). At max habs, fill time runs to days or months without boosts, which is why boost items exist.

### Cited Findings
**(1) Full hab ladder.** Capacity and prices (bocks; copies 1 / 4) [CONFIRMED-code], from [hab_space.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/hab_space.ts). Max capacity uses ×3.15 research, or ×4.725 for portal habs [DERIVED]. "Look" is [UNVERIFIED]. "When reached" is my inference from price magnitude.

| # | Hab | Base cap | Max-research cap | 1st copy | 4th copy | Look [UNVERIFIED] | Roughly when |
|---|---|---|---|---|---|---|---|
| 0 | Coop | 250 | 788 | free | 96.56 | small wooden chicken coop | start of every farm |
| 1 | Shack | 500 | 1,575 | 467 | 1,861 | wooden shed | first minutes |
| 2 | Super Shack | 1,000 | 3,150 | 12,267 | 66,811 | bigger, sturdier shed | first ~10 min of a fresh farm |
| 3 | Short House | 2,000 | 6,300 | 340,829 | 2.55M | small barn-style house | early |
| 4 | The Standard | 5,000 | 15,750 | 2.14e7 | 4.09e8 | standard farm barn | early |
| 5 | Long House | 10,000 | 31,500 | 2.32e9 | 2.72e10 | long poultry barn | early–mid |
| 6 | Double Decker | 20,000 | 63,000 | 1.48e11 | 1.87e12 | two-storey barn | mid |
| 7 | Warehouse | 50,000 | 157,500 | 1.78e13 | 4.86e14 | industrial warehouse | mid |
| 8 | Center | 100,000 | 315,000 | 3.24e15 | 4.29e16 | large modern facility | mid |
| 9 | Bunker | 200,000 | 630,000 | 2.50e17 | 3.32e18 | concrete bunker | mid |
| 10 | Eggkea | 500,000 | 1.575M | 3.26e19 | 9.04e20 | big-box flat-pack store (IKEA pun) | mid–late |
| 11 | HAB 1000 | 1M | 3.15M | 6.05e21 | 7.98e22 | futuristic habitat module | late |
| 12 | Hangar | 2M | 6.3M | 4.63e23 | 6.10e24 | aircraft hangar | late |
| 13 | Tower | 5M | 15.75M | 5.93e25 | 1.58e27 | high-rise tower | late |
| 14 | HAB 10,000 | 10M | 31.5M | 1.25e28 | 2.15e29 | larger sci-fi habitat | late |
| 15 | Eggtopia | 25M | 78.75M | 2.93e30 | 1.13e32 | utopian domed city | late egg tiers |
| 16 | Monolith | 50M | 157.5M | 2.8e33 | 1.75e35 | dark sci-fi monolith | late egg tiers |
| 17 | Planet Portal | 100M | 472.5M | 8.57e36 | 7.18e38 | portal to another planet | endgame |
| 18 | Chicken Universe | 600M | 2.835B | 3.22e41 | 7.12e43 | "portal to another universe" | endgame |

- The max-research capacities match the wiki: Coop "250 to 788", Planet Portal "100,000,000 to 472,500,000". [WIKI] — [Habitats (fandom)](https://egg-inc.fandom.com/wiki/Habitats)
- Chicken Universe is described by a creator as "the LAST chicken habitat in the game: a portal to another universe". — [YouTube: "I Sent Billions of Chickens to Another Universe"](https://www.youtube.com/watch?v=Wq4-TWIUj-k)
- Price jumps between a tier's 4th copy and the next tier's 1st copy [DERIVED from code]:
  - Shack 1,861 → Super Shack 12,267: 6.6x.
  - Standard 4.09e8 → Long House 2.32e9: 5.7x.
  - Planet Portal 7.18e38 → Chicken Universe 3.22e41: 448x.
  - Meanwhile capacity steps are only 2x to 2.5x, rising to 6x for Chicken Universe.

**(2) Full vehicle ladder.** Capacity is in eggs/min [CONFIRMED-code] — [shipping_capacity.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/shipping_capacity.ts):
- Prices: the wiki lists Trike free, Transit Van 544 bocks, Semi 58.164T, "accurate as of Version 1.22.4", and "accurate to the order of magnitude as of 1.33.2". Other tiers' normal prices were not retrieved. [WIKI] — [Vehicles (fandom)](https://egg-inc.fandom.com/wiki/Vehicles)
- "The base price of a vehicle depends on how many of that level you already own, not on how many you own of other levels." [WIKI] — [Vehicles (fandom)](https://egg-inc.fandom.com/wiki/Vehicles); also [Vehicle Cost forum thread](https://egg-inc.fandom.com/f/p/4400000000000326414)
- The ladder below lists capacity, then look [UNVERIFIED]:
  - Trike: 5,000. Three-wheeled delivery bike/scooter.
  - Transit Van: 15,000. Delivery van.
  - Pickup: 50,000. Pickup truck.
  - 10 Foot: 100,000. Small box truck.
  - 24 Foot: 250,000. Large box truck.
  - Semi: 500,000. Tractor-trailer.
  - Double Semi: 1M. Semi with two trailers.
  - Future Semi: 5M. Futuristic semi.
  - Mega Semi: 15M. Oversized futuristic semi.
  - Hover Semi: 30M. Floating, wheel-less semi.
  - Quantum Transporter: 50M. Sci-fi teleport/transport vehicle.
  - Hyperloop Train: 50M per car. A train in a hyperloop tube; one engine plus added cars.
- **Hyperloop cars**:
  - A one-time Hyperloop purchase (50,000 golden eggs) is needed first. — [Vehicles (fandom, 1.22.4-era)](https://egg-inc.fandom.com/wiki/Vehicles?oldid=8651)
  - Each Hyperloop slot holds a train whose capacity = 50M × cars.
  - Base 5 cars; Micro-Coupling research adds 5 levels × +1, for 10 max. The first car is free with the train. [CONFIRMED-code] — [ascension-planner vehicles.ts](https://github.com/carpetsage/egg/blob/main/wasmegg/ascension-planner/src/lib/vehicles.ts), [researches.json](https://github.com/carpetsage/egg/blob/main/lib/researches.json)
  - Each added car has its own escalating price.
  - So 17 slots × 10 cars × 50M × ×14,016 research ≈ **1.19e14 eggs/min** maximum before artifacts [DERIVED].

**(3) How scaling creates time** [DERIVED from confirmed constants unless noted]
- Time to fill habs (minutes) = (total hab space − population) / (IHR per hab per min × number of habs). The community planner implements exactly this "time to hab lock" formula. [CONFIRMED-code] — [population.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/population.ts)
- Worked examples, with no boosts or artifacts, 4 habs, IHR only:
  - **Fresh farm**: 4 Coops (1,000 cap) at 2 chickens/min/hab (Internal Hatcheries level 1) → 1,000 / 8 = **125 min**. Manual hatching (2 to 32 chickens/s, hatchery 250 to 500 buffer) fills this in seconds. Early game is button-driven.
  - **Maxed research, 4 Chicken Universes** (11.34B) at max IHR: 7,440/min/hab online → 11.34e9 / 29,760 ≈ 381,000 min ≈ **265 days** online. Offline with max Calm (22,320/min/hab): ≈ 127,000 min ≈ **88 days**.
  - Endgame filling is therefore done with **boosts** (Tachyon Prisms and Boost Beacons multiply IHR; see `internalHatcheryRateBoostMultiplier` in [farm.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/farm.ts)) rather than waiting.
- Income vs cost: income ∝ population × lay rate × egg value. Each hab tier multiplies capacity by about 2x to 2.5x, but tier prices rise about 30x to 100x per tier ([hab_space.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/hab_space.ts)). So each successive purchase requires income to accumulate for a progressively longer wait, unless research multipliers (lay rate up to ×2,772, shipping up to ×14,016, egg value) grow income faster. The egg upgrade (gated by farm value) and prestige (Soul and Prophecy egg earnings bonus) reset the curve.
- Silo-cost growth (100M × n^(3n+15)) makes each extra hour of AFK time super-exponentially pricier. [CONFIRMED-code] — [silos.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/silos.ts)
- The Prestige page advises acting "once internal hatchery boosts expire, or when your habs are full". [WIKI] — [Prestige (fandom)](https://egg-inc.fandom.com/wiki/Prestige)

**(4) On-farm visual and animation flow**
- Reviews confirm:
  - "You tap a big red button to release chickens onto your farm, sell the eggs they produce, and spend the proceeds on bigger hen houses, faster delivery trucks." — [Playwanderer review](https://playwanderer.online/game-reviews/egg-inc)
  - "looking at chickens scurry across your farm is a cute and nice touch", and too many chickens at once can make the game lag. — [Sirus Gaming review](https://sirusgaming.com/egg-inc-review/)
  - "simple yet charming graphics… clicker elements with a simulation twist". — [Pookybox review](https://www.pookybox.com/egg-inc-review-secrets-universe-short-lived/)
- The save file tracks `num_chickens_running` and `num_chickens_unsettled` separately from `num_chickens`. This confirms a modelled transit state between the hatchery button and settled hab population. [CONFIRMED-code schema] — [ei.proto](https://github.com/carpetsage/egg/blob/main/protobuf/ei.proto)
- [UNVERIFIED recall] The farm is a small isometric map:
  - The hatchery and red button are at the bottom.
  - Released chicks run along a path into the 4 hab plots, which change model when upgraded.
  - Delivery vehicles drive off along a road from a depot. The Hyperloop adds a visible tube/track.
  - Silos and research/lab buildings sit on the map.
  - Drones fly overhead and are tapped for rewards. Drone payout scales with farm value × sqrt(RCB) — [Drones (fandom)](https://egg-inc.fandom.com/wiki/Drones).
  - The farm's look also changes per egg type. Verify all of this against gameplay video before use.

### Inferences
- For a dog clone, the strongest pacing levers to copy are:
  - 4 slots × many tiers with per-copy price tables.
  - Capacity steps of about 2x per tier, against price steps of about 30x to 100x.
  - A passive per-building intake (IHR) whose fill time crosses from minutes to days as the ladder climbs.
  - Boosts that compress those waits.
- The visual ladder's arc is rustic farm → industrial → retail parody → sci-fi → cosmic portal. That arc carries the sense of progression across orders of magnitude, and a dog theme can mirror it (doghouse → kennel → … → dog planet portal).

### Gaps
- No source-verified visual descriptions or flavor text for individual habs or vehicles; the wiki and icon CDN were unreachable.
- Normal-farm bock prices for most vehicles.
- No community timeline found for "time to max habs on an egg" or typical prestige-run length; the searches returned nothing relevant.
