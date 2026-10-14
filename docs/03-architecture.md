# Paw Park — Architecture & Build Contract

Stack: **TypeScript (strict) + Vite + Vitest**, no UI framework. DOM for the panels
and a `<canvas>` for the park scene. Emoji are the art, so there are no asset files.

## 1. Layering

```
src/data/   content tables + constants (pure data, no logic)
   ▲
src/core/   engine: pure, deterministic, DOM-free, testable in Node
   ▲
src/ui/     DOM + canvas; owns the game loop; only talks to core via src/core/index.ts
   ▲
src/main.ts bootstrap
```

Rules:
1. `src/core` and `src/data` **never** import from `src/ui` or touch `window`,
   `document`, or `localStorage` directly. Storage is passed in (see `save.ts`).
2. The UI **never** mutates `GameState` fields directly. It only calls core actions.
   It may read state and `computeStats(state)` freely.
3. All randomness in core goes through an injectable `rng: Rng` param (defaults to
   `Math.random`) so tests are deterministic.
4. All tunable numbers live in `src/data/*`.

## 2. File map

```
src/core/types.ts        (provided — the contract)
src/core/stats.ts        statMode, statValue(state, stat), computeStats(state)
src/core/state.ts        createInitialState(now), resetForPrestige(state)
src/core/actions.ts      all player actions (see API)
src/core/tick.ts         tick(state, dt, rng)
src/core/offline.ts      applyOfflineProgress(state, now)
src/core/save.ts         serialize/deserialize/save/load/export/import
src/core/format.ts       number/money/duration formatting
src/core/index.ts        barrel re-export of everything public below
src/data/constants.ts    §5 constants + STAT_MODES
src/data/kennels.ts      KENNELS: KennelTierDef[]
src/data/vehicles.ts     VEHICLES: VehicleTierDef[]
src/data/finds.ts        FINDS: FindDef[]
src/data/training.ts     TRAINING_TIERS: TrainingTierDef[], TRAINING: TrainingDef[]
src/data/academy.ts      ACADEMY: AcademyDef[]
src/data/treats.ts       TREATS: TreatDef[]
src/data/trophies.ts     TROPHIES: TrophyDef[]
src/data/index.ts        barrel
tests/*.test.ts          vitest, engine only
scripts/balance.ts       headless greedy-bot simulation (run with `npm run balance`)
src/ui/**                UI (see §4)
src/main.ts, index.html, src/style.css
```

## 3. Engine public API (`src/core/index.ts`) — exact signatures

```ts
// state
createInitialState(now: number): GameState
resetForPrestige(state: GameState): void            // used by prestige(); exported for tests

// derived
statMode(stat: Stat): StatMode
statValue(state: GameState, stat: Stat): number     // M(stat) for mult (≥1-ish), A(stat) for add
computeStats(state: GameState): DerivedStats

// simulation
tick(state: GameState, dt: number, rng?: Rng): GameEvent[]
applyOfflineProgress(state: GameState, now: number): OfflineReport | null  // null if < 5 s

// adopt
adopt(state: GameState, n: number, fromTap: boolean): number      // returns pups actually adopted

// costs (null = maxed / not available)
kennelUpgradeCost(state: GameState, slot: number): number | null
vehicleUpgradeCost(state: GameState, slot: number): number | null
trainingCost(state: GameState, id: string): number | null         // next level
trainingMaxBuy(state: GameState, id: string): { levels: number; cost: number }  // affordable now
academyCost(state: GameState, id: string): number | null
isTrainingTierUnlocked(state: GameState, tier: number): boolean
nextFind(state: GameState): FindDef | null

// purchases / actions (mutate state; never throw on player error)
buyKennel(state: GameState, slot: number): ActionResult
buyVehicle(state: GameState, slot: number): ActionResult
buyTraining(state: GameState, id: string, levels?: number): ActionResult   // levels default 1; Infinity = max
buyAcademy(state: GameState, id: string): ActionResult
upgradeFind(state: GameState): ActionResult
buyTreat(state: GameState, id: string): ActionResult
catchSquirrel(state: GameState, squirrelId: number): RewardResult | null
openMail(state: GameState, rng?: Rng): RewardResult | null
prestige(state: GameState): ActionResult & { gained?: number }

// persistence (storage param is a Storage-like {getItem,setItem,removeItem})
serialize(state: GameState): string
deserialize(json: string): GameState | null
saveGame(state: GameState, storage: StorageLike, now: number): void       // sets lastSaved
loadGame(storage: StorageLike): GameState | null
exportSave(state: GameState): string                // base64
importSave(text: string): GameState | null
clearSave(storage: StorageLike): void
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

// formatting
formatNumber(n: number, digits?: number): string    // 1234 -> "1.23K"; < 1000 shows up to 2 decimals trimmed
formatMoney(n: number): string                      // "$1.23M"
formatRate(perSec: number): string                  // "$4.5K/s" style w/o $ — caller adds unit
formatDuration(sec: number): string                 // "1h 05m", "4m 12s", "9s"

// also re-export: all types from types.ts and all data from src/data
```
Suffixes: `K M B T q Q s S o N d U D`, and scientific notation beyond that.

## 4. UI module layout (suggested)

```
src/ui/GameController.ts   owns state; RAF loop with fixed 100ms sim steps; autosave;
                           event fan-out (subscribe(listener)); offline report on boot
src/ui/HUD.ts              top bar, find line, population/bottleneck, whistle, zoomies
src/ui/ParkScene.ts        canvas renderer: kennels, pups sprites, road+vehicles,
                           squirrels (tappable hit-test), mail icon, floaters
src/ui/panels/*.ts         Training, Kennels, Fleet, Academy, Park (+settings)
src/ui/Sheet.ts            bottom-sheet container + tab bar
src/ui/Toasts.ts, Modal.ts
src/ui/dom.ts              tiny h() helper for creating elements
```
- Re-render panels at ≤ 4 Hz (diff text/disabled state, don't rebuild the DOM every
  frame). Draw the canvas every frame.
- Whistle: `pointerdown` adopts 1 immediately and then repeats at
  `HOLD_ADOPT_PER_SEC` until `pointerup`/`pointercancel`/`pointerleave`. Each
  adopt counts as `fromTap=true`, and `stats.totalTaps` goes up through `adopt`.
- Squirrel position is a UI concern: derive x from `age / lifetime` across the
  scene and y from a hash of `id`.
- Dev helper: `window.pawpark` exposes `{ state, controller }` for debugging and
  for Playwright smoke tests.

## 5. Quality gates
- `npm run typecheck` (tsc --noEmit) is clean.
- `npm test` (vitest) is green. Required coverage: stats formulas, tick
  dt-invariance, adopt limits, every purchase path (success, unaffordable,
  maxed, locked), find upgrade with first-time reward, prestige math and
  reset/keep lists, offline cap, save round-trip plus garbage rejection, and
  formatting.
- `npm run build` succeeds.
- `npm run balance` prints a milestone table against the targets in the design §9.

## 6. v2 API additions (see `04-long-game-afk.md`)

```ts
// simulation (tick.ts) — single code path for online + offline
stepSimulation(state, dt, rng, opts: { offline: boolean }): GameEvent[]   // now exported from barrel
runAutomation(state: GameState): GameEvent[]        // one automation pass (§3.3); exported for tests

// automation
setAutomation(state: GameState, key: AutomationKey, enabled: boolean): ActionResult  // fails if locked
setAutoPrestigeThreshold(state: GameState, t: number): ActionResult                  // must be in AUTO_PRESTIGE_THRESHOLDS

// mail
openMail(state, rng?): RewardResult | null          // opens ONE letter (mailCount > 0)
openAllMail(state, rng?): RewardResult[]

// offline
applyOfflineProgress(state, now): OfflineReport | null   // richer report, runs automation offline
```
New constants: `BASE_OFFLINE_HOURS=8`, `OFFLINE_MAX_CHUNK_SEC=60`, `BASE_RESCUE_PER_MIN=2`,
`BASE_MAIL_CAPACITY=3`, `MAIL_INTERVAL_SEC=1800`, `AUTOMATION_INTERVAL_SEC=2`,
`AUTOMATION_MAX_BUYS=50`, `AUTO_SPLURGE_FRACTION=0.1`, `AUTO_PRESTIGE_MIN_RUN_SEC=600`,
`AUTO_PRESTIGE_THRESHOLDS=[0.1,0.25,0.5,1,2]`, `DEFAULT_AUTO_PRESTIGE_THRESHOLD=0.5`, `SAVE_VERSION=2`.
Removed: `OFFLINE_RESCUE_BASE`, `OFFLINE_CHUNKS`, stat `offlineRescue`.
