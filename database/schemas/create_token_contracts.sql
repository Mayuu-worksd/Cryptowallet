-- Create token_contracts table
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run

CREATE TABLE IF NOT EXISTS token_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_code TEXT NOT NULL REFERENCES fiat_currencies(code) ON DELETE CASCADE,
  network_name TEXT NOT NULL,
  contract_address TEXT NOT NULL DEFAULT '',
  decimals INT NOT NULL DEFAULT 18,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(currency_code, network_name)
);

-- Enable Row Level Security (RLS)
ALTER TABLE token_contracts ENABLE ROW LEVEL SECURITY;

-- Allow public read/write access (matching fiat_currencies policy for easy dashboard integration)
DROP POLICY IF EXISTS "token_contracts_all" ON token_contracts;
CREATE POLICY "token_contracts_all" ON token_contracts 
  FOR ALL TO public USING (true) WITH CHECK (true);

-- Seed initial contract placeholders for USD, AED, PKR on Polygon network
INSERT INTO token_contracts (currency_code, network_name, contract_address, decimals, is_enabled) VALUES
  ('USD', 'Polygon', '', 18, true),
  ('AED', 'Polygon', '', 18, false),
  ('PKR', 'Polygon', '', 18, false)
ON CONFLICT (currency_code, network_name) DO UPDATE SET
  contract_address = EXCLUDED.contract_address,
  decimals = EXCLUDED.decimals,
  is_enabled = EXCLUDED.is_enabled;
