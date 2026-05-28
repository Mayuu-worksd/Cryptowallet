export interface FiatCurrency {
  code: string;
  symbol: string;
  name: string;
  rate: number; // exchange rate relative to 1 USD
  locale: string;
  format: string; // formatting style
}

export interface TokenConfig {
  symbol: string;
  name: string;
  coingeckoId: string;
  color: string;
  iconUrl: string;
  decimals: number;
}

export const SUPPORTED_FIAT_CURRENCIES: Record<string, FiatCurrency> = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', rate: 1.0, locale: 'en-US', format: 'en-US' },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', rate: 83.5, locale: 'en-IN', format: 'en-IN' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', rate: 0.92, locale: 'de-DE', format: 'de-DE' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', rate: 0.79, locale: 'en-GB', format: 'en-GB' },
  AED: { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', rate: 3.67, locale: 'ar-AE', format: 'ar-AE' },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', rate: 1.51, locale: 'en-AU', format: 'en-AU' },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', rate: 1.35, locale: 'en-SG', format: 'en-SG' },
  RUB: { code: 'RUB', symbol: '₽', name: 'Russian Ruble', rate: 90.0, locale: 'ru-RU', format: 'ru-RU' },
  BHD: { code: 'BHD', symbol: 'د.ب', name: 'Bahraini Dinar', rate: 0.38, locale: 'ar-BH', format: 'ar-BH' },
  VND: { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', rate: 25400.0, locale: 'vi-VN', format: 'vi-VN' },
  SAR: { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal', rate: 3.75, locale: 'ar-SA', format: 'ar-SA' },
  KWD: { code: 'KWD', symbol: 'KD', name: 'Kuwaiti Dinar', rate: 0.31, locale: 'ar-KW', format: 'ar-KW' },
  THB: { code: 'THB', symbol: '฿', name: 'Thai Baht', rate: 36.5, locale: 'th-TH', format: 'th-TH' },
};

export const SUPPORTED_TOKENS: Record<string, TokenConfig> = {
  USDT: {
    symbol: 'USDT',
    name: 'Tether',
    coingeckoId: 'tether',
    color: '#26A17B',
    iconUrl: 'https://assets.coingecko.com/coins/images/325/large/Tether.png?v=2',
    decimals: 6,
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    coingeckoId: 'usd-coin',
    color: '#2775CA',
    iconUrl: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png?v=2',
    decimals: 6,
  },
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    coingeckoId: 'ethereum',
    color: '#627EEA',
    iconUrl: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png?v=2',
    decimals: 18,
  },
  BTC: {
    symbol: 'BTC',
    name: 'Bitcoin',
    coingeckoId: 'bitcoin',
    color: '#F7931A',
    iconUrl: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png?v=2',
    decimals: 8,
  },
  SOL: {
    symbol: 'SOL',
    name: 'Solana',
    coingeckoId: 'solana',
    color: '#9945FF',
    iconUrl: 'https://assets.coingecko.com/coins/images/4128/large/solana.png?v=2',
    decimals: 9,
  },
  BNB: {
    symbol: 'BNB',
    name: 'BNB',
    coingeckoId: 'binancecoin',
    color: '#F3BA2F',
    iconUrl: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png?v=2',
    decimals: 18,
  },
  XRP: {
    symbol: 'XRP',
    name: 'Ripple',
    coingeckoId: 'ripple',
    color: '#346AA9',
    iconUrl: 'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png?v=2',
    decimals: 6,
  },
  TON: {
    symbol: 'TON',
    name: 'Toncoin',
    coingeckoId: 'the-open-network',
    color: '#0088CC',
    iconUrl: 'https://assets.coingecko.com/coins/images/17980/large/ton_symbol.png?v=2',
    decimals: 9,
  },
  TRX: {
    symbol: 'TRX',
    name: 'TRON',
    coingeckoId: 'tron',
    color: '#EF0027',
    iconUrl: 'https://assets.coingecko.com/coins/images/1094/large/tron-logo.png?v=2',
    decimals: 6,
  },
  SUI: {
    symbol: 'SUI',
    name: 'Sui',
    coingeckoId: 'sui',
    color: '#6FBCF0',
    iconUrl: 'https://assets.coingecko.com/coins/images/26375/large/sui_asset.jpeg?v=2',
    decimals: 9,
  },
};
