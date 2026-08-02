-- Phase 3: Codego Fiat Integration Tables

-- Helper function for updating the updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';


-- 1. Fiat Deposits Table
-- Tracks requests by users to deposit Fiat (from their external bank account) to the Codego Wallet
CREATE TABLE IF NOT EXISTS public.fiat_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    codego_card_id UUID REFERENCES public.codego_cards(id),
    amount DECIMAL NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    reference_code VARCHAR(50) UNIQUE NOT NULL, -- The code user puts in transfer memo
    status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed
    codego_deposit_id VARCHAR(100), -- ID from Codego once processed
    bank_iban VARCHAR(100), -- User's sending bank IBAN (if captured)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Fiat Withdrawals Table
-- Tracks requests by users to withdraw Fiat from Codego to their external bank account
CREATE TABLE IF NOT EXISTS public.fiat_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    codego_card_id UUID REFERENCES public.codego_cards(id),
    amount DECIMAL NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    destination_iban VARCHAR(100) NOT NULL,
    destination_bic VARCHAR(20) NOT NULL,
    destination_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    codego_withdrawal_id VARCHAR(100), -- ID from Codego
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. RLS Policies
ALTER TABLE public.fiat_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiat_withdrawals ENABLE ROW LEVEL SECURITY;

-- Users can read their own deposits/withdrawals
CREATE POLICY "Users can view their own fiat deposits" 
    ON public.fiat_deposits FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own fiat withdrawals" 
    ON public.fiat_withdrawals FOR SELECT 
    USING (auth.uid() = user_id);

-- Admins can view/update all
CREATE POLICY "Admins have full access to fiat_deposits" 
    ON public.fiat_deposits FOR ALL 
    USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins have full access to fiat_withdrawals" 
    ON public.fiat_withdrawals FOR ALL 
    USING (auth.jwt() ->> 'role' = 'admin');

-- Triggers for updated_at
CREATE TRIGGER update_fiat_deposits_updated_at
    BEFORE UPDATE ON public.fiat_deposits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fiat_withdrawals_updated_at
    BEFORE UPDATE ON public.fiat_withdrawals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
