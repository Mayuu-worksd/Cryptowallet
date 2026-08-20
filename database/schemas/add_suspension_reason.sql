-- Fix: Add suspension_reason to wallet_profiles + update admin toggle RPC
-- Run in Supabase SQL Editor

-- 1. Add suspension_reason column (nullable)
ALTER TABLE wallet_profiles
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- 2. Replace admin toggle RPC to accept and store reason
CREATE OR REPLACE FUNCTION admin_toggle_user_suspension(
  p_wallet  TEXT,
  p_suspend BOOLEAN,
  p_reason  TEXT DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE wallet_profiles
  SET
    is_suspended       = p_suspend,
    suspension_reason  = CASE WHEN p_suspend THEN COALESCE(p_reason, 'Suspended by administrator') ELSE NULL END,
    updated_at         = NOW()
  WHERE wallet_address = lower(p_wallet);
END;
$$;

-- 3. Verify
SELECT wallet_address, is_suspended, suspension_reason
FROM wallet_profiles
WHERE is_suspended = true
LIMIT 5;
