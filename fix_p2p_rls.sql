-- Fix p2p_orders RLS so My Orders tab shows all orders for the wallet
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "p2p_orders_select" ON p2p_orders;
DROP POLICY IF EXISTS "p2p_orders_insert" ON p2p_orders;
DROP POLICY IF EXISTS "p2p_orders_update" ON p2p_orders;
DROP POLICY IF EXISTS "anon_all_p2p_orders" ON p2p_orders;
DROP POLICY IF EXISTS "anon_read_p2p_orders" ON p2p_orders;
DROP POLICY IF EXISTS "anon_insert_p2p_orders" ON p2p_orders;
DROP POLICY IF EXISTS "anon_update_p2p_orders" ON p2p_orders;
DROP POLICY IF EXISTS "users_read_p2p_orders" ON p2p_orders;
DROP POLICY IF EXISTS "users_write_p2p_orders" ON p2p_orders;

-- Enable RLS
ALTER TABLE p2p_orders ENABLE ROW LEVEL SECURITY;

-- Allow anon to read ALL orders (needed for Buy tab marketplace listing)
CREATE POLICY "anon_read_p2p_orders"
ON p2p_orders FOR SELECT TO anon
USING (true);

-- Allow anon to insert orders (creating sell listings)
CREATE POLICY "anon_insert_p2p_orders"
ON p2p_orders FOR INSERT TO anon
WITH CHECK (true);

-- Allow anon to update orders (buying, payment flow, cancel)
CREATE POLICY "anon_update_p2p_orders"
ON p2p_orders FOR UPDATE TO anon
USING (true)
WITH CHECK (true);

-- Also fix escrow_locks table
DROP POLICY IF EXISTS "anon_all_escrow_locks" ON escrow_locks;
ALTER TABLE escrow_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_escrow_locks"
ON escrow_locks FOR ALL TO anon
USING (true)
WITH CHECK (true);
