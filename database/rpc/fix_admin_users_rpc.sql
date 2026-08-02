-- RPC to securely fetch all details for a specific user profile
CREATE OR REPLACE FUNCTION admin_get_user_details(p_wallet text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cards json;
  v_vcc json;
  v_txs json;
  v_kyc json;
  v_bkyc json;
BEGIN
  -- Aggregate standard cards
  SELECT json_agg(c) INTO v_cards FROM cards c WHERE lower(wallet_address) = lower(p_wallet);
  
  -- Aggregate virtual credit cards
  SELECT json_agg(v) INTO v_vcc FROM vcc_cards v WHERE lower(wallet_address) = lower(p_wallet);
  
  -- Aggregate transactions
  SELECT json_agg(t) INTO v_txs FROM (SELECT * FROM transactions WHERE lower(wallet_address) = lower(p_wallet) ORDER BY created_at DESC) t;
  
  -- Fetch personal KYC
  SELECT row_to_json(k) INTO v_kyc FROM kyc k WHERE lower(wallet_address) = lower(p_wallet) LIMIT 1;
  
  -- Fetch business KYC
  SELECT row_to_json(b) INTO v_bkyc FROM business_kyc b WHERE lower(wallet_address) = lower(p_wallet) LIMIT 1;

  -- Build and return single JSON object
  RETURN json_build_object(
    'cards', COALESCE(v_cards, '[]'::json),
    'vccCards', COALESCE(v_vcc, '[]'::json),
    'transactions', COALESCE(v_txs, '[]'::json),
    'kyc', v_kyc,
    'bkyc', v_bkyc
  );
END;
$$;
