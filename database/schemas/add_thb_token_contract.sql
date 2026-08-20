-- Seed THB (Thai Baht) token contract configuration on Sepolia network
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run
INSERT INTO token_contracts (currency_code, network_name, contract_address, decimals, is_enabled)
VALUES ('THB', 'Sepolia', '0x288cd557B7EF9CF317DbEC59d425C23913ab6BeB', 6, true)
ON CONFLICT (currency_code, network_name) 
DO UPDATE SET
  contract_address = EXCLUDED.contract_address,
  decimals = EXCLUDED.decimals,
  is_enabled = EXCLUDED.is_enabled;
