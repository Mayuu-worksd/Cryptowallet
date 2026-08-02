-- ============================================================
-- EMERGENCY FIX FOR wallet_profiles ROW-LEVEL SECURITY POLICY
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- 1. Enable Row Level Security (just to be sure)
ALTER TABLE wallet_profiles ENABLE ROW LEVEL SECURITY;

-- 2. Grant permissions to postgrest roles
GRANT ALL ON wallet_profiles TO anon, authenticated, service_role;

-- 3. Drop all conflicting policies
DROP POLICY IF EXISTS "profile_own" ON wallet_profiles;
DROP POLICY IF EXISTS "wallet_profiles_select" ON wallet_profiles;
DROP POLICY IF EXISTS "wallet_profiles_insert" ON wallet_profiles;
DROP POLICY IF EXISTS "wallet_profiles_update" ON wallet_profiles;
DROP POLICY IF EXISTS "wallet_profiles_delete" ON wallet_profiles;

-- 4. Create fully open access policies for anon & authenticated roles
CREATE POLICY "wallet_profiles_select" ON wallet_profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "wallet_profiles_insert" ON wallet_profiles FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "wallet_profiles_update" ON wallet_profiles FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "wallet_profiles_delete" ON wallet_profiles FOR DELETE TO anon, authenticated USING (true);

-- 5. Verify policies were created
SELECT *
FROM pg_policies
WHERE tablename = 'wallet_profiles';
