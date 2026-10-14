# Paw Park v3 — Daily Ritual, Bragging Rights, Premium

Builds on `04-long-game-afk.md`. v2 made the game slow and self-playing. v3 gives
players a reason to open it **once a day**, something to **tell their friends
about** (outside the app), and an **optional paid shop** that speeds things up
**only slightly**.

---

## 1. Design goals

| Goal | Mechanism |
|---|---|
| Open it every day | Daily Treat with a streak, three Daily Digs, Park of the Day |
| A 2–5 minute session feels complete | Claim the treat, finish or claim Digs, open the mailbox, spend bones, check your level |
| Friends can compare progress | **Park Level** (one number) plus a title, the current Find, the streak, and a Wordle-style **share text** |
| Everyone talks about the same day | Daily Digs and Park of the Day are **seeded by the calendar date**, so every player gets the same ones |
| Paying helps, slightly | Premium currency **Pup Stars ⭐** → **Kennel Club Shop**. All paid effects together are hard-capped to **≤ 25% faster** to the end game for the biggest spender |
| Fair | No paid random rewards (no loot boxes). Every paid item says exactly what it does. Free players earn a trickle of Pup Stars too |

## 2. Day boundaries
- `dayKey` is the player's **local** calendar date, `'YYYY-MM-DD'`. The UI
  computes it with `dayKeyOf(new Date())`. Engine functions take `dayKey` as a
  parameter, so the engine stays pure and testable.
- `dayDiff(a, b)` is the number of whole calendar days between two keys.
- Anti-rewind: if `dayKey` is earlier than `daily.lastSeenDay`, daily actions do
  nothing (they return `{ok:false}`). Otherwise `lastSeenDay` is updated.

## 3. Daily Treat (login streak)
`claimDailyTreat(state, dayKey)` works once per `dayKey`:
- If `lastClaimDay` is yesterday, `streak + 1`.
- If the gap is 2+ days and `streakFreezes ≥ gap − 1`, it uses those freezes and
  does `streak + 1`.
- Otherwise `streak = 1`.
- `bestStreak = max(bestStreak, streak)`.
- The reward is `DAILY_TREATS[(streak − 1) % 7]`:

| day | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| reward | 3 🦴 | 3 🦴 | 5 🦴 | 5 🦴 | 8 🦴 | Bacon Strip (free treat) | 10 🦴 + 20 ⭐ |

A milestone bonus at streak 30, 100 and 365 gives +25 ⭐ each time (once per
milestone, ever).

## 4. Daily Digs (3 shared daily goals)
`refreshDaily(state, dayKey)` is called on boot, on visibility return, and every
60 s. When `daily.digsDay !== dayKey`, it picks 3 **distinct** goal kinds from
`DAILY_DIG_POOL` using `seededRng(hash(dayKey))`. So every player in the world
gets the same 3 kinds that day. It resets `daily.counters`, sets targets, and
also sets `daily.modifierId` (§5).

| kind | text | target | counted from |
|---|---|---|---|
| squirrels | Catch N squirrels | 3 | manual + hound catches |
| letters | Open N letters | 4 | openMail / openAllMail |
| whistle | Whistle up N pups | 50 | adopt(…, fromTap=true) |
| training | Buy N training levels | 15 | all training buys (manual + auto) |
| buildings | Upgrade N kennels or vehicles | 3 | all kennel/vehicle buys |
| earn | Earn N | `incomePerSec × 3600` at roll time (min $100) | income earned today |
| treat | Use a treat | 1 | buyTreat / free treat activation |
| zoomies | Hit max zoomies | 1 | zoomies reaching maxZoomies |

- Each completed Dig is claimed for **3 🦴**. Claiming all three
  (`claimDailyDigBonus`) gives **6 🦴 + 5 ⭐**.
- Counters only count events on the current `digsDay`, and offline time does
  count. All values live in `src/data/daily.ts`.

## 5. Park of the Day (shared modifier)
Seeded from the same `dayKey`. One entry is picked from `DAILY_MODIFIERS`, a
small positive tweak that everyone gets:

| id | name | effect |
|---|---|---|
| fetch_fest | Fetch Fest | findValue ×1.15 |
| dig_day | Dig Day | layRate ×1.15 |
| squirrel_storm | Squirrel Storm | squirrelRate ×2 |
| express_day | Express Day | shippingCapacity ×1.2 |
| cozy_kennels | Cozy Kennels | kennelCapacity ×1.1 |
| lucky_paws | Lucky Paws | earnings ×1.1 |
| mail_rush | Mail Rush | mailRate ×2 |

It's stored as `daily.modifierId` and applied in `computeStats` as one more
multiplicative source. New mult stats: `earnings` (multiplies `incomePerSec` and
`parkValue`) and `mailRate` (divides `MAIL_INTERVAL_SEC`).

## 6. Park Level (the number friends compare)
- `parkLevel(lifetimeEarnings)` = the number of entries in
  `PARK_LEVEL_THRESHOLDS` that are ≤ lifetimeEarnings (minimum 1).
- The thresholds are **fitted to the AFK+Daily bot, not geometric**
  (`npm run balance -- --fit` prints them). Early game earnings grow ~×10 per
  hour and later ~×10 per month, so a geometric curve would put 50+ levels in
  week 1. Instead each level gets a target *day* and the threshold is the
  smoothed lifetime earnings of the bot on that day. Day anchors (sim days from
  the first launch at 18:00): Lv 2 ≈ 1 min … Lv 20 ≈ 10 h (geometric ×3.3 per
  level from $2.5K), Lv 40 = day 13, Lv 70 = day 48, Lv 100 = the Cosmic Bone
  day, linear in days between anchors. Levels 101–120 continue at ×10^0.15 each.
- The level **never goes down** (lifetime earnings survive prestige), so it's a
  safe brag.
- `PARK_TITLES` gives a title every 10 levels (11 titles): Puppy Walker (1–9),
  Dog Sitter (10), Pack Walker (20), Kennel Keeper (30), Top Dog (40), Hound
  Master (50), Park Ranger (60), Canine Captain (70), Dog Mayor (80), Pup Tycoon
  (90), **Paw Park Legend (100 = endgame)**. 'Galactic Alpha' was removed so the
  last title lands on the Cosmic Bone; it still exists as a trophy name.
- Re-fit the thresholds after every change to find gates, rewards or modifiers
  (the recipe is in §10).

## 7. Share text (talk about it outside the app)
`shareText(state, dayKey)` returns plain text with emoji, Wordle style:
```
🐾 Paw Park — Lv 47 · Park Ranger
🦕 Dino Fossil · 🔥 12-day streak
🐾 3.4M Spirit Paws · 🏆 14/23
📅 Oct 14 Daily Digs: ✅✅⬜
```
The UI's **Share** button uses `navigator.share` when it's available, otherwise
it copies to the clipboard. No accounts, no server, no in-app social.

## 8. Premium: Pup Stars ⭐ and the Kennel Club

### 8.1 Products (`src/data/premium.ts → PRODUCTS`)
| id | stars | price |
|---|---|---|
| stars_s | 100 | $0.99 |
| stars_m | 550 | $4.99 |
| stars_l | 1,200 | $9.99 |
| stars_xl | 2,600 | $19.99 |
| stars_xxl | 7,000 | $49.99 |
| stars_max | 15,000 | $99.99 |

`grantPurchase(state, productId, receiptId)` adds the stars and adds `priceCents`
to `premium.spendCents`. It **ignores a duplicate `receiptId`** (the receipt ids
are stored). This is the only way paid stars enter the game.

### 8.2 Kennel Club tiers (based on lifetime spend)
| tier | spend ≥ | perk |
|---|---|---|
| 0 None | $0 | — |
| 1 Bronze | $5 | +1% earnings, shop row 1 |
| 2 Silver | $20 | +2% earnings, +1 mailbox slot, shop row 2 |
| 3 Gold | $50 | +3% earnings, +2 h Treat Jar, shop row 3 |
| 4 Platinum | $100 | +4% earnings |
| 5 Diamond | $250 | +5% earnings, a profile badge in the share text 💎 |

The perks don't stack: each tier **replaces** the previous one, and they apply
through `computeStats`.

### 8.3 Kennel Club Shop (`PREMIUM_SHOP`, paid in ⭐, permanent)
`PremiumShopDef = UpgradeDef & { requiredTier: number }`. The cost formula is the
same as Academy's.

| id | name | stat | perLevel | max | baseCost ⭐ | growth | tier |
|---|---|---|---|---|---|---|---|
| star_kibble | Star Kibble | findValue | 0.03 | 5 | 100 | 1.5 | 0 |
| star_beds | Star Beds | layRate | 0.03 | 5 | 100 | 1.5 | 0 |
| star_jar | Star Treat Jar | offlineHours | 4 | 3 | 150 | 1.6 | 1 |
| star_mailbox | Star Mailbox | mailCapacity | 1 | 2 | 200 | 2 | 1 |
| star_hound | Star Hound | squirrelHound | 0.03 | 3 | 150 | 1.6 | 2 |
| star_spirit | Star Spirit | spiritPawBonus | 0.002 | 4 | 400 | 1.6 | 3 |

Consumables, paid in ⭐:
- **Streak Freeze**: 60 ⭐, hold at most 2.
- **Treats**: each `TreatDef` gets a `starCost`, and `buyTreat(state, id, 'stars')`
  buys it with stars instead of bones.

### 8.4 Hard cap on paid advantage (a design rule the balance pass must check)
- The biggest spender ("Whale": Diamond tier, everything in the shop maxed,
  a Bacon Strip every day bought with stars) reaches Cosmic Bone in **≥ 0.75×**
  the AFK profile's days.
- A small spender ("Minnow": $4.99 on day 0) gets **≥ 0.92×**.
- Free stars (streak day 7, the Dig bonus, streak milestones) let a dedicated
  free player buy about 1–2 cheap shop levels a month.
- Measured by `npm run balance` (§11): Whale 0.77–0.78×, Minnow ≈ 1.0×. The
  Whale is the binding case. Squirrel bones (Star Hound) and the shop's
  ×find/×dig multipliers compound through prestige, so the perks had to be cut
  hard (Hound 0.1 → 0.03, Kibble/Beds 0.05 → 0.03, VIP 10% → 5%, Spirit 0.005
  → 0.002 per level) to get under 25%.

### 8.5 Payments architecture
```
src/ui/payments/PaymentProvider.ts   interface { listProducts(); purchase(productId) → {receiptId} }
src/ui/payments/MockProvider.ts      TEST MODE: confirm dialog, fake receipt ids, no money
(later) StripeProvider / AppStoreProvider / PlayBillingProvider
```
- The engine never knows about money providers. The UI calls `grantPurchase`
  after the provider confirms.
- The store UI shows a visible **TEST MODE** banner while the mock provider is
  in use.
- **Before real money (not built yet):** a backend has to verify receipts
  (Stripe webhook / App Store / Play receipt validation) and grant stars on the
  server. Today the client-side save can be edited, which is acceptable only in
  test mode. iOS and Android builds must use the platform's IAP for digital
  goods. A spend limit or confirmation step for minors should be considered.

## 9. Contract changes (`types.ts`, version 3)
- `GameState.version: 3`.
- New `daily` field:
  `{ lastSeenDay, lastClaimDay, streak, bestStreak, streakFreezes, streakMilestones: number[], digsDay, digs: DailyDig[], digBonusClaimed, modifierId, counters: DailyCounters }`.
- New `premium` field: `{ stars, spendCents, receipts: string[], shop: Record<string, number> }`.
- New stats `earnings` and `mailRate` (both mult).
- `DerivedStats` gains `parkLevel`, `parkTitle`, `vipTier`, `modifier`.
- New events: `dailyDigComplete`, `streakMilestone`.
- Migration v2 → v3 adds the defaults.

## 10. Balance v3
Bot profiles (`scripts/balance.ts`, `npm run balance [-- --profile
afkdaily|afk|daily|active|minnow|whale|all --seed N --verbose --fit]`). Daily
behaviour = `refreshDaily(state, dayKey)` at every check-in (the day key comes
from the sim clock), `claimDailyTreat` at the first check-in of each local day,
a 30 s whistle (`HOLD_ADOPT_PER_SEC`, `fromTap`) in that first check-in, and
`claimDailyDig` / `claimDailyDigBonus` for whatever is done at the end of each
check-in. Free stars buy the cheapest available shop level.
- **AFK+Daily (primary):** AFK check-ins (08:00, 12:30, 18:00, 22:30, 3 min)
  plus the daily behaviour.
- **AFK (info):** the old v2 bot, never calls `refreshDaily`, so there's no
  Park of the Day and no daily rewards.
- **Daily:** one 5-minute check-in at 20:00 plus the daily behaviour.
- **Active:** the v2 Active bot plus the daily behaviour.
- **Minnow:** AFK+Daily + `stars_m` on day 0, spends stars greedily (cheapest
  first).
- **Whale:** AFK+Daily + purchases on days 0–6 (`stars_max`+`stars_s` on day 0,
  `stars_max` day 2, `stars_xxl` day 4 = $250.96, Diamond), shop bought in value
  order as soon as affordable, a Bacon Strip with stars at **both** evening
  check-ins (18:00 and 22:30, else bones), and 2 Streak Freezes once the shop is
  maxed.

The §5 timeline targets in `04` apply to AFK+Daily. The ratios in §8.4 are
measured against its Cosmic Bone day. The per-day log has a **ParkLv** and a
stars column. A change to any of the gates, daily bones, modifiers or shop
needs this loop:
1. Re-run `npm run balance`. If the AFK+Daily milestones moved, re-calibrate
   `FINDS[k].unlockParkValue` for k = 5…12 in order (bisect `log10(gate)` with
   `--hold k --stop k --gates "k:v" --json` so that find k lands on its target
   day).
2. Re-run with `--fit` and paste the printed `PARK_LEVEL_THRESHOLDS` into
   `src/data/daily.ts`.
3. Check the Whale (≥ 0.75) on a few `--seed`s: single runs vary by ±0.03.

## 11. Balance results
Seed 12345, full run (`--profile all`) ≈ 41 s. Bone flow and Park of the Day
change pacing a lot (the pure-AFK bot with no daily ritual now needs 141 days,
because every daily source is missing; see "AFK (info)"), so **find gates 5–12
were re-calibrated** to AFK+Daily and the daily bones were halved from the first
draft (treat 3/3/5/5/8/bacon/10, Dig 3, bonus 6) to keep the Retirement Planner
on day ≥ 10 (its cost went 500 → 600 🦴).

### 11.1 AFK+Daily (primary)
| Milestone | Result | Target |
|---|---|---|
| Tennis Ball | 5.8 min | ≤ 10 min |
| Squeaky Toy | 9.1 min | ≤ 45 min |
| Rawhide | 4.5 h | day 0–1 |
| First prestige | 4.5 h | day 0–1 |
| Lost Wallet | day 2.0 | 1–3 |
| Pirate Coin | day 5.2 | 4–8 |
| Dino Fossil | day 12.6 | 9–16 |
| Crystal Bone | day 25.2 | 17–28 |
| Meteorite | day 30.0 | 29–42 |
| Ancient Relic | day 51.6 | 43–58 |
| Moon Rock | day 62.6 | 59–75 |
| Time Bone | day 85.6 | 76–95 |
| **Cosmic Bone** | **day 110.6** | **95–125** |
| Retirement Planner bought | day 11.2 | 10–20 |
| Longest drought | 1.81 d @ day 94.8 | ≤ 3 d |
| Longest Academy drought | 1.81 d | ≤ 2 d |
| Free ⭐ earned by day 30 | 115 | ~100–300 |

Everything passes. Free stars: 115 by day 30 (4 × 20 from streak-day-7 bundles,
25 from the day-30 milestone, a few Dig bonuses), 370 by the endgame, which
buys 1 Star Kibble/Beds level at 100 ⭐ in the first month and 3–4 more later.

### 11.2 All profiles
| Profile | Cosmic Bone | ratio to AFK+Daily | cap | mean of seeds 1–4 |
|---|---|---|---|---|
| AFK+Daily | day 110.6 | 1.00 | day 95–125 | n/a |
| AFK (no dailies, info) | day 141.0 | 1.28 | none | n/a |
| Daily (1 check-in) | day 155.1 | 1.40 | ≤ 1.5 | 1.39 (1.31–1.48) |
| Active | day 91.2 | 0.82 | ≥ 0.70 | 0.86 |
| Minnow ($4.99) | day 116.0 | 1.05 | ≥ 0.92 | 1.00 |
| Whale ($250.96) | day 86.6 | 0.78 | ≥ 0.75 | 0.77 (0.76–0.78) |

Per-find days (seed 12345):
| Find | AFK+Daily | Daily | Active | Minnow | Whale |
|---|---|---|---|---|---|
| Lost Wallet | 2.0 | 3.1 | 1.6 | 1.6 | 1.2 |
| Pirate Coin | 5.2 | 8.1 | 6.0 | 5.2 | 3.6 |
| Dino Fossil | 12.6 | 24.1 | 9.6 | 11.8 | 10.6 |
| Crystal Bone | 25.2 | 31.1 | 17.0 | 22.6 | 17.0 |
| Meteorite | 30.0 | 47.1 | 26.8 | 29.8 | 22.2 |
| Ancient Relic | 51.6 | 65.1 | 35.6 | 44.2 | 33.0 |
| Moon Rock | 62.6 | 81.1 | 47.6 | 58.8 | 41.2 |
| Time Bone | 85.6 | 105.1 | 64.6 | 82.6 | 62.6 |
| Cosmic Bone | 110.6 | 155.1 | 91.2 | 116.0 | 86.6 |

The Whale margin is thin (0.76–0.78). The Minnow is as fast as a free player
within noise: $4.99 is cosmetic-sized, as intended.

### 11.3 Park Level curve (AFK+Daily)
| day | 1 | 3 | 7 | 14 | 21 | 30 | 50 | 75 | 100 | 107 |
|---|---|---|---|---|---|---|---|---|---|---|
| Park Level | 20 | 23 | 30 | 40 | 46 | 53 | 70 | 83 | 95 | 100 |

Lv 100 on day 107.2 vs the Cosmic Bone on day 110.6 (±5 target). Titles read:
Pack Walker on day 1, Top Dog on day 14, Hound Master ≈ day 25, Park Ranger ≈
day 36, Canine Captain ≈ day 50, Dog Mayor ≈ day 70, Pup Tycoon ≈ day 91, Paw
Park Legend at the endgame. The curve gives ~0.8 levels/day from week 2 to week
7, then ~0.5/day to the end: the level number never stalls for more than a few
days.

### 11.4 Data changes in this pass
| file | change | why |
|---|---|---|
| `daily.ts` DAILY_TREATS | 5/5/10/10/15/bacon/20+5⭐ → 3/3/5/5/8/bacon/10+20⭐ | bones sped the Academy too much; stars moved to the free-star trickle |
| `daily.ts` | Dig reward 5 → 3 🦴, bonus 10 → 6 🦴 and 2 → 5 ⭐, whistle target 150 → 50 | same; 150 pups can't be whistled in 30 s from a 50-pup adoption stock |
| `daily.ts` | modifier multipliers unchanged | Park of the Day alone is worth ≈ −8% days; kept as designed |
| `daily.ts` PARK_LEVEL_THRESHOLDS / PARK_TITLES | re-fit, 120 levels, 11 titles | §6 |
| `academy.ts` retirement_planner | baseCost 500 → 600 | Planner was on day 7–9 with the daily bones |
| `finds.ts` gates 5–12 | 1.1e20→1.62e20, 1e23→1.11e23, 3.3e24→3.6e24, 6e25→5.88e25, 6.6e26→9.78e26, 1.1e28→1.78e28, 3.1e29→4.64e29, 6e30→1.58e31 | re-calibrated to the AFK+Daily pacing |
| `premium.ts` VIP earnings | 2/4/6/8/10% → 1/2/3/4/5% | Whale cap |
| `premium.ts` shop | Kibble/Beds 0.05 → 0.03, Hound 0.1 → 0.03, Spirit 0.005 → 0.002 per level | Whale cap (the squirrel Hound compounds through bones) |
