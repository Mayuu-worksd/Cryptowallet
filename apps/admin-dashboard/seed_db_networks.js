const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase env variables not found.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const networksToSeed = [
  {
    network_name: 'Ethereum',
    rpc_url: 'https://cloudflare-eth.com',
    chain_id: '1',
    explorer_url: 'https://etherscan.io',
    symbol: 'ETH',
    is_mainnet: true,
    is_active: true,
    min_deposit: '0.005 ETH',
    estimated_arrival: '3 minutes',
    warning_text: 'Only send supported ERC20 assets.',
    supported_assets: ['ETH', 'USDT', 'USDC']
  },
  {
    network_name: 'Sepolia',
    rpc_url: 'https://rpc.sepolia.org',
    chain_id: '11155111',
    explorer_url: 'https://sepolia.etherscan.io',
    symbol: 'ETH',
    is_mainnet: false,
    is_active: true,
    min_deposit: '0.001 ETH',
    estimated_arrival: '15 seconds',
    warning_text: 'Only send Sepolia supported tokens.',
    supported_assets: ['ETH', 'USDT', 'USDC', 'INRX', 'THB', 'PKR', 'AED', 'CNY', 'RUB', 'UZS', 'VND', 'IDR', 'PHP']
  },
  {
    network_name: 'Polygon',
    rpc_url: 'https://polygon-rpc.com',
    chain_id: '137',
    explorer_url: 'https://polygonscan.com',
    symbol: 'MATIC',
    is_mainnet: true,
    is_active: true,
    min_deposit: '5 MATIC',
    estimated_arrival: '2 minutes',
    warning_text: 'Only send MATIC/USDT/USDC/INRX via Polygon.',
    supported_assets: ['MATIC', 'USDT', 'USDC', 'INRX', 'THB', 'PKR', 'AED', 'CNY', 'RUB', 'UZS', 'VND', 'IDR', 'PHP']
  },
  {
    network_name: 'Polygon Amoy',
    rpc_url: 'https://rpc-amoy.polygon.technology',
    chain_id: '80002',
    explorer_url: 'https://amoy.polygonscan.com',
    symbol: 'MATIC',
    is_mainnet: false,
    is_active: true,
    min_deposit: '1 MATIC',
    estimated_arrival: '10 seconds',
    warning_text: 'Only send supported Amoy assets.',
    supported_assets: ['MATIC', 'USDT', 'USDC']
  },
  {
    network_name: 'Arbitrum',
    rpc_url: 'https://arb1.arbitrum.io/rpc',
    chain_id: '42161',
    explorer_url: 'https://arbiscan.io',
    symbol: 'ETH',
    is_mainnet: true,
    is_active: true,
    min_deposit: '0.002 ETH',
    estimated_arrival: '30 seconds',
    warning_text: 'Only send ETH/USDT/USDC via Arbitrum.',
    supported_assets: ['ETH', 'USDT', 'USDC']
  },
  {
    network_name: 'Arbitrum Sepolia',
    rpc_url: 'https://sepolia-rollup.arbitrum.io/rpc',
    chain_id: '421614',
    explorer_url: 'https://sepolia.arbiscan.io',
    symbol: 'ETH',
    is_mainnet: false,
    is_active: true,
    min_deposit: '0.0005 ETH',
    estimated_arrival: '5 seconds',
    warning_text: 'Only send Arbitrum Sepolia supported assets.',
    supported_assets: ['ETH', 'USDT', 'USDC']
  },
  {
    network_name: 'Base Sepolia',
    rpc_url: 'https://sepolia.base.org',
    chain_id: '84532',
    explorer_url: 'https://sepolia.basescan.org',
    symbol: 'ETH',
    is_mainnet: false,
    is_active: true,
    min_deposit: '0.0005 ETH',
    estimated_arrival: '5 seconds',
    warning_text: 'Only send Base Sepolia supported assets.',
    supported_assets: ['ETH', 'USDT', 'USDC']
  },
  {
    network_name: 'Optimism Sepolia',
    rpc_url: 'https://sepolia.optimism.io',
    chain_id: '11155420',
    explorer_url: 'https://sepolia-optimism.etherscan.io',
    symbol: 'ETH',
    is_mainnet: false,
    is_active: true,
    min_deposit: '0.0005 ETH',
    estimated_arrival: '5 seconds',
    warning_text: 'Only send Optimism Sepolia supported assets.',
    supported_assets: ['ETH', 'USDT', 'USDC']
  },
  {
    network_name: 'TRON',
    rpc_url: 'https://api.trongrid.io',
    chain_id: '0',
    explorer_url: 'https://tronscan.org',
    symbol: 'TRX',
    is_mainnet: true,
    is_active: true,
    min_deposit: '10 TRX',
    estimated_arrival: '1 minute',
    warning_text: 'Only send TRX/USDT/USDC via TRC20.',
    supported_assets: ['TRX', 'USDT', 'USDC']
  },
  {
    network_name: 'TRON Nile',
    rpc_url: 'https://nile.trongrid.io',
    chain_id: '0',
    explorer_url: 'https://nile.tronscan.org',
    symbol: 'TRX',
    is_mainnet: false,
    is_active: true,
    min_deposit: '2 TRX',
    estimated_arrival: '10 seconds',
    warning_text: 'Only send Nile supported assets.',
    supported_assets: ['TRX', 'USDT', 'USDC']
  },
  {
    network_name: 'Solana',
    rpc_url: 'https://api.mainnet-beta.solana.com',
    chain_id: '0',
    explorer_url: 'https://explorer.solana.com',
    symbol: 'SOL',
    is_mainnet: true,
    is_active: true,
    min_deposit: '0.05 SOL',
    estimated_arrival: '10 seconds',
    warning_text: 'Only send SOL/USDT/USDC via Solana.',
    supported_assets: ['SOL', 'USDT', 'USDC']
  },
  {
    network_name: 'Solana Devnet',
    rpc_url: 'https://api.devnet.solana.com',
    chain_id: '0',
    explorer_url: 'https://explorer.solana.com/?cluster=devnet',
    symbol: 'SOL',
    is_mainnet: false,
    is_active: true,
    min_deposit: '0.01 SOL',
    estimated_arrival: '3 seconds',
    warning_text: 'Only send Solana Devnet supported assets.',
    supported_assets: ['SOL']
  },
  {
    network_name: 'Bitcoin Network',
    rpc_url: '',
    chain_id: 'btc',
    explorer_url: 'https://blockchain.info',
    symbol: 'BTC',
    is_mainnet: true,
    is_active: true,
    min_deposit: '0.0002 BTC',
    estimated_arrival: '10-60 minutes',
    warning_text: 'Only send Bitcoin (BTC) to this address. Send via legacy/SegWit networks.',
    supported_assets: ['BTC']
  },
  {
    network_name: 'BNB Smart Chain',
    rpc_url: 'https://bsc-dataseed.binance.org',
    chain_id: '56',
    explorer_url: 'https://bscscan.com',
    symbol: 'BNB',
    is_mainnet: true,
    is_active: true,
    min_deposit: '0.01 BNB',
    estimated_arrival: '1 minute',
    warning_text: 'Only send BNB or BEP20 tokens to this address.',
    supported_assets: ['BNB', 'USDT', 'USDC']
  },
  {
    network_name: 'TON Network',
    rpc_url: 'https://toncenter.com/api/v2/jsonRPC',
    chain_id: 'ton',
    explorer_url: 'https://tonscan.org',
    symbol: 'TON',
    is_mainnet: true,
    is_active: true,
    min_deposit: '0.5 TON',
    estimated_arrival: '1 minute',
    warning_text: 'Only send Toncoin (TON) to this address. Memo/comment is NOT required.',
    supported_assets: ['TON']
  },
  {
    network_name: 'Sui Network',
    rpc_url: 'https://fullnode.mainnet.sui.io:443',
    chain_id: 'sui',
    explorer_url: 'https://suiscan.xyz',
    symbol: 'SUI',
    is_mainnet: true,
    is_active: true,
    min_deposit: '0.1 SUI',
    estimated_arrival: '5 seconds',
    warning_text: 'Only send Sui (SUI) to this address.',
    supported_assets: ['SUI']
  },
  {
    network_name: 'Ripple Ledger',
    rpc_url: '',
    chain_id: 'xrp',
    explorer_url: 'https://xrpscan.com',
    symbol: 'XRP',
    is_mainnet: true,
    is_active: true,
    min_deposit: '1 XRP',
    estimated_arrival: '10 seconds',
    warning_text: 'Only send Ripple (XRP) to this address. Destination Tag is not required for private keys.',
    supported_assets: ['XRP']
  }
];

async function main() {
  console.log('Seeding admin_networks...');
  const { data, error } = await supabase
    .from('admin_networks')
    .upsert(networksToSeed, { onConflict: 'network_name' });

  if (error) {
    console.error('❌ Seeding admin_networks failed:', error.message);
  } else {
    console.log('✅ Seeding admin_networks completed successfully!');
  }
}

main().catch(console.error);
