'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ArrowLeftRight, TrendingUp, CreditCard, Loader2 } from 'lucide-react';

export default function AnalyticsPage() {
  const [activeSegment, setActiveSegment] = useState<'volume' | 'users' | 'revenue'>('volume');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics-real'],
    queryFn: async () => {
      const [
        { data: profiles },
        { data: transactions },
        { data: p2pOrders },
      ] = await Promise.all([
        supabase.from('wallet_profiles').select('wallet_address, token_balances, created_at'),
        supabase.from('transactions').select('type, usd_value, amount, token, status, created_at').order('created_at', { ascending: true }),
        supabase.from('p2p_orders').select('status, fiat_total, created_at'),
      ]);

      // ── Last 7 days labels ──
      const today = new Date();
      const last7 = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (6 - i));
        return {
          label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          date: d.toISOString().slice(0, 10),
        };
      });

      // ── Volume per day (swap USD) ──
      const volumeByDay = last7.map(({ date }) =>
        (transactions ?? [])
          .filter(t => t.created_at?.slice(0, 10) === date && t.type === 'swap')
          .reduce((acc, t) => acc + Number(t.usd_value || 0), 0)
      );

      // ── Cumulative users per day ──
      const usersByDay = last7.map(({ date }) =>
        (profiles ?? []).filter(p => p.created_at?.slice(0, 10) <= date).length
      );

      // ── Revenue per day (0.1% swap + 0.15% card topup) ──
      const revenueByDay = last7.map(({ date }) => {
        const dayTxs = (transactions ?? []).filter(t => t.created_at?.slice(0, 10) === date);
        const swapFee = dayTxs.filter(t => t.type === 'swap').reduce((a, t) => a + Number(t.usd_value || 0) * 0.001, 0);
        const cardFee = dayTxs.filter(t => t.type === 'card_topup').reduce((a, t) => a + Number(t.usd_value || 0) * 0.0015, 0);
        return swapFee + cardFee;
      });

      // ── Transaction type splits ──
      const txList = transactions ?? [];
      const swapTxs   = txList.filter(t => t.type === 'swap');
      const sendTxs   = txList.filter(t => t.type === 'send');
      const topupTxs  = txList.filter(t => t.type === 'card_topup' || t.type === 'card_spend');

      const swapUsd  = swapTxs.reduce((a, t) => a + Number(t.usd_value || 0), 0);
      const sendUsd  = sendTxs.reduce((a, t) => a + Number(t.usd_value || 0), 0);
      const topupUsd = topupTxs.reduce((a, t) => a + Number(t.usd_value || 0), 0);

      // ── Protocol fees ──
      const swapFeeTotal  = swapUsd * 0.001;
      const cardFeeTotal  = topupUsd * 0.0015;
      const p2pFeeTotal   = (p2pOrders ?? []).filter(o => o.status === 'completed')
        .reduce((a, o) => a + Number(o.fiat_total || 0) * 0.0015, 0);
      const totalFees = swapFeeTotal + cardFeeTotal + p2pFeeTotal;

      // ── Token pool from real wallet_profiles.token_balances ──
      const tokenTotals: Record<string, number> = {};
      (profiles ?? []).forEach(p => {
        if (!p.token_balances) return;
        try {
          const bal = typeof p.token_balances === 'string' ? JSON.parse(p.token_balances) : p.token_balances;
          Object.entries(bal).forEach(([token, amount]) => {
            tokenTotals[token] = (tokenTotals[token] ?? 0) + Number(amount);
          });
        } catch {}
      });

      const tokenEntries = Object.entries(tokenTotals).sort((a, b) => b[1] - a[1]);
      const grandTotal = tokenEntries.reduce((a, [, v]) => a + v, 0);

      const TOKEN_COLORS: Record<string, string> = {
        USDT: '#0055ff', USDC: '#ffcc00', ETH: '#e63b2e',
        TRX: '#1a1a1a', BNB: '#ffcc00', BTC: '#e63b2e',
        SOL: '#0055ff', DAI: '#f5f0e8',
      };

      return {
        chartLabels: last7.map(d => d.label),
        volumeByDay,
        usersByDay,
        revenueByDay,
        swapCount: swapTxs.length,
        sendCount: sendTxs.length,
        topupCount: topupTxs.length,
        swapUsd, sendUsd, topupUsd,
        swapFeeTotal, cardFeeTotal, p2pFeeTotal, totalFees,
        tokenEntries,
        grandTotal,
        TOKEN_COLORS,
      };
    },
    refetchInterval: 20000,
  });

  const chartMap = {
    volume:  { points: data?.volumeByDay  ?? [], title: 'Global Swap Volume ($)',         sub: 'Daily swap USD volume from live transactions' },
    users:   { points: data?.usersByDay   ?? [], title: 'Registered Nodes (Cumulative)',  sub: 'Wallet profiles created up to each day' },
    revenue: { points: data?.revenueByDay ?? [], title: 'Protocol Fees Collected ($)',    sub: 'Daily fee revenue from swaps + card topups' },
  };

  const currentPoints = chartMap[activeSegment].points;
  const chartLabels   = data?.chartLabels ?? ['', '', '', '', '', '', ''];
  const max = Math.max(...currentPoints, 1);
  const min = Math.min(...currentPoints, 0);
  const W = 600; const H = 180;

  const svgPoints = currentPoints.map((val, idx) => {
    const x = (idx / (currentPoints.length - 1)) * W;
    const y = H - ((val - min) / (max - min || 1)) * (H - 40) - 20;
    return `${x},${y}`;
  }).join(' ');

  const svgArea = `${svgPoints} ${W},${H} 0,${H}`;

  return (
    <div className="space-y-8 animate-fade-in relative min-h-screen pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-3 border-[#1a1a1a] pb-6 bg-[#0055ff] p-6 text-white shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] border-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-display uppercase leading-none">System Analytics Desk</h1>
          <p className="text-xs font-bold font-mono uppercase tracking-wider mt-2">All figures pulled live from Supabase — zero hardcoded metrics</p>
        </div>
      </div>

      {/* Transaction type split widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="brutalist-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">Exchange Volume</p>
            <h4 className="text-2xl font-extrabold text-[#1a1a1a] mt-1 font-mono">
              {isLoading ? '—' : `$${(data?.swapUsd ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            </h4>
            <p className="text-[10px] text-gray-500 font-mono mt-0.5 font-bold uppercase">{isLoading ? '—' : data?.swapCount} swap transactions</p>
          </div>
          <div className="h-10 w-10 border-2 border-[#1a1a1a] bg-[#ffcc00] flex items-center justify-center text-[#1a1a1a] shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
            <ArrowLeftRight className="h-5 w-5" />
          </div>
        </div>

        <div className="brutalist-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">Outbound Sends</p>
            <h4 className="text-2xl font-extrabold text-[#1a1a1a] mt-1 font-mono">
              {isLoading ? '—' : `$${(data?.sendUsd ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            </h4>
            <p className="text-[10px] text-gray-500 font-mono mt-0.5 font-bold uppercase">{isLoading ? '—' : data?.sendCount} send transactions</p>
          </div>
          <div className="h-10 w-10 border-2 border-[#1a1a1a] bg-[#e63b2e] text-white flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>

        <div className="brutalist-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">VCC Card Activity</p>
            <h4 className="text-2xl font-extrabold text-[#1a1a1a] mt-1 font-mono">
              {isLoading ? '—' : `$${(data?.topupUsd ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            </h4>
            <p className="text-[10px] text-gray-500 font-mono mt-0.5 font-bold uppercase">{isLoading ? '—' : data?.topupCount} card transactions</p>
          </div>
          <div className="h-10 w-10 border-2 border-[#1a1a1a] bg-[#0055ff] text-white flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
            <CreditCard className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* SVG Chart — real data */}
      <div className="brutalist-card p-6">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-extrabold text-[#1a1a1a] font-display uppercase leading-tight">{chartMap[activeSegment].title}</h2>
            <p className="text-xs text-gray-500 font-mono font-semibold uppercase mt-0.5">{chartMap[activeSegment].sub}</p>
          </div>
          <div className="flex items-center p-1 border-2 border-[#1a1a1a] bg-white gap-1 self-start font-mono">
            {([
              { id: 'volume',  label: 'Exchange Volume' },
              { id: 'users',   label: 'Registered Nodes' },
              { id: 'revenue', label: 'Protocol Fees' },
            ] as const).map(seg => (
              <button
                key={seg.id}
                onClick={() => setActiveSegment(seg.id)}
                className={`px-3 py-1.5 text-xs font-bold uppercase font-display tracking-wider transition-all ${activeSegment === seg.id ? 'text-white bg-[#1a1a1a]' : 'text-[#1a1a1a] hover:bg-[#ffcc00]/20'}`}
              >
                {seg.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative py-4 flex items-end min-h-[220px]">
          {isLoading ? (
            <div className="w-full flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-[#1a1a1a]" />
            </div>
          ) : (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full overflow-visible">
              <defs>
                <pattern id="brutalistGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(26,26,26,0.04)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width={W} height={H} fill="url(#brutalistGrid)" />
              <line x1="0" y1={H * 0.25} x2={W} y2={H * 0.25} stroke="#1a1a1a" strokeDasharray="3,3" strokeOpacity="0.1" />
              <line x1="0" y1={H * 0.5}  x2={W} y2={H * 0.5}  stroke="#1a1a1a" strokeDasharray="3,3" strokeOpacity="0.1" />
              <line x1="0" y1={H * 0.75} x2={W} y2={H * 0.75} stroke="#1a1a1a" strokeDasharray="3,3" strokeOpacity="0.1" />
              <polygon points={svgArea} fill="#0055ff" fillOpacity="0.08" />
              <polyline fill="none" stroke="#1a1a1a" strokeWidth="3" points={svgPoints} />
              {currentPoints.map((val, idx) => {
                const x = (idx / (currentPoints.length - 1)) * W;
                const y = H - ((val - min) / (max - min || 1)) * (H - 40) - 20;
                return (
                  <g key={idx}>
                    <circle cx={x} cy={y} r="5" className="fill-[#ffcc00] stroke-[#1a1a1a] stroke-2" />
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        <div className="flex justify-between items-center pt-4 border-t-2 border-[#1a1a1a] px-1 font-mono">
          {chartLabels.map((lbl, idx) => (
            <span key={idx} className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{lbl}</span>
          ))}
        </div>
      </div>

      {/* Token Pool + Protocol Fees */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Token Pool — real from wallet_profiles.token_balances */}
        <div className="brutalist-card p-6">
          <h2 className="text-xl font-extrabold text-[#1a1a1a] mb-1 font-display uppercase">Token Pool Allocation</h2>
          <p className="text-xs text-gray-500 font-mono font-semibold uppercase tracking-wide mb-6">Aggregated from all wallet_profiles token balances in live DB</p>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#1a1a1a]" />
            </div>
          ) : (data?.tokenEntries ?? []).length === 0 ? (
            <p className="text-sm text-gray-500 italic text-center py-8">No token balances recorded in wallet profiles yet.</p>
          ) : (
            <div className="space-y-4 font-mono">
              {(data?.tokenEntries ?? []).slice(0, 6).map(([token, amount]) => {
                const pct = data!.grandTotal > 0 ? (amount / data!.grandTotal) * 100 : 0;
                const color = data?.TOKEN_COLORS?.[token] ?? '#1a1a1a';
                return (
                  <div key={token} className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="text-gray-500 font-bold">{token}</span>
                      <span className="text-[#1a1a1a] font-extrabold">
                        {amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-3.5 w-full bg-white border-2 border-[#1a1a1a] rounded-none overflow-hidden">
                      <div className="h-full rounded-none transition-all duration-700 border-r-2 border-[#1a1a1a]" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Protocol Commission — real calculated fees */}
        <div className="brutalist-card p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-[#1a1a1a] mb-1 font-display uppercase">Protocol Commission Ledger</h2>
            <p className="text-xs text-gray-500 font-mono font-semibold uppercase tracking-wide mb-6">Calculated from live swap, card, and P2P transaction records</p>

            <div className="space-y-4 font-mono text-xs">
              <div className="p-3.5 border-2 border-[#1a1a1a] bg-[#f5f0e8] flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#1a1a1a]">0.10% Exchange Spread</p>
                  <p className="text-[10px] text-gray-500 font-semibold uppercase mt-0.5">From {data?.swapCount ?? 0} swap transactions</p>
                </div>
                <span className="text-xs font-extrabold text-[#1a1a1a]">
                  {isLoading ? '—' : `$${(data?.swapFeeTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </span>
              </div>

              <div className="p-3.5 border-2 border-[#1a1a1a] bg-[#f5f0e8] flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#1a1a1a]">0.15% Card Top-up Spread</p>
                  <p className="text-[10px] text-gray-500 font-semibold uppercase mt-0.5">From {data?.topupCount ?? 0} card transactions</p>
                </div>
                <span className="text-xs font-extrabold text-[#1a1a1a]">
                  {isLoading ? '—' : `$${(data?.cardFeeTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </span>
              </div>

              <div className="p-3.5 border-2 border-[#1a1a1a] bg-[#f5f0e8] flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#1a1a1a]">0.15% P2P Escrow Fee</p>
                  <p className="text-[10px] text-gray-500 font-semibold uppercase mt-0.5">From completed P2P trades</p>
                </div>
                <span className="text-xs font-extrabold text-[#1a1a1a]">
                  {isLoading ? '—' : `$${(data?.p2pFeeTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t-3 border-[#1a1a1a] flex items-center justify-between font-display">
            <span className="text-xs font-bold text-gray-500 uppercase font-mono">Total Revenue Collected:</span>
            <span className="text-lg font-extrabold text-[#0055ff] uppercase">
              {isLoading ? '—' : `$${(data?.totalFees ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
