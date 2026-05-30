-- RPC to fetch all bank accounts
CREATE OR REPLACE FUNCTION admin_get_bank_accounts()
RETURNS SETOF admin_bank_accounts
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM admin_bank_accounts ORDER BY created_at DESC;
$$;

-- RPC to insert a new bank account
CREATE OR REPLACE FUNCTION admin_insert_bank_account(
  p_beneficiary_name text, 
  p_bank_name text, 
  p_routing_number text, 
  p_account_number text, 
  p_account_type text, 
  p_currency text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO admin_bank_accounts (beneficiary_name, bank_name, routing_number, account_number, account_type, currency, is_active)
  VALUES (p_beneficiary_name, p_bank_name, p_routing_number, p_account_number, p_account_type, p_currency, true);
$$;

-- RPC to update a bank account
CREATE OR REPLACE FUNCTION admin_update_bank_account(
  p_id uuid, 
  p_beneficiary_name text, 
  p_bank_name text, 
  p_routing_number text, 
  p_account_number text, 
  p_account_type text, 
  p_currency text
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
