-- Pricing System Migration — Hardened Dynamic Pricing & Currency configurations
-- Run in Supabase SQL editor

-- 1. Alter card_variants to support activation_fee_usd
ALTER TABLE card_variants ADD COLUMN IF NOT EXISTS activation_fee_usd NUMERIC(8,2) NOT NULL DEFAULT 0.00;

-- 2. Create fiat_currencies table
CREATE TABLE IF NOT EXISTS fiat_currencies (
  code   TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  name   TEXT NOT NULL,
  rate   NUMERIC(12,4) NOT NULL DEFAULT 1.0,
  locale TEXT,
  format TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE fiat_currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_fees ENABLE ROW LEVEL SECURITY;

-- 4. Drop old restrictive policies
DROP POLICY IF EXISTS "card_variants_read" ON card_variants;
DROP POLICY IF EXISTS "card_variants_all" ON card_variants;
DROP POLICY IF EXISTS "shipping_fees_read" ON shipping_fees;
DROP POLICY IF EXISTS "shipping_fees_all" ON shipping_fees;
DROP POLICY IF EXISTS "fiat_currencies_read" ON fiat_currencies;
DROP POLICY IF EXISTS "fiat_currencies_all" ON fiat_currencies;

-- 5. Create new all-access policies (allowing read/write access from dashboard and mobile)
CREATE POLICY "card_variants_read" ON card_variants FOR SELECT TO public USING (true);
CREATE POLICY "card_variants_all" ON card_variants FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "shipping_fees_read" ON shipping_fees FOR SELECT TO public USING (true);
CREATE POLICY "shipping_fees_all" ON shipping_fees FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "fiat_currencies_read" ON fiat_currencies FOR SELECT TO public USING (true);
CREATE POLICY "fiat_currencies_all" ON fiat_currencies FOR ALL TO public USING (true) WITH CHECK (true);

-- 6. Seed Fiat Currencies
INSERT INTO fiat_currencies (code, symbol, name, rate, locale, format) VALUES
  ('USD', '$', 'US Dollar', 1.0, 'en-US', 'en-US'),
  ('INR', '₹', 'Indian Rupee', 83.5, 'en-IN', 'en-IN'),
  ('EUR', '€', 'Euro', 0.92, 'de-DE', 'de-DE'),
  ('GBP', '£', 'British Pound', 0.79, 'en-GB', 'en-GB'),
  ('AED', 'د.إ', 'UAE Dirham', 3.67, 'ar-AE', 'ar-AE'),
  ('AUD', 'A$', 'Australian Dollar', 1.51, 'en-AU', 'en-AU'),
  ('SGD', 'S$', 'Singapore Dollar', 1.35, 'en-SG', 'en-SG'),
  ('RUB', '₽', 'Russian Ruble', 90.0, 'ru-RU', 'ru-RU'),
  ('BHD', 'د.ب', 'Bahraini Dinar', 0.38, 'ar-BH', 'ar-BH'),
  ('VND', '₫', 'Vietnamese Dong', 25400.0, 'vi-VN', 'vi-VN'),
  ('SAR', '﷼', 'Saudi Riyal', 3.75, 'ar-SA', 'ar-SA'),
  ('KWD', 'KD', 'Kuwaiti Dinar', 0.31, 'ar-KW', 'ar-KW'),
  ('THB', '฿', 'Thai Baht', 36.5, 'th-TH', 'th-TH')
ON CONFLICT (code) DO UPDATE SET
  symbol = EXCLUDED.symbol,
  name = EXCLUDED.name,
  rate = EXCLUDED.rate,
  locale = EXCLUDED.locale,
  format = EXCLUDED.format;

-- 7. Ensure classical/gold/platinum card variants have seeded activation fees
UPDATE card_variants SET activation_fee_usd = 0.00 WHERE id = 'classic';
UPDATE card_variants SET activation_fee_usd = 19.99 WHERE id = 'gold';
UPDATE card_variants SET activation_fee_usd = 39.99 WHERE id = 'platinum';
UPDATE card_variants SET activation_fee_usd = 29.99 WHERE id = 'travel';
