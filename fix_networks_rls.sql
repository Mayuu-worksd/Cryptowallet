-- Forcefully drop existing policies if they exist to prevent "already exists" errors
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON admin_networks;
DROP POLICY IF EXISTS "Enable all access for admins" ON admin_networks;

-- Ensure RLS is enabled
ALTER TABLE admin_networks ENABLE ROW LEVEL SECURITY;

-- Re-create the secure read access for the mobile app
CREATE POLICY "Enable read access for all authenticated users"
  ON admin_networks FOR SELECT
  TO authenticated
  USING (true);

-- Re-create the full access policy for the Admin Dashboard (using the correct JWT check)
CREATE POLICY "Enable all access for admins"
  ON admin_networks FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'email' = 'admin@admin.com')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'email' = 'admin@admin.com');
