# MAI Sync Integration Plan

This file documents the complete Mai Troll ↔ MaiTalent.fun integration setup, environment variables, auth rules, and verification checklist.

## What was done here

- Reviewed MaiTalent repository sync architecture and the existing Supabase edge function.
- Created a shared integration contract for auth headers, payload shape, and env variables.
- Documented the current Mai Troll implementation state, including what is implemented and what is still missing.
- Added a verification checklist and recommended security rules for server-to-server sync.

## What Mai Troll needs to do now

- Deploy `supabase/functions/sync-mai-platform-user/index.ts` as a server-side edge function.
- Ensure Mai Troll runtime has only server-only env vars:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `MAITALENT_SYNC_URL`
  - `MAITALENT_SYNC_SECRET`
- Call `MAITALENT_SYNC_URL` with:
  - method: `POST`
  - header: `x-service-role: <MAITALENT_SYNC_SECRET>`
  - body: `action`, `external_platform`, `external_user_id`, `normalized_email`, and for `sync` requests also `source_event_id`, `activity_type`, `tokens_awarded`
- Do not expose `MAITALENT_SYNC_SECRET` in frontend code.
- Confirm the outgoing header to MaiTalent is the shared sync secret, not `MAITALENT_SERVICE_ROLE_KEY`, unless MaiTalent explicitly expects otherwise.
- Test end-to-end from trusted backend code and verify no `401` and correct duplicate event handling.

## Shared service auth secret

Use this same secret in both projects via env vars:

```text
MAITALENT_SYNC_SECRET=<shared-service-secret>
```

This secret must be treated as a service-role secret only. Do not expose it in frontend code.

## Mai Troll setup

### Required environment variables

Add these to Mai Troll Supabase / function environment:

```text
SUPABASE_URL=<Mai Troll Supabase URL>
SUPABASE_SERVICE_ROLE_KEY=<Mai Troll service role key>
MAITALENT_SYNC_URL=https://<maitalent-project>.functions.supabase.co/sync-mai-platform-user
MAITALENT_SYNC_SECRET=<shared-service-secret>
```

### Optional direct MaiTalent DB access

Only add these if Mai Troll needs to query MaiTalent directly, not just via the sync function:

```text
MAITALENT_SUPABASE_URL=<MaiTalent Supabase URL>
MAITALENT_SERVICE_ROLE_KEY=<MaiTalent service role key>
```

### Required sync request format

The Mai Troll backend should send requests to `MAITALENT_SYNC_URL` with:

- HTTP method: `POST`
- Header:
  - `x-service-role: <MAITALENT_SYNC_SECRET>`
- Body:
```json
{
  "action": "link" | "sync",
  "external_platform": "troll-city",
  "external_user_id": "...",
  "normalized_email": "...",
  "source_event_id": "...",   // only for action sync
  "activity_type": "...",     // only for action sync
  "tokens_awarded": 0,          // only for action sync
  "metadata": {}
}
```

### Implementation requirements

- The sync call must happen from server-side code only.
- `MAITALENT_SYNC_SECRET` must never be exposed in frontend code.
- Use `MAITALENT_SYNC_SECRET` as the incoming auth token for Mai Troll → MaiTalent.

## What MaiTalent.fun needs to do now

1. Deploy its own `sync-mai-platform-user` edge function.
2. Configure these server-only env vars:
   - `MAITALENT_SUPABASE_URL`
   - `MAITALENT_SERVICE_ROLE_KEY`
   - `MAITALENT_SYNC_SECRET=<shared-service-secret>`
3. Optionally configure direct Mai Troll DB access only if needed:
   - `Mai Troll_SUPABASE_URL`
   - `Mai Troll_SERVICE_ROLE_KEY`
4. Enforce auth:
   - require `x-service-role: <MAITALENT_SYNC_SECRET>`
   - validate it against `MAITALENT_SYNC_SECRET`
5. Validate the incoming payload:
   - `action` = `link` or `sync`
   - `external_platform` = `troll-city`
   - `external_user_id`
   - `normalized_email`
   - for `sync`: `source_event_id`, `activity_type`, `tokens_awarded`
6. Implement the actual MAI gateway behavior:
   - resolve MAI user by email / external link
   - upsert `external_account_links`
   - write `cross_platform_activity_audit`
   - dedupe using `source_platform + source_event_id + activity_type`
   - insert `cross_platform_reward_events`
   - update `wallets.token_balance`
   - insert `token_transactions`
7. Test the full path:
   - send a server-side request from Mai Troll
   - confirm MaiTalent returns success
   - confirm no `401` for valid requests
   - confirm duplicate handling works

If Mai Troll currently forwards with `X-Service-Role: MAITALENT_SERVICE_ROLE_KEY`, MaiTalent.fun must either accept that temporary behavior or insist on the shared sync secret instead.

## Verification checklist

- [ ] Mai Troll has a deployed sync edge function
- [ ] Mai Troll env vars include `MAITALENT_SYNC_URL` and `MAITALENT_SYNC_SECRET`
- [ ] MaiTalent.fun env vars include the two Supabase URLs/keys and `MAITALENT_SYNC_SECRET`
- [ ] Mai Troll sync request header is `x-service-role: <MAITALENT_SYNC_SECRET>`
- [ ] MaiTalent validates incoming requests against `MAITALENT_SYNC_SECRET`
- [ ] The sync payload contains `action`, `external_platform`, `external_user_id`, `normalized_email`, and for `sync` requests also `source_event_id`, `activity_type`, and `tokens_awarded`
- [ ] Duplicate detection and audit are working for external events

## Testing

1. Deploy both edge functions.
2. Use a server-side request from Mai Troll to call `MAITALENT_SYNC_URL`.
3. Verify MaiTalent returns a success response.
4. Verify there are no 401 unauthorized responses.
5. Verify duplicate `source_event_id` requests return `409` or duplicate handling.

## Notes for Mai Troll

Please make sure the same MAI secret is used in both projects and that the function is only called from trusted backend code. If you want, I can also provide a second file for the Mai Troll team with the exact function name and headers to validate.
