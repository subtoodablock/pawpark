# How Egg, Inc. Turns Exponents Into Months

Egg, Inc. creates time from one structural gap. Upgrade prices are the same on every standard egg. Each new egg sells for only about 3–7× more than the last. But the farm-value gate to unlock the next egg rises about ×45–80 per step early and ×1,000–9,000 per step late. Deeper research, bigger habs and, above all, cross-run meta multipliers have to close the difference. Those multipliers are soul eggs (linear, +10% each), prophecy eggs (compounding, ×1.05 each), epic research and artifacts. Underneath sits a physical loop of three throughput caps: population (habs), laying rate, and shipping. Income equals egg value × min(laid, shipped), so the binding constraint keeps moving and there is always a next purchase. Layered calendars keep players returning: offline silos measured in hours, weekly contracts, monthly prophecy-egg drops, quarterly seasons. Monetisation mostly sells time and convenience, not the prestige currencies. For Paw Park, the most consequential finding is that its v4 "Find era" model diverges from Egg Inc on the axis that matters most. Multiplying every cash price by a per-Find `costScale` turns each Find upgrade into a rescaled replay instead of a power spike. This report recommends switching to Egg Inc's flat-price model with a longer price ladder and smoother gate ratios. It also flags a Rescue-rate gap that, as currently tuned, makes endgame kennels effectively unfillable.

A note on evidence. The most reliable source is the open-source community toolkit wasmegg (carpetsage/egg and fanaticscripter/Egg). It hard-codes game constants extracted from the game's own data and is used to decode real saves, but it is community-maintained, not official Auxbrain. The fandom wiki, NamuWiki and Wikipedia could only be read through search snippets, and several wiki pages are flagged stale. No Auxbrain developer interview or design statement was found, so every "design reason" below is inferred from mechanics, not quoted. Claims are labelled **confirmed (code)** when they come from wasmegg constants, **wiki** when they come from a snippet, and **estimate** when they are community folklore or my own arithmetic.

## Three throughput caps drive the moment-to-moment loop

The core verb is a single button. Pressing or holding it releases chickens onto the farm, and their eggs are sold for cash ([Wikipedia](https://en.wikipedia.org/wiki/Egg,_Inc.)). The button draws on a **hatchery buffer of 250 chickens (max 500 via research)** that refills at roughly 3 chickens/s base (wiki figure) and up to **16.875×** faster with research ([Hatchery, fandom](https://egg-inc.fandom.com/wiki/Hatchery)). Holding gives **2 chickens/s base, 32/s** with 15 levels of the "Hold to Hatch" epic research (confirmed (code): [researches.json](https://github.com/carpetsage/egg/blob/main/lib/researches.json)). Because the buffer runs dry, frantic tapping has limited value: guides note that the refill cooldown caps the advantage ([Level Winner](https://www.levelwinner.com/egg-inc-ultimate-guide-tips-tricks-running-egg-empire/)). The design reason is that active play comes in bursts, not as a grind.

Running chickens feed the **running chicken bonus (RCB)**, a temporary income multiplier. Its cap is **5× base and 540× with full research**, summed from Coordinated Clucking, Motivational Clucking, Enlightened Chickens and Epic Multiplier (confirmed (code): [max_rcb.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/max_rcb.ts)). Auxbrain has retuned it repeatedly. One 2019 cut took it from 1,600× to 1,040× ([Egg Centric](https://x.com/egg_centric/status/1128782458965680130?lang=en)). Since v1.12.2 the RCB also inflates farm value and drone rewards ([Softpedia 1.12.2](https://mobile.softpedia.com/apk/egg-inc/1.12.2/)), so short active sessions translate into progression and not just cash. The per-chicken build rate and the decay curve are **unknown**: no source documented them.

The passive population source is the **internal hatchery**: a flat number of chickens per minute **per hab**. Research takes it from 2/min to a maximum of **3,720/min/hab**. Epic research then multiplies that ×2 at all times and another **×3 only while the player is away** ("Internal Hatchery Calm"). That gives 7,440/min online and 22,320/min offline (confirmed (code): [internal_hatchery.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/internal_hatchery.ts)). An offline-only multiplier is an explicit reward for closing the app. And because the rate is per hab rather than per unit of capacity, filling all four hab slots early pays off. Population grows linearly, offline included, until it hits total hab space: `pop = min(last + IHR × minutes, habSpace)` (confirmed (code): [population.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/population.ts)).

Each chicken lays **one egg per 30 seconds**. Laying research multiplies that up to about **×2,772**, with effects additive within one research item and multiplicative across items (confirmed (code): [laying_rate.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/laying_rate.ts)). Income then takes the minimum of what is laid and what can be shipped: `eggsPerHour = min(layable, shippable)`. Eggs beyond shipping capacity earn nothing; there is no stockpile (confirmed (code): [farm.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/farm.ts)). The whole earnings model is egg value × effective lay rate × earnings bonus, times the video doubler and event multipliers. Offline earnings use the same formula times an away multiplier (confirmed (code): [earnings.ts](https://github.com/carpetsage/egg/blob/main/wasmegg/ascension-planner/src/calculations/earnings.ts)). The result is a three-stock system (population, lay rate, shipping) whose binding constraint shifts after every purchase. Guides advise balancing hen houses against vehicles, and the depot's capacity bar shifts green→yellow→red as shipping saturates ([Gamezebo](https://www.gamezebo.com/walkthroughs/egg-inc-tips-cheats-and-strategies/)). The player is constantly diagnosing which cap to lift, and that is the core of the "always a next purchase" feel.

## The egg ladder, research and buildings share one price list

### Nineteen eggs climb ×3–7 in value while gates climb ×45–9,000

Egg values are confirmed in code ([eggs.ts](https://github.com/carpetsage/egg/blob/main/lib/eggs.ts)). The farm-value gates come from wiki snippets that disagree with each other by up to about 6× on some upper eggs ([Fandom Eggs](https://egg-inc.fandom.com/wiki/Eggs); [NamuWiki](https://en.namu.wiki/w/Egg,%20Inc.)), so the gate ratios are order-of-magnitude only.

| Egg | Value | × prev | Upgrade gate (Fandom) | Gate × prev |
|---|---|---|---|---|
| Edible | $0.25 | – | start | – |
| Superfood | 1.25 | 5 | 6.8e7 | – |
| Medical | 6.25 | 5 | 5.3e9 | ×78 |
| Rocket Fuel | 30 | 4.8 | 2.4e11 | ×45 |
| Super Material | 150 | 5 | n/a | – |
| Fusion | 700 | 4.67 | 5.0e16 | ~×456/step |
| Quantum | 3,000 | 4.29 | 2.3e19 | ×460 |
| Immortality | 12,500 | 4.17 | n/a | – |
| Tachyon | 50,000 | 4 | 1.7e26 | ~×2,700/step |
| Graviton | 175,000 | 3.5 | 9.8e29 | ×5,765 |
| Dilithium | 525,000 | 3 | 4.8e33 | ×4,900 |
| Prodigy | 1.5e6 | 2.86 | 1.6e37 | ×3,333 |
| Terraform | 1e7 | 6.67 | 2.0e40 | ×1,250 |
| Antimatter | 1e9 | 100 | 1.3e44 | ×6,500 |
| Dark Matter | 1e11 | 100 | 1.2e48 | ×9,230 |
| AI / Nebula / Universe | 1e12 / 1.5e13 / 1e14 | 10 / 15 / 6.7 | n/a | – |
| Enlightenment | 1e-7 (shows $0.00) | special | n/a | – |

Each egg has two thresholds. "Discover" teases the next egg, and "Upgrade" lets the player buy it. The two sit a steady **×6–6.8 apart** ([Fandom Eggs](https://egg-inc.fandom.com/wiki/Eggs)), so players can see the next egg long before they can afford it. **Enlightenment** is a deliberate capstone. It is worth effectively nothing, boosts cannot be used on its farm, and artifacts work there only through Clarity stones ([Enlightenment Egg](https://egg-inc.fandom.com/wiki/Enlightenment_Egg?oldid=8203); [effects.ts](https://github.com/carpetsage/egg/blob/main/lib/artifacts/effects.ts)). Its farm can only be grown with accumulated meta power, and players report about 70 days to 6 months for its diamond trophy ([r/EggsInc](https://redlib.ssps.io/r/EggsInc/comments/1l6i4el/minimum_eb_for_end_and_acre)). Since 2024, five Eggs of Virtue (value 1) form a separate track with their own price tables ([eggs.ts](https://github.com/carpetsage/egg/blob/main/lib/eggs.ts)).

An egg upgrade is a **soft reset**: "restarting, but with each egg selling for a higher base price" ([Wikipedia](https://en.wikipedia.org/wiki/Egg,_Inc.)). Chickens, habs, vehicles, cash and common research reset. Golden eggs, soul eggs, prophecy eggs, epic research, artifacts and the Pro Permit persist. Unlike prestige, an upgrade awards no soul eggs. Players can also move back to any unlocked egg. The main reason to do so is per-egg trophies: chicken-count milestones of 10M/50M/250M/1B/10B, and lower-value eggs are harder and pay *more* prophecy eggs (5 PE at Edible diamond) ([Trophies](https://egg-inc.fandom.com/wiki/Trophies); [prophecy_eggs.ts](https://github.com/fanaticscripter/Egg/blob/master/lib/prophecy_eggs.ts)). This recycles early content as late-game challenge.

**Prices do not change between standard eggs.** Each research item carries exactly two price arrays: `prices` (standard) and `virtue_prices`. There is no per-egg dimension (confirmed (code): [researches.json](https://raw.githubusercontent.com/carpetsage/egg/main/lib/researches.json)). Habs and vehicles likewise have only a standard table and a separate virtue table ([hab_space.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/hab_space.ts)). That hab and vehicle prices are flat across standard eggs is inferred from the missing per-egg field, not stated outright. Global discounts apply everywhere: −50% each from the Lab Upgrade, Cheaper Contractors and Bust Unions epic research, and −70% during research sales ([research_price.ts](https://github.com/carpetsage/egg/blob/main/wasmegg/artifact-sandbox/src/lib/effects/research_price.ts)). The consequence is that a new egg makes the *start* of the ladder trivially cheap, so the first minutes are a blitz. The gate then forces the player deeper into the ladder than the previous egg ever required.

### Common research: 56 items, 13 tiers, 2,330 levels spanning 67 orders of magnitude

Common research has **56 items in 13 tiers, 2,330 levels in total**. Tiers unlock by cumulative levels purchased: **0 / 30 / 80 / 160 / 280 / 400 / 520 / 650 / 800 / 980 / 1,185 / 1,390 / 1,655** (confirmed (code): [commonResearch.ts](https://github.com/carpetsage/egg/blob/main/wasmegg/ascension-planner/src/calculations/commonResearch.ts)). Each gate is small next to the tier sizes (59–536 levels), so the next shelf opens long before the current one is finished. Cheap new levels then compete with expensive old ones, which guarantees a choice.

Effects add within an item and multiply across items. Six "doubler" items compound per level: Bigger Eggs ×2, USDE Prime ×3, Even Bigger Eggs ×2/level, Graviton Coating ×2/level, Multiversal Layering ×10/level and Timeline Splicing ×10. Level-1 prices run from **$0.50 (Comfortable Nests) to about 1e67 (Timeline Splicing)**. Per-level cost growth is about **×1.07–1.6 for long percentage items** (Matter Reconfiguration ×1.07 over 500 levels, Comfortable Nests ×1.27). It is **×2–13 for short flat items** (fleet slots, hatchery capacity, internal hatchery) and **×220–470 for the doublers** (computed from [researches.json](https://raw.githubusercontent.com/carpetsage/egg/main/lib/researches.json)). The categories cover laying rate, egg value, hatchery refill and capacity, RCB, hab capacity, internal hatchery rate, shipping capacity, fleet size and hyperloop length. That spread of categories is what lets research lift whichever of the three caps is binding.

### Habs and vehicles: four slots, nineteen tiers, prices ×100 per tier against capacity ×2

There are **19 hab tiers and 4 slots**. Each tier has its own four-entry price table, indexed by how many copies of *that tier* the player already owns (confirmed (code): [hab_space.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/hab_space.ts)).

| Hab | Base cap | 1st copy | 4th copy |
|---|---|---|---|
| Coop | 250 | free | 97 |
| Shack | 500 | 467 | 1,861 |
| Super Shack | 1,000 | 12,267 | 66,811 |
| Short House | 2,000 | 3.4e5 | 2.55e6 |
| The Standard | 5,000 | 2.1e7 | 4.1e8 |
| Long House | 10,000 | 2.3e9 | 2.7e10 |
| Double Decker | 20,000 | 1.5e11 | 1.9e12 |
| Warehouse | 50,000 | 1.8e13 | 4.9e14 |
| Center | 100,000 | 3.2e15 | 4.3e16 |
| Bunker | 200,000 | 2.5e17 | 3.3e18 |
| Eggkea | 500,000 | 3.3e19 | 9.0e20 |
| HAB 1000 | 1M | 6.1e21 | 8.0e22 |
| Hangar | 2M | 4.6e23 | 6.1e24 |
| Tower | 5M | 5.9e25 | 1.6e27 |
| HAB 10,000 | 10M | 1.3e28 | 2.2e29 |
| Eggtopia | 25M | 2.9e30 | 1.1e32 |
| Monolith | 50M | 2.8e33 | 1.8e35 |
| Planet Portal | 100M | 8.6e36 | 7.2e38 |
| Chicken Universe | 600M | 3.2e41 | 7.1e43 |

Copy-to-copy ratios follow no single multiplier. They shrink with each copy and grow at higher tiers: about 1.7/1.6/1.5× for the Shack, 3.2/2.6/2.3× for The Standard, and **11/5.4/3.7× for Chicken Universe**. Four capacity research items multiply all habs by up to **×3.15** (×4.725 for the two portal habs), which reproduces the wiki's max farm of **11.34B chickens** ([Habitats](https://egg-inc.fandom.com/wiki/Habitats)). The visual arc runs rustic coop → barn → industrial → IKEA-parody "Eggkea" → sci-fi → "a portal to another universe" ([YouTube](https://www.youtube.com/watch?v=Wq4-TWIUj-k)). That arc makes orders of magnitude legible. Individual building art is **unverified**: the image CDN and wiki pages were unreachable.

Vehicles have **12 tiers**. Capacity in eggs/min runs Trike 5,000 → Transit Van 15k → Pickup 50k → 10 Foot 100k → 24 Foot 250k → Semi 500k → Double Semi 1M → Future Semi 5M → Mega Semi 15M → Hover Semi 30M → Quantum Transporter 50M → **Hyperloop Train 50M per car** ([shipping_capacity.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/shipping_capacity.ts)). The fleet goes from **4 slots base to 17** through five research items. Each vehicle tier has a 17-entry per-copy price table, and "the base price of a vehicle depends on how many of that level you already own" ([Vehicles](https://egg-inc.fandom.com/wiki/Vehicles)). The Hyperloop needs a one-time **50,000 golden egg** purchase. Each train then takes **5 cars base and 10 max** (the Graviton Coupling research), each car with its own escalating price ([vehicles.ts](https://github.com/carpetsage/egg/blob/main/wasmegg/ascension-planner/src/lib/vehicles.ts)). Cars give a late-game incremental purchase *inside* an already-maxed slot. Shipping research stacks to ×2,769 for all vehicles and **×14,016 for the Hyperloop**. Normal-farm vehicle prices beyond Trike (free), Transit Van (544) and Semi (58.2T) were **not recovered**.

## Geometric prices convert into minutes, days and months

Scaling creates time in three nested ways. First, within a single egg, **each hab tier costs about 30–450× the previous tier's last copy but adds only 2–6× capacity**. Income is proportional to population × lay rate × egg value, so each next purchase needs a longer wait unless multiplicative research outruns it. Second, fill time = (hab space − population) / (internal hatchery rate × hab count) (confirmed (code): [population.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/population.ts)). By my arithmetic from confirmed constants, four fresh Coops at 2/min/hab take **125 minutes** passively, though the button fills them in seconds. Four maxed Chicken Universes (11.34B) at maximum research take **about 265 days online or 88 days offline** without boosts. Endgame filling is therefore done with Tachyon Prisms (10–1,000× internal hatchery rate) and Boost Beacons, not by waiting ([boosts.ts](https://github.com/fanaticscripter/Egg/blob/master/lib/farm/boosts.ts)). Third, across eggs, the gate-to-value ratio climbs from about 10–16× early to 100–1,700× from Tachyon upward. A single run cannot close that gap, so the player must prestige to grow the earnings bonus.

**Farm value** is the gate metric, and it deliberately values *capacity and potential* rather than cash on hand. The stale wiki formula multiplies Accounting Tricks × egg value × lay rate × earnings bonus × **max** RCB × a population term. That term counts effective population at 1.0, unshippable chickens at 0.2, (hab vacancy)^0.6, and 0.25 × internal hatchery rate × habs × max away minutes ([Farm Value](https://egg-inc.fandom.com/wiki/Farm_Value)). Empty hab space and silo time therefore raise farm value, unshipped chickens barely count, and saving up cash cannot buy an egg. Drone payouts are farm value × √RCB ([Drones](https://egg-inc.fandom.com/wiki/Drones)), which keeps tap rewards relevant at every scale.

Measured time per egg does not exist in any reachable source. The community-style first climb runs roughly as follows (**estimate**, folklore for playtest targeting only): Edible→Medical in the first session, Rocket Fuel–Super Material by day 1–2, Fusion–Quantum in week 1, Immortality–Graviton over weeks 1–3 with prestiges, Dilithium–Terraform over weeks to about 2 months, Antimatter→Universe over months. Dedicated players play for years ([r/EggsInc](https://red.applefritter.com/r/EggsInc/comments/1jvoq9p/i_did_it)). Reviews confirm the walls are felt: "at a certain farm value, reaching the next milestone can take days" ([Sirus Gaming](https://sirusgaming.com/egg-inc-review/)).

**Offline play** is capped by silos. Each silo stores **60 minutes, plus 6 min per Silo Capacity level** (max 180 min). The next silo costs **1e8 × n^(3n+15)** (confirmed (code): [silos.ts](https://github.com/carpetsage/egg/blob/main/lib/farm/silos.ts)), so each extra hour of AFK time gets super-exponentially pricier. The Standard Permit allows 2 silos at half offline rate. The paid Pro Permit allows 10 silos at full rate, for up to about 30 h ([Grain Silos](https://egg-inc.fandom.com/wiki/Grain_Silos)). The save stores the last step time and tracks clock cheats with a "time cheat debt" ([ei.proto](https://github.com/carpetsage/egg/blob/main/protobuf/ei.proto)). Pecorella ties Egg Inc's flat prestige curve to this limited offline window ([Game Developer, Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii)). The design pulls players back every few hours while giving paying players a full night.

## Soul eggs give linear power; prophecy eggs compound it

**Soul eggs** accrue continuously from cash earned this run and are collected on prestige. Wiki snippets give gain ∝ (earnings)^**0.21** late game, with a piecewise sum of 0.15/0.20/0.21-exponent terms below 1e60 ([Soul Eggs](https://egg-inc.fandom.com/wiki/Earnings_Bonus/Soul_Eggs); [Prestige, miraheze](https://egginc.miraheze.org/wiki/Prestige)). Pecorella characterises Egg Inc's exponent as about **1/7**: doubling soul eggs needs roughly 128× the previous run ([Game Developer, Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii)). Each soul egg adds **+10% earnings**, rising to +150% with 140 levels of the Soul Food epic research. The Prestige Bonus epic adds up to +200% soul eggs. Soul Beacons multiply the *earnings* that feed the formula, so a 500× beacon yields only 500^0.21 ≈ **3.7×** soul eggs. Prestige events, by contrast, multiply soul eggs directly: of 937 logged events from 2021–23, 95 were 2× and 11 were 3× ([events.json](https://github.com/fanaticscripter/Egg/blob/master/wasmegg/events/src/events.json)). A Sunday Prestige Boost recurs weekly ([Special Event](https://egg-inc.fandom.com/wiki/Special_Event)).

The full earnings bonus is **EB = SE × (0.10 + 0.01·SoulFood) × (1.05 + 0.01·ProphecyBonus)^PE** (confirmed (code): [earning_bonus.ts](https://github.com/fanaticscripter/Egg/blob/master/lib/earning_bonus.ts)). Prophecy eggs compound: 1.05^100 ≈ 131× and 1.10^100 ≈ 13,780×, so late-game one prophecy egg outweighs millions of soul eggs. Supply is deliberately scarce. Prophecy eggs come from the daily gift calendar (1 per 28-day month, capped at 24), trophies (40 total), and contracts, which are the only open-ended source ([prophecy_eggs.ts](https://github.com/fanaticscripter/Egg/blob/master/lib/prophecy_eggs.ts)). The community status ladder is **floor(log10(EB%))**, one role per order of magnitude: Farmer → Kilofarmer → Megafarmer … → Infinifarmer. It gives friends a single comparable rank. Early guides advise a first prestige at about 50 soul eggs, then roughly whenever soul eggs can double ([Android Central](https://www.androidcentral.com/tips-and-tricks-egg-inc)). Late players instead cram several prestiges into one 10-minute boost window ([TheAssistant.vue](https://github.com/fanaticscripter/Egg/blob/master/wasmegg/smart-assistant/src/components/TheAssistant.vue)), so run length shrinks from days to minutes as power grows.

Golden eggs are the soft-premium currency. They come from drones, gifts, video ads (48–720), the calendar, contracts and the piggy bank, and are spent on **22 epic research items** that never reset and cost about **10.5M GE** to max ([researches.json](https://github.com/fanaticscripter/Egg/blob/master/wasmegg/researches/src/researches.json)). The list mixes cheap quality-of-life sinks (Hold to Hatch, 3,825 GE total) with deep power sinks (Soul Food 385k, Prophecy Bonus 2.75M). **Boosts** are timed multipliers. Tachyon Prisms run 10×/30 min to 1,000×/10 min, Boost Beacons 2–50× on other boosts, Jimbo's Bird Feed 10–50× earnings, and Soul Beacons as above. Same-type boosts add and categories multiply ([boosts.ts](https://github.com/fanaticscripter/Egg/blob/master/lib/farm/boosts.ts)). Drones pay cash or GE at about a 7:3 ratio. The **piggy bank** fills with play (+3 per research, +20 per vehicle, +50 per hab), survives prestige, and pays out only when cracked for **$5.99** ([Piggy Bank](https://egg-inc.fandom.com/wiki/Piggy_Bank)), which turns time played into a purchase prompt. The video doubler gives 2× earnings, extended 30 min per level by epic research. Its base duration is **unverified**.

## Contracts, ships and calendars fill every time scale

Contracts are timed delivery goals on separate farms, played solo or in co-ops where everyone's eggs are pooled and boost tokens can be gifted to teammates ([Contracts V1](https://egg-inc.fandom.com/wiki/Contracts/Contracts_V1)). Since December 2024, they run in **four seasons a year of about 13 contracts each**. Each player has a grade from C to AAA, based on earnings bonus and the last 30 days of contract history, and the grade sets their personal reward thresholds. Seasons were added explicitly to "reduce the catch-up time for new players" ([Contracts](https://egg-inc.fandom.com/wiki/Contracts); [Eggs of Prophecy](https://egg-inc.fandom.com/wiki/Earnings_Bonus/Eggs_of_Prophecy)). The weekly cadence is fixed. **Monday** brings a new contract, **Wednesday** a "Leggacy" rerun paying boosts, golden eggs or artifact boxes, and **Friday** a prophecy-egg Leggacy, plus one extra for Ultra subscribers ([Majeggstics Guide](https://majeggstics.com/guide/)). Pooled output breeds strict social norms: Majeggstics strikes members who miss minimum laying rates, and four strikes means removal.

**Artifacts and ships** (v1.20) unlock only at **10,000 soul eggs plus Rocket Fuel**. Missions run 20 min / 1 h / 2 h for the first ship and longer for later ones, with 3 concurrent slots. They return tiered and rarity-graded artifacts, stones and ingredients for crafting ([Spaceships](https://egg-inc.fandom.com/wiki/Spaceships); [APKMirror 1.21.1](https://apkmirror.com/apk/auxbrain-inc/egg-inc/egg-inc-1-21-1-release/egg-inc-1-21-1-android-apk-download)). This adds a real-time "check back" timer and a gear treadmill that progresses on its own clock, independent of prestige. Put together, the cadence stack runs:

- **hours:** silo cap and ship timers;
- **daily:** gift calendar, videos and drones;
- **mid-week:** random 25-hour sale events and the Wednesday contract;
- **weekly:** contracts and the Sunday prestige boost;
- **monthly:** calendar refresh, a calendar prophecy egg and the 30-day grade window;
- **quarterly:** seasons.

Every frequency of player has a reason to open the app.

**Monetisation** sells the Pro Permit ($9.99 in 2026), golden egg packs ($4.99–19.99), piggy cracks ($3.99/$5.99) and, since 2023, Ultra subscriptions ($3.99 / $7.99 a month) ([App Pricing Lab](https://apppricinglab.com/iap/apple/993492744); [Egg, Inc. Ultra](https://egg-inc.fandom.com/wiki/Egg,_Inc._Ultra)). Third parties estimate more than $1M a month in iOS revenue ([AppGoblin](https://appgoblin.info/apps/993492744)). PocketGamer.biz called it the "gold standard" for being "heavily weighted to goodwill… than the hard sell" ([PocketGamer.biz](https://www.pocketgamer.biz/egg-inc-idle-games-gold-standard/)). It avoids pay-to-win mainly because soul and prophecy eggs cannot be bought. Paid items move a player along the curve (offline time, boosts, golden eggs that are also earnable) rather than raising the ceiling. The criticism concentrates on Ultra: an extra prophecy-egg contract each week, and a reported permanent 2× earnings on Pro (unverified), put power into the persistent layer. App Store reviews after 2023 called it the game "becoming pay to win" ([App Store NZ](https://apps.apple.com/nz/app/egg-inc/id993492744)).

The **UI** is confirmed only in outline: a dominant hatch button at the bottom (guides disagree on whether it is red or blue), drones crossing the screen, three concurrent rotating missions as onboarding scaffolding, separate cash and golden-egg research screens, per-slot hab and vehicle upgrades, a colour-coded depot bar, and a long number-suffix ladder (M, B, T, q, Q, s, S, o, N, d…) ([Touch Tap Play](https://www.touchtapplay.com/egg-inc-how-to-play-co-op-tips-and-cheats/); [Eggs](https://egg-inc.fandom.com/wiki/Eggs?oldid=2165)). Exact screen layout is unverified.

**Pecorella's theory** explains the architecture. Generators cost base × r^owned, with r ≈ 1.07 (AdVenture Capitalist) to 1.15 (Cookie Clicker), while production grows linearly times multipliers, so walls are inevitable ([Game Developer, Part I](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i)). Prestige converts earnings into a persistent multiplier via a fractional exponent: √ for Realm Grinder, ∛ for Cookie Clicker, and about 1/7 for Egg Inc, which he groups with "very flat curves" ([Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii)). Egg Inc's answer to a flat prestige curve is to stack *non-prestige* meta layers (prophecy eggs, epic research, artifacts, contracts) so long-term growth continues after soul eggs stall.

## Paw Park should drop costScale and copy Egg Inc's flat ladder

### The costScale model turns Find upgrades into rescaled replays

I checked the brief against the code. In `src/data/constants.ts` the prestige exponent is **0.2** (brief: 0.3), and `training.ts` holds **25 items / 232 levels** (brief: 23). `finds.ts` sets `costScale` from the formula `(value_k/value_0) × 1.6^k`, which reproduces the brief's ×8, ×64 … **1.13e10**. But the shipped table has been hand-tuned to a different curve: about ×5–6.25 per Find, topping at **5.82e8** for the Cosmic Bone.

Either way, the model has a mathematical property worth stating plainly. If every cash price in era k is multiplied by S_k and income scales with Find value V_k, then era k plays **identically to the Stick era with a Find worth V_k/S_k**. In the shipped table that effective value *falls* from 0.25 to 0.2, 0.16, 0.128 … **0.0172** by the Cosmic Bone, so each Find upgrade makes the park about 20% *poorer* in real terms. The ×4–5 value jump is cosmetic, and the only real progress is Spirit Paws and Academy. Egg Inc does the opposite. A new egg makes the bottom of the ladder trivially cheap (a satisfying blitz the Pack automation can perform as a visible montage), and the gate forces the player to tiers they have never reached. That is where the visual payoff lives: Planet Paw should be something you *first* see in a late era, not something you rebuild thirteen times.

The current gates are also erratic. Tennis→Squeaky ×12, →Rawhide ×545, →Wallet ×9, →Pirate ×336, →Dino ×53, →Crystal ×644, →Meteorite ×1,753, then ×374, ×370, ×63, ×26 (computed from `finds.ts`). Easy and hard eras alternate instead of the steady ramp Egg Inc shows.

The steelman for costScale is real: one number per era makes era length easy to tune, and content needs no extra price range. Egg Inc gets the same tunability from the gate ratio instead, while keeping the power fantasy. The recommendation is therefore to **set costScale = 1 for every Find**, or keep it only as a gentle ≤×1.5 per era "tax" if a playtest shows eras too short. Pacing then comes from Park Value gates and a longer price ladder.

That requires stretching the ladder. Paw Park's kennels currently step **×12 per tier (50 → 1.1e20)** against Egg Inc's roughly ×100. Training tops out near 1e17 base cost, while top Find income is 4e7× the Stick's. Under flat prices, a late-era player would max the whole ladder in minutes. Concretely:

- **Kennels:** raise the per-tier step to about **×40**, so 50 × 40^17 ≈ **8.6e28** for Planet Paw.
- **Vehicles:** raise the step to about **×150** over the 13 tiers, so the Teleporter reaches about 1e28.
- **Training:** add two tiers (6–7) with base costs around 1e22 and 1e26, ending near 1e30. Use one shared price list and cumulative-level tier gates (0/12/40/85/130/185/250), with ×1.3–1.6 growth for percentage items and ×2–4 for flat items.
- **Duplicates:** keep the current 1.35× duplicate rule early, but let it rise toward ×3–5 on the top three kennel tiers, as Egg Inc's Chicken Universe does.

The table below gives proposed Park Value gates. They keep Tennis at its current 1.17e4, keep Find values as they are (×4–5), and ramp the gate ratio smoothly from ×15 to ×1,000. That moves the gate-to-value ratio from about 3 to about 250, a compressed version of Egg Inc's 10→1,700 sized for a 3–4 month arc rather than years. Set Discover at gate ÷ 6.5. The day targets are **design targets, not Egg Inc data**.

| Find | Value | Gate × | Proposed upgrade gate | Target arrival (mostly-AFK, ~3 short sessions/day) |
|---|---|---|---|---|
| Tennis Ball | 1.25 | – | 1.2e4 | 10 min |
| Squeaky Toy | 6.25 | ×20 | 2.3e5 | 30 min |
| Rawhide | 30 | ×25 | 5.8e6 | 2 h |
| Lost Wallet | 150 | ×40 | 2.3e8 | end of day 1 |
| Pirate Coin | 700 | ×60 | 1.4e10 | day 2–3 |
| Dino Fossil | 2,750 | ×100 | 1.4e12 | day 5 |
| Crystal Bone | 1.1e4 | ×150 | 2.1e14 | day 9 |
| Meteorite | 4.2e4 | ×250 | 5.3e16 | day 15 |
| Ancient Relic | 1.65e5 | ×400 | 2.1e19 | day 24 |
| Moon Rock | 6.5e5 | ×600 | 1.3e22 | day 36 |
| Time Bone | 2.5e6 | ×800 | 1.0e25 | day 52 |
| Cosmic Bone | 1e7 | ×1,000 | 1.0e28 | day 75 |
| Endgame (Planet Paw ×4 full, Academy maxed) | – | – | – | day 100–120 |

Paw Park's Park Value is currently `income/s × 3600 × earnings`, i.e. one hour of income. Consider adopting Egg Inc's structure instead. Weight unshipped pups at 0.2 and add (empty kennel space)^0.6 plus a Rescue × Treat Jar hours term, so the gate rewards a *balanced* park and building ahead. Under flat prices that matters, because otherwise cash-hoarding or Zoomies spikes can skip gates.

### System-by-system mapping and the numbers to change

| Egg Inc system (fact) | Paw Park now | Recommendation |
|---|---|---|
| Hatchery 250→500, refill ~3/s, hold 2→32/s | Adoption Center cap 50, refill 1/s, hold 6/s | Fine for a mostly-AFK design; keep the button a burst tool. Raise cap to about 250 by Training tier 3 so whistle sessions still matter mid-game. |
| RCB 5×→540×, feeds farm value and drones | Zoomies: 20 max × 5% each, 1 s grace, decays 10/s | Feed **max** Zoomies (not current) into Park Value and squirrel payouts (× √Zoomies), as Egg Inc does, so active play speeds gates without being mandatory. |
| Internal hatchery 2→3,720/min/hab, ×2 always, ×3 offline-only | Rescue 2 + max 910/min per kennel; no offline multiplier | **Critical:** 4 Planet Paws (2.4e9 base, about ×94 with Training if the capacity items multiply as `STAT_MODES` indicates) at about 3,650/min take about 450 days base and over a century with capacity research, before Treats. Add an Academy "Calm" equivalent (×3 offline only) and a multiplicative Rescue line so an endgame fill takes **2–4 days AFK**, with Treats compressing it to hours. |
| Habs: 19 tiers, 4 slots, ×30–450 price/tier vs ×2–6 capacity | 18 kennels, 4 slots, ×12 price/tier, 1.35× duplicate | Stretch to ×40/tier under flat prices; keep capacities. |
| Vehicles: 12 tiers, 4→17 slots, Hyperloop 5→10 cars | 13 tiers, 4→12 slots, no cars | Add "sled cars" on the Teleporter (or a late "Pack Sled", 5→10 dogs per sled) as an in-slot late purchase; raise per-tier step to about ×150. |
| Egg values ×3–7, flat prices, gates ×45→×9,000 | Finds ×4–5, prices ×costScale, gates erratic | Flat prices plus the gate table above. |
| Research: 56 items, 13 tiers, 2,330 levels, 0.5→1e67 | Training 25 items, 5 tiers, 232 levels | Add tiers 6–7 (about 10 items) and a few "×2 per level" doublers per tier (Egg Inc's Bigger Eggs pattern) as wall-breakers. |
| SE ∝ earnings^0.15–0.21, +10% each | Spirit Paws = floor((E/1e7)^0.2) in current code (divisor recently changed from 1e8), +10% each | Keep 0.2 for a 3–4 month arc; add a steeper early term (for example 0.3 below 1e12) so the first two prestiges feel big, and show pending Paws live. |
| PE ×1.05 compounding, scarce (calendar 24, trophies 40, contracts) | Legend Collars ×1.05 from trophies | Add a calendar source (1 per 28-day streak month) and a weekly event source; cap total at about 40–60 Collars over 4 months (1.05^50 ≈ 11.5×). |
| Farmer roles = floor(log10 EB) | Park Level 1–120 | Expose a log10-of-earnings-bonus title ("Kilopup", "Megapup"…) next to Park Level. It is the most honest single number for friend comparison. |
| Silos 1 h each, 2 at 0.5× free, 10 at 1× paid (~30 h) | Treat Jar 8 h base → 48 h | Good for mostly-AFK play. Reach 16 h by about day 7 and 24 h by about day 21 via Academy; keep 48 h late, and never sell offline hours above 24 h for money. |
| Contracts weekly (Mon/Wed/Fri), seasons, co-op pooling | none (daily digs, streak) | A weekly "Dog Show" on a temporary side park, with friend co-op pooling and Collar rewards, is the strongest missing retention and social lever. |
| Ships/artifacts: 20 min–4 h missions, 3 slots | none | Optional later: "Walks" (20 min / 1 h / 4 h) returning cosmetic or minor-stat collectibles. |
| Monetisation: sells time; Ultra drew pay-to-win criticism | Pup Stars capped ≤25% speedup | Keep the cap; never sell Spirit Paws or Collars, or subscription multipliers. |

## Conclusion

Egg Inc's lesson is not its exponents but where it places difficulty. Prices are a fixed terrain shared by every egg. Each upgrade is felt as a jump in power, and the wall comes from a goalpost (farm value) that runs ahead faster and faster, forcing the player into the meta layers. Paw Park's costScale inverts this: it moves the terrain instead of the goalpost, which keeps the numbers tidy but quietly makes each new Find worth less in real terms and replays the same kennel art thirteen times. Switching to flat prices with a ×40-per-tier kennel ladder and a ×15→×1,000 gate ramp keeps the "one number per era" tunability while restoring the upgrade fantasy and the late visual reveals.

The Rescue gap is the urgent bug. A mostly-AFK design lives or dies on passive fill, and the current numbers make Planet Paw a decoration rather than a goal. Finally, Egg Inc's biggest unmeasured strength is its cadence stack (hours, days, weeks, seasons), and none of its timing numbers are publicly measured. Paw Park's day targets above should be validated with a headless simulation of a 3-sessions-a-day player before any art is committed.
