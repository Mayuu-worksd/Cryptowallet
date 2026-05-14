-- =============================================================================
-- Business KYC RPCs — Run in Supabase SQL Editor
-- https://supabase.com/dashboard/project/hxmacphgbpedazdvgdnz/sql/new
-- Safe to re-run (CREATE OR REPLACE)
-- =============================================================================

-- ─── 1. Ensure table has all required columns ─────────────────────────────────
ALTER TABLE business_kyc ADD COLUMN IF NOT EXISTS director_name         TEXT;
ALTER TABLE business_kyc ADD COLUMN IF NOT EXISTS director_nationality   TEXT;
ALTER TABLE business_kyc ADD COLUMN IF NOT EXISTS director_id_url        TEXT;
ALTER TABLE business_kyc ADD COLUMN IF NOT EXISTS vat_tax_id             TEXT;
ALTER TABLE business_kyc ADD COLUMN IF NOT EXISTS document_url           TEXT;
ALTER TABLE business_kyc ADD COLUMN IF NOT EXISTS admin_notes            TEXT;
ALTER TABLE business_kyc ADD COLUMN IF NOT EXISTS updated_at             TIMESTAMPTZ DEFAULT NOW();

-- ─── 2. updated_at trigger ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS business_kyc_updated_at ON business_kyc;
CREATE TRIGGER business_kyc_updated_at
  BEFORE UPDATE ON business_kyc
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 3. get_business_kyc_status ───────────────────────────────────────────────
-- Atomically sets wallet context + reads the record in one call.
-- This is what businessKYCService.getStatus() calls.
CREATE OR REPLACE FUNCTION get_business_kyc_status(p_wallet TEXT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_record RECORD;
BEGIN
  PERFORM set_config('app.wallet', lower(p_wallet), false);
  SELECT * INTO v_record FROM business_kyc WHERE wallet_address = lower(p_wallet);
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN row_to_json(v_record);
END;
$$;

-- ─── 4. upsert_business_kyc ───────────────────────────────────────────────────
-- Called by BusinessKYCFormScreen on submit.
-- - New user  → inserts with status = 'pending'
-- - Rejected  → allows re-submission (resets to pending, clears old doc)
-- - pending / under_review / approved → raises ALREADY_SUBMITTED so the app
--   redirects to the result screen instead of overwriting data.
CREATE OR REPLACE FUNCTION upsert_business_kyc(
  p_wallet               TEXT,
  p_business_name        TEXT,
  p_business_type        TEXT,
  p_registration_number  TEXT,
  p_vat_tax_id           TEXT DEFAULT '',
  p_business_address     TEXT DEFAULT '',
  p_country              TEXT DEFAULT '',
  p_director_name        TEXT DEFAULT '',
  p_director_nationality TEXT DEFAULT ''
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_existing RECORD;
  v_result   RECORD;
BEGIN
  PERFORM set_config('app.wallet', lower(p_wallet), false);
  SELECT * INTO v_existing FROM business_kyc WHERE wallet_address = lower(p_wallet);

  IF FOUND THEN
    -- Block re-submission for active/approved records
    IF v_existing.status IN ('pending', 'under_review', 'approved') THEN
      RAISE EXCEPTION 'ALREADY_SUBMITTED:%', v_existing.status;
    END IF;

    -- Rejected → allow re-submission: reset status + clear old document
    UPDATE business_kyc SET
      business_name        = p_business_name,
      business_type        = p_business_type,
      registration_number  = p_registration_number,
      vat_tax_id           = NULLIF(p_vat_tax_id, ''),
      business_address     = p_business_address,
      country              = p_country,
      director_name        = NULLIF(p_director_name, ''),
      director_nationality = NULLIF(p_director_nationality, ''),
      document_url         = NULL,
      status               = 'pending',
      admin_notes          = NULL,
      updated_at           = NOW()
    WHERE wallet_address = lower(p_wallet)
    RETURNING * INTO v_result;
  ELSE
    -- New user → fresh insert
    INSERT INTO business_kyc (
      wallet_address, business_name, business_type, registration_number,
      vat_tax_id, business_address, country,
      director_name, director_nationality,
      document_url, status
    ) VALUES (
      lower(p_wallet), p_business_name, p_business_type, p_registration_number,
      NULLIF(p_vat_tax_id, ''), p_business_address, p_country,
      NULLIF(p_director_name, ''), NULLIF(p_director_nationality, ''),
      NULL, 'pending'
    )
    RETURNING * INTO v_result;
  END IF;

  RETURN row_to_json(v_result);
END;
$$;

-- ─── 5. finalize_business_kyc ─────────────────────────────────────────────────
-- Called after document upload. Saves the document URL and moves status
-- to 'under_review'. Only works if status is still 'pending' — prevents
-- accidental overwrites on approved/rejected records.
CREATE OR REPLACE FUNCTION finalize_business_kyc(
  p_wallet       TEXT,
  p_document_url TEXT
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM set_config('app.wallet', lower(p_wallet), false);

  UPDATE business_kyc SET
    document_url = p_document_url,
    status       = 'under_review',
    updated_at   = NOW()
  WHERE wallet_address = lower(p_wallet)
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pending business KYC record found for wallet: %', p_wallet;
  END IF;
END;
$$;

-- ─── 6. admin_update_business_kyc ────────────────────────────────────────────
-- Admin-only RPC (SECURITY DEFINER bypasses RLS).
-- Allows admin to approve/reject business KYC from the admin panel.
CREATE OR REPLACE FUNCTION admin_update_business_kyc(
  p_wallet TEXT,
  p_status TEXT,
  p_notes  TEXT DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_status NOT IN ('approved', 'rejected', 'under_review', 'pending') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  UPDATE business_kyc SET
    status      = p_status,
    admin_notes = COALESCE(p_notes, admin_notes),
    updated_at  = NOW()
  WHERE wallet_address = lower(p_wallet);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business KYC record not found for wallet: %', p_wallet;
  END IF;
END;
$$;

-- ─── 7. RLS policies for business_kyc ────────────────────────────────────────
ALTER TABLE business_kyc ENABLE ROW LEVEL SECURITY;

-- Drop old open policies if they exist
DROP POLICY IF EXISTS "allow all"        ON business_kyc;
DROP POLICY IF EXISTS "bkyc_select_own"  ON business_kyc;
DROP POLICY IF EXISTS "bkyc_insert_own"  ON business_kyc;
DROP POLICY IF EXISTS "bkyc_update_own"  ON business_kyc;

-- Own record only
CREATE POLICY "bkyc_select_own" ON business_kyc
  FOR SELECT TO anon
  USING (wallet_address = current_wallet());

CREATE POLICY "bkyc_insert_own" ON business_kyc
  FOR INSERT TO anon
  WITH CHECK (wallet_address = current_wallet());

CREATE POLICY "bkyc_update_own" ON business_kyc
  FOR UPDATE TO anon
  USING (wallet_address = current_wallet() AND status IN ('pending', 'rejected'))
  WITH CHECK (wallet_address = current_wallet() AND status != 'approved');

-- ─── 8. Storage policy for business KYC docs ─────────────────────────────────
-- Business docs go into kyc-docs bucket under business_kyc/<addr>/
DROP POLICY IF EXISTS "bkyc_docs_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "bkyc_docs_select_own" ON storage.objects;

CREATE POLICY "bkyc_docs_insert_own" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'kyc-docs'
    AND (storage.foldername(name))[1] = 'business_kyc'
    AND (storage.foldername(name))[2] = replace(current_wallet(), '0x', '')
  );

CREATE POLICY "bkyc_docs_select_own" ON storage.objects
  FOR SELECT TO anon
  USING (
    bucket_id = 'kyc-docs'
    AND (storage.foldername(name))[1] IN ('kyc', 'business_kyc')
    AND (storage.foldername(name))[2] = replace(current_wallet(), '0x', '')
  );
