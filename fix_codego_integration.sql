-- ==============================================================================
-- CODEGO INTEGRATION FIX MIGRATION
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run All
-- Safe to run multiple times — all use IF NOT EXISTS / ON CONFLICT DO NOTHING
-- ==============================================================================

-- 1. codego_cardholder_id on kyc table
ALTER TABLE public.kyc ADD COLUMN IF NOT EXISTS codego_cardholder_id VARCHAR(200);

-- 2. Codego tracking columns on vcc_cards
ALTER TABLE public.vcc_cards ADD COLUMN IF NOT EXISTS codego_card_id VARCHAR(200);
ALTER TABLE public.vcc_cards ADD COLUMN IF NOT EXISTS codego_status VARCHAR(50) DEFAULT 'inactive';

-- 3. Unique constraint — prevent duplicate Codego card mappings
DO $$ BEGIN
  ALTER TABLE public.vcc_cards
    ADD CONSTRAINT vcc_cards_codego_card_id_unique UNIQUE (codego_card_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. reference_id on transactions for webhook deduplication
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS reference_id TEXT;

DO $$ BEGIN
  CREATE UNIQUE INDEX idx_transactions_reference_id
    ON public.transactions (reference_id)
    WHERE reference_id IS NOT NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. codego_webhooks_log table
CREATE TABLE IF NOT EXISTS public.codego_webhooks_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type  VARCHAR(100) NOT NULL,
    payload     JSONB NOT NULL,
    processed   BOOLEAN DEFAULT false,
    error_message TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.codego_webhooks_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admin full access webhooks_log"
    ON public.codego_webhooks_log FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. fiat_deposits — references vcc_cards(id)
CREATE TABLE IF NOT EXISTS public.fiat_deposits (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL,
    codego_card_id   UUID REFERENCES public.vcc_cards(id) ON DELETE SET NULL,
    amount           DECIMAL NOT NULL,
    currency         VARCHAR(10) NOT NULL DEFAULT 'USD',
    reference_code   VARCHAR(100) UNIQUE NOT NULL,
    status           VARCHAR(20) DEFAULT 'pending',
    codego_deposit_id VARCHAR(200),
    bank_iban        VARCHAR(100),
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.fiat_deposits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Enable all access fiat_deposits"
    ON public.fiat_deposits FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 7. fiat_withdrawals — references vcc_cards(id)
CREATE TABLE IF NOT EXISTS public.fiat_withdrawals (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL,
    codego_card_id       UUID REFERENCES public.vcc_cards(id) ON DELETE SET NULL,
    amount               DECIMAL NOT NULL,
    currency             VARCHAR(10) NOT NULL DEFAULT 'USD',
    destination_iban     VARCHAR(200) NOT NULL,
    destination_bic      VARCHAR(50) NOT NULL,
    destination_name     VARCHAR(200) NOT NULL,
    status               VARCHAR(20) DEFAULT 'pending',
    codego_withdrawal_id VARCHAR(200),
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.fiat_withdrawals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Enable all access fiat_withdrawals"
    ON public.fiat_withdrawals FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8. codego_card_pin_audits — references vcc_cards(id), no auth.users dependency
CREATE TABLE IF NOT EXISTS public.codego_card_pin_audits (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id    UUID NOT NULL REFERENCES public.vcc_cards(id) ON DELETE CASCADE,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.codego_card_pin_audits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Enable all access pin_audits"
    ON public.codego_card_pin_audits FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 9. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_vcc_cards_codego_card_id     ON public.vcc_cards (codego_card_id);
CREATE INDEX IF NOT EXISTS idx_kyc_codego_cardholder_id     ON public.kyc (codego_cardholder_id);
CREATE INDEX IF NOT EXISTS idx_fiat_deposits_reference_code ON public.fiat_deposits (reference_code);
CREATE INDEX IF NOT EXISTS idx_webhooks_log_event_type      ON public.codego_webhooks_log (event_type);

-- 10. View: verified users not yet synced to Codego
CREATE OR REPLACE VIEW public.kyc_pending_codego_sync AS
  SELECT id, wallet_address, full_name, email, status, updated_at AS verified_at
  FROM public.kyc
  WHERE status = 'verified'
    AND (codego_cardholder_id IS NULL OR codego_cardholder_id = '');

COMMENT ON VIEW public.kyc_pending_codego_sync IS
  'Verified KYC users not yet synced to Codego. Use admin dashboard Sync button to trigger /applications for each.';

-- 11. Helper function for admin dashboard
CREATE OR REPLACE FUNCTION public.get_unsynced_codego_users()
RETURNS TABLE(wallet_address TEXT, full_name TEXT, email TEXT, verified_at TIMESTAMP WITH TIME ZONE)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT wallet_address, full_name, email, updated_at
  FROM public.kyc
  WHERE status = 'verified'
    AND (codego_cardholder_id IS NULL OR codego_cardholder_id = '')
  ORDER BY updated_at DESC;
$$;
