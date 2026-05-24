-- =============================================================================
-- Wallet Profiles — stores ALL wallet state in Supabase
-- Run in: https://supabase.com/dashboard/project/hxmacphgbpedazdvgdnz/sql/new
-- Safe to re-run (CREATE OR REPLACE / IF NOT EXISTS)
-- =============================================================================

-- ─── 1. Table ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_profiles (
  wallet_address  TEXT PRIMARY KEY,
  wallet_name     TEXT        NOT NULL DEFAULT 'My Wallet',
  account_type    TEXT        NOT NULL DEFAULT 'personal' CHECK (account_type IN ('personal', 'business')),
  p2p_country     TEXT        NOT NULL DEFAULT 'United States',
  p2p_currency    TEXT        NOT NULL DEFAULT 'USD',
  tron_address    TEXT,
  network         TEXT        NOT NULL DEFAULT 'Sepolia',
  is_dark_mode    BOOLEAN     NOT NULL DEFAULT true,
  token_balances  JSONB       NOT NULL DEFAULT '{}',
  locked_balances JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Add new columns to existing table (safe to re-run)
ALTER TABLE wallet_profiles ADD COLUMN IF NOT EXISTS tron_address    TEXT;
ALTER TABLE wallet_profiles ADD COLUMN IF NOT EXISTS network         TEXT        NOT NULL DEFAULT 'Sepolia';
ALTER TABLE wallet_profiles ADD COLUMN IF NOT EXISTS is_dark_mode    BOOLEAN     NOT NULL DEFAULT true;
ALTER TABLE wallet_profiles ADD COLUMN IF NOT EXISTS token_balances  JSONB       NOT NULL DEFAULT '{}';
ALTER TABLE wallet_profiles ADD COLUMN IF NOT EXISTS locked_balances JSONB       NOT NULL DEFAULT '{}';

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
CREATE OR REPLACE FUNCTION upsert_wallet_profile(
  p_wallet          TEXT,
  p_name            TEXT    DEFAULT NULL,
  p_account_type    TEXT    DEFAULT NULL,
  p_p2p_country     TEXT    DEFAULT NULL,
  p_p2p_currency    TEXT    DEFAULT NULL,
  p_tron_address    TEXT    DEFAULT NULL,
  p_network         TEXT    DEFAULT NULL,
  p_is_dark_mode    BOOLEAN DEFAULT NULL,
  p_token_balances  JSONB   DEFAULT NULL,
  p_locked_balances JSONB   DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result RECORD;
BEGIN
  PERFORM set_config('app.wallet', lower(p_wallet), false);

  INSERT INTO wallet_profiles (
    wallet_address, wallet_name, account_type, p2p_country, p2p_currency,
    tron_address, network, is_dark_mode, token_balances, locked_balances
  )
  VALUES (
    lower(p_wallet),
    COALESCE(p_name,         'My Wallet'),
    COALESCE(p_account_type, 'personal'),
    COALESCE(p_p2p_country,  'United States'),
    COALESCE(p_p2p_currency, 'USD'),
    p_tron_address,
    COALESCE(p_network,      'Sepolia'),
    COALESCE(p_is_dark_mode, true),
    COALESCE(p_token_balances,  '{}'),
    COALESCE(p_locked_balances, '{}')
  )
  ON CONFLICT (wallet_address) DO UPDATE SET
    wallet_name     = COALESCE(p_name,            wallet_profiles.wallet_name),
    account_type    = COALESCE(p_account_type,    wallet_profiles.account_type),
    p2p_country     = COALESCE(p_p2p_country,     wallet_profiles.p2p_country),
    p2p_currency    = COALESCE(p_p2p_currency,    wallet_profiles.p2p_currency),
    tron_address    = COALESCE(p_tron_address,    wallet_profiles.tron_address),
    network         = COALESCE(p_network,         wallet_profiles.network),
    is_dark_mode    = COALESCE(p_is_dark_mode,    wallet_profiles.is_dark_mode),
    token_balances  = COALESCE(p_token_balances,  wallet_profiles.token_balances),
    locked_balances = COALESCE(p_locked_balances, wallet_profiles.locked_balances),
    updated_at      = NOW()
  RETURNING * INTO v_result;

  RETURN row_to_json(v_result);
END;
$$;
