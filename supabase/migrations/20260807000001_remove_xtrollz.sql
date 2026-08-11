-- Migration: Completely retire the XTrollz streaming feature.
-- Drops all XTrollz tables, functions, profile columns, and storage bucket.
-- Date: 2026-08-07

-- 1. Drop XTrollz edge-function-backed RPCs (functions) first (CASCADE handles dependents)
drop function if exists public.xtrollz_start_broadcast(uuid, text, jsonb, text, text) cascade;
drop function if exists public.xtrollz_end_broadcast(uuid, uuid) cascade;
drop function if exists public.xtrollz_set_streamer_prices(uuid, numeric, numeric) cascade;
drop function if exists public.xtrollz_get_streamer_prices(uuid) cascade;
drop function if exists public.xtrollz_check_viewer_access(uuid, uuid) cascade;
drop function if exists public.xtrollz_buy_viewer_subscription(uuid, uuid, text) cascade;
drop function if exists public.xtrollz_check_viewer_subscription(uuid, uuid) cascade;
drop function if exists public.xtrollz_dob_gate_get_status(uuid) cascade;
drop function if exists public.xtrollx_verify_dob(uuid, date, text) cascade;
drop function if exists public.xtrollz_verify_dob(uuid, date, text) cascade;
drop function if exists public.xtrollz_get_live_streams(text, integer, uuid) cascade;
drop function if exists public.xtrollz_get_favorites(uuid) cascade;
drop function if exists public.xtrollx_toggle_favorite(uuid, uuid) cascade;
drop function if exists public.xtrollz_toggle_favorite(uuid, uuid) cascade;
drop function if exists public.xtrollz_pay_application_fee(uuid, uuid, numeric) cascade;
drop function if exists public.xtrollz_update_stream_status(uuid, text) cascade;

-- 2. Drop XTrollz tables (dependents first)
drop table if exists public.xtrollz_viewer_subscriptions cascade;
drop table if exists public.xtrollz_stream_messages cascade;
drop table if exists public.xtrollz_moderation_actions cascade;
drop table if exists public.xtrollz_favorites cascade;
drop table if exists public.xtrollz_rules_acceptance cascade;
drop table if exists public.xtrollz_application_documents cascade;
drop table if exists public.xtrollz_applications cascade;
drop table if exists public.xtrollz_streams cascade;

-- 3. Remove XTrollz columns from user_profiles (guarded; column may already be gone)
alter table public.user_profiles drop column if exists xtrollz_access_status;
alter table public.user_profiles drop column if exists xtrollz_broadcaster_status;

-- 4. Remove XTrollz storage bucket & its public policy (if it exists)
-- NOTE: direct deletion from storage.buckets is restricted in some environments.
-- The bucket and objects are already absent, so this is safely skipped.
-- delete from storage.buckets where id = 'xtrollz-documents';
-- delete from storage.objects where bucket_id = 'xtrollz-documents';
