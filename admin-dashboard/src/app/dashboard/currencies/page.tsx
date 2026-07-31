'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Save, 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  ToggleLeft, 
  ToggleRight, 
  Coins, 
  Globe, 
  TrendingUp, 
  PieChart, 
  Edit3,
  Landmark,
  ShieldAlert
} from 'lucide-react';

// ─── Static token definitions (mirrors mobile currencyConfig.ts) ────────
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

const CARD_FIAT_CURRENCIES = [
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

export default function CurrencyManagerPage() {
  const [activeTab, setActiveTab] = useState<'card' | 'global'>('global');
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [message, setMessage]     = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // ── Tab 1: Card Currencies Settings ──
  const [config, setConfig]       = useState<CurrencyConfig>({});
  const [cardSearch, setCardSearch] = useState('');

  // ── Tab 2: Global Currencies Settings ──
  const [globalCurrencies, setGlobalCurrencies] = useState<any[]>([]);
  const [editingRates, setEditingRates]         = useState<Record<string, string>>({});
  const [totalInrxSupply, setTotalInrxSupply]   = useState(0);
  const [analytics, setAnalytics]               = useState<any[]>([]);
  const [globalSearch, setGlobalSearch]         = useState('');

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    setMessage(null);
    try {
      await Promise.all([
        fetchCardConfig(),
        fetchGlobalCurrencies(),
        fetchTotalInrxSupply(),
        fetchAnalytics()
      ]);
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Error loading data: ' + err.message });
    } finally {
      setLoading(false);
    }
  }

  // 1. Fetch card currencies settings
  async function fetchCardConfig() {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', DB_KEY)
      .maybeSingle();
    if (error) throw error;

    if (data?.value && typeof data.value === 'object') {
      setConfig(data.value as CurrencyConfig);
    } else {
      const defaults: CurrencyConfig = {};
      [...SETTLEMENT_TOKENS, ...CARD_FIAT_CURRENCIES].forEach(c => { defaults[c.code] = true; });
      setConfig(defaults);
    }
  }

  // 2. Fetch global currencies exchange rates
  async function fetchGlobalCurrencies() {
    const { data, error } = await supabase
      .from('fiat_currencies')
      .select('*')
      .order('code', { ascending: true });
    if (error) {
      console.warn('fiat_currencies fetch failed:', error.message);
      return;
    }
    setGlobalCurrencies(data || []);
    
    // Initialize editing rates
    const initialRates: Record<string, string> = {};
    (data || []).forEach((c: any) => {
      initialRates[c.code] = String(c.rate);
    });
    setEditingRates(initialRates);
  }

  // 3. Fetch total INRX supply from wallet_currency_settings table
  async function fetchTotalInrxSupply() {
    const { data, error } = await supabase
      .from('wallet_currency_settings')
      .select('balance');
    
    if (error) {
      console.warn('wallet_currency_settings balance fetch failed:', error.message);
      return;
    }
    const total = (data || []).reduce((acc: number, curr: any) => acc + Number(curr.balance || 0), 0);
    setTotalInrxSupply(total);
  }

  // 4. Fetch transactions group analytics by display currency
  async function fetchAnalytics() {
    try {
      // Fetch settings to segment transactions
      const { data: settingsData } = await supabase
        .from('wallet_currency_settings')
        .select('wallet_address, display_currency');
      
      const { data: txsData } = await supabase
        .from('transactions')
        .select('wallet_address, usd_value');
      
      if (!settingsData || !txsData) return;

      const userCurrencyMap: Record<string, string> = {};
      settingsData.forEach(s => {
        userCurrencyMap[s.wallet_address.toLowerCase()] = s.display_currency;
      });

      const stats: Record<string, { count: number; volume: number }> = {};
      txsData.forEach((tx: any) => {
        const addr = tx.wallet_address.toLowerCase();
        const currency = userCurrencyMap[addr] || 'USD';
        if (!stats[currency]) {
          stats[currency] = { count: 0, volume: 0 };
        }
        stats[currency].count += 1;
        stats[currency].volume += Number(tx.usd_value || 0);
      });

      const analyticsList = Object.entries(stats).map(([code, val]) => ({
        code,
        count: val.count,
        volume: val.volume
      }));
      setAnalytics(analyticsList);
    } catch (e) {
      console.warn('Analytics gathering failed:', e);
    }
  }

  // Save Card Currencies Settings
  async function handleSaveCardConfig() {
    setSaving(true);
    setMessage(null);
    try {
      const { error } = await supabase
        .from('admin_settings')
        .upsert({ key: DB_KEY, value: config }, { onConflict: 'key' });
      if (error) throw error;
      setMessage({ type: 'success', text: 'Card currency configuration saved successfully!' });
      setTimeout(() => setMessage(null), 5000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  // Toggle Global Currency Status
  async function toggleGlobalCurrency(code: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('fiat_currencies')
        .update({ is_enabled: !currentStatus })
        .eq('code', code);
      
      if (error) throw error;
      setGlobalCurrencies(prev => prev.map(c => c.code === code ? { ...c, is_enabled: !currentStatus } : c));
      setMessage({ type: 'success', text: `Currency ${code} status updated.` });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Toggle failed: ' + err.message });
    }
  }

  // Update Exchange Rates
  async function handleSaveGlobalRates() {
    setSaving(true);
    setMessage(null);
    try {
      const updates = globalCurrencies.map(async (c) => {
        const inputRate = editingRates[c.code];
        const numericRate = parseFloat(inputRate);
        if (isNaN(numericRate) || numericRate <= 0) {
          throw new Error(`Invalid exchange rate for ${c.code}`);
        }
        return supabase
          .from('fiat_currencies')
          .update({ rate: numericRate, updated_at: new Date().toISOString() })
          .eq('code', c.code);
      });

      await Promise.all(updates);
      setMessage({ type: 'success', text: 'Exchange rates updated successfully! Changes are propagated.' });
      fetchGlobalCurrencies();
      setTimeout(() => setMessage(null), 5000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  // Toggle Card Config Item
  function toggleCardItem(code: string) {
    setConfig(prev => ({ ...prev, [code]: !prev[code] }));
  }

  function setAllTokens(val: boolean) {
    setConfig(prev => {
      const next = { ...prev };
      SETTLEMENT_TOKENS.forEach(t => { next[t.code] = val; });
      return next;
    });
  }

  function setAllCardFiat(val: boolean) {
    setConfig(prev => {
      const next = { ...prev };
      CARD_FIAT_CURRENCIES.forEach(t => { next[t.code] = val; });
      return next;
    });
  }

  // Filters
  const qCard = cardSearch.toLowerCase();
  const filteredTokens = SETTLEMENT_TOKENS.filter(t => t.code.toLowerCase().includes(qCard) || t.name.toLowerCase().includes(qCard));
  const filteredCardFiat = CARD_FIAT_CURRENCIES.filter(t => t.code.toLowerCase().includes(qCard) || t.name.toLowerCase().includes(qCard));

  const qGlobal = globalSearch.toLowerCase();
  const filteredGlobal = globalCurrencies.filter(c => c.code.toLowerCase().includes(qGlobal) || c.name.toLowerCase().includes(qGlobal));

  const enabledTokenCount = SETTLEMENT_TOKENS.filter(t => config[t.code] !== false).length;
  const enabledCardFiatCount = CARD_FIAT_CURRENCIES.filter(t => config[t.code] !== false).length;
  const enabledGlobalCount = globalCurrencies.filter(c => c.is_enabled !== false).length;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-3 border-[#1a1a1a] pb-6 bg-[#0055ff] p-6 text-white shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] border-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-display uppercase leading-none">
            Currency & Exchange Manager
          </h1>
          <p className="text-xs font-bold font-mono uppercase tracking-wider mt-2">
            Configure settlement assets, manage exchange rates, and view total supply analytics
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'card' ? (
            <button
              onClick={handleSaveCardConfig}
              disabled={loading || saving}
              className="brutalist-button-white px-6 py-2.5 flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] hover:bg-[#1a1a1a] hover:text-white transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              <span>SAVE CARD CONFIG</span>
            </button>
          ) : (
            <button
              onClick={handleSaveGlobalRates}
              disabled={loading || saving}
              className="brutalist-button-white px-6 py-2.5 flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] hover:bg-[#1a1a1a] hover:text-white transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              <span>SAVE EXCHANGE RATES</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b-3 border-[#1a1a1a] gap-2">
        <button
          onClick={() => { setActiveTab('global'); setMessage(null); }}
          className={`px-6 py-3 font-display font-extrabold uppercase text-xs border-3 border-b-0 border-[#1a1a1a] translate-y-[3px] transition-all flex items-center gap-2 ${
            activeTab === 'global' ? 'bg-[#ffcc00] text-[#1a1a1a]' : 'bg-white text-gray-500 hover:text-[#1a1a1a]'
          }`}
        >
          <Globe className="h-4 w-4" />
          Global Fiat Manager
        </button>
        <button
          onClick={() => { setActiveTab('card'); setMessage(null); }}
          className={`px-6 py-3 font-display font-extrabold uppercase text-xs border-3 border-b-0 border-[#1a1a1a] translate-y-[3px] transition-all flex items-center gap-2 ${
            activeTab === 'card' ? 'bg-[#ffcc00] text-[#1a1a1a]' : 'bg-white text-gray-500 hover:text-[#1a1a1a]'
          }`}
        >
          <Coins className="h-4 w-4" />
          Card Currencies
        </button>
      </div>

      {/* Notification Banner */}
      {message && (
        <div className={`p-4 border-2 border-[#1a1a1a] flex items-center gap-3 text-sm font-bold uppercase tracking-wider font-display shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] ${
          message.type === 'error' ? 'bg-[#e63b2e] text-white' : 'bg-[#00c853] text-[#1a1a1a]'
        }`}>
          {message.type === 'error' ? <AlertCircle className="h-5 w-5 shrink-0" /> : <CheckCircle className="h-5 w-5 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {loading ? (
        <div className="brutalist-card p-12 flex flex-col items-center justify-center bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-[#1a1a1a] mb-4" />
          <span className="font-bold font-display uppercase text-sm text-[#1a1a1a]">Loading data...</span>
        </div>
      ) : activeTab === 'global' ? (
        // ── GLOBAL FIAT MANAGER TAB ──
        <div className="space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="brutalist-card p-5 bg-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">Total Active Currencies</span>
                <h3 className="text-2xl font-extrabold text-[#00c853]">{enabledGlobalCount} / {globalCurrencies.length}</h3>
              </div>
              <div className="h-10 w-10 border-2 border-[#1a1a1a] bg-[#00c853]/10 flex items-center justify-center">
                <Globe className="h-5 w-5 text-[#00c853]" />
              </div>
            </div>
            <div className="brutalist-card p-5 bg-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">Total System Supply (INRX)</span>
                <h3 className="text-2xl font-extrabold text-[#ff6f00]">₹{totalInrxSupply.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
              </div>
              <div className="h-10 w-10 border-2 border-[#1a1a1a] bg-[#ff6f00]/10 flex items-center justify-center">
                <Landmark className="h-5 w-5 text-[#ff6f00]" />
              </div>
            </div>
            <div className="brutalist-card p-5 bg-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">Total System Supply (USD)</span>
                <h3 className="text-2xl font-extrabold text-[#0055ff]">${(totalInrxSupply / (globalCurrencies.find(c => c.code === 'INR')?.rate ?? 83.5)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
              </div>
              <div className="h-10 w-10 border-2 border-[#1a1a1a] bg-[#0055ff]/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-[#0055ff]" />
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="brutalist-card p-4 bg-white">
            <input
              type="text"
              placeholder="Search global currencies by code or name…"
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              className="w-full brutalist-input font-mono text-sm"
            />
          </div>

          {/* Main Exchange Rates Table */}
          <div className="brutalist-card bg-white overflow-hidden">
            <div className="p-4 border-b-2 border-[#1a1a1a] bg-[#f5f0e8] flex items-center justify-between">
              <span className="font-extrabold font-display text-sm uppercase tracking-wider text-[#1a1a1a]">
                Exchange Rates & Supply Configuration
              </span>
              <span className="text-xs font-mono font-bold text-gray-500">1 USD BASE</span>
            </div>

            {filteredGlobal.length === 0 ? (
              <div className="p-12 text-center">
                <EmptySearch />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-[#1a1a1a] bg-[#fdfcfa] text-[10px] font-bold uppercase font-mono tracking-wider text-gray-500">
                      <th className="p-4">Currency</th>
                      <th className="p-4">Symbol</th>
                      <th className="p-4">Rate (Per 1 USD)</th>
                      <th className="p-4 text-right">INRX Peg Value</th>
                      <th className="p-4 text-right">Dynamic Total Supply</th>
                      <th className="p-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a1a1a] font-mono text-xs">
                    {filteredGlobal.map((c) => {
                      const enabled = c.is_enabled !== false;
                      const inrxRate = globalCurrencies.find(gc => gc.code === 'INR')?.rate ?? 83.5;
                      const relativePeg = c.rate / inrxRate; // Peg relative to INRX
                      const localSupply = totalInrxSupply * relativePeg;

                      return (
                        <tr key={c.code} className={`hover:bg-gray-50 transition-colors ${!enabled ? 'bg-[#f5f0e8]/50 opacity-60' : ''}`}>
                          {/* Flag + Code */}
                          <td className="p-4 whitespace-nowrap font-bold text-sm flex items-center gap-2">
                            <span className="text-xl">
                              {c.code === 'USD' ? '🇺🇸' : 
                               c.code === 'CNY' ? '🇨🇳' : 
                               c.code === 'RUB' ? '🇷🇺' :
                               c.code === 'UZS' ? '🇺🇿' : 
                               c.code === 'PKR' ? '🇵🇰' : 
                               c.code === 'VND' ? '🇻🇳' : 
                               c.code === 'IDR' ? '🇮🇩' : 
                               c.code === 'PHP' ? '🇵🇭' : 
                               c.code === 'AED' ? '🇦🇪' : 
                               c.code === 'THB' ? '🇹🇭' : '🌐'}
                            </span>
                            <div className="flex flex-col">
                              <span className="font-extrabold text-[#1a1a1a]">{c.code}</span>
                              <span className="text-[10px] text-gray-500 font-normal">{c.name}</span>
                            </div>
                          </td>

                          {/* Symbol */}
                          <td className="p-4 text-sm font-extrabold text-[#1a1a1a]">
                            {c.symbol}
                          </td>

                          {/* Rate input field */}
                          <td className="p-4">
                            <div className="flex items-center gap-2 max-w-[120px]">
                              <input
                                type="number"
                                step="any"
                                value={editingRates[c.code] || ''}
                                onChange={(e) => setEditingRates({ ...editingRates, [c.code]: e.target.value })}
                                className="brutalist-input py-1.5 px-2 text-xs font-bold text-center w-full focus:ring-0"
                              />
                            </div>
                          </td>

                          {/* INRX Peg equivalent */}
                          <td className="p-4 text-right font-bold text-[#ff6f00] text-sm">
                            1 INRX = {relativePeg.toFixed(4)} {c.code}
                          </td>

                          {/* Dynamic supply */}
                          <td className="p-4 text-right font-bold text-[#0055ff] text-sm">
                            {c.symbol}{localSupply.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* Toggle Status switch */}
                          <td className="p-4 text-center">
                            <button
                              onClick={() => toggleGlobalCurrency(c.code, enabled)}
                              className="focus:outline-none"
                            >
                              {enabled ? (
                                <ToggleRight className="h-7 w-7 text-[#00c853]" />
                              ) : (
                                <ToggleLeft className="h-7 w-7 text-gray-400" />
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Transaction Analytics Section */}
          <div className="brutalist-card p-6 bg-white space-y-6">
            <div className="flex items-center gap-2 border-b-2 border-[#1a1a1a] pb-3">
              <PieChart className="h-6 w-6 text-[#0055ff]" />
              <h2 className="text-xl font-extrabold text-[#1a1a1a] font-display uppercase tracking-tight">
                Transaction Volume by Wallet Currency Profile
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Analytics List */}
              <div className="space-y-4">
                <p className="text-xs text-gray-500 font-mono">
                  This segments the transaction activity based on the display currency selected by active wallets:
                </p>
                {analytics.length === 0 ? (
                  <div className="p-6 border border-dashed border-[#1a1a1a] bg-[#f5f0e8] text-center font-mono text-xs uppercase font-bold">
                    No transactions analytics available yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {analytics.map((item) => (
                      <div key={item.code} className="p-4 border-2 border-[#1a1a1a] bg-white flex items-center justify-between shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
                        <div>
                          <p className="font-extrabold font-display text-sm text-[#1a1a1a]">{item.code} Segment</p>
                          <p className="text-[10px] text-gray-500 font-mono mt-0.5">{item.count} total transactions</p>
                        </div>
                        <div className="text-right font-mono font-bold text-sm text-[#ff6f00]">
                          ${item.volume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Informational Card */}
              <div className="border-3 border-[#1a1a1a] p-5 bg-[#f5f0e8] shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] flex flex-col justify-between">
                <div className="space-y-3">
                  <span className="inline-block px-2.5 py-1 border-2 border-[#1a1a1a] bg-[#ffcc00] font-extrabold font-mono text-[9px] uppercase">
                    System Architecture Info
                  </span>
                  <h3 className="font-extrabold font-display text-base text-[#1a1a1a] uppercase leading-snug">
                    Display Conversion Peg Rules
                  </h3>
                  <ul className="text-xs text-gray-700 font-mono space-y-2 list-disc pl-4">
                    <li>All blockchain settlements occur in the native INRX token.</li>
                    <li>Display currencies only dictate client formatting and conversions.</li>
                    <li>Changing exchange rates immediately impacts how user balance displays on-chain.</li>
                    <li>This architecture cleanly supports adding new stablecoin pegs in the future.</li>
                  </ul>
                </div>
                <div className="flex gap-2.5 px-4 py-3 border-2 border-[#1a1a1a] bg-white mt-4 font-mono text-[10px] text-gray-600">
                  <ShieldAlert className="h-4.5 w-4.5 text-[#0055ff] shrink-0" />
                  <span>Always double check exchange rates before saving, as client balances rely on this peg.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // ── CARD CURRENCIES TAB (EXISTING BACKWARD COMPATIBLE LOGIC) ──
        <div className="space-y-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Tokens Enabled"   value={`${enabledTokenCount} / ${SETTLEMENT_TOKENS.length}`} color="#0055ff" />
            <StatCard label="Fiat Enabled"      value={`${enabledCardFiatCount} / ${CARD_FIAT_CURRENCIES.length}`}  color="#00c853" />
            <StatCard label="Tokens Disabled"   value={`${SETTLEMENT_TOKENS.length - enabledTokenCount}`}  color="#e63b2e" />
            <StatCard label="Fiat Disabled"     value={`${CARD_FIAT_CURRENCIES.length - enabledCardFiatCount}`}     color="#ffcc00" />
          </div>

          <div className="brutalist-card p-4 bg-white">
            <input
              type="text"
              placeholder="Search settlement tokens or fiat currencies…"
              value={cardSearch}
              onChange={e => setCardSearch(e.target.value)}
              className="w-full brutalist-input font-mono text-sm"
            />
          </div>

          {/* Card Settlement Tokens */}
          <div className="brutalist-card p-6 bg-white space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-[#1a1a1a] pb-3 gap-3">
              <div className="flex items-center gap-2">
                <Coins className="h-6 w-6 text-[#0055ff]" />
                <h2 className="text-xl font-extrabold text-[#1a1a1a] font-display uppercase tracking-tight">
                  Card Settlement Tokens
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
                    onToggle={() => toggleCardItem(token.code)}
                    tag="CRYPTO"
                  />
                );
              })}
              {filteredTokens.length === 0 && <EmptySearch />}
            </div>
          </div>

          {/* Card Fiat Currencies */}
          <div className="brutalist-card p-6 bg-white space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-[#1a1a1a] pb-3 gap-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🏦</span>
                <h2 className="text-xl font-extrabold text-[#1a1a1a] font-display uppercase tracking-tight">
                  Card Fiat Currencies
                </h2>
                <span className="px-2 py-0.5 border border-[#1a1a1a] bg-[#f5f0e8] text-[10px] font-bold font-mono">
                  {enabledCardFiatCount}/{CARD_FIAT_CURRENCIES.length} ON
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setAllCardFiat(true)}  className="px-3 py-1 border-2 border-[#1a1a1a] bg-[#00c853] text-white text-xs font-bold font-display uppercase hover:opacity-80 transition-opacity">Enable All</button>
                <button onClick={() => setAllCardFiat(false)} className="px-3 py-1 border-2 border-[#1a1a1a] bg-[#e63b2e] text-white text-xs font-bold font-display uppercase hover:opacity-80 transition-opacity">Disable All</button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredCardFiat.map(fiat => {
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
                    onToggle={() => toggleCardItem(fiat.code)}
                    tag={fiat.symbol}
                  />
                );
              })}
              {filteredCardFiat.length === 0 && <EmptySearch />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="brutalist-card p-4 flex flex-col gap-1 bg-white">
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
