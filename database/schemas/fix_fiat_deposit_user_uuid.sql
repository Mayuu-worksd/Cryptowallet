-- Fix: column "user_uuid" does not exist on fiat_crypto_requests / ledger_entries
-- Run in Supabase SQL Editor

-- 1. Add user_uuid as nullable on all tables that need it
--    (wallet_profiles uses wallet_address as PK — no user_uuid column exists there)
ALTER TABLE fiat_crypto_requests  ADD COLUMN IF NOT EXISTS user_uuid UUID;
ALTER TABLE ledger_entries        ADD COLUMN IF NOT EXISTS user_uuid UUID;
ALTER TABLE transactions          ADD COLUMN IF NOT EXISTS user_uuid UUID;
ALTER TABLE kyc                   ADD COLUMN IF NOT EXISTS user_uuid UUID;
ALTER TABLE cards                 ADD COLUMN IF NOT EXISTS user_uuid UUID;
ALTER TABLE vcc_cards             ADD COLUMN IF NOT EXISTS user_uuid UUID;
ALTER TABLE card_requests         ADD COLUMN IF NOT EXISTS user_uuid UUID;
ALTER TABLE backup_records        ADD COLUMN IF NOT EXISTS user_uuid UUID;

-- merchant_qr_codes and business_kyc — add only if those tables exist
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchant_qr_codes') THEN
    ALTER TABLE merchant_qr_codes ADD COLUMN IF NOT EXISTS user_uuid UUID;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'business_kyc') THEN
    ALTER TABLE business_kyc ADD COLUMN IF NOT EXISTS user_uuid UUID;
  END IF;
END $$;

-- 2. Replace the broken trigger function with a no-op
--    (Cannot drop it — 9 triggers depend on it across multiple tables)
--    The function previously tried to look up wallet_profiles.user_uuid which doesn't exist.
CREATE OR REPLACE FUNCTION populate_user_uuid_from_wallet()
RETURNS TRIGGER AS $$
BEGIN
  -- user_uuid is not used (wallet_profiles has no user_uuid column)
  -- Column exists as nullable UUID for legacy compatibility only
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Verify columns exist
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE column_name = 'user_uuid'
  AND table_name IN ('fiat_crypto_requests', 'ledger_entries', 'transactions', 'kyc', 'cards', 'vcc_cards')
ORDER BY table_name;
