const ALCHEMY_KEY = process.env.EXPO_PUBLIC_ALCHEMY_KEY ?? '';

if (!ALCHEMY_KEY) {
  console.warn('EXPO_PUBLIC_ALCHEMY_KEY is missing. Run: eas secret:create --scope project --name EXPO_PUBLIC_ALCHEMY_KEY --value <your_key>');
}

// Use public Infura fallback when Alchemy key is absent so the app doesn't crash
const sepoliaRpc  = ALCHEMY_KEY ? `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`  : 'https://rpc.sepolia.org';
const ethRpc      = ALCHEMY_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`  : 'https://cloudflare-eth.com';
const polygonRpc  = ALCHEMY_KEY ? `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}` : 'https://polygon-rpc.com';
const arbitrumRpc = ALCHEMY_KEY ? `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`  : 'https://arb1.arbitrum.io/rpc';

export const RPC_URLS: Record<string, string> = {
  Sepolia:  sepoliaRpc,
  Ethereum: ethRpc,
  Polygon:  polygonRpc,
  Arbitrum: arbitrumRpc,
};
