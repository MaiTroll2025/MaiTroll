# Maitalent Sync Investigation Answers

Here is a clear answer for each investigation question based on the repository contents and the current sync implementation.

## 1. Expected data flow

- The intended flow is:
  1. Mai Troll sends a server-side POST to the MaiTalent sync endpoint.
  2. The endpoint validates the request and the shared auth header.
  3. It resolves the correct MaiTalent user using an existing link or by email.
  4. It writes link state, audit entries, reward events, and wallet/profile updates.
- The implementation supports two actions:
  - link
  - sync

## 2. Recent changes

- There is a recent sync-related commit in the repo history:
  - 58e8003 — "Finalize Mai Troll sync integration updates"
- That commit affected the sync implementation and the related documentation.
- I do not see evidence in the workspace of a new webhook endpoint, key rotation, or auth-flow redesign beyond that change.

## 3. Known issues

- Duplicate protection exists via source_event_id + activity_type.
- Missing or malformed input returns 400.
- Partial syncs can happen if processing fails after a link is created but before the reward event or wallet update completes.
- Delete events are not supported by the current endpoint.

## 4. Create, update, and delete triggering

- I do not see create/update/delete webhook handlers, database triggers, or event listeners in the workspace.
- The sync is currently request-driven rather than event-driven; it only processes incoming POST calls.

## 5. Logs and errors to inspect

- Check Supabase Edge Function logs for the sync endpoint.
- Check these tables:
  - cross_platform_activity_audit
  - cross_platform_reward_events
- The implementation explicitly handles and logs these cases:
  - missing/invalid service authorization
  - linked MaiTalent account not found
  - daily reward limit exceeded
  - reward event insertion failure
  - wallet credit failure
  - internal server errors

## 6. Fields supposed to sync

- The documented and implemented payload includes:
  - action
  - external_platform
  - external_user_id
  - normalized_email
  - source_event_id
  - activity_type
  - tokens_awarded
  - metadata
  - balances including troll_coins, hype_coins, and battle_crowns
- The current endpoint:
  - updates profile balance fields from the incoming balances snapshot
  - credits wallets.token_balance
  - inserts token_transactions
  - does not currently implement wallet-level coin/hype balance writes from Mai Troll balances
  - does not support delete actions

## 7. Rate limits, timeouts, and queueing

- There is no queueing or retry system in the current implementation.
- There is a hard daily external reward cap of 1000 tokens per user.
- If the cap is exceeded, the endpoint returns 429.
- There is no explicit timeout policy in the code; behavior depends on Supabase runtime defaults.

## 8. Expected response format and success/failure behavior

- For link:
  - 200 with a success body
- For sync:
  - 200 with a success body
- For duplicate events:
  - 200 with a duplicate-handled response
- For validation/auth failures:
  - 400 or 401 with an error message
- For daily limit exceeded:
  - 429
- For server/database/env issues:
  - 500

## 9. Staging vs production

- I do not see a separate staging-specific code path or endpoint in the workspace.
- The practical difference between environments would be the deployed environment variables and the actual endpoint URL.

## 10. Expected environment values

- The repository documents these values:
  - SUPABASE_URL = Mai Troll Supabase URL
  - SUPABASE_SERVICE_ROLE_KEY = Mai Troll service role key
  - MAITALENT_SYNC_URL = https://tovzpzpimvwaldqkkmmi.functions.supabase.co/sync-mai-platform-user
  - MAITALENT_SYNC_SECRET = maicorp1336944428554803
  - MAITALENT_SUPABASE_URL = MaiTalent Supabase URL
  - MAITALENT_SERVICE_ROLE_KEY = MaiTalent service role key
  - Mai Troll_SUPABASE_URL and Mai Troll_SERVICE_ROLE_KEY = optional direct-access values
- I did not find a feature-flag configuration in the repo.

## 11. Whether the expected environment variables are set correctly

- I cannot verify the live deployment values from the workspace alone.
- What I can confirm from the code is:
  - missing required env vars will cause a 500
  - a mismatched secret header will cause 401
  - the sample test script uses the documented URL and secret

## 12. What to verify in app config and deployment

- Confirm the deployed edge function exists at the target URL.
- Confirm the runtime has the required server-only env vars.
- Confirm the shared secret matches exactly in both systems.
- Confirm the request header is exactly:
  - x-service-role: maicorp1336944428554803
- Confirm the relevant database tables and permissions are present.
- Confirm the frontend does not expose the secret.

## 13. Quickest way to reproduce and isolate

- Use a minimal valid payload with a unique source_event_id and one known user.
- The fastest isolation path is:
  1. Send a test request to the endpoint.
  2. Observe the HTTP status code.
  3. Check the edge function logs.
  4. Check cross_platform_activity_audit and cross_platform_reward_events.
- Likely interpretations:
  - 401 = auth mismatch
  - 400 = payload or lookup issue
  - 429 = daily reward cap
  - 500 = env or database issue
