import { RPC_URLS } from '../config';

export const Fonts = {
  regular: 'Inter_400Regular',
  medium:  'Inter_500Medium',
  semiBold:'Inter_600SemiBold',
  bold:    'Inter_700Bold',
  extraBold:'Inter_800ExtraBold',
};

export const NETWORKS: Record<string, string> = RPC_URLS;

// ETH-chain only tokens (real balances). BTC/SOL are different blockchains.
export const ETH_CHAIN_COINS = ['ETH', 'USDT'] as const;

export const DEFAULT_NETWORK = 'Sepolia';

export const NETWORK_INFO: Record<string, { name: string; type: string; color: string; symbol: string; iconUrl: string }> = {
  Sepolia:            { name: 'Ethereum Sepolia',  type: 'Testnet', color: '#F59E0B', symbol: 'ETH', iconUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.png?v=032' },
  Ethereum:           { name: 'Ethereum',          type: 'Mainnet', color: '#627EEA', symbol: 'ETH', iconUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.png?v=032' },
  Polygon:            { name: 'Polygon',           type: 'Mainnet', color: '#8247E5', symbol: 'MATIC', iconUrl: 'https://cryptologos.cc/logos/polygon-matic-logo.png?v=032' },
  Arbitrum:           { name: 'Arbitrum',          type: 'Mainnet', color: '#2D9CDB', symbol: 'ETH', iconUrl: 'https://cryptologos.cc/logos/arbitrum-arb-logo.png?v=032' },
  'Polygon Amoy':     { name: 'Polygon Amoy',      type: 'Testnet', color: '#A855F7', symbol: 'MATIC', iconUrl: 'https://cryptologos.cc/logos/polygon-matic-logo.png?v=032' },
  'Arbitrum Sepolia': { name: 'Arbitrum Sepolia',  type: 'Testnet', color: '#60A5FA', symbol: 'ETH', iconUrl: 'https://cryptologos.cc/logos/arbitrum-arb-logo.png?v=032' },
  'Base Sepolia':     { name: 'Base Sepolia',      type: 'Testnet', color: '#0052FF', symbol: 'ETH', iconUrl: 'https://avatars.githubusercontent.com/u/108554348?v=4' },
  'Optimism Sepolia': { name: 'Optimism Sepolia',  type: 'Testnet', color: '#FF0420', symbol: 'ETH', iconUrl: 'https://cryptologos.cc/logos/optimism-ethereum-op-logo.png?v=032' },
  BSC:                { name: 'BNB Smart Chain',   type: 'Mainnet', color: '#F0B90B', symbol: 'BNB', iconUrl: 'https://cryptologos.cc/logos/bnb-bnb-logo.png?v=032' },
  'BSC Testnet':      { name: 'BSC Testnet',       type: 'Testnet', color: '#F0B90B', symbol: 'BNB', iconUrl: 'https://cryptologos.cc/logos/bnb-bnb-logo.png?v=032' },
  TRON:               { name: 'TRON',              type: 'Mainnet', color: '#EF0027', symbol: 'TRX', iconUrl: 'https://cryptologos.cc/logos/tron-trx-logo.png?v=032' },
  'TRON Nile':        { name: 'TRON Nile',         type: 'Testnet', color: '#FF6B6B', symbol: 'TRX', iconUrl: 'https://cryptologos.cc/logos/tron-trx-logo.png?v=032' },
  Solana:             { name: 'Solana',            type: 'Mainnet', color: '#9945FF', symbol: 'SOL', iconUrl: 'https://cryptologos.cc/logos/solana-sol-logo.png?v=032' },
  'Solana Devnet':    { name: 'Solana Devnet',     type: 'Testnet', color: '#14F195', symbol: 'SOL', iconUrl: 'https://cryptologos.cc/logos/solana-sol-logo.png?v=032' },
};

import { SUPPORTED_TOKENS } from './currencyConfig';

export const COIN_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(SUPPORTED_TOKENS).map(([k, v]) => [k, v.color])
);

export const COIN_META: Record<string, { name: string; symbol: string; iconUrl: string; color: string }> = Object.fromEntries(
  Object.entries(SUPPORTED_TOKENS).map(([k, v]) => [k, { name: v.name, symbol: v.symbol, iconUrl: v.iconUrl, color: v.color }])
);

export const FALLBACK_PRICES: Record<string, number> = Object.fromEntries(
  Object.keys(SUPPORTED_TOKENS).map(k => [k, 0])
);

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
  // Default text style — apply to every Text component to lock in Inter
  text: {
    fontFamily: 'Inter_400Regular',
  },
};

