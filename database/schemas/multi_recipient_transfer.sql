-- =============================================================================
-- Migration: Multi-Recipient Transfer System
-- Run in: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- Prerequisite: user_identity_migration.sql must be run first
-- =============================================================================

-- 1. Create recent_recipients table
CREATE TABLE IF NOT EXISTS recent_recipients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_wallet TEXT NOT NULL,
  recipient_wallet TEXT NOT NULL,
  recipient_name TEXT,
  recipient_uid BIGINT,
  method TEXT NOT NULL CHECK (method IN ('uid', 'email', 'phone', 'wallet')),
  last_used_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sender_wallet, recipient_wallet)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_recent_recipients_sender ON recent_recipients(sender_wallet, last_used_at DESC);

-- 2. Lookup by UID
CREATE OR REPLACE FUNCTION lookup_recipient_by_uid(p_uid BIGINT)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'found', true,
    'wallet_address', wp.wallet_address,
    'tron_address', wp.tron_address,
    'wallet_name', COALESCE(wp.wallet_name, 'Account 1'),
    'user_uid', wp.user_uid,
    'account_type', COALESCE(wp.account_type, 'personal'),
    'kyc_status', k.status,
    'kyc_name', CASE 
      WHEN k.full_name IS NOT NULL THEN 
        LEFT(k.full_name, 3) || '***'
      ELSE NULL 
    END,
    'masked_email', CASE 
      WHEN k.email IS NOT NULL THEN 
        LEFT(k.email, 3) || '***@' || SPLIT_PART(k.email, '@', 2)
      ELSE NULL 
    END
  ) INTO v_result
  FROM wallet_profiles wp
  LEFT JOIN kyc k ON k.wallet_address = wp.wallet_address
  WHERE wp.user_uid = p_uid
  LIMIT 1;

  IF v_result IS NULL THEN
    RETURN json_build_object('found', false);
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Lookup by Email
CREATE OR REPLACE FUNCTION lookup_recipient_by_email(p_email TEXT)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'found', true,
    'wallet_address', wp.wallet_address,
    'tron_address', wp.tron_address,
    'wallet_name', COALESCE(wp.wallet_name, 'Account 1'),
    'user_uid', wp.user_uid,
    'account_type', COALESCE(wp.account_type, 'personal'),
    'kyc_status', k.status,
    'kyc_name', CASE 
      WHEN k.full_name IS NOT NULL THEN 
        LEFT(k.full_name, 3) || '***'
      ELSE NULL 
    END,
    'masked_email', CASE 
      WHEN k.email IS NOT NULL THEN 
        LEFT(k.email, 3) || '***@' || SPLIT_PART(k.email, '@', 2)
      ELSE NULL 
    END
  ) INTO v_result
  FROM kyc k
  INNER JOIN wallet_profiles wp ON wp.wallet_address = k.wallet_address
  WHERE LOWER(TRIM(k.email)) = LOWER(TRIM(p_email))
  LIMIT 1;

  IF v_result IS NULL THEN
    RETURN json_build_object('found', false);
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Lookup by Phone
CREATE OR REPLACE FUNCTION lookup_recipient_by_phone(p_phone TEXT)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
  v_clean_phone TEXT;
BEGIN
  -- Strip spaces, dashes, parens for flexible matching
  v_clean_phone := REGEXP_REPLACE(TRIM(p_phone), '[^0-9+]', '', 'g');

  SELECT json_build_object(
    'found', true,
    'wallet_address', wp.wallet_address,
    'tron_address', wp.tron_address,
    'wallet_name', COALESCE(wp.wallet_name, 'Account 1'),
    'user_uid', wp.user_uid,
    'account_type', COALESCE(wp.account_type, 'personal'),
    'kyc_status', k.status,
    'kyc_name', CASE 
      WHEN k.full_name IS NOT NULL THEN 
        LEFT(k.full_name, 3) || '***'
      ELSE NULL 
    END,
    'masked_email', CASE 
      WHEN k.email IS NOT NULL THEN 
        LEFT(k.email, 3) || '***@' || SPLIT_PART(k.email, '@', 2)
      ELSE NULL 
    END
  ) INTO v_result
  FROM kyc k
  INNER JOIN wallet_profiles wp ON wp.wallet_address = k.wallet_address
  WHERE REGEXP_REPLACE(TRIM(k.phone), '[^0-9+]', '', 'g') LIKE '%' || v_clean_phone
     OR REGEXP_REPLACE(TRIM(k.phone), '[^0-9+]', '', 'g') = v_clean_phone
  LIMIT 1;

  IF v_result IS NULL THEN
    RETURN json_build_object('found', false);
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Lookup by Wallet Address
CREATE OR REPLACE FUNCTION lookup_recipient_by_wallet(p_wallet TEXT)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
  v_addr TEXT;
BEGIN
  v_addr := LOWER(TRIM(p_wallet));

  SELECT json_build_object(
    'found', true,
    'wallet_address', wp.wallet_address,
    'tron_address', wp.tron_address,
    'wallet_name', COALESCE(wp.wallet_name, 'Account 1'),
    'user_uid', wp.user_uid,
    'account_type', COALESCE(wp.account_type, 'personal'),
    'kyc_status', k.status,
    'kyc_name', CASE 
      WHEN k.full_name IS NOT NULL THEN 
        LEFT(k.full_name, 3) || '***'
      ELSE NULL 
    END,
    'masked_email', CASE 
      WHEN k.email IS NOT NULL THEN 
        LEFT(k.email, 3) || '***@' || SPLIT_PART(k.email, '@', 2)
      ELSE NULL 
    END
  ) INTO v_result
  FROM wallet_profiles wp
  LEFT JOIN kyc k ON k.wallet_address = wp.wallet_address
  WHERE wp.wallet_address = v_addr
     OR LOWER(wp.tron_address) = v_addr
  LIMIT 1;

  IF v_result IS NULL THEN
    RETURN json_build_object('found', false);
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Save recent recipient
CREATE OR REPLACE FUNCTION save_recent_recipient(
  p_sender_wallet TEXT,
  p_recipient_wallet TEXT,
  p_recipient_name TEXT DEFAULT NULL,
  p_recipient_uid BIGINT DEFAULT NULL,
  p_method TEXT DEFAULT 'wallet'
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO recent_recipients (sender_wallet, recipient_wallet, recipient_name, recipient_uid, method, last_used_at)
  VALUES (LOWER(TRIM(p_sender_wallet)), LOWER(TRIM(p_recipient_wallet)), p_recipient_name, p_recipient_uid, p_method, now())
  ON CONFLICT (sender_wallet, recipient_wallet) DO UPDATE
    SET recipient_name = COALESCE(EXCLUDED.recipient_name, recent_recipients.recipient_name),
        recipient_uid = COALESCE(EXCLUDED.recipient_uid, recent_recipients.recipient_uid),
        method = EXCLUDED.method,
        last_used_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Get recent recipients
CREATE OR REPLACE FUNCTION get_recent_recipients(p_sender_wallet TEXT)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_to_json(t)) INTO v_result
  FROM (
    SELECT 
      rr.recipient_wallet,
      rr.recipient_name,
      rr.recipient_uid,
      rr.method,
      rr.last_used_at,
      COALESCE(wp.wallet_name, rr.recipient_name, 'Unknown') as wallet_name,
      wp.account_type,
      wp.tron_address
    FROM recent_recipients rr
    LEFT JOIN wallet_profiles wp ON wp.wallet_address = rr.recipient_wallet
    WHERE rr.sender_wallet = LOWER(TRIM(p_sender_wallet))
    ORDER BY rr.last_used_at DESC
    LIMIT 10
  ) t;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
