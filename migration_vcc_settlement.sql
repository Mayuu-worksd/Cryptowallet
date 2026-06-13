-- migration_vcc_settlement.sql
-- Description: Replace VCC Top-Up Architecture with Direct Wallet Settlement

-- 1. Create a global settings table for dashboard-controlled configuration
CREATE TABLE IF NOT EXISTS admin_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone (or authenticated users) to read the settings so the app can fetch them
CREATE POLICY "Allow public read access to admin_settings" 
ON admin_settings FOR SELECT USING (true);

-- Allow only service_role (backend/admin) to insert or update.
-- Without explicit insert/update policies, anon/authenticated users are blocked by default.

-- 2. Insert default payment asset priority
INSERT INTO admin_settings (key, value)
VALUES ('payment_asset_priority', '["USDT", "BTC", "ETH", "BNB", "TRX"]'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Note: We are deliberately NOT removing the `balance` column from `vcc_cards` 
-- at this time to maintain backward compatibility with older app versions still in the wild.
-- The new app versions will simply ignore this column and deduct from the user's primary token balances.
