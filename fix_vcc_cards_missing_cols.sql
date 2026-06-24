-- ─── Fix: Add Codego linking columns + missing vcc_cards columns ──────────────
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run
-- Safe to re-run (all use IF NOT EXISTS)

-- 1. Link vcc_cards rows to real Codego card IDs
ALTER TABLE public.vcc_cards ADD COLUMN IF NOT EXISTS codego_card_id  VARCHAR(100);
ALTER TABLE public.vcc_cards ADD COLUMN IF NOT EXISTS codego_status   VARCHAR(20) DEFAULT 'inactive';

-- 2. Link KYC records to Codego Cardholder IDs (needed by admin API to create Codego cardholders)
ALTER TABLE public.kyc ADD COLUMN IF NOT EXISTS codego_cardholder_id VARCHAR(100);

-- 3. Missing compliance columns (safe to add; already have defaults)
ALTER TABLE public.vcc_cards ADD COLUMN IF NOT EXISTS kyc_verified      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.vcc_cards ADD COLUMN IF NOT EXISTS name_match         BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.vcc_cards ADD COLUMN IF NOT EXISTS compliance_status  TEXT    NOT NULL DEFAULT 'compliant'
  CHECK (compliance_status IN ('compliant', 'flagged'));
