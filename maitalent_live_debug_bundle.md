# Maitalent Live Debug Bundle

## Summary

The Mai Troll caller-side payload builder now includes the required sync fields for the deployed function contract, including `source_event_id` for both link and sync requests. The remaining issue is therefore most likely one of these:

- the deployed Supabase function is running a different implementation than the current workspace version,
- the live function is enforcing a different validation contract than the workspace code,
- or the live function is failing later in its processing path after validation.

## Verified Mai Troll Payloads

### Link payload shape now sent by Mai Troll

```json
{
  "action": "link",
  "external_platform": "troll-city",
  "external_user_id": "<troll-city-user-id>",
  "normalized_email": "<verified-email>",
  "source_event_id": "Mai Troll:link:<troll-city-user-id>",
  "maitalent_user_id": "<maitalent-user-id>",
  "metadata": {
    "requested_from": "profile_page"
  }
}
```

### Sync payload shape now sent by Mai Troll

```json
{
  "action": "sync",
  "external_platform": "troll-city",
  "external_user_id": "<troll-city-user-id>",
  "normalized_email": "<verified-email>",
  "source_event_id": "Mai Troll:profile-sync:<troll-city-user-id>",
  "activity_type": "profile_sync",
  "tokens_awarded": 0,
  "metadata": {
    "requested_from": "profile_page",
    "linked_at": "<timestamp>",
    "profile_data": {
      "username": "",
      "full_name": "",
      "avatar_url": "",
      "bio": "",
      "troll_coins": 0,
      "bonus_coin_balance": 0,
      "tier": "Bronze",
      "role": "user",
      "is_verified": false,
      "influencer_tier": null
    }
  }
}
```

## Relevant Mai Troll Code Paths

- Server route: [server/index.js](server/index.js)
- Shared payload builder: [server/lib/maitalentSync.js](server/lib/maitalentSync.js)
- Regression tests: [server/lib/maitalentSync.test.js](server/lib/maitalentSync.test.js)

## What to Ask the Other Side

Please share the following from the live deployment:

1. The exact raw request payload that reached the function.
2. The full response body returned by the deployed function.
3. The Supabase Edge Function logs for the request.
4. The deployed function version/deployment ID.
5. The contents of the deployed function source, or the deployment history from the Supabase dashboard.

## Suggested Message to Send

Hi team,

We have verified that the Mai Troll caller now sends the expected payload shape, including `source_event_id` for both link and sync requests. The remaining issue appears to be on the deployed function side, so please share the exact live request payload and the function logs for the failing request. If possible, also share the deployed function version/deployment ID so we can compare it directly against the current workspace implementation.

## Verification Evidence

The payload builder and server route were updated and verified with the local regression test suite:

```text
node --test server/lib/maitalentSync.test.js
```

Observed result:
- 6 tests passed
- 0 failed
