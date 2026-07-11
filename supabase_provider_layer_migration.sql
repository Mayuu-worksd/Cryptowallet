-- ============================================================================
-- SUPABASE PROVIDER LAYER MIGRATION
-- Architecture: Provider-Independent Card Storage
--
-- Requirement 8: Store ONLY provider-independent data in Supabase:
--   User ID / Wallet Address, Card ID, Provider Name, Last 4, Expiration MM/YY,
--   Status, Card Type (virtual/physical), Created At.
--   NEVER store sensitive card data (full PAN, CVV, PINs) in Supabase.
-- ============================================================================

-- 1. Provider-agnostic Cardholders Table
CREATE TABLE IF NOT EXISTS public.provider_cardholders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL UNIQUE,
    provider_name TEXT NOT NULL DEFAULT 'codego',       -- 'kripicard', 'codego', 'rain', etc.
    provider_cardholder_id TEXT NOT NULL,               -- External provider KYC ID
    kyc_status TEXT NOT NULL DEFAULT 'pending',         -- 'approved', 'pending', 'rejected'
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_cardholders_wallet ON public.provider_cardholders(LOWER(wallet_address));
CREATE INDEX IF NOT EXISTS idx_provider_cardholders_provider_id ON public.provider_cardholders(provider_name, provider_cardholder_id);

-- 2. Provider-agnostic Cards Table
CREATE TABLE IF NOT EXISTS public.provider_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    provider_name TEXT NOT NULL,                        -- Name of provider ('kripicard', 'codego', etc.)
    provider_card_id TEXT NOT NULL UNIQUE,              -- External card ID assigned by provider
    card_holder_name TEXT NOT NULL,
    card_last4 TEXT NOT NULL CHECK (char_length(card_last4) = 4),
    expiry_mm_yy TEXT NOT NULL,
    card_type TEXT NOT NULL CHECK (card_type IN ('virtual', 'physical')),
    card_variant TEXT DEFAULT 'classic',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'blocked', 'pending', 'terminated')),
    provider_status TEXT,
    currency TEXT NOT NULL DEFAULT 'USD',
    balance NUMERIC(18, 2) DEFAULT 0.00,
    is_mock BOOLEAN DEFAULT false,                      -- True if sandbox/local simulation
    metadata JSONB DEFAULT '{}'::JSONB,                 -- Non-sensitive provider metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_cards_wallet ON public.provider_cards(LOWER(wallet_address));
CREATE INDEX IF NOT EXISTS idx_provider_cards_provider_id ON public.provider_cards(provider_name, provider_card_id);

-- 3. Row-Level Security (RLS) Policies
ALTER TABLE public.provider_cardholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_cards ENABLE ROW LEVEL SECURITY;

-- Admins and service roles can manage all records
CREATE POLICY "Admins full access on provider_cardholders" ON public.provider_cardholders
    FOR ALL USING (auth.role() = 'service_role' OR auth.uid() IN (SELECT id FROM auth.users WHERE is_super_admin = true));

CREATE POLICY "Admins full access on provider_cards" ON public.provider_cards
    FOR ALL USING (auth.role() = 'service_role' OR auth.uid() IN (SELECT id FROM auth.users WHERE is_super_admin = true));

-- Users can view their own card metadata
CREATE POLICY "Users view own cardholders" ON public.provider_cardholders
    FOR SELECT USING (LOWER(wallet_address) = LOWER(auth.jwt() ->> 'wallet_address'));

CREATE POLICY "Users view own provider cards" ON public.provider_cards
    FOR SELECT USING (LOWER(wallet_address) = LOWER(auth.jwt() ->> 'wallet_address'));

-- 4. Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_provider_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_provider_cardholders_timestamp ON public.provider_cardholders;
CREATE TRIGGER trigger_update_provider_cardholders_timestamp
    BEFORE UPDATE ON public.provider_cardholders
    FOR EACH ROW EXECUTE FUNCTION update_provider_timestamp();

DROP TRIGGER IF EXISTS trigger_update_provider_cards_timestamp ON public.provider_cards;
CREATE TRIGGER trigger_update_provider_cards_timestamp
    BEFORE UPDATE ON public.provider_cards
    FOR EACH ROW EXECUTE FUNCTION update_provider_timestamp();
