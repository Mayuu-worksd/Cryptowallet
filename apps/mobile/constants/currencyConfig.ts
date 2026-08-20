export interface FiatCurrency {
  code: string;
  symbol: string;
  name: string;
  rate: number; // exchange rate relative to 1 USD
  locale: string;
  format: string; // formatting style
  flag?: string; // country flag emoji
}

export interface TokenConfig {
  symbol: string;
  name: string;
  coingeckoId: string;
  color: string;
  iconUrl: string;
  decimals: number;
}


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
  INRX: {
    symbol: 'INRX',
    name: 'Indian Rupee Token',
    coingeckoId: 'inrx',
    color: '#FF9933',
    iconUrl: 'https://flagcdn.com/w160/in.png',
    decimals: 6,
  },
  THB: {
    symbol: 'THB',
    name: 'Thai Baht',
    coingeckoId: 'thai-baht',
    color: '#0288D1',
    iconUrl: 'https://flagcdn.com/w160/th.png',
    decimals: 6,
  },
  PKR: {
    symbol: 'PKR',
    name: 'Pakistani Rupee',
    coingeckoId: 'pakistani-rupee',
    color: '#116633',
    iconUrl: 'https://flagcdn.com/w160/pk.png',
    decimals: 6,
  },
  AED: {
    symbol: 'AED',
    name: 'UAE Dirham',
    coingeckoId: 'united-arab-emirates-dirham',
    color: '#00732F',
    iconUrl: 'https://flagcdn.com/w160/ae.png',
    decimals: 6,
  },
  CNY: {
    symbol: 'CNY',
    name: 'Chinese Yuan',
    coingeckoId: 'chinese-yuan',
    color: '#DE2910',
    iconUrl: 'https://flagcdn.com/w160/cn.png',
    decimals: 6,
  },
  RUB: {
    symbol: 'RUB',
    name: 'Russian Ruble',
    coingeckoId: 'russian-ruble',
    color: '#1C3578',
    iconUrl: 'https://flagcdn.com/w160/ru.png',
    decimals: 6,
  },
  UZS: {
    symbol: 'UZS',
    name: 'Uzbekistani Som',
    coingeckoId: 'uzbekistan-som',
    color: '#0099B5',
    iconUrl: 'https://flagcdn.com/w160/uz.png',
    decimals: 6,
  },
  VND: {
    symbol: 'VND',
    name: 'Vietnamese Dong',
    coingeckoId: 'vietnamese-dong',
    color: '#DA251D',
    iconUrl: 'https://flagcdn.com/w160/vn.png',
    decimals: 6,
  },
  IDR: {
    symbol: 'IDR',
    name: 'Indonesian Rupiah',
    coingeckoId: 'indonesian-rupiah',
    color: '#CE1126',
    iconUrl: 'https://flagcdn.com/w160/id.png',
    decimals: 6,
  },
  PHP: {
    symbol: 'PHP',
    name: 'Philippine Peso',
    coingeckoId: 'philippine-peso',
    color: '#0038A8',
    iconUrl: 'https://flagcdn.com/w160/ph.png',
    decimals: 6,
  },
  USDT_TRC20: {
    symbol: 'USDT',
    name: 'Tether (TRC20)',
    coingeckoId: 'tether',
    color: '#26A17B',
    iconUrl: 'https://assets.coingecko.com/coins/images/325/large/Tether.png?v=2',
    decimals: 6,
  },
  USDC_TRC20: {
    symbol: 'USDC',
    name: 'USD Coin (TRC20)',
    coingeckoId: 'usd-coin',
    color: '#2775CA',
    iconUrl: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png?v=2',
    decimals: 6,
  },
};

