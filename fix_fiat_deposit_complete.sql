-- Complete fix for "No bank accounts configured for USD" error
-- Run this script in your Supabase SQL Editor

-- 1. First, make sure the admin_bank_accounts table has all required columns
ALTER TABLE admin_bank_accounts 
ADD COLUMN IF NOT EXISTS iban text,
ADD COLUMN IF NOT EXISTS swift_code text,
ADD COLUMN IF NOT EXISTS deposit_instructions text;

-- 2. Update the RPC functions to handle all fields
CREATE OR REPLACE FUNCTION admin_get_bank_accounts()
RETURNS SETOF admin_bank_accounts
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM admin_bank_accounts ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION admin_insert_bank_account(
  p_beneficiary_name text, 
  p_bank_name text, 
  p_routing_number text, 
  p_account_number text, 
  p_account_type text, 
  p_currency text,
  p_iban text DEFAULT NULL,
  p_swift_code text DEFAULT NULL,
  p_deposit_instructions text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO admin_bank_accounts (
    beneficiary_name, bank_name, routing_number, account_number, 
    account_type, currency, iban, swift_code, deposit_instructions, is_active
  )
  VALUES (
    p_beneficiary_name, p_bank_name, p_routing_number, p_account_number, 
    p_account_type, p_currency, p_iban, p_swift_code, p_deposit_instructions, true
  );
$$;

CREATE OR REPLACE FUNCTION admin_update_bank_account(
  p_id uuid, 
  p_beneficiary_name text, 
  p_bank_name text, 
  p_routing_number text, 
  p_account_number text, 
  p_account_type text, 
  p_currency text,
  p_iban text DEFAULT NULL,
  p_swift_code text DEFAULT NULL,
  p_deposit_instructions text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE admin_bank_accounts 
  SET 
    beneficiary_name = p_beneficiary_name, 
    bank_name = p_bank_name, 
    routing_number = p_routing_number, 
    account_number = p_account_number, 
    account_type = p_account_type, 
    currency = p_currency,
    iban = p_iban,
    swift_code = p_swift_code,
    deposit_instructions = p_deposit_instructions,
    updated_at = now()
  WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION get_bank_accounts_by_currency(p_currency text)
RETURNS SETOF admin_bank_accounts
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM admin_bank_accounts 
  WHERE currency = p_currency AND is_active = true 
  ORDER BY created_at DESC;
$$;

-- 3. Insert sample bank accounts to fix the USD error
INSERT INTO admin_bank_accounts (
  beneficiary_name, bank_name, routing_number, account_number, 
  account_type, currency, iban, swift_code, deposit_instructions, is_active
) VALUES 
-- USD Account
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
-- AED Account  
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
-- EUR Account
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
),
-- GBP Account
(
  'CryptoWallet UK Ltd', 
  'Barclays Bank PLC', 
  '200000', 
  '55779911234567', 
  'Corporate', 
  'GBP',
  'GB33BUKB20201555555555',
  'BARCGB22',
  'Include your user ID from the app in payment reference.',
  true
),
-- INR Account
(
  'CryptoWallet India Pvt Ltd', 
  'State Bank of India', 
  '000011', 
  '1234567890', 
  'Corporate', 
  'INR',
  NULL,
  'SBININBB104',
  'UPI payments are also accepted. Include mobile number in remarks.',
  true
)
ON CONFLICT (id) DO NOTHING;

-- 4. Verify the setup
SELECT 
  currency, 
  COUNT(*) as account_count,
  STRING_AGG(bank_name, ', ') as banks
FROM admin_bank_accounts 
WHERE is_active = true
GROUP BY currency
ORDER BY currency;