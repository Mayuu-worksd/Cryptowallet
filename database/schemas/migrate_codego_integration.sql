-- ==============================================================================
-- CODEGO INTEGRATION CONSOLIDATED MIGRATION
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run
-- ==============================================================================

-- 1. Add tracking number columns to vcc_cards
ALTER TABLE public.vcc_cards ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE public.vcc_cards ADD COLUMN IF NOT EXISTS shipping_tracking_number TEXT;

-- 2. Clean up pin audits constraint to point to vcc_cards(id)
ALTER TABLE public.codego_card_pin_audits DROP CONSTRAINT IF EXISTS codego_card_pin_audits_card_id_fkey;
ALTER TABLE public.codego_card_pin_audits 
  ADD CONSTRAINT codego_card_pin_audits_card_id_fkey 
  FOREIGN KEY (card_id) REFERENCES public.vcc_cards(id) ON DELETE CASCADE;

-- 3. Recreate fiat_deposits and fiat_withdrawals safely referencing vcc_cards
DROP TABLE IF EXISTS public.fiat_deposits CASCADE;
DROP TABLE IF EXISTS public.fiat_withdrawals CASCADE;

-- Recreate fiat_deposits
CREATE TABLE public.fiat_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- references kyc.id (not strictly auth.users)
    codego_card_id UUID REFERENCES public.vcc_cards(id) ON DELETE SET NULL,
    amount DECIMAL NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    reference_code VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    codego_deposit_id VARCHAR(100),
    bank_iban VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Recreate fiat_withdrawals
CREATE TABLE public.fiat_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    codego_card_id UUID REFERENCES public.vcc_cards(id) ON DELETE SET NULL,
    amount DECIMAL NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    destination_iban VARCHAR(100) NOT NULL,
    destination_bic VARCHAR(20) NOT NULL,
    destination_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    codego_withdrawal_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS and setup permissive policies for sandbox/admin operation
ALTER TABLE public.fiat_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiat_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access fiat_deposits" ON public.fiat_deposits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access fiat_withdrawals" ON public.fiat_withdrawals FOR ALL USING (true) WITH CHECK (true);
