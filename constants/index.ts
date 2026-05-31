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
  Sepolia:            { name: 'Ethereum Sepolia',  type: 'Testnet', color: '#F59E0B', symbol: 'ETH', iconUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png' },
  Ethereum:           { name: 'Ethereum',          type: 'Mainnet', color: '#627EEA', symbol: 'ETH', iconUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png' },
  Polygon:            { name: 'Polygon',           type: 'Mainnet', color: '#8247E5', symbol: 'MATIC', iconUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png' },
  Arbitrum:           { name: 'Arbitrum',          type: 'Mainnet', color: '#2D9CDB', symbol: 'ETH', iconUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png' },
  'Polygon Amoy':     { name: 'Polygon Amoy',      type: 'Testnet', color: '#A855F7', symbol: 'MATIC', iconUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png' },
  'Arbitrum Sepolia': { name: 'Arbitrum Sepolia',  type: 'Testnet', color: '#60A5FA', symbol: 'ETH', iconUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png' },
  'Base Sepolia':     { name: 'Base Sepolia',      type: 'Testnet', color: '#0052FF', symbol: 'ETH', iconUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png' },
  'Optimism Sepolia': { name: 'Optimism Sepolia',  type: 'Testnet', color: '#FF0420', symbol: 'ETH', iconUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png' },
  TRON:               { name: 'TRON',              type: 'Mainnet', color: '#EF0027', symbol: 'TRX', iconUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/tron/info/logo.png' },
  'TRON Nile':        { name: 'TRON Nile',         type: 'Testnet', color: '#FF6B6B', symbol: 'TRX', iconUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/tron/info/logo.png' },
  Solana:             { name: 'Solana',            type: 'Mainnet', color: '#9945FF', symbol: 'SOL', iconUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png' },
  'Solana Devnet':    { name: 'Solana Devnet',     type: 'Testnet', color: '#14F195', symbol: 'SOL', iconUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png' },
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

