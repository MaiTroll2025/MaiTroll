-- Migration: MAI Business — Performance Indexes for Extended Tables

BEGIN;

-- Institutions
CREATE INDEX IF NOT EXISTS idx_institutions_domain ON public.institutions(domain);
CREATE INDEX IF NOT EXISTS idx_institutions_type ON public.institutions(institution_type);
CREATE INDEX IF NOT EXISTS idx_institutions_verified ON public.institutions(is_verified);

-- Institution Members
CREATE INDEX IF NOT EXISTS idx_inst_members_user_id ON public.institution_members(user_id);
CREATE INDEX IF NOT EXISTS idx_inst_members_inst_id ON public.institution_members(institution_id);
CREATE INDEX IF NOT EXISTS idx_inst_members_type ON public.institution_members(membership_type);
CREATE INDEX IF NOT EXISTS idx_inst_members_user_inst ON public.institution_members(user_id, institution_id);
CREATE INDEX IF NOT EXISTS idx_inst_members_verified ON public.institution_members(is_verified);

-- Collaboration Profiles
CREATE INDEX IF NOT EXISTS idx_mai_collab_user_id ON public.mai_business_collaboration_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_collab_discoverable ON public.mai_business_collaboration_profiles(is_discoverable);
CREATE INDEX IF NOT EXISTS idx_mai_collab_institution ON public.mai_business_collaboration_profiles(institution_id);

-- Idea Exchange Posts
CREATE INDEX IF NOT EXISTS idx_mai_idea_posts_user_id ON public.mai_business_idea_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_idea_posts_category ON public.mai_business_idea_posts(category);
CREATE INDEX IF NOT EXISTS idx_mai_idea_posts_created_at ON public.mai_business_idea_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mai_idea_posts_status ON public.mai_business_idea_posts(status);

-- Idea Exchange Comments
CREATE INDEX IF NOT EXISTS idx_mai_idea_comments_post_id ON public.mai_business_idea_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_mai_idea_comments_user_id ON public.mai_business_idea_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_idea_comments_parent ON public.mai_business_idea_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_mai_idea_comments_created_at ON public.mai_business_idea_comments(created_at DESC);

-- Feed Posts
CREATE INDEX IF NOT EXISTS idx_mai_feed_posts_user_id ON public.mai_business_feed_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_feed_posts_scope ON public.mai_business_feed_posts(scope);
CREATE INDEX IF NOT EXISTS idx_mai_feed_posts_created_at ON public.mai_business_feed_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mai_feed_posts_institution ON public.mai_business_feed_posts(institution_id);

-- Feed Comments
CREATE INDEX IF NOT EXISTS idx_mai_feed_comments_post_id ON public.mai_business_feed_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_mai_feed_comments_user_id ON public.mai_business_feed_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_feed_comments_parent ON public.mai_business_feed_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_mai_feed_comments_created_at ON public.mai_business_feed_comments(created_at DESC);

-- College Battle Participation
CREATE INDEX IF NOT EXISTS idx_mai_battle_part_user_id ON public.mai_business_college_battle_participation(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_battle_part_institution ON public.mai_business_college_battle_participation(institution_id);
CREATE INDEX IF NOT EXISTS idx_mai_battle_part_battle_id ON public.mai_business_college_battle_participation(battle_id);

-- College Battle Points
CREATE INDEX IF NOT EXISTS idx_mai_battle_points_institution ON public.mai_business_college_battle_points(institution_id);
CREATE INDEX IF NOT EXISTS idx_mai_battle_points_battle_id ON public.mai_business_college_battle_points(battle_id);
CREATE INDEX IF NOT EXISTS idx_mai_battle_points_user_id ON public.mai_business_college_battle_points(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_battle_points_recorded_at ON public.mai_business_college_battle_points(recorded_at DESC);

-- College Weekly Results
CREATE INDEX IF NOT EXISTS idx_mai_weekly_results_week ON public.mai_business_college_weekly_results(week_start DESC);
CREATE INDEX IF NOT EXISTS idx_mai_weekly_results_institution ON public.mai_business_college_weekly_results(institution_id);
CREATE INDEX IF NOT EXISTS idx_mai_weekly_results_rank ON public.mai_business_college_weekly_results(week_start, rank_position);

-- Marketplace Listings
CREATE INDEX IF NOT EXISTS idx_mai_marketplace_seller ON public.mai_business_marketplace_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_mai_marketplace_category ON public.mai_business_marketplace_listings(category);
CREATE INDEX IF NOT EXISTS idx_mai_marketplace_status ON public.mai_business_marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_mai_marketplace_created_at ON public.mai_business_marketplace_listings(created_at DESC);

-- Marketplace Orders
CREATE INDEX IF NOT EXISTS idx_mai_marketplace_orders_buyer ON public.mai_business_marketplace_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_mai_marketplace_orders_seller ON public.mai_business_marketplace_orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_mai_marketplace_orders_status ON public.mai_business_marketplace_orders(status);
CREATE INDEX IF NOT EXISTS idx_mai_marketplace_orders_created_at ON public.mai_business_marketplace_orders(created_at DESC);

-- Merchandise Products
CREATE INDEX IF NOT EXISTS idx_mai_merch_products_category ON public.mai_business_merchandise_products(category);
CREATE INDEX IF NOT EXISTS idx_mai_merch_products_active ON public.mai_business_merchandise_products(is_active);

-- Merchandise Orders
CREATE INDEX IF NOT EXISTS idx_mai_merch_orders_user_id ON public.mai_business_merchandise_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_merch_orders_status ON public.mai_business_merchandise_orders(status);
CREATE INDEX IF NOT EXISTS idx_mai_merch_orders_created_at ON public.mai_business_merchandise_orders(created_at DESC);

-- Merchandise Order Items
CREATE INDEX IF NOT EXISTS idx_mai_merch_order_items_order ON public.mai_business_merchandise_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_mai_merch_order_items_product ON public.mai_business_merchandise_order_items(product_id);

-- Credit Accounts
CREATE INDEX IF NOT EXISTS idx_mai_credit_accounts_user_id ON public.mai_business_credit_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_credit_accounts_status ON public.mai_business_credit_accounts(status);

-- Credit Transactions
CREATE INDEX IF NOT EXISTS idx_mai_credit_txns_account ON public.mai_business_credit_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_mai_credit_txns_user_id ON public.mai_business_credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_credit_txns_created_at ON public.mai_business_credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mai_credit_txns_actor_id ON public.mai_business_credit_transactions(actor_id);

-- Recognition Requests
CREATE INDEX IF NOT EXISTS idx_mai_recognition_student ON public.mai_business_recognition_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_mai_recognition_instructor ON public.mai_business_recognition_requests(instructor_id);
CREATE INDEX IF NOT EXISTS idx_mai_recognition_status ON public.mai_business_recognition_requests(status);

-- College Contributions
CREATE INDEX IF NOT EXISTS idx_mai_contributions_week ON public.mai_business_college_contributions(week_start);
CREATE INDEX IF NOT EXISTS idx_mai_contributions_institution ON public.mai_business_college_contributions(institution_id);
CREATE INDEX IF NOT EXISTS idx_mai_contributions_status ON public.mai_business_college_contributions(status);

COMMIT;
