-- Seed Data for Mai Troll Test Environment
-- Usage: Run this in the Supabase SQL Editor to populate test data.

-- 1. Create Test Users (Passwords handled by Auth, these are profiles)
-- Note: In a real Supabase local env, you'd use auth.users too, but for SQL editor we just seed profiles
-- We assume these UUIDs are fixed for testing stability

-- Admin User
INSERT INTO public.user_profiles (id, username, email, role, is_admin, troll_coins, created_at)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'admin_boss', 'admin@Mai Troll.app', 'admin', true, 1000000, now())
ON CONFLICT (id) DO NOTHING;

-- Lead Officer
INSERT INTO public.user_profiles (id, username, email, role, is_lead_officer, troll_coins, created_at)
VALUES 
  ('a0000000-0000-0000-0000-000000000002', 'officer_chief', 'chief@Mai Troll.app', 'lead_troll_officer', true, 50000, now())
ON CONFLICT (id) DO NOTHING;

-- Standard Streamer
INSERT INTO public.user_profiles (id, username, email, role, is_streamer, troll_coins, total_earned_coins, created_at)
VALUES 
  ('a0000000-0000-0000-0000-000000000003', 'cool_streamer', 'streamer@test.com', 'user', true, 5000, 150000, now() - interval '30 days')
ON CONFLICT (id) DO NOTHING;

-- Rich Viewer
INSERT INTO public.user_profiles (id, username, email, role, troll_coins, created_at)
VALUES 
  ('a0000000-0000-0000-0000-000000000004', 'rich_viewer', 'viewer@test.com', 'user', 500000, now())
ON CONFLICT (id) DO NOTHING;

-- 2. Create Tax Info (for Streamer)
INSERT INTO public.user_tax_info (user_id, legal_full_name, w9_status, tax_classification)
VALUES 
  ('a0000000-0000-0000-0000-000000000003', 'Cool Streamer LLC', 'verified', 'corporation')
ON CONFLICT (user_id) DO NOTHING;

-- 3. Create Payout Requests (to test Admin Panel)
-- Pending Request
INSERT INTO public.payout_requests (id, user_id, requested_coins, cash_amount, status, payout_method, requested_at)
VALUES
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000003', 10000, 100.00, 'pending', 'PayPal', now() - interval '2 hours')
ON CONFLICT DO NOTHING;

-- Approved Request
INSERT INTO public.payout_requests (id, user_id, requested_coins, cash_amount, status, payout_method, requested_at, reviewed_by, updated_at)
VALUES
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000003', 5000, 50.00, 'approved', 'PayPal', now() - interval '1 day', 'a0000000-0000-0000-0000-000000000001', now() - interval '20 hours')
ON CONFLICT DO NOTHING;

-- 4. Create Active Stream
INSERT INTO public.streams (id, user_id, title, is_live, viewer_count, created_at)
VALUES
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000003', 'Testing the Matrix 🔴', true, 42, now())
ON CONFLICT DO NOTHING;

-- 5. Create Action Logs (History)
INSERT INTO public.action_logs (actor_id, action_type, details, created_at)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'system_init', '{"msg": "Test environment seeded"}', now())
ON CONFLICT DO NOTHING;

