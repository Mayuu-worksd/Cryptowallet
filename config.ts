// Alchemy key is read from .env (EXPO_PUBLIC_ALCHEMY_KEY).
// For EAS builds, add via: eas secret:create --scope project --name EXPO_PUBLIC_ALCHEMY_KEY --value <key>
const ALCHEMY_KEY = process.env.EXPO_PUBLIC_ALCHEMY_KEY;

if (!ALCHEMY_KEY || ALCHEMY_KEY === 'undefined') {
  console.error('ALCHEMY_KEY is missing or invalid. Balance fetching will not work. Add it via: eas secret:create --scope project --name EXPO_PUBLIC_ALCHEMY_KEY --value <your_key>');
}

export const RPC_URLS: Record<string, string> = {
  Sepolia:  `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  Ethereum: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  Polygon:  `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  Arbitrum: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
};
