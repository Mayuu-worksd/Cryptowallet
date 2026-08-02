-- MINIMAL FIX: Just add the missing columns
-- This fixes the "column 'description' does not exist" error

-- First, let's see what columns actually exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'transactions' 
ORDER BY ordinal_position;

-- Add only the missing columns that are causing errors
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS label text;

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS reference_id text;

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS to_address text;

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS swap_to_token text;

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS swap_to_amount numeric(20,8);

-- Set simple default descriptions using existing columns
UPDATE transactions 
SET description = CASE 
    WHEN description IS NULL AND type = 'send' THEN 'Sent ' || COALESCE(token, 'crypto')
    WHEN description IS NULL AND type = 'receive' THEN 'Received ' || COALESCE(token, 'crypto')
    WHEN description IS NULL AND type = 'swap' THEN 'Token Swap'
    WHEN description IS NULL AND type = 'fee' THEN 'Transaction Fee'
    WHEN description IS NULL AND type = 'card_topup' THEN 'Card Top-up'
    WHEN description IS NULL AND type = 'card_spend' THEN 'Card Payment'
    WHEN description IS NULL THEN 'Transaction'
    ELSE description
END
WHERE description IS NULL OR description = '';

-- Verify the fix worked
SELECT COUNT(*) as total_transactions, 
       COUNT(description) as with_description,
       COUNT(CASE WHEN description IS NULL OR description = '' THEN 1 END) as missing_description
FROM transactions;