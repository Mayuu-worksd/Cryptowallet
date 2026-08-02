CREATE TABLE IF NOT EXISTS admin_networks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  network_name text NOT NULL,
  rpc_url text NOT NULL,
  chain_id text NOT NULL,
  explorer_url text,
  symbol text NOT NULL,
  is_mainnet boolean DEFAULT true,
  is_active boolean DEFAULT true
);

-- Enable RLS
ALTER TABLE admin_networks ENABLE ROW LEVEL SECURITY;

-- Create policies for admin_networks
CREATE POLICY "Enable read access for all authenticated users"
  ON admin_networks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable all access for admins"
  ON admin_networks FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'email' = 'admin@admin.com')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'email' = 'admin@admin.com');

-- Create a trigger for updated_at
CREATE OR REPLACE FUNCTION update_admin_networks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_admin_networks_updated_at_trigger
BEFORE UPDATE ON admin_networks
FOR EACH ROW
EXECUTE FUNCTION update_admin_networks_updated_at();
