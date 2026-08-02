-- URGENT FIX: Add missing columns to transactions table
-- This fixes the "column 'description' does not exist" error

-- Add all missing columns that your code expects
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS label text,
ADD COLUMN IF NOT EXISTS transaction_type text,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed',
ADD COLUMN IF NOT EXISTS network text DEFAULT 'ethereum',
ADD COLUMN IF NOT EXISTS gas_fee numeric(20,8),
ADD COLUMN IF NOT EXISTS confirmation_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS block_number bigint,
ADD COLUMN IF NOT EXISTS nonce integer,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS reference_id text,
ADD COLUMN IF NOT EXISTS to_address text,
ADD COLUMN IF NOT EXISTS swap_to_token text,
ADD COLUMN IF NOT EXISTS swap_to_amount numeric(20,8);

-- Update existing transactions to have proper descriptions where null
UPDATE transactions 
SET description = CASE 
    WHEN description IS NULL AND type = 'send' THEN 'Sent ' || COALESCE(token, 'ETH')
    WHEN description IS NULL AND type = 'receive' THEN 'Received ' || COALESCE(token, 'ETH')
    WHEN description IS NULL AND type = 'swap' THEN 'Token Swap'
    WHEN description IS NULL AND type = 'fee' THEN 'Transaction Fee'
    WHEN description IS NULL AND type = 'card_topup' THEN 'Card Top-up'
    WHEN description IS NULL AND type = 'card_spend' THEN 'Card Payment'
    WHEN description IS NULL THEN 'Transaction'
    ELSE description
END
WHERE description IS NULL OR description = '';

-- Ensure status column has proper values
UPDATE transactions 
SET status = CASE 
    WHEN status IS NULL OR status = '' THEN 'completed'
    ELSE status
END;

-- Test the fix by checking column exists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'transactions' 
AND column_name IN ('description', 'label', 'status', 'reference_id')
ORDER BY ordinal_position;