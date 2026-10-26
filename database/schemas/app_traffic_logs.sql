-- =============================================================================
-- App Traffic Logs & Session Telemetry Schema
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/hxmacphgbpedazdvgdnz/sql/new
-- =============================================================================

CREATE TABLE IF NOT EXISTS app_traffic_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      TEXT NOT NULL,
  device_id       TEXT,
  wallet_address  TEXT,
  user_uid        BIGINT,
  ip_address      TEXT,
  country         TEXT DEFAULT 'Unknown',
  country_code    TEXT DEFAULT 'XX',
  city            TEXT DEFAULT 'Unknown',
  platform        TEXT DEFAULT 'android',
  device_model    TEXT DEFAULT 'Mobile Device',
  app_version     TEXT DEFAULT '1.0.0',
  screen_name     TEXT DEFAULT 'Home',
  hit_count       INTEGER NOT NULL DEFAULT 1,
  is_online       BOOLEAN NOT NULL DEFAULT true,
  last_heartbeat  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optimize queries for Admin Dashboard
CREATE INDEX IF NOT EXISTS idx_traffic_session ON app_traffic_logs (session_id);
CREATE INDEX IF NOT EXISTS idx_traffic_device ON app_traffic_logs (device_id);
CREATE INDEX IF NOT EXISTS idx_traffic_wallet ON app_traffic_logs (wallet_address);
CREATE INDEX IF NOT EXISTS idx_traffic_created ON app_traffic_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_traffic_online ON app_traffic_logs (is_online, last_heartbeat DESC);
CREATE INDEX IF NOT EXISTS idx_traffic_country ON app_traffic_logs (country_code);

-- Enable Row Level Security (RLS)
ALTER TABLE app_traffic_logs ENABLE ROW LEVEL SECURITY;

-- Allow public/anon to insert and heartbeat
DROP POLICY IF EXISTS "Public insert app_traffic_logs" ON app_traffic_logs;
CREATE POLICY "Public insert app_traffic_logs" ON app_traffic_logs
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public update app_traffic_logs" ON app_traffic_logs;
CREATE POLICY "Public update app_traffic_logs" ON app_traffic_logs
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public select app_traffic_logs" ON app_traffic_logs;
CREATE POLICY "Public select app_traffic_logs" ON app_traffic_logs
  FOR SELECT USING (true);

-- Grant privileges
GRANT ALL ON app_traffic_logs TO anon, authenticated, service_role;
