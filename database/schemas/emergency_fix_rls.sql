-- ============================================================
-- EMERGENCY FIX — Run this in Supabase SQL Editor RIGHT NOW
-- ============================================================

-- STEP 1: Check if data actually exists (run this first to confirm)
-- SELECT COUNT(*) FROM p2p_orders;
-- SELECT * FROM p2p_orders LIMIT 5;

-- STEP 2: Nuke ALL existing policies on p2p_orders
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'p2p_orders'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON p2p_orders', pol.policyname);
  END LOOP;
END $$;

-- STEP 3: Nuke ALL existing policies on escrow_locks
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'escrow_locks'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON escrow_locks', pol.policyname);
  END LOOP;
END $$;

-- STEP 4: Nuke ALL existing policies on p2p_chat (if exists)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'p2p_chat'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON p2p_chat', pol.policyname);
  END LOOP;
END $$;

-- STEP 5: Enable RLS
ALTER TABLE p2p_orders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_locks ENABLE ROW LEVEL SECURITY;

-- STEP 6: Create fully open anon policies (no set_wallet needed)
CREATE POLICY "p2p_orders_anon_all"
ON p2p_orders FOR ALL TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "escrow_locks_anon_all"
ON escrow_locks FOR ALL TO anon
USING (true)
WITH CHECK (true);

-- STEP 7: Also open p2p_chat if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'p2p_chat') THEN
    ALTER TABLE p2p_chat ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "p2p_chat_anon_all" ON p2p_chat FOR ALL TO anon USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- STEP 8: Verify policies were created
SELECT tablename, policyname, cmd FROM pg_policies
WHERE tablename IN ('p2p_orders', 'escrow_locks', 'p2p_chat')
ORDER BY tablename;
