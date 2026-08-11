# Mod Actions Backend — Setup, Deployment & Verification

This document describes the secure backend that powers the **Mod Actions** popup
(`src/components/broadcast/ModActionsPopup.tsx`). It covers the deliverables,
deployment, required secrets, and a full verification checklist.

---

## 1. Authorized Roles (ONLY these)

Only the following roles may use Mod Actions. Any account without one of these
roles has **no** access to the Mod Actions tab, buttons, or popup, and the
backend independently rejects them with HTTP 403.

- `ceo`
- `admin`
- `lead_troll_officer`
- `troll_officer`
- `secretary`
- `broadcaster`
- `broadofficer`
- `ceo_assistant`
- `noah_assistant`

No other role is included in the authorization list. Broadcaster actions are
limited to the broadcaster's own active stream; Broadofficer actions use the
existing Broadofficer relationship.

---

## 2. Deliverables

| # | File | Purpose |
|---|------|---------|
| 1 | `supabase/migrations/<ts>_moderation_actions_backend.sql` | Idempotent SQL migration |
| 2 | `supabase/functions/moderation-actions/index.ts` | Secure Edge Function |
| 3 | `src/types/moderationActions.ts` | TS request/response types + helper |
| 4 | `src/components/broadcast/ModActionsPopup.tsx` | Updated integration |
| 5 | `MODERATION_BACKEND_SETUP.md` | This document |

---

## 3. What the Migration Does

One idempotent migration that **reuses existing tables** — it does **not** create
replacement tables, duplicate columns, duplicate RPC overloads, or a second
moderation system.

### Reused existing objects
- `streams`, `user_profiles`, `chat_blocks`, `jail`
- `court_dockets`, `court_cases`, `user_ip_tracking`
- `user_driver_licenses`, `user_insurances`, `notifications`
- `broadcast_mod_actions`, `stream_messages`, `broadcast_restrictions`
- `stream_participants`, `stream_seat_sessions`
- `stream_mutes`, `stream_kicks`, `stream_bans`, `broadcast_officers`

### Created / repaired
- Role helpers `is_modo_role(uuid)` and `is_modo_role_in(uuid, text[])` enforcing
  the exact 9-role list.
- **Missing columns added idempotently** (`ADD COLUMN IF NOT EXISTS`):
  - `user_profiles`: `muted_until`, `mic_muted_until`, `is_kicked`, `kicked_until`,
    `last_kicked_at`, `updated_at`
  - `chat_blocks`: `updated_at`
  - `stream_messages`: `type`
  - `broadcast_mod_actions`: `action_name`, `actor_display_name`,
    `target_display_name`, `target_role_before`, `target_role_after`,
    `broadcast_id`, `livekit_room_name`, `previous_status`, `new_status`,
    `success`, `error_message`, `metadata`
  - `user_driver_licenses`: `expires_at`, `suspended_by`, `suspension_reason`
  - `user_insurances`: `protection_type`, `issued_at`
  - `broadcast_restrictions`: `stream_id`, `starts_at`, `status`
  - `user_ip_tracking`: `latitude`, `longitude`, `ip_address`
  - `court_cases`: widened `case_type` / `status` CHECK constraints
  - `jail`: `sentence_days`, `bond_amount`, `severity`, `status`, `arrested_by`,
    `court_date`, `arrest_latitude`, `arrest_longitude`
- **Unique/partial indexes** for upserts:
  - `chat_blocks_stream_user_uidx` on `chat_blocks(stream_id, user_id)`
  - `user_insurances_active_user_type_uidx` on
    `user_insurances(user_id, protection_type) WHERE is_active = true`
- **Audit helper** `modo_audit(...)` that writes `broadcast_mod_actions`.

### RPC functions (all `SECURITY DEFINER`, actor from `auth.uid()`)
- `moderator_mute_user(uuid, uuid, integer, text)` → `jsonb`
- `moderator_unmute_user(uuid, uuid)` → `jsonb`
- `moderator_disable_chat(uuid, uuid, integer, text)` → `jsonb`
- `moderator_kick_user(uuid, uuid, text)` → `jsonb` (UUID targets)
- `can_user_broadcast(uuid)` → `jsonb`
- `can_set_to_user(uuid)` → `jsonb` (actor derived from `auth.uid()`)
- `reset_user_permissions(uuid)` → `jsonb`
- `remove_stream_broadofficer(uuid, uuid)` → `jsonb`
- `modo_arrest(uuid, uuid, text, text)` → `jsonb` (race-safe docket assignment)
- `modo_suspend_license(uuid, text, integer)` → `jsonb`
- `modo_grant_license(uuid)` → `jsonb`
- `modo_end_stream(uuid, uuid, text, integer)` → `jsonb`

### Arrest logic (race-safe)
- Validates severity (`minor|moderate|serious|severe`) and reason.
- Computes bail server-side.
- Computes the next valid **Tuesday or Thursday**.
- Locks the docket row (`FOR UPDATE`), creates a docket when needed, and never
  exceeds `max_cases` (20). Concurrent arrests cannot overfill a docket.
- Creates exactly one `jail` row, one `court_cases` row, one notification, and
  one audit row.

### RLS
- Enables RLS on privileged tables and **removes** broad
  `auth.uid() IS NOT NULL` ALL policies.
- Replaces them with **SELECT-only** policies for the frontend reads.
- Privileged writes are only possible through the `SECURITY DEFINER` RPCs
  (which enforce the 9-role list) or the service-role Edge Function.

### Realtime
- Conditionally adds `stream_messages`, `streams`, `user_profiles`,
  `notifications`, `stream_participants`, `stream_seat_sessions` to
  `supabase_realtime`.
- Sets `REPLICA IDENTITY FULL` where complete UPDATE/DELETE payloads are needed.
- No table is added twice and no table is added if already present.

---

## 4. Edge Function (`moderation-actions`)

`supabase/functions/moderation-actions/index.ts`

### Behavior
- Handles CORS.
- Requires an `Authorization: Bearer <token>` header.
- Validates the JWT via `auth.getUser()`.
- Loads the actor's current DB profile and enforces the 9-role list **server-side**.
- Rejects unauthorized actors with HTTP 403 and the structured response:
  ```json
  { "success": false, "code": "NOT_AUTHORIZED", "message": "You do not have permission to use Mod Actions." }
  ```
- Routes each action through the secure RPCs using the service-role client
  **only after** user authentication and authorization succeed.
- Supports guest kick (non-UUID target) by closing the seat session directly
  without casting the guest identifier to UUID.
- Validates UUIDs, duration ranges, reason length, and severity.
- Returns a consistent envelope:
  - Success: `{ "success": true, "code": "ACTION_COMPLETED", "message": "...", "data": {} }`
  - Error: `{ "success": false, "code": "ERROR_CODE", "message": "...", "data": null }`
- Logs errors without exposing service-role keys or LiveKit secrets.
- LiveKit room close / participant kick happens server-side only; secrets never
  reach the browser.

### Supported actions
`mute`, `unmute`, `disable_chat`, `kick`, `arrest`, `suspend_license`,
`grant_license`, `remove_officer`, `set_to_user`, `end_stream`.

---

## 5. Frontend Changes (`ModActionsPopup.tsx`)

- Added strict role gating via `hasModActionsAccess(profile)` from
  `src/types/moderationActions.ts`. Accounts without an authorized role:
  - do **not** see the Mod Actions tab,
  - cannot open the popup (`if (!isOpen || !hasModAccess) return null;`),
  - cannot trigger any moderation action.
- Removed the old `isPlainUser` logic that gave ordinary accounts every action
  except arrest. Mod Actions is now a hard deny for non-authorized accounts.
- Added `invokeModerationAction(payload)` helper
  (`supabase.functions.invoke('moderation-actions', { body: payload })`) and
  replaced all sensitive direct DB writes with it (arrest, license
  grant/suspend, set-to-user, end-stream, mute, unmute, disable-chat, kick,
  remove-officer).
- Removed the temporary realtime channel in `handleRemoveOfficer` — the RPC
  inserts exactly one `stream_messages` system row delivered via the existing
  realtime subscription.
- Fixed the broken end-stream logic
  (`const streamIdToEnd = effectiveStreamId || targetUserId ? undefined : undefined;`)
  and now send `effectiveStreamId` / `targetUserId` to the Edge Function.
- Updated `GiftBoxModal` props to use resolved `effectiveStreamId` /
  `effectiveHostId` instead of the original empty `streamId` / `hostId`.
- Uses server-returned messages, closes the correct modal only on success, and
  does not show a false success toast.

---

## 6. TypeScript Types (`src/types/moderationActions.ts`)

- `ModerationActionType` — union of all supported actions.
- `ModerationActionPayload` — input shape for the Edge Function.
- `ModerationActionResult` — `{ success, code, message, data }`.
- `MOD_ACTIONS_ROLES` — the exact 9 authorized roles.
- `hasModActionsAccess(profile)` — frontend role gate.
- `invokeModerationAction(payload)` — helper that calls the Edge Function and
  normalizes the response.

---

## 7. Deployment

### Prerequisites
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed and linked to
  your project (`supabase link --project-ref <ref>`).
- A `.env` file with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` available to
  the Edge Function (managed automatically by Supabase; set custom secrets via
  `supabase secrets set`).

### Deploy the database migration
```bash
supabase db push
```

### Deploy the Edge Function
```bash
supabase functions deploy moderation-actions --no-verify-jwt
```

> **Why `--no-verify-jwt`?** The function must manually validate the bearer
> token inside the function (it loads the actor's DB profile and enforces the
> role). It still **requires** a valid token and returns 401/403 otherwise. Do
> **not** leave the endpoint unauthenticated.

### Required secrets
```bash
supabase secrets set \
  LIVEKIT_URL=wss://<your-livekit-cloud-url> \
  LIVEKIT_API_KEY=<your-api-key> \
  LIVEKIT_API_SECRET=<your-api-secret>
```
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by
  the Functions runtime; do **not** redeclare them manually unless using a local
  dev override.

---

## 8. Verification Checklist (30 tests)

| # | Test | Expected |
|---|------|----------|
| 1 | Non-authorized account sees Mod Actions tab | Hidden |
| 2 | Non-authorized account opens popup | Denied (returns null) |
| 3 | Unauthorized Edge Function call | HTTP 403 |
| 4 | Unauthorized moderation RPC call | `NOT_AUTHORIZED` |
| 5 | Broadcaster actions limited to own stream | Enforced |
| 6 | Broadofficer uses existing relationship | Enforced |
| 7 | Mute creates/updates stream restriction | `chat_blocks` row |
| 8 | Unmute clears restriction | Removed |
| 9 | Disable chat expires at server time | Correct `expires_at` |
| 10 | Kick removes viewer/participant | Closed |
| 11 | Guest kick works (non-UUID) | No UUID cast error |
| 12 | Arrest creates one jail row | 1 row |
| 13 | Arrest creates one court case | 1 row |
| 14 | Arrest assigns one valid docket | Capacity respected |
| 15 | Concurrent arrests don't overfill docket | ≤ max_cases |
| 16 | License suspension updates license | Correct record |
| 17 | License suspension → 1 notification + 1 audit | 1 each |
| 18 | License grant creates/updates one license | Upsert |
| 19 | License grant creates/updates one insurance | Upsert |
| 20 | Broadofficer removal inserts exactly one `stream_messages` | 1 row |
| 21 | Broadofficer removal no duplicate realtime events | 1 event |
| 22 | Set-to-user updates target correctly | Demoted |
| 23 | End stream updates correct stream | Ended |
| 24 | End stream creates restriction | 1 row |
| 25 | End stream closes participants | Closed |
| 26 | End stream closes active seat sessions | Closed |
| 27 | End stream → 1 notification + 1 audit | 1 each |
| 28 | Repeat request no duplicate punishment | Single side-effect |
| 29 | Successful action returns authoritative data | `data` populated |
| 30 | No service-role key / LiveKit secret in browser | Confirmed |

---

## 9. Final Report

### Existing objects reused
`streams`, `user_profiles`, `chat_blocks`, `jail`, `court_dockets`,
`court_cases`, `user_ip_tracking`, `user_driver_licenses`, `user_insurances`,
`notifications`, `broadcast_mod_actions`, `stream_messages`,
`broadcast_restrictions`, `stream_participants`, `stream_seat_sessions`,
`stream_mutes`, `stream_kicks`, `stream_bans`, `broadcast_officers`.

### Database objects created
Role helpers, audit helper, and the 12 SECURITY DEFINER RPCs
(`moderator_*`, `can_*`, `reset_*`, `remove_stream_broadofficer`, `modo_*`).

### Database objects repaired
Missing columns added idempotently across the tables above; unique/partial
indexes for upserts; widened CHECK constraints on `court_cases` and
`broadcast_mod_actions`.

### RPC signatures created / changed
- `can_set_to_user` changed from `(p_actor_id uuid, p_target_id uuid)` to
  `(p_target_id uuid)` — actor now derived from `auth.uid()`.
- `reset_user_permissions` now returns `jsonb` and derives actor from `auth.uid()`.
- All moderation RPCs derive actor from `auth.uid()`.
- New `modo_arrest`, `modo_suspend_license`, `modo_grant_license`, `modo_end_stream`.

### RLS policies created / changed
Removed broad `auth.uid() IS NOT NULL` ALL policies on `jail`, `court_cases`,
`court_dockets`, `user_driver_licenses`, `broadcast_mod_actions`,
`broadcast_restrictions`. Added SELECT-only policies. Privileged writes now only
via SECURITY DEFINER RPCs / service role.

### Frontend calls replaced
Arrest, license grant/suspend, set-to-user, end-stream, mute, unmute,
disable-chat, kick, remove-officer — all now route through
`invokeModerationAction` → Edge Function. Removed direct `broadcast_mod_actions`,
`jail`, `court_cases`, `court_dockets`, `broadcast_restrictions`,
`user_driver_licenses`, `user_insurances`, `notifications`, `stream_messages`,
`stream_participants`, `stream_seat_sessions` writes from the component.

### Required secrets
`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
(`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` auto-injected).

### Deployment commands
```bash
supabase db push
supabase functions deploy moderation-actions --no-verify-jwt
```

---

## 10. Unresolved schema mismatches

None. All tables referenced by the component exist in the codebase and are
reused. The migration is fully idempotent and safe to re-run.
