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
  `mailCapacity = BASE_MAIL_CAPACITY (3) + A(mailCapacity)`.
- `MAIL_INTERVAL_SEC = 1800`. The timer keeps running offline, and letters pile
  up to the cap. Opening mail is the check-in ritual: `openMail` opens one letter,
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
step (`find` compares against `highestFindIndex`) and awarded once, ever. The
starting list (the balance agent may tune thresholds and rewards):

- **pups:** 1e3 (5 GB), 1e4 (1c), 1e5 (1c), 1e6 (1c), 1e7 (2c), 1e8 (2c), 1e9 (3c)
- **lifetimeEarnings:** 1e6 (10 GB), 1e9 (1c), 1e12 (1c), 1e15 (1c), 1e18 (2c),
  1e21 (2c), 1e24 (3c), 1e27 (3c)
- **prestiges:** 1 (20 GB), 5 (1c), 25 (1c), 100 (2c), 500 (3c)
- **find:** index 6 (1c, 50 GB), index 9 (2c, 100 GB), index 12 = **"Paw Park
  Legend"** (5c, 500 GB). Reaching it also emits `endgame` once.

### 3.8 Academy v2 (starting values)
| id | name | stat | perLevel | max | baseCost | growth |
|---|---|---|---|---|---|---|
| foreman_pup | Foreman Pup | autoBuild | 1 | 1 | 10 | 1 |
| head_trainer | Head Trainer | autoTraining | 1 | 1 | 30 | 1 |
| volunteer_walkers | Volunteer Walkers | autoWhistle | 0.2 | 5 | 20 | 1.6 |
| retirement_planner | Retirement Planner | autoPrestige | 1 | 1 | 400 | 1 |
| bigger_jar | Bigger Treat Jar | offlineHours | 2 | 20 | 15 | 1.25 |
| bigger_mailbox | Bigger Mailbox | mailCapacity | 1 | 7 | 25 | 1.5 |
| squirrel_hound | Squirrel Hound | squirrelHound | 0.1 | 10 | 20 | 1.35 |
| squirrel_spotter | Squirrel Spotter | squirrelRate | 0.10 | 10 | 10 | 1.35 |
| epic_digging | Epic Digging | layRate | 0.05 | 50 | 5 | 1.18 |
| epic_kibble | Epic Kibble | findValue | 0.05 | 50 | 5 | 1.18 |
| spirit_bond | Spirit Bond | spiritPawBonus | 0.01 | 20 | 20 | 1.3 |
| legend_lore | Legend Lore | collarBonus | 0.01 | 10 | 50 | 1.45 |
| max_zoomies | Max Zoomies | maxZoomies | 5 | 10 | 8 | 1.35 |
| bargain_hunter | Bargain Hunter | researchDiscount | 0.05 | 10 | 15 | 1.4 |
| kennel_deals | Kennel Deals | kennelDiscount | 0.05 | 10 | 10 | 1.35 |
| fleet_deals | Fleet Deals | fleetDiscount | 0.05 | 10 | 10 | 1.35 |

New stat modes, all `add`: `mailCapacity`, `squirrelHound`, `autoWhistle`,
`autoBuild`, `autoTraining`, `autoPrestige`. `offlineRescue` is removed.

### 3.9 Prestige
- Same formula, re-tuned. `runTimeSec` (online plus offline) resets on prestige.
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

### Targets (AFK profile unless noted)
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
| Daily profile reaches Cosmic Bone | ≤ 1.5 × AFK days |
| Active profile reaches Cosmic Bone | ≥ 0.7 × AFK days (active play helps, but by no more than ~30%) |

The report has a milestone table with PASS/FAIL for each profile and a
per-day log for AFK (day, log10 income, paws, finds, GB, prestiges, Academy
levels). It needs `--profile`, `--days` and `--verbose` flags, and a full run
must finish in under 2 minutes.

## 6. Save migration
`version: 2`. `deserialize` accepts v1 and migrates it:
- `mailReady` becomes `mailCount` (1 or 0).
- `automation` gets its defaults: find on, the others on only if already
  unlocked, threshold 0.5.
- `runTimeSec` and `automationTimer` start at 0.
- Unknown Academy ids (`night_shift`) are dropped.
- The `SAVE_KEY` stays the same.
