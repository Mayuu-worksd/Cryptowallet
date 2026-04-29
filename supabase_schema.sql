-- ─────────────────────────────────────────────────────────────────────────────
-- CryptoWallet — Supabase Schema v4
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run
-- Safe to re-run (uses IF NOT EXISTS / DO NOTHING)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. KYC table upgrades ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kyc (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address   TEXT        UNIQUE NOT NULL,
  full_name        TEXT        NOT NULL DEFAULT '',
  email            TEXT        NOT NULL DEFAULT '',
  phone            TEXT        NOT NULL DEFAULT '',
  address          TEXT        NOT NULL DEFAULT '',
  nationality      TEXT        NOT NULL DEFAULT '',
  dob              TEXT        NOT NULL DEFAULT '',
  document_type    TEXT        NOT NULL DEFAULT '',
  document_url     TEXT,
  selfie_url       TEXT,
  selfie_video_url TEXT,
  unique_code      TEXT,
  status           TEXT        NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'under_review', 'verified', 'rejected')),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE kyc ADD COLUMN IF NOT EXISTS email            TEXT NOT NULL DEFAULT '';
ALTER TABLE kyc ADD COLUMN IF NOT EXISTS selfie_video_url TEXT;
ALTER TABLE kyc ADD COLUMN IF NOT EXISTS unique_code      TEXT;
ALTER TABLE kyc ADD COLUMN IF NOT EXISTS full_name        TEXT NOT NULL DEFAULT '';
ALTER TABLE kyc ADD COLUMN IF NOT EXISTS nationality      TEXT NOT NULL DEFAULT '';
ALTER TABLE kyc ADD COLUMN IF NOT EXISTS dob              TEXT NOT NULL DEFAULT '';
ALTER TABLE kyc ADD COLUMN IF NOT EXISTS document_type    TEXT NOT NULL DEFAULT '';
ALTER TABLE kyc ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE kyc DROP COLUMN IF EXISTS name;
ALTER TABLE kyc DROP COLUMN IF EXISTS verification_code;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS kyc_updated_at ON kyc;
CREATE TRIGGER kyc_updated_at
  BEFORE UPDATE ON kyc
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 2. Cards table (virtual card — secure) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS cards (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT        UNIQUE NOT NULL,
  card_last4     TEXT        NOT NULL DEFAULT '0000',
  expiry_month   TEXT        NOT NULL DEFAULT '12',
  expiry_year    TEXT        NOT NULL DEFAULT '28',
  card_type      TEXT        NOT NULL DEFAULT 'classic',
  balance        NUMERIC(12,2) NOT NULL DEFAULT 0,
  status         TEXT        NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'frozen')),
  holder_name    TEXT        NOT NULL DEFAULT 'CARD HOLDER',
  design         TEXT        NOT NULL DEFAULT 'dark',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cards ADD COLUMN IF NOT EXISTS card_last4   TEXT NOT NULL DEFAULT '0000';
ALTER TABLE cards ADD COLUMN IF NOT EXISTS expiry_month TEXT NOT NULL DEFAULT '12';
ALTER TABLE cards ADD COLUMN IF NOT EXISTS expiry_year  TEXT NOT NULL DEFAULT '28';
ALTER TABLE cards ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE cards DROP COLUMN IF EXISTS card_number;
ALTER TABLE cards DROP COLUMN IF EXISTS expiry;

DROP TRIGGER IF EXISTS cards_updated_at ON cards;
CREATE TRIGGER cards_updated_at
  BEFORE UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 3. Card variants table (upgraded for VCC) ────────────────────────────────
CREATE TABLE IF NOT EXISTS card_variants (
  id                    TEXT        PRIMARY KEY,
  name                  TEXT        NOT NULL,
  variant_name          TEXT        NOT NULL DEFAULT '',
  network               TEXT        NOT NULL DEFAULT 'Visa',
  features              TEXT[]      NOT NULL DEFAULT '{}',
  price                 NUMERIC(8,2) NOT NULL DEFAULT 0,
  annual_fee_usd        NUMERIC(8,2) NOT NULL DEFAULT 0,
  transaction_limit_usd NUMERIC(12,2) NOT NULL DEFAULT 5000,
  design_url            TEXT        NOT NULL DEFAULT '',
  color_hex             TEXT        NOT NULL DEFAULT '#2A2B31',
  card_color_hex        TEXT        NOT NULL DEFAULT '#2A2B31',
  is_active             BOOLEAN     NOT NULL DEFAULT true
);

ALTER TABLE card_variants ADD COLUMN IF NOT EXISTS variant_name          TEXT NOT NULL DEFAULT '';
ALTER TABLE card_variants ADD COLUMN IF NOT EXISTS network               TEXT NOT NULL DEFAULT 'Visa';
ALTER TABLE card_variants ADD COLUMN IF NOT EXISTS annual_fee_usd        NUMERIC(8,2) NOT NULL DEFAULT 0;
ALTER TABLE card_variants ADD COLUMN IF NOT EXISTS transaction_limit_usd NUMERIC(12,2) NOT NULL DEFAULT 5000;
ALTER TABLE card_variants ADD COLUMN IF NOT EXISTS card_color_hex        TEXT NOT NULL DEFAULT '#2A2B31';
ALTER TABLE card_variants ADD COLUMN IF NOT EXISTS is_active             BOOLEAN NOT NULL DEFAULT true;

-- ─── 4. VCC Cards table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vcc_cards (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address           TEXT        UNIQUE NOT NULL,
  card_last4               TEXT        NOT NULL,
  card_holder_name         TEXT        NOT NULL,
  expiry_mm_yy             TEXT        NOT NULL,
  card_variant             TEXT        NOT NULL,
  card_network             TEXT        NOT NULL DEFAULT 'Visa',
  card_status              TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (card_status IN ('pending', 'active', 'frozen', 'blocked')),
  balance                  NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_physical              BOOLEAN     NOT NULL DEFAULT false,
  physical_shipping_status TEXT        NOT NULL DEFAULT 'not_requested'
                             CHECK (physical_shipping_status IN ('not_requested','processing','shipped','delivered')),
  physical_fee_usd         NUMERIC(8,2) NOT NULL DEFAULT 0,
  shipping_fee_usd         NUMERIC(8,2) NOT NULL DEFAULT 0,
  kyc_verified             BOOLEAN     NOT NULL DEFAULT false,
  name_match               BOOLEAN     NOT NULL DEFAULT false,
  compliance_status        TEXT        NOT NULL DEFAULT 'compliant'
                             CHECK (compliance_status IN ('compliant','flagged')),
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 5. Card requests table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS card_requests (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address  TEXT    NOT NULL,
  card_type       TEXT    NOT NULL,
  country         TEXT    NOT NULL,
  shipping_fee    NUMERIC(8,2) NOT NULL,
  total_cost      NUMERIC(8,2) NOT NULL DEFAULT 0,
  status          TEXT    NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'shipped')),
  tracking_number TEXT,
  shipped_at      TIMESTAMPTZ,
  admin_notes     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE card_requests ADD COLUMN IF NOT EXISTS total_cost      NUMERIC(8,2) NOT NULL DEFAULT 0;
ALTER TABLE card_requests ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE card_requests ADD COLUMN IF NOT EXISTS shipped_at      TIMESTAMPTZ;
ALTER TABLE card_requests ADD COLUMN IF NOT EXISTS admin_notes     TEXT;
-- Drop old CHECK constraint and re-add with 'shipped'
ALTER TABLE card_requests DROP CONSTRAINT IF EXISTS card_requests_status_check;
ALTER TABLE card_requests ADD CONSTRAINT card_requests_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'shipped'));

-- ─── 6. Shipping fees table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipping_fees (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  country_name TEXT    NOT NULL,
  country_code TEXT    NOT NULL,
  fee_usd      NUMERIC(8,2) NOT NULL
);

-- ─── 7. Transactions table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT        NOT NULL,
  card_id        UUID,
  type           TEXT        NOT NULL
                   CHECK (type IN ('send','receive','swap','card_topup','card_spend','debit','credit','fee')),
  token          TEXT        NOT NULL DEFAULT 'ETH',
  amount         NUMERIC(24,8) NOT NULL DEFAULT 0,
  usd_value      NUMERIC(12,2) NOT NULL DEFAULT 0,
  status         TEXT        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','success','failed')),
  tx_hash        TEXT,
  reference_id   TEXT,
  label          TEXT,
  to_address     TEXT,
  description    TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS card_id     UUID;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS description TEXT;

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_kyc_wallet            ON kyc(wallet_address);
CREATE INDEX IF NOT EXISTS idx_kyc_status            ON kyc(status);
CREATE INDEX IF NOT EXISTS idx_cards_wallet          ON cards(wallet_address);
CREATE INDEX IF NOT EXISTS idx_vcc_cards_wallet      ON vcc_cards(wallet_address);
CREATE INDEX IF NOT EXISTS idx_card_requests_wallet  ON card_requests(wallet_address);
CREATE INDEX IF NOT EXISTS idx_card_requests_status  ON card_requests(wallet_address, status);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet   ON transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_transactions_type     ON transactions(wallet_address, type);
CREATE INDEX IF NOT EXISTS idx_transactions_created  ON transactions(wallet_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipping_fees_country ON shipping_fees(country_name);

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE kyc           ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards         ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE vcc_cards     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_kyc"           ON kyc;
DROP POLICY IF EXISTS "anon_all_cards"         ON cards;
DROP POLICY IF EXISTS "anon_read_variants"     ON card_variants;
DROP POLICY IF EXISTS "anon_all_card_requests" ON card_requests;
DROP POLICY IF EXISTS "anon_all_vcc_cards"     ON vcc_cards;
DROP POLICY IF EXISTS "anon_all_transactions"  ON transactions;
DROP POLICY IF EXISTS "anon_read_shipping"     ON shipping_fees;

CREATE POLICY "anon_all_kyc"           ON kyc           FOR ALL    TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_cards"         ON cards         FOR ALL    TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_read_variants"     ON card_variants FOR SELECT TO anon USING (true);
CREATE POLICY "anon_all_card_requests" ON card_requests FOR ALL    TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_vcc_cards"     ON vcc_cards     FOR ALL    TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_transactions"  ON transactions  FOR ALL    TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_read_shipping"     ON shipping_fees FOR SELECT TO anon USING (true);

-- ─── Seed card_variants (upgraded with VCC fields) ────────────────────────────
INSERT INTO card_variants (id, name, variant_name, network, features, price, annual_fee_usd, transaction_limit_usd, design_url, color_hex, card_color_hex, is_active) VALUES
  ('classic',  'Classic',  'Classic',  'Visa',       ARRAY['Virtual payments','Basic rewards','Standard support'],                                0.00,  0.00,  2000,  '', '#2A2B31', '#2A2B31', true),
  ('gold',     'Gold',     'Gold',     'Visa',       ARRAY['2% cashback','Priority support','Travel insurance'],                                  9.99,  9.99,  5000,  '', '#B8860B', '#B8860B', true),
  ('platinum', 'Platinum', 'Platinum', 'Mastercard', ARRAY['5% cashback','Concierge service','Airport lounge access','No FX fees'],              24.99, 24.99, 15000, '', '#708090', '#708090', true),
  ('travel',   'Travel',   'Travel',   'Mastercard', ARRAY['No FX fees','Travel insurance','Lounge access','3% travel cashback'],                14.99, 14.99, 10000, '', '#1A3A5C', '#1A3A5C', true)
ON CONFLICT (id) DO UPDATE SET
  variant_name          = EXCLUDED.variant_name,
  network               = EXCLUDED.network,
  annual_fee_usd        = EXCLUDED.annual_fee_usd,
  transaction_limit_usd = EXCLUDED.transaction_limit_usd,
  card_color_hex        = EXCLUDED.card_color_hex,
  is_active             = EXCLUDED.is_active;

-- ─── Seed shipping_fees ───────────────────────────────────────────────────────
INSERT INTO shipping_fees (country_name, country_code, fee_usd) VALUES
  ('United States',  'US',  9.99),
  ('United Kingdom', 'GB', 12.99),
  ('Canada',         'CA', 11.99),
  ('Australia',      'AU', 14.99),
  ('Germany',        'DE', 13.99),
  ('France',         'FR', 13.99),
  ('India',          'IN', 19.99),
  ('Singapore',      'SG', 16.99),
  ('UAE',            'AE', 17.99),
  ('Brazil',         'BR', 22.99),
  ('Japan',          'JP', 15.99),
  ('South Korea',    'KR', 15.99),
  ('Other',          'XX', 24.99)
ON CONFLICT DO NOTHING;

-- ─── Storage bucket ───────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-docs', 'kyc-docs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "anon_all_kyc_docs" ON storage.objects;
CREATE POLICY "anon_all_kyc_docs"
ON storage.objects FOR ALL TO anon
USING (bucket_id = 'kyc-docs')
WITH CHECK (bucket_id = 'kyc-docs');
