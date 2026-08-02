-- ============================================================================
-- KRIPICARD TRANSACTION AUTHORIZATION SCHEMA
--
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

-- 1. Create transaction_authorizations table
CREATE TABLE IF NOT EXISTS public.transaction_authorizations (
    authorization_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id TEXT NOT NULL UNIQUE,
    wallet_address TEXT NOT NULL,
    user_id UUID,
    otp_reference TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'rejected', 'expired')),
    attempts INT DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    authorized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Checkout/merchant information
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'USD',
    merchant TEXT NOT NULL DEFAULT 'Merchant',
    card_last4 TEXT NOT NULL DEFAULT '0000',
    provider_card_id TEXT
);

-- 2. Create transaction_authorization_logs table for audit tracking
CREATE TABLE IF NOT EXISTS public.transaction_authorization_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authorization_id UUID REFERENCES public.transaction_authorizations(authorization_id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'created', 'otp_sent', 'otp_resent', 'verified_success', 'verified_failed', 'rejected', 'expired'
    details JSONB DEFAULT '{}'::JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and setup policies
ALTER TABLE public.transaction_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_authorization_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access on auths" ON public.transaction_authorizations;
CREATE POLICY "Admins full access on auths" ON public.transaction_authorizations FOR ALL USING (true);

DROP POLICY IF EXISTS "Admins full access on logs" ON public.transaction_authorization_logs;
CREATE POLICY "Admins full access on logs" ON public.transaction_authorization_logs FOR ALL USING (true);

-- Grant permissions to standard roles
GRANT ALL ON public.transaction_authorizations TO anon, authenticated, service_role;
GRANT ALL ON public.transaction_authorization_logs TO anon, authenticated, service_role;
