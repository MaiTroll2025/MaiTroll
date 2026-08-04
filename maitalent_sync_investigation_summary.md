# Maitalent Sync Investigation Summary

## Overview

This summary captures the current understanding of the Maitalent sync flow, likely failure points, and the environment checks that should be verified to isolate the issue.

## Expected Data Flow

The intended flow is:

1. Mai Troll sends a POST request to the Maitalent sync endpoint.
2. The endpoint validates the request and the shared auth header.
3. It resolves the target Maitalent user by existing link or email.
4. It writes or updates link state, audit rows, reward events, and profile/wallet state.

The implementation is built around two actions:
- link
- sync

## Recent Changes

A recent sync-related commit exists in the repo history:
- 58e8003 — "Finalize Mai Troll sync integration updates"

That change touched the sync implementation and the related prompt documentation. There is no clear sign in the workspace of a new webhook endpoint, key rotation, or auth-flow rewrite beyond that change.

## Known Issues

- Duplicate protection exists using source_event_id + activity_type.
- Missing or malformed fields return a 400 error.
- Partial syncs are possible if the flow fails after link creation but before reward insertion or wallet credit.
- The current implementation does not support delete events.

## Create/Update/Delete Triggering

There is no evidence in the workspace of create/update/delete webhook handlers, DB triggers, or event listeners. The endpoint is passive and processes incoming POST requests rather than subscribing to lifecycle events.

## Logs and Errors to Inspect

Check the following sources:
- Supabase Edge Function logs for the sync endpoint
- MaiTalent tables:
  - cross_platform_activity_audit
  - cross_platform_reward_events

Relevant failure cases include:
- Missing or invalid service authorization
- Linked MaiTalent account not found for this Mai Troll user
- Daily external reward limit exceeded
- Failed to record reward event
- Failed to credit tokens
- Internal server error

## Fields Expected to Sync

Expected payload fields include:
- action
- external_platform
- external_user_id
- normalized_email
- source_event_id
- activity_type
- tokens_awarded
- metadata
- balances with troll_coins, hype_coins, battle_crowns

## Current Implementation Notes

The implementation currently:
- updates profile balance fields from the incoming balances snapshot
- credits wallets.token_balance and inserts token_transactions for reward events
- does not update wallet-level coin/hype balance columns from Mai Troll balances
- does not support delete actions

## Rate Limits, Timeouts, and Queueing

- No queueing or retry mechanism is present.
- There is a hard daily reward cap of 1000 tokens per user for external reward events.
- If the cap is exceeded, the endpoint returns 429.
- There is no explicit timeout policy in the code itself; it relies on the Supabase client/runtime defaults.

## Expected Response Format and Behavior

- Success for link: 200
- Success for sync: 200
- Duplicate event: 200
- Validation/auth failures: 400 or 401
- Daily limit: 429
- Server/env/db problems: 500

## Staging vs Production

No separate staging-specific code path or endpoint is visible in the workspace. The real difference is the deployed environment variables and the endpoint URL.

## Expected Environment Values

Documented expected values from the repo:
- SUPABASE_URL = Mai Troll Supabase URL
- SUPABASE_SERVICE_ROLE_KEY = Mai Troll service role key
- MAITALENT_SYNC_URL = https://tovzpzpimvwaldqkkmmi.functions.supabase.co/sync-mai-platform-user
- MAITALENT_SYNC_SECRET = maicorp1336944428554803
- MAITALENT_SUPABASE_URL = MaiTalent Supabase URL
- MAITALENT_SERVICE_ROLE_KEY = MaiTalent service role key
- Mai Troll_SUPABASE_URL and Mai Troll_SERVICE_ROLE_KEY = optional direct access values

No feature-flag config was found in the repo.

## Environment Verification Checklist

The following should be verified in the deployed environment:
- the edge function exists at the target URL
- the runtime has the required server-only env vars
- the shared secret matches exactly in both systems
- the request header is exactly x-service-role: maicorp1336944428554803
- the relevant database tables exist and the correct roles have access
- the frontend does not expose the secret

## Quickest Way to Reproduce and Isolate

Use a minimal valid payload with a unique source_event_id and one known user. If the response is:
- 401: auth mismatch
- 400: payload or lookup issue
- 429: daily reward cap
- 500: env or DB issue

Then inspect the edge function logs and the audit/reward tables immediately.
