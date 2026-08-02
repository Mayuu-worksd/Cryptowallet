-- ─────────────────────────────────────────────────────────────────────────────
-- CryptoWallet — Wallet Backup Schema
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run
-- Safe to re-run
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Backup Records Table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS backup_records (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address   TEXT        UNIQUE NOT NULL,
  email            TEXT        UNIQUE NOT NULL,
  encrypted_backup TEXT        NOT NULL,
  password_hash    TEXT        NOT NULL,
  salt             TEXT        NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_records_wallet ON backup_records(wallet_address);
CREATE INDEX IF NOT EXISTS idx_backup_records_email ON backup_records(email);

-- Enable RLS
ALTER TABLE backup_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "anon_all_backup_records" ON backup_records;
CREATE POLICY "anon_all_backup_records" 
ON backup_records FOR ALL TO anon 
USING (true) 
WITH CHECK (true);

-- ─── 2. Storage Bucket for Backups ───────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('wallet-backups', 'wallet-backups', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage RLS Policies
DROP POLICY IF EXISTS "anon_all_wallet_backups" ON storage.objects;
CREATE POLICY "anon_all_wallet_backups"
ON storage.objects FOR ALL TO anon
USING (bucket_id = 'wallet-backups')
WITH CHECK (bucket_id = 'wallet-backups');
