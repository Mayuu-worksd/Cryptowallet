import { RPC_URLS } from '../config';

export const NETWORKS: Record<string, string> = RPC_URLS;

// ETH-chain only tokens (real balances). BTC/SOL are different blockchains.
export const ETH_CHAIN_COINS = ['ETH', 'USDT'] as const;

export const DEFAULT_NETWORK = 'Sepolia';

export const NETWORK_INFO: Record<string, { name: string; type: string }> = {
  Sepolia:  { name: 'Sepolia',  type: 'Testnet' },
  Ethereum: { name: 'Ethereum', type: 'Mainnet' },
  Polygon:  { name: 'Polygon',  type: 'Mainnet' },
  Arbitrum: { name: 'Arbitrum', type: 'Mainnet' },
};

// Fallback prices — replaced by live CoinGecko data at runtime
export const FALLBACK_PRICES: Record<string, number> = {
  ETH:   3450,
  BTC:   64000,
  USDT:  1,
  SOL:   180,
  MATIC: 0.85,
};

export const COIN_COLORS: Record<string, string> = {
  ETH:   '#627EEA',
  BTC:   '#F7931A',
  USDT:  '#26A17B',
  SOL:   '#9945FF',
  MATIC: '#8247E5',
  USDC:  '#2775CA',
};

export const COIN_META: Record<string, { name: string; symbol: string; iconUrl: string; color: string }> = {
  ETH: {
    name:    'Ethereum',
    symbol:  'ETH',
    iconUrl: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
    color:   '#627EEA',
  },
  BTC: {
    name:    'Bitcoin',
    symbol:  'BTC',
    iconUrl: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
    color:   '#F7931A',
  },
  USDT: {
    name:    'Tether',
    symbol:  'USDT',
    iconUrl: 'https://assets.coingecko.com/coins/images/325/large/Tether.png',
    color:   '#26A17B',
  },
  SOL: {
    name:    'Solana',
    symbol:  'SOL',
    iconUrl: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
    color:   '#9945FF',
  },
  MATIC: {
    name:    'Polygon',
    symbol:  'MATIC',
    iconUrl: 'https://assets.coingecko.com/coins/images/4713/large/matic-token-icon.png',
    color:   '#8247E5',
  },
};

export const Theme = {
  colors: {
    primary:      '#FF3B3B',
    primaryDark:  '#c00018',
    primaryLight: '#ffb3ac',
    background:   '#101114',
    surface:      '#1C1D21',
    surfaceLow:   '#2A2B31',
    surfaceHigh:  '#363840',
    text:         '#FFFFFF',
    textMuted:    '#A1A5AB',
    textDim:      '#5C6068',
    border:       '#2E3036',
    success:      '#00C853',
    error:        '#FF3B3B',
    pending:      '#F59E0B',
  },
  lightColors: {
    primary:      '#FF3B3B',
    primaryDark:  '#c00018',
    primaryLight: '#ffb3ac',
    background:   '#F7F9FB',
    surface:      '#FFFFFF',
    surfaceLow:   '#F2F4F6',
    surfaceHigh:  '#E5E7EB',
    text:         '#191C1E',
    textMuted:    '#6B7280',
    textDim:      '#A0AAB5',
    border:       '#E5E7EB',
    success:      '#00C853',
    error:        '#FF3B3B',
    pending:      '#F59E0B',
  },
  roundness: { sm: 8, md: 12, lg: 16, xl: 24 },
};
