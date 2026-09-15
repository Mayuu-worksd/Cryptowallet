-- =============================================================================
-- Device-Level Blocking RPCs
-- Run in Supabase Dashboard → SQL Editor → New Query → Run
-- =============================================================================

-- 1. Register or check device status atomically
CREATE OR REPLACE FUNCTION register_or_check_device(
  p_device_id TEXT,
  p_wallet    TEXT DEFAULT NULL,
  p_platform  TEXT DEFAULT 'unknown'
)
RETURNS TABLE (
  device_id           TEXT,
  last_wallet_address TEXT,
  is_blocked          BOOLEAN,
  block_reason        TEXT,
  platform            TEXT,
  created_at          TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_clean TEXT := NULL;
BEGIN
  IF p_wallet IS NOT NULL AND trim(p_wallet) != '' THEN
    v_wallet_clean := lower(trim(p_wallet));
  END IF;

  INSERT INTO registered_devices (
    device_id,
    last_wallet_address,
    platform,
    updated_at
  )
  VALUES (
    trim(p_device_id),
    v_wallet_clean,
    p_platform,
    NOW()
  )
  ON CONFLICT (device_id) DO UPDATE
  SET
    last_wallet_address = COALESCE(v_wallet_clean, registered_devices.last_wallet_address),
    platform            = CASE WHEN p_platform != 'unknown' THEN p_platform ELSE registered_devices.platform END,
    updated_at          = NOW();

  RETURN QUERY
  SELECT
    d.device_id,
    d.last_wallet_address,
    d.is_blocked,
    d.block_reason,
    d.platform,
    d.created_at,
    d.updated_at
  FROM registered_devices d
  WHERE d.device_id = trim(p_device_id);
END;
$$;

-- 2. Admin toggle device block status
CREATE OR REPLACE FUNCTION admin_toggle_device_block(
  p_device_id TEXT,
  p_block     BOOLEAN,
  p_reason    TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE registered_devices
  SET
    is_blocked   = p_block,
    block_reason = CASE WHEN p_block THEN COALESCE(p_reason, 'Device blocked by administrator') ELSE NULL END,
    updated_at   = NOW()
  WHERE device_id = trim(p_device_id);

  IF NOT FOUND THEN
    -- If device wasn't registered yet, create it in blocked state
    INSERT INTO registered_devices (
      device_id,
      is_blocked,
      block_reason
    )
    VALUES (
      trim(p_device_id),
      p_block,
      CASE WHEN p_block THEN COALESCE(p_reason, 'Device blocked by administrator') ELSE NULL END
    );
  END IF;
END;
$$;

-- 3. Fetch all registered devices for Admin Dashboard
CREATE OR REPLACE FUNCTION admin_get_all_devices()
RETURNS TABLE (
  device_id           TEXT,
  last_wallet_address TEXT,
  is_blocked          BOOLEAN,
  block_reason        TEXT,
  platform            TEXT,
  created_at          TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.device_id,
    d.last_wallet_address,
    d.is_blocked,
    d.block_reason,
    d.platform,
    d.created_at,
    d.updated_at
  FROM registered_devices d
  ORDER BY d.updated_at DESC;
END;
$$;
