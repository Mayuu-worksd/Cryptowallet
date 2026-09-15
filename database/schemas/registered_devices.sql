-- =============================================================================
-- Registered Devices Schema — Device-Level Blocking
-- Run in Supabase SQL Editor
-- =============================================================================

CREATE TABLE IF NOT EXISTS registered_devices (
  device_id           TEXT PRIMARY KEY,
  last_wallet_address TEXT,
  is_blocked          BOOLEAN NOT NULL DEFAULT false,
  block_reason        TEXT,
  platform            TEXT DEFAULT 'unknown',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by wallet address association
CREATE INDEX IF NOT EXISTS idx_registered_devices_wallet ON registered_devices (last_wallet_address);
CREATE INDEX IF NOT EXISTS idx_registered_devices_blocked ON registered_devices (is_blocked);

-- Enable RLS
ALTER TABLE registered_devices ENABLE ROW LEVEL SECURITY;

-- Allow public/anon select & upsert so mobile clients can check/register device status
DROP POLICY IF EXISTS "Public select registered_devices" ON registered_devices;
CREATE POLICY "Public select registered_devices" ON registered_devices
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert registered_devices" ON registered_devices;
CREATE POLICY "Public insert registered_devices" ON registered_devices
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public update registered_devices" ON registered_devices;
CREATE POLICY "Public update registered_devices" ON registered_devices
  FOR UPDATE USING (true);
