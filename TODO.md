# Mod Actions Backend — Implementation Checklist

## Status Legend
- [x] complete
- [ ] in progress / pending

## Migration
- [x] `supabase/migrations/20260809000001_moderation_actions_backend.sql` created (idempotent)
- [x] Role helpers `is_modo_role` / `is_modo_role_in` (only 9 authorized roles)
- [x] Missing columns added idempotently (user_profiles, chat_blocks, stream_messages, broadcast_mod_actions, user_driver_licenses, user_insurances, broadcast_restrictions, user_ip_tracking, court_cases, jail)
- [x] Audit helper `modo_audit`
- [x] Secure RPCs: `moderator_mute_user`, `moderator_unmute_user`, `moderator_disable_chat`, `moderator_kick_user`, `can_user_broadcast`, `can_set_to_user`, `reset_user_permissions`, `remove_stream_broadofficer`
- [x] Backend transactional RPCs: `modo_arrest`, `modo_suspend_license`, `modo_grant_license`, `modo_end_stream`
- [x] RLS tightening on privileged tables
- [x] Realtime publication membership + REPLICA IDENTITY FULL
- [x] Fixed `lastval()` → `v_jail_id` bug in `modo_arrest`
- [x] Self-contained guards for `create_notification` and `is_stream_owner_or_admin`

## Edge Function
- [x] `supabase/functions/moderation-actions/index.ts` rewritten
- [x] Uses only the 9 authorized roles (no old isAdmin/isSecretary/stream_moderators model)
- [x] Requires bearer token + validates user via `auth.getUser()`
- [x] Loads actor DB profile, enforces role server-side
- [x] Routes actions through secure RPCs (service role after auth)
- [x] Guest (non-UUID) kick supported without UUID cast errors
- [x] Consistent `{success, code, message, data}` envelope
- [x] 403 `NOT_AUTHORIZED` for unauthorized roles
- [x] No secrets exposed to browser

## Frontend
- [x] `src/types/moderationActions.ts` created
- [x] `ModActionsPopup.tsx` strict 9-role gating
- [x] Hide Mod Actions tab for non-authorized accounts
- [x] Remove `isPlainUser` filtering (complete denial)
- [x] `invokeModerationAction(payload)` helper using `supabase.functions.invoke`
- [x] Replace direct privileged writes (arrest, license grant/suspend, set_to_user, end_stream)
- [x] Remove temp realtime channel in `handleRemoveOfficer`
- [x] Fix broken end-stream logic (`effectiveStreamId`/`effectiveHostId`)
- [x] Update `GiftBoxModal` props to resolved values

## Documentation
- [x] `MODERATION_BACKEND_SETUP.md` created

## Verification
- [ ] `supabase db push`
- [ ] `supabase functions deploy moderation-actions --no-verify-jwt`
- [ ] TypeScript check on edited component
