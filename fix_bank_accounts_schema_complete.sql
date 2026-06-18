-- Update admin_bank_accounts table to include all required fields

-- Add missing columns if they don't exist
ALTER TABLE admin_bank_accounts 
ADD COLUMN IF NOT EXISTS iban text,
ADD COLUMN IF NOT EXISTS swift_code text,
ADD COLUMN IF NOT EXISTS deposit_instructions text;

-- Create updated complete table (run this if starting fresh)
CREATE TABLE IF NOT EXISTS admin_bank_accounts_complete (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  beneficiary_name text NOT NULL,
  bank_name text NOT NULL,
  routing_number text NOT NULL,
  account_number text NOT NULL,
  account_type text NOT NULL, -- e.g. 'Checking', 'Savings', 'Corporate'
  currency text NOT NULL, -- e.g. 'USD', 'EUR', 'AED', 'GBP', 'INR', 'SGD'
  iban text, -- International Bank Account Number
  swift_code text, -- SWIFT/BIC code
  deposit_instructions text, -- Instructions shown to depositors
  is_active boolean DEFAULT true
);

-- Enable RLS on the complete table
ALTER TABLE admin_bank_accounts_complete ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users (so end-users can view active banks to deposit into)
CREATE POLICY "Allow read access to all authenticated users on complete"
ON admin_bank_accounts_complete FOR SELECT
TO authenticated
USING (true);

-- Allow full access to admins
CREATE POLICY "Allow full access to admins on complete"
ON admin_bank_accounts_complete FOR ALL
TO authenticated
USING (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'email' = 'admin@admin.com')
WITH CHECK (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'email' = 'admin@admin.com');

-- Insert some sample USD bank accounts to fix the "No bank accounts configured for USD" error
INSERT INTO admin_bank_accounts (
  beneficiary_name, 
  bank_name, 
  routing_number, 
  account_number, 
  account_type, 
  currency,
  iban,
  swift_code,
  deposit_instructions,
  is_active
) VALUES 
-- Sample USD Bank Account
(
  'CryptoWallet Inc.', 
  'JPMorgan Chase Bank', 
  '021000021', 
  '1234567890123', 
  'Corporate', 
  'USD',
  NULL,
  'CHASUS33XXX',
  'Please include your wallet address in the transfer memo to ensure proper credit.',
  true
),
-- Sample AED Bank Account  
(
  'CryptoWallet DMCC', 
  'Emirates NBD Bank', 
  '033001', 
  '1027654321987', 
  'Corporate', 
  'AED',
  'AE070331234567890123456',
  'EBILAEAD',
  'Please include your phone number in the transfer memo for verification.',
  true
),
-- Sample EUR Bank Account
(
  'CryptoWallet Europe Ltd', 
  'Deutsche Bank AG', 
  '70070010', 
  '9876543210456', 
  'Corporate', 
  'EUR',
  'DE89370400440532013000',
  'DEUTDEFF',
  'Ensure your registered email is included in transfer details.',
  true
)
ON CONFLICT (id) DO NOTHING;