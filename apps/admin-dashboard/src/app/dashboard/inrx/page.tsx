'use client';
export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  RefreshCw,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldAlert,
  Loader2,
  ExternalLink,
  Coins,
  TrendingUp,
  Activity,
  CheckCircle,
  XCircle,
  FileText
} from 'lucide-react';

export default function INRXMonitorPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Fetch INRX Transactions
  const { data: transactions, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-inrx-transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('token', 'INRX')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.warn('Failed to fetch INRX transactions:', error.message);
        return [];
      }
      return data || [];
    },
  });

  // Filter transactions
  const filteredTxs = (transactions || []).filter((tx: any) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      tx.wallet_address.toLowerCase().includes(term) ||
      (tx.to_address || '').toLowerCase().includes(term) ||
      (tx.tx_hash || '').toLowerCase().includes(term) ||
      (tx.description || '').toLowerCase().includes(term);

    const matchesType = typeFilter === 'all' || tx.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || tx.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  // Calculate metrics
  const totalVolumeINRX = filteredTxs.reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0);
  const totalVolumeUSD = filteredTxs.reduce((acc: number, curr: any) => acc + Number(curr.usd_value || 0), 0);
  const totalCount = filteredTxs.length;
  const successCount = filteredTxs.filter((tx: any) => tx.status === 'success').length;
  const failedCount = filteredTxs.filter((tx: any) => tx.status === 'failed').length;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-3 border-[#1a1a1a] pb-6 bg-[#ff6f00] p-6 text-white shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] border-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-display uppercase leading-none flex items-center gap-2">
            <Coins className="h-8 w-8 text-[#ffcc00] animate-pulse" />
            INRX Transaction Monitor
          </h1>
          <p className="text-xs font-bold font-mono uppercase tracking-wider mt-2">
            Peg Status: Live Feed · Pegged to Indian Rupee (1 INRX = ₹1 INR ≈ $0.012 USD)
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className="self-start brutalist-button-white px-6 py-2.5 flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] hover:bg-[#1a1a1a] hover:text-white transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          <span>REFRESH FEED</span>
        </button>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total INRX Volume"
          value={`₹${totalVolumeINRX.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subValue={`≈ $${totalVolumeUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`}
          icon={<TrendingUp className="h-6 w-6 text-[#ff6f00]" />}
          color="#ff6f00"
        />
        <StatCard
          label="Total Tx Count"
          value={totalCount}
          subValue="Logged INRX transfers"
          icon={<Activity className="h-6 w-6 text-[#0055ff]" />}
          color="#0055ff"
        />
        <StatCard
          label="Successful Txs"
          value={successCount}
          subValue={`${totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(1) : 0}% success rate`}
          icon={<CheckCircle className="h-6 w-6 text-[#00c853]" />}
          color="#00c853"
        />
        <StatCard
          label="Failed Txs"
          value={failedCount}
          subValue="Insufficient funds / reverts"
          icon={<XCircle className="h-6 w-6 text-[#e63b2e]" />}
          color="#e63b2e"
        />
      </div>

      {/* Filters & Search */}
      <div className="brutalist-card p-4 flex flex-col md:flex-row gap-4 items-center bg-white">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by sender, recipient address, hash, or description…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full brutalist-input pl-10 font-mono text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="brutalist-input py-2.5 px-4 text-xs font-bold uppercase tracking-wider font-mono cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="send">Sent</option>
            <option value="receive">Received</option>
            <option value="swap">Swap</option>
            <option value="card_topup">Card Top-up</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="brutalist-input py-2.5 px-4 text-xs font-bold uppercase tracking-wider font-mono cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="brutalist-card bg-white overflow-hidden">
        <div className="p-4 border-b-2 border-[#1a1a1a] bg-[#f5f0e8] flex justify-between items-center">
          <span className="font-extrabold font-display text-sm text-[#1a1a1a] uppercase tracking-wider">
            INRX Transaction History Log ({filteredTxs.length} records)
          </span>
          {isRefetching && <span className="text-xs font-mono font-bold animate-pulse text-[#ff6f00]">SYNCING...</span>}
        </div>

        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#ff6f00] mb-3" />
            <span className="font-bold text-xs font-mono text-[#1a1a1a] uppercase">Loading transactions...</span>
          </div>
        ) : filteredTxs.length === 0 ? (
          <div className="p-12 text-center border-t border-[#1a1a1a]">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="font-bold font-display text-sm text-[#1a1a1a] uppercase">No transactions matched your filters.</p>
            <p className="text-xs text-gray-500 font-mono mt-1">Try resetting search query or transaction status filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-[#1a1a1a] bg-[#fdfcfa] text-[10px] font-bold uppercase font-mono tracking-wider text-gray-500">
                  <th className="p-4">Type</th>
                  <th className="p-4">Sender / Recipient</th>
                  <th className="p-4 text-right">Amount (INRX)</th>
                  <th className="p-4 text-right">Peg Value (INR)</th>
                  <th className="p-4 text-right">USD Value</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4">Tx Hash / Details</th>
                  <th className="p-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a] font-mono text-xs">
                {filteredTxs.map((tx: any) => {
                  const isSent = tx.type === 'send';
                  const isSuccess = tx.status === 'success';
                  return (
                    <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                      {/* Type */}
                      <td className="p-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 border-2 border-[#1a1a1a] font-bold uppercase text-[9px] ${
                          isSent ? 'bg-[#ffeb3b] text-[#1a1a1a]' : 'bg-[#e0f7fa] text-[#006064]'
                        }`}>
                          {isSent ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                          {tx.type}
                        </span>
                      </td>

                      {/* Addresses */}
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <p className="font-bold flex items-center gap-1">
                            <span className="text-gray-400">From:</span>
                            <span className="truncate max-w-[120px]" title={tx.wallet_address}>
                              {tx.wallet_address.slice(0, 6)}…{tx.wallet_address.slice(-4)}
                            </span>
                          </p>
                          {tx.to_address && (
                            <p className="flex items-center gap-1 text-gray-500 text-[10px]">
                              <span>To:</span>
                              <span className="truncate max-w-[120px]" title={tx.to_address}>
                                {tx.to_address.slice(0, 6)}…{tx.to_address.slice(-4)}
                              </span>
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="p-4 text-right font-bold text-sm whitespace-nowrap">
                        {isSent ? '−' : '+'}{Number(tx.amount || 0).toFixed(2)}
                      </td>

                      {/* Peg Value */}
                      <td className="p-4 text-right font-bold text-sm text-[#ff6f00] whitespace-nowrap">
                        ₹{Number(tx.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* USD Value */}
                      <td className="p-4 text-right font-semibold text-gray-600 whitespace-nowrap">
                        ${Number(tx.usd_value || 0).toFixed(2)}
                      </td>

                      {/* Status */}
                      <td className="p-4 text-center whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-0.5 border-2 border-[#1a1a1a] text-[9px] font-bold uppercase ${
                          tx.status === 'success' ? 'bg-[#00c853] text-[#1a1a1a]' :
                          tx.status === 'failed' ? 'bg-[#e63b2e] text-white' : 'bg-[#ffcc00] text-[#1a1a1a]'
                        }`}>
                          {tx.status}
                        </span>
                      </td>

                      {/* Tx Hash & Desc */}
                      <td className="p-4 max-w-[200px]">
                        <div className="space-y-0.5">
                          <p className="font-bold text-gray-700 truncate" title={tx.description}>
                            {tx.description || 'INRX Transfer'}
                          </p>
                          {tx.tx_hash && (
                            <a
                              href={`https://sepolia.etherscan.io/tx/${tx.tx_hash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 flex items-center gap-0.5 hover:underline text-[10px]"
                            >
                              <span className="truncate max-w-[100px]">{tx.tx_hash}</span>
                              <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="p-4 text-gray-500 text-[10px] whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Sub-component for stat card
function StatCard({ label, value, subValue, icon, color }: { label: string; value: any; subValue: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="brutalist-card p-5 bg-white flex items-center justify-between gap-4">
      <div className="space-y-1">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">{label}</span>
        <h3 className="text-2xl font-extrabold font-display leading-tight" style={{ color }}>{value}</h3>
        <p className="text-[10px] text-gray-400 font-mono font-bold uppercase">{subValue}</p>
      </div>
      <div className="h-12 w-12 border-2 border-[#1a1a1a] flex items-center justify-center bg-gray-50 shrink-0 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
        {icon}
      </div>
    </div>
  );
}
