-- =============================================================================
-- Migration: Unified UUID/UID-based User Identity System
-- Run in: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- =============================================================================

-- 1. Create a function to generate a unique 10-digit Display UID
CREATE OR REPLACE FUNCTION generate_unique_user_uid()
RETURNS bigint AS $$
DECLARE
  new_uid bigint;
  done bool := false;
BEGIN
  WHILE NOT done LOOP
    new_uid := floor(random() * 9000000000 + 1000000000)::bigint;
    IF NOT EXISTS (SELECT 1 FROM wallet_profiles WHERE user_uid = new_uid) THEN
      done := true;
    END IF;
  END LOOP;
  RETURN new_uid;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 2. Add columns to wallet_profiles (initially nullable, without the self-referencing default UID during table alter)
ALTER TABLE wallet_profiles ADD COLUMN IF NOT EXISTS user_uuid UUID UNIQUE DEFAULT gen_random_uuid();
ALTER TABLE wallet_profiles ADD COLUMN IF NOT EXISTS user_uid BIGINT UNIQUE;

-- 3. Backfill any missing UUID/UID values for wallet_profiles (populates UID column row by row safely)
UPDATE wallet_profiles SET user_uuid = gen_random_uuid() WHERE user_uuid IS NULL;
UPDATE wallet_profiles SET user_uid = generate_unique_user_uid() WHERE user_uid IS NULL;

-- 4. Set column DEFAULT constraint and NOT NULL constraints
ALTER TABLE wallet_profiles ALTER COLUMN user_uuid SET NOT NULL;
ALTER TABLE wallet_profiles ALTER COLUMN user_uid SET DEFAULT generate_unique_user_uid();
ALTER TABLE wallet_profiles ALTER COLUMN user_uid SET NOT NULL;

-- 5. Add user_uuid columns to downstream tables
ALTER TABLE kyc ADD COLUMN IF NOT EXISTS user_uuid UUID REFERENCES wallet_profiles(user_uuid);
ALTER TABLE business_kyc ADD COLUMN IF NOT EXISTS user_uuid UUID REFERENCES wallet_profiles(user_uuid);
ALTER TABLE merchant_qr_codes ADD COLUMN IF NOT EXISTS user_uuid UUID REFERENCES wallet_profiles(user_uuid);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS user_uuid UUID REFERENCES wallet_profiles(user_uuid);
ALTER TABLE vcc_cards ADD COLUMN IF NOT EXISTS user_uuid UUID REFERENCES wallet_profiles(user_uuid);
ALTER TABLE card_requests ADD COLUMN IF NOT EXISTS user_uuid UUID REFERENCES wallet_profiles(user_uuid);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_uuid UUID REFERENCES wallet_profiles(user_uuid);
ALTER TABLE backup_records ADD COLUMN IF NOT EXISTS user_uuid UUID REFERENCES wallet_profiles(user_uuid);
ALTER TABLE p2p_chat ADD COLUMN IF NOT EXISTS sender_uuid UUID REFERENCES wallet_profiles(user_uuid);

ALTER TABLE p2p_orders ADD COLUMN IF NOT EXISTS seller_uuid UUID REFERENCES wallet_profiles(user_uuid);
ALTER TABLE p2p_orders ADD COLUMN IF NOT EXISTS buyer_uuid UUID REFERENCES wallet_profiles(user_uuid);

ALTER TABLE escrow_locks ADD COLUMN IF NOT EXISTS seller_uuid UUID REFERENCES wallet_profiles(user_uuid);
ALTER TABLE escrow_locks ADD COLUMN IF NOT EXISTS buyer_uuid UUID REFERENCES wallet_profiles(user_uuid);

-- 6. Trigger functions for automatic populating during inserts/updates
CREATE OR REPLACE FUNCTION populate_user_uuid_from_wallet()
RETURNS TRIGGER AS $$
DECLARE
  v_uuid UUID;
BEGIN
  -- Look up the UUID
  SELECT user_uuid INTO v_uuid FROM wallet_profiles WHERE wallet_address = lower(NEW.wallet_address);
  
  -- Auto-create wallet profile if it doesn't exist
  IF v_uuid IS NULL THEN
    INSERT INTO wallet_profiles (wallet_address)
    VALUES (lower(NEW.wallet_address))
    RETURNING user_uuid INTO v_uuid;
  END IF;
  
  NEW.user_uuid := v_uuid;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION populate_p2p_user_uuids()
RETURNS TRIGGER AS $$
DECLARE
  v_seller_uuid UUID;
  v_buyer_uuid UUID;
BEGIN
  IF NEW.seller_wallet IS NOT NULL THEN
    SELECT user_uuid INTO v_seller_uuid FROM wallet_profiles WHERE wallet_address = lower(NEW.seller_wallet);
    IF v_seller_uuid IS NULL THEN
      INSERT INTO wallet_profiles (wallet_address)
      VALUES (lower(NEW.seller_wallet))
      RETURNING user_uuid INTO v_seller_uuid;
    END IF;
    NEW.seller_uuid := v_seller_uuid;
  END IF;
  
  IF NEW.buyer_wallet IS NOT NULL THEN
    SELECT user_uuid INTO v_buyer_uuid FROM wallet_profiles WHERE wallet_address = lower(NEW.buyer_wallet);
    IF v_buyer_uuid IS NULL THEN
      INSERT INTO wallet_profiles (wallet_address)
      VALUES (lower(NEW.buyer_wallet))
      RETURNING user_uuid INTO v_buyer_uuid;
    END IF;
    NEW.buyer_uuid := v_buyer_uuid;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION populate_p2p_chat_sender_uuid()
RETURNS TRIGGER AS $$
DECLARE
  v_sender_uuid UUID;
BEGIN
  IF NEW.sender_wallet IS NOT NULL THEN
    SELECT user_uuid INTO v_sender_uuid FROM wallet_profiles WHERE wallet_address = lower(NEW.sender_wallet);
    IF v_sender_uuid IS NULL THEN
      INSERT INTO wallet_profiles (wallet_address)
      VALUES (lower(NEW.sender_wallet))
      RETURNING user_uuid INTO v_sender_uuid;
    END IF;
    NEW.sender_uuid := v_sender_uuid;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Register triggers BEFORE INSERT on downstream tables
DROP TRIGGER IF EXISTS trg_populate_kyc_uuid ON kyc;
CREATE TRIGGER trg_populate_kyc_uuid BEFORE INSERT OR UPDATE OF wallet_address ON kyc FOR EACH ROW EXECUTE FUNCTION populate_user_uuid_from_wallet();

DROP TRIGGER IF EXISTS trg_populate_business_kyc_uuid ON business_kyc;
CREATE TRIGGER trg_populate_business_kyc_uuid BEFORE INSERT OR UPDATE OF wallet_address ON business_kyc FOR EACH ROW EXECUTE FUNCTION populate_user_uuid_from_wallet();

DROP TRIGGER IF EXISTS trg_populate_merchant_qr_codes_uuid ON merchant_qr_codes;
CREATE TRIGGER trg_populate_merchant_qr_codes_uuid BEFORE INSERT OR UPDATE OF wallet_address ON merchant_qr_codes FOR EACH ROW EXECUTE FUNCTION populate_user_uuid_from_wallet();

DROP TRIGGER IF EXISTS trg_populate_cards_uuid ON cards;
CREATE TRIGGER trg_populate_cards_uuid BEFORE INSERT OR UPDATE OF wallet_address ON cards FOR EACH ROW EXECUTE FUNCTION populate_user_uuid_from_wallet();

DROP TRIGGER IF EXISTS trg_populate_vcc_cards_uuid ON vcc_cards;
CREATE TRIGGER trg_populate_vcc_cards_uuid BEFORE INSERT OR UPDATE OF wallet_address ON vcc_cards FOR EACH ROW EXECUTE FUNCTION populate_user_uuid_from_wallet();

DROP TRIGGER IF EXISTS trg_populate_card_requests_uuid ON card_requests;
CREATE TRIGGER trg_populate_card_requests_uuid BEFORE INSERT OR UPDATE OF wallet_address ON card_requests FOR EACH ROW EXECUTE FUNCTION populate_user_uuid_from_wallet();

DROP TRIGGER IF EXISTS trg_populate_transactions_uuid ON transactions;
CREATE TRIGGER trg_populate_transactions_uuid BEFORE INSERT OR UPDATE OF wallet_address ON transactions FOR EACH ROW EXECUTE FUNCTION populate_user_uuid_from_wallet();

DROP TRIGGER IF EXISTS trg_populate_backup_records_uuid ON backup_records;
CREATE TRIGGER trg_populate_backup_records_uuid BEFORE INSERT OR UPDATE OF wallet_address ON backup_records FOR EACH ROW EXECUTE FUNCTION populate_user_uuid_from_wallet();

DROP TRIGGER IF EXISTS trg_populate_p2p_orders_uuids ON p2p_orders;
CREATE TRIGGER trg_populate_p2p_orders_uuids BEFORE INSERT OR UPDATE OF seller_wallet, buyer_wallet ON p2p_orders FOR EACH ROW EXECUTE FUNCTION populate_p2p_user_uuids();

DROP TRIGGER IF EXISTS trg_populate_escrow_locks_uuids ON escrow_locks;
CREATE TRIGGER trg_populate_escrow_locks_uuids BEFORE INSERT OR UPDATE OF seller_wallet, buyer_wallet ON escrow_locks FOR EACH ROW EXECUTE FUNCTION populate_p2p_user_uuids();

DROP TRIGGER IF EXISTS trg_populate_p2p_chat_sender_uuid ON p2p_chat;
CREATE TRIGGER trg_populate_p2p_chat_sender_uuid BEFORE INSERT OR UPDATE OF sender_wallet ON p2p_chat FOR EACH ROW EXECUTE FUNCTION populate_p2p_chat_sender_uuid();

-- 8. Backfill existing records
UPDATE kyc t SET user_uuid = (SELECT user_uuid FROM wallet_profiles p WHERE p.wallet_address = lower(t.wallet_address)) WHERE t.user_uuid IS NULL;
UPDATE business_kyc t SET user_uuid = (SELECT user_uuid FROM wallet_profiles p WHERE p.wallet_address = lower(t.wallet_address)) WHERE t.user_uuid IS NULL;
UPDATE merchant_qr_codes t SET user_uuid = (SELECT user_uuid FROM wallet_profiles p WHERE p.wallet_address = lower(t.wallet_address)) WHERE t.user_uuid IS NULL;
UPDATE cards t SET user_uuid = (SELECT user_uuid FROM wallet_profiles p WHERE p.wallet_address = lower(t.wallet_address)) WHERE t.user_uuid IS NULL;
UPDATE vcc_cards t SET user_uuid = (SELECT user_uuid FROM wallet_profiles p WHERE p.wallet_address = lower(t.wallet_address)) WHERE t.user_uuid IS NULL;
UPDATE card_requests t SET user_uuid = (SELECT user_uuid FROM wallet_profiles p WHERE p.wallet_address = lower(t.wallet_address)) WHERE t.user_uuid IS NULL;
UPDATE transactions t SET user_uuid = (SELECT user_uuid FROM wallet_profiles p WHERE p.wallet_address = lower(t.wallet_address)) WHERE t.user_uuid IS NULL;
UPDATE backup_records t SET user_uuid = (SELECT user_uuid FROM wallet_profiles p WHERE p.wallet_address = lower(t.wallet_address)) WHERE t.user_uuid IS NULL;
UPDATE p2p_chat t SET sender_uuid = (SELECT user_uuid FROM wallet_profiles p WHERE p.wallet_address = lower(t.sender_wallet)) WHERE t.sender_uuid IS NULL;

UPDATE p2p_orders t SET 
  seller_uuid = (SELECT user_uuid FROM wallet_profiles p WHERE p.wallet_address = lower(t.seller_wallet)),
  buyer_uuid = (SELECT user_uuid FROM wallet_profiles p WHERE p.wallet_address = lower(t.buyer_wallet))
WHERE t.seller_uuid IS NULL OR (t.buyer_wallet IS NOT NULL AND t.buyer_uuid IS NULL);

UPDATE escrow_locks t SET 
  seller_uuid = (SELECT user_uuid FROM wallet_profiles p WHERE p.wallet_address = lower(t.seller_wallet)),
  buyer_uuid = (SELECT user_uuid FROM wallet_profiles p WHERE p.wallet_address = lower(t.buyer_wallet))
WHERE t.seller_uuid IS NULL OR (t.buyer_wallet IS NOT NULL AND t.buyer_uuid IS NULL);
