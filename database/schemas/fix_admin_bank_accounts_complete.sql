-- Updated RPC functions for bank accounts with all required fields

-- RPC to fetch all bank accounts
CREATE OR REPLACE FUNCTION admin_get_bank_accounts()
RETURNS SETOF admin_bank_accounts
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM admin_bank_accounts ORDER BY created_at DESC;
$$;

-- RPC to insert a new bank account with all fields
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
  )
  VALUES (
    p_beneficiary_name, 
    p_bank_name, 
    p_routing_number, 
    p_account_number, 
    p_account_type, 
    p_currency, 
    p_iban,
    p_swift_code,
    p_deposit_instructions,
    true
  );
$$;

-- RPC to update a bank account with all fields
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

-- RPC to toggle active status
CREATE OR REPLACE FUNCTION admin_toggle_bank_account(p_id uuid, p_is_active boolean)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE admin_bank_accounts SET is_active = p_is_active, updated_at = now() WHERE id = p_id;
$$;

-- RPC to delete a bank account
CREATE OR REPLACE FUNCTION admin_delete_bank_account(p_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM admin_bank_accounts WHERE id = p_id;
$$;

-- Function to get bank accounts for specific currency (fixes the fiat deposit error)
CREATE OR REPLACE FUNCTION get_bank_accounts_by_currency(p_currency text)
RETURNS SETOF admin_bank_accounts
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM admin_bank_accounts 
  WHERE currency = p_currency AND is_active = true 
  ORDER BY created_at DESC;
$$;