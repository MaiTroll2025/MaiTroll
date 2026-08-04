# Frontend Performance Audit

Date: 2026-06-01
Scope: polling, visibility guards, and heavy Three.js/gift effect controls in the Mai Troll frontend.

## Summary

This audit reviewed the current implementation of live stream polling, battle polling, tab visibility guards, and entrance/battle effect rendering.

### Key findings

- `src/hooks/useQueries.ts`
  - `useLiveStreams` now defaults to a 30-second polling interval.
  - The query pauses automatically when the browser tab is hidden (`refetchInterval: isVisible ? refetchInterval : false`).
  - `useNewUsers` also pauses when tab hidden.

- `src/components/broadcast/BattleControls.tsx`
  - Pending challenge polling is gated by `isVisible` and only runs when there is no active/outgoing battle state.
  - Outgoing battle status polling is disabled when the tab is hidden, and it resets `waitingForAccept` when hidden.

- `src/components/broadcast/BattleControlsList.tsx`
  - Added the same hidden-tab guard and active-match guard to pending battle polling.
  - This prevents duplicate polling loops when the user is already in a search or an active challenge.

- `src/components/broadcast/BattleThreeAnimations.tsx`
  - 3D battle animations now early-return when `!isVisible` or `isMobile`.
  - The effect hook dependency array was updated to include `isMobile` and `isVisible` so state changes tear down and recreate the animation correctly.

- `src/features/broadcast/entrance-effects/components/EntranceEffectsOverlay.tsx`
  - Entrance effect quality now overrides to `low` on mobile devices.
  - This reduces the initial Three.js engine workload for mobile users.

- `src/features/broadcast/entrance-effects/engine/threeEngine.ts`
  - The Three.js engine now enforces `state.quality.maxParticles`.
  - `createParticleSystem` caps particle creation to available budget and logs reduced counts when limits are hit.

## Context and behavior

- The shared `PageVisibilityContext` is the current source of truth for hidden-tab status.
- `isVisible` is used to pause polling rather than merely deferring it.
- The main goal is to reduce backend load and GPU work while the user is not actively viewing the page.

## Remaining observations

- There are still multiple `setInterval` loops elsewhere in the app that do not currently use visibility guards. Examples include admin monitor components, notification refreshes, and user presence trackers.
- If a broader app-wide optimization is desired, the same `usePageVisibilityContext` pattern should be applied to those additional intervals.

## Changed files referenced

- `src/hooks/useQueries.ts`
- `src/components/broadcast/BattleControls.tsx`
- `src/components/broadcast/BattleControlsList.tsx`
- `src/components/broadcast/BattleThreeAnimations.tsx`
- `src/features/broadcast/entrance-effects/components/EntranceEffectsOverlay.tsx`
- `src/features/broadcast/entrance-effects/engine/threeEngine.ts`

## Recommendation

- Keep the current changes as-is for the requested optimizations.
- Consider a second audit pass on all remaining `setInterval` and polling components to extend hidden-tab and mobile throttling app-wide.
