-- =============================================================================
-- Migration: Fiat-Crypto Request Management & Ledger System
-- Run in: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- =============================================================================

-- 1. Create Sequences for ticket numbers
CREATE SEQUENCE IF NOT EXISTS fiat_deposit_ticket_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS fiat_withdrawal_ticket_seq START WITH 1;

-- 2. Create Fiat ↔ Crypto Requests Table
CREATE TABLE IF NOT EXISTS fiat_crypto_requests (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id           TEXT          UNIQUE,
  wallet_address      TEXT          NOT NULL REFERENCES wallet_profiles(wallet_address),
  user_uuid           UUID          NOT NULL REFERENCES wallet_profiles(user_uuid),
  type                TEXT          NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  fiat_currency       TEXT          NOT NULL,
  crypto_asset        TEXT          NOT NULL,
  amount              NUMERIC(24,8) NOT NULL, -- Deposit: fiat amount, Withdrawal: crypto amount
  crypto_amount       NUMERIC(24,8),          -- Specified by admin upon approval/settlement
  payment_proof_url   TEXT,                   -- Storage path/url for deposit proofs
  bank_details        JSONB,                  -- Bank payout data for withdrawals
  status              TEXT          NOT NULL DEFAULT 'pending' 
                        CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'completed')),
  admin_notes         TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexing for speed
CREATE INDEX IF NOT EXISTS idx_fiat_requests_wallet ON fiat_crypto_requests(wallet_address);
CREATE INDEX IF NOT EXISTS idx_fiat_requests_status ON fiat_crypto_requests(status);
CREATE INDEX IF NOT EXISTS idx_fiat_requests_ticket ON fiat_crypto_requests(ticket_id);

-- 3. Trigger to Auto-Generate formatted Ticket IDs (DEP-000001 / WDR-000001)
CREATE OR REPLACE FUNCTION generate_fiat_request_ticket_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_id IS NULL OR NEW.ticket_id = '' THEN
    IF NEW.type = 'deposit' THEN
      NEW.ticket_id := 'DEP-' || lpad(nextval('fiat_deposit_ticket_seq')::text, 6, '0');
    ELSIF NEW.type = 'withdrawal' THEN
      NEW.ticket_id := 'WDR-' || lpad(nextval('fiat_withdrawal_ticket_seq')::text, 6, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fiat_request_ticket_id ON fiat_crypto_requests;
CREATE TRIGGER trg_fiat_request_ticket_id
  BEFORE INSERT ON fiat_crypto_requests
  FOR EACH ROW
  EXECUTE FUNCTION generate_fiat_request_ticket_id();

-- 4. Create Ledger Entries Table
CREATE TABLE IF NOT EXISTS ledger_entries (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uuid       UUID          NOT NULL REFERENCES wallet_profiles(user_uuid),
  wallet_address  TEXT          NOT NULL REFERENCES wallet_profiles(wallet_address),
  transaction_id  UUID,         -- References transactions(id) if applicable
  ticket_id       TEXT          NOT NULL,
  credit_entry    NUMERIC(24,8) NOT NULL DEFAULT 0,
  debit_entry     NUMERIC(24,8) NOT NULL DEFAULT 0,
  asset           TEXT          NOT NULL, -- asset code (USD, ETH, USDT)
  status          TEXT          NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_wallet ON ledger_entries(wallet_address);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_ticket ON ledger_entries(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_created ON ledger_entries(created_at DESC);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE fiat_crypto_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

-- 6. User Policies (Standard anonymous clients matching app.wallet)
DROP POLICY IF EXISTS "fiat_requests_select" ON fiat_crypto_requests;
CREATE POLICY "fiat_requests_select" ON fiat_crypto_requests
  FOR SELECT TO anon
  USING (wallet_address = current_wallet());

DROP POLICY IF EXISTS "fiat_requests_insert" ON fiat_crypto_requests;
CREATE POLICY "fiat_requests_insert" ON fiat_crypto_requests
  FOR INSERT TO anon
  WITH CHECK (wallet_address = current_wallet());

DROP POLICY IF EXISTS "ledger_entries_select" ON ledger_entries;
CREATE POLICY "ledger_entries_select" ON ledger_entries
  FOR SELECT TO anon
  USING (wallet_address = current_wallet());

-- 7. Balance adjustments helper
CREATE OR REPLACE FUNCTION adjust_wallet_token_balance(
  p_wallet_address TEXT,
  p_asset TEXT,
  p_amount NUMERIC
)
RETURNS JSONB AS $$
DECLARE
  v_balances JSONB;
  v_current NUMERIC;
  v_new NUMERIC;
BEGIN
  SELECT token_balances INTO v_balances
  FROM wallet_profiles
  WHERE wallet_address = lower(p_wallet_address);
  
  IF v_balances IS NULL THEN
    v_balances := '{}'::jsonb;
  END IF;
  
  v_current := COALESCE((v_balances->>p_asset)::numeric, 0);
  v_new := v_current + p_amount;
  
  IF v_new < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Attempted to deduct %, current balance is %', ABS(p_amount), v_current;
  END IF;
  
  v_balances := jsonb_set(v_balances, ARRAY[p_asset], to_jsonb(v_new));
  
  UPDATE wallet_profiles
  SET token_balances = v_balances,
      updated_at = now()
  WHERE wallet_address = lower(p_wallet_address);
  
  RETURN v_balances;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. User RPC: Submit a Crypto → Fiat withdrawal request (validates and debits)
CREATE OR REPLACE FUNCTION submit_fiat_withdrawal(
  p_wallet_address TEXT,
  p_crypto_asset TEXT,
  p_fiat_currency TEXT,
  p_amount NUMERIC,
  p_bank_details JSONB
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_uuid UUID;
  v_profile RECORD;
  v_request RECORD;
  v_tx_id UUID;
BEGIN
  -- Look up wallet profile
  SELECT user_uuid, token_balances INTO v_profile FROM wallet_profiles WHERE wallet_address = lower(p_wallet_address);
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'WALLET_PROFILE_NOT_FOUND: Wallet profile does not exist.';
  END IF;

  -- 1. Deduct balance immediately
  PERFORM adjust_wallet_token_balance(p_wallet_address, p_crypto_asset, -p_amount);

  -- 2. Create transaction record
  INSERT INTO transactions (wallet_address, user_uuid, type, token, amount, usd_value, status, description, label)
  VALUES (
    lower(p_wallet_address),
    v_profile.user_uuid,
    'send',
    p_crypto_asset,
    p_amount,
    0.0, -- USD value calculated later or custom
    'pending',
    'Fiat Withdrawal Processing',
    'Crypto to Fiat Withdrawal'
  )
  RETURNING id INTO v_tx_id;

  -- 3. Insert Withdrawal Request
  INSERT INTO fiat_crypto_requests (
    wallet_address, user_uuid, type, fiat_currency, crypto_asset, amount, bank_details, status
  )
  VALUES (
    lower(p_wallet_address),
    v_profile.user_uuid,
    'withdrawal',
    p_fiat_currency,
    p_crypto_asset,
    p_amount,
    p_bank_details,
    'pending'
  )
  RETURNING * INTO v_request;

  -- 4. Log pending ledger debit entry
  INSERT INTO ledger_entries (user_uuid, wallet_address, transaction_id, ticket_id, credit_entry, debit_entry, asset, status)
  VALUES (
    v_profile.user_uuid,
    lower(p_wallet_address),
    v_tx_id,
    v_request.ticket_id,
    0,
    p_amount,
    p_crypto_asset,
    'pending'
  );

  RETURN json_build_object(
    'success', true,
    'ticket_id', v_request.ticket_id,
    'request_id', v_request.id,
    'transaction_id', v_tx_id
  );
END;
$$;

-- 9. Admin RPC: Retrieve all requests
CREATE OR REPLACE FUNCTION admin_get_fiat_requests()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_agg(t) INTO v_result
  FROM (
    SELECT r.*, w.wallet_name, w.user_uid
    FROM fiat_crypto_requests r
    JOIN wallet_profiles w ON r.wallet_address = w.wallet_address
    ORDER BY r.created_at DESC
  ) t;
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- 10. Admin RPC: Process / Action a Request
CREATE OR REPLACE FUNCTION admin_process_fiat_request(
  p_request_id UUID,
  p_action TEXT, -- 'under_review', 'approve', 'reject', 'complete'
  p_crypto_amount NUMERIC DEFAULT NULL, -- mandatory for deposit approvals
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_req RECORD;
  v_tx_id UUID;
  v_user_uuid UUID;
  v_wallet TEXT;
BEGIN
  -- Fetch the request
  SELECT * INTO v_req FROM fiat_crypto_requests WHERE id = p_request_id;
  IF v_req IS NULL THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND';
  END IF;

  v_user_uuid := v_req.user_uuid;
  v_wallet := v_req.wallet_address;

  -- A. UNDER REVIEW Action
  IF p_action = 'under_review' THEN
    UPDATE fiat_crypto_requests
    SET status = 'under_review',
        admin_notes = COALESCE(p_admin_notes, admin_notes),
        updated_at = now()
    WHERE id = p_request_id;

  -- B. REJECT Action
  ELSIF p_action = 'reject' THEN
    -- If it's a withdrawal, refund the crypto balance back to the user
    IF v_req.type = 'withdrawal' THEN
      PERFORM adjust_wallet_token_balance(v_wallet, v_req.crypto_asset, v_req.amount);
      
      -- Update associated pending transaction status to failed
      UPDATE transactions
      SET status = 'failed',
          description = 'Withdrawal request rejected by admin'
      WHERE id = (
        SELECT id 
        FROM transactions 
        WHERE wallet_address = v_wallet AND type = 'send' AND status = 'pending' AND created_at >= v_req.created_at - interval '10 seconds'
        LIMIT 1
      );
      
      -- Mark pending ledger entry as failed
      UPDATE ledger_entries
      SET status = 'failed'
      WHERE ticket_id = v_req.ticket_id;
    END IF;

    UPDATE fiat_crypto_requests
    SET status = 'rejected',
        admin_notes = COALESCE(p_admin_notes, admin_notes),
        updated_at = now()
    WHERE id = p_request_id;

  -- C. APPROVE Action
  ELSIF p_action = 'approve' THEN
    IF v_req.type = 'deposit' THEN
      IF p_crypto_amount IS NULL OR p_crypto_amount <= 0 THEN
        RAISE EXCEPTION 'INVALID_CRYPTO_AMOUNT: Approving a deposit requires p_crypto_amount.';
      END IF;

      -- 1. Credit the user balance database-side
      PERFORM adjust_wallet_token_balance(v_wallet, v_req.crypto_asset, p_crypto_amount);

      -- 2. Insert transaction history
      INSERT INTO transactions (wallet_address, user_uuid, type, token, amount, usd_value, status, description, label)
      VALUES (
        v_wallet,
        v_user_uuid,
        'receive',
        v_req.crypto_asset,
        p_crypto_amount,
        0.0,
        'success',
        'Deposit settled via admin',
        'Fiat to Crypto Deposit'
      )
      RETURNING id INTO v_tx_id;

      -- 3. Log ledger credit entry
      INSERT INTO ledger_entries (user_uuid, wallet_address, transaction_id, ticket_id, credit_entry, debit_entry, asset, status)
      VALUES (
        v_user_uuid,
        v_wallet,
        v_tx_id,
        v_req.ticket_id,
        p_crypto_amount,
        0,
        v_req.crypto_asset,
        'completed'
      );

      -- 4. Update request status to completed
      UPDATE fiat_crypto_requests
      SET status = 'completed',
          crypto_amount = p_crypto_amount,
          admin_notes = COALESCE(p_admin_notes, admin_notes),
          updated_at = now()
      WHERE id = p_request_id;

    ELSIF v_req.type = 'withdrawal' THEN
      -- Mark withdrawal request approved (pending payout/manual settlement completion)
      UPDATE fiat_crypto_requests
      SET status = 'approved',
          admin_notes = COALESCE(p_admin_notes, admin_notes),
          updated_at = now()
      WHERE id = p_request_id;
    END IF;

  -- D. COMPLETE Action (for manual withdrawal payout confirmation)
  ELSIF p_action = 'complete' THEN
    IF v_req.type = 'withdrawal' THEN
      -- 1. Confirm transaction status to success
      UPDATE transactions
      SET status = 'success',
          description = 'Withdrawal processed and settled'
      WHERE id = (
        SELECT id 
        FROM transactions 
        WHERE wallet_address = v_wallet AND type = 'send' AND status = 'pending' AND created_at >= v_req.created_at - interval '10 seconds'
        LIMIT 1
      );
      
      -- 2. Confirm ledger entry to completed
      UPDATE ledger_entries
      SET status = 'completed'
      WHERE ticket_id = v_req.ticket_id;

      -- 3. Set request status to completed
      UPDATE fiat_crypto_requests
      SET status = 'completed',
          admin_notes = COALESCE(p_admin_notes, admin_notes),
          updated_at = now()
      WHERE id = p_request_id;
    END IF;
  END IF;

  -- Returns updated requests list
  RETURN admin_get_fiat_requests();
END;
--
$$;

DROP TRIGGER IF EXISTS trg_populate_fiat_requests_uuid ON fiat_crypto_requests;
CREATE TRIGGER trg_populate_fiat_requests_uuid 
  BEFORE INSERT OR UPDATE OF wallet_address ON fiat_crypto_requests 
  FOR EACH ROW 
  EXECUTE FUNCTION populate_user_uuid_from_wallet();

-- 11. Storage bucket for payment proofs

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "anon_all_payment_proofs" ON storage.objects;
CREATE POLICY "anon_all_payment_proofs"
ON storage.objects FOR ALL TO anon
USING (bucket_id = 'payment-proofs')
WITH CHECK (bucket_id = 'payment-proofs');

