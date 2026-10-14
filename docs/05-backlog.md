# Backlog

The current priority is **building it out and understanding it**: mechanics,
pacing, and the AFK loop. Visual polish comes afterward.

## Later: visual refinement (target: close to Egg, Inc.'s look)
- Match Egg, Inc.'s presentation: a farm seen from a 3/4 top-down angle, with
  habs and vehicles drawn as chunky 3D-ish buildings instead of flat emoji.
  Tiny animals stream from the hatchery to the habs, there's a big round hatch
  button at the bottom center, and a clean white UI with rounded cards over the
  farm.
- Replace emoji art with consistent sprites (kennels per tier, vehicles per
  tier, dog breeds).
- Add a visible "pup run" from the adoption center to the kennels when adopting,
  like Egg, Inc.'s running chickens.
- Grow the kennel and vehicle graphics visibly as their tier goes up.
- Sound and haptics.

## Known small issues
- The largest number suffixes ("o", "S", "N" …) are hard to read. Consider
  scientific notation or the aa/ab/ac style past 1e15.
- `docs/04` §7 still shows the v2 balance tables. The v3 numbers live in `docs/06` §11.
- Pure-AFK players who skip the daily ritual reach the endgame on about day 141,
  past the 95–125 window (by design: dailies are the expected play).
