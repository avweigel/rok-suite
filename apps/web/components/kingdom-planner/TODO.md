# Kingdom Planner (home kingdom map): to do

## Baulur route

A mode that finds the fastest way to kill every Baulur on the home kingdom map, starting from the centre.

**Goal.** Send 5 marches. Work out the travel times, kill all the Baulur along the most optimised route (a Baulur takes only a few
seconds to kill), then go back home. Assume Hylahi for the march (to be confirmed with Davide: commander or speed to use).

**Options.**

1. **Fastest**: the shortest total time for the 5 marches.
2. **Fewest alliance switches**: to pass through a zone you have to switch to the alliance that holds its gate, so prefer the routes
   that need the fewest switches.
3. **Best case optimiser**: how the map should be built (who holds which land and gates) to get the best Baulur run.

**Constraints for the optimiser.**

- Every alliance has at most 3 fortresses and 500 flags.
- An alliance must still get the most out of the passive buffs of the shrines and the other holy sites, so it keeps them.
- Its territory must still hold as many resource points as possible with the fewest flags.

**Already there to build on.** The baulur points of the home map (`mapLayers.ts`), the walled zones and the gates (a gate must be
taken before you can go through; nothing can be built on the square around it), the route search over cells, the flag rules and
the "ignore the alliances" mode in `components/rok-planner/src/core/`.
