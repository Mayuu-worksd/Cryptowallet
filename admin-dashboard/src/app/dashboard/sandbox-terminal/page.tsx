'use client';
export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import {
  Zap, CreditCard, ShoppingCart, RefreshCw, CheckCircle,
  XCircle, Loader2, Terminal, Play, AlertTriangle, ArrowUpCircle,
  ArrowDownCircle, Shield, Wifi, Activity
} from 'lucide-react';

const EVENT_TYPES = [
  { event: 'transaction.created', label: 'Card Spend',         icon: ShoppingCart,    color: 'bg-red-100 border-red-400 text-red-700',    category: 'tx' },
  { event: 'transaction.created', label: 'Card Top-Up',        icon: ArrowDownCircle, color: 'bg-green-100 border-green-400 text-green-700', category: 'topup' },
  { event: 'card.activated',      label: 'Activate Card',      icon: CheckCircle,     color: 'bg-emerald-100 border-emerald-400 text-emerald-700', category: 'lifecycle' },
  { event: 'card.locked',         label: 'Freeze Card',        icon: Shield,          color: 'bg-blue-100 border-blue-400 text-blue-700',  category: 'lifecycle' },
  { event: 'card.unlocked',       label: 'Unfreeze Card',      icon: Wifi,            color: 'bg-cyan-100 border-cyan-400 text-cyan-700',  category: 'lifecycle' },
  { event: 'card.updated',        label: 'Update Balance',     icon: Activity,        color: 'bg-purple-100 border-purple-400 text-purple-700', category: 'lifecycle' },
  { event: 'card.canceled',       label: 'Cancel Card',        icon: XCircle,         color: 'bg-red-100 border-red-400 text-red-700',    category: 'lifecycle' },
  { event: 'transfer.completed',  label: 'Transfer Completed', icon: ArrowUpCircle,   color: 'bg-yellow-100 border-yellow-400 text-yellow-700', category: 'transfer' },
];

const MERCHANTS = [
  'Amazon', 'Netflix', 'Uber Eats', 'Spotify', 'Apple Store',
  'Starbucks', 'Google Play', 'Airbnb', 'Shell Gas', 'Walmart',
];

interface SimResult {
  success: boolean;
  eventType?: string;
  referenceId?: string;
  webhookStatus?: number;
  note?: string;
  error?: string;
  transaction?: any;
}

export default function SandboxTerminalPage() {
  const [selectedCard, setSelectedCard] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState(EVENT_TYPES[0]);
  const [merchant, setMerchant] = useState(MERCHANTS[0]);
  const [amount, setAmount] = useState('25.00');
  const [currency, setCurrency] = useState('USD');
  const [balance, setBalance] = useState('250.00');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SimResult[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);

  // Load all cards
  const { data: cards, isLoading: cardsLoading } = useQuery({
    queryKey: ['sandbox-cards'],
    queryFn: async () => {
      const { data } = await supabase
        .from('vcc_cards')
        .select('id, wallet_address, codego_card_id, card_last4, card_holder_name, card_status')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const selectedCardData = cards?.find(c => c.codego_card_id === selectedCard);

  const logResult = (res: SimResult) => {
    setResults(prev => [{ ...res, _time: new Date().toLocaleTimeString() } as any, ...prev.slice(0, 49)]);
  };

  const runSimulation = async () => {
    if (!selectedCard) { alert('Select a card first'); return; }
    setLoading(true);

    try {
      const isTopup = selectedEvent.category === 'topup';
      const isLifecycle = selectedEvent.category === 'lifecycle';
      const isTransfer = selectedEvent.category === 'transfer';

      let endpoint: string;
      let body: any;

      if (selectedEvent.category === 'tx' || isTopup) {
        // Use the per-card simulate endpoint for transactions
        endpoint = `/api/codego/cards/${selectedCard}/simulate-transaction`;
        body = {
          merchantName: isTopup ? 'Card Top-Up' : merchant,
          amount: isTopup ? parseFloat(amount) : -parseFloat(amount),
          currency,
          type: isTopup ? 'topup' : 'spend',
          status: 'approved',
        };
      } else {
        // Use the general webhook simulator for lifecycle events
        endpoint = '/api/codego/simulate-webhook';
        body = {
          eventType: selectedEvent.event,
          codegoCardId: selectedCard,
          data: isLifecycle && selectedEvent.event === 'card.updated'
            ? { balance: parseFloat(balance), status: 'active' }
            : isTransfer
            ? { amount: parseFloat(amount), transferId: `sim-transfer-${Date.now()}` }
            : {},
        };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      logResult({
        success:     res.ok && data.success !== false,
        eventType:   selectedEvent.label,
        referenceId: data.referenceId || data.webhookPayload?.data?.id,
        webhookStatus: data.webhookStatus || res.status,
        note:        data.message || data.note,
        error:       data.error,
        transaction: data.transaction,
      });
    } catch (e: any) {
      logResult({ success: false, eventType: selectedEvent.label, error: e.message });
    } finally {
      setLoading(false);
    }
  };

  const runBulkSpend = async () => {
    if (!selectedCard) { alert('Select a card first'); return; }
    setBulkRunning(true);
    for (const m of MERCHANTS.slice(0, 5)) {
      try {
        const res = await fetch(`/api/codego/cards/${selectedCard}/simulate-transaction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            merchantName: m,
            amount: -(Math.floor(Math.random() * 8000 + 500) / 100),
            currency: 'USD',
            type: 'spend',
            status: 'approved',
          }),
        });
        const data = await res.json();
        logResult({ success: res.ok, eventType: `Spend at ${m}`, referenceId: data.referenceId, note: data.message });
        await new Promise(r => setTimeout(r, 400));
      } catch (e: any) {
        logResult({ success: false, eventType: `Spend at ${m}`, error: e.message });
      }
    }
    setBulkRunning(false);
  };

  const clearResults = () => setResults([]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="bg-[#1a1a1a] border-3 border-[#1a1a1a] p-6 shadow-[4px_4px_0px_0px_rgba(0,255,204,1)]">
        <div className="flex items-center gap-3">
          <Terminal className="h-8 w-8 text-[#00ffcc]" />
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white font-display uppercase">
              Sandbox Test Terminal
            </h1>
            <p className="text-xs text-gray-400 font-mono mt-1">
              Simulate real CodeGo events — fires through the full production webhook pipeline
            </p>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex gap-3 mt-4 flex-wrap">
          {[
            { label: '✅ Real card spending',   desc: 'via webhook pipeline' },
            { label: '✅ Auto webhooks',         desc: 'all event types' },
            { label: '✅ GET /transactions',     desc: 'auto-seed on first load' },
          ].map(b => (
            <div key={b.label} className="flex items-center gap-2 bg-[#00ffcc]/10 border border-[#00ffcc]/40 px-3 py-1.5 rounded">
              <span className="text-[#00ffcc] text-xs font-bold font-mono">{b.label}</span>
              <span className="text-gray-500 text-[10px] font-mono">{b.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Left: Controls ─────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Card Selector */}
          <div className="brutalist-card p-5 space-y-3">
            <h3 className="text-xs font-extrabold uppercase font-display text-[#1a1a1a] flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Select Card
            </h3>
            {cardsLoading ? (
              <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading cards...
              </div>
            ) : (
              <select
                value={selectedCard}
                onChange={e => setSelectedCard(e.target.value)}
                className="w-full border-2 border-[#1a1a1a] bg-[#f5f0e8] px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:bg-[#ffcc00]/20"
              >
                <option value="">-- Choose a card --</option>
                {(cards || []).map(c => (
                  <option key={c.id} value={c.codego_card_id || c.id}>
                    {c.card_holder_name} •••• {c.card_last4} [{c.card_status}]
                    {c.codego_card_id ? ` — ${c.codego_card_id.slice(0, 12)}...` : ' — NO CODEGO ID'}
                  </option>
                ))}
              </select>
            )}
            {selectedCardData && (
              <div className="bg-[#f5f0e8] border border-[#1a1a1a]/20 p-3 text-[10px] font-mono space-y-0.5">
                <div><span className="text-gray-500">WALLET:</span> {selectedCardData.wallet_address.slice(0,10)}...{selectedCardData.wallet_address.slice(-6)}</div>
                <div><span className="text-gray-500">CODEGO ID:</span> {selectedCardData.codego_card_id || '⚠️ None — some simulations may not work'}</div>
                <div><span className="text-gray-500">STATUS:</span> <span className="font-bold uppercase">{selectedCardData.card_status}</span></div>
              </div>
            )}
          </div>

          {/* Event Type Selector */}
          <div className="brutalist-card p-5 space-y-3">
            <h3 className="text-xs font-extrabold uppercase font-display text-[#1a1a1a] flex items-center gap-2">
              <Zap className="h-4 w-4" /> Event Type
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {EVENT_TYPES.map(et => {
                const Icon = et.icon;
                const isSelected = selectedEvent.label === et.label && selectedEvent.event === et.event;
                return (
                  <button
                    key={`${et.event}-${et.label}`}
                    onClick={() => setSelectedEvent(et)}
                    className={`flex items-center gap-2 px-3 py-2.5 border-2 text-[10px] font-bold uppercase font-mono transition-all
                      ${isSelected
                        ? 'bg-[#1a1a1a] border-[#1a1a1a] text-white shadow-[2px_2px_0px_0px_rgba(255,204,0,1)]'
                        : 'bg-white border-[#1a1a1a]/30 text-[#1a1a1a] hover:border-[#1a1a1a] hover:bg-[#f5f0e8]'
                      }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{et.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Parameters */}
          <div className="brutalist-card p-5 space-y-3">
            <h3 className="text-xs font-extrabold uppercase font-display text-[#1a1a1a]">Parameters</h3>

            {(selectedEvent.category === 'tx') && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-gray-500 font-mono">Merchant</label>
                <select
                  value={merchant}
                  onChange={e => setMerchant(e.target.value)}
                  className="w-full border-2 border-[#1a1a1a] bg-[#f5f0e8] px-3 py-2 text-xs font-mono font-bold focus:outline-none"
                >
                  {MERCHANTS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            )}

            {(selectedEvent.category === 'tx' || selectedEvent.category === 'topup' || selectedEvent.category === 'transfer') && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-500 font-mono">Amount</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    min="0.01"
                    step="0.01"
                    className="w-full border-2 border-[#1a1a1a] bg-[#f5f0e8] px-3 py-2 text-xs font-mono font-bold focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-500 font-mono">Currency</label>
                  <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    className="w-full border-2 border-[#1a1a1a] bg-[#f5f0e8] px-3 py-2 text-xs font-mono font-bold focus:outline-none"
                  >
                    {['USD', 'EUR', 'GBP', 'AED', 'INR'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            )}

            {selectedEvent.event === 'card.updated' && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500 font-mono">New Balance (USD)</label>
                <input
                  type="number"
                  value={balance}
                  onChange={e => setBalance(e.target.value)}
                  min="0"
                  step="0.01"
                  className="w-full border-2 border-[#1a1a1a] bg-[#f5f0e8] px-3 py-2 text-xs font-mono font-bold focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Fire Buttons */}
          <div className="flex gap-3">
            <button
              onClick={runSimulation}
              disabled={loading || !selectedCard}
              className="flex-1 flex items-center justify-center gap-2 bg-[#00ffcc] border-3 border-[#1a1a1a] px-5 py-3.5 text-sm font-extrabold uppercase font-display text-[#1a1a1a] hover:bg-[#00e6b8] disabled:opacity-50 shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] active:translate-y-0.5 active:shadow-none transition-all"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {loading ? 'Firing...' : 'Fire Event'}
            </button>

            <button
              onClick={runBulkSpend}
              disabled={bulkRunning || !selectedCard}
              className="flex items-center justify-center gap-2 bg-[#ffcc00] border-3 border-[#1a1a1a] px-4 py-3.5 text-xs font-extrabold uppercase font-display text-[#1a1a1a] hover:bg-[#f0bf00] disabled:opacity-50 shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] active:translate-y-0.5 active:shadow-none transition-all"
            >
              {bulkRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Bulk Spend ×5
            </button>
          </div>
        </div>

        {/* ── Right: Results Log ──────────────────────────────────────────────── */}
        <div className="brutalist-card flex flex-col h-full min-h-[500px]">
          <div className="p-4 border-b-3 border-[#1a1a1a] bg-[#1a1a1a] flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase font-mono text-[#00ffcc] flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5" /> Event Log ({results.length})
            </span>
            <button
              onClick={clearResults}
              className="text-[10px] font-bold uppercase text-gray-400 hover:text-white font-mono"
            >
              Clear
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-[#0d0d0d] p-4 space-y-2 font-mono">
            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-600 text-xs font-mono text-center space-y-2">
                <Terminal className="h-8 w-8 opacity-30" />
                <p>No events yet.</p>
                <p className="text-[10px]">Select a card → Fire an event → Results appear here</p>
              </div>
            ) : (
              results.map((r: any, i) => (
                <div
                  key={i}
                  className={`border p-3 text-[10px] space-y-1 ${
                    r.success
                      ? 'border-[#00ffcc]/30 bg-[#00ffcc]/5'
                      : 'border-red-500/30 bg-red-500/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {r.success
                      ? <CheckCircle className="h-3 w-3 text-[#00ffcc] shrink-0" />
                      : <XCircle className="h-3 w-3 text-red-400 shrink-0" />
                    }
                    <span className={`font-bold ${r.success ? 'text-[#00ffcc]' : 'text-red-400'}`}>
                      {r.eventType}
                    </span>
                    <span className="text-gray-600 ml-auto">{r._time}</span>
                  </div>
                  {r.referenceId && (
                    <div className="text-gray-500">REF: <span className="text-gray-300">{r.referenceId}</span></div>
                  )}
                  {r.note && (
                    <div className="text-gray-400">{r.note}</div>
                  )}
                  {r.error && (
                    <div className="text-red-400">❌ {r.error}</div>
                  )}
                  {r.transaction && (
                    <div className="text-[#00ffcc]/70 mt-1 pl-2 border-l border-[#00ffcc]/20">
                      ↳ TX saved: {r.transaction.label} | {r.transaction.amount} {r.transaction.token} | {r.transaction.status}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Pipeline Explanation */}
          <div className="p-4 border-t-2 border-[#1a1a1a] bg-[#f5f0e8]">
            <p className="text-[9px] font-mono text-gray-500 uppercase font-bold">Pipeline (same as production):</p>
            <p className="text-[9px] font-mono text-gray-400 mt-1">
              Admin fires event → /api/codego/simulate-webhook → /api/webhooks/codego → Supabase transactions → Mobile app ✅
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
