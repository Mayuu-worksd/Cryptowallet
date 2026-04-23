const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin,tether,usd-coin,dai,solana,matic-network,binancecoin&vs_currencies=usd&include_24hr_change=true';

const COINGECKO_NEWS_URL =
  'https://api.coingecko.com/api/v3/news?per_page=10';

const ALLOWED_DOMAINS = ['api.rss2json.com', 'api.coingecko.com'];

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ALLOWED_DOMAINS.some(d => parsed.hostname === d);
  } catch { return false; }
}

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
  { id: 1, title: 'Bitcoin Continues to Dominate Crypto Market Cap',            url: 'https://coinmarketcap.com/headlines/news/', published_at: new Date().toISOString(),                          source: { title: 'CoinMarketCap' }, thumbnail: '' },
  { id: 2, title: 'Ethereum Layer 2 Solutions See Record Transaction Volume',    url: 'https://ethereum.org/en/layer-2/',         published_at: new Date(Date.now() - 3_600_000).toISOString(),   source: { title: 'Ethereum.org'  }, thumbnail: '' },
  { id: 3, title: 'DeFi Total Value Locked Reaches New Milestones in 2024',     url: 'https://defillama.com/',                   published_at: new Date(Date.now() - 7_200_000).toISOString(),   source: { title: 'DeFi Llama'    }, thumbnail: '' },
  { id: 4, title: 'Polygon Network Upgrades Boost Transaction Speeds',          url: 'https://polygon.technology/',              published_at: new Date(Date.now() - 10_800_000).toISOString(),  source: { title: 'Polygon'       }, thumbnail: '' },
  { id: 5, title: 'Crypto Adoption Growing Across Emerging Markets',            url: 'https://coinmarketcap.com/',               published_at: new Date(Date.now() - 14_400_000).toISOString(),  source: { title: 'CoinMarketCap' }, thumbnail: '' },
];

// ─── In-memory cache — prevents hammering CoinGecko ──────────────────────────
const PRICE_CACHE_TTL  = 60_000;  // 60s — CoinGecko free tier allows ~30 req/min
const NEWS_CACHE_TTL   = 300_000; // 5 min — news doesn't change that fast

let priceCache: { data: Record<string, { usd: number; change24h: number }>; ts: number } | null = null;
let newsCache:  { data: NewsItem[]; ts: number } | null = null;
let priceInflight: Promise<Record<string, { usd: number; change24h: number }>> | null = null;

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
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
    // Return cache if still fresh
    if (priceCache && Date.now() - priceCache.ts < PRICE_CACHE_TTL) {
      console.log('[MarketService] prices from cache');
      return priceCache.data;
    }

    // Deduplicate concurrent calls — only one fetch in flight at a time
    if (priceInflight) {
      console.log('[MarketService] prices deduped — waiting for inflight request');
      return priceInflight;
    }

    priceInflight = (async () => {
      try {
        console.log('[MarketService] fetching live prices from CoinGecko...');
        const res = await fetchWithTimeout(COINGECKO_URL);
        if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
        const data: LivePrices = await res.json();
        const result: Record<string, { usd: number; change24h: number }> = {};
        for (const [id, val] of Object.entries(data)) {
          const sym = ID_TO_SYMBOL[id];
          if (sym && val.usd > 0) result[sym] = { usd: val.usd, change24h: val.usd_24h_change ?? 0 };
        }
        if (Object.keys(result).length === 0) throw new Error('Empty price response');
        priceCache = { data: result, ts: Date.now() };
        console.log(`[MarketService] prices updated — ${Object.keys(result).join(', ')}`);
        return result;
      } finally {
        priceInflight = null;
      }
    })();

    return priceInflight;
  },

  async fetchNews(): Promise<NewsItem[]> {
    // Return cache if still fresh
    if (newsCache && Date.now() - newsCache.ts < NEWS_CACHE_TTL) {
      console.log('[MarketService] news from cache');
      return newsCache.data;
    }

    // 1. Try CoinGecko news
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
          if (mapped.length > 0) {
            newsCache = { data: mapped, ts: Date.now() };
            return mapped;
          }
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
        if (mapped.length > 0) {
          newsCache = { data: mapped, ts: Date.now() };
          return mapped;
        }
      } catch { continue; }
    }

    // 3. Static fallback
    return STATIC_NEWS;
  },
};
