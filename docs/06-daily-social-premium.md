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
| reward | 5 🦴 | 5 🦴 | 10 🦴 | 10 🦴 | 15 🦴 | Bacon Strip (free treat) | 20 🦴 + 5 ⭐ |

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
| whistle | Whistle up N pups | 150 | adopt(…, fromTap=true) |
| training | Buy N training levels | 15 | all training buys (manual + auto) |
| buildings | Upgrade N kennels or vehicles | 3 | all kennel/vehicle buys |
| earn | Earn N | `incomePerSec × 3600` at roll time (min $100) | income earned today |
| treat | Use a treat | 1 | buyTreat / free treat activation |
| zoomies | Hit max zoomies | 1 | zoomies reaching maxZoomies |

- Each completed Dig is claimed for **5 🦴**. Claiming all three
  (`claimDailyDigBonus`) gives **10 🦴 + 2 ⭐**.
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
- Thresholds are geometric, about ×10^0.25 per level (4 levels per order of
  magnitude), starting at $1K. That gives roughly 100–120 levels across the
  months-long game.
- The level **never goes down** (lifetime earnings survive prestige), so it's a
  safe brag.
- `PARK_TITLES` gives a title every 10 levels: Puppy Walker, Dog Sitter, Pack
  Walker, Kennel Keeper, Top Dog, Hound Master, Park Ranger, Canine Captain, Dog
  Mayor, Pup Tycoon, Galactic Alpha, Paw Park Legend.
- The balance agent re-fits the thresholds so level 100 ≈ the endgame for the
  AFK profile.

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
| 1 Bronze | $5 | +2% earnings, shop row 1 |
| 2 Silver | $20 | +4% earnings, +1 mailbox slot, shop row 2 |
| 3 Gold | $50 | +6% earnings, +2 h Treat Jar, shop row 3 |
| 4 Platinum | $100 | +8% earnings |
| 5 Diamond | $250 | +10% earnings, a profile badge in the share text 💎 |

The perks don't stack: each tier **replaces** the previous one, and they apply
through `computeStats`.

### 8.3 Kennel Club Shop (`PREMIUM_SHOP`, paid in ⭐, permanent)
`PremiumShopDef = UpgradeDef & { requiredTier: number }`. The cost formula is the
same as Academy's.

| id | name | stat | perLevel | max | baseCost ⭐ | growth | tier |
|---|---|---|---|---|---|---|---|
| star_kibble | Star Kibble | findValue | 0.05 | 5 | 100 | 1.5 | 0 |
| star_beds | Star Beds | layRate | 0.05 | 5 | 100 | 1.5 | 0 |
| star_jar | Star Treat Jar | offlineHours | 4 | 3 | 150 | 1.6 | 1 |
| star_mailbox | Star Mailbox | mailCapacity | 1 | 2 | 200 | 2 | 1 |
| star_hound | Star Hound | squirrelHound | 0.1 | 3 | 150 | 1.6 | 2 |
| star_spirit | Star Spirit | spiritPawBonus | 0.005 | 4 | 400 | 1.6 | 3 |

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
New bot profiles:
- **AFK+Daily (new primary):** the AFK profile, plus at its first check-in each
  day it claims the Daily Treat, does the Digs it can (whistle for 30 s,
  catches nothing) and claims what's done.
- **Daily:** gets the same daily behaviour.
- **Minnow** and **Whale**, as defined in §8.4.

The §5 timeline targets in `04` now apply to AFK+Daily. The Whale and Minnow
ratios from §8.4 are added, and the per-day log gets a Park Level column.
