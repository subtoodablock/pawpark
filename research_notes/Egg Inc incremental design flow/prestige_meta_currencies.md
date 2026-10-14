# Egg, Inc. Prestige & Meta-Progression (Soul Eggs, Prophecy Eggs, EB, Golden Eggs, Epic Research, Boosts, Drones, Gifts, Piggy Bank, Ads)

Research date: 2026-10-14. Source access notes: egg-inc.fandom.com, NamuWiki, miraheze, jzr.uz, wamohdog.com and Reddit mirrors all failed to fetch (DNS/proxy block), so wiki numbers below come from search-result snippets and are labelled as such. The strongest source is the open-source **wasmegg** toolkit by @mk2 (github.com/fanaticscripter/Egg, cloned locally; last commit 12 Oct 2026). It contains the game's protobuf schema, the epic research table, the EB formula, the farmer role ladder and PE sources as working code that the community uses. Labels: **[CONFIRMED-code]** = in wasmegg code or the game protobuf; **[WIKI-snippet]** = community wiki text quoted through search; **[COMMUNITY]** = guide or Reddit estimate; **[UNKNOWN]**.

Abbreviations: SE = Soul Eggs, PE = Prophecy Eggs (Eggs of Prophecy), GE = Golden Eggs, EB = Earnings Bonus, ER = epic research.

---

## 1. Soul eggs: gain formula, accrual, per-egg bonus, Prestige Bonus, beacons, events

### Takeaway
SE gained per prestige is a sub-linear power function of "Prestige Earnings" (cash/bocks earned since the last prestige). The late-game exponent is about **0.21**. A piecewise formula below 1 Nd (1e60) mixes terms with exponents 0.15, 0.20 and 0.21, so the commonly quoted "0.15" is only the early-game term. Each SE adds a flat +10% earnings (up to +150% with Soul Food 140). Prestige Bonus ER multiplies SE gained, by up to +200% additive. Soul Beacons multiply the cash that counts toward SE, and the 0.21 exponent compresses them heavily. There is no hard SE cap: diminishing returns come from the power law alone.

### Cited Findings
- SE are "mainly earned by prestiging"; each "permanently increases your earnings by 10%". The amount "scales with your Prestige Earnings… the Bocks you've earned since your last prestige", and "gains slow as that total grows, so frequent prestiging tends to pay better than waiting" — [WIKI-snippet: Earnings Bonus/Soul Eggs](https://egg-inc.fandom.com/wiki/Earnings_Bonus/Soul_Eggs)
- Simplified prestige formula: SE ∝ (Virtual Earnings)^0.21. Worked example: a 2x earnings boost multiplies SE by 2^0.21 = 1.1567, "only a 15.67% increase" — [WIKI-snippet: Artifacts](https://egg-inc.fandom.com/wiki/Artifacts)
- Piecewise form: "If current Prestige Earnings are less than 1 Nd (10^60), then the formula uses a sum of max terms with exponents of 0.15, 0.20, and 0.21." Above 1 Nd it is a single 0.21 term with a 10^-6 scaling constant. Exact coefficients could not be recovered from snippets — [WIKI-snippet: Earnings Bonus / Prestige](https://egg-inc.fandom.com/wiki/Earnings_Bonus); [WIKI-snippet: Prestige (miraheze)](https://egginc.miraheze.org/wiki/Prestige)
- Formula skeleton per a wiki-derived PDF: "SE Gained = (Prestige Bonus Epic Research) (Event Boost) × f(Prestige Earnings)" — [snippet via search](https://egginc.miraheze.org/wiki/Prestige)
- The jzr.uz blog states that the "prestige calculations using an exponent of 0.21 are late-game approximations, not universal results", and that Auxbrain confirms the general mechanics while the detailed formulas are community-documented — [COMMUNITY: JZR](https://jzr.uz/blog/egg-inc-mystical-eggs-math)
- One calculator site's approximation: SE ≈ (farm value / 1,000,000)^0.21 × Soul Food × Prestige Bonus × boost multipliers — [COMMUNITY: everycalculators](https://everycalculators.com/egg-inc-prestige-calculator.html). Note: this uses farm value instead of cash earned, which is likely inaccurate.
- **Accrual model:** the save file tracks `prestige_cash_earned` (the run's cumulative cash), a separate `prestige_soul_boost_cash` (cash earned while a Soul Beacon/Phoenix Feather is active), and `unclaimed_soul_eggs` / `unclaimed_soul_eggs_d`. So SE are computed continuously from run earnings and shown as pending, then "collected" on prestige. Unclaimed SE/PE/GE fields also exist for contract rewards — [CONFIRMED-code: ei.proto lines 86-99](https://github.com/fanaticscripter/Egg/blob/master/protobuf/ei.proto)
- Soul Beacons and Phoenix Feathers "change the effective Bocks count before the formula is applied" — [WIKI-snippet: Soul Eggs](https://egg-inc.fandom.com/wiki/Earnings_Bonus/Soul_Eggs)
- **Soul Food** ER (`soul_eggs`): "Increase bonus per soul egg by +1%", additive, max **140 levels**, cost 500 GE for L1 rising to 5,000, total **384,931 GE**. The per-SE bonus therefore goes from 10% to **150%** — [CONFIRMED-code: researches.json](https://github.com/fanaticscripter/Egg/blob/master/wasmegg/researches/src/researches.json); wiki agrees: "maximum is 150% at level 140" — [WIKI-snippet](https://egg-inc.fandom.com/wiki/Earnings_Bonus/Soul_Eggs)
- **Prestige Bonus** ER: "Earn +10% Soul Eggs when you prestige", max **20 levels**, levels stack additively (so a max of +200%, i.e. 3x), cost 4,000 GE for L1 rising to 6,000, total **99,991 GE** — [CONFIRMED-code: researches.json](https://github.com/fanaticscripter/Egg/blob/master/wasmegg/researches/src/researches.json)
- **Soul Beacon** tiers: Soul Beacon "5x soul eggs for 30min", Epic Soul Beacon 50x for 20 min, Legendary Soul Beacon 500x for 10 min. Wiki "Real Effect" column: 5x gives about 1.40x real SE — [WIKI-snippet: Boosts](https://egg-inc.fandom.com/wiki/Boosts). Consistent with the 0.21 exponent: 5^0.21 = 1.40, 50^0.21 = 2.27, 500^0.21 = 3.69 (own calculation).
- **Prestige events** ("PRESTIGE BOOST"): of the 937 in-game events logged between 2021-01 and 2023-02, prestige-boost multipliers were 2x (95 times), 3x (11), 5x (1) and 6x (1). Unlike beacons, these multiply SE gained directly (the "Event Boost" factor above) — [CONFIRMED-code: wasmegg events.json](https://github.com/fanaticscripter/Egg/blob/master/wasmegg/events/src/events.json)

### Inferences
- For the clone: SE_gain = PrestigeBonusMult × EventMult × g(runEarnings), with g ≈ k·E^0.21 late game and a steeper early curve (0.15/0.20 terms) so new players feel early prestiges. Beacons multiply E, not SE, so their real value is mult^0.21.
- Because gain is about E^0.21 and E grows roughly exponentially within a run, SE per unit of time peaks early. This is what pushes "prestige often" play, and the boost-stacked 10-minute "prestige sessions" late game.
- Pending SE should be shown live during the run (the game stores unclaimed SE).

### Gaps
- Exact piecewise coefficients below 1e60 (the fandom page was unreachable). The "(cash/1e6)^0.15" hypothesis is consistent with the low-earnings term but is not verified.
- Whether Prestige Bonus compounds or adds in-game: wasmegg marks it additive.

---

## 2. Prophecy eggs, EB formula, farmer role ladder (and Eggs of Truth)

### Takeaway
EB = SE × (0.10 + 0.01·SoulFood) × (1.05 + 0.01·ProphecyBonus)^PE, before artifacts. Each PE multiplies the whole SE bonus by 1.05 (up to 1.10 with 5 Prophecy Bonus levels). With hundreds of PE this compounding term dominates long-term power. The community status ladder is log10(EB): one role step per order of magnitude, Farmer → Infinifarmer.

### Cited Findings
- Code: `soulEggBonus = 0.1 + soulFood*0.01; prophecyEggBonus = 0.05 + prophecyBonus*0.01; EB = SE * soulEggBonus * (1+prophecyEggBonus)^PE` — [CONFIRMED-code: lib/earning_bonus.ts](https://github.com/fanaticscripter/Egg/blob/master/lib/earning_bonus.ts). Cash multiplier is M = 1 + EB%/100 — [COMMUNITY: JZR](https://jzr.uz/blog/egg-inc-mystical-eggs-math); [WIKI-snippet: Farm Value](https://egg-inc.fandom.com/wiki/Farm_Value)
- "Clothed" EB also multiplies in Soul Stones and Necklace-of-Basan/Book-of-Basan artifact bonuses, plus Truth Egg factors — [WIKI-snippet: Earnings Bonus](https://egg-inc.fandom.com/wiki/Earnings_Bonus)
- **Prophecy Bonus** ER: "Increase bonus per egg of prophecy by 1% (compounding)", max **5 levels**, cost 100,000 GE for L1 up to 1,000,000, total **2,750,000 GE** — [CONFIRMED-code: researches.json](https://github.com/fanaticscripter/Egg/blob/master/wasmegg/researches/src/researches.json)
- **PE sources** — [CONFIRMED-code: lib/prophecy_eggs.ts](https://github.com/fanaticscripter/Egg/blob/master/lib/prophecy_eggs.ts):
  - **Daily gift calendar**: 1 PE per 28-day month of collected daily gifts, capped at **24**.
  - **Trophies** (19 eggs): diamond trophy on Edible gives 5, Superfood 4, Medical 3, Rocket Fuel 2, Super Material/Fusion/Quantum/Immortality/Tachyon 1 each. Enlightenment egg gives 1/2/3/5/10 at Bronze/Silver/Gold/Plat/Diamond. Totals: 19 + 21 = **40 PE**.
  - **Contracts**: goals with reward type EGGS_OF_PROPHECY, including legacy reruns. This is the open-ended source; total depends on contracts released.
- NamuWiki: each PE raises income "by a factor between 1.05 and 1.10, depending on epic research", "a multiplicative operation, not a summation" — [WIKI-snippet](https://en.namu.wiki/w/Egg,%20Inc.)
- **Farmer roles** (Egg, Inc. Discord roles): role index = floor(log10(EB%)). 0 Farmer, 1 Farmer II, 2 Farmer III, 3 Kilofarmer, 6 Megafarmer, 9 Gigafarmer, 12 Terafarmer, 15 Petafarmer, 18 Exafarmer, 21 Zettafarmer, 24 Yottafarmer, 27 Xennafarmer, 30 Weccafarmer, 33 Vendafarmer, 36 Uadafarmer, 39 Treidafarmer, 42 Quadafarmer, 45 Pendafarmer, 48 Exedafarmer (each with II, III), and 51+ **Infinifarmer** — [CONFIRMED-code: lib/earning_bonus.ts](https://github.com/fanaticscripter/Egg/blob/master/lib/earning_bonus.ts)
- **Eggs of Truth** (third mystical egg, v1.35, "Path of Virtue" farm): "compounding 10% earnings bonus and IHR boost" on the Virtue farm and "compounding 1% boost to other farms". There are 98 per Egg of Virtue × 5 = **490**. They are earned from eggs delivered and are not reset by prestiging — [WIKI-snippet: Eggs of Truth](https://egg-inc.fandom.com/wiki/Earnings_Bonus/Eggs_of_Truth)

### Inferences
- Why compounding matters: 1.10^100 ≈ 13,780x and 1.05^100 ≈ 131x (own calculation). SE is linear while PE is exponential, so one PE late game is worth more than millions of SE. Gating PE behind skill/social content (contracts, trophies) and a time gate (calendar, 24 max) gives long-tail goals.
- A dog clone could map to "Good Boy Points" (SE, linear) and "Legend Bones" (PE, compounding), with a role ladder per order of magnitude (e.g. Pup → Kilopup ...).

### Gaps
- Current total contract PE count in 2026 (wasmegg passes it in as a parameter; not checked).

---

## 3. When/why players prestige; what resets vs keeps

### Takeaway
Prestige resets the farm (cash, common research, habs, vehicles, chickens, current egg). It keeps all meta currencies, ER, Pro Permit and the piggy bank. Early players prestige around a ~2x SE gain or ~50 SE. Late-game players run short 10-minute boost-stacked "prestige sessions", sometimes several prestiges inside one boost window.

### Cited Findings
- "Prestiging resets cash and common research, but keeps golden eggs, soul eggs, eggs of prophecy, epic research, and the pro permit" — [COMMUNITY: TouchTapPlay](https://www.touchtapplay.com/egg-inc-how-to-prestige/) / [Gamezebo](https://www.gamezebo.com/walkthroughs/how-to-prestige-egg-inc-why-you-should/)
- Early rule of thumb: prestige "when you could double your Soul Egg earnings or at about 50 Soul Eggs". General rule: prestige when "progress seems to be slowing down to a crawl and you have no more missions related to your current egg type". Players can preview SE before committing — same sources
- ER "does not reset when you upgrade your Egg or Prestige - you keep it forever" — [WIKI-snippet: Epic Research](https://egg-inc.fandom.com/wiki/Research/Epic_Research)
- Piggy bank contents are "preserved after you Prestige as long as you don't crack it" — [WIKI-snippet: Golden Eggs](https://egg-inc.fandom.com/wiki/Golden_Eggs)
- Late-game strategies (wasmegg Smart Assistant):
  - *Preloaded single-prestige*: pre-fill habs using a tachyon prism and boost beacon, leaving some space for the running-chicken bonus, then run "a single 10min set of 50x bird feed and 500x soul beacon".
  - *Multi-prestige* (Pro Permit): "a single 10min set of 1000x tachyon prism, 50x bird feed, 500x soul beacon, and two 50x boost beacons, and try to cram multiple prestige sessions into the boost session… the best known strategy for high EB players".
  - [CONFIRMED-code: TheAssistant.vue](https://github.com/fanaticscripter/Egg/blob/master/wasmegg/smart-assistant/src/components/TheAssistant.vue)
- One cited Pro Permit prestige set (2 Bird Feeds, 2 Legendary Soul Beacons, 1 Legendary Boost Beacon) costs about 75,000 GE undiscounted; a "lunar" setup costs 124,500 GE — [WIKI-snippet: Prestige](https://egg-inc.fandom.com/wiki/Prestige)
- The save tracks `num_prestiges` — [CONFIRMED-code: ei.proto](https://github.com/fanaticscripter/Egg/blob/master/protobuf/ei.proto)

### Inferences
- Run length shrinks as EB grows: from hours or days early on to roughly 10 minutes of boosted play late game, a natural "speed-run" progression.

### Gaps
- No reliable quantitative table of typical run lengths by stage was found.

---

## 4. Golden eggs: sources and uses

### Takeaway
GE is the soft-premium currency. Sources: drones, gifts/packages, video ads, the piggy bank (IAP), the daily calendar, contracts, artifacts, the welcome-back gift, Shell Showcase royalties and IAP. GE is spent on ER, boosts and shells.

### Cited Findings
- Drones: regular drones give 3/6/12 GE and elite drones 12/48, with more from Drone Rewards, "significantly increased once the player has spent at least 152,000 total" — [WIKI-snippet: Golden Eggs](https://egg-inc.fandom.com/wiki/Golden_Eggs)
- Video ads give 48/96/360/720 GE. Welcome-back gift: 1,440 (or 720) GE after 7 (or 14) days away — [WIKI-snippet: Golden Eggs](https://egg-inc.fandom.com/wiki/Golden_Eggs)
- Artifacts "sometimes give them when consumed and always when demoted". Shell Showcase royalties pay "25+(Tickets Spent×4)". Subscribers get "25% more Golden Eggs from sources like Piggy Breaks" — [WIKI-snippet](https://egg-inc.fandom.com/wiki/Golden_Eggs)
- The save tracks `golden_eggs_earned`, `golden_eggs_spent` and `uncliamed_golden_eggs` [sic] — [CONFIRMED-code: ei.proto](https://github.com/fanaticscripter/Egg/blob/master/protobuf/ei.proto)
- Uses: ER (section 5), boosts (section 6), and a GE-bought 2x revenue power-up "for a starting 2 hours" (older Wikipedia description) — [Wikipedia](https://en.wikipedia.org/wiki/Egg,_Inc.)

### Gaps
- Exact contract GE reward amounts and IAP pack sizes not verified.

---

## 5. Epic research: full list (wasmegg data)

### Takeaway
There are 22 ER items, all paid in GE. Each level's effect stacks additively. Cost rises per level, roughly linearly. Maxing everything costs about **10.5M GE** at list price. Epic Research Sale events reduce costs to 0.60–0.75x.

### Cited Findings
Source for the whole table: [CONFIRMED-code: researches.json](https://github.com/fanaticscripter/Egg/blob/master/wasmegg/researches/src/researches.json). The README says epic prices came from royalphysique.net and were validated by the author. Some costs may have been changed in later updates (NamuWiki warns later updates raised some costs).

| ID | Name | Effect / level | Max | L1 → last cost (GE) | Total GE |
|---|---|---|---|---|---|
| hold_to_hatch | Hold to Hatch | +2 chickens/s when holding the hatch button | 15 | 10 → 500 | 3,825 |
| epic_hatchery | Epic Hatchery | +10% hatchery refill rate | 20 | 2 → 1,000 | 10,011 |
| epic_internal_incubators | Epic Int. Hatcheries | +5% internal hatchery rate | 20 | 25 → 2,500 | 25,241 |
| video_doubler_time | Video Doubler Time | +30 min video doubler time | 12 | 25 → 2,500 | 15,150 |
| epic_clucking | Epic Clucking | +0.1% egg value per running chicken | 20 | 20 → 5,000 | 50,191 |
| epic_multiplier | Epic Multiplier | +2x max running-chicken bonus | 100 | 10 → 10,000 | 500,455 |
| cheaper_contractors | Cheaper Contractors | −5% hen house cost | 10 | 20 → 2,000 | 10,100 |
| bust_unions | Bust Unions | −5% vehicle cost | 10 | 20 → 2,000 | 10,100 |
| cheaper_research | Lab Upgrade | −5% research cost | 10 | 25 → 2,000 | 10,121 |
| silo_capacity | Silo Capacity (in-game "Silo Quality") | +6 min away time per silo | 20 | 500 → 1,000 | 14,991 |
| int_hatch_sharing | Internal Hatchery Sharing | full habs send +10% chicks to other habs | 10 | 250 → 2,500 | 13,750 |
| int_hatch_calm | Internal Hatchery Calm | +10% IH rate while away | 20 | 10 → 2,000 | 20,091 |
| accounting_tricks | Accounting Tricks | +5% farm valuation | 20 | 250 → 4,000 | 42,491 |
| soul_eggs | Soul Food | +1% bonus per SE | 140 | 500 → 5,000 | 384,931 |
| prestige_bonus | Prestige Bonus | +10% SE on prestige | 20 | 4,000 → 6,000 | 99,991 |
| drone_rewards | Drone Rewards | +10% chance of bigger drone rewards | 20 | 100 → 2,000 | 21,000 |
| epic_egg_laying | Epic Comfy Nests | +5% laying rate | 20 | 250 → 50,000 | 502,491 |
| transportation_lobbyist | Transportation Lobbyists | +5% vehicle capacity | 30 | 250 → 4,000 | 63,736 |
| prophecy_bonus | Prophecy Bonus | +1% per PE (compounding) | 5 | 100,000 → 1,000,000 | 2,750,000 |
| hold_to_research | Hold to Research | +25% repeat rate when holding the research button | 8 | 5,000 flat | 40,000 |
| afx_mission_time | FTL Drive Upgrades | −1% FTL mission time | 25 | 5,000 → 50,000 | 687,500 |
| afx_mission_capacity | Zero-g Quantum Containment | +5% mission capacity | 10 | 50,000 → 1,000,000 | 5,249,996 |

- Sum of all = **10,526,162 GE** (own sum of the table above). NamuWiki gives 2,263,666 total vs the wiki's old 670,000 (both before the artifact-era items) — [WIKI-snippet: NamuWiki Research](https://en.namu.wiki/w/Egg,%20Inc./%EC%97%B0%EA%B5%AC). The fandom per-item totals differ slightly (e.g. Epic Int. Hatcheries 100,491, Epic Clucking 100,991, Epic Multiplier 502,451, Cheaper Contractors 20,246, Lab Upgrade 40,496), which suggests price revisions — [WIKI-snippet](https://egg-inc.fandom.com/wiki/Research/Epic_Research). **Flag: price data may be outdated in either source.**
- "Warp Shift" is not an ER item in either data source; it appears to be a separate mechanic (not researched here).
- Epic Research Sale events: 0.65x (31 times), 0.70x (19), 0.60x (1), 0.75x (2), 2021–2023 — [CONFIRMED-code: events.json](https://github.com/fanaticscripter/Egg/blob/master/wasmegg/events/src/events.json)

### Inferences
- Design pattern: cheap QoL items (Hold to Hatch, Epic Hatchery) as early GE sinks; huge prestige-power items (Soul Food at 140 levels, Epic Multiplier at 100) as mid-game sinks; extreme late sinks (Prophecy Bonus, Zero-g) as whale/endgame sinks.

---

## 6. Boosts

### Takeaway
Timed multipliers bought with GE (and, for some tiers, boost tokens) or received free in contracts. Categories: earnings (Jimbo's Bird Feed), internal hatchery rate (Tachyon Prisms), SE (Soul Beacons), and Boost Beacons that multiply other active boosts. Same-type boosts add together; categories multiply each other.

### Cited Findings
- Tachyon Prism (internal hatchery rate): blue 10x for 30 min, large blue 10x for 4 h; purple 100x for 20 min, large purple 100x for 2 h; orange 1000x for 10 min, large orange 1000x for 1 h — [CONFIRMED-code: lib/farm/boosts.ts](https://github.com/fanaticscripter/Egg/blob/master/lib/farm/boosts.ts)
- Boost Beacon: blue 2x for 30 min, purple 10x for 10 min, large blue 5x for 1 h, orange 50x for 10 min. It multiplies other active boosts — [CONFIRMED-code](https://github.com/fanaticscripter/Egg/blob/master/lib/farm/boosts.ts); [WIKI-snippet: Boosts](https://egg-inc.fandom.com/wiki/Boosts)
- Stacking in code: multiplier = (sum of active prism multipliers) × (sum of active beacon multipliers, or 1) × the artifact boost multiplier (Dilithium Monocle). Dilithium Stone extends duration — [CONFIRMED-code](https://github.com/fanaticscripter/Egg/blob/master/lib/farm/boosts.ts)
- Jimbo's Best Bird Feed 50x earnings for 10 min (a 2-hour version also exists); Jimbo's Premium Bird Feed 10x for 15 min — [WIKI-snippet: NamuWiki](https://en.namu.wiki/w/Egg,%20Inc.)
- Soul Beacons: 5x/30 min, 50x/20 min, 500x/10 min (see section 1).
- GE prices (fandom): Tachyon Prism 50, Large 500, Powerful 1K, Epic 5K, Legendary 12K, Supreme 25K. Powerful and above also need boost tokens. Tachyon Prism, Large Tachyon Prism and Jimbo's Excellent Bird Feed are free in contracts. Legendary Boost Beacon about 40,000 GE with a 20% discount. NamuWiki prices differ (e.g. basic prism 200, Soul Beacon 200, Epic Soul Beacon 1,000) — [WIKI-snippet: Boosts](https://egg-inc.fandom.com/wiki/Boosts); [Tachyon Prism Boost Statistics](https://egg-inc.fandom.com/wiki/Tachyon_Prism_Boost_Statistics). **Prices conflict.**
- Boost tokens are earned mainly in contracts (gift/drone/goal rewards) and can be given to co-op mates. Tracked as `boost_tokens_received/spent/given/unclaimed` — [CONFIRMED-code: ei.proto](https://github.com/fanaticscripter/Egg/blob/master/protobuf/ei.proto)
- Events: "BOOST TIME+" 2x duration (37 times) and boost-sale events at 0.70–0.90x — [CONFIRMED-code: events.json](https://github.com/fanaticscripter/Egg/blob/master/wasmegg/events/src/events.json)

### Gaps
- Current 2026 GE and token prices; full Jimbo's tier list.

---

## 7. Drones, gifts, piggy bank, video doubler, events

### Takeaway
Drones and gift trucks are random tap rewards that scale with farm value and spending. The piggy bank is a GE accumulator that grows with play and pays out only through IAP. The video doubler (ad) gives temporary 2x earnings, extended by ER. Server-side configs tune intervals and amounts. Recurring events multiply these systems.

### Cited Findings
- Drones: standard drones fly straight; Elite drones take curved, fast paths and are rarer and more lucrative. Payout is cash or GE — [WIKI-snippet: Drones](https://egg-inc.fandom.com/wiki/Drones); [Tap Guides](https://tap-guides.com/2025/10/24/egg-inc-drone-guide/). Base gold:cash ratio of 3:7 (30% GE); the Beak artifact raises the gold share — [COMMUNITY: Reddit](https://redlib.ssps.io/r/EggsInc/comments/1hc0tma/beak_doesnt_actually_guarantee_ge). Drone Rewards "shifts the odds toward the higher tiers" rather than doubling; on cash it is a clean 2x — [WIKI-snippet: Drones](https://egg-inc.fandom.com/wiki/Drones). Cash rewards are proportional to farm value — [COMMUNITY: patashu guide](https://lr.eu.psf.lt/r/EggsInc/wiki/patashu_guide). The save tracks `drone_takedowns` and `drone_takedowns_elite`. Spawn interval: **[UNKNOWN]**.
- Gifts/video config (server-tuned): `package_interval`, `video_offer_interval`, separate intervals during contracts and when the piggy is full or extra-full; per-gift `amount`, `rand_min/max` and `video_min/max`; "mu" multipliers scaled between `min_spent` and `max_spent` (rewards scale with lifetime spend) — [CONFIRMED-code: ei.proto GiftConfig](https://github.com/fanaticscripter/Egg/blob/master/protobuf/ei.proto). A white truck drops a package "every few minutes" — [Wikipedia](https://en.wikipedia.org/wiki/Egg,_Inc.)
- Daily gift calendar: 28-day months, with a PE at the end of each month (max 24 PE) — [CONFIRMED-code](https://github.com/fanaticscripter/Egg/blob/master/lib/prophecy_eggs.ts)
- Piggy bank: costs USD 5.99 to crack (33% off during events); cracking resets it to 0 and grants the GE. Level bonus: 2% at level 1, 25% at level 2, then (10n+10)%. Soft cap: 10,000n−2,500 below level 10, then 45,000+5,000n; contracts and the calendar can still fill past the cap. It "grows whenever you buy or upgrade something" — [WIKI-snippet: Piggy Bank](https://egg-inc.fandom.com/wiki/Piggy_Bank). The save tracks `piggy_bank`, `piggy_full`, `lost_piggy_increments`, `num_piggy_breaks` and `verified_piggy_breaks` — [CONFIRMED-code](https://github.com/fanaticscripter/Egg/blob/master/protobuf/ei.proto)
- Video doubler: an ad gives 2x earnings for a base duration; Video Doubler Time ER adds +30 min per level up to 12 levels (+6 h). Save fields: `video_doubler_uses`, `current_multiplier` and `current_multiplier_expiration` — [CONFIRMED-code](https://github.com/fanaticscripter/Egg/blob/master/protobuf/ei.proto). The base duration is often cited as 2 h but is **[UNVERIFIED]**. Ads are rate-limited "per several hours" — [WIKI-snippet](https://egg-inc.fandom.com/wiki/Bocks)
- Event frequency, 2021-01 to 2023-02 (937 events) — [CONFIRMED-code: events.json](https://github.com/fanaticscripter/Egg/blob/master/wasmegg/events/src/events.json):
  - Cash boost 2x (103), 3x (18)
  - Prestige boost 2x (95), 3x (11)
  - Piggy growth 4x (89), 3x (24)
  - Generous Drones 4x (53)
  - Generous Gifts 2x (50), 3x (6)
  - Research sale 0.3x (82)
  - Hab and vehicle sales at 0.25x
  - Mission fuel 3x
  - "Unlimited Piggy" (cap removed)

### Inferences
- For the clone: every engagement loop (taps, ads, logins, IAP) feeds the premium currency, and the piggy bank turns "time played" into a visible IAP offer. A weekly rotating event calendar keeps players returning.

### Gaps
- Drone spawn interval and elite odds; current piggy fill-per-action values; base video doubler duration; current (2024–2026) event data (the wasmegg file ends Feb 2023).
