# Paw Park v2 — The Long Game (slow progress, super AFK)

**Goal:** reaching the end game (the Cosmic Bone) takes **about 3–4 months of real
time**. A player who checks in a few times a day for a couple of minutes should
make nearly as much progress as one who stays online. The game plays itself, and
the player's job is to make the **choices**: what to buy in the Academy, when to
use Treats, how to set automation, and when to prestige.

This doc overrides `02-paw-park-design.md` wherever they conflict. After the v2
balance pass, `02` gets its tables updated so it matches the data again.

---

## 1. Why v1 can't last months (diagnosis)

The v1 bot hit find 8 of 13 within 60 minutes. Income went from 2.5e5/s at 30
min to 4.6e14/s at 60 min. The causes are structural:

1. **The cap on a single run is huge and cheap.** Training multipliers stack
   multiplicatively (dig alone reaches about ×2,400 at max). Tier 4–5 research
   costs 1e10–1e13, and that money arrives within minutes once a high-value
   find is unlocked. So **one run blows through several finds**, and prestige
   isn't needed.
2. **Progress is measured in minutes of play.** Nothing ties pacing to
   wall-clock time. Offline earnings are capped at 1 h, and offline time can't
   buy anything, so AFK time is almost worthless and active time is everything.
   That is the opposite of what we want.

## 2. Pacing model (the framework the numbers must follow)

```
log10(income)
   │                                   ___----- run N plateau (bonus B_N)
   │                         ___-------
   │              ___-------    ← each run: fast climb, then a wall
   │     ___------                (exponential costs vs capped multipliers)
   │ __--     ← run 1
   └──────────────────────────────────────────────► wall-clock days
```

- **Within a run:** fast early growth, then a **wall**. Costs grow exponentially
  (kennel and vehicle tiers ×10–15 in cost for ×2–2.5 capacity, and training
  `costGrowth` 1.15–1.35 over many levels), while each item's max level caps what
  multipliers can reach. Where the wall sits depends on the earnings bonus.
- **Across runs:** Spirit Paws raise the wall. Paw gain is a **low power** of run
  earnings (`PRESTIGE_EXPONENT` around 0.2–0.35), so each doubling of the bonus
  takes longer than the last. Progress grows roughly logarithmically in time.
- **Find gates** (`unlockParkValue`) are placed so that **find k needs an earnings
  bonus of about B_k**. You only get there through enough prestiges or enough
  meta upgrades, never through one long run. That is what stretches the ladder
  into months.
- **Meta (Golden Bones → Academy)** trickles in at a roughly steady rate per
  real day (mail, the squirrel hound, trophies, first-time find rewards). Long
  Academy ladders (25–50 levels, growth 1.15–1.3) give that trickle somewhere to
  go for the whole game.

The balance agent tunes numbers inside this structure. It must not get pacing
from timers ("wait 24 h"). The game is slow because the economy is.

## 3. AFK systems (new engine features)

### 3.1 Offline progress is the full game
- `BASE_OFFLINE_HOURS = 8`. Academy *Bigger Treat Jar* adds +2 h per level, up to
  48 h total.
- Offline simulation calls the **same** `stepSimulation` as the online tick, in
  chunks of at most `OFFLINE_MAX_CHUNK_SEC = 60` s. That way **automation, auto
  find, auto prestige, rescue, mail, squirrels (through the hound), trophies and
  treats all work offline**.
- Rescue runs at 100% offline. The `offlineRescue` stat and the Night Shift
  Academy item are **removed**.
- Zoomies are 0 offline. Offline time past the Treat Jar cap is lost, and that
  loss is the reason to buy the Treat Jar upgrades.

### 3.2 Passive population from minute one
`rescuePerSec = builtKennels × (BASE_RESCUE_PER_MIN + A(rescueRate)) / 60 × treat(adoption)`,
with `BASE_RESCUE_PER_MIN = 2`. The whistle becomes an active-play accelerator,
and players don't need it to progress.

### 3.3 Automation ("The Pack")
State: `automation: { find, build, training, whistle, prestige: boolean; prestigeThreshold: number }`.
Each key works only when **unlocked** and **enabled**. Unlocking an Academy item
for it sets its toggle to enabled.

| key | unlocked by | effect |
|---|---|---|
| find | free from the start | upgrades the find as soon as `parkValue` allows |
| build | Academy `foreman_pup` (stat `autoBuild` ≥ 1) | buys kennel and vehicle upgrades |
| training | Academy `head_trainer` (stat `autoTraining` ≥ 1) | buys training levels |
| whistle | Academy `volunteer_walkers` (stat `autoWhistle`, 0.2/level, max 5) | each second, adopts `autoWhistle × adoptionRefill` pups from stock (`fromTap = false`) |
| prestige | Academy `retirement_planner` (stat `autoPrestige` ≥ 1) | prestiges when `gain ≥ max(1, prestigeThreshold × spiritPaws)` and `runTimeSec ≥ AUTO_PRESTIGE_MIN_RUN_SEC` |

`prestigeThreshold` is chosen by the player from `AUTO_PRESTIGE_THRESHOLDS =
[0.1, 0.25, 0.5, 1, 2]`. The default is 0.5.

**Automation runs inside `stepSimulation`.** An accumulator `automationTimer`
fires every `AUTOMATION_INTERVAL_SEC = 2` s of simulated time; offline, it fires
once per chunk. On each fire, `runAutomation(state)` does the following, in order:
1. **find** upgrades while it can (a loop, in case several are affordable).
2. **build / training** run a purchase loop of up to `AUTOMATION_MAX_BUYS = 50`
   buys:
   - Pick the *priority bucket* from the bottleneck:
     - If `bottleneck === 'ship'`: vehicle upgrades plus `shippingCapacity`
       training.
     - Else if `pups ≥ 0.9 × kennelCapacity`: kennel upgrades plus
       `kennelCapacity` training.
     - Else: `layRate`, `findValue`, `rescueRate`, `adoptionRefill` and
       `adoptionCap` training.
   - Only include candidates whose automation key is enabled and unlocked.
     Vehicles only go into slots below `fleetSlots`. Training only comes from
     unlocked tiers.
   - Buy the **cheapest affordable** candidate in the bucket. If none is
     affordable, buy the cheapest affordable candidate **overall**, but only if it
     costs ≤ `AUTO_SPLURGE_FRACTION (0.1)` × the cheapest bucket candidate's cost
     (so the loop saves up instead of spending cash on side items). Otherwise
     stop.
   - Fleet Expansion and other non-bucket training get bought through the
     "overall" path.
3. **prestige**: check the rule above. If it prestiges, emit `autoPrestige`. After
   a prestige, the same fire carries on, so find and build restart the new park
   immediately.

Automation is deterministic and needs no RNG. Purchases go through the normal
`buy*` actions.

### 3.4 Mailbox
- `mailReady: boolean` is replaced by `mailCount: number`, capped at
  `mailCapacity = BASE_MAIL_CAPACITY (6) + A(mailCapacity)`.
- `MAIL_INTERVAL_SEC = 7200` (final balance value, see §7: with 4 check-ins a
  day the AFK player collects ~11 letters, the Daily player 6, so check-ins
  matter but are not the whole economy). The timer keeps running offline, and
  letters pile up to the cap. Opening mail is the check-in ritual: `openMail` opens one letter,
  and `openAllMail` opens all of them.

### 3.5 Squirrel Hound
Academy `squirrel_hound` gives stat `squirrelHound` (+0.1 per level, max 10, so
it reaches 100%).
- **Online:** when a squirrel expires uncaught, it's caught automatically with
  probability `squirrelHound`.
- **Offline:** squirrels still spawn (the timer runs). Each one resolves on the
  spot, caught with probability `squirrelHound` and otherwise lost. None are left
  active.
- Hound catches count in `stats.squirrelsCaught` and in the offline report.

### 3.6 Treats sized for being away
Durations are long so one treat covers a night away:

| id | effect | mult | duration | cost |
|---|---|---|---|---|
| bacon_strip | earnings | ×2 | 4 h | 40 |
| peanut_kong | adoption (refill + rescue) | ×5 | 4 h | 20 |
| steak_dinner | layRate | ×3 | 4 h | 60 |

### 3.7 Trophies v2 (milestone density)
`TrophyDef = { id, name, icon, kind, threshold, collars, goldenBones }`, where
`kind ∈ 'pups' | 'lifetimeEarnings' | 'prestiges' | 'find'`. Each is checked every
step (`find` compares against `highestFindIndex`) and awarded once, ever.
Final list (docs/02 §4.7 has the table; thresholds were re-tuned in the balance
pass so every trophy is reachable inside the 3–4 month arc):

- **pups:** 1e3 (5 GB), 1e4 (1c, 10 GB), 1e5 (1c), 1e6 (1c, 15 GB), 1e7 (2c),
  1e8 (2c, 40 GB), 3e8 (3c)
- **lifetimeEarnings:** 1e6 (10 GB), 1e9 (1c), 1e12 (1c, 15 GB), 1e15 (1c), 1e18
  (2c, 20 GB), 1e21 (2c), 1e24 (3c, 30 GB), 1e27 (3c), 1e30 (3c, 50 GB), 1e33 (3c)
- **prestiges:** 1 (20 GB), 4 (1c), 10 (1c, 20 GB), 20 (2c, 40 GB), 30 (3c, 60 GB)
- **find:** index 6 (1c, 50 GB), index 9 (2c, 100 GB), index 12 = **"Paw Park
  Legend"** (5c, 500 GB). Reaching it also emits `endgame` once.

### 3.8 Academy v2 (final values)
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

Design rule behind the "ladders": most utility ladders were widened to 20–40
levels at growth 1.15–1.22 so that, with the bot's cheapest-first spending, the
cheapest next purchase stays small relative to the bone inflow for the whole
game (no stretch of more than 2 days without an Academy purchase after the
Planner). The Hound reaches 100% only at level 20, so the bone trickle it
produces ramps up slowly instead of arriving in one purchase.

New stat modes, all `add`: `mailCapacity`, `squirrelHound`, `autoWhistle`,
`autoBuild`, `autoTraining`, `autoPrestige`. `offlineRescue` is removed.

### 3.9 Prestige
- **Formula unchanged** (`gain = floor((runEarnings / PRESTIGE_DIVISOR) ^ PRESTIGE_EXPONENT)`;
  `earningsBonus = 1 + spiritPaws × pawBonus × collarMult`). The balance pass needed
  no soft cap or diminishing paw bonus: the pacing comes from data (bounded
  training, steep kennel and vehicle costs, gates placed from the wall table).
  Final constants: `PRESTIGE_DIVISOR = 1e8`, `PRESTIGE_EXPONENT = 0.3`,
  `BASE_SPIRIT_PAW_BONUS = 0.1`. Why 0.3: with exponent `e` and an in-run income
  elasticity `x` to the bonus (~1.0–1.7 here), the time between prestiges grows
  like `SP^(1/e − 1 − x)`. At 0.3 that exponent is positive, so runs get longer as
  the bonus grows (a steady slowdown); at 0.4 it is about zero or negative, which
  is the v1 runaway.
- `runTimeSec` (online plus offline) resets on prestige.
- These are **kept** across prestige: `automation` settings and the
  `mailCount`/`mailTimer` state.

## 4. UI requirements (v2)
- **Pack panel** (a new tab, or a section at the top of Academy): one toggle per
  automation key, showing locked / unlocked-on / unlocked-off. Locked keys show
  the Academy item that unlocks them. It also holds the auto-prestige threshold
  picker and a one-line status ("Foreman bought 12 upgrades this session").
- **Mail:** the 📬 icon shows a count badge, and tapping it opens all letters, with
  one toast per reward summed by kind.
- **Welcome Back** shows the full `OfflineReport`: time away (and how much was
  lost to the Jar cap, with a hint to upgrade), cash earned, pups gained,
  purchases made, finds unlocked, prestiges plus paws gained, bones gained,
  squirrels caught, and letters waiting.
- **Next-goal line** in the HUD: the next find's icon and a **log-scale**
  progress bar from the current find's threshold to the next one:
  `(log(pv) − log(cur)) / (log(next) − log(cur))`. For a slow game it matters
  that progress is visible even when it is slow.
- **Endgame** modal when `endgame` fires: congratulations, a stats summary, and a
  note that play continues.
- **Toasts** for `autoPrestige` ("Opened a new park: +N 🐾") and for a find
  unlocked by automation.
- **Cosmetic fix:** pups should wander across the whole lawn, not cluster near
  the top.

## 5. Balance bot v2 (`npm run balance`)
It simulates **real days**, starting day 0 at 18:00. All three profiles begin
with a 30-minute active session (whistle at `HOLD_ADOPT_PER_SEC` for the first 10
min, manual buys using the automation policy).

| profile | check-ins (local time) | session length | active behaviour |
|---|---|---|---|
| **AFK** (primary) | 08:00, 12:30, 18:00, 22:30 | 3 min | none |
| **Daily** | 20:00 | 5 min | none |
| **Active** | AFK check-ins, plus online 18:00–22:00 daily | 4 h | whistle 10 s of every 60 s, catches all squirrels |

What the bot does at **check-in**: open all mail. Buy Academy items with this
priority: foreman_pup → head_trainer → bigger_jar until the cap covers its
longest gap → volunteer_walkers → retirement_planner → cheapest remaining. Make
sure all owned automation is enabled, then run manual buys with the automation
policy. Before owning retirement_planner, prestige manually if `gain ≥ max(1,
0.5 × spiritPaws)` and the run is ≥ 10 min old. It buys no treats.

**Between check-ins**, it calls `applyOfflineProgress` and doesn't tick, so the
real offline path (cap, chunking, automation) is what gets tested. Online
sessions tick at dt = 1 s (Active may use dt = 2 s). The sim goes up to day 200.

> **v3 update (docs/06 §10–§11):** the primary profile is now **AFK+Daily** (AFK
> check-ins plus the daily ritual), and the Daily/Active ratios are measured
> against it. The Daily and Active bots also do the daily ritual, and Minnow and
> Whale profiles were added. The timeline below is judged on AFK+Daily; the
> numbers in §7 are the v2 results (pure AFK) and were superseded by docs/06
> §11 (find gates 5–12, Retirement Planner cost and daily rewards changed).

### Targets (AFK+Daily profile unless noted)
| Milestone | Target |
|---|---|
| Tennis Ball | ≤ 10 min |
| Squeaky Toy | ≤ 45 min |
| Rawhide | day 0–1 |
| First prestige | day 0–1 |
| Lost Wallet | day 1–3 |
| Pirate Coin | day 4–8 |
| Dino Fossil | day 9–16 |
| Crystal Bone | day 17–28 |
| Meteorite | day 29–42 |
| Ancient Relic | day 43–58 |
| Moon Rock | day 59–75 |
| Time Bone | day 76–95 |
| **Cosmic Bone (endgame)** | **day 95–125** |
| Longest drought with no milestone event (new find record, trophy, Academy level, prestige) | ≤ 3 days |
| Daily profile reaches Cosmic Bone | ≤ 1.5 × AFK+Daily days |
| Active profile reaches Cosmic Bone | ≥ 0.7 × AFK+Daily days (active play helps, but by no more than ~30%) |
| Whale (Diamond, shop maxed, Bacon every evening) | ≥ 0.75 × AFK+Daily days (docs/06 §8.4) |
| Minnow ($4.99) | ≥ 0.92 × AFK+Daily days |

The report has a milestone table with PASS/FAIL for each profile and a
per-day log for AFK (day, log10 B, log10 income, paws, finds, GB, prestiges,
Academy levels). It needs `--profile`, `--days` and `--verbose` flags, and a full
run must finish in under 2 minutes.

Implementation notes (`scripts/balance.ts`):
- The bot sets `Math.random` to its seeded generator, so the real
  `applyOfflineProgress` path is deterministic. `--seed N` changes the seed.
- Extra rows beyond the §5 table: Foreman Pup on day 0, Head Trainer by day 1,
  Retirement Planner on day 10–20, and "longest Academy drought ≤ 2 days after
  the Planner" (this is the "bones never pile up unspent" check). Daily and
  Active are held to the absolute targets only for Tennis, Squeaky, Rawhide and
  the first prestige, and to the Cosmic Bone ratio.
- Diagnostics used by the tuning loop: `--hold K` disables the gates above find
  K, `--gates "k:value,…"` overrides gates, `--stop K` ends a profile at find K,
  and `--json` prints raw times. `CHEAT="id=level,…"` (with `CHEAT_FOR=profile`)
  pre-buys Academy levels to test hypotheses.
- `scripts/wall.ts` is the second tool (§7.3).

## 6. Save migration
`version: 2`. `deserialize` accepts v1 and migrates it:
- `mailReady` becomes `mailCount` (1 or 0).
- `automation` gets its defaults: find on, the others on only if already
  unlocked, threshold 0.5.
- `runTimeSec` and `automationTimer` start at 0.
- Unknown Academy ids (`night_shift`) are dropped.
- The `SAVE_KEY` stays the same.

## 7. Balance results

Final numbers from `npm run balance` (seed 12345, full run about 20 s) and
`npx tsx scripts/wall.ts`. Everything below is the committed data: no engine
change was needed (§3.9).

### 7.1 How the numbers were found
1. **Bound the in-run ceiling** (§2). Training now has 12–15 levels at most on
   cheap items and 6–8 on late items, with `costGrowth` 1.5–3.5 (it was
   1.45–2.5 with up to 25 levels), and every item is worth less per level
   (`perLevel` 0.1–1.0). Kennel and vehicle costs now grow ×12 per tier from the
   third tier on (they grew ×6–8 before) while capacity grows ×2–2.5 per tier.
   Late items sit in cost windows that only a high bonus can afford:
   tier 3 ≈ 1e7–1e11, tier 4 ≈ 1e12–1e15, tier 5 ≈ 1e17–1e20. New rescue items
   (Rescue Choppers, Pup Portals) keep the population growing in the late game,
   because pups per day, not kennel size, is the real brake on a run.
2. **Wall table** (`scripts/wall.ts`, §7.3): for a given bonus B it shows how far
   one automated park gets in 1, 3 and 7 days with no prestige. It is smooth: one
   find per ~×30 of B at the start, per ~×10 later, saturating above B ≈ 1e10.
   With the old data B = 1 already reached Moon Rock in a day.
3. **Prestige** re-tuned to `PRESTIGE_DIVISOR = 1e8`, `PRESTIGE_EXPONENT = 0.3`
   (was 1e7 / 0.4) so run length grows with the bonus (§3.9).
4. **Find gates** (`FINDS[k].unlockParkValue`) were then placed by a calibration
   loop: for k = 3…12 in order, bisect on `log10(unlockParkValue_k)` with the
   AFK bot (later finds disabled) until find k lands on its target day. The wall
   table cross-checks the result: the bonus at which the bot unlocks find k
   (column `log10 B` below) is within ~0.3–1 decade of the bonus at which one
   plain park reaches it in 3 days. The gap is the Academy (epic ladders and
   discounts), which the wall run does not have.
   The early gates are (2.5e4, 4e5, 1.3e8) for Tennis Ball, Squeaky Toy and
   Rawhide, so they fall in minutes to hours, and Lost Wallet needs 6.8e14, which
   is only possible after a handful of prestiges (the bonus is about 30 on
   day 2 and 6,000 on day 7). From Dino Fossil on the gate ratio is ×10–×30 per
   find.
5. **Value ladder**: ×5 per find early (0.25 → 700 by Pirate Coin), easing to ×4
   at the top, ending at 1e7 for the Cosmic Bone.
6. **Bone flow** (see §7.5): mail 2–7 bones at 55% per letter (6 letters per
   check-in, one letter per 2 h), squirrel bones 1–4 at 35% of squirrels (one per
   15–30 min, caught by the Hound), find rewards 10–600 (front-loaded enough for
   the Daily player to afford Planner and Jar), trophies re-thresholded to values
   reachable in the 3–4 month arc.

### 7.2 Milestone tables (seed 12345)
The AFK table is the primary one. Daily and Active are judged on the ratio of
their Cosmic Bone day to the AFK one (Daily ≤ 1.5×, Active ≥ 0.7×); their
Tennis, Squeaky and Rawhide rows use the same absolute targets as AFK because
the opening session is identical. `log10 B` is the earnings bonus when that find
was first unlocked (the realised B(day) schedule).

AFK (primary):
```
=== Profile: AFK (primary)  (seed 12345, simulated 110.2 days in 3.2s) ===
day  log10B  log10inc  paws          find  GB      prestiges  academyLv
  0     0.0      -9.0  0.0              0  0.0             0          1
  7     3.8      16.5  32613            5  346            14          8
 14     4.8      18.7  264779           6  2.0            19         31
 21     5.2      20.7  595796           6  4.0            21         47
 28     5.6      22.3  1.34e+6          7  2.0            23         65
 35     6.0      21.9  3.02e+6          8  2.0            25         81
 42     6.2      22.5  4.52e+6          8  8.0            26         91
 49     6.2      23.3  4.52e+6          8  20.0           26         99
 56     6.5      24.5  6.79e+6          9  8.0            27        115
 63     6.9      25.1  1.02e+7         10  54.0           28        128
 70     7.4      25.4  2.29e+7         10  8.0            30        136
 77     7.4      25.7  2.29e+7         10  16.0           30        141
 84     7.7      26.6  3.44e+7         11  51.0           31        152
 91     7.9      26.8  5.15e+7         11  10.0           32        158
 98     8.2      27.0  7.73e+7         11  78.0           33        162
105     8.3      27.2  7.73e+7         11  71.0           33        167
110     8.5      26.7  1.16e+8         11  80.0           34        170
Milestone                Result                Target                log10 B  
----------------------------------------------------------------------------
Tennis Ball               5.8 min               <= 10 min             0.0      PASS
Squeaky Toy               9.1 min               <= 45 min             0.0      PASS
Rawhide                   4.5 h (d0.19)         day 0-1               0.0      PASS
Lost Wallet               day 2.0               day 1-3               1.5      PASS
Pirate Coin               day 5.8               day 4-8               3.2      PASS
Dino Fossil               day 12.0              day 9-16              4.6      PASS
Crystal Bone              day 21.2              day 17-28             5.2      PASS
Meteorite                 day 31.6              day 29-42             5.8      PASS
Ancient Relic             day 54.8              day 43-58             6.5      PASS
Moon Rock                 day 61.6              day 59-75             6.9      PASS
Time Bone                 day 81.2              day 76-95             7.7      PASS
Cosmic Bone (endgame)     day 110.2             day 95-125            8.7      PASS
First prestige            4.5 h (d0.19)         day 0-1                        PASS
Foreman Pup bought        0.0 min               day 0                          PASS
Head Trainer bought       4.5 h (d0.19)         by day 1                       PASS
Retirement Planner bought day 12.0              day 10-20                      PASS
Longest drought           1.81 d @day 73.8      <= 3 days                      PASS
Academy bought near end   last @day 110.2       within 2 d of end              PASS
Longest Academy drought   1.81 d @day 73.8      <= 2 d after Planner           PASS
Academy ladders maxed (info)5/16                                                 
first Academy buys (day): foreman_pup@0.0 head_trainer@0.2 bigger_jar@0.2 volunteer_walkers@0.2 retirement_planner@12.0 epic_digging@12.0 epic_kibble@12.0 max_zoomies@12.2 squirrel_spotter@12.2 kennel_deals@12.2 fleet_deals@12.2 bigger_mailbox@13.6 bargain_hunter@19.2 squirrel_hound@23.6 spirit_bond@24.6 legend_lore@52.8
(max pups 1.45e+8, paws 1.16e+8, prestiges 34, academy levels 180, unspent GB 60.0, Academy spent 8178, next cheapest 120)
```

Daily:
```
=== Profile: Daily  (seed 12345, simulated 147.1 days in 3.1s) ===
Milestone                Result                Target                log10 B  
----------------------------------------------------------------------------
Tennis Ball               5.8 min               <= 10 min             0.0      PASS
Squeaky Toy               9.1 min               <= 45 min             0.0      PASS
Rawhide                   2.0 h (d0.08)         day 0-1               0.0      PASS
Lost Wallet               day 3.1               AFK x1.54             1.4      
Pirate Coin               day 8.1               AFK x1.40             3.4      
Dino Fossil               day 24.1              AFK x2.01             4.8      
Crystal Bone              day 38.1              AFK x1.80             5.4      
Meteorite                 day 59.1              AFK x1.87             6.0      
Ancient Relic             day 70.1              AFK x1.28             6.3      
Moon Rock                 day 83.1              AFK x1.35             6.9      
Time Bone                 day 112.1             AFK x1.38             7.7      
Cosmic Bone (endgame)     day 147.1             AFK x1.33             8.7      
First prestige            2.0 h (d0.08)         day 0-1                        PASS
Daily / AFK days to Cosmic1.33                  <= 1.5                         PASS
first Academy buys (day): foreman_pup@0.0 head_trainer@0.1 bigger_jar@0.1 volunteer_walkers@1.1 retirement_planner@25.1 epic_digging@25.1 epic_kibble@25.1 max_zoomies@25.1 squirrel_spotter@25.1 kennel_deals@26.1 fleet_deals@26.1 bigger_mailbox@27.1 bargain_hunter@39.1 squirrel_hound@42.1 spirit_bond@44.1 legend_lore@71.1
(max pups 2.13e+8, paws 1.23e+8, prestiges 29, academy levels 178, unspent GB 1178, Academy spent 7938, next cheapest 120)
```

Active:
```
=== Profile: Active  (seed 12345, simulated 92.6 days in 13.2s) ===
Milestone                Result                Target                log10 B  
----------------------------------------------------------------------------
Tennis Ball               5.8 min               <= 10 min             0.0      PASS
Squeaky Toy               9.1 min               <= 45 min             0.0      PASS
Rawhide                   21.0 min              day 0-1               0.0      PASS
Lost Wallet               day 2.0               AFK x1.00             1.6      
Pirate Coin               day 5.1               AFK x0.88             3.1      
Dino Fossil               day 11.6              AFK x0.97             4.6      
Crystal Bone              day 21.8              AFK x1.03             5.3      
Meteorite                 day 35.0              AFK x1.11             6.0      
Ancient Relic             day 39.8              AFK x0.73             6.4      
Moon Rock                 day 49.0              AFK x0.80             6.9      
Time Bone                 day 73.6              AFK x0.91             7.7      
Cosmic Bone (endgame)     day 92.6              AFK x0.84             8.8      
First prestige            23.1 min              day 0-1                        PASS
Active / AFK days to Cosmic0.84                  >= 0.7                         PASS
first Academy buys (day): foreman_pup@0.0 head_trainer@0.2 bigger_jar@0.2 volunteer_walkers@0.2 retirement_planner@8.2 epic_digging@8.2 epic_kibble@8.6 max_zoomies@9.8 squirrel_spotter@10.8 kennel_deals@11.6 fleet_deals@11.6 bigger_mailbox@11.8 bargain_hunter@14.6 squirrel_hound@19.6 spirit_bond@20.6 legend_lore@39.8
(max pups 1.15e+8, paws 1.03e+8, prestiges 38, academy levels 182, unspent GB 114, Academy spent 8419, next cheapest 124)
```

Summary: **Overall PASS**. AFK reaches the Cosmic Bone on day 110.2. Daily takes
147.1 days (×1.33). Active takes 92.6 days (×0.84). The bonus grows from 1 (day
0) to 6e3 (day 7), 6e4 (day 14), 4e5 (day 28), 1.6e6 (day 42), 8e6 (day 63),
5e7 (day 84) and 3e8 (day 110). That is a bit over 3.5 months of
real time for the primary profile. Across seeds 1–4 the AFK Cosmic day is 99.6,
109.6, 106.6 and 105.6; a few intermediate rows (±1–3 days) and the 2-day
Academy-drought row can slip by one check-in on other seeds, since the gates were
calibrated on seed 12345.

### 7.3 Wall table (`npx tsx scripts/wall.ts`)
One fully automated park (all Pack automation unlocked, Jar for 48 h offline, no
prestige), earnings bonus injected as `spiritPaws`, offline for 1, 3 and 7 days.
Cells are `highest find (log10 income / log10 parkValue)`:
```
Wall table: one automated park, no prestige, offline simulation

log10 B | 1d: find (log10 inc / log10 parkValue)   | 3d: find (log10 inc / log10 parkValue)   | 7d: find (log10 inc / log10 parkValue)  
--------------------------------------------------------------------------------------------------------------------------------------------
      0 |  3 Rawhide Bone  (9.7 / 13.2)            |  3 Rawhide Bone  (10.8 / 14.3)           |  3 Rawhide Bone  (11.3 / 14.8)          
      1 |  4 Lost Wallet   (12.1 / 15.7)           |  4 Lost Wallet   (13.9 / 17.4)           |  4 Lost Wallet   (14.9 / 18.5)          
      2 |  4 Lost Wallet   (14.5 / 18.1)           |  4 Lost Wallet   (15.8 / 19.3)           |  4 Lost Wallet   (16.3 / 19.9)          
      3 |  4 Lost Wallet   (16.3 / 19.8)           |  5 Pirate Coin   (17.6 / 21.2)           |  5 Pirate Coin   (18.0 / 21.6)          
      4 |  5 Pirate Coin   (18.1 / 21.7)           |  5 Pirate Coin   (18.7 / 22.2)           |  5 Pirate Coin   (19.1 / 22.7)          
      5 |  5 Pirate Coin   (19.2 / 22.7)           |  6 Dino Fossil   (20.4 / 23.9)           |  6 Dino Fossil   (20.7 / 24.3)          
      6 |  6 Dino Fossil   (20.9 / 24.4)           |  7 Crystal Bone  (22.0 / 25.6)           |  8 Meteorite     (23.0 / 26.5)          
      7 |  8 Meteorite     (23.1 / 26.7)           |  9 Ancient Relic (24.3 / 27.8)           | 10 Moon Rock     (25.3 / 28.8)          
      8 | 10 Moon Rock     (25.3 / 28.9)           | 10 Moon Rock     (25.9 / 29.5)           | 11 Time Bone     (26.9 / 30.4)          
      9 | 11 Time Bone     (27.0 / 30.5)           | 12 Cosmic Bone   (28.3 / 31.8)           | 12 Cosmic Bone   (28.6 / 32.2)          
     10 | 12 Cosmic Bone   (28.8 / 32.3)           | 12 Cosmic Bone   (29.3 / 32.8)           | 12 Cosmic Bone   (29.6 / 33.2)          
     11 | 12 Cosmic Bone   (29.8 / 33.3)           | 12 Cosmic Bone   (30.3 / 33.8)           | 12 Cosmic Bone   (30.6 / 34.2)          
     12 | 12 Cosmic Bone   (30.8 / 34.3)           | 12 Cosmic Bone   (31.3 / 34.8)           | 12 Cosmic Bone   (31.6 / 35.2)
```
`--find k` holds the find at index k and shows the plateau parkValue for that
find; `--maxlog` and `--step` change the B range. Reading it:
- B = 1 stalls at Rawhide, B = 10 at Lost Wallet, B ≈ 1e3 at Pirate Coin,
  B ≈ 1e5 at Dino Fossil, B ≈ 1e6 at Crystal Bone, B ≈ 1e7 at Ancient Relic,
  B ≈ 1e8 at Moon Rock, B ≈ 1e9 at Time Bone / Cosmic Bone.
- Time matters, but only weakly: 1 day to 7 days is worth about ×3–×10 of
  income, roughly one find or half a decade of B. The bonus is the lever.
- Above B ≈ 1e10 everything is capped, and income grows 1:1 with B.

### 7.4 Key data changes and why
| area | v2 start | final | rationale |
|---|---|---|---|
| `PRESTIGE_DIVISOR` / `PRESTIGE_EXPONENT` | 1e7 / 0.4 | 1e8 / 0.3 | slower-than-linear growth of the bonus with time (§3.9) |
| Training | 25 levels, growth 1.45–2.5 | ≤ 15 levels, growth 1.5–3.5, smaller perLevel, 3 new rescue items | bounded ceilings; late costs reachable only with a high bonus |
| Kennel costs | ×6–8 per tier | ×12 per tier from tier 3 | ratio ≥ ×10; the wall appears after ~7 tiers |
| Vehicle costs | ×10 (×15–33 early) | ×12 (×15 then ×20 early) | same |
| Finds | gates 3.5e4 … 6e23; rewards 5–150 | gates 2.5e4 … 6e30 (§7.6); rewards 10–600 | calibrated; larger and front-loaded bones |
| Find values | 4.2–5 then 3.5, 3, 2.9, 6.7 | 5 → 4 per find, ends at 1e7 | one smooth ladder |
| `SQUIRREL_INTERVAL` | 45–90 s | 900–1800 s | the Hound made 900 bones/day at 45–90 s; now about 55 bones/day at 100% |
| Mail | 1 letter / 30 min, cap 3, 3–10 bones at 50% | 1 / 2 h, cap 6, 2–7 bones at 55% | keeps Daily within 1.5× of AFK (the 4:1 check-in ratio would otherwise be a 4:1 bone ratio) |
| Planner / Jar / Walkers / Mailbox | 400 / 15×1.25 / 20×1.6 / 25×1.5 | 500 / 5×1.2 / 8×1.4 / 12×1.4 | Planner on day 12 (AFK), 25 (Daily); the Jar ladder is cheap enough for Daily |
| Utility ladders | 10–20 levels | 20–40 levels, growth 1.15–1.22 | bones stay useful through day 100 |
| Trophies | up to 1e27 cash, 500 prestiges | up to 1e33 cash, 30 prestiges, more GB | every trophy reachable |

### 7.5 Bone flow and Academy timing (AFK bot)
Foreman Pup is bought on day 0 (it costs the starting 10 bones). Head Trainer
and the 1-level Jar come at 4.5 h, when Rawhide's reward arrives. Retirement
Planner is bought on day 12.0 (Daily: day 25, Active: day 8). After that the bot
buys the cheapest ladder level each check-in; the longest stretch without an
Academy purchase is 1.8 days, and the last purchase is on the Cosmic Bone day.
Academy spend over the run is about 8,200 bones, with 180 levels bought; the
epic ladders are only 20 of 50 levels done, so bones are never short of a use.

### 7.6 Final find gates
| # | find | value | unlockParkValue | AFK day | log10 B at unlock |
|---|---|---|---|---|---|
| 1 | Tennis Ball | 1.25 | 2.5e4 | 5.8 min | 0.0 |
| 2 | Squeaky Toy | 6.25 | 4e5 | 9.1 min | 0.0 |
| 3 | Rawhide Bone | 30 | 1.3e8 | 4.5 h | 0.0 |
| 4 | Lost Wallet | 150 | 6.8e14 | 2.0 | 1.5 |
| 5 | Pirate Coin | 700 | 1.1e20 | 5.8 | 3.2 |
| 6 | Dino Fossil | 2,750 | 1e23 | 12.0 | 4.6 |
| 7 | Crystal Bone | 1.1e4 | 3.3e24 | 21.2 | 5.2 |
| 8 | Meteorite | 4.2e4 | 6e25 | 31.6 | 5.8 |
| 9 | Ancient Relic | 1.65e5 | 6.6e26 | 54.8 | 6.5 |
| 10 | Moon Rock | 6.5e5 | 1.1e28 | 61.6 | 6.9 |
| 11 | Time Bone | 2.5e6 | 3.1e29 | 81.2 | 7.7 |
| 12 | Cosmic Bone | 1e7 | 6e30 | 110.2 | 8.7 |

### 7.7 Re-tuning recipe
If any data changes, redo these steps in order: (1) `npx tsx scripts/wall.ts` to
see whether the ceilings still bind; (2) `npm run balance -- --profile afk
--hold K` to see how fast the bonus grows while parked on find K; (3) recalibrate
the gates one find at a time (`--gates "k:value,..." --stop k --json` prints the
raw find times to bisect on); (4) `npm run balance` for the full report.
