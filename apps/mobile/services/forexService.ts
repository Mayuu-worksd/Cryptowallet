/**
 * forexService.ts
 * Single source of truth for live fiat exchange rates.
 *
 * Priority chain:
 *   1. ExchangeRate-API (free, no key required for open endpoint)
 *   2. Open Exchange Rates (requires EXPO_PUBLIC_OXR_APP_ID)
 *   3. Latest rates already stored in Supabase fiat_currencies table
 *   4. Built-in emergency fallback (last-resort only)
 *
 * Rates are always relative to 1 USD.
 */

import { supabase } from './supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface FiatRate {
  code: string;
  symbol: string;
  name: string;
  rate: number;   // units of this currency per 1 USD
  locale: string;
  format: string;
  flag: string;
}

// ─── Currency metadata (symbol / name / locale) ───────────────────────────────
// Rate values here are ONLY used as absolute last-resort emergency fallback.
// They are intentionally approximate and will be overwritten by live data.
const CURRENCY_META: Record<string, Omit<FiatRate, 'rate'>> = {
  USD: { code: 'USD', symbol: '$',    name: 'US Dollar',           locale: 'en-US', format: 'en-US', flag: '🇺🇸' },
  EUR: { code: 'EUR', symbol: '€',    name: 'Euro',                locale: 'de-DE', format: 'de-DE', flag: '🇪🇺' },
  GBP: { code: 'GBP', symbol: '£',    name: 'British Pound',       locale: 'en-GB', format: 'en-GB', flag: '🇬🇧' },
  INR: { code: 'INR', symbol: '₹',    name: 'Indian Rupee',        locale: 'en-IN', format: 'en-IN', flag: '🇮🇳' },
  AED: { code: 'AED', symbol: 'AED',  name: 'UAE Dirham',          locale: 'en-US', format: 'en-US', flag: '🇦🇪' },
  PKR: { code: 'PKR', symbol: '₨',    name: 'Pakistani Rupee',     locale: 'ur-PK', format: 'ur-PK', flag: '🇵🇰' },
  VND: { code: 'VND', symbol: '₫',    name: 'Vietnamese Dong',     locale: 'vi-VN', format: 'vi-VN', flag: '🇻🇳' },
  CNY: { code: 'CNY', symbol: '¥',    name: 'Chinese Yuan',        locale: 'zh-CN', format: 'zh-CN', flag: '🇨🇳' },
  RUB: { code: 'RUB', symbol: '₽',    name: 'Russian Ruble',       locale: 'ru-RU', format: 'ru-RU', flag: '🇷🇺' },
  UZS: { code: 'UZS', symbol: 'UZS',  name: 'Uzbekistan Som',      locale: 'uz-UZ', format: 'uz-UZ', flag: '🇺🇿' },
  IDR: { code: 'IDR', symbol: 'Rp',   name: 'Indonesian Rupiah',   locale: 'id-ID', format: 'id-ID', flag: '🇮🇩' },
  PHP: { code: 'PHP', symbol: '₱',    name: 'Philippine Peso',     locale: 'fil-PH',format: 'fil-PH',flag: '🇵🇭' },
  THB: { code: 'THB', symbol: '฿',    name: 'Thai Baht',           locale: 'th-TH', format: 'th-TH', flag: '🇹🇭' },
  AUD: { code: 'AUD', symbol: 'A$',   name: 'Australian Dollar',   locale: 'en-AU', format: 'en-AU', flag: '🇦🇺' },
  SGD: { code: 'SGD', symbol: 'S$',   name: 'Singapore Dollar',    locale: 'en-SG', format: 'en-SG', flag: '🇸🇬' },
  BHD: { code: 'BHD', symbol: 'BD',   name: 'Bahraini Dinar',      locale: 'en-US', format: 'en-US', flag: '🇧🇭' },
  SAR: { code: 'SAR', symbol: '﷼',    name: 'Saudi Riyal',         locale: 'ar-SA', format: 'ar-SA', flag: '🇸🇦' },
  KWD: { code: 'KWD', symbol: 'KD',   name: 'Kuwaiti Dinar',       locale: 'en-US', format: 'en-US', flag: '🇰🇼' },
  JPY: { code: 'JPY', symbol: '¥',    name: 'Japanese Yen',        locale: 'ja-JP', format: 'ja-JP', flag: '🇯🇵' },
  HKD: { code: 'HKD', symbol: 'HK$',  name: 'Hong Kong Dollar',    locale: 'zh-HK', format: 'zh-HK', flag: '🇭🇰' },
};

// Emergency fallback rates — approximate values used only when ALL live sources fail.
const EMERGENCY_RATES: Record<string, number> = {
  USD: 1.0,    EUR: 0.92,   GBP: 0.79,   INR: 84.0,
  AED: 3.6725, PKR: 280.0,  VND: 25400,  CNY: 7.24,
  RUB: 90.0,   UZS: 12700,  IDR: 16400,  PHP: 58.5,
  THB: 36.5,   AUD: 1.53,   SGD: 1.34,   BHD: 0.376,
  SAR: 3.75,   KWD: 0.307,  JPY: 149.0,  HKD: 7.82,
};

// Supported currency codes — only these are fetched and stored
const SUPPORTED_CODES = Object.keys(CURRENCY_META);

// ─── In-memory cache ──────────────────────────────────────────────────────────
let memCache: { rates: Record<string, FiatRate>; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildRateMap(rawRates: Record<string, number>): Record<string, FiatRate> {
  const result: Record<string, FiatRate> = {};
  for (const code of SUPPORTED_CODES) {
    const meta = CURRENCY_META[code];
    const rate = rawRates[code];
    if (meta && typeof rate === 'number' && rate > 0) {
      result[code] = { ...meta, rate };
    }
  }
  return result;
}

function buildEmergencyRates(): Record<string, FiatRate> {
  return buildRateMap(EMERGENCY_RATES);
}

// ─── Source 1: ExchangeRate-API (free open endpoint, no key) ─────────────────
async function fetchFromExchangeRateAPI(): Promise<Record<string, number>> {
  const key = process.env.EXPO_PUBLIC_EXCHANGERATE_KEY;
  const url = key
    ? `https://v6.exchangerate-api.com/v6/${key}/latest/USD`
    : 'https://open.er-api.com/v6/latest/USD';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`ExchangeRate-API ${res.status}`);
    const json = await res.json();
    const raw: Record<string, number> = json.rates ?? json.conversion_rates ?? {};
    if (!raw.USD) throw new Error('Invalid response shape');
    return raw;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Source 2: Open Exchange Rates (requires app_id) ─────────────────────────
async function fetchFromOpenExchangeRates(): Promise<Record<string, number>> {
  const appId = process.env.EXPO_PUBLIC_OXR_APP_ID;
  if (!appId) throw new Error('No OXR app id configured');
  const url = `https://openexchangerates.org/api/latest.json?app_id=${appId}&base=USD`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`OXR ${res.status}`);
    const json = await res.json();
    if (!json.rates) throw new Error('Invalid OXR response');
    return json.rates as Record<string, number>;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Source 3: Supabase fiat_currencies table ─────────────────────────────────
async function fetchFromSupabase(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('fiat_currencies')
    .select('code, rate')
    .eq('is_enabled', true);
  if (error || !data || data.length === 0) throw new Error('Supabase fiat_currencies empty');
  const raw: Record<string, number> = {};
  data.forEach((row: any) => {
    if (row.code && typeof row.rate === 'number' && row.rate > 0) {
      raw[row.code] = row.rate;
    }
  });
  if (!raw.USD) raw.USD = 1.0;
  return raw;
}

// ─── Write live rates back to Supabase ───────────────────────────────────────
async function persistToSupabase(rates: Record<string, FiatRate>): Promise<void> {
  try {
    const rows = Object.values(rates).map(r => ({
      code: r.code,
      symbol: r.symbol,
      name: r.name,
      rate: r.rate,
      locale: r.locale,
      format: r.format,
      is_enabled: true,
      updated_at: new Date().toISOString(),
    }));
    await supabase
      .from('fiat_currencies')
      .upsert(rows, { onConflict: 'code' });
  } catch (e) {
    console.warn('[forexService] Failed to persist rates to Supabase:', e);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns live fiat rates keyed by currency code.
 * Uses in-memory cache; only fetches when cache is stale (>30 min).
 * Falls back through: ExchangeRate-API → OXR → Supabase → emergency hardcoded.
 */
export async function getLiveRates(forceRefresh = false): Promise<Record<string, FiatRate>> {
  if (!forceRefresh && memCache && Date.now() - memCache.fetchedAt < CACHE_TTL_MS) {
    return memCache.rates;
  }

  let rawRates: Record<string, number> | null = null;
  let source = 'unknown';

  // Try live APIs first
  try {
    rawRates = await fetchFromExchangeRateAPI();
    source = 'ExchangeRate-API';
  } catch (e1) {
    console.warn('[forexService] ExchangeRate-API failed:', e1);
    try {
      rawRates = await fetchFromOpenExchangeRates();
      source = 'OpenExchangeRates';
    } catch (e2) {
      console.warn('[forexService] OXR failed:', e2);
    }
  }

  // If live APIs failed, fall back to Supabase
  if (!rawRates) {
    try {
      rawRates = await fetchFromSupabase();
      source = 'Supabase';
    } catch (e3) {
      console.warn('[forexService] Supabase fallback failed:', e3);
    }
  }

  // Last resort: emergency hardcoded rates
  if (!rawRates) {
    console.warn('[forexService] All sources failed — using emergency rates');
    const emergency = buildEmergencyRates();
    memCache = { rates: emergency, fetchedAt: Date.now() - CACHE_TTL_MS + 60_000 }; // expire in 1 min so it retries soon
    return emergency;
  }

  const rates = buildRateMap(rawRates);
  memCache = { rates, fetchedAt: Date.now() };

  console.log(`[forexService] Rates loaded from ${source}. USD→INR: ${rawRates.INR}, USD→AED: ${rawRates.AED}, USD→PKR: ${rawRates.PKR}, USD→VND: ${rawRates.VND}`);

  // Write back to Supabase asynchronously (fire-and-forget) when source was a live API
  if (source !== 'Supabase') {
    persistToSupabase(rates);
  }

  return rates;
}

/**
 * Invalidates the in-memory cache so the next call to getLiveRates() fetches fresh data.
 */
export function invalidateForexCache(): void {
  memCache = null;
}
