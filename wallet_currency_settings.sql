-- Multi-currency Support Migration
-- Run in Supabase SQL editor (Supabase Dashboard -> SQL Editor -> New Query -> Run)

-- 1. Create wallet_currency_settings table
CREATE TABLE IF NOT EXISTS wallet_currency_settings (
  wallet_address   TEXT PRIMARY KEY,
  base_token       TEXT NOT NULL DEFAULT 'INRX',
  display_currency TEXT NOT NULL DEFAULT 'USD',
  balance          NUMERIC(24,8) NOT NULL DEFAULT 1000.00,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add is_enabled column to fiat_currencies table
ALTER TABLE fiat_currencies ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT true;

-- 3. Seed/update the 10 supported currencies in fiat_currencies
INSERT INTO fiat_currencies (code, symbol, name, rate, locale, format, is_enabled) VALUES
  ('USD', '$', 'US Dollar', 1.0, 'en-US', 'en-US', true),
  ('CNY', '¥', 'Chinese Yuan', 7.23, 'zh-CN', 'zh-CN', true),
  ('RUB', '₽', 'Russian Ruble', 89.5, 'ru-RU', 'ru-RU', true),
  ('UZS', 'UZS', 'Uzbekistan Som', 12600.0, 'uz-UZ', 'uz-UZ', true),
  ('PKR', '₨', 'Pakistani Rupee', 278.5, 'ur-PK', 'ur-PK', true),
  ('VND', '₫', 'Vietnamese Dong', 25400.0, 'vi-VN', 'vi-VN', true),
  ('IDR', 'Rp', 'Indonesian Rupiah', 16300.0, 'id-ID', 'id-ID', true),
  ('PHP', '₱', 'Philippine Peso', 58.5, 'fil-PH', 'fil-PH', true),
  ('AED', 'د.إ', 'UAE Dirham', 3.67, 'ar-AE', 'ar-AE', true),
  ('THB', '฿', 'Thai Baht', 36.5, 'th-TH', 'th-TH', true)
ON CONFLICT (code) DO UPDATE SET
  symbol = EXCLUDED.symbol,
  name = EXCLUDED.name,
  rate = EXCLUDED.rate,
  locale = EXCLUDED.locale,
  format = EXCLUDED.format,
  is_enabled = EXCLUDED.is_enabled;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE wallet_currency_settings ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for wallet_currency_settings
DROP POLICY IF EXISTS "wallet_currency_settings_all" ON wallet_currency_settings;
CREATE POLICY "wallet_currency_settings_all" ON wallet_currency_settings
  FOR ALL TO public USING (true) WITH CHECK (true);
