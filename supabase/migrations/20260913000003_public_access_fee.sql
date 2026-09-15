-- Migration: Create Public Access Fee System
-- Date: 2026-09-13
-- Description: Creates tables for $1 annual administration fee for public/non-school users

-- 1. Public access fee status enum
CREATE TYPE public_fee_status AS ENUM (
    'not_required',
    'required',
    'pending',
    'paid',
    'expired'
);

-- 2. Public access fee records table
CREATE TABLE IF NOT EXISTS public_access_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    currency TEXT NOT NULL DEFAULT 'USD',
    payment_provider TEXT NOT NULL DEFAULT 'paypal',
    payment_reference TEXT,
    payment_order_id TEXT,
    paid_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    status public_fee_status DEFAULT 'required',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_access_fees_user ON public_access_fees(user_id);
CREATE INDEX IF NOT EXISTS idx_public_access_fees_status ON public_access_fees(status);
CREATE INDEX IF NOT EXISTS idx_public_access_fees_expires ON public_access_fees(expires_at);

-- 3. Add public fee columns to user_profiles
ALTER TABLE user_profiles 
    ADD COLUMN IF NOT EXISTS public_fee_required BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS public_fee_paid BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS public_fee_paid_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS public_fee_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS access_status TEXT DEFAULT 'active';

-- 4. RLS Policies
ALTER TABLE public_access_fees ENABLE ROW LEVEL SECURITY;

-- Users can view their own fee records
CREATE POLICY "Users can view own public fees" 
    ON public_access_fees FOR SELECT 
    USING (auth.uid() = user_id);

-- Users can insert their own fee records (for initial creation)
CREATE POLICY "Users can create own fee records" 
    ON public_access_fees FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Only admins can update fee records (payment verification happens server-side)
CREATE POLICY "Admins can manage public fees" 
    ON public_access_fees FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.is_admin = true
        )
    );

-- 5. Function to determine if user needs public fee
CREATE OR REPLACE FUNCTION user_needs_public_fee(user_id UUID)
RETURNS public_fee_status AS $$
DECLARE
    fee_record public_access_fees%ROWTYPE;
    user_inst_verified BOOLEAN;
BEGIN
    -- Check if institution is verified
    SELECT institution_verified INTO user_inst_verified
    FROM user_profiles WHERE id = user_id;
    
    -- If institution is verified, fee is not required
    IF user_inst_verified = true THEN
        RETURN 'not_required';
    END IF;
    
    -- Check for existing fee record
    SELECT * INTO fee_record
    FROM public_access_fees 
    WHERE public_access_fees.user_id = user_needs_public_fee.user_id
    ORDER BY created_at DESC LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN 'required';
    END IF;
    
    -- Check if expired
    IF fee_record.status = 'paid' AND fee_record.expires_at < now() THEN
        RETURN 'expired';
    END IF;
    
    RETURN fee_record.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;