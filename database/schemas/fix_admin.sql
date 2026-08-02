-- =============================================================================
-- ADMIN FIX: admin_update_kyc RPC — bypasses RLS for admin approval/rejection
-- Run in: https://supabase.com/dashboard/project/hxmacphgbpedazdvgdnz/sql/new
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_update_kyc(
  p_wallet  TEXT,
  p_status  TEXT,
  p_notes   TEXT DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- SECURITY DEFINER runs as the DB owner, bypassing RLS
  -- Only allow valid status transitions
  IF p_status NOT IN ('verified', 'rejected', 'under_review', 'pending') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  UPDATE kyc
  SET
    status      = p_status,
    admin_notes = COALESCE(p_notes, admin_notes),
    updated_at  = NOW()
  WHERE wallet_address = lower(p_wallet);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'KYC record not found for wallet: %', p_wallet;
  END IF;
END;
$$;

-- Also fix admin stats/list queries — they need SECURITY DEFINER too
-- so admin can read all KYC records regardless of RLS
CREATE OR REPLACE FUNCTION admin_get_all_kyc(p_status TEXT DEFAULT NULL)
RETURNS SETOF kyc LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_status IS NULL OR p_status = 'all' THEN
    RETURN QUERY SELECT * FROM kyc ORDER BY created_at DESC;
  ELSE
    RETURN QUERY SELECT * FROM kyc WHERE status = p_status ORDER BY created_at DESC;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION admin_get_kyc_stats()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    'total',        COUNT(*),
    'pending',      COUNT(*) FILTER (WHERE status = 'pending'),
    'under_review', COUNT(*) FILTER (WHERE status = 'under_review'),
    'verified',     COUNT(*) FILTER (WHERE status = 'verified'),
    'rejected',     COUNT(*) FILTER (WHERE status = 'rejected')
  ) INTO v_result FROM kyc;
  RETURN v_result;
END;
$$;
