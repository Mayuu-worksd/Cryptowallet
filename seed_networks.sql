-- Seed existing hardcoded networks into the Admin Dashboard

INSERT INTO admin_networks (network_name, rpc_url, chain_id, explorer_url, symbol, is_mainnet, is_active)
VALUES 
  ('Ethereum', 'https://cloudflare-eth.com', '1', 'https://etherscan.io', 'ETH', true, true),
  ('Polygon', 'https://polygon-rpc.com', '137', 'https://polygonscan.com', 'MATIC', true, true),
  ('Arbitrum', 'https://arb1.arbitrum.io/rpc', '42161', 'https://arbiscan.io', 'ETH', true, true),
  ('TRON', 'https://api.trongrid.io', '0', 'https://tronscan.org', 'TRX', true, true),
  ('Solana', 'https://api.mainnet-beta.solana.com', '0', 'https://explorer.solana.com', 'SOL', true, true),
  
  -- Testnets
  ('Sepolia', 'https://rpc.sepolia.org', '11155111', 'https://sepolia.etherscan.io', 'ETH', false, true),
  ('Polygon Amoy', 'https://rpc-amoy.polygon.technology', '80002', 'https://amoy.polygonscan.com', 'MATIC', false, true),
  ('Arbitrum Sepolia', 'https://sepolia-rollup.arbitrum.io/rpc', '421614', 'https://sepolia.arbiscan.io', 'ETH', false, true),
  ('Base Sepolia', 'https://sepolia.base.org', '84532', 'https://sepolia.basescan.org', 'ETH', false, true),
  ('Optimism Sepolia', 'https://sepolia.optimism.io', '11155420', 'https://sepolia-optimism.etherscan.io', 'ETH', false, true),
  ('TRON Nile', 'https://nile.trongrid.io', '0', 'https://nile.tronscan.org', 'TRX', false, true),
  ('Solana Devnet', 'https://api.devnet.solana.com', '0', 'https://explorer.solana.com/?cluster=devnet', 'SOL', false, true);
