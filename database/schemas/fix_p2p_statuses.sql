-- =============================================================================
-- Migration: Update P2P Order Statuses
-- =============================================================================

-- Drop the existing constraint
ALTER TABLE p2p_orders DROP CONSTRAINT IF EXISTS p2p_orders_status_check;

-- Optionally, update existing rows to the new status names
UPDATE p2p_orders SET status = 'escrow_locked' WHERE status = 'in_escrow';
UPDATE p2p_orders SET status = 'payment_pending' WHERE status = 'fiat_sent';

-- Add the new constraint
ALTER TABLE p2p_orders ADD CONSTRAINT p2p_orders_status_check 
CHECK (status IN ('open','escrow_locked','payment_pending','payment_verification','crypto_released','completed','cancelled','disputed'));
