# Paw Park v4 — Find Eras (the Egg, Inc. loop, faithfully)

This doc overrides `02`, `04` and `06` wherever they conflict on Find upgrades,
costs, and prestige.

## 1. What Egg, Inc. actually does (and what we had wrong)

| | Egg, Inc. | Paw Park v1–v3 | Paw Park v4 |
|---|---|---|---|
| Moving to the next egg / Find | Gated by **farm value**. The farm **restarts** on the new egg, which is worth more | Gated by park value, but the park **was kept** | Gated by park value, and the park **restarts** on the new Find |
| Upgrades on the new egg | The **same** habs, vehicles and research again, and **harder** to complete | n/a | The same Kennels, Fleet and Training, priced × the Find's `costScale` |
| Prestige | Back to the **first egg**, plus Soul Eggs from the cash earned this prestige | Back to Stick, plus Spirit Paws from `runEarnings` | Same as before: back to Stick, plus Spirit Paws from everything earned across every Find this prestige |
| Permanent | Soul Eggs, Prophecy Eggs, Golden Eggs, Epic Research | Spirit Paws, Collars, Bones, Academy | unchanged (plus stars, daily, automation settings) |
| Hab / vehicle price | Rises with how many of the **same tier** you already own | flat per tier | Rises per duplicate of the same tier (§3.3) |

Sources: the Egg, Inc. community wiki pages on Prestige, Habitats, Vehicles and
Farm Value, and Wikipedia. "Research costs rise per egg" comes from the
designer's own description of the game; the wiki pages don't spell it out.

## 2. The loop, in one picture

```
PRESTIGE (Spirit Paws ↑) ─────────────────────────────────────────────┐
  │                                                                    │
  ▼                                                                    │
 Stick era ──park value gate──► Tennis Ball era ──gate──► … ──► Cosmic Bone era
  build kennels/fleet/training   RESTART: same shop list, prices ×costScale,
  from scratch                   Find worth ×~5. Each era is a slightly harder
                                 repeat of the last. The final gates need
                                 Spirit Paws, so you prestige ─────────┘
```

- **Era** is the player-facing word for "the park while on Find k". The UI
  says "Tennis Ball Era".
- **Each era is a familiar mini-game.** It's the same ~40 purchases and the
  same build order, with bigger numbers and slightly worse value for money.
  Players learn the loop once and then optimise it.
- **Harder each era:** `value_k / costScale_k` falls slowly as k rises. Early
  eras feel generous (cost scale below the value jump), and late eras need a
  bigger Spirit Paw bonus to clear the next gate in reasonable time. That
  produces the Egg, Inc. wall where prestige becomes the answer.

## 3. Rules

### 3.1 Upgrading the Find ("Start the Tennis Ball Era")
This is allowed when `parkValue ≥ next.unlockParkValue`, as before. It resets:
- `cash → ERA_START_CASH × costScale_next`, a small stake so the first doghouse
  and bike can be bought at once.
- `pups → 0`, adoption stock → cap, `kennels → [0, null, null, null]`,
  `vehicles → [0, null…]`, `training → {}`, `zoomies → 0`.
- Active squirrels stay, mail and treats are untouched.

It keeps everything else: `runEarnings` (so Spirit Paw progress continues
across eras), `runTimeSec`, `lifetimeEarnings`, and all permanent and meta
state. `findIndex += 1`. A first-time-ever Find still pays its Golden Bone
reward.

The manual upgrade needs a **confirm step** in the UI ("Your park restarts
with Tennis Balls worth 5× more. Kennels, fleet, training and cash reset. You
keep Spirit Paws, Golden Bones and the Academy.").

Automation's **find** key does it automatically. That stays sensible because
a new era is always better once its gate is met, which is also true in
Egg, Inc.

### 3.2 Era cost scaling
Each `FindDef` gets `costScale: number`, with Stick at 1.
- Every **cash** price is multiplied by `costScale[findIndex]` before the
  existing discounts: training levels, kennel tiers and vehicle tiers.
- Golden Bones, Stars and Academy prices are **not** scaled.
- The starting shape is `costScale_k ≈ value_k / value_0 × HARDNESS^k`, with
  `HARDNESS ≈ 1.6`. The balance pass tunes it, as one number per Find in
  `src/data/finds.ts`.

### 3.3 Duplicate-tier pricing (Egg, Inc. habs and vehicles)
The price of tier `t` in any slot is
`base_t × DUPLICATE_GROWTH^(n)`, where `n` is how many **other** slots already
hold tier `t` or higher. Start with `DUPLICATE_GROWTH = 1.35` (tunable in
`constants.ts`). It applies to both kennels and vehicles, and it makes
"upgrade the other slots too" a real cost rather than a formality.

### 3.4 Spirit Paws (unchanged formula, new meaning)
`gain = floor((runEarnings / PRESTIGE_DIVISOR) ^ PRESTIGE_EXPONENT)`.
`runEarnings` now sums every era of this prestige, so climbing more eras
before prestiging pays more. The HUD shows **"+N 🐾 on prestige"** live, the
way Egg, Inc. shows Soul Eggs to collect.

### 3.5 Park value and gates
The park value formula is unchanged. Gates are re-fitted by the balance pass:
a gate is reached late in its era, after a near-full rebuild. Era length at a
fixed bonus should **rise gently**, with each era's rebuild taking roughly
1.1–1.5× the previous one.

## 4. Contract changes (`types.ts`, version 4)
- `FindDef.costScale: number`.
- New constants: `ERA_START_CASH`, `DUPLICATE_GROWTH`.
- `DerivedStats.costScale: number` is the current era's scale, for the UI.
- `upgradeFind` performs the era reset (§3.1). No new state fields.
- The save version goes to 4. Migration only bumps the version, because v3
  saves already sit on a valid Find and keep their park.

## 5. UI
- **Find upgrade:** a confirm modal listing what resets and what's kept, the
  new Find's value multiplier, and the cost scale ("prices ×6").
- **HUD:**
  - An era label ("🎾 Tennis Ball Era").
  - "+N 🐾 on prestige" next to the paws chip.
  - The goal bar keeps showing progress to the next era.
- **Shop panels** show prices already scaled. A small "Era prices ×N" note sits
  in Training, Kennels and Fleet.
- The prestige card explains the loop: "Back to the Stick Era with +N Spirit
  Paws (+X% earnings)".
- The Welcome Back report lists eras reached while away, using the existing
  `findsUnlocked`.

## 6. Balance v4 targets
The `docs/06` §10 profiles and the §5 timeline stay: AFK+Daily reaches Cosmic
Bone in **95–125 days**, and all ratios and caps are unchanged. Added:
- **Era 1 (Stick → Tennis):** 3–8 min. **Era 2:** 8–20 min. First-day play
  reaches Squeaky or Rawhide and the first prestige.
- **Era length:** at a fixed Spirit Paw bonus, each era's rebuild-to-gate time
  is within 1.0–1.8× the previous era's (smooth "harder each era").
- **Prestige rhythm:** median prestige interval about 1 day in week 1, growing
  to 3–7 days late game. Report the distribution.
- **Eras per prestige:** a player usually climbs 2–4 eras past their previous
  best before a prestige pays off. Report the distribution.
