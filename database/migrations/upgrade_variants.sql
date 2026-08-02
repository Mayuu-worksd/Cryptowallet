-- Upgrade card_variants table to support full dynamic properties for Admin Dashboard control
-- Run this query in Supabase Dashboard → SQL Editor → New Query → Run

-- Add the new columns if they do not exist
ALTER TABLE card_variants ADD COLUMN IF NOT EXISTS is_physical      BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE card_variants ADD COLUMN IF NOT EXISTS is_virtual       BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE card_variants ADD COLUMN IF NOT EXISTS gradient_colors  TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE card_variants ADD COLUMN IF NOT EXISTS currency_support TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE card_variants ADD COLUMN IF NOT EXISTS fee_rate         NUMERIC(5,2) NOT NULL DEFAULT 0;

-- Drop existing restrictive read-only policy
DROP POLICY IF EXISTS "anon_read_variants" ON card_variants;
DROP POLICY IF EXISTS "anon_all_variants" ON card_variants;

-- Create all-access policy to allow admin dashboard (running as anon/authenticated) to insert, update, and delete variants
CREATE POLICY "anon_all_variants" ON card_variants 
FOR ALL TO public 
USING (true) 
WITH CHECK (true);

-- Re-enable RLS to make sure policies are enforced
ALTER TABLE card_variants ENABLE ROW LEVEL SECURITY;

-- Seed initial details for our pre-seeded variants if they don't have them
UPDATE card_variants SET 
  is_physical = true,
  is_virtual = true,
  gradient_colors = ARRAY['#2B2B30', '#18181A', '#0D0D0E'],
  currency_support = ARRAY['BTC', 'ETH', 'USDT', 'USDC'],
  fee_rate = 1.50
WHERE id = 'classic';

UPDATE card_variants SET 
  is_physical = true,
  is_virtual = true,
  gradient_colors = ARRAY['#E5A93C', '#996515', '#4A3B18'],
  currency_support = ARRAY['BTC', 'ETH', 'USDT', 'USDC', 'BNB'],
  fee_rate = 1.00
WHERE id = 'gold';

UPDATE card_variants SET 
  is_physical = true,
  is_virtual = true,
  gradient_colors = ARRAY['#E5E7EB', '#9CA3AF', '#374151'],
  currency_support = ARRAY['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'XRP'],
  fee_rate = 0.50
WHERE id = 'platinum';

UPDATE card_variants SET 
  is_physical = true,
  is_virtual = true,
  gradient_colors = ARRAY['#1E3A8A', '#0F172A', '#050515'],
  currency_support = ARRAY['BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'TRX'],
  fee_rate = 0.80
WHERE id = 'travel';
