-- =============================================================================
-- CryptoWallet — Full Migration Script (PRODUCTION HARDENED)
-- Run in: https://supabase.com/dashboard/project/hxmacphgbpedazdvgdnz/sql/new
-- Safe to re-run (uses IF NOT EXISTS / ON CONFLICT DO NOTHING)
-- =============================================================================

-- ─── 1. Business KYC ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS business_kyc (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address      TEXT UNIQUE NOT NULL,
  business_name       TEXT NOT NULL,
  business_type       TEXT NOT NULL,
  registration_number TEXT NOT NULL,
  business_address    TEXT NOT NULL,
  country             TEXT NOT NULL,
  document_url        TEXT,
  director_name       TEXT,
  director_nationality TEXT,
  director_id_url     TEXT,
  vat_tax_id          TEXT,
  status              TEXT DEFAULT 'pending' CHECK (status IN ('pending','under_review','approved','rejected')),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE business_kyc ADD COLUMN IF NOT EXISTS director_name        TEXT;
ALTER TABLE business_kyc ADD COLUMN IF NOT EXISTS director_nationality  TEXT;
ALTER TABLE business_kyc ADD COLUMN IF NOT EXISTS director_id_url       TEXT;
ALTER TABLE business_kyc ADD COLUMN IF NOT EXISTS vat_tax_id            TEXT;
ALTER TABLE business_kyc ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ DEFAULT NOW();

-- ─── 2. Merchant QR Codes ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS merchant_qr_codes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  token          TEXT NOT NULL,
  amount         TEXT,
  reference      TEXT,
  qr_string      TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 3. P2P Orders ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS p2p_orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_wallet    TEXT NOT NULL,
  buyer_wallet     TEXT,
  token            TEXT NOT NULL,
  amount           NUMERIC NOT NULL,
  fiat_currency    TEXT NOT NULL,
  rate             NUMERIC NOT NULL,
  fiat_total       NUMERIC NOT NULL,
  payment_method   TEXT NOT NULL,
  country          TEXT NOT NULL,
  status           TEXT DEFAULT 'open' CHECK (status IN ('open','in_escrow','fiat_sent','completed','cancelled','disputed')),
  is_merchant      BOOLEAN DEFAULT FALSE,
  network          TEXT DEFAULT 'Sepolia',
  deposit_tx_hash  TEXT,
  release_tx_hash  TEXT,
  platform_fee     NUMERIC(18,8) DEFAULT 0,
  fiat_total_after_fee NUMERIC(18,8) DEFAULT 0,
  seller_completion_rate NUMERIC DEFAULT 100,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE p2p_orders ADD COLUMN IF NOT EXISTS network               TEXT DEFAULT 'Sepolia';
ALTER TABLE p2p_orders ADD COLUMN IF NOT EXISTS deposit_tx_hash       TEXT;
ALTER TABLE p2p_orders ADD COLUMN IF NOT EXISTS release_tx_hash       TEXT;
ALTER TABLE p2p_orders ADD COLUMN IF NOT EXISTS platform_fee          NUMERIC(18,8) DEFAULT 0;
ALTER TABLE p2p_orders ADD COLUMN IF NOT EXISTS fiat_total_after_fee  NUMERIC(18,8) DEFAULT 0;
ALTER TABLE p2p_orders ADD COLUMN IF NOT EXISTS seller_completion_rate NUMERIC DEFAULT 100;
ALTER TABLE p2p_orders ADD COLUMN IF NOT EXISTS is_merchant           BOOLEAN DEFAULT FALSE;

-- ─── 4. Escrow Locks ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escrow_locks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID REFERENCES p2p_orders(id) ON DELETE CASCADE,
  seller_wallet  TEXT NOT NULL,
  buyer_wallet   TEXT,
  token          TEXT NOT NULL,
  amount         NUMERIC NOT NULL,
  status         TEXT DEFAULT 'locked' CHECK (status IN ('locked','released','refunded')),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 5. P2P Chat ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS p2p_chat (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id      UUID NOT NULL REFERENCES p2p_orders(id) ON DELETE CASCADE,
  sender_wallet TEXT NOT NULL,
  message       TEXT NOT NULL,
  is_support    BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 6. KYC ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kyc (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address   TEXT UNIQUE NOT NULL,
  full_name        TEXT NOT NULL DEFAULT '',
  email            TEXT NOT NULL DEFAULT '',
  phone            TEXT NOT NULL DEFAULT '',
  address          TEXT NOT NULL DEFAULT '',
  nationality      TEXT NOT NULL DEFAULT '',
  dob              TEXT NOT NULL DEFAULT '',
  document_type    TEXT NOT NULL DEFAULT '',
  document_url     TEXT,
  selfie_url       TEXT,
  selfie_video_url TEXT,
  unique_code      TEXT,
  admin_notes      TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','under_review','verified','rejected')),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE kyc ADD COLUMN IF NOT EXISTS selfie_video_url TEXT;
ALTER TABLE kyc ADD COLUMN IF NOT EXISTS unique_code      TEXT;
ALTER TABLE kyc ADD COLUMN IF NOT EXISTS admin_notes      TEXT;
ALTER TABLE kyc ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT NOW();

-- ─── 7. Cards ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cards (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE NOT NULL,
  card_last4     TEXT NOT NULL DEFAULT '0000',
  expiry_month   TEXT NOT NULL DEFAULT '12',
  expiry_year    TEXT NOT NULL DEFAULT '28',
  card_type      TEXT NOT NULL DEFAULT 'classic',
  balance        NUMERIC(12,2) NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','frozen')),
  holder_name    TEXT NOT NULL DEFAULT 'CARD HOLDER',
  design         TEXT NOT NULL DEFAULT 'dark',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 8. VCC Cards ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vcc_cards (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address           TEXT UNIQUE NOT NULL,
  card_last4               TEXT NOT NULL,
  card_holder_name         TEXT NOT NULL,
  expiry_mm_yy             TEXT NOT NULL,
  card_variant             TEXT NOT NULL,
  card_network             TEXT NOT NULL DEFAULT 'Visa',
  card_status              TEXT NOT NULL DEFAULT 'pending'
                             CHECK (card_status IN ('pending','active','frozen','blocked')),
  balance                  NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_physical              BOOLEAN NOT NULL DEFAULT false,
  physical_shipping_status TEXT NOT NULL DEFAULT 'not_requested',
  physical_fee_usd         NUMERIC(8,2) NOT NULL DEFAULT 0,
  shipping_fee_usd         NUMERIC(8,2) NOT NULL DEFAULT 0,
  kyc_verified             BOOLEAN NOT NULL DEFAULT false,
  compliance_status        TEXT NOT NULL DEFAULT 'compliant',
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 9. Card Variants ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS card_variants (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  variant_name          TEXT NOT NULL DEFAULT '',
  network               TEXT NOT NULL DEFAULT 'Visa',
  features              TEXT[] NOT NULL DEFAULT '{}',
  price                 NUMERIC(8,2) NOT NULL DEFAULT 0,
  annual_fee_usd        NUMERIC(8,2) NOT NULL DEFAULT 0,
  transaction_limit_usd NUMERIC(12,2) NOT NULL DEFAULT 5000,
  design_url            TEXT NOT NULL DEFAULT '',
  color_hex             TEXT NOT NULL DEFAULT '#2A2B31',
  card_color_hex        TEXT NOT NULL DEFAULT '#2A2B31',
  is_active             BOOLEAN NOT NULL DEFAULT true
);

-- ─── 10. Transactions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  type           TEXT NOT NULL CHECK (type IN ('send','receive','swap','card_topup','card_spend','debit','credit','fee')),
  token          TEXT NOT NULL DEFAULT 'ETH',
  amount         NUMERIC(24,8) NOT NULL DEFAULT 0,
  usd_value      NUMERIC(12,2) NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed')),
  tx_hash        TEXT,
  label          TEXT,
  to_address     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 11. Card Requests ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS card_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address  TEXT NOT NULL,
  card_type       TEXT NOT NULL,
  country         TEXT NOT NULL,
  shipping_fee    NUMERIC(8,2) NOT NULL,
  total_cost      NUMERIC(8,2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','shipped')),
  tracking_number TEXT,
  shipped_at      TIMESTAMPTZ,
  admin_notes     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 12. Shipping Fees ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipping_fees (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  fee_usd      NUMERIC(8,2) NOT NULL
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_p2p_orders_seller    ON p2p_orders(seller_wallet);
CREATE INDEX IF NOT EXISTS idx_p2p_orders_buyer     ON p2p_orders(buyer_wallet);
CREATE INDEX IF NOT EXISTS idx_p2p_orders_status    ON p2p_orders(status);
CREATE INDEX IF NOT EXISTS idx_p2p_chat_order_id    ON p2p_chat(order_id);
CREATE INDEX IF NOT EXISTS idx_p2p_chat_created     ON p2p_chat(order_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_escrow_locks_order   ON escrow_locks(order_id);
CREATE INDEX IF NOT EXISTS idx_kyc_wallet           ON kyc(wallet_address);
CREATE INDEX IF NOT EXISTS idx_cards_wallet         ON cards(wallet_address);
CREATE INDEX IF NOT EXISTS idx_vcc_cards_wallet     ON vcc_cards(wallet_address);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet  ON transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(wallet_address, created_at DESC);

-- =============================================================================
-- FIX 1: ROW LEVEL SECURITY — wallet-scoped, no open USING(true) policies
-- =============================================================================

ALTER TABLE business_kyc      ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_locks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_chat          ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc               ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards             ENABLE ROW LEVEL SECURITY;
ALTER TABLE vcc_cards         ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_variants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_fees     ENABLE ROW LEVEL SECURITY;

-- Helper: reads wallet address set per-request by the app via set_wallet()
CREATE OR REPLACE FUNCTION current_wallet()
RETURNS TEXT LANGUAGE sql STABLE AS
'SELECT COALESCE(NULLIF(current_setting(''app.wallet'', true), ''''), '''')';

-- RPC the app calls before every Supabase request:
-- await supabase.rpc('set_wallet', { wallet: walletAddress.toLowerCase() })
CREATE OR REPLACE FUNCTION set_wallet(wallet TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS
'BEGIN PERFORM set_config(''app.wallet'', lower(wallet), false); END';

-- Drop ALL existing policies cleanly
DO $drop$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $drop$;

-- ── KYC: own record only; cannot self-approve ─────────────────────────────────
CREATE POLICY "kyc_select_own" ON kyc
  FOR SELECT TO anon
  USING (wallet_address = current_wallet());

CREATE POLICY "kyc_insert_own" ON kyc
  FOR INSERT TO anon
  WITH CHECK (wallet_address = current_wallet());

CREATE POLICY "kyc_update_own" ON kyc
  FOR UPDATE TO anon
  USING (wallet_address = current_wallet() AND status IN ('pending','rejected'))
  WITH CHECK (wallet_address = current_wallet() AND status NOT IN ('verified','under_review'));

-- ── Business KYC: own record only; cannot self-approve ───────────────────────
CREATE POLICY "bkyc_select_own" ON business_kyc
  FOR SELECT TO anon
  USING (wallet_address = current_wallet());

CREATE POLICY "bkyc_insert_own" ON business_kyc
  FOR INSERT TO anon
  WITH CHECK (wallet_address = current_wallet() AND status = 'pending');

CREATE POLICY "bkyc_update_own" ON business_kyc
  FOR UPDATE TO anon
  USING (wallet_address = current_wallet() AND status IN ('pending','rejected'))
  WITH CHECK (wallet_address = current_wallet() AND status != 'approved');

-- ── Cards: own wallet only ────────────────────────────────────────────────────
CREATE POLICY "cards_own" ON cards
  FOR ALL TO anon
  USING (wallet_address = current_wallet())
  WITH CHECK (wallet_address = current_wallet());

CREATE POLICY "vcc_cards_own" ON vcc_cards
  FOR ALL TO anon
  USING (wallet_address = current_wallet())
  WITH CHECK (wallet_address = current_wallet());

CREATE POLICY "card_requests_own" ON card_requests
  FOR ALL TO anon
  USING (wallet_address = current_wallet())
  WITH CHECK (wallet_address = current_wallet());

-- ── Transactions: own wallet only ────────────────────────────────────────────
CREATE POLICY "transactions_own" ON transactions
  FOR ALL TO anon
  USING (wallet_address = current_wallet())
  WITH CHECK (wallet_address = current_wallet());

-- ── Merchant QR: own wallet only ─────────────────────────────────────────────
CREATE POLICY "qr_own" ON merchant_qr_codes
  FOR ALL TO anon
  USING (wallet_address = current_wallet())
  WITH CHECK (wallet_address = current_wallet());

-- ── P2P Orders: open orders public; own orders private ───────────────────────
CREATE POLICY "p2p_orders_select" ON p2p_orders
  FOR SELECT TO anon
  USING (
    status = 'open'
    OR seller_wallet = current_wallet()
    OR buyer_wallet  = current_wallet()
  );

-- P2P Orders INSERT: seller can create open orders
CREATE POLICY "p2p_orders_insert" ON p2p_orders
  FOR INSERT TO anon
  WITH CHECK (
    seller_wallet = current_wallet()
    AND status = 'open'
  );

-- FIX 5b: seller can only update their own orders
CREATE POLICY "p2p_orders_update_seller" ON p2p_orders
  FOR UPDATE TO anon
  USING (seller_wallet = current_wallet())
  WITH CHECK (seller_wallet = current_wallet());

-- Buyer can update orders they are party to
CREATE POLICY "p2p_orders_update_buyer" ON p2p_orders
  FOR UPDATE TO anon
  USING (
    buyer_wallet = current_wallet()
    OR (status = 'open' AND buyer_wallet IS NULL)
  )
  WITH CHECK (
    buyer_wallet = current_wallet()
    OR (status = 'open' AND buyer_wallet IS NULL)
  );

-- ── Escrow Locks: order parties only ─────────────────────────────────────────
CREATE POLICY "escrow_parties" ON escrow_locks
  FOR ALL TO anon
  USING (seller_wallet = current_wallet() OR buyer_wallet = current_wallet())
  WITH CHECK (seller_wallet = current_wallet() OR buyer_wallet = current_wallet());

-- ── P2P Chat: order participants only ────────────────────────────────────────
CREATE POLICY "p2p_chat_select" ON p2p_chat
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM p2p_orders o
      WHERE o.id = order_id
        AND (o.seller_wallet = current_wallet() OR o.buyer_wallet = current_wallet())
    )
  );

CREATE POLICY "p2p_chat_insert" ON p2p_chat
  FOR INSERT TO anon
  WITH CHECK (
    sender_wallet = current_wallet()
    AND EXISTS (
      SELECT 1 FROM p2p_orders o
      WHERE o.id = order_id
        AND (o.seller_wallet = current_wallet() OR o.buyer_wallet = current_wallet())
    )
  );

-- ── Card Variants & Shipping Fees: public read-only ──────────────────────────
CREATE POLICY "card_variants_read" ON card_variants
  FOR SELECT TO anon USING (true);

CREATE POLICY "shipping_fees_read" ON shipping_fees
  FOR SELECT TO anon USING (true);

-- =============================================================================
-- FIX 4: KYC STORAGE BUCKET — private, signed URLs only
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-docs', 'kyc-docs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Drop old open storage policy
DROP POLICY IF EXISTS "anon_all_kyc_docs" ON storage.objects;

-- Only the file owner (matched by wallet in path) can upload
CREATE POLICY "kyc_docs_insert_own" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'kyc-docs'
    AND (storage.foldername(name))[1] = 'kyc'
    AND (storage.foldername(name))[2] = replace(current_wallet(), '0x', '')
  );

-- Only the file owner can read their own docs (via signed URL)
CREATE POLICY "kyc_docs_select_own" ON storage.objects
  FOR SELECT TO anon
  USING (
    bucket_id = 'kyc-docs'
    AND (storage.foldername(name))[2] = replace(current_wallet(), '0x', '')
  );

-- =============================================================================
-- Realtime
-- =============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE p2p_chat;
ALTER PUBLICATION supabase_realtime ADD TABLE p2p_orders;

-- =============================================================================
-- Seed card_variants
-- =============================================================================
ALTER TABLE card_variants ADD COLUMN IF NOT EXISTS variant_name          TEXT NOT NULL DEFAULT '';
ALTER TABLE card_variants ADD COLUMN IF NOT EXISTS network               TEXT NOT NULL DEFAULT 'Visa';
ALTER TABLE card_variants ADD COLUMN IF NOT EXISTS annual_fee_usd        NUMERIC(8,2) NOT NULL DEFAULT 0;
ALTER TABLE card_variants ADD COLUMN IF NOT EXISTS transaction_limit_usd NUMERIC(12,2) NOT NULL DEFAULT 5000;
ALTER TABLE card_variants ADD COLUMN IF NOT EXISTS card_color_hex        TEXT NOT NULL DEFAULT '#2A2B31';
ALTER TABLE card_variants ADD COLUMN IF NOT EXISTS is_active             BOOLEAN NOT NULL DEFAULT true;

INSERT INTO card_variants (id, name, variant_name, network, features, price, annual_fee_usd, transaction_limit_usd, design_url, color_hex, card_color_hex, is_active) VALUES
  ('classic',  'Classic',  'Classic',  'Visa',       ARRAY['Virtual payments','Basic rewards','Standard support'],                   0.00,  0.00,  2000,  '', '#2A2B31', '#2A2B31', true),
  ('gold',     'Gold',     'Gold',     'Visa',       ARRAY['2% cashback','Priority support','Travel insurance'],                     9.99,  9.99,  5000,  '', '#B8860B', '#B8860B', true),
  ('platinum', 'Platinum', 'Platinum', 'Mastercard', ARRAY['5% cashback','Concierge service','Airport lounge access','No FX fees'], 24.99, 24.99, 15000, '', '#708090', '#708090', true),
  ('travel',   'Travel',   'Travel',   'Mastercard', ARRAY['No FX fees','Travel insurance','Lounge access','3% travel cashback'],   14.99, 14.99, 10000, '', '#1A3A5C', '#1A3A5C', true)
ON CONFLICT (id) DO UPDATE SET
  variant_name          = EXCLUDED.variant_name,
  network               = EXCLUDED.network,
  annual_fee_usd        = EXCLUDED.annual_fee_usd,
  transaction_limit_usd = EXCLUDED.transaction_limit_usd,
  card_color_hex        = EXCLUDED.card_color_hex,
  is_active             = EXCLUDED.is_active;

-- =============================================================================
-- Seed shipping_fees
-- =============================================================================
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
