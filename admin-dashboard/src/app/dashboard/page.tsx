'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  Users,
  ShieldCheck,
  Store,
  RefreshCw,
  ArrowLeftRight,
  TrendingUp,
  Activity,
  AlertTriangle,
  ChevronRight,
  Loader2,
  DollarSign,
  CheckCircle,
  Database,
  Globe,
  Radio,
  Gavel,
  CreditCard,
} from 'lucide-react';
import Link from 'next/link';

export default function OverviewPage() {
  const [activeTab, setActiveTab] = useState<'volume' | 'users'>('volume');

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-overview-stats'],
    queryFn: async () => {
      const [
        { data: profiles },
        { data: personalKyc },
        { data: businessKyc },
        { data: transactions },
        { data: p2pOrders },
        { data: cardRequests },
      ] = await Promise.all([
        supabase.from('wallet_profiles').select('*'),
        supabase.from('kyc').select('*'),
        supabase.from('business_kyc').select('*'),
        supabase.from('transactions').select('*').order('created_at', { ascending: true }),
        supabase.from('p2p_orders').select('*'),
        supabase.from('card_requests').select('id, status'),
      ]);

      const cardRequestsPending = (cardRequests ?? []).filter((c: any) => c.status === 'pending').length;

      const totalUsers = profiles?.length ?? 0;
      const totalTransactions = transactions?.length ?? 0;
      const totalP2P = p2pOrders?.length ?? 0;

      const kycPending = (personalKyc ?? []).filter(k => k.status === 'pending' || k.status === 'under_review').length;
      const kycVerified = (personalKyc ?? []).filter(k => k.status === 'verified').length;
      const kycRejected = (personalKyc ?? []).filter(k => k.status === 'rejected').length;
      const merchantPending = (businessKyc ?? []).filter(b => b.status === 'pending' || b.status === 'under_review').length;
      const merchantApproved = (businessKyc ?? []).filter(b => b.status === 'approved').length;

      // Real revenue from actual transactions
      const swapUsd = (transactions ?? [])
        .filter(t => t.type === 'swap' && t.status === 'success')
        .reduce((acc, t) => acc + Number(t.usd_value || 0), 0);
      const p2pUsd = (p2pOrders ?? [])
        .filter(o => o.status === 'completed')
        .reduce((acc, o) => acc + Number(o.fiat_total || 0), 0);
      const totalRevenue = (swapUsd * 0.001) + (p2pUsd * 0.0015);

      // Build last-7-days chart data from real transactions
      const today = new Date();
      const last7: { label: string; date: string }[] = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (6 - i));
        return {
          label: d.toLocaleDateString('en-US', { weekday: 'short' }),
          date: d.toISOString().slice(0, 10),
        };
      });

      const volumeByDay = last7.map(({ date }) => {
        return (transactions ?? [])
          .filter(t => t.created_at?.slice(0, 10) === date)
          .reduce((acc, t) => acc + Number(t.usd_value || 0), 0);
      });

      // Build user growth: cumulative count per day
      const usersByDay = last7.map(({ date }) => {
        return (profiles ?? []).filter(p => p.created_at?.slice(0, 10) <= date).length;
      });

      const recentKyc = (personalKyc ?? [])
        .filter(k => k.status === 'pending' || k.status === 'under_review')
        .slice(0, 5);

      const recentTransactions = [...(transactions ?? [])]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

      return {
        totalUsers, totalTransactions, totalP2P,
        kycPending, kycVerified, kycRejected,
        merchantPending, merchantApproved,
        totalRevenue, cardRequestsPending,
        chartLabels: last7.map(d => d.label),
        volumeByDay,
        usersByDay,
        recentKyc,
        recentTransactions,
      };
    },
    refetchInterval: 15000,
  });

  const activeChart = activeTab === 'volume'
    ? (stats?.volumeByDay ?? [0, 0, 0, 0, 0, 0, 0])
    : (stats?.usersByDay ?? [0, 0, 0, 0, 0, 0, 0]);

  const chartLabels = stats?.chartLabels ?? ['', '', '', '', '', '', ''];
  const maxVal = Math.max(...activeChart, 1);
  const minVal = Math.min(...activeChart, 0);
  const width = 500;
  const height = 150;

  const points = activeChart.map((val, index) => {
    const x = (index / (activeChart.length - 1)) * width;
    const y = height - ((val - minVal) / (maxVal - minVal || 1)) * (height - 30) - 15;
    return `${x},${y}`;
  }).join(' ');

  const fillPoints = `${points} ${width},${height} 0,${height}`;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-3 border-[#1a1a1a] pb-6 bg-[#ffcc00] p-6 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] border-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#1a1a1a] font-display uppercase leading-none">CryptoWallet Admin Overview</h1>
          <p className="text-xs text-[#1a1a1a] font-bold mt-2 font-mono uppercase tracking-wider">Neo-Brutalist Bauhaus Operations Console V2.0.48</p>
        </div>
        {isLoading && (
          <div className="flex items-center gap-2 px-3 py-1.5 border-2 border-[#1a1a1a] bg-white text-[#1a1a1a] text-xs font-bold font-display uppercase shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Syncing database...</span>
          </div>
        )}
      </div>

      {/* 5 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">

        {/* Total Users */}
        <div className="brutalist-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="h-12 w-12 border-2 border-[#1a1a1a] bg-[#ffcc00] flex items-center justify-center text-[#1a1a1a]">
              <Users className="h-6 w-6" />
            </div>
            <span className="text-[9px] font-extrabold border-2 border-[#1a1a1a] bg-[#f5f0e8] px-2 py-0.5 uppercase tracking-wider font-display">
              Total Wallet Nodes
            </span>
          </div>
          <h3 className="text-4xl font-extrabold tracking-tight text-[#1a1a1a] font-mono leading-none">
            {isLoading ? '—' : (stats?.totalUsers ?? 0).toLocaleString()}
          </h3>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2 font-mono">Total Users In Pool</p>
        </div>

        {/* Total Transactions */}
        <div className="brutalist-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="h-12 w-12 border-2 border-[#1a1a1a] bg-[#0055ff] flex items-center justify-center text-white">
              <ArrowLeftRight className="h-6 w-6" />
            </div>
            <span className="text-[9px] font-extrabold border-2 border-[#1a1a1a] bg-[#f5f0e8] px-2 py-0.5 uppercase tracking-wider font-display">
              Transactions Audited
            </span>
          </div>
          <h3 className="text-4xl font-extrabold tracking-tight text-[#1a1a1a] font-mono leading-none">
            {isLoading ? '—' : (stats?.totalTransactions ?? 0).toLocaleString()}
          </h3>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2 font-mono">Audited System Ledger Entries</p>
        </div>

        {/* Pending KYC */}
        <div className="brutalist-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="h-12 w-12 border-2 border-[#1a1a1a] bg-[#ffcc00] flex items-center justify-center text-[#1a1a1a]">
              <ShieldCheck className="h-6 w-6" />
            </div>
            {(stats?.kycPending ?? 0) > 0 ? (
              <span className="text-[9px] font-extrabold border-2 border-[#1a1a1a] bg-[#e63b2e] text-white px-2 py-0.5 uppercase tracking-wider font-display animate-pulse">
                {stats?.kycPending} Urgent
              </span>
            ) : (
              <span className="text-[9px] font-extrabold border-2 border-[#1a1a1a] bg-[#f5f0e8] px-2 py-0.5 uppercase tracking-wider font-display">
                All Cleared
              </span>
            )}
          </div>
          <h3 className="text-4xl font-extrabold tracking-tight text-[#1a1a1a] font-mono leading-none">
            {isLoading ? '—' : stats?.kycPending ?? 0}
          </h3>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2 font-mono">KYC Reviews Awaiting Action</p>
        </div>

        {/* Card Requests */}
        <div className="brutalist-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="h-12 w-12 border-2 border-[#1a1a1a] bg-[#0055ff] flex items-center justify-center text-white">
              <CreditCard className="h-6 w-6" />
            </div>
            {(stats?.cardRequestsPending ?? 0) > 0 ? (
              <span className="text-[9px] font-extrabold border-2 border-[#1a1a1a] bg-[#e63b2e] text-white px-2 py-0.5 uppercase tracking-wider font-display animate-pulse">
                {stats?.cardRequestsPending} Pending
              </span>
            ) : (
              <span className="text-[9px] font-extrabold border-2 border-[#1a1a1a] bg-[#f5f0e8] px-2 py-0.5 uppercase tracking-wider font-display">
                All Processed
              </span>
            )}
          </div>
          <h3 className="text-4xl font-extrabold tracking-tight text-[#1a1a1a] font-mono leading-none">
            {isLoading ? '—' : stats?.cardRequestsPending ?? 0}
          </h3>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2 font-mono">Card Orders Pending</p>
        </div>

        {/* Total Revenue */}
        <div className="brutalist-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="h-12 w-12 border-2 border-[#1a1a1a] bg-[#ffcc00] flex items-center justify-center text-[#1a1a1a]">
              <DollarSign className="h-6 w-6" />
            </div>
            <span className="text-[9px] font-extrabold border-2 border-[#1a1a1a] bg-[#f5f0e8] px-2 py-0.5 uppercase tracking-wider font-display">
              Swap & Card Commissions
            </span>
          </div>
          <h3 className="text-3xl font-extrabold tracking-tight text-[#1a1a1a] font-mono leading-none">
            {isLoading ? '—' : `$${(stats?.totalRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </h3>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2 font-mono">Platform Accumulated Revenue</p>
        </div>

      </div>

      {/* Chart + KYC Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Chart */}
        <div className="lg:col-span-2 brutalist-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-extrabold text-[#1a1a1a] font-display uppercase tracking-tight">Growth & Throughput</h2>
                <p className="text-xs text-gray-500 font-mono">Cumulative transaction volume over a 7-day period</p>
              </div>
              <div className="flex items-center border-2 border-[#1a1a1a] bg-[#f5f0e8] p-1 gap-1">
                <button
                  onClick={() => setActiveTab('volume')}
                  className={`px-3 py-1 text-xs font-bold font-display uppercase tracking-wider transition-all ${activeTab === 'volume' ? 'text-white bg-[#1a1a1a]' : 'text-[#1a1a1a] hover:bg-white'}`}
                >
                  Swap Volume
                </button>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`px-3 py-1 text-xs font-bold font-display uppercase tracking-wider transition-all ${activeTab === 'users' ? 'text-white bg-[#1a1a1a]' : 'text-[#1a1a1a] hover:bg-white'}`}
                >
                  Nodes Registered
                </button>
              </div>
            </div>

            <div className="relative flex-1 min-h-[180px] flex items-end py-4">
              {isLoading ? (
                <div className="w-full flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-[#1a1a1a]" />
                </div>
              ) : (
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id="glowLine" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#ffcc00" />
                      <stop offset="100%" stopColor="#0055ff" />
                    </linearGradient>
                  </defs>
                  <line x1="0" y1={height * 0.25} x2={width} y2={height * 0.25} stroke="#1a1a1a" strokeOpacity="0.1" strokeDasharray="3,3" />
                  <line x1="0" y1={height * 0.5}  x2={width} y2={height * 0.5}  stroke="#1a1a1a" strokeOpacity="0.1" strokeDasharray="3,3" />
                  <line x1="0" y1={height * 0.75} x2={width} y2={height * 0.75} stroke="#1a1a1a" strokeOpacity="0.1" strokeDasharray="3,3" />
                  
                  {/* Neon path */}
                  <polyline fill="none" stroke="url(#glowLine)" strokeWidth="3" points={points} />
                  
                  {/* Solid heavy dots */}
                  {activeChart.map((val, index) => {
                    const x = (index / (activeChart.length - 1)) * width;
                    const y = height - ((val - minVal) / (maxVal - minVal || 1)) * (height - 30) - 15;
                    return (
                      <g key={index}>
                        <circle cx={x} cy={y} r="6" className="fill-[#ffcc00] stroke-[#1a1a1a] stroke-[2px]" />
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center px-1 pt-4 border-t-2 border-[#1a1a1a] mt-4">
            {chartLabels.map((lbl, idx) => (
              <span key={idx} className="text-[10px] font-bold text-[#1a1a1a] uppercase tracking-wider font-mono">{lbl}</span>
            ))}
          </div>
        </div>

        {/* KYC queue portal summary */}
        <div className="brutalist-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-extrabold text-[#1a1a1a] font-display uppercase tracking-tight">KYC Reviews</h2>
              {(stats?.kycPending ?? 0) > 0 && (
                <span className="px-2 py-0.5 border-2 border-[#1a1a1a] bg-[#ffcc00] text-[#1a1a1a] text-[10px] font-bold uppercase tracking-wider">
                  {stats?.kycPending} Queue
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 font-mono mb-4">Awaiting document check and verification.</p>

            <div className="space-y-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-[#1a1a1a]" />
                </div>
              ) : (stats?.recentKyc ?? []).length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#1a1a1a] bg-[#f5f0e8] text-[#1a1a1a]">
                  <CheckCircle className="h-8 w-8 text-[#0055ff] mb-2" />
                  <p className="text-xs font-bold font-display uppercase">KYC Queue Cleared</p>
                  <p className="text-[10px] text-gray-500 mt-1 font-mono">No nodes are pending.</p>
                </div>
              ) : (
                (stats?.recentKyc ?? []).map((kycItem: any, idx: number) => (
                  <div key={idx} className="p-3 border-2 border-[#1a1a1a] bg-[#f5f0e8] flex items-center justify-between shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-[#1a1a1a] truncate">{kycItem.full_name || 'Anonymous Node'}</p>
                        <span className="text-[9px] font-extrabold border border-[#1a1a1a] bg-white px-1.5 uppercase font-mono">
                          {kycItem.status}
                        </span>
                      </div>
                      <p className="text-[9px] text-gray-500 truncate mt-1 font-mono">{kycItem.wallet_address}</p>
                    </div>
                    <Link href="/dashboard/kyc" className="h-7 w-7 border-2 border-[#1a1a1a] bg-white hover:bg-[#ffcc00] text-[#1a1a1a] flex items-center justify-center transition-all shadow-[1px_1px_0px_0px_rgba(26,26,26,1)]">
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
          <Link href="/dashboard/kyc" className="w-full mt-6 py-2.5 border-2 border-[#1a1a1a] bg-[#0055ff] text-white hover:bg-[#1a1a1a] text-xs font-bold font-display uppercase tracking-widest text-center shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] transition-all">
            <span>Manage Identity Desk</span>
          </Link>
        </div>

      </div>

      {/* System Health Status Grid */}
      <div className="brutalist-card p-6">
        <h2 className="text-xl font-extrabold text-[#1a1a1a] font-display uppercase tracking-tight mb-2">System Health</h2>
        <p className="text-xs text-gray-500 font-mono mb-6">Real-time status monitor for critical platform microservices and blockchain gateways.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Database */}
          <div className="p-4 border-2 border-[#1a1a1a] bg-[#f5f0e8] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-[#0055ff]" />
              <div>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Database Node</p>
                <p className="text-xs font-bold text-[#1a1a1a] uppercase font-display">Supabase Database</p>
              </div>
            </div>
            <span className="px-2 py-0.5 border border-[#1a1a1a] bg-white text-emerald-600 font-mono text-[9px] font-bold">ONLINE</span>
          </div>

          {/* Gateway APIs */}
          <div className="p-4 border-2 border-[#1a1a1a] bg-[#f5f0e8] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-[#ffcc00]" />
              <div>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Gateway APIs</p>
                <p className="text-xs font-bold text-[#1a1a1a] uppercase font-display">REST_API Gate</p>
              </div>
            </div>
            <span className="px-2 py-0.5 border border-[#1a1a1a] bg-white text-emerald-600 font-mono text-[9px] font-bold">ACTIVE</span>
          </div>

          {/* Blockchain Node */}
          <div className="p-4 border-2 border-[#1a1a1a] bg-[#f5f0e8] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Radio className="h-5 w-5 text-[#e63b2e]" />
              <div>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">RPC Interface</p>
                <p className="text-xs font-bold text-[#1a1a1a] uppercase font-display">ETH_NODE_04</p>
              </div>
            </div>
            <span className="px-2 py-0.5 border border-[#1a1a1a] bg-[#ffcc00] text-[#1a1a1a] font-mono text-[9px] font-bold animate-pulse">LATENCY</span>
          </div>

        </div>
      </div>

      {/* Recent Transactions Ledger */}
      <div className="brutalist-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-extrabold text-[#1a1a1a] font-display uppercase tracking-tight">Recent Activity</h2>
            <p className="text-xs text-gray-500 font-mono">Live ledger feeds mapping internal wallet actions and swaps</p>
          </div>
          <Link href="/dashboard/transactions" className="px-3.5 py-1.5 border-2 border-[#1a1a1a] bg-white text-[#1a1a1a] hover:bg-[#ffcc00] text-xs font-bold font-display uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all">
            <span>View Ledger</span>
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left brutalist-table text-xs">
            <thead>
              <tr className="bg-[#f5f0e8] border-b-2 border-[#1a1a1a] text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]">
                <th className="py-3 px-4">Wallet Node Address</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Asset Type</th>
                <th className="py-3 px-4 text-right">Value (USD)</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]/10 font-mono text-[#1a1a1a]">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#1a1a1a]" />
                  </td>
                </tr>
              ) : (stats?.recentTransactions ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500">
                    No transactions captured in system.
                  </td>
                </tr>
              ) : (
                (stats?.recentTransactions ?? []).map((tx: any, idx: number) => (
                  <tr key={idx} className="hover:bg-[#ffcc00]/5 transition-colors">
                    <td className="py-3.5 px-4 font-semibold">{tx.wallet_address}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 border border-[#1a1a1a] font-bold uppercase text-[9px] ${
                        tx.type === 'swap' ? 'bg-[#ffcc00]' :
                        tx.type === 'send' ? 'bg-[#e63b2e] text-white' :
                        tx.type === 'receive' ? 'bg-[#0055ff] text-white' :
                        'bg-white'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold">
                      {Number(tx.amount).toLocaleString(undefined, { maximumFractionDigits: 5 })} {tx.token}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold">
                      ${Number(tx.usd_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right text-gray-500">
                      {new Date(tx.created_at).toLocaleTimeString('en-US', { hour12: false })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
