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
  USDC:  '#2775CA',
  DAI:   '#F4B731',
  SOL:   '#9945FF',
  MATIC: '#8247E5',
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
  USDC: {
    name:    'USD Coin',
    symbol:  'USDC',
    iconUrl: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
    color:   '#2775CA',
  },
  DAI: {
    name:    'Dai',
    symbol:  'DAI',
    iconUrl: 'https://assets.coingecko.com/coins/images/9956/large/4943.png',
    color:   '#F4B731',
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
  CUSTOM: {
    name:    'Custom Swap',
    symbol:  'CUSTOM',
    iconUrl: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png', // Fallback icon
    color:   '#FF3B3B',
  },
};

export const Theme = {
  colors: {
    primary:      '#EC2629',
    primaryDark:  '#93000d',
    primaryLight: '#ffb4ab',
    background:   '#131313',
    surface:      '#1c1b1b',
    surfaceLow:   '#201f1f',
    surfaceHigh:  '#2a2a2a',
    text:         '#FFFFFF',
    textMuted:    '#e5e2e1',
    textDim:      '#A1A5AB',
    border:       '#2a2a2a',
    success:      '#00C853',
    error:        '#ffb4ab',
    pending:      '#F59E0B',
  },
  lightColors: {
    primary:      '#EC2629',
    primaryDark:  '#93000d',
    primaryLight: '#ffb4ab',
    background:   '#F8F9FA',
    surface:      '#FFFFFF',
    surfaceLow:   '#F1F3F4',
    surfaceHigh:  '#E8EAED',
    text:         '#131313',
    textMuted:    '#5F6368',
    textDim:      '#9AA0A6',
    border:       '#E8EAED',
    success:      '#00C853',
    error:        '#D93025',
    pending:      '#F29900',
  },
  roundness: { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 },
};

