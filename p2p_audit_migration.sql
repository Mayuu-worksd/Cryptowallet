-- =============================================================================
-- Migration: P2P Audit Fixes & Schema Extensions
-- =============================================================================

-- 1. Add new fields to p2p_orders table
ALTER TABLE p2p_orders ADD COLUMN IF NOT EXISTS seller_payment_details TEXT; -- JSON string for bank/UPI details shown to buyer
ALTER TABLE p2p_orders ADD COLUMN IF NOT EXISTS payment_proof_url      TEXT; -- URL for buyer payment screenshot
ALTER TABLE p2p_orders ADD COLUMN IF NOT EXISTS payment_reference      TEXT; -- UTR / Reference number from buyer
ALTER TABLE p2p_orders ADD COLUMN IF NOT EXISTS payment_verified_at    TIMESTAMPTZ;
ALTER TABLE p2p_orders ADD COLUMN IF NOT EXISTS payment_verified_by    TEXT;

-- 2. Update status check constraint (to handle all required statuses)
ALTER TABLE p2p_orders DROP CONSTRAINT IF EXISTS p2p_orders_status_check;
ALTER TABLE p2p_orders ADD CONSTRAINT p2p_orders_status_check 
CHECK (status IN ('open','escrow_locked','payment_pending','payment_verification','crypto_released','completed','cancelled','disputed'));

-- 3. Tighten RLS policies for buyer updates to prevent unauthorized modifications
DROP POLICY IF EXISTS "p2p_orders_update_buyer" ON p2p_orders;

CREATE POLICY "p2p_orders_update_buyer" ON p2p_orders
  FOR UPDATE TO anon
  USING (
    buyer_wallet = current_wallet()
    OR (status = 'open' AND buyer_wallet IS NULL)
  )
  WITH CHECK (
    (buyer_wallet = current_wallet())
    OR (status = 'open' AND buyer_wallet IS NULL AND current_wallet() IS NOT NULL)
  );
