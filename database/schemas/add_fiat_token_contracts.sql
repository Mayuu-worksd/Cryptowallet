-- Register fiat-backed token contracts for PKR, AED, CNY, RUB, UZS, VND, IDR, PHP
-- Network: Sepolia (testnet)
-- is_enabled = false — activate only after E2E verification passes per currency
--
-- Replace each contract_address placeholder with the actual proxy address
-- from deployed_addresses.json after running deploy_fiat_currencies.js
--
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run

INSERT INTO token_contracts (currency_code, network_name, contract_address, decimals, is_enabled)
VALUES
  ('PKR', 'Sepolia', '', 6, false),
  ('AED', 'Sepolia', '', 6, false),
  ('CNY', 'Sepolia', '', 6, false),
  ('RUB', 'Sepolia', '', 6, false),
  ('UZS', 'Sepolia', '', 6, false),
  ('VND', 'Sepolia', '', 6, false),
  ('IDR', 'Sepolia', '', 6, false),
  ('PHP', 'Sepolia', '', 6, false)
ON CONFLICT (currency_code, network_name)
DO UPDATE SET
  contract_address = EXCLUDED.contract_address,
  decimals         = EXCLUDED.decimals,
  is_enabled       = EXCLUDED.is_enabled;

-- To activate a currency after E2E verification, run:
-- UPDATE token_contracts SET is_enabled = true WHERE currency_code = 'PKR' AND network_name = 'Sepolia';
-- (repeat per currency)
