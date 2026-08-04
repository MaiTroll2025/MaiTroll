-- Add deleted_at column to manual_coin_orders for soft delete support
-- This allows admins to "delete" orders without breaking transaction history references.

ALTER TABLE public.manual_coin_orders
ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Update RLS policies to optionally exclude deleted orders?
-- Usually RLS is for security. For soft delete, we usually just filter in the query.
-- But if we want to hide them from normal users, we can add it to the policy.
-- "Users can view own orders" -> Should they see deleted ones? Probably doesn't matter if they are deleted by admin.
-- If user deletes? Users can't delete. Only admins.

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_manual_orders_deleted_at ON public.manual_coin_orders(deleted_at);
