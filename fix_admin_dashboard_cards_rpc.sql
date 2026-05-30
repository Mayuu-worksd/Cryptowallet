-- 1. RPC to fetch all Dashboard Analytics (Bypassing RLS securely)
CREATE OR REPLACE FUNCTION admin_get_dashboard_analytics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_users json;
  v_kyc json;
  v_bkyc json;
  v_txs json;
  v_p2p json;
  v_cards json;
BEGIN
  SELECT json_agg(w) INTO v_users FROM wallet_profiles w;
  SELECT json_agg(k) INTO v_kyc FROM kyc k;
  SELECT json_agg(b) INTO v_bkyc FROM business_kyc b;
  SELECT json_agg(t) INTO v_txs FROM (SELECT * FROM transactions ORDER BY created_at ASC) t;
  SELECT json_agg(p) INTO v_p2p FROM p2p_orders p;
  SELECT json_agg(c) INTO v_cards FROM (SELECT id, status FROM card_requests) c;

  RETURN json_build_object(
    'wallet_profiles', COALESCE(v_users, '[]'::json),
    'kyc', COALESCE(v_kyc, '[]'::json),
    'business_kyc', COALESCE(v_bkyc, '[]'::json),
    'transactions', COALESCE(v_txs, '[]'::json),
    'p2p_orders', COALESCE(v_p2p, '[]'::json),
    'card_requests', COALESCE(v_cards, '[]'::json)
  );
END;
$$;

-- 2. RPC to fetch all Card Requests for the Cards Page
CREATE OR REPLACE FUNCTION admin_get_card_requests()
RETURNS SETOF card_requests
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM card_requests ORDER BY created_at DESC;
$$;

-- Add missing updated_at column if it doesn't exist
ALTER TABLE card_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 3. RPC to update a Card Request status (Approve/Reject)
CREATE OR REPLACE FUNCTION admin_update_card_request(p_id uuid, p_status text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE card_requests SET status = p_status, updated_at = now() WHERE id = p_id;
$$;

-- 4. RPC to get basic KYC status counts for the KYC Page Widgets
CREATE OR REPLACE FUNCTION admin_get_kyc_stats()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT json_agg(json_build_object('status', status)) FROM kyc;
$$;
