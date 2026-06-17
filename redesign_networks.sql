-- Alter admin_networks table to add columns for guided send/receive redesign
ALTER TABLE admin_networks ADD COLUMN IF NOT EXISTS min_deposit TEXT DEFAULT '0.001';
ALTER TABLE admin_networks ADD COLUMN IF NOT EXISTS estimated_arrival TEXT DEFAULT '3 minutes';
ALTER TABLE admin_networks ADD COLUMN IF NOT EXISTS warning_text TEXT DEFAULT 'Only send assets through the selected network. Deposits from unsupported networks may be permanently lost.';
ALTER TABLE admin_networks ADD COLUMN IF NOT EXISTS supported_assets TEXT[] DEFAULT '{}';

-- Re-create helper functions/RPCs for networks with the new columns
CREATE OR REPLACE FUNCTION admin_insert_network(
  p_network_name text, 
  p_rpc_url text, 
  p_chain_id text, 
  p_explorer_url text, 
  p_symbol text, 
  p_is_mainnet boolean,
  p_min_deposit text,
  p_estimated_arrival text,
  p_warning_text text,
  p_supported_assets text[]
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO admin_networks (
    network_name, rpc_url, chain_id, explorer_url, symbol, is_mainnet, is_active,
    min_deposit, estimated_arrival, warning_text, supported_assets
  )
  VALUES (
    p_network_name, p_rpc_url, p_chain_id, p_explorer_url, p_symbol, p_is_mainnet, true,
    p_min_deposit, p_estimated_arrival, p_warning_text, p_supported_assets
  );
$$;

CREATE OR REPLACE FUNCTION admin_update_network(
  p_id uuid, 
  p_network_name text, 
  p_rpc_url text, 
  p_chain_id text, 
  p_explorer_url text, 
  p_symbol text, 
  p_is_mainnet boolean,
  p_min_deposit text,
  p_estimated_arrival text,
  p_warning_text text,
  p_supported_assets text[]
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE admin_networks 
  SET network_name = p_network_name, 
      rpc_url = p_rpc_url, 
      chain_id = p_chain_id, 
      explorer_url = p_explorer_url, 
      symbol = p_symbol, 
      is_mainnet = p_is_mainnet,
      min_deposit = p_min_deposit,
      estimated_arrival = p_estimated_arrival,
      warning_text = p_warning_text,
      supported_assets = p_supported_assets,
      updated_at = now()
  WHERE id = p_id;
$$;

-- Seed additional networks and update existing ones with supported assets
-- 1. Update existing EVM and TRON/Solana networks
UPDATE admin_networks SET
  supported_assets = ARRAY['ETH', 'USDT', 'USDC'],
  min_deposit = '0.005 ETH',
  estimated_arrival = '3 minutes'
WHERE network_name = 'Ethereum';

UPDATE admin_networks SET
  supported_assets = ARRAY['ETH', 'USDT', 'USDC'],
  min_deposit = '0.001 ETH',
  estimated_arrival = '15 seconds'
WHERE network_name = 'Sepolia';

UPDATE admin_networks SET
  supported_assets = ARRAY['MATIC', 'USDT', 'USDC'],
  min_deposit = '5 MATIC',
  estimated_arrival = '2 minutes'
WHERE network_name = 'Polygon';

UPDATE admin_networks SET
  supported_assets = ARRAY['MATIC', 'USDT', 'USDC'],
  min_deposit = '1 MATIC',
  estimated_arrival = '10 seconds'
WHERE network_name = 'Polygon Amoy';

UPDATE admin_networks SET
  supported_assets = ARRAY['ETH', 'USDT', 'USDC'],
  min_deposit = '0.002 ETH',
  estimated_arrival = '30 seconds'
WHERE network_name = 'Arbitrum';

UPDATE admin_networks SET
  supported_assets = ARRAY['ETH', 'USDT', 'USDC'],
  min_deposit = '0.0005 ETH',
  estimated_arrival = '5 seconds'
WHERE network_name = 'Arbitrum Sepolia';

UPDATE admin_networks SET
  supported_assets = ARRAY['ETH', 'USDT', 'USDC'],
  min_deposit = '0.0005 ETH',
  estimated_arrival = '5 seconds'
WHERE network_name = 'Base Sepolia';

UPDATE admin_networks SET
  supported_assets = ARRAY['ETH', 'USDT', 'USDC'],
  min_deposit = '0.0005 ETH',
  estimated_arrival = '5 seconds'
WHERE network_name = 'Optimism Sepolia';

UPDATE admin_networks SET
  supported_assets = ARRAY['TRX', 'USDT', 'USDC'],
  min_deposit = '10 TRX',
  estimated_arrival = '1 minute'
WHERE network_name = 'TRON';

UPDATE admin_networks SET
  supported_assets = ARRAY['TRX', 'USDT', 'USDC'],
  min_deposit = '2 TRX',
  estimated_arrival = '10 seconds'
WHERE network_name = 'TRON Nile';

UPDATE admin_networks SET
  supported_assets = ARRAY['SOL', 'USDT', 'USDC'],
  min_deposit = '0.05 SOL',
  estimated_arrival = '10 seconds'
WHERE network_name = 'Solana';

UPDATE admin_networks SET
  supported_assets = ARRAY['SOL'],
  min_deposit = '0.01 SOL',
  estimated_arrival = '3 seconds'
WHERE network_name = 'Solana Devnet';

-- 2. Insert other networks if they don't exist
INSERT INTO admin_networks (network_name, rpc_url, chain_id, explorer_url, symbol, is_mainnet, is_active, min_deposit, estimated_arrival, warning_text, supported_assets)
VALUES
  ('Bitcoin Network', '', 'btc', 'https://blockchain.info', 'BTC', true, true, '0.0002 BTC', '10-60 minutes', 'Only send Bitcoin (BTC) to this address. Send via legacy/SegWit networks.', ARRAY['BTC']),
  ('BNB Smart Chain', 'https://bsc-dataseed.binance.org', '56', 'https://bscscan.com', 'BNB', true, true, '0.01 BNB', '1 minute', 'Only send BNB or BEP20 tokens to this address.', ARRAY['BNB', 'USDT', 'USDC']),
  ('TON Network', 'https://toncenter.com/api/v2/jsonRPC', 'ton', 'https://tonscan.org', 'TON', true, true, '0.5 TON', '1 minute', 'Only send Toncoin (TON) to this address. Memo/comment is NOT required.', ARRAY['TON']),
  ('Sui Network', 'https://fullnode.mainnet.sui.io:443', 'sui', 'https://suiscan.xyz', 'SUI', true, true, '0.1 SUI', '5 seconds', 'Only send Sui (SUI) to this address.', ARRAY['SUI']),
  ('Ripple Ledger', '', 'xrp', 'https://xrpscan.com', 'XRP', true, true, '1 XRP', '10 seconds', 'Only send Ripple (XRP) to this address. Destination Tag is not required for private keys.', ARRAY['XRP'])
ON CONFLICT DO NOTHING;
