-- Migration: Create Support Ticket System for Educational Verification
-- Date: 2026-09-13
-- Description: Creates support ticket system for educational verification requests

-- 1. Support ticket status enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_status') THEN
        CREATE TYPE ticket_status AS ENUM (
            'open',
            'pending',
            'resolved',
            'rejected',
            'closed'
        );
    END IF;
END $$;

-- 2. Support ticket priority enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_priority') THEN
        CREATE TYPE ticket_priority AS ENUM (
            'low',
            'normal',
            'high',
            'urgent'
        );
    END IF;
END $$;

-- 3. Support tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    status ticket_status DEFAULT 'open',
    priority ticket_priority DEFAULT 'normal',
    institution_name TEXT,
    institution_email TEXT,
    institution_domain TEXT,
    verification_request BOOLEAN DEFAULT false,
    assigned_to UUID REFERENCES auth.users(id),
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

-- 5. RLS Policies
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Users can view their own tickets
DROP POLICY IF EXISTS "Users can view own tickets" ON support_tickets;
CREATE POLICY "Users can view own tickets" 
    ON support_tickets FOR SELECT 
    USING (auth.uid() = user_id);

-- Users can create tickets
DROP POLICY IF EXISTS "Users can create tickets" ON support_tickets;
CREATE POLICY "Users can create tickets" 
    ON support_tickets FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own open tickets
DROP POLICY IF EXISTS "Users can update own open tickets" ON support_tickets;
CREATE POLICY "Users can update own open tickets" 
    ON support_tickets FOR UPDATE 
    USING (auth.uid() = user_id AND status = 'open');

-- Staff/admins can manage all tickets
DROP POLICY IF EXISTS "Staff can manage tickets" ON support_tickets;
CREATE POLICY "Staff can manage tickets" 
    ON support_tickets FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND (
                user_profiles.is_admin = true 
                OR user_profiles.role IN ('admin', 'moderator', 'troll_officer', 'lead_troll_officer', 'secretary')
            )
        )
    );

-- 6. Function to check if user has open verification ticket
CREATE OR REPLACE FUNCTION has_open_verification_ticket(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM support_tickets 
        WHERE support_tickets.user_id = has_open_verification_ticket.user_id
        AND verification_request = true
        AND status IN ('open', 'pending')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;