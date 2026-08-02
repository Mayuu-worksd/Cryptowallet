-- ==============================================================================
-- FINAL INTEGRATION MIGRATION
-- Safe to run multiple times (IF NOT EXISTS / DO $$ BEGIN ... EXCEPTION WHEN ... END $$)
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run All
-- ==============================================================================

-- 1. admin_bank_accounts — used by fiat deposit to return wire details
CREATE TABLE IF NOT EXISTS public.admin_bank_accounts (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_name            VARCHAR(200) NOT NULL,
    beneficiary_name     VARCHAR(200) NOT NULL,
    account_number       VARCHAR(100) NOT NULL,
    routing_number       VARCHAR(50),
    iban                 VARCHAR(100),
    swift_code           VARCHAR(50),
    currency             VARCHAR(10) NOT NULL DEFAULT 'USD',
    is_active            BOOLEAN DEFAULT true,
    deposit_instructions TEXT,
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.admin_bank_accounts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admin full access bank accounts"
    ON public.admin_bank_accounts FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_admin_bank_accounts_currency ON public.admin_bank_accounts (currency);
CREATE INDEX IF NOT EXISTS idx_admin_bank_accounts_active   ON public.admin_bank_accounts (is_active);

-- 2. transactions — add card_id column (used by webhook transaction.created handler)
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS card_id UUID;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS reference_id TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS description TEXT;

-- Unique index on reference_id for upsert deduplication
DO $$ BEGIN
  CREATE UNIQUE INDEX idx_transactions_reference_id_unique
    ON public.transactions (reference_id)
    WHERE reference_id IS NOT NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. vcc_cards — ensure all Codego columns exist (idempotent)
ALTER TABLE public.vcc_cards ADD COLUMN IF NOT EXISTS codego_card_id  VARCHAR(200);
ALTER TABLE public.vcc_cards ADD COLUMN IF NOT EXISTS codego_status   VARCHAR(50) DEFAULT 'inactive';
ALTER TABLE public.vcc_cards ADD COLUMN IF NOT EXISTS is_physical     BOOLEAN DEFAULT false;
ALTER TABLE public.vcc_cards ADD COLUMN IF NOT EXISTS physical_shipping_status VARCHAR(50) DEFAULT 'not_requested';
ALTER TABLE public.vcc_cards ADD COLUMN IF NOT EXISTS shipping_address JSONB;
ALTER TABLE public.vcc_cards ADD COLUMN IF NOT EXISTS kyc_verified    BOOLEAN DEFAULT false;
ALTER TABLE public.vcc_cards ADD COLUMN IF NOT EXISTS compliance_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE public.vcc_cards ADD COLUMN IF NOT EXISTS expiry_mm_yy    VARCHAR(10);
ALTER TABLE public.vcc_cards ADD COLUMN IF NOT EXISTS card_holder_name VARCHAR(200);
ALTER TABLE public.vcc_cards ADD COLUMN IF NOT EXISTS card_network    VARCHAR(50) DEFAULT 'Visa';
ALTER TABLE public.vcc_cards ADD COLUMN IF NOT EXISTS card_variant    VARCHAR(50) DEFAULT 'classic';
ALTER TABLE public.vcc_cards ADD COLUMN IF NOT EXISTS balance         DECIMAL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE public.vcc_cards
    ADD CONSTRAINT vcc_cards_codego_card_id_unique UNIQUE (codego_card_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_vcc_cards_codego_card_id ON public.vcc_cards (codego_card_id);
CREATE INDEX IF NOT EXISTS idx_vcc_cards_wallet_address ON public.vcc_cards (wallet_address);
CREATE INDEX IF NOT EXISTS idx_vcc_cards_is_physical    ON public.vcc_cards (is_physical);

-- 4. kyc — codego_cardholder_id (idempotent)
ALTER TABLE public.kyc ADD COLUMN IF NOT EXISTS codego_cardholder_id VARCHAR(200);
CREATE INDEX IF NOT EXISTS idx_kyc_codego_cardholder_id ON public.kyc (codego_cardholder_id);

-- 5. fiat_deposits — ensure all columns exist
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

CREATE INDEX IF NOT EXISTS idx_fiat_deposits_reference_code ON public.fiat_deposits (reference_code);
CREATE INDEX IF NOT EXISTS idx_fiat_deposits_user_id        ON public.fiat_deposits (user_id);

-- 6. fiat_withdrawals
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

-- 7. codego_webhooks_log
CREATE TABLE IF NOT EXISTS public.codego_webhooks_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type    VARCHAR(100) NOT NULL,
    payload       JSONB NOT NULL,
    processed     BOOLEAN DEFAULT false,
    error_message TEXT,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.codego_webhooks_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admin full access webhooks_log"
    ON public.codego_webhooks_log FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_webhooks_log_event_type ON public.codego_webhooks_log (event_type);

-- 8. Seed a default USD bank account if none exist (comment out if you have real data)
INSERT INTO public.admin_bank_accounts
    (bank_name, beneficiary_name, account_number, iban, swift_code, currency, is_active, deposit_instructions)
SELECT
    'CryptoWallet Treasury Bank',
    'CryptoWallet Payments Ltd',
    '0000000000',
    'GB00CWLT00000000000000',
    'CWLTGB2L',
    'USD',
    true,
    'Include your reference code in the wire memo field. Transfers without reference code cannot be processed.'
WHERE NOT EXISTS (SELECT 1 FROM public.admin_bank_accounts LIMIT 1);

-- 9. View: KYC users pending Codego sync
CREATE OR REPLACE VIEW public.kyc_pending_codego_sync AS
  SELECT id, wallet_address, full_name, email, status, updated_at AS verified_at
  FROM public.kyc
  WHERE status = 'verified'
    AND (codego_cardholder_id IS NULL OR codego_cardholder_id = '');

COMMENT ON VIEW public.kyc_pending_codego_sync IS
  'Verified KYC users not yet synced to Codego. Admin dashboard Sync button calls /api/codego/applications for each.';

-- Done
