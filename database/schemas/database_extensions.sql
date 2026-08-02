-- ─────────────────────────────────────────────────────────────────────────────
-- database_extensions.sql
-- Provider-Agnostic Database Migration & Backward Compatibility Triggers
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Extend vcc_cards table
ALTER TABLE vcc_cards ADD COLUMN IF NOT EXISTS provider_name TEXT DEFAULT 'codego';
ALTER TABLE vcc_cards ADD COLUMN IF NOT EXISTS provider_card_id TEXT;
ALTER TABLE vcc_cards ADD COLUMN IF NOT EXISTS provider_status TEXT;

-- 2. Extend kyc table
ALTER TABLE kyc ADD COLUMN IF NOT EXISTS provider_name TEXT DEFAULT 'codego';
ALTER TABLE kyc ADD COLUMN IF NOT EXISTS provider_cardholder_id TEXT;
ALTER TABLE kyc ADD COLUMN IF NOT EXISTS provider_application_status TEXT;

-- 3. Extend fiat_withdrawals table
ALTER TABLE fiat_withdrawals ADD COLUMN IF NOT EXISTS provider_name TEXT DEFAULT 'codego';
ALTER TABLE fiat_withdrawals ADD COLUMN IF NOT EXISTS provider_withdrawal_id TEXT;

-- 4. Bidirectional Sync Trigger for vcc_cards table
CREATE OR REPLACE FUNCTION sync_vcc_cards_provider_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync provider_card_id <-> codego_card_id
  IF NEW.provider_card_id IS NULL AND NEW.codego_card_id IS NOT NULL THEN
    NEW.provider_card_id := NEW.codego_card_id;
  ELSIF NEW.codego_card_id IS NULL AND NEW.provider_card_id IS NOT NULL THEN
    NEW.codego_card_id := NEW.provider_card_id;
  END IF;

  -- Sync provider_status <-> codego_status
  IF NEW.provider_status IS NULL AND NEW.codego_status IS NOT NULL THEN
    NEW.provider_status := NEW.codego_status;
  ELSIF NEW.codego_status IS NULL AND NEW.provider_status IS NOT NULL THEN
    NEW.codego_status := NEW.provider_status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_vcc_cards_provider ON vcc_cards;
CREATE TRIGGER trg_sync_vcc_cards_provider
  BEFORE INSERT OR UPDATE ON vcc_cards
  FOR EACH ROW
  EXECUTE FUNCTION sync_vcc_cards_provider_columns();

-- 5. Bidirectional Sync Trigger for kyc table
CREATE OR REPLACE FUNCTION sync_kyc_provider_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync provider_cardholder_id <-> codego_cardholder_id
  IF NEW.provider_cardholder_id IS NULL AND NEW.codego_cardholder_id IS NOT NULL THEN
    NEW.provider_cardholder_id := NEW.codego_cardholder_id;
  ELSIF NEW.codego_cardholder_id IS NULL AND NEW.provider_cardholder_id IS NOT NULL THEN
    NEW.codego_cardholder_id := NEW.provider_cardholder_id;
  END IF;

  -- Sync provider_application_status <-> codego_application_status
  IF NEW.provider_application_status IS NULL AND NEW.codego_application_status IS NOT NULL THEN
    NEW.provider_application_status := NEW.codego_application_status;
  ELSIF NEW.codego_application_status IS NULL AND NEW.provider_application_status IS NOT NULL THEN
    NEW.codego_application_status := NEW.provider_application_status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_kyc_provider ON kyc;
CREATE TRIGGER trg_sync_kyc_provider
  BEFORE INSERT OR UPDATE ON kyc
  FOR EACH ROW
  EXECUTE FUNCTION sync_kyc_provider_columns();

-- 6. Bidirectional Sync Trigger for fiat_withdrawals table
CREATE OR REPLACE FUNCTION sync_withdrawals_provider_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync provider_withdrawal_id <-> codego_withdrawal_id
  IF NEW.provider_withdrawal_id IS NULL AND NEW.codego_withdrawal_id IS NOT NULL THEN
    NEW.provider_withdrawal_id := NEW.codego_withdrawal_id;
  ELSIF NEW.codego_withdrawal_id IS NULL AND NEW.provider_withdrawal_id IS NOT NULL THEN
    NEW.codego_withdrawal_id := NEW.provider_withdrawal_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_withdrawals_provider ON fiat_withdrawals;
CREATE TRIGGER trg_sync_withdrawals_provider
  BEFORE INSERT OR UPDATE ON fiat_withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION sync_withdrawals_provider_columns();
