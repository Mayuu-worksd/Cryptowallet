const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin,tether,usd-coin,dai,solana,matic-network,binancecoin&vs_currencies=usd&include_24hr_change=true';

const COINGECKO_NEWS_URL =
  'https://api.coingecko.com/api/v3/news?per_page=10';

// Strict allowlist — only these hostnames are ever fetched
const ALLOWED_DOMAINS = ['api.rss2json.com', 'api.coingecko.com'];

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      ALLOWED_DOMAINS.some(d => parsed.hostname === d)
    );
  } catch {
    return false;
  }
}

// Fallback RSS feeds via rss2json
const RSS_FEEDS = [
  { url: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fcointelegraph.com%2Frss&count=10', source: 'CoinTelegraph' },
  { url: 'https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fbitcoinist.com%2Ffeed%2F&count=10', source: 'Bitcoinist' },
];

export type LivePrices = Record<string, { usd: number; usd_24h_change: number }>;

export type NewsItem = {
  id: number;
  title: string;
  url: string;
  published_at: string;
  source: { title: string };
  thumbnail?: string;
};

const ID_TO_SYMBOL: Record<string, string> = {
  ethereum:        'ETH',
  bitcoin:         'BTC',
  tether:          'USDT',
  'usd-coin':      'USDC',
  dai:             'DAI',
  solana:          'SOL',
  'matic-network': 'MATIC',
  binancecoin:     'BNB',
};

const STATIC_NEWS: NewsItem[] = [
  {
    id: 1,
    title: 'Bitcoin Continues to Dominate Crypto Market Cap',
    url: 'https://coinmarketcap.com/headlines/news/',
    published_at: new Date().toISOString(),
    source: { title: 'CoinMarketCap' },
    thumbnail: '',
  },
  {
    id: 2,
    title: 'Ethereum Layer 2 Solutions See Record Transaction Volume',
    url: 'https://ethereum.org/en/layer-2/',
    published_at: new Date(Date.now() - 3_600_000).toISOString(),
    source: { title: 'Ethereum.org' },
    thumbnail: '',
  },
  {
    id: 3,
    title: 'DeFi Total Value Locked Reaches New Milestones in 2024',
    url: 'https://defillama.com/',
    published_at: new Date(Date.now() - 7_200_000).toISOString(),
    source: { title: 'DeFi Llama' },
    thumbnail: '',
  },
  {
    id: 4,
    title: 'Polygon Network Upgrades Boost Transaction Speeds',
    url: 'https://polygon.technology/',
    published_at: new Date(Date.now() - 10_800_000).toISOString(),
    source: { title: 'Polygon' },
    thumbnail: '',
  },
  {
    id: 5,
    title: 'Crypto Adoption Growing Across Emerging Markets',
    url: 'https://coinmarketcap.com/',
    published_at: new Date(Date.now() - 14_400_000).toISOString(),
    source: { title: 'CoinMarketCap' },
    thumbnail: '',
  },
];

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  // SSRF guard: reject any URL not on the allowlist before making the request
  if (!isSafeUrl(url)) throw new Error(`Blocked unsafe URL: ${url}`);
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export const marketService = {
  async fetchPrices(): Promise<Record<string, { usd: number; change24h: number }>> {
    const res = await fetchWithTimeout(COINGECKO_URL);
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data: LivePrices = await res.json();
    const result: Record<string, { usd: number; change24h: number }> = {};
    for (const [id, val] of Object.entries(data)) {
      const sym = ID_TO_SYMBOL[id];
      if (sym && val.usd > 0) result[sym] = { usd: val.usd, change24h: val.usd_24h_change ?? 0 };
    }
    if (Object.keys(result).length === 0) throw new Error('Empty price response');
    return result;
  },

  async fetchNews(): Promise<NewsItem[]> {
    // 1. Try CoinGecko news API first
    try {
      const res = await fetchWithTimeout(COINGECKO_NEWS_URL, 8000);
      if (res.ok) {
        const data = await res.json();
        const items = (data.data ?? data ?? []) as any[];
        if (items.length > 0) {
          const mapped: NewsItem[] = items.slice(0, 10).map((item: any, i: number) => ({
            id: i,
            title: (item.title ?? item.name ?? '').trim(),
            url: item.url ?? item.news_url ?? '',
            published_at: item.updated_at
              ? new Date(item.updated_at * 1000).toISOString()
              : (item.created_at ? new Date(item.created_at * 1000).toISOString() : new Date().toISOString()),
            source: { title: item.author ?? item.source ?? 'CoinGecko' },
            thumbnail: item.thumb_2x ?? item.image ?? '',
          })).filter(n => n.title.length > 5 && n.url.length > 0);
          if (mapped.length > 0) return mapped;
        }
      }
    } catch { /* fall through */ }

    // 2. Try RSS feeds
    for (const feed of RSS_FEEDS) {
      if (!isSafeUrl(feed.url)) continue;
      try {
        const res = await fetchWithTimeout(feed.url, 8000);
        if (!res.ok) continue;
        const data = await res.json();
        const items = (data.items ?? []) as any[];
        if (items.length === 0) continue;
        const mapped: NewsItem[] = items.slice(0, 10).map((item: any, i: number) => ({
          id: i,
          title: (item.title ?? '').trim().replace(/&amp;/g, '&').replace(/&#8217;/g, "'").replace(/&#8216;/g, "'"),
          url: (() => {
            try {
              const u = new URL(item.link ?? '');
              return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : '';
            } catch { return ''; }
          })(),
          published_at: item.pubDate ?? new Date().toISOString(),
          source: { title: feed.source },
          thumbnail: item.thumbnail || item.enclosure?.link || '',
        })).filter(n => n.title.length > 5 && n.url.length > 0);
        if (mapped.length > 0) return mapped;
      } catch { continue; }
    }

    // 3. Static fallback
    return STATIC_NEWS;
  },
};
