-- ============================================================
-- FIX ALL RLS POLICIES FOR ALL TABLES
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- ─── p2p_orders ───────────────────────────────────────────
DROP POLICY IF EXISTS "p2p_orders_anon_all"    ON p2p_orders;
DROP POLICY IF EXISTS "p2p_orders_anon_select" ON p2p_orders;
DROP POLICY IF EXISTS "p2p_orders_anon_insert" ON p2p_orders;
DROP POLICY IF EXISTS "p2p_orders_anon_update" ON p2p_orders;
DROP POLICY IF EXISTS "p2p_orders_anon_delete" ON p2p_orders;
DROP POLICY IF EXISTS "p2p_select"             ON p2p_orders;
DROP POLICY IF EXISTS "p2p_insert"             ON p2p_orders;
DROP POLICY IF EXISTS "p2p_update"             ON p2p_orders;
DROP POLICY IF EXISTS "p2p_delete"             ON p2p_orders;

ALTER TABLE p2p_orders ENABLE ROW LEVEL SECURITY;
GRANT ALL ON p2p_orders TO anon, authenticated, service_role;
CREATE POLICY "p2p_select" ON p2p_orders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "p2p_insert" ON p2p_orders FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "p2p_update" ON p2p_orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "p2p_delete" ON p2p_orders FOR DELETE TO anon, authenticated USING (true);

-- ─── escrow_locks ─────────────────────────────────────────
DROP POLICY IF EXISTS "escrow_locks_anon_all"    ON escrow_locks;
DROP POLICY IF EXISTS "escrow_locks_anon_select" ON escrow_locks;
DROP POLICY IF EXISTS "escrow_locks_anon_insert" ON escrow_locks;
DROP POLICY IF EXISTS "escrow_locks_anon_update" ON escrow_locks;
DROP POLICY IF EXISTS "escrow_locks_anon_delete" ON escrow_locks;

ALTER TABLE escrow_locks ENABLE ROW LEVEL SECURITY;
GRANT ALL ON escrow_locks TO anon, authenticated, service_role;
CREATE POLICY "escrow_select" ON escrow_locks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "escrow_insert" ON escrow_locks FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "escrow_update" ON escrow_locks FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "escrow_delete" ON escrow_locks FOR DELETE TO anon, authenticated USING (true);

-- ─── p2p_chat (if exists) ─────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'p2p_chat') THEN
    EXECUTE 'DROP POLICY IF EXISTS "p2p_chat_anon_all" ON p2p_chat';
    EXECUTE 'ALTER TABLE p2p_chat ENABLE ROW LEVEL SECURITY';
    EXECUTE 'GRANT ALL ON p2p_chat TO anon, authenticated, service_role';
    EXECUTE 'CREATE POLICY "chat_select" ON p2p_chat FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "chat_insert" ON p2p_chat FOR INSERT TO anon, authenticated WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "chat_update" ON p2p_chat FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "chat_delete" ON p2p_chat FOR DELETE TO anon, authenticated USING (true)';
  END IF;
END $$;

-- ─── merchant_qr_codes (if exists) ────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchant_qr_codes') THEN
    EXECUTE 'ALTER TABLE merchant_qr_codes ENABLE ROW LEVEL SECURITY';
    EXECUTE 'GRANT ALL ON merchant_qr_codes TO anon, authenticated, service_role';
    EXECUTE 'DROP POLICY IF EXISTS "mqr_select" ON merchant_qr_codes';
    EXECUTE 'DROP POLICY IF EXISTS "mqr_insert" ON merchant_qr_codes';
    EXECUTE 'DROP POLICY IF EXISTS "mqr_update" ON merchant_qr_codes';
    EXECUTE 'DROP POLICY IF EXISTS "mqr_delete" ON merchant_qr_codes';
    EXECUTE 'CREATE POLICY "mqr_select" ON merchant_qr_codes FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "mqr_insert" ON merchant_qr_codes FOR INSERT TO anon, authenticated WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "mqr_update" ON merchant_qr_codes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "mqr_delete" ON merchant_qr_codes FOR DELETE TO anon, authenticated USING (true)';
  END IF;
END $$;

-- ─── kyc_submissions (if exists) ──────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kyc_submissions') THEN
    EXECUTE 'ALTER TABLE kyc_submissions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'GRANT ALL ON kyc_submissions TO anon, authenticated, service_role';
    EXECUTE 'DROP POLICY IF EXISTS "kyc_select" ON kyc_submissions';
    EXECUTE 'DROP POLICY IF EXISTS "kyc_insert" ON kyc_submissions';
    EXECUTE 'DROP POLICY IF EXISTS "kyc_update" ON kyc_submissions';
    EXECUTE 'CREATE POLICY "kyc_select" ON kyc_submissions FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "kyc_insert" ON kyc_submissions FOR INSERT TO anon, authenticated WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "kyc_update" ON kyc_submissions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ─── cards / vcc_cards (if exists) ────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cards') THEN
    EXECUTE 'ALTER TABLE cards ENABLE ROW LEVEL SECURITY';
    EXECUTE 'GRANT ALL ON cards TO anon, authenticated, service_role';
    EXECUTE 'DROP POLICY IF EXISTS "cards_select" ON cards';
    EXECUTE 'DROP POLICY IF EXISTS "cards_insert" ON cards';
    EXECUTE 'DROP POLICY IF EXISTS "cards_update" ON cards';
    EXECUTE 'CREATE POLICY "cards_select" ON cards FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "cards_insert" ON cards FOR INSERT TO anon, authenticated WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "cards_update" ON cards FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vcc_cards') THEN
    EXECUTE 'ALTER TABLE vcc_cards ENABLE ROW LEVEL SECURITY';
    EXECUTE 'GRANT ALL ON vcc_cards TO anon, authenticated, service_role';
    EXECUTE 'DROP POLICY IF EXISTS "vcc_select" ON vcc_cards';
    EXECUTE 'DROP POLICY IF EXISTS "vcc_insert" ON vcc_cards';
    EXECUTE 'DROP POLICY IF EXISTS "vcc_update" ON vcc_cards';
    EXECUTE 'CREATE POLICY "vcc_select" ON vcc_cards FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "vcc_insert" ON vcc_cards FOR INSERT TO anon, authenticated WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "vcc_update" ON vcc_cards FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ─── transactions (if exists) ─────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') THEN
    EXECUTE 'ALTER TABLE transactions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'GRANT ALL ON transactions TO anon, authenticated, service_role';
    EXECUTE 'DROP POLICY IF EXISTS "tx_select" ON transactions';
    EXECUTE 'DROP POLICY IF EXISTS "tx_insert" ON transactions';
    EXECUTE 'DROP POLICY IF EXISTS "tx_update" ON transactions';
    EXECUTE 'CREATE POLICY "tx_select" ON transactions FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "tx_insert" ON transactions FOR INSERT TO anon, authenticated WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "tx_update" ON transactions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ─── profiles (if exists) ─────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    EXECUTE 'ALTER TABLE profiles ENABLE ROW LEVEL SECURITY';
    EXECUTE 'GRANT ALL ON profiles TO anon, authenticated, service_role';
    EXECUTE 'DROP POLICY IF EXISTS "profiles_select" ON profiles';
    EXECUTE 'DROP POLICY IF EXISTS "profiles_insert" ON profiles';
    EXECUTE 'DROP POLICY IF EXISTS "profiles_update" ON profiles';
    EXECUTE 'CREATE POLICY "profiles_select" ON profiles FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO anon, authenticated WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ─── Verify final state ────────────────────────────────────
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('p2p_orders','escrow_locks','p2p_chat','merchant_qr_codes','kyc_submissions','cards','vcc_cards','transactions','profiles')
ORDER BY tablename, cmd;
