-- =============================================================================
-- ADD: get_kyc_status RPC — reads KYC in same transaction as set_wallet
-- Run in: https://supabase.com/dashboard/project/hxmacphgbpedazdvgdnz/sql/new
-- =============================================================================

-- Fix set_wallet to use session scope
CREATE OR REPLACE FUNCTION set_wallet(wallet TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS
'BEGIN PERFORM set_config(''app.wallet'', lower(wallet), false); END';

CREATE OR REPLACE FUNCTION current_wallet()
RETURNS TEXT LANGUAGE sql STABLE AS
'SELECT COALESCE(NULLIF(current_setting(''app.wallet'', true), ''''), '''')';

-- Single RPC: set wallet context + read KYC record atomically
CREATE OR REPLACE FUNCTION get_kyc_status(p_wallet TEXT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_record RECORD;
BEGIN
  PERFORM set_config('app.wallet', lower(p_wallet), false);
  SELECT * INTO v_record FROM kyc WHERE wallet_address = lower(p_wallet);
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN row_to_json(v_record);
END;
$$;

-- upsert_kyc — NEVER resets verified/under_review, NEVER wipes document_url
CREATE OR REPLACE FUNCTION upsert_kyc(
  p_wallet        TEXT,
  p_full_name     TEXT,
  p_email         TEXT,
  p_phone         TEXT,
  p_address       TEXT,
  p_nationality   TEXT,
  p_dob           TEXT,
  p_document_type TEXT
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_existing RECORD;
  v_result   RECORD;
BEGIN
  PERFORM set_config('app.wallet', lower(p_wallet), false);
  SELECT * INTO v_existing FROM kyc WHERE wallet_address = lower(p_wallet);

  IF FOUND THEN
    IF v_existing.status IN ('verified', 'under_review') THEN
      RAISE EXCEPTION 'ALREADY_SUBMITTED:%', v_existing.status;
    END IF;
    IF v_existing.status = 'pending' AND v_existing.document_url IS NOT NULL THEN
      RAISE EXCEPTION 'ALREADY_SUBMITTED:pending';
    END IF;
    -- Update personal details only — never touch status/document_url/selfie_url
    UPDATE kyc SET
      full_name     = p_full_name,
      email         = p_email,
      phone         = p_phone,
      address       = p_address,
      nationality   = p_nationality,
      dob           = p_dob,
      document_type = p_document_type,
      updated_at    = NOW()
    WHERE wallet_address = lower(p_wallet)
    RETURNING * INTO v_result;
  ELSE
    INSERT INTO kyc (
      wallet_address, full_name, email, phone, address,
      nationality, dob, document_type, status, document_url, selfie_url
    ) VALUES (
      lower(p_wallet), p_full_name, p_email, p_phone, p_address,
      p_nationality, p_dob, p_document_type, 'pending', null, null
    )
    RETURNING * INTO v_result;
  END IF;

  RETURN row_to_json(v_result);
END;
$$;

-- finalize_kyc — only updates if still pending
CREATE OR REPLACE FUNCTION finalize_kyc(
  p_wallet        TEXT,
  p_document_url  TEXT,
  p_selfie_url    TEXT
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM set_config('app.wallet', lower(p_wallet), false);
  UPDATE kyc SET
    document_url = p_document_url,
    selfie_url   = p_selfie_url,
    status       = 'under_review',
    updated_at   = NOW()
  WHERE wallet_address = lower(p_wallet)
    AND status = 'pending';
END;
$$;
