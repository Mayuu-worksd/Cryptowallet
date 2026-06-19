'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Save, Loader2, AlertCircle, CheckCircle, ToggleLeft, ToggleRight, Coins } from 'lucide-react';

// ─── Static token / fiat definitions (mirrors mobile currencyConfig.ts) ────────

const SETTLEMENT_TOKENS = [
  { code: 'USDT', name: 'Tether',         color: '#26A17B', icon: 'https://assets.coingecko.com/coins/images/325/large/Tether.png' },
  { code: 'USDC', name: 'USD Coin',        color: '#2775CA', icon: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png' },
  { code: 'ETH',  name: 'Ethereum',        color: '#627EEA', icon: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png' },
  { code: 'BTC',  name: 'Bitcoin',         color: '#F7931A', icon: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png' },
  { code: 'BNB',  name: 'BNB',             color: '#F3BA2F', icon: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png' },
  { code: 'TRX',  name: 'TRON',            color: '#EF0027', icon: 'https://assets.coingecko.com/coins/images/1094/large/tron-logo.png' },
  { code: 'SOL',  name: 'Solana',          color: '#9945FF', icon: 'https://assets.coingecko.com/coins/images/4128/large/solana.png' },
  { code: 'XRP',  name: 'Ripple',          color: '#346AA9', icon: 'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png' },
  { code: 'TON',  name: 'Toncoin',         color: '#0088CC', icon: 'https://assets.coingecko.com/coins/images/17980/large/ton_symbol.png' },
  { code: 'SUI',  name: 'Sui',             color: '#6FBCF0', icon: 'https://assets.coingecko.com/coins/images/26375/large/sui_asset.jpeg' },
];

const FIAT_CURRENCIES = [
  { code: 'USD', name: 'US Dollar',        iso2: 'us',  symbol: '$' },
  { code: 'EUR', name: 'Euro',             iso2: 'eu',  symbol: '€' },
  { code: 'GBP', name: 'British Pound',    iso2: 'gb',  symbol: '£' },
  { code: 'INR', name: 'Indian Rupee',     iso2: 'in',  symbol: '₹' },
  { code: 'AED', name: 'UAE Dirham',       iso2: 'ae',  symbol: 'د.إ' },
  { code: 'AUD', name: 'Australian Dollar',iso2: 'au',  symbol: 'A$' },
  { code: 'SGD', name: 'Singapore Dollar', iso2: 'sg',  symbol: 'S$' },
  { code: 'SAR', name: 'Saudi Riyal',      iso2: 'sa',  symbol: '﷼' },
  { code: 'KWD', name: 'Kuwaiti Dinar',    iso2: 'kw',  symbol: 'KD' },
  { code: 'BHD', name: 'Bahraini Dinar',   iso2: 'bh',  symbol: 'BD' },
  { code: 'THB', name: 'Thai Baht',        iso2: 'th',  symbol: '฿' },
  { code: 'VND', name: 'Vietnamese Dong',  iso2: 'vn',  symbol: '₫' },
  { code: 'RUB', name: 'Russian Ruble',    iso2: 'ru',  symbol: '₽' },
  { code: 'JPY', name: 'Japanese Yen',     iso2: 'jp',  symbol: '¥' },
  { code: 'HKD', name: 'Hong Kong Dollar', iso2: 'hk',  symbol: 'HK$' },
];

const DB_KEY = 'card_currencies_config';

type CurrencyConfig = Record<string, boolean>;

export default function CardCurrenciesPage() {
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [message, setMessage]   = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [config, setConfig]     = useState<CurrencyConfig>({});
  const [search, setSearch]     = useState('');

  useEffect(() => { fetchConfig(); }, []);

  async function fetchConfig() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', DB_KEY)
        .maybeSingle();
      if (error) throw error;

      if (data?.value && typeof data.value === 'object') {
        setConfig(data.value as CurrencyConfig);
      } else {
        // First load — default everything to enabled
        const defaults: CurrencyConfig = {};
        [...SETTLEMENT_TOKENS, ...FIAT_CURRENCIES].forEach(c => { defaults[c.code] = true; });
        setConfig(defaults);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to load: ' + err.message });
    } finally {
      setLoading(false);
    }
  }

  function toggle(code: string) {
    setConfig(prev => ({ ...prev, [code]: !prev[code] }));
  }

  function setAllTokens(val: boolean) {
    setConfig(prev => {
      const next = { ...prev };
      SETTLEMENT_TOKENS.forEach(t => { next[t.code] = val; });
      return next;
    });
  }

  function setAllFiat(val: boolean) {
    setConfig(prev => {
      const next = { ...prev };
      FIAT_CURRENCIES.forEach(t => { next[t.code] = val; });
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const { error } = await supabase
        .from('admin_settings')
        .upsert({ key: DB_KEY, value: config }, { onConflict: 'key' });
      if (error) throw error;
      setMessage({ type: 'success', text: 'Card currency configuration saved. Changes will reflect in the mobile app immediately.' });
      setTimeout(() => setMessage(prev => prev?.type === 'success' ? null : prev), 5000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  const q = search.toLowerCase();
  const filteredTokens = SETTLEMENT_TOKENS.filter(t => t.code.toLowerCase().includes(q) || t.name.toLowerCase().includes(q));
  const filteredFiat   = FIAT_CURRENCIES.filter(t => t.code.toLowerCase().includes(q) || t.name.toLowerCase().includes(q));

  const enabledTokenCount = SETTLEMENT_TOKENS.filter(t => config[t.code] !== false).length;
  const enabledFiatCount  = FIAT_CURRENCIES.filter(t => config[t.code] !== false).length;

  return (
    <div className="space-y-8 animate-fade-in pb-12">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-3 border-[#1a1a1a] pb-6 bg-[#0055ff] p-6 text-white shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] border-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-display uppercase leading-none">Card Currency Manager</h1>
          <p className="text-xs font-bold font-mono uppercase tracking-wider mt-2">
            Enable or disable settlement tokens and fiat currencies for card transactions
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading || saving}
          className="self-start brutalist-button-white px-6 py-2.5 flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] hover:bg-[#1a1a1a] hover:text-white transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          <span>SAVE CHANGES</span>
        </button>
      </div>

      {/* ── Notification ── */}
      {message && (
        <div className={`p-4 border-2 border-[#1a1a1a] flex items-center gap-3 text-sm font-bold uppercase tracking-wider font-display shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] ${
          message.type === 'error' ? 'bg-[#e63b2e] text-white' : 'bg-[#00c853] text-[#1a1a1a]'
        }`}>
          {message.type === 'error' ? <AlertCircle className="h-5 w-5 shrink-0" /> : <CheckCircle className="h-5 w-5 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {loading ? (
        <div className="brutalist-card p-12 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#1a1a1a] mb-4" />
          <span className="font-bold font-display uppercase text-sm text-[#1a1a1a]">Loading configuration...</span>
        </div>
      ) : (
        <div className="space-y-8">

          {/* ── Stats bar ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Tokens Enabled"   value={`${enabledTokenCount} / ${SETTLEMENT_TOKENS.length}`} color="#0055ff" />
            <StatCard label="Fiat Enabled"      value={`${enabledFiatCount} / ${FIAT_CURRENCIES.length}`}  color="#00c853" />
            <StatCard label="Tokens Disabled"   value={`${SETTLEMENT_TOKENS.length - enabledTokenCount}`}  color="#e63b2e" />
            <StatCard label="Fiat Disabled"     value={`${FIAT_CURRENCIES.length - enabledFiatCount}`}     color="#ffcc00" />
          </div>

          {/* ── Search ── */}
          <div className="brutalist-card p-4">
            <input
              type="text"
              placeholder="Search currency or token name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full brutalist-input font-mono text-sm"
            />
          </div>

          {/* ── Settlement Tokens ── */}
          <div className="brutalist-card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-[#1a1a1a] pb-3 gap-3">
              <div className="flex items-center gap-2">
                <Coins className="h-6 w-6 text-[#0055ff]" />
                <h2 className="text-xl font-extrabold text-[#1a1a1a] font-display uppercase tracking-tight">
                  Settlement Tokens
                </h2>
                <span className="px-2 py-0.5 border border-[#1a1a1a] bg-[#f5f0e8] text-[10px] font-bold font-mono">
                  {enabledTokenCount}/{SETTLEMENT_TOKENS.length} ON
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setAllTokens(true)}  className="px-3 py-1 border-2 border-[#1a1a1a] bg-[#00c853] text-white text-xs font-bold font-display uppercase hover:opacity-80 transition-opacity">Enable All</button>
                <button onClick={() => setAllTokens(false)} className="px-3 py-1 border-2 border-[#1a1a1a] bg-[#e63b2e] text-white text-xs font-bold font-display uppercase hover:opacity-80 transition-opacity">Disable All</button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredTokens.map(token => {
                const enabled = config[token.code] !== false;
                return (
                  <CurrencyCard
                    key={token.code}
                    code={token.code}
                    name={token.name}
                    icon={<img src={token.icon} alt={token.code} className="w-9 h-9 rounded-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />}
                    accentColor={token.color}
                    enabled={enabled}
                    onToggle={() => toggle(token.code)}
                    tag="CRYPTO"
                  />
                );
              })}
              {filteredTokens.length === 0 && <EmptySearch />}
            </div>
          </div>

          {/* ── Fiat Currencies ── */}
          <div className="brutalist-card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-[#1a1a1a] pb-3 gap-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🏦</span>
                <h2 className="text-xl font-extrabold text-[#1a1a1a] font-display uppercase tracking-tight">
                  Fiat Currencies
                </h2>
                <span className="px-2 py-0.5 border border-[#1a1a1a] bg-[#f5f0e8] text-[10px] font-bold font-mono">
                  {enabledFiatCount}/{FIAT_CURRENCIES.length} ON
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setAllFiat(true)}  className="px-3 py-1 border-2 border-[#1a1a1a] bg-[#00c853] text-white text-xs font-bold font-display uppercase hover:opacity-80 transition-opacity">Enable All</button>
                <button onClick={() => setAllFiat(false)} className="px-3 py-1 border-2 border-[#1a1a1a] bg-[#e63b2e] text-white text-xs font-bold font-display uppercase hover:opacity-80 transition-opacity">Disable All</button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredFiat.map(fiat => {
                const enabled = config[fiat.code] !== false;
                return (
                  <CurrencyCard
                    key={fiat.code}
                    code={fiat.code}
                    name={fiat.name}
                    icon={
                      <img
                        src={`https://flagcdn.com/w40/${fiat.iso2}.png`}
                        alt={fiat.code}
                        className="w-9 h-9 rounded-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display='none'; }}
                      />
                    }
                    accentColor="#1a1a1a"
                    enabled={enabled}
                    onToggle={() => toggle(fiat.code)}
                    tag={fiat.symbol}
                  />
                );
              })}
              {filteredFiat.length === 0 && <EmptySearch />}
            </div>
          </div>

          {/* ── Save footer ── */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-8 py-3 border-2 border-[#1a1a1a] bg-[#0055ff] text-white font-extrabold font-display uppercase tracking-wider shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              Save Configuration
            </button>
          </div>

        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="brutalist-card p-4 flex flex-col gap-1">
      <span className="text-2xl font-extrabold font-mono" style={{ color }}>{value}</span>
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">{label}</span>
    </div>
  );
}

function CurrencyCard({
  code, name, icon, accentColor, enabled, onToggle, tag,
}: {
  code: string; name: string; icon: React.ReactNode;
  accentColor: string; enabled: boolean;
  onToggle: () => void; tag: string;
}) {
  return (
    <div
      className={`p-4 border-2 border-[#1a1a1a] flex items-center justify-between gap-3 cursor-pointer transition-all select-none shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] ${
        enabled ? 'bg-white' : 'bg-[#f5f0e8] opacity-60'
      }`}
      onClick={onToggle}
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-[#1a1a1a]"
        style={{ backgroundColor: accentColor + '18' }}
      >
        {icon}
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-extrabold text-[#1a1a1a] font-display uppercase">{code}</p>
        <p className="text-[10px] text-gray-500 font-mono truncate">{name}</p>
        <span className="text-[9px] font-bold border border-[#1a1a1a] px-1 mt-0.5 inline-block font-mono bg-[#f5f0e8]">{tag}</span>
      </div>

      {/* Toggle */}
      <div onClick={e => { e.stopPropagation(); onToggle(); }}>
        {enabled
          ? <ToggleRight className="h-7 w-7 text-[#00c853]" />
          : <ToggleLeft  className="h-7 w-7 text-gray-400" />
        }
      </div>
    </div>
  );
}

function EmptySearch() {
  return (
    <div className="col-span-full py-8 text-center border-2 border-dashed border-[#1a1a1a] bg-[#f5f0e8]">
      <p className="text-gray-500 font-mono text-xs uppercase font-bold">No results found.</p>
    </div>
  );
}
