# Egg, Inc. — Systems Teardown

How Egg, Inc. (Auxbrain, 2016) works under the hood. This is a reverse-engineering
of the *design*, not the code: what each system does, how the systems feed each
other, and why the loop is satisfying. Numbers are approximate. They come from
public play knowledge and are meant to show orders of magnitude and curve shapes.
Paw Park takes these ideas, not exact values.

---

## 1. The core loop in one picture

```
 tap / hold ──► HATCHERY ──► CHICKENS ──► EGGS/sec ──► SHIPPING ──► $$$ ──┐
   (active)     (stock,      (live in     (lay rate    (vehicle     (egg   │
                 refill)      HABS, cap)   × count)     cap/min)    value  │
                    ▲             ▲            ▲            ▲       × bonus)│
                    │             │            │            │              │
                    └─────────────┴────────────┴────────────┴── spend ◄────┘
                                RESEARCH / HABS / VEHICLES
```

At any moment, earnings are limited by the **narrowest pipe** of the three:

1. **Population.** Hatchery stock and hab capacity limit how many chickens you have.
2. **Production.** Chickens × lay rate gives eggs/sec.
3. **Logistics.** Shipping capacity caps how many of those eggs are sold. Extra eggs
   are wasted.

`income/sec = min(eggs laid/sec, shipping/sec) × egg value × multipliers`

Most of the game's "decisions" come from this `min()`. The player keeps finding
the current bottleneck (habs full? trucks maxed?) and widening it. That is the
whole active-play skill, and it is simple to read.

## 2. Systems

### 2.1 Hatchery (active input)
- There's a big button. A tap hatches 1 chicken, and holding it hatches continuously.
- The hatchery has a **stock** (a capacity of a few dozen) that **refills** over
  time. You can't spam forever, so active play comes in bursts.
- Research raises both the stock capacity and the refill rate.
- **Internal hatchery**: research that adds chickens/min per hab with no tapping.
  This is the passive population source, and it's what makes the game idle.

### 2.2 Running Chicken Bonus (the "juice" mechanic)
- Hatching quickly builds a combo counter ("running chickens"). Each one adds a
  percentage to earnings, up to a cap.
- The counter decays fast when you stop. It rewards an active session with a
  visible multiplier and makes holding the button feel strong.

### 2.3 Habs (population cap)
- 4 hab slots. Each slot is upgraded through ~19 tiers (Coop 250 → Chicken
  Universe 600M). Capacity roughly ×2–×2.5 per tier, and cost goes up ~×7–×10.
- Upgrades are per slot, one tier at a time. That gives a steady stream of
  mid-sized purchases.
- Research adds a % to hab capacity.

### 2.4 Laying
- Base lay rate per chicken is small. Research multiplies it heavily
  (Comfortable Nests, Hen House AC, Time Compression, …).
- Each research item adds linearly per level (+10%/level). Different items
  multiply with each other, so the result compounds into very large multipliers.

### 2.5 Shipping (logistics cap)
- Vehicle slots (4 base, more through research, max ~17). Each slot is upgraded
  through tiers (Trike → … → Hyperloop).
- Vehicle capacity is eggs/min, raised by research.
- This is the second constraint. You must keep it above lay rate or you waste output.

### 2.6 Egg types (value ladder / "eras")
- Edible → Superfood → Medical → Rocket Fuel → … → Universe egg. Each step is
  ~×4–5 in value.
- Each next egg unlocks when **Farm Value** passes a threshold. Upgrading
  **restarts the farm** on the new egg: you rebuild with the same habs,
  vehicles and research, at higher prices, but each egg sells for much more.
  (This doc said earlier that upgrading keeps the farm. That was wrong; see
  `08-find-eras.md`.)
- Each egg is a mini-era with new visuals and a new milestone, which keeps the
  sense of progress going.

### 2.7 Farm Value
- A valuation of your farm, mostly driven by sustainable income/sec (plus
  population and assets). It does two jobs: it gates egg upgrades, and it shows
  "how good is this run".

### 2.8 Common research (the main spend)
- About 100 items in **tiers**. A tier unlocks after you buy a number of research
  levels in total. This gradually reveals complexity.
- Each item has a max level. Cost grows geometrically per level.
- Categories: egg value, lay rate, hab capacity, shipping, hatchery, internal
  hatchery, running-chicken bonus, drone rewards.
- All of it resets on prestige.

### 2.9 Prestige (Soul Eggs + Prophecy Eggs)
- **Soul Eggs (SE)** are earned based on run earnings, with diminishing returns
  (a power curve). Each SE gives +10% earnings permanently (the base).
- **Prophecy Eggs (PE)** are rare. They come from contracts and trophies, and
  each one **compounds** the SE bonus by ×1.05.
- `earnings_bonus = 1 + SE × (0.10 + epic) × (1.05 + epic)^PE`
- Prestiging resets the farm (cash, chickens, habs, vehicles, common research,
  egg type) and keeps SE, PE, golden eggs, and epic research.
- Each run gets faster than the last, so the player re-climbs a ladder they
  already know at higher speed. That repeat is the long-term hook.

### 2.10 Golden Eggs + Epic Research (meta currency)
- Golden eggs come from drones, gifts, trophies, contracts, and IAP.
- They buy **Epic Research**: permanent upgrades that survive prestige (more max
  running chickens, longer silo time, bigger SE bonus, cheaper research, …).
- They also buy **Boosts**: temporary multipliers (×2–×10 earnings, lay rate, or
  hatch rate for 10–60 min).

### 2.11 Random interrupts (attention hooks)
- **Drones** fly across the screen. Tap one for cash (a few minutes of income)
  or sometimes golden eggs. The rewards scale with income, so they stay relevant.
- **Gifts** show up on a timer and give golden eggs, cash, or boosts.
- Both pull the player's eye back to a screen that would otherwise be passive.

### 2.12 Offline progress (Silos)
- While the game is closed, the farm keeps earning at its last rate, limited by
  **silo capacity** (hours of storage, raised with golden eggs).
- On return there's a "welcome back, you earned $X" screen. That gives the player
  a reason to come back and an immediate reward.

### 2.13 Systems we're deliberately skipping (v1)
Contracts/co-op, artifacts/ships, IAP, ads, multiplayer. They add depth and
social features but aren't needed for the core idle loop. Paw Park lists "Dog
Shows" (contracts) as a v2 extension point.

## 3. Why it works (design principles we keep)

| Principle | Mechanism in Egg Inc |
|---|---|
| **Always a next purchase** | Hundreds of small research levels, plus habs and vehicles at staggered prices |
| **One readable bottleneck** | `min(laid, shipped)` + hab capacity bar |
| **Exponential numbers, linear feel** | Value ~×5 per era, costs ~×7–10 per tier, suffix formatting (K, M, B, T, q, Q…) |
| **Active play rewarded, never required** | Hatchery + running bonus vs internal hatchery + offline earnings |
| **Eras** | Egg types reset what "a lot of money" means |
| **Prestige compounding** | SE power curve × PE compounding gives each run faster than the last |
| **Interrupts** | Drones and gifts pull attention on a schedule |
| **Permanent meta** | Epic research and golden eggs carry across prestige |

## 4. The math model we're reproducing

```
pop        ≤ Σ hab_capacity(slot) × Π(1 + habResearch_i)
lay/s      = pop × base_lay × Π(1 + layResearch_i) × boosts
ship/s     = Σ vehicle_cap(slot)/60 × Π(1 + shipResearch_i)
sold/s     = min(lay/s, ship/s)
value      = egg_base_value × Π(1 + valueResearch_i)
bonus      = (1 + SE × seBonus × peBonus^PE) × (1 + running × perRunning) × boosts
income/s   = sold/s × value × bonus
SE_gain    = floor((run_earnings / K)^p)      // p ≈ 0.15–0.5 power curve
```

Paw Park keeps this structure exactly. See `02-paw-park-design.md`.
