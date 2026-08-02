-- =============================================================================
-- Admin Dashboard RPCs & Upgrades — CryptoWallet
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run
-- =============================================================================

-- ─── 1. Upgrade wallet_profiles for suspension support ────────────────────────
ALTER TABLE wallet_profiles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE;

-- ─── 2. Fetch all wallet profiles (Bypass RLS) ────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_wallet_profiles()
RETURNS TABLE (
  wallet_address  TEXT,
  wallet_name     TEXT,
  account_type    TEXT,
  p2p_country     TEXT,
  p2p_currency    TEXT,
  tron_address    TEXT,
  network         TEXT,
  is_dark_mode    BOOLEAN,
  token_balances  JSONB,
  locked_balances JSONB,
  is_suspended    BOOLEAN,
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY 
  SELECT 
    w.wallet_address,
    w.wallet_name,
    w.account_type,
    w.p2p_country,
    w.p2p_currency,
    w.tron_address,
    w.network,
    w.is_dark_mode,
    w.token_balances,
    w.locked_balances,
    w.is_suspended,
    w.created_at,
    w.updated_at
  FROM wallet_profiles w
  ORDER BY w.created_at DESC;
END;
$$;

-- ─── 3. Suspend or reactivate user ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_toggle_user_suspension(
  p_wallet    TEXT,
  p_suspend   BOOLEAN
)
RETURNS VOID 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE wallet_profiles
  SET 
    is_suspended = p_suspend,
    updated_at   = NOW()
  WHERE wallet_address = lower(p_wallet);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet profile not found: %', p_wallet;
  END IF;
END;
$$;

-- ─── 4. Fetch all transactions (Bypass RLS) ───────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_all_transactions()
RETURNS SETOF transactions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY 
  SELECT * FROM transactions
  ORDER BY created_at DESC;
END;
$$;

-- ─── 5. Fetch all P2P orders (Bypass RLS) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_all_p2p_orders()
RETURNS SETOF p2p_orders
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY 
  SELECT * FROM p2p_orders
  ORDER BY created_at DESC;
END;
$$;

-- ─── 6. Fetch all Escrow locks (Bypass RLS) ───────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_all_escrow_locks()
RETURNS SETOF escrow_locks
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY 
  SELECT * FROM escrow_locks
  ORDER BY created_at DESC;
END;
$$;

-- ─── 7. Resolve P2P Dispute ───────────────────────────────────────────────────
-- Admin forces dispute resolution:
-- - 'release' -> releases escrow to buyer, status = 'completed'
-- - 'refund'  -> refunds escrow to seller, status = 'cancelled'
CREATE OR REPLACE FUNCTION admin_resolve_p2p_dispute(
  p_order_id   UUID,
  p_resolution TEXT -- 'release' or 'refund'
)
RETURNS VOID 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_lock  RECORD;
BEGIN
  -- 1. Fetch order
  SELECT * INTO v_order FROM p2p_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'P2P Order not found';
  END IF;

  IF v_order.status != 'disputed' THEN
    RAISE EXCEPTION 'Order is not in disputed state';
  END IF;

  -- 2. Fetch locked escrow
  SELECT * INTO v_lock FROM escrow_locks WHERE order_id = p_order_id AND status = 'locked';
  IF NOT FOUND THEN
    -- If no active escrow locked, just change order status
    IF p_resolution = 'release' THEN
      UPDATE p2p_orders SET status = 'completed' WHERE id = p_order_id;
    ELSE
      UPDATE p2p_orders SET status = 'cancelled' WHERE id = p_order_id;
    END IF;
    RETURN;
  END IF;

  -- 3. Perform Resolution
  IF p_resolution = 'release' THEN
    -- Release locked escrow to buyer
    UPDATE escrow_locks SET status = 'released' WHERE id = v_lock.id;
    UPDATE p2p_orders SET status = 'completed' WHERE id = p_order_id;
  ELSIF p_resolution = 'refund' THEN
    -- Refund locked escrow to seller
    UPDATE escrow_locks SET status = 'refunded' WHERE id = v_lock.id;
    UPDATE p2p_orders SET status = 'cancelled' WHERE id = p_order_id;
  ELSE
    RAISE EXCEPTION 'Invalid resolution. Must be release or refund';
  END IF;
END;
$$;
