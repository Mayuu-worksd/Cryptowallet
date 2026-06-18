-- Fix missing 'description' column in transactions table
-- Run this in your Supabase SQL Editor

-- Add the missing description column
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS description text;

-- Also add other commonly needed columns if they don't exist
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS transaction_type text,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed',
ADD COLUMN IF NOT EXISTS network text DEFAULT 'ethereum',
ADD COLUMN IF NOT EXISTS gas_fee numeric(20,8),
ADD COLUMN IF NOT EXISTS confirmation_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS block_number bigint,
ADD COLUMN IF NOT EXISTS nonce integer,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

-- Update existing transactions to have proper descriptions where null
UPDATE transactions 
SET description = CASE 
    WHEN description IS NULL AND transaction_type = 'send' THEN 'Sent ' || COALESCE(symbol, 'ETH')
    WHEN description IS NULL AND transaction_type = 'receive' THEN 'Received ' || COALESCE(symbol, 'ETH')
    WHEN description IS NULL AND transaction_type = 'swap' THEN 'Token Swap'
    WHEN description IS NULL THEN 'Transaction'
    ELSE description
END
WHERE description IS NULL;

-- Verify the fix
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'transactions' 
ORDER BY ordinal_position;