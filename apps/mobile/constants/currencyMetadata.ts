import getSymbolFromCurrency from 'currency-symbol-map';

export interface CurrencyMetadata {
  name: string;             // Asset name: "Thai Baht"
  tokenSymbol: string;      // Token symbol: "THB"
  fiatCode: string;         // Fiat currency code: "THB"
  symbol: string;           // Currency symbol: "฿"
  decimals: number;         // Decimal precision: 6
  network: string;          // Network: "Sepolia" or "Polygon" etc.
  contractAddress: string;  // Contract address
  assetType: 'crypto' | 'fiat-backed-token' | 'stablecoin' | 'fiat';
  icon: string;             // Flag emoji or asset URL
}

export const CENTRALIZED_METADATA: Record<string, CurrencyMetadata> = {
  USD: {
    name: 'US Dollar',
    tokenSymbol: 'USDC',
    fiatCode: 'USD',
    symbol: '$',
    decimals: 6,
    network: 'Sepolia',
    contractAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    assetType: 'fiat',
    icon: '🇺🇸',
  },
  EUR: {
    name: 'Euro',
    tokenSymbol: 'EUR',
    fiatCode: 'EUR',
    symbol: '€',
    decimals: 18,
    network: 'Sepolia',
    contractAddress: '',
    assetType: 'fiat',
    icon: '🇪🇺',
  },
  GBP: {
    name: 'British Pound',
    tokenSymbol: 'GBP',
    fiatCode: 'GBP',
    symbol: '£',
    decimals: 18,
    network: 'Sepolia',
    contractAddress: '',
    assetType: 'fiat',
    icon: '🇬🇧',
  },
  INR: {
    name: 'Indian Rupee',
    tokenSymbol: 'INRX',
    fiatCode: 'INR',
    symbol: '₹',
    decimals: 6,
    network: 'Sepolia',
    contractAddress: '0x51A5F24560547f587999c331788aC495D40d95ba',
    assetType: 'fiat-backed-token',
    icon: '🇮🇳',
  },
  THB: {
    name: 'Thai Baht',
    tokenSymbol: 'THB',
    fiatCode: 'THB',
    symbol: '฿',
    decimals: 6,
    network: 'Sepolia',
    contractAddress: '0x288cd557B7EF9CF317DbEC59d425C23913ab6BeB',
    assetType: 'fiat-backed-token',
    icon: '🇹🇭',
  },
  PKR: {
    name: 'Pakistani Rupee',
    tokenSymbol: 'PKR',
    fiatCode: 'PKR',
    symbol: '₨',
    decimals: 6,
    network: 'Sepolia',
    contractAddress: '0x578ec408f942bb1F49fc8720837dAB2B563edc35',
    assetType: 'fiat-backed-token',
    icon: '🇵🇰',
  },
  AED: {
    name: 'UAE Dirham',
    tokenSymbol: 'AED',
    fiatCode: 'AED',
    symbol: 'د.إ',
    decimals: 6,
    network: 'Sepolia',
    contractAddress: '0xaa0c9c354Ca420Cf500169C36d8C227B1B714c3f',
    assetType: 'fiat-backed-token',
    icon: '🇦🇪',
  },
  CNY: {
    name: 'Chinese Yuan',
    tokenSymbol: 'CNY',
    fiatCode: 'CNY',
    symbol: '¥',
    decimals: 6,
    network: 'Sepolia',
    contractAddress: '0x4f16cC563c2Efe0f40F6f28920Ea46413FeaCBe2',
    assetType: 'fiat-backed-token',
    icon: '🇨🇳',
  },
  RUB: {
    name: 'Russian Ruble',
    tokenSymbol: 'RUB',
    fiatCode: 'RUB',
    symbol: '₽',
    decimals: 6,
    network: 'Sepolia',
    contractAddress: '0xc81770B4a5d63889f60ee75DAe531bE3F8E216d4',
    assetType: 'fiat-backed-token',
    icon: '🇷🇺',
  },
  UZS: {
    name: 'Uzbekistani Som',
    tokenSymbol: 'UZS',
    fiatCode: 'UZS',
    symbol: "so'm",
    decimals: 6,
    network: 'Sepolia',
    contractAddress: '0xa965bE90e96DfEb456abEa0dAa1C010246b9fffa',
    assetType: 'fiat-backed-token',
    icon: '🇺🇿',
  },
  VND: {
    name: 'Vietnamese Dong',
    tokenSymbol: 'VND',
    fiatCode: 'VND',
    symbol: '₫',
    decimals: 6,
    network: 'Sepolia',
    contractAddress: '0xC005804dE4d748eC57A637e3DC689F9038baDd59',
    assetType: 'fiat-backed-token',
    icon: '🇻🇳',
  },
  IDR: {
    name: 'Indonesian Rupiah',
    tokenSymbol: 'IDR',
    fiatCode: 'IDR',
    symbol: 'Rp',
    decimals: 6,
    network: 'Sepolia',
    contractAddress: '0xd255112177C674555983687A1FcfF8bC95a35443',
    assetType: 'fiat-backed-token',
    icon: '🇮🇩',
  },
  PHP: {
    name: 'Philippine Peso',
    tokenSymbol: 'PHP',
    fiatCode: 'PHP',
    symbol: '₱',
    decimals: 6,
    network: 'Sepolia',
    contractAddress: '0x842ba319242f3F1598D7E2D26eBb4659A42F05Cc',
    assetType: 'fiat-backed-token',
    icon: '🇵🇭',
  },
};

/**
 * Retrieve metadata for a currency code (fiat code or token symbol).
 */
export function getCurrencyMetadata(code: string): CurrencyMetadata | undefined {
  if (!code) return undefined;
  const upper = code.toUpperCase();
  // Try matching by fiatCode first
  if (CENTRALIZED_METADATA[upper]) return CENTRALIZED_METADATA[upper];
  // If not found, search by tokenSymbol
  return Object.values(CENTRALIZED_METADATA).find(m => m.tokenSymbol === upper);
}

/**
 * Retrieve the symbol for a currency code, falling back dynamically.
 */
export function getCurrencySymbol(code: string): string {
  const meta = getCurrencyMetadata(code);
  if (meta) return meta.symbol;
  return getSymbolFromCurrency(code) || code;
}

/**
 * Retrieve the icon (flag emoji or URL) for a currency code.
 */
export function getCurrencyIcon(code: string): string {
  const meta = getCurrencyMetadata(code);
  if (meta) return meta.icon;
  return '💵';
}
