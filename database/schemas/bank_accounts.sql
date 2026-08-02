CREATE TABLE IF NOT EXISTS admin_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  beneficiary_name text NOT NULL,
  bank_name text NOT NULL,
  routing_number text NOT NULL,
  account_number text NOT NULL,
  account_type text NOT NULL, -- e.g. 'Checking', 'Savings'
  currency text NOT NULL, -- e.g. 'USD', 'EUR'
  is_active boolean DEFAULT true
);

-- Enable RLS
ALTER TABLE admin_bank_accounts ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users (so end-users can view active banks to deposit into)
CREATE POLICY "Allow read access to all authenticated users"
ON admin_bank_accounts FOR SELECT
TO authenticated
USING (true);

-- Allow full access to admins
CREATE POLICY "Allow full access to admins"
ON admin_bank_accounts FOR ALL
TO authenticated
USING (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'email' = 'admin@admin.com')
WITH CHECK (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'email' = 'admin@admin.com');
