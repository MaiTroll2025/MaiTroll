-- Migration: MAI Business — RLS Policies for New Tables
-- Adds RLS to institutions, collaboration, idea exchange, feed,
-- marketplace, merchandise, credit, recognition, and college battle tables.

BEGIN;

-- =========================================================================
-- Enable RLS on all new tables
-- =========================================================================
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_collaboration_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_idea_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_idea_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_feed_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_college_battle_participation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_college_battle_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_college_weekly_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_merchandise_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_merchandise_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_merchandise_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_recognition_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_college_contributions ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- Institutions: public read, admin write
-- =========================================================================
DROP POLICY IF EXISTS "public read institutions" ON public.institutions;
CREATE POLICY "public read institutions"
  ON public.institutions FOR SELECT USING (true);
DROP POLICY IF EXISTS "admins manage institutions" ON public.institutions;
CREATE POLICY "admins manage institutions"
  ON public.institutions FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );

-- =========================================================================
-- Institution Members: users see only their own membership; admins see all
-- =========================================================================
DROP POLICY IF EXISTS "users view own membership" ON public.institution_members;
CREATE POLICY "users view own membership"
  ON public.institution_members FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "users manage own membership" ON public.institution_members;
CREATE POLICY "users manage own membership"
  ON public.institution_members FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "admins manage memberships" ON public.institution_members;
CREATE POLICY "admins manage memberships"
  ON public.institution_members FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );

-- =========================================================================
-- Collaboration Profiles: users see only own; discoverable flag controls
-- visibility in discovery queries (enforced server-side via RPC)
-- =========================================================================
DROP POLICY IF EXISTS "users view own collab profile" ON public.mai_business_collaboration_profiles;
CREATE POLICY "users view own collab profile"
  ON public.mai_business_collaboration_profiles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "users can create own collab profile" ON public.mai_business_collaboration_profiles;
CREATE POLICY "users can create own collab profile"
  ON public.mai_business_collaboration_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "users can update own collab profile" ON public.mai_business_collaboration_profiles;
CREATE POLICY "users can update own collab profile"
  ON public.mai_business_collaboration_profiles FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "admins read all collab profiles" ON public.mai_business_collaboration_profiles;
CREATE POLICY "admins read all collab profiles"
  ON public.mai_business_collaboration_profiles FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );

-- =========================================================================
-- Idea Exchange Posts: read by authenticated; create/edit by owner;
-- admins/instructors can moderate
-- =========================================================================
DROP POLICY IF EXISTS "authenticated read idea posts" ON public.mai_business_idea_posts;
CREATE POLICY "authenticated read idea posts"
  ON public.mai_business_idea_posts FOR SELECT USING (
    auth.role() = 'authenticated' AND status = 'active');
DROP POLICY IF EXISTS "users manage own idea posts" ON public.mai_business_idea_posts;
CREATE POLICY "users manage own idea posts"
  ON public.mai_business_idea_posts FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "admins and instructors moderate idea posts" ON public.mai_business_idea_posts;
CREATE POLICY "admins and instructors moderate idea posts"
  ON public.mai_business_idea_posts FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
    OR EXISTS (SELECT 1 FROM public.mai_business_profiles mp
               WHERE mp.user_id = auth.uid() AND mp.program_role = 'instructor')
  );

-- =========================================================================
-- Idea Exchange Comments: read by authenticated on active posts;
-- create/edit by owner; admins/instructors moderate
-- =========================================================================
DROP POLICY IF EXISTS "authenticated read idea comments" ON public.mai_business_idea_comments;
CREATE POLICY "authenticated read idea comments"
  ON public.mai_business_idea_comments FOR SELECT USING (
    auth.role() = 'authenticated' AND status = 'active');
DROP POLICY IF EXISTS "users manage own idea comments" ON public.mai_business_idea_comments;
CREATE POLICY "users manage own idea comments"
  ON public.mai_business_idea_comments FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "admins and instructors moderate idea comments" ON public.mai_business_idea_comments;
CREATE POLICY "admins and instructors moderate idea comments"
  ON public.mai_business_idea_comments FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
    OR EXISTS (SELECT 1 FROM public.mai_business_profiles mp
               WHERE mp.user_id = auth.uid() AND mp.program_role = 'instructor')
  );

-- =========================================================================
-- Feed Posts: read by authenticated; create/edit by owner; moderate by admin/instructor
-- =========================================================================
DROP POLICY IF EXISTS "authenticated read feed posts" ON public.mai_business_feed_posts;
CREATE POLICY "authenticated read feed posts"
  ON public.mai_business_feed_posts FOR SELECT USING (
    auth.role() = 'authenticated' AND status = 'active');
DROP POLICY IF EXISTS "users manage own feed posts" ON public.mai_business_feed_posts;
CREATE POLICY "users manage own feed posts"
  ON public.mai_business_feed_posts FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "admins and instructors moderate feed posts" ON public.mai_business_feed_posts;
CREATE POLICY "admins and instructors moderate feed posts"
  ON public.mai_business_feed_posts FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
    OR EXISTS (SELECT 1 FROM public.mai_business_profiles mp
               WHERE mp.user_id = auth.uid() AND mp.program_role = 'instructor')
  );

-- =========================================================================
-- Feed Comments
-- =========================================================================
DROP POLICY IF EXISTS "authenticated read feed comments" ON public.mai_business_feed_comments;
CREATE POLICY "authenticated read feed comments"
  ON public.mai_business_feed_comments FOR SELECT USING (
    auth.role() = 'authenticated' AND status = 'active');
DROP POLICY IF EXISTS "users manage own feed comments" ON public.mai_business_feed_comments;
CREATE POLICY "users manage own feed comments"
  ON public.mai_business_feed_comments FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "admins and instructors moderate feed comments" ON public.mai_business_feed_comments;
CREATE POLICY "admins and instructors moderate feed comments"
  ON public.mai_business_feed_comments FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
    OR EXISTS (SELECT 1 FROM public.mai_business_profiles mp
               WHERE mp.user_id = auth.uid() AND mp.program_role = 'instructor')
  );

-- =========================================================================
-- College Battle Participation: users see only own; admins read all
-- =========================================================================
DROP POLICY IF EXISTS "users view own college battle participation" ON public.mai_business_college_battle_participation;
CREATE POLICY "users view own college battle participation"
  ON public.mai_business_college_battle_participation FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "users can add own participation" ON public.mai_business_college_battle_participation;
CREATE POLICY "users can add own participation"
  ON public.mai_business_college_battle_participation FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "admins read all participation" ON public.mai_business_college_battle_participation;
CREATE POLICY "admins read all participation"
  ON public.mai_business_college_battle_participation FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );

-- =========================================================================
-- College Battle Points: admin/system read; no public insert
-- =========================================================================
DROP POLICY IF EXISTS "admins read college battle points" ON public.mai_business_college_battle_points;
CREATE POLICY "admins read college battle points"
  ON public.mai_business_college_battle_points FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );

-- =========================================================================
-- College Weekly Results: public read for leaderboard; admin/system write
-- =========================================================================
DROP POLICY IF EXISTS "authenticated read weekly results" ON public.mai_business_college_weekly_results;
CREATE POLICY "authenticated read weekly results"
  ON public.mai_business_college_weekly_results FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "admins manage weekly results" ON public.mai_business_college_weekly_results;
CREATE POLICY "admins manage weekly results"
  ON public.mai_business_college_weekly_results FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );

-- =========================================================================
-- Marketplace Listings: read by authenticated; create/edit by seller;
-- admins can manage
-- =========================================================================
DROP POLICY IF EXISTS "authenticated read marketplace listings" ON public.mai_business_marketplace_listings;
CREATE POLICY "authenticated read marketplace listings"
  ON public.mai_business_marketplace_listings FOR SELECT USING (
    auth.role() = 'authenticated' AND status = 'available');
DROP POLICY IF EXISTS "sellers manage own listings" ON public.mai_business_marketplace_listings;
CREATE POLICY "sellers manage own listings"
  ON public.mai_business_marketplace_listings FOR ALL USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);
DROP POLICY IF EXISTS "admins manage marketplace" ON public.mai_business_marketplace_listings;
CREATE POLICY "admins manage marketplace"
  ON public.mai_business_marketplace_listings FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );

-- =========================================================================
-- Marketplace Orders: users view own orders; admins read all
-- =========================================================================
DROP POLICY IF EXISTS "users view own orders as buyer" ON public.mai_business_marketplace_orders;
CREATE POLICY "users view own orders as buyer"
  ON public.mai_business_marketplace_orders FOR SELECT USING (auth.uid() = buyer_id);
DROP POLICY IF EXISTS "users view own orders as seller" ON public.mai_business_marketplace_orders;
CREATE POLICY "users view own orders as seller"
  ON public.mai_business_marketplace_orders FOR SELECT USING (auth.uid() = seller_id);
DROP POLICY IF EXISTS "admins read all orders" ON public.mai_business_marketplace_orders;
CREATE POLICY "admins read all orders"
  ON public.mai_business_marketplace_orders FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );
DROP POLICY IF EXISTS "users can create orders" ON public.mai_business_marketplace_orders;
CREATE POLICY "users can create orders"
  ON public.mai_business_marketplace_orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- =========================================================================
-- Merchandise Products: public read; admin write
-- =========================================================================
DROP POLICY IF EXISTS "public read merchandise products" ON public.mai_business_merchandise_products;
CREATE POLICY "public read merchandise products"
  ON public.mai_business_merchandise_products FOR SELECT USING (true);
DROP POLICY IF EXISTS "admins manage merchandise products" ON public.mai_business_merchandise_products;
CREATE POLICY "admins manage merchandise products"
  ON public.mai_business_merchandise_products FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );

-- =========================================================================
-- Merchandise Orders: users view own; admins read all
-- =========================================================================
DROP POLICY IF EXISTS "users view own merchandise orders" ON public.mai_business_merchandise_orders;
CREATE POLICY "users view own merchandise orders"
  ON public.mai_business_merchandise_orders FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "admins read all merchandise orders" ON public.mai_business_merchandise_orders;
CREATE POLICY "admins read all merchandise orders"
  ON public.mai_business_merchandise_orders FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );
DROP POLICY IF EXISTS "users can create merchandise orders" ON public.mai_business_merchandise_orders;
CREATE POLICY "users can create merchandise orders"
  ON public.mai_business_merchandise_orders FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =========================================================================
-- Merchandise Order Items: read via parent orders (no direct public access)
-- =========================================================================
DROP POLICY IF EXISTS "users view own order items" ON public.mai_business_merchandise_order_items;
CREATE POLICY "users view own order items"
  ON public.mai_business_merchandise_order_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.mai_business_merchandise_orders o
            WHERE o.id = mai_business_merchandise_order_items.order_id
              AND (o.user_id = auth.uid()
                   OR EXISTS (SELECT 1 FROM public.user_profiles p
                              WHERE p.id = auth.uid()
                                AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))))
  );

-- =========================================================================
-- Credit Accounts: users view own; admins read all; system writes only
-- =========================================================================
DROP POLICY IF EXISTS "users view own credit account" ON public.mai_business_credit_accounts;
CREATE POLICY "users view own credit account"
  ON public.mai_business_credit_accounts FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "admins read all credit accounts" ON public.mai_business_credit_accounts;
CREATE POLICY "admins read all credit accounts"
  ON public.mai_business_credit_accounts FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );
DROP POLICY IF EXISTS "system manages credit accounts" ON public.mai_business_credit_accounts;
CREATE POLICY "system manages credit accounts"
  ON public.mai_business_credit_accounts FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );

-- =========================================================================
-- Credit Transactions: users view own; admins read all
-- =========================================================================
DROP POLICY IF EXISTS "users view own credit transactions" ON public.mai_business_credit_transactions;
CREATE POLICY "users view own credit transactions"
  ON public.mai_business_credit_transactions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "admins read all credit transactions" ON public.mai_business_credit_transactions;
CREATE POLICY "admins read all credit transactions"
  ON public.mai_business_credit_transactions FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );
DROP POLICY IF EXISTS "system manages credit transactions" ON public.mai_business_credit_transactions;
CREATE POLICY "system manages credit transactions"
  ON public.mai_business_credit_transactions FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );

-- =========================================================================
-- Recognition Requests: users view own requests; instructors create
-- recommendations; admins review
-- =========================================================================
DROP POLICY IF EXISTS "users view own recognition requests" ON public.mai_business_recognition_requests;
CREATE POLICY "users view own recognition requests"
  ON public.mai_business_recognition_requests FOR SELECT USING (
    auth.uid() = student_id OR auth.uid() = instructor_id);
DROP POLICY IF EXISTS "instructors can create recognition requests" ON public.mai_business_recognition_requests;
CREATE POLICY "instructors can create recognition requests"
  ON public.mai_business_recognition_requests FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.mai_business_profiles mp
            WHERE mp.user_id = auth.uid() AND mp.program_role = 'instructor')
    AND auth.uid() = instructor_id);
DROP POLICY IF EXISTS "admins manage recognition requests" ON public.mai_business_recognition_requests;
CREATE POLICY "admins manage recognition requests"
  ON public.mai_business_recognition_requests FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );

-- =========================================================================
-- College Contributions: admins read/write only
-- =========================================================================
DROP POLICY IF EXISTS "admins manage college contributions" ON public.mai_business_college_contributions;
CREATE POLICY "admins manage college contributions"
  ON public.mai_business_college_contributions FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );

COMMIT;
