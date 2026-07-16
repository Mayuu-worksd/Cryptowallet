const ALCHEMY_KEY = process.env.EXPO_PUBLIC_ALCHEMY_KEY ?? '';

if (!ALCHEMY_KEY) {
  console.warn('EXPO_PUBLIC_ALCHEMY_KEY is missing. Run: eas secret:create --scope project --name EXPO_PUBLIC_ALCHEMY_KEY --value <your_key>');
}

const sepoliaRpc         = ALCHEMY_KEY ? `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`        : 'https://rpc.sepolia.org';
const ethRpc             = ALCHEMY_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`        : 'https://cloudflare-eth.com';
const polygonRpc         = ALCHEMY_KEY ? `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`    : 'https://polygon-rpc.com';
const arbitrumRpc        = ALCHEMY_KEY ? `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`        : 'https://arb1.arbitrum.io/rpc';
const polygonAmoyRpc     = ALCHEMY_KEY ? `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_KEY}`       : 'https://rpc-amoy.polygon.technology';
const arbitrumSepoliaRpc = ALCHEMY_KEY ? `https://arb-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`        : 'https://sepolia-rollup.arbitrum.io/rpc';
const baseSepoliaRpc     = ALCHEMY_KEY ? `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`       : 'https://sepolia.base.org';
const optimismSepoliaRpc = ALCHEMY_KEY ? `https://opt-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`        : 'https://sepolia.optimism.io';
// BSC uses public RPCs — Alchemy does not support BSC
const bscRpc             = 'https://bsc-dataseed1.binance.org';
const bscTestnetRpc      = 'https://data-seed-prebsc-1-s1.binance.org:8545';

export const RPC_URLS: Record<string, string> = {
  Sepolia:            sepoliaRpc,
  Ethereum:           ethRpc,
  Polygon:            polygonRpc,
  Arbitrum:           arbitrumRpc,
  'Polygon Amoy':     polygonAmoyRpc,
  'Arbitrum Sepolia': arbitrumSepoliaRpc,
  'Base Sepolia':     baseSepoliaRpc,
  'Optimism Sepolia': optimismSepoliaRpc,
  BSC:                bscRpc,
  'BSC Testnet':      bscTestnetRpc,
  TRON:               'https://api.trongrid.io',
  'TRON Nile':        'https://nile.trongrid.io',
  Solana:             'https://api.mainnet-beta.solana.com',
  'Solana Devnet':    'https://api.devnet.solana.com',
};
