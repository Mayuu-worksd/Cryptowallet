-- Codego Phase 2 Integration Schema: Physical Cards & Limits

-- Add physical card and limit fields to existing codego_cards table
ALTER TABLE public.codego_cards 
ADD COLUMN IF NOT EXISTS shipping_address JSONB,
ADD COLUMN IF NOT EXISTS activation_status TEXT DEFAULT 'not_requested', -- not_requested, pending, shipped, delivered, activated
ADD COLUMN IF NOT EXISTS shipping_tracking_number TEXT;

-- Create an audit table for PIN changes (never store the PIN, just the event)
CREATE TABLE IF NOT EXISTS public.codego_card_pin_audits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    card_id UUID NOT NULL REFERENCES public.codego_cards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies for new table
ALTER TABLE public.codego_card_pin_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own codego_card_pin_audits" 
ON public.codego_card_pin_audits FOR SELECT 
USING (auth.uid() = user_id);
