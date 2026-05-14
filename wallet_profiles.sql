-- =============================================================================
-- Wallet Profiles — stores wallet name & preferences in Supabase
-- Run in: https://supabase.com/dashboard/project/hxmacphgbpedazdvgdnz/sql/new
-- Safe to re-run (CREATE OR REPLACE / IF NOT EXISTS)
-- =============================================================================

-- ─── 1. Table ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_profiles (
  wallet_address TEXT PRIMARY KEY,
  wallet_name    TEXT NOT NULL DEFAULT 'My Wallet',
  account_type   TEXT NOT NULL DEFAULT 'personal' CHECK (account_type IN ('personal', 'business')),
  p2p_country    TEXT NOT NULL DEFAULT 'United States',
  p2p_currency   TEXT NOT NULL DEFAULT 'USD',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- updated_at trigger
DROP TRIGGER IF EXISTS wallet_profiles_updated_at ON wallet_profiles;
CREATE TRIGGER wallet_profiles_updated_at
  BEFORE UPDATE ON wallet_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 2. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE wallet_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_own" ON wallet_profiles;
CREATE POLICY "profile_own" ON wallet_profiles
  FOR ALL TO anon
  USING (wallet_address = current_wallet())
  WITH CHECK (wallet_address = current_wallet());

-- ─── 3. get_wallet_profile ────────────────────────────────────────────────────
-- Atomically sets wallet context + reads profile in one call.
CREATE OR REPLACE FUNCTION get_wallet_profile(p_wallet TEXT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_record RECORD;
BEGIN
  PERFORM set_config('app.wallet', lower(p_wallet), false);
  SELECT * INTO v_record FROM wallet_profiles WHERE wallet_address = lower(p_wallet);
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN row_to_json(v_record);
END;
$$;

-- ─── 4. upsert_wallet_profile ─────────────────────────────────────────────────
-- Called whenever wallet name or preferences change.
-- Creates the row on first call, updates on subsequent calls.
CREATE OR REPLACE FUNCTION upsert_wallet_profile(
  p_wallet       TEXT,
  p_name         TEXT DEFAULT NULL,
  p_account_type TEXT DEFAULT NULL,
  p_p2p_country  TEXT DEFAULT NULL,
  p_p2p_currency TEXT DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result RECORD;
BEGIN
  PERFORM set_config('app.wallet', lower(p_wallet), false);

  INSERT INTO wallet_profiles (wallet_address, wallet_name, account_type, p2p_country, p2p_currency)
  VALUES (
    lower(p_wallet),
    COALESCE(p_name, 'My Wallet'),
    COALESCE(p_account_type, 'personal'),
    COALESCE(p_p2p_country, 'United States'),
    COALESCE(p_p2p_currency, 'USD')
  )
  ON CONFLICT (wallet_address) DO UPDATE SET
    wallet_name  = COALESCE(p_name,         wallet_profiles.wallet_name),
    account_type = COALESCE(p_account_type, wallet_profiles.account_type),
    p2p_country  = COALESCE(p_p2p_country,  wallet_profiles.p2p_country),
    p2p_currency = COALESCE(p_p2p_currency, wallet_profiles.p2p_currency),
    updated_at   = NOW()
  RETURNING * INTO v_result;

  RETURN row_to_json(v_result);
END;
$$;
