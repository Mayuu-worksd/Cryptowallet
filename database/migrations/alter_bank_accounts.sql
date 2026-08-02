-- =============================================================================
-- Migration: Alter Admin Bank Accounts Table & RPCs
-- =============================================================================

-- 1. Add new columns
ALTER TABLE admin_bank_accounts ADD COLUMN IF NOT EXISTS iban TEXT;
ALTER TABLE admin_bank_accounts ADD COLUMN IF NOT EXISTS swift_code TEXT;
ALTER TABLE admin_bank_accounts ADD COLUMN IF NOT EXISTS deposit_instructions TEXT;

-- 2. Update SELECT policy to allow all roles (anon and authenticated)
DROP POLICY IF EXISTS "Allow read access to all authenticated users" ON admin_bank_accounts;
DROP POLICY IF EXISTS "Allow read access to all users" ON admin_bank_accounts;

CREATE POLICY "Allow read access to all users"
ON admin_bank_accounts FOR SELECT
TO public
USING (true);

-- 3. Update RPC to insert a new bank account
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

-- 4. Update RPC to update an existing bank account
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
  SET beneficiary_name = p_beneficiary_name, 
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
