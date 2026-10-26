# MAI Cities implementation plan

## Stage 1 — repository audit

**Baseline:** audited the current `main` worktree on 2026-10-26. The supplied
`Mai_Cities_World_Game_Hub_FULL_DETAILED (2).md` attachment is empty. A search of
the repository and available Git history did not find a `Gameview.tsx`, a Mai
Cities route, a persisted city-world implementation, or Kilo-attributed Mai
Cities changes. This work does not claim to recover missing code.

### Existing foundations

- The project already depends on `three`, `@react-three/fiber`, and
  `@react-three/drei`; Three.js is used in other graphics components.
- `useAuthStore` exposes the authenticated user/profile, including the
  `troll_coins` profile balance. The new view reads and displays that value only.
- `src/lib/coinTransactions.ts` routes Troll Coin deductions through the
  `try_pay_coins_secure` RPC. `runStandardPurchaseFlow` composes that deduction
  with client-side ownership work; it is not by itself a transaction covering
  a future Mai Cities world model.
- Existing platform destinations include insurance (`/insurance`), Troll Court
  (`/troll-court`), auctions (`/auctions`), platform jobs
  (`/jobs/opportunities`, wired to the existing `Jobs` page), and Hytro Gaming
  (`/hytrogaming`). Existing streaming implementations include the Hytro
  Gaming page, the `livekit-gaming` edge function, and current LiveKit/Agora
  viewers.
- Raid panels exist and `raid_property` is a server-side RPC for existing
  `houses`. The standalone `useHouseRaidActions` hook also contains direct
  client-side balance and row mutations; it is not reused for Mai Cities.
- Insurance implementations refer to different existing models:
  `insurance_options`/`user_insurances` in `insuranceSystem.ts` and
  `houses`/`homeowners_insurances` in house-raid features. They must not be
  combined without a confirmed Mai Cities property model.
- The existing `MusicTab` is a user-track library, `ThemeAudioContext` handles
  broadcast entrance audio, and `audioManager` plays existing sound assets.
  The repository does not identify a Mai Cities soundtrack or a replacement
  music source. Those global systems remain unchanged.
- `CITY_3D_DATABASE_MIGRATIONS.sql` is a root-level example script for
  `user_perks` and sample assets; it is not a Mai Cities production migration
  and does not define world ownership or placement.
- House raid UI displays electric, water, and internet status, but no
  Mai-Cities utility purchasing/billing endpoint or authoritative transaction
  flow was identified.
- Existing jobs, court, auction, and insurance pages are separate platform
  features. The current repository does not define their effects on a
  persistent Mai Cities world.

### Baseline checks

- `npm run build` passed before this feature was added.
- The build script updates generated sitemap/version files; these outputs are
  not feature changes and should not be included in the Mai Cities change.
- No Mai Cities-specific automated test suite exists.

## Assumptions and missing requirements

The first scene is a navigable visual prototype: its structures and dimensions
are local scene data, not purchasable or user-owned properties. The HUD's
balance is read from the existing authenticated profile; the structure count
and camera coordinates are measured from the rendered scene. No fake income,
level, asset ownership, or transaction history is displayed.

Before enabling building purchases, placement, insurance, utilities, raids, or
auctions against city assets, the product owner must confirm:

1. City ownership identity (existing `houses`, a different existing feature,
   or a new persisted world model), plot coordinates, placement constraints,
   and catalog contents.
2. Product IDs, Troll Coin prices, refunds, taxes/fees, transaction metadata,
   and the single server-side operation that atomically charges and records
   ownership/placement.
3. Whether insurance covers existing houses or city structures, which policy
   table is canonical, and claim/deductible behavior.
4. Raid targets, eligibility/cooldowns, and how the existing server raid RPC
   maps to city properties.
5. Utility types, consumption, prices, and server-side payment/connection
   semantics.
6. How auctions and jobs affect city assets/progression, if at all.
7. The authoritative soundtrack/catalog source, playback permissions, and
   whether it is separate from the existing MusicTab and broadcast entrance
   audio.
8. The Hytro broadcaster flow required for streaming this view. The current
   link opens the existing Hytro Gaming page; it does not claim to start a
   stream automatically.

## Staged implementation

- **Stage 1 — Audit:** completed above.
- **Stage 2 — World/view/navigation:** added `Gameview.tsx`, a responsive
  Three.js scene with camera orbit/zoom, selectable structures, scene-backed
  HUD values, platform navigation, a `/mai-cities` route, a desktop Games entry
  in the left sidebar, and Troll Wheel/Mai Cities entries on `/games`. The
  phone More menu includes Mai Cities, and the phone router opens the same
  responsive scene. Added `/jobs/opportunities` as a route to the existing
  `Jobs` page so the in-game service shortcut has a real destination.
- **Stage 3 — Identity/economy:** reads the existing auth profile and Troll
  Coin balance. No client-side balance changes are performed.
- **Stage 4 — Transactions:** intentionally not enabled. No catalog,
  ownership/placement schema, authoritative Mai Cities RPC, or validated
  product rules exist in this repository; inventing these would violate the
  task constraints.
- **Stage 5 — Streaming/audio:** links to the existing Hytro Gaming page and
  exposes an optional soundtrack-source prop for future platform injection.
  The scene has local synthesized selection/navigation sound effects. No
  existing global music or entrance-audio behavior is replaced.
- **Stage 6 — Validation:** production build, focused ESLint, and SEO route
  checks passed. `npx tsc --noEmit` reports three existing errors outside this
  feature: unresolved `moderation` in `BroadcastChat.tsx` and unresolved
  `showCoinsStat`/`coinsStatValue` in `ProfileComponents.tsx`. No
  Mai-Cities-specific automated tests exist.

## Completion status

Stages 1–3 and the safe integration points in Stage 5 are implemented. Stage 4
and the city-specific parts of insurance, raids, auctions, jobs, and utilities
remain blocked by the missing requirements and server model listed above. The
current scene exposes real links to the existing insurance, court, auction,
jobs, and Hytro pages; the links do not imply that these systems own or mutate
city assets.
