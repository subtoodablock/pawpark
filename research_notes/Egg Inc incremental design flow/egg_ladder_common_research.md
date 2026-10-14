# Egg, Inc. — Egg Ladder (egg types & upgrading) and Common Research

Primary-data note: the most reliable source found is the open-source community tool suite **wasmegg** (carpetsage/egg on GitHub, the maintained successor of fanaticscripter's tools). Its `lib/researches.json` is a dump of the game's research config (names, tiers, levels, per-level effect, full per-level price arrays) and `lib/eggs.ts` holds per-egg values. The cloned repo's latest commit is dated **2026-10-13**, so these figures reflect the current game (2026). Key files:
- Research data: https://github.com/carpetsage/egg/blob/main/lib/researches.json (raw: https://raw.githubusercontent.com/carpetsage/egg/main/lib/researches.json)
- Egg values: https://github.com/carpetsage/egg/blob/main/lib/eggs.ts
- Tier unlock thresholds and discounts: https://github.com/carpetsage/egg/blob/main/wasmegg/ascension-planner/src/calculations/commonResearch.ts
- Research price effects: https://github.com/carpetsage/egg/blob/main/wasmegg/artifact-sandbox/src/lib/effects/research_price.ts
- Laying-rate formula: https://github.com/carpetsage/egg/blob/main/lib/farm/laying_rate.ts

Fandom wiki, NamuWiki and Wikipedia could not be fetched (DNS/proxy blocks), so figures from them are quoted from search-engine snippets only and are flagged as such. Labels used below: **[CONFIRMED-DATA]** = read from wasmegg source/data, **[SNIPPET]** = search snippet from a wiki or guide (not verified on the page), **[ESTIMATE]** = community estimate or my own inference.

---

## Q1. Full egg list: sell value and farm value needed to discover/upgrade

### Takeaway
There are 19 main ("home farm") eggs, from Edible ($0.25) to Universe ($100T), then Enlightenment, a special egg worth 1e-7 (shown in-game as $0.00). In 2024 (v1.35) five "Eggs of Virtue" were added after Enlightenment. Each step multiplies egg value by roughly 3–7×, except two big jumps: Terraform→Antimatter (100×) and Antimatter→Dark Matter (100×). You need a set farm value (roughly 6–7× more per step) first to "discover" the next egg and then to "upgrade" to it. Sources disagree on the exact threshold numbers.

### Cited Findings
**Egg values (per-egg sell price, "bocks"/$) — [CONFIRMED-DATA] from `eggValue()` in [wasmegg eggs.ts](https://github.com/carpetsage/egg/blob/main/lib/eggs.ts):**

| # | Egg | Value per egg | × previous |
|---|---|---|---|
| 1 | Edible | 0.25 | – |
| 2 | Superfood | 1.25 | 5× |
| 3 | Medical | 6.25 | 5× |
| 4 | Rocket Fuel | 30 | 4.8× |
| 5 | Super Material | 150 | 5× |
| 6 | Fusion | 700 | 4.67× |
| 7 | Quantum | 3,000 | 4.29× |
| 8 | Immortality (in-game name "CRISPR") | 12,500 | 4.17× |
| 9 | Tachyon | 50,000 | 4× |
| 10 | Graviton | 175,000 | 3.5× |
| 11 | Dilithium | 525,000 | 3× |
| 12 | Prodigy | 1,500,000 | 2.86× |
| 13 | Terraform | 10,000,000 | 6.67× |
| 14 | Antimatter | 1e9 | 100× |
| 15 | Dark Matter | 1e11 | 100× |
| 16 | AI | 1e12 | 10× |
| 17 | Nebula (icon file "egg_vision") | 1.5e13 | 15× |
| 18 | Universe | 1e14 | 6.67× |
| 19 | Enlightenment | 1e-7 | special (see below) |
| V | Curiosity / Integrity / Humility / Resilience / Kindness (Eggs of Virtue) | 1 each | separate track |
| C | Contract-only eggs, e.g. Chocolate 5, Easter 0.05, Waterballoon 0.1, Firework 4.99, Pumpkin 0.99, plus server-defined "custom eggs" | various | not on ladder |

- The code names Immortality "CRISPR" (`case ei.Egg.IMMORTALITY: return 'CRISPR'`) — [eggs.ts](https://github.com/carpetsage/egg/blob/main/lib/eggs.ts)
- Each Virtue egg has a purpose: Curiosity = Research, Integrity = Housing, Humility = Artifacts, Resilience = Silos, Kindness = Vehicles (`virtuePurpose()`) — [eggs.ts](https://github.com/carpetsage/egg/blob/main/lib/eggs.ts)
- Eggs of Virtue arrived in version 1.35 — [SNIPPET] [APKMirror 1.35.x changelog](https://www.apkmirror.com/apk/auxbrain-inc/egg-inc/egg-inc-1-35-3-release/), [Egg Inc Wiki Universe Egg](https://egg-inc.fandom.com/wiki/Universe_Egg)
- Fandom counts "nineteen main eggs, twelve contract eggs, and five Eggs of Virtue" — [SNIPPET] [Fandom Eggs](https://egg-inc.fandom.com/wiki/Eggs) (the page was about 441 days old when indexed)
- The Fandom Graviton/Dilithium/Antimatter pages give values of 175,000, 525,000 and 1 billion. These match the code — [SNIPPET] [Graviton Egg](https://egg-inc.fandom.com/wiki/Graviton_Egg), [Dilithium Egg](https://egg-inc.fandom.com/wiki/Dilithium_Egg), [Antimatter Egg](https://egg-inc.fandom.com/wiki/Antimatter_Egg)
- Prodigy is the smallest step up (2.9× over Dilithium). Terraform→Antimatter is the largest (100×) — [SNIPPET] [Prodigy Egg](https://egg-inc.fandom.com/wiki/Prodigy_Egg), [Terraform Egg](https://egg-inc.fandom.com/wiki/Terraform_Egg)
- Universe has the highest base value of all eggs, so the wiki recommends it as the egg to prestige on. The wiki lists its first-appearance threshold as 640 octodecillion — [SNIPPET] [Universe Egg](https://egg-inc.fandom.com/wiki/Universe_Egg)

**Farm-value thresholds ("Discover" = the next egg appears/teases; "Upgrade" = the upgrade button unlocks) — [SNIPPET], and the sources conflict:**

| Egg | Fandom Discover | Fandom Upgrade | NamuWiki "Upgradable Farm Value" | Other |
|---|---|---|---|---|
| Edible | none (start) | – | – | |
| Superfood | 10M | 68M | 67M | |
| Medical | 840M | 5.3B | 5.1B | |
| Rocket Fuel | 38B | 240B | – | LevelWinner (older): 230B |
| Fusion | 8 quadrillion | 50 quadrillion | 45 quadrillion | |
| Quantum | 3.6 quintillion | 23 quintillion | – | |
| Tachyon | 27 septillion | 170 septillion | – | |
| Graviton | 150 octillion | 980 octillion | 6 nonillion | |
| Dilithium | 760 nonillion | 4.8 decillion | 21 decillion | |
| Prodigy | 2.5 undecillion | 16 undecillion | (Namu discover 4.2 undecillion) | |
| Terraform | 3.2 duodecillion | 20 duodecillion | (Namu discover 3.7 duodecillion) | |
| Antimatter | 20 tredecillion | 130 tredecillion | 33 tredecillion | |
| Dark Matter | 190 quattuordecillion | 1.2 quindecillion | – | |
| Universe | 640 octodecillion (first appearance) | – | – | |

Sources: [Fandom Eggs](https://egg-inc.fandom.com/wiki/Eggs), [NamuWiki Egg, Inc.](https://en.namu.wiki/w/Egg,%20Inc.), [LevelWinner guide](https://www.levelwinner.com/egg-inc-ultimate-guide-tips-tricks-running-egg-empire/). All values come from search snippets. The page tables themselves could not be loaded.

**Enlightenment rules:**
- Enlightenment is the final main egg, added in update 1.8. Its value is so small the game shows it as 0.00. Wiki revisions disagree: one says one billionth of a bock, a newer one says one ten-millionth. The code value of 1e-7 matches the newer revision — [SNIPPET] [Fandom Enlightenment Egg (oldid 8203)](https://egg-inc.fandom.com/wiki/Enlightenment_Egg?oldid=8203); [CONFIRMED-DATA] [eggs.ts](https://github.com/carpetsage/egg/blob/main/lib/eggs.ts)
- Boosts cannot be used on the Enlightenment farm — [SNIPPET] [Fandom Enlightenment Egg](https://egg-inc.fandom.com/wiki/Enlightenment_Egg?oldid=7573)
- On an Enlightenment farm, an artifact's effect is multiplied by its `clarityEffect`. If that is 0, the effect is skipped. So artifacts only work there through Clarity stones — [CONFIRMED-DATA] [lib/artifacts/effects.ts `gatherRelevantEffects`](https://github.com/carpetsage/egg/blob/main/lib/artifacts/effects.ts)
- Enlightenment progress is measured in chicken-count trophies (the "Nirvana"/diamond goals) instead of earnings. wasmegg has a dedicated "enlightenment" companion tool — [CONFIRMED-DATA, existence only] [wasmegg/enlightenment](https://github.com/carpetsage/egg/tree/main/wasmegg/enlightenment)
- The Path of Virtue (the 5 virtue eggs) unlocks after laying 100T Enlightenment eggs in total over the account's history — [SNIPPET] [Fandom Path of Virtue](https://egg-inc.fandom.com/wiki/Path_of_Virtue)

### Inferences
- The value ladder (×3–7 per step, with occasional 100× jumps) together with farm-value gates about 6–7× apart (Discover→Upgrade) is the core pacing loop. The gates grow much faster than egg value (about 1e3–1e4× per step on the upper eggs). The gap is filled by soul eggs and prophecy eggs, epic research and artifacts, not by the egg value itself. [ESTIMATE]
- The "Discover" vs "Upgrade" split works as a teaser: the next egg is shown well before it can be bought. [ESTIMATE, based on column names]
- The two thresholds sit about 6–6.5× apart at every step in the Fandom data, a constant that is easy to copy in a clone. [ESTIMATE from the table above]

### Gaps
- No source in reach gave the AI, Nebula and Universe upgrade thresholds, or the Enlightenment unlock threshold. Fandom and NamuWiki disagree on Graviton, Dilithium and Antimatter (up to about 6×). This is possibly a rebalance, but unverified.
- The exact Nirvana/diamond trophy chicken counts are unverified. A "10B chickens" claim comes only from a TikTok page.

---

## Q2. What upgrading to the next egg resets and keeps; confirmation dialog

### Takeaway
An egg upgrade is a soft reset of the home farm, very close to a prestige. Chickens, habs, vehicles, cash and common research all reset, and the farm starts over on the new egg. Soul eggs, prophecy eggs, golden eggs, epic research, artifacts and the Pro Permit carry over. Unlike prestige, an egg upgrade does not award soul eggs.

### Cited Findings
- "When the player's farm value reaches a certain threshold, the player can upgrade to a new egg, restarting, but with each egg selling for a higher base price (except for the Enlightenment egg)" — [SNIPPET] [Wikipedia: Egg, Inc.](https://en.wikipedia.org/wiki/Egg,_Inc.)
- "Epic research is permanent, meaning it will never reset even if the player prestiges or upgrades their egg." Golden eggs "do not reset when upgrading the egg type or prestiging" — [SNIPPET] [Wikipedia: Egg, Inc.](https://en.wikipedia.org/wiki/Egg,_Inc.)
- Prestige means "losing all cash and progress, but keeping golden eggs, soul eggs, eggs of prophecy, epic research, and the pro permit (if purchased)". Soul eggs earned scale with farm value — [SNIPPET] [Wikipedia: Egg, Inc.](https://en.wikipedia.org/wiki/Egg,_Inc.)
- After prestiging a player has "few chickens and no common research" — [SNIPPET] [Touch, Tap, Play — How to prestige](https://www.touchtapplay.com/egg-inc-how-to-prestige/)
- Guides advise holding off on an upgrade when close to a mission reward, because "holding off on upgrading gives you a better chance of completing a mission" (missions are tied to the egg) — [SNIPPET] [Gamezebo prestige guide](https://www.gamezebo.com/walkthroughs/how-to-prestige-egg-inc-why-you-should/)
- The data model holds one list of common research levels per farm. Common research is a per-farm purchase with in-game cash, which can't carry over once cash resets — [CONFIRMED-DATA, structural] [lib/farm/farm.ts `researches()`](https://github.com/carpetsage/egg/blob/main/lib/farm/farm.ts)

### Inferences
- Running chicken bonus: this is a transient multiplier built up by tapping/holding the hatch button. It drops back to 0 whenever the farm resets, since the chicken count goes back to its starting level. [ESTIMATE]
- Active boosts: boosts are timed items from the player's global inventory. Community experience is that they keep ticking across egg upgrades and are not refunded. No source found confirms this. [ESTIMATE]
- Design takeaway for a clone: an egg upgrade = prestige minus the soul-egg payout, plus a higher base value. Early on, this is what makes each egg feel like a fresh restart with a higher ceiling.

### Gaps
- No source confirmed the exact wording of the egg-upgrade confirmation dialog. It is not in the wasmegg code, which reads saves and does not render game UI. A dialog plausibly exists (as for prestige), but its wording is unverified.
- Explicit confirmation that habs and vehicles are wiped (as opposed to the general "restarting" wording) came only from secondary text, not a primary statement.

---

## Q3. Can players go back to a previous egg?

### Takeaway
Yes. A player can move the home farm back to any already-unlocked egg (another soft reset), mainly to chase per-egg trophies and to satisfy egg-tied requirements. Contracts are not a reason to go back, because they run on separate contract farms.

### Cited Findings
- "The game keeps track of the most chickens you've had on a home farm for each type of egg," and trophies are awarded at chicken-count milestones per egg — [SNIPPET] [Fandom Trophies](https://egg-inc.fandom.com/wiki/Trophies)
- "Since it is harder to get each amount of chickens with lower value eggs, trophies for lower value eggs are harder to obtain and typically offer 'better' rewards" — [SNIPPET] [Fandom Trophies](https://egg-inc.fandom.com/wiki/Trophies)
- Contracts "do not count towards Trophies". To start a contract "you must have the respective egg unlocked on your home farm" — [SNIPPET] [Fandom Contracts](https://egg-inc.fandom.com/wiki/Contracts?oldid=9822), [Fandom Trophies](https://egg-inc.fandom.com/wiki/Trophies)
- Universe is the recommended egg to prestige on because of its value. This implies players do sit on a chosen egg rather than always the newest one — [SNIPPET] [Fandom Universe Egg](https://egg-inc.fandom.com/wiki/Universe_Egg)

### Inferences
- The back-switch exists for: (a) per-egg trophies (golden-egg/prophecy rewards), (b) Enlightenment being a different game mode, where players switch between it and Universe, and (c) any missions tied to a lower egg. [ESTIMATE]
- Switching back resets the farm the same way an upgrade does. [ESTIMATE, not explicitly confirmed]

### Gaps
- The exact UI label ("Previous egg" or similar) and dialog text are not confirmed. No source confirmed whether switching eggs is free or costs anything.

---

## Q4. Do research, hab and vehicle prices differ by egg?

### Takeaway
On the 19 standard eggs, **no**. The game ships one price list per common research item, not one per egg, so research costs the same cash on Edible as on Universe. The only egg-specific price table belongs to the **Eggs of Virtue**, which have their own `virtue_prices` and virtue hab/vehicle costs. Higher eggs feel faster and cheaper because each egg sells for 3–100× more while costs stay flat. Players get past the cheap early tiers in minutes and quickly reach the later tiers, which cost 1e20–1e67.

### Cited Findings
- Each research record has exactly two price arrays: `prices` (standard) and `virtue_prices`. There is no per-egg dimension. Example: Comfortable Nests level 1 = 0.5, level 50 = 1,534,724 (standard), versus 14.25 → 4,450,785 (virtue) — [CONFIRMED-DATA] [researches.json](https://raw.githubusercontent.com/carpetsage/egg/main/lib/researches.json)
- The virtue price curve has a different shape. Early-tier items cost about 3–18× more on virtue eggs (e.g. Comfy Nests ×10, Better Incubators ×17.8), while tier-3+ items cost far less (Lightweight Boxes about 0.1×, and tier 6+ effectively thousands of times cheaper) — [CONFIRMED-DATA, computed from both arrays] [researches.json](https://raw.githubusercontent.com/carpetsage/egg/main/lib/researches.json)
- Habs have a separate `virtueCost` table, e.g. the first hab tiers [0, 124, 195, 269], [917, 1211, 1528, 1869] … — [CONFIRMED-DATA] [lib/farm/hab_space.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/hab_space.ts). The same holds for vehicles (`virtueCost`, `HYPERLOOP_CAR_VIRTUE_COSTS`) — [ascension-planner lib/vehicles.ts](https://github.com/carpetsage/egg/blob/main/wasmegg/ascension-planner/src/lib/vehicles.ts)
- Global cost modifiers that apply to every egg: Cheaper Contractors (-5% hab cost per level, 10 levels), Bust Unions (-5% vehicle cost per level, 10 levels), Lab Upgrade (-5% research cost per level, 10 levels = -50%). There are also colleggtible modifiers for HAB_COST, VEHICLE_COST and RESEARCH_COST — [CONFIRMED-DATA] [researches.json](https://raw.githubusercontent.com/carpetsage/egg/main/lib/researches.json), [eggs.ts GameDimension enum](https://github.com/carpetsage/egg/blob/main/lib/eggs.ts)

### Inferences
- Higher eggs feel different through (1) egg value: ×3–100 per step, so the same research is "cheaper" relative to income, (2) the farm-value gates, which rise about 1e3–1e4× per step and so require pushing into deeper research tiers on every new egg, and (3) the soul-egg/epic-research meta multipliers that grow between runs. [ESTIMATE]
- The wasmegg data does not hold standard-egg hab or vehicle base prices. That none of them vary by egg is inferred from the absence of any per-egg price field, plus the existence of a separate virtue table. [ESTIMATE]

### Gaps
- No community statement found saying "research is more expensive on higher eggs". The evidence (one shared standard price list) points the other way for standard eggs.

---

## Q5. Common research structure

### Takeaway
There are **56 common research items in 13 tiers**, with **2,330 levels in total**. Tiers unlock by the total number of research levels bought: 0 / 30 / 80 / 160 / 280 / 400 / 520 / 650 / 800 / 980 / 1,185 / 1,390 / 1,655 for tiers 1–13. Within an item, levels add up linearly (+10% per level → 1 + 0.1·L). Across items, effects multiply. The exceptions are the "DOUBLES/TRIPLES/10×" items, which multiply per level. Cost per level grows geometrically, at about ×1.07–×1.6 for long items and much more steeply for short ones. A Lab Upgrade epic (up to -50%) and timed research sales (-70%) reduce costs.

### Cited Findings
- **Tier unlock thresholds** (cumulative purchases): `[0, 30, 80, 160, 280, 400, 520, 650, 800, 980, 1185, 1390, 1655]`. The code comment reads "Index 12 = tier 13 (requires 1655 purchases from tiers 1-12)" — [CONFIRMED-DATA] [commonResearch.ts](https://github.com/carpetsage/egg/blob/main/wasmegg/ascension-planner/src/calculations/commonResearch.ts)
- **Counts:** 56 common items plus 22 epic items. Common levels total 2,330 — [CONFIRMED-DATA] [researches.json](https://raw.githubusercontent.com/carpetsage/egg/main/lib/researches.json)
- **Categories present** (`categories` field): egg_laying_rate, egg_value, hatchery_refill_rate, hatchery_capacity, running_chicken_bonus, hab_capacity, internal_hatchery_rate, shipping_capacity (capacity and speed), fleet_size (also hyperloop train length). Drone rewards is an **epic** research, not a common one — [CONFIRMED-DATA] [researches.json](https://raw.githubusercontent.com/carpetsage/egg/main/lib/researches.json)
- **Compounding:** each item has `effect_type` ("multiplicative" = multiplies the stat; "additive" = adds flat amounts, e.g. +2 chickens/min, +10 hatchery capacity, +1 vehicle) and `levels_compound` ("additive" for all items except Bigger Eggs, USDE Prime, Even Bigger Eggs, Graviton Coating, Multiversal Layering and Timeline Splicing, which are "multiplicative"). The laying-rate code applies `base(1/30 egg/s) × Π_items (1 + perLevel × level) × artifacts`. That is additive within an item and multiplicative across items. **Confirmed** — [CONFIRMED-DATA] [laying_rate.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/laying_rate.ts), [researches.json](https://raw.githubusercontent.com/carpetsage/egg/main/lib/researches.json)
- **Base laying rate** is 1 egg per chicken per 30 s — [CONFIRMED-DATA] [laying_rate.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/laying_rate.ts)
- **Discounts:** Lab Upgrade epic research gives "-5% research cost per level (max level 10 = 50% off)". It stacks multiplicatively with the Puzzle Cube artifact and the colleggtible RESEARCH_COST modifier (0.95–1.0) — [CONFIRMED-DATA] [research_price.ts](https://github.com/carpetsage/egg/blob/main/wasmegg/artifact-sandbox/src/lib/effects/research_price.ts), [commonResearch.ts](https://github.com/carpetsage/egg/blob/main/wasmegg/ascension-planner/src/calculations/commonResearch.ts). "All discounts are multiplicative." An active research sale multiplies the cost by 0.3 (70% off): `return isActiveSale ? multiplier * 0.3 : multiplier` — [CONFIRMED-DATA] same file. Vehicle (Bust Unions) and hab sales use the same pattern.

**Full common research list — [CONFIRMED-DATA] from [researches.json](https://raw.githubusercontent.com/carpetsage/egg/main/lib/researches.json).** Columns: max levels, effect per level, compounding (effect_type/levels_compound), price of level 1, price of the last level, total cost to max (standard eggs, no discounts), and the per-level cost growth factor (median over the second half of levels, computed).

| Tier | Research | Effect per level | Max L | Lvl1 cost | Last lvl cost | Total to max | Growth/lvl |
|---|---|---|---|---|---|---|---|
| 1 | Comfortable Nests | +10% laying rate | 50 | 0.5 | 1.53e6 | 7.33e6 | ×1.27 |
| 1 | Nutritional Supplements | +25% egg value | 40 | 2.16 | 1.79e7 | 6.55e7 | ×1.38 |
| 1 | Better Incubators | hatchery refill +10% | 15 | 18.3 | 9,542 | 3.0e4 | ×1.47 |
| 1 | Excitable Chickens | +0.1% egg value per running chicken (RCB) | 25 | 1.06 | 3.46e11 | 5.78e11 | ×2.52 |
| 2 | Hen House Remodel | +5% hab capacity | 8 | 550 | 6.80e4 | 1.39e5 | ×1.95 |
| 2 | Internal Hatcheries | +2 chickens/min per hab (flat) | 10 | 1,836 | 2.27e8 | 3.30e8 | ×3.61 |
| 2 | Padded Packaging | +25% egg value | 30 | 4.55e5 | 1.02e10 | 3.55e10 | ×1.41 |
| 2 | Hatchery Expansion | +10 hatchery capacity | 10 | 73.2 | 4.78e7 | 6.48e7 | ×3.86 |
| 2 | Bigger Eggs | ×2 egg value | 1 | 1.35e6 | – | 1.35e6 | – |
| 3 | Internal Hatchery Upgrades | +5 chickens/min per hab | 10 | 1.60e7 | 7.00e13 | 8.62e13 | ×5.38 |
| 3 | Improved Leafsprings | +5% vehicle capacity | 30 | 3.21e6 | 2.00e12 | 5.47e12 | ×1.58 |
| 3 | Vehicle Reliability | +1 fleet size | 2 | 3.24e8 | 2.65e13 | 2.65e13 | – |
| 3 | Rooster Booster | hatchery refill +5% | 25 | 4.01e6 | 1.22e14 | 2.41e14 | ×2.04 |
| 3 | Coordinated Clucking | max RCB +0.2× | 50 | 5.69e5 | 1.98e13 | 6.76e13 | ×1.42 |
| 4 | Hatchery Rebuild | +50 hatchery capacity | 1 | 1.87e11 | – | 1.87e11 | – |
| 4 | USDE Prime Certification | ×3 egg value | 1 | 3.23e13 | – | 3.23e13 | – |
| 4 | Hen House A/C | +5% laying rate | 50 | 2.99e6 | 7.52e12 | 2.93e13 | ×1.35 |
| 4 | Super-Feed Diet | +25% egg value | 35 | 5.31e8 | 4.24e13 | 1.51e14 | ×1.39 |
| 4 | Microlux Chicken Suites | +5% hab capacity | 10 | 6.83e8 | 2.80e12 | 4.66e12 | ×2.51 |
| 5 | Compact Incubators | +10 hatchery capacity | 10 | 2.37e9 | 3.82e16 | 4.56e16 | ×6.24 |
| 5 | Lightweight Boxes | +10% vehicle capacity | 40 | 6.93e11 | 3.37e17 | 1.19e18 | ×1.40 |
| 5 | Depot Worker Exoskeletons | +1 fleet size | 2 | 8.68e11 | 6.93e17 | 6.93e17 | – |
| 5 | Internal Hatchery Expansion | +10 chickens/min per hab | 15 | 2.89e12 | 2.27e18 | 3.67e18 | ×2.63 |
| 5 | Improved Genetics | +15% laying rate AND egg value | 30 | 7.49e12 | 3.21e17 | 1.05e18 | ×1.44 |
| 6 | Traffic Management | +1 fleet size | 2 | 5.38e15 | 1.34e20 | 1.34e20 | – |
| 6 | Motivational Clucking | max RCB +0.5× | 50 | 1.50e11 | 7.02e25 | 1.42e26 | ×1.98 |
| 6 | Driver Training | +5% vehicle speed | 30 | 1.15e16 | 4.59e20 | 1.51e21 | ×1.44 |
| 6 | Shell Fortification | +15% egg value | 60 | 1.47e16 | 2.75e22 | 1.28e23 | ×1.28 |
| 7 | Egg Loading Bots | +1 fleet size | 2 | 3.88e21 | 9.04e25 | 9.04e25 | – |
| 7 | Super Alloy Frames | +5% vehicle capacity | 50 | 1.45e20 | 6.03e25 | 2.61e26 | ×1.30 |
| 7 | Even Bigger Eggs | ×2 egg value per level | 5 | 2.86e19 | 1.68e30 | 1.68e30 | ×~470 |
| 7 | Internal Hatchery Expansion (II) | +25 chickens/min per hab | 30 | 3.30e17 | 1.25e27 | 2.36e27 | ×2.13 |
| 8 | Quantum Egg Storage | +5% vehicle capacity | 20 | 5.09e23 | 5.50e33 | 7.85e33 | ×3.36 |
| 8 | Genetic Purification | +10% egg value | 100 | 1.12e20 | 1.13e35 | 3.90e35 | ×1.41 |
| 8 | Machine Learning Incubators | +5 chickens/min per hab | 250 | 1.45e23 | 1.69e34 | 1.75e35 | ×1.11 |
| 8 | Time Compression | +10% laying rate | 20 | 3.45e22 | 3.95e32 | 5.62e32 | ×3.36 |
| 9 | Hover Upgrades | +5% hover vehicle capacity | 25 | 1.22e27 | 1.47e37 | 2.45e37 | ×2.62 |
| 9 | Graviton Coating | ×2 egg value per level | 7 | 7.83e28 | 3.39e43 | 3.41e43 | ×~220 |
| 9 | Grav Plating | +2% hab capacity | 25 | 2.45e31 | 6.58e36 | 1.67e37 | ×1.67 |
| 9 | Crystalline Shelling | +25% egg value | 100 | 2.46e29 | 1.64e40 | 8.14e40 | ×1.27 |
| 10 | Autonomous Vehicles | +1 fleet size | 5 | 5.14e32 | 5.95e40 | 6.03e40 | ×~84 |
| 10 | Neural Linking | +50 chickens/min per hab | 30 | 7.02e26 | 6.94e54 | 7.83e54 | ×8.76 |
| 10 | Telepathic Will | +25% egg value | 50 | 4.22e36 | 9.12e45 | 2.55e46 | ×1.56 |
| 10 | Enlightened Chickens | max RCB +2.0× | 150 | 1.09e40 | 4.22e62 | 1.43e63 | ×1.42 |
| 11 | Dark Containment | +5% vehicle capacity | 25 | 3.95e36 | 1.02e54 | 1.25e54 | ×5.37 |
| 11 | Atomic Purification | +10% egg value | 50 | 4.34e44 | 5.97e58 | 1.23e59 | ×1.94 |
| 11 | Multiversal Layering | ×10 egg value per level | 3 | 2.24e50 | 3.51e63 | 3.51e63 | – |
| 11 | Timeline Diversion | +2% laying rate | 50 | 2.36e43 | 1.36e57 | 2.86e57 | ×1.91 |
| 12 | Wormhole Dampening | +2% portal hab capacity | 25 | 9.40e48 | 4.01e61 | 5.72e61 | ×3.36 |
| 12 | Eggsistor Miniturization | +5% egg value | 100 | 1.79e49 | 2.46e63 | 8.81e63 | ×1.39 |
| 12 | Graviton Coupling | +1 hyperloop train length | 5 | 3.96e43 | 1.89e65 | 1.89e65 | ×~2.6e5 |
| 12 | Neural Net Refinement | +5% vehicle speed | 25 | 2.60e44 | 4.40e63 | 5.23e63 | ×6.33 |
| 13 | Matter Reconfiguration | +1% egg value | 500 | 1.58e52 | 2.18e66 | 3.46e67 | ×1.07 |
| 13 | Timeline Splicing | ×10 egg value | 1 | 1.66e67 | – | 1.66e67 | – |
| 13 | Hyper Portalling | +5% hyperloop car capacity | 25 | 7.83e56 | 2.09e66 | 3.51e66 | ×2.47 |
| 13 | Relativity Optimization | +10% laying rate | 10 | 1.45e55 | 1.42e65 | 1.54e65 | ×12.9 |

Per-tier summary (items / levels / cumulative levels): T1 4/130/130; T2 5/59/189; T3 5/117/306; T4 5/97/403; T5 5/97/500; T6 4/142/642; T7 4/87/729; T8 4/390/1119; T9 4/157/1276; T10 4/235/1511; T11 4/128/1639; T12 4/155/1794; T13 4/536/2330 — [CONFIRMED-DATA, computed] [researches.json](https://raw.githubusercontent.com/carpetsage/egg/main/lib/researches.json)

**Epic research (paid with golden eggs, never resets) — for context.** Hold to Hatch (15), Epic Hatchery (20, +10% refill), Epic Int. Hatcheries (20, +5%), Video Doubler Time (12, +30 min), Epic Clucking (20), Epic Multiplier (100, max RCB +2×), Cheaper Contractors (10, -5% hab cost), Bust Unions (10, -5% vehicle cost), Lab Upgrade (10, -5% research cost), Silo Capacity (20, +6 min), Internal Hatchery Sharing (10), Internal Hatchery Calm (20, +10% while away), Accounting Tricks (20, +5% farm value), Soul Food (140, +1% per soul egg), Prestige Bonus (20, +10% soul eggs), Drone Rewards (20, +10% chance of bigger drones), Epic Comfy Nests (20, +5% laying), Transportation Lobbyists (30, +5% vehicle capacity), Prophecy Bonus (5, +1%), Hold to Research (8), FTL Drive Upgrades (25), Zero-g Quantum Containment (10) — [CONFIRMED-DATA] [researches.json](https://raw.githubusercontent.com/carpetsage/egg/main/lib/researches.json)

### Inferences
- The tier gates (30, 50, 80, 120, 120, 120, 130, 150, 180, 205, 205, 265 purchases between tiers) are small compared with tier sizes (60–540 levels). So players unlock the next tier well before finishing the current one, and the cheapest levels from the new tier compete with expensive late levels of the old one. Tier 2 (59 levels) can be finished before tier 3 unlocks only together with tier 1. [ESTIMATE]
- First-level costs climb about 1e2–1e5× per tier, roughly tracking egg value ×5 per egg times farm growth. This is how the same research list serves every egg. [ESTIMATE]
- Price curves look like a hand-tuned geometric progression. Long "+x%" items use ×1.07–×1.6 per level. Short flat-bonus items (fleet size, hatchery capacity, internal hatchery) and "DOUBLES/×10" items use very steep factors. In Tier 1 the first step is unusually large (Comfy Nests 0.5 → 3.26). A clone can model this as `price(L) = a·r^L` with an early-level fudge. [ESTIMATE]

### Gaps
- The exact research-sale schedule and how often sales run were not found. The 70% figure comes from planner code, not an official statement.

---

## Q6. How long players typically spend per egg (early vs late)

### Takeaway
I found no reliable, quantified source. Guides only describe pacing qualitatively: early eggs go fast, and players usually prestige or upgrade when progress stalls and the egg's missions are done.

### Cited Findings
- Prestige "when your progress seems to be slowing down to a crawl and you have no more missions related to your current egg type" — [SNIPPET] [Gamezebo](https://www.gamezebo.com/walkthroughs/how-to-prestige-egg-inc-why-you-should/)
- First prestige advice: wait for about 50+ soul eggs, then afterwards wait until you can roughly double your eggs — [SNIPPET] [Android Central](https://www.androidcentral.com/tips-and-tricks-egg-inc)
- One guide notes that with maxed internal hatcheries, reaching the 250M-chicken trophy takes about a week of silo refills (late game) — [SNIPPET] [patashu guide (r/EggsInc wiki mirror)](https://lr.eu.psf.lt/r/EggsInc/wiki/patashu_guide)
- Community advice: you need an Earnings Bonus in the octillions, or very good artifacts, for the Enlightenment diamond-trophy habs — [SNIPPET] [Fandom forum thread](https://egg-inc.fandom.com/f/p/4400000000000325409)

### Inferences
- [ESTIMATE, unsourced community folklore] A first run reaches Edible→Medical in minutes to an hour of active play and the mid eggs (Fusion→Graviton) over days. The upper eggs (Antimatter→Universe) take weeks to months on a first climb, and later climbs after prestige are much faster as soul eggs build up. Treat this as a design target to playtest, not data.

### Gaps
- No measured times per egg (median player hours or days) were found. The r/EggsInc threads that would have them were not reachable in search results.

---

## Q7. Scaling: how Egg Inc makes growing take time (designer-requested)

### Takeaway
Pacing comes from a widening gap between two curves. **Egg value** rises only about ×3–7 per egg (×100 at two jumps). The **farm-value gates** rise about ×50–×80 per step early on and about ×1,000–×9,000 per step from Tachyon upward. Egg value covers only a small share of each step, so the rest has to come from deeper common research (whose per-level costs grow geometrically), more chickens and habs, and the cross-run meta (soul eggs, prophecy eggs, epic research, artifacts). New players therefore crawl through upper eggs, while veterans with large soul-egg bonuses can clear early eggs in minutes. Hard, recent data on time per egg is essentially missing. The one timeline figure found is old and ambiguous.

### Cited Findings
**Egg-value ratio vs farm-value gate ratio per step.** Egg ratios are [CONFIRMED-DATA] from [eggs.ts](https://github.com/carpetsage/egg/blob/main/lib/eggs.ts). Gates are Fandom "Upgrade" values [SNIPPET] from [Fandom Eggs](https://egg-inc.fandom.com/wiki/Eggs); gate ratios are computed by me.

| Step (to egg) | Egg value × | Upgrade gate | Gate × vs previous listed gate | Gate×/Value× |
|---|---|---|---|---|
| Superfood | 5 | 6.8e7 | – | – |
| Medical | 5 | 5.3e9 | ×78 | ~16 |
| Rocket Fuel | 4.8 | 2.4e11 | ×45 | ~9 |
| Super Material | 5 | (not found) | – | – |
| Fusion | 4.67 | 5.0e16 | ×2.1e5 over 2 steps (~×456/step) | ~95 |
| Quantum | 4.29 | 2.3e19 | ×460 | ~107 |
| Immortality | 4.17 | (not found) | – | – |
| Tachyon | 4 | 1.7e26 | ×7.4e6 over 2 steps (~×2,700/step) | ~670 |
| Graviton | 3.5 | 9.8e29 | ×5,765 | ~1,650 |
| Dilithium | 3 | 4.8e33 | ×4,900 | ~1,630 |
| Prodigy | 2.86 | 1.6e37 | ×3,333 | ~1,170 |
| Terraform | 6.67 | 2.0e40 | ×1,250 | ~190 |
| Antimatter | 100 | 1.3e44 | ×6,500 | ~65 |
| Dark Matter | 100 | 1.2e48 | ×9,230 | ~92 |

Within each egg, Fandom's Discover→Upgrade gap is a steady ×6–6.8 (e.g. Superfood 10M→68M, Graviton 150→980 octillion, Dark Matter 190 quattuordecillion→1.2 quindecillion) — [SNIPPET] [Fandom Eggs](https://egg-inc.fandom.com/wiki/Eggs). NamuWiki gives different upper gates (Graviton 6 nonillion, Dilithium 21 decillion, Antimatter 33 tredecillion) — [SNIPPET] [NamuWiki](https://en.namu.wiki/w/Egg,%20Inc.). The ratio column should be read as order-of-magnitude only.

**Research pacing within one egg** [CONFIRMED-DATA, computed from [researches.json](https://raw.githubusercontent.com/carpetsage/egg/main/lib/researches.json) and [commonResearch.ts](https://github.com/carpetsage/egg/blob/main/wasmegg/ascension-planner/src/calculations/commonResearch.ts)]:
- Per-level cost growth: long percentage items grow ×1.07–×1.6 per level (Matter Reconfiguration ×1.07, Machine Learning Incubators ×1.11, Comfy Nests ×1.27, Shell Fortification ×1.28, Nutritional Supplements ×1.38, Lightweight Boxes ×1.40). Short flat-bonus items grow ×2–×13 per level (Internal Hatcheries ×3.6, Compact Incubators ×6.2, Neural Linking ×8.8, Relativity Optimization ×12.9). Multiplier items are steeper still (Even Bigger Eggs ×~470/level, Graviton Coating ×~220, Graviton Coupling ×~2.6e5).
- Tier gates are cumulative levels bought: 0, 30, 80, 160, 280, 400, 520, 650, 800, 980, 1,185, 1,390, 1,655. The per-tier increments are 30/50/80/120/120/120/130/150/180/205/205/265.
- Cost to max each tier (no discounts): T1 5.8e11, T3 4.3e14, T5 6.7e18, T7 1.7e30, T9 3.4e43, T10 1.4e63, T13 5.5e67. Level-1 prices go from 0.5 (T1) to about 1e52–1e67 (T13).
- The same price list serves every standard egg (see Q4). A higher egg buys a given level ×(egg value ratio) faster, but must then reach deeper tiers to hit a gate that is ×1,000+ higher.

**Time per egg / first-time timeline:**
- A guide puts "roughly 50 to 75 days" as the typical time for an Enlightenment goal, depending on earnings bonus, internal hatchery rate and artifacts. It also gives a minimum for a pre-1.20.4 build. The snippet is ambiguous: it most likely refers to growing the Enlightenment farm to its trophy, not to reaching the egg. It is about 4.5 years old — [SNIPPET] [Thank Chickens: How do you beat Egg Inc fast?](https://thankchickens.com/how-do-you-beat-egg-inc-fast/)
- Reaching the 250M-chicken trophy with maxed internal hatcheries takes "about a week of refilling the silos" — [SNIPPET] [patashu guide](https://lr.eu.psf.lt/r/EggsInc/wiki/patashu_guide)
- Prestige advice: wait for about 50+ soul eggs on the first prestige, then roughly double each time. Each soul egg gives +10% earnings (+1% more per Soul Food level, up to 140 levels) — [SNIPPET] [Android Central](https://www.androidcentral.com/tips-and-tricks-egg-inc); Soul Food per level [CONFIRMED-DATA] [researches.json](https://raw.githubusercontent.com/carpetsage/egg/main/lib/researches.json)
- Soul eggs earned on prestige scale with farm value — [SNIPPET] [Wikipedia](https://en.wikipedia.org/wiki/Egg,_Inc.)

### Inferences
- **Why upper eggs slow down:** early on, the gate ratio (×45–×80) is only about 10–16× the egg ratio (×5), so a few research tiers plus hab and vehicle growth close it within one sitting. From Tachyon on, the gate ratio (×1,000–×9,000) is 100–1,700× the egg ratio. A single run can't close that gap, so players have to prestige several times to grow the soul-egg multiplier. This is the main time sink. [ESTIMATE]
- **New player vs veteran:** a veteran's earnings bonus (soul eggs × (10% + Soul Food) × prophecy compounding) multiplies all income. Early gates (1e7–1e11) are trivial to them, and they skip through early eggs in minutes. A new player has a bonus near 1× and must grow the farm itself. [ESTIMATE; no measured times found]
- **Community-style first-time timeline** [ESTIMATE, unsourced folklore, for playtest targeting only]: Edible→Superfood→Medical in the first session (minutes to about 1 hour). Rocket Fuel and Super Material within day 1–2. Fusion and Quantum in the first week. Immortality→Graviton over weeks 1–3, now relying on prestige. Dilithium→Terraform over weeks to about 2 months. Antimatter→Universe over months. Enlightenment after months, and then 50–75+ days to grow it (per the Thank Chickens snippet).
- **Design recipe for the dog clone:** pet value ×4–5 per tier early, shrinking to ×3 mid-ladder, with rare ×100 "era" jumps. Gates ×50–80 apart early, rising to ×1e3–1e4 later. Discover→Upgrade at a fixed ×6.5. One shared research price list with geometric per-level growth (×1.1–×1.6 for percentage items, ×2–×10 for flat items) and cumulative-purchase tier gates. The prestige-currency multiplier is the only thing that closes late gates.

### Gaps
- No reliable, recent, quantified time-per-egg data was found for either new or veteran players. The r/EggsInc timeline threads were not reachable. The Super Material, Immortality, AI, Nebula and Universe upgrade gates are missing, so those step ratios can't be computed.
