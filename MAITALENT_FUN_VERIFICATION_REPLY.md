# Mai Troll → MaiTalent.fun Verification Update

Hi MaiTalent team,

I reviewed the current Mai Troll implementation against the new integration prompt and here is the current status.

## Current status

The core server-side integration hooks are already present in the Mai Troll codebase:

- A server-side MaiTalent sync helper exists in [server/lib/maitalentSync.js](server/lib/maitalentSync.js).
- Server-only routes for account linking and sync events are exposed in [server/index.js](server/index.js).
- Broadcast start syncing is wired from [server/api/broadcasts.js](server/api/broadcasts.js).
- Broadcast-view sync is triggered from [src/hooks/useViewerTracking.ts](src/hooks/useViewerTracking.ts).
- The MaiTalent-facing edge function exists in [supabase/functions/sync-mai-platform-user/index.ts](supabase/functions/sync-mai-platform-user/index.ts) and validates the shared secret header while using idempotent source-event handling.

## What is already implemented

1. Server-side sync execution
   - Link and sync requests are initiated from the Mai Troll backend rather than the frontend.
   - The shared secret is handled server-side only.

2. Idempotent sync behavior
   - Sync events use a unique source_event_id pattern to reduce duplicate processing.

3. Profile-based balance usage
   - The frontend balance flow already reads from the Mai Troll profile record for troll_coins, hype_coins, and battle_crowns through [src/lib/hooks/useCoins.ts](src/lib/hooks/useCoins.ts).

## Remaining items for full prompt alignment

1. Explicit profile-link persistence fields
   - The current implementation stores linkage information using the existing maitalent_* profile columns, but the prompt’s recommended explicit fields such as mai_ecosystem_linked, maitalent_linked, mai_linked_at, mai_link_source, and external_account_id are not yet implemented in the codebase.

2. Explicit balance-source-of-truth sync payloads
   - The current server-side sync flow is in place, but the outbound payload should explicitly reflect the Mai Troll profile balances as the authoritative values for the link/sync flow.

3. Broadcast watch reward cadence
   - Broadcast start is wired. Broadcast watch is currently triggered from the viewer hook, but the reward cadence and per-hour logic still need to be finalized to match the intended MaiTalent behavior precisely.

4. Deployment and runtime verification
   - The repository is prepared for the integration, but the live environment still needs confirmation that the required environment variables are present and that the deployed edge function is reachable with the shared secret.

## Plan for completion

1. Add the explicit profile-link state fields to Mai Troll profile storage and update them during successful link/sync operations.
2. Extend the outbound sync payload so that Mai Troll profile balances are clearly treated as the single source of truth for MaiTalent balance syncs.
3. Finalize the broadcast-watch reward logic with idempotent source_event_id handling.
4. Verify the deployed environment variables and end-to-end link flow in the live backend.

## Bottom line

The integration foundation is present and the core server-side hooks are in place, but the implementation still needs a final pass to fully satisfy the prompt’s requested persistence fields, balance-source-of-truth behavior, and live deployment verification.

Best regards,
Mai Troll Engineering
