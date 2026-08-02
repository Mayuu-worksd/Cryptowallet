-- ============================================================================
-- KRIPICARD PRODUCTION INTEGRATION & PROVIDER MAPPING SCHEMA
--
-- Creates & enhances provider mapping between Users and KripiCard Cards
-- Storing: provider, provider_card_id, status, last4, bin, balance,
--          created_at, updated_at, provider_response
-- ============================================================================

-- 1. Ensure provider_cards table exists with complete fields
CREATE TABLE IF NOT EXISTS public.provider_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    provider_name TEXT NOT NULL DEFAULT 'kripicard',
    provider_card_id TEXT NOT NULL UNIQUE,
    card_holder_name TEXT NOT NULL DEFAULT 'CARD HOLDER',
    card_last4 TEXT NOT NULL DEFAULT '0000',
    expiry_mm_yy TEXT NOT NULL DEFAULT '12/28',
    card_type TEXT NOT NULL DEFAULT 'virtual',
    card_variant TEXT DEFAULT 'classic',
    status TEXT NOT NULL DEFAULT 'active',
    provider_status TEXT DEFAULT 'active',
    currency TEXT NOT NULL DEFAULT 'USD',
    balance NUMERIC(18, 2) DEFAULT 0.00,
    bin TEXT DEFAULT '1',
    is_mock BOOLEAN DEFAULT false,
    provider_response JSONB DEFAULT '{}'::JSONB,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns if provider_cards already existed
DO $$
BEGIN
    ALTER TABLE public.provider_cards ADD COLUMN IF NOT EXISTS bin TEXT DEFAULT '1';
    ALTER TABLE public.provider_cards ADD COLUMN IF NOT EXISTS provider_response JSONB DEFAULT '{}'::JSONB;
    ALTER TABLE public.provider_cards ADD COLUMN IF NOT EXISTS provider_status TEXT DEFAULT 'active';
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- 2. Enhance vcc_cards table to ensure parity
DO $$
BEGIN
    ALTER TABLE public.vcc_cards ADD COLUMN IF NOT EXISTS provider_name TEXT DEFAULT 'kripicard';
    ALTER TABLE public.vcc_cards ADD COLUMN IF NOT EXISTS bin TEXT DEFAULT '1';
    ALTER TABLE public.vcc_cards ADD COLUMN IF NOT EXISTS provider_response JSONB DEFAULT '{}'::JSONB;
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- 3. Create indexes for fast lookup by wallet and provider card ID
CREATE INDEX IF NOT EXISTS idx_provider_cards_wallet_lower ON public.provider_cards(LOWER(wallet_address));
CREATE INDEX IF NOT EXISTS idx_provider_cards_provider_card_id ON public.provider_cards(provider_name, provider_card_id);

-- 4. Enable RLS and setup policies
ALTER TABLE public.provider_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access on provider_cards" ON public.provider_cards;
CREATE POLICY "Admins full access on provider_cards" ON public.provider_cards
    FOR ALL USING (true);

DROP POLICY IF EXISTS "Users view own provider cards" ON public.provider_cards;
CREATE POLICY "Users view own provider cards" ON public.provider_cards
    FOR SELECT USING (LOWER(wallet_address) = LOWER(auth.jwt() ->> 'wallet_address'));
