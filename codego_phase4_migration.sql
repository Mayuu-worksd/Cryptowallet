-- ==============================================================================
-- PHASE 4: CODEGO ARCHITECTURE MAPPING
-- This script adds the missing columns to link our Supabase platform with Codego.
-- ==============================================================================

-- 1. Link Users to Codego Cardholders
-- The 'kyc' table is currently used to track verified user identities by wallet_address.
ALTER TABLE public.kyc ADD COLUMN IF NOT EXISTS codego_cardholder_id VARCHAR(100);

-- 2. Link Virtual Cards to Codego Cards
-- The 'vcc_cards' table holds the cards we issue to our users.
ALTER TABLE public.vcc_cards ADD COLUMN IF NOT EXISTS codego_card_id VARCHAR(100);
ALTER TABLE public.vcc_cards ADD COLUMN IF NOT EXISTS codego_status VARCHAR(20) DEFAULT 'inactive';

-- 3. Create Webhook Log Table for Auditing
CREATE TABLE IF NOT EXISTS public.codego_webhooks_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for Webhook Log (Admin Only)
ALTER TABLE public.codego_webhooks_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to webhooks" 
    ON public.codego_webhooks_log FOR ALL 
    USING (auth.jwt() ->> 'role' = 'admin');
