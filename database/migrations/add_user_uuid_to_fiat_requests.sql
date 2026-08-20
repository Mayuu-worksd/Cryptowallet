-- =============================================================================
-- Migration: Redefine User Identity Triggers for user_id Schema
-- Run in: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- =============================================================================

-- 1. Redefine trigger function populate_user_uuid_from_wallet to use user_id
CREATE OR REPLACE FUNCTION populate_user_uuid_from_wallet()
RETURNS TRIGGER AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Look up the user_id (UUID) from wallet_profiles using NEW.wallet_address
  SELECT user_id INTO v_id FROM wallet_profiles WHERE wallet_address = lower(NEW.wallet_address);
  
  -- Auto-create wallet profile if it doesn't exist
  IF v_id IS NULL THEN
    INSERT INTO wallet_profiles (wallet_address)
    VALUES (lower(NEW.wallet_address))
    RETURNING user_id INTO v_id;
  END IF;
  
  -- Set user_id (since all downstream tables use user_id in the live DB)
  NEW.user_id := v_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Redefine trigger function populate_p2p_user_uuids to use user_id
CREATE OR REPLACE FUNCTION populate_p2p_user_uuids()
RETURNS TRIGGER AS $$
DECLARE
  v_seller_uuid UUID;
  v_buyer_uuid UUID;
BEGIN
  IF NEW.seller_wallet IS NOT NULL THEN
    SELECT user_id INTO v_seller_uuid FROM wallet_profiles WHERE wallet_address = lower(NEW.seller_wallet);
    IF v_seller_uuid IS NULL THEN
      INSERT INTO wallet_profiles (wallet_address)
      VALUES (lower(NEW.seller_wallet))
      RETURNING user_id INTO v_seller_uuid;
    END IF;
    NEW.seller_uuid := v_seller_uuid;
  END IF;
  
  IF NEW.buyer_wallet IS NOT NULL THEN
    SELECT user_id INTO v_buyer_uuid FROM wallet_profiles WHERE wallet_address = lower(NEW.buyer_wallet);
    IF v_buyer_uuid IS NULL THEN
      INSERT INTO wallet_profiles (wallet_address)
      VALUES (lower(NEW.buyer_wallet))
      RETURNING user_id INTO v_buyer_uuid;
    END IF;
    NEW.buyer_uuid := v_buyer_uuid;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Redefine trigger function populate_p2p_chat_sender_uuid to use user_id
CREATE OR REPLACE FUNCTION populate_p2p_chat_sender_uuid()
RETURNS TRIGGER AS $$
DECLARE
  v_sender_uuid UUID;
BEGIN
  IF NEW.sender_wallet IS NOT NULL THEN
    SELECT user_id INTO v_sender_uuid FROM wallet_profiles WHERE wallet_address = lower(NEW.sender_wallet);
    IF v_sender_uuid IS NULL THEN
      INSERT INTO wallet_profiles (wallet_address)
      VALUES (lower(NEW.sender_wallet))
      RETURNING user_id INTO v_sender_uuid;
    END IF;
    NEW.sender_uuid := v_sender_uuid;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
