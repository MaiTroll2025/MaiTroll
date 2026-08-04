# MaiTalent Live Verification Runbook

This file contains the exact commands and SQL to run in the live environment without executing anything from this workspace.

## 1) Apply the profile schema migration

Run this SQL in the live Supabase/Postgres database:

```sql
\i 20260701000002_add_maitalent_profile_link_columns.sql
```

If you prefer to run it inline, use:

```sql
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS mai_ecosystem_linked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS maitalent_linked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mai_linked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mai_link_source TEXT,
  ADD COLUMN IF NOT EXISTS external_account_id TEXT;

COMMENT ON COLUMN public.user_profiles.mai_ecosystem_linked IS 'Whether the Mai Troll profile is linked to the MaiTalent ecosystem';
COMMENT ON COLUMN public.user_profiles.maitalent_linked IS 'Whether the Mai Troll profile has a valid MaiTalent link';
COMMENT ON COLUMN public.user_profiles.mai_linked_at IS 'Timestamp when the MaiTalent link was established';
COMMENT ON COLUMN public.user_profiles.mai_link_source IS 'Source of the MaiTalent link, such as profile_page or broadcast_flow';
COMMENT ON COLUMN public.user_profiles.external_account_id IS 'External account identifier used for the MaiTalent link';
```

## 2) Verify the required server environment variables

In the deployed server or Supabase function environment, verify these values are present:

```bash
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
MAITALENT_SYNC_URL
MAITALENT_SYNC_SECRET
```

If you are using Supabase Edge Functions, set them in the function environment with:

```bash
supabase secrets set SUPABASE_URL=... \
  SUPABASE_SERVICE_ROLE_KEY=... \
  MAITALENT_SYNC_URL=... \
  MAITALENT_SYNC_SECRET=...
```

## 3) Deploy the updated server-side sync logic

If you are deploying from this repo, run:

```bash
supabase functions deploy sync-mai-platform-user
```

If your backend is a Node/Express service, deploy the updated server bundle or restart the service after pulling the latest code.

## 4) Verify the live link flow

Run the server-side link route with a real authenticated user:

```bash
curl -X POST https://<your-Mai Troll-backend>/api/maitalent/link-account \
  -H "Authorization: Bearer <user-access-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "<user-id>",
    "email": "<user-email>",
    "maitalent_user_id": "<maitalent-user-id>"
  }'
```

Then verify the profile row:

```sql
SELECT id, email, maitalent_link_status, maitalent_link_platform, maitalent_external_user_id, maitalent_link_verified_at, mai_ecosystem_linked, maitalent_linked, mai_linked_at, mai_link_source, external_account_id
FROM public.user_profiles
WHERE id = '<user-id>';
```

Expected values:
- `maitalent_link_status` is not null
- `maitalent_linked = true`
- `mai_linked_at` is populated
- `mai_link_source` is populated
- `external_account_id` is populated

## 5) Verify the live sync flow

Trigger a server-side sync request:

```bash
curl -X POST https://<your-Mai Troll-backend>/api/maitalent/sync-activity \
  -H "Content-Type: application/json" \
  -d '{
    "external_user_id": "<user-id>",
    "normalized_email": "<user-email>",
    "source_event_id": "Mai Troll:test-sync:<timestamp>",
    "activity_type": "broadcast",
    "tokens_awarded": 25,
    "metadata": {
      "source": "live_verification"
    }
  }'
```

## 6) Verify the broadcast-start/broadcast-watch flow

Start a broadcast and then hit the broadcast-view tracker:

```bash
curl -X POST https://<your-Mai Troll-backend>/api/maitalent/track-broadcast-view \
  -H "Authorization: Bearer <user-access-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "streamId": "<stream-id>",
    "userId": "<user-id>"
  }'
```

## 7) Confirm source-of-truth balances

The backend should be sending balances derived from the Mai Troll profile:

```sql
SELECT id, email, troll_coins, hype_coins, battle_crowns
FROM public.user_profiles
WHERE id = '<user-id>';
```

The payload sent to MaiTalent should reflect those values as the authoritative balances.

## 8) Optional: sanity-check the repo-side implementation

If you want a local verification before deploying, run:

```bash
node --test server/lib/maitalentSync.test.js
```
