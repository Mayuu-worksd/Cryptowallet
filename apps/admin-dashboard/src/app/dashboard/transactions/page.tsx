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
  RefreshCw as SwapIcon,
  CreditCard,
  Layers,
  HelpCircle,
  Loader2,
  ExternalLink,
  DollarSign,
  Calendar,
  Filter,
} from 'lucide-react';

export default function TransactionsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [networkFilter, setNetworkFilter] = useState('all');
  const [tokenFilter, setTokenFilter] = useState('all');
  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<string | null>(null);

  const handleCleanDuplicates = async () => {
    setCleaning(true);
    setCleanResult(null);
    try {
      const res = await fetch('/api/admin/clean-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setCleanResult(data.message || `Deleted ${data.deleted} duplicates`);
      refetch();
    } catch (e: any) {
      setCleanResult('Error: ' + e.message);
    } finally {
      setCleaning(false);
    }
  };

  // 1. Fetch Transactions
  const { data: transactions, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-transactions'],
    queryFn: async () => {
      // Try dedicated RPC first, fallback to standard select
      const { data, error } = await supabase.rpc('admin_get_all_transactions');
      if (error) {
        console.warn('RPC admin_get_all_transactions failed, query table directly:', error.message);
        const { data: tableData, error: tableError } = await supabase
          .from('transactions')
          .select('*')
          .order('created_at', { ascending: false });
        if (tableError) throw tableError;
        return tableData || [];
      }
      return data || [];
    },
  });

  // Local filtering based on searching and filters
  const filteredTxs = (transactions || []).filter((tx: any) => {
    const term = searchTerm.toLowerCase();
    
    // Search filter
    const matchesSearch =
      tx.wallet_address.toLowerCase().includes(term) ||
      (tx.tx_hash || '').toLowerCase().includes(term) ||
      tx.token.toLowerCase().includes(term) ||
      tx.type.toLowerCase().includes(term);

    // Type filter
    const matchesType = typeFilter === 'all' || tx.type === typeFilter;

    // Network filter
    const matchesNetwork = networkFilter === 'all' || tx.network === networkFilter;

    // Token filter
    const matchesToken = tokenFilter === 'all' || tx.token.toUpperCase() === tokenFilter.toUpperCase();

    return matchesSearch && matchesType && matchesNetwork && matchesToken;
  });

  // Calculate high-level stats from filtered transactions
  const totalVolume = filteredTxs.reduce((acc: number, curr: any) => acc + Number(curr.usd_value || 0), 0);
  const totalCount = filteredTxs.length;

  return (
    <div className="space-y-8 animate-fade-in relative min-h-screen pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-3 border-[#1a1a1a] pb-6 bg-[#ffcc00] p-6 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] border-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-display uppercase leading-none">System Ledger Audit</h1>
          <p className="text-xs font-bold font-mono uppercase tracking-wider mt-2">Audit cryptographical swaps, card funding nodes, token transfers, and on-chain logs</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className="self-start brutalist-button px-4 py-2 flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]"
        >
          <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          <span>Sync Ledger</span>
        </button>
      </div>

      {/* Grid of Ledger Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        
        {/* Ledger volume */}
        <div className="brutalist-card p-4">
          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">Filtered Volume Ledger</p>
          <h4 className="text-2xl font-extrabold text-[#1a1a1a] mt-1.5 font-mono">
            ${totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h4>
        </div>

        {/* Count */}
        <div className="brutalist-card p-4 !bg-[#0055ff]/10">
          <p className="text-[9px] text-[#0055ff] font-bold uppercase tracking-wider font-mono">Filtered Entries Count</p>
          <h4 className="text-2xl font-extrabold text-[#1a1a1a] mt-1.5 font-mono">
            {totalCount.toLocaleString()} Transactions
          </h4>
        </div>

        {/* Success Rate */}
        <div className="brutalist-card p-4 !bg-[#ffcc00]/10 border-2 border-[#1a1a1a]">
          <p className="text-[9px] text-[#1a1a1a] font-bold uppercase tracking-wider font-mono">Node Sync Status</p>
          <h4 className="text-2xl font-extrabold text-[#1a1a1a] mt-1.5 font-mono">
            100% Operational
          </h4>
        </div>
      </div>

      {/* Main ledger database */}
      <div className="brutalist-card">
        
        {/* Complex Filter Dashboard */}
        <div className="p-4 border-b-3 border-[#1a1a1a] space-y-4 bg-[#f5f0e8]">
          {/* Searching */}
          <div className="relative w-full">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
              <Search className="h-4.5 w-4.5 text-[#1a1a1a]" />
            </span>
            <input
              type="text"
              placeholder="Search transaction hash signature, wallet node profile, token asset..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full brutalist-input !pl-10 focus:ring-0"
            />
          </div>

          {/* Filtering selectors */}
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
            
            <div className="flex items-center gap-2 font-bold font-display uppercase text-[#1a1a1a]">
              <Filter className="h-3.5 w-3.5" />
              <span>Filter:</span>
            </div>

            {/* Type */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="brutalist-select focus:ring-0"
            >
              <option value="all">All Types</option>
              <option value="swap">Swap Trades</option>
              <option value="send">Outbound Sends</option>
              <option value="receive">Inbound Receives</option>
              <option value="card_topup">VCC Card Funding</option>
              <option value="card_spend">VCC Physical Spend</option>
            </select>

            {/* Network */}
            <select
              value={networkFilter}
              onChange={(e) => setNetworkFilter(e.target.value)}
              className="brutalist-select focus:ring-0"
            >
              <option value="all">All Networks</option>
              <option value="Sepolia">Sepolia ETH Testnet</option>
              <option value="Tron Nile">Tron Nile Testnet</option>
              <option value="Mainnet">Ethereum Mainnet</option>
              <option value="TRON">Tron Mainnet</option>
            </select>

            {/* Token */}
            <select
              value={tokenFilter}
              onChange={(e) => setTokenFilter(e.target.value)}
              className="brutalist-select focus:ring-0"
            >
              <option value="all">All Tokens</option>
              <option value="USDT">USDT Stablecoin</option>
              <option value="USDC">USDC Stablecoin</option>
              <option value="ETH">ETH Ethereum</option>
              <option value="TRX">TRX Tron Token</option>
              <option value="BNB">BNB Binance</option>
              <option value="BTC">BTC Bitcoin</option>
              <option value="SOL">SOL Solana</option>
            </select>

            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest ml-auto font-mono">
              Audited Ledger: {filteredTxs.length}
            </span>

          </div>
        </div>

        {/* Ledger Grid */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-[#f5f0e8] border-b-2 border-[#1a1a1a] text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]">
                <th className="py-3.5 px-6 border-r border-[#1a1a1a] font-display">Wallet Node Address</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Audit Action</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Network Node</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Asset Amount</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] text-right font-display">Value (USD)</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Transaction Hash</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Status</th>
                <th className="py-3.5 px-6 text-right font-display">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]/10 font-mono text-[#1a1a1a]">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-[#1a1a1a]" />
                      <span className="font-bold font-display uppercase text-xs">Syncing ledger audits...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredTxs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-[#1a1a1a] font-bold uppercase font-display">
                    No transactions mapped using these search queries.
                  </td>
                </tr>
              ) : (
                filteredTxs.map((tx: any) => {
                  const type = tx.type;
                  const status = tx.status || 'success';
                  return (
                    <tr key={tx.id} className="hover:bg-[#ffcc00]/5 transition-colors">
                      {/* Wallet Node */}
                      <td className="py-4 px-6 border-r border-[#1a1a1a]/10 font-bold">
                        {tx.wallet_address}
                      </td>

                      {/* Action */}
                      <td className="py-4 px-4 border-r border-[#1a1a1a]/10">
                        <span className={`px-2 py-0.5 border-2 border-[#1a1a1a] text-[9px] font-extrabold uppercase inline-flex items-center gap-1 ${
                          type === 'swap' ? 'bg-[#ffcc00] text-[#1a1a1a]' :
                          type === 'send' ? 'bg-[#e63b2e] text-white' :
                          type === 'receive' ? 'bg-[#0055ff] text-white' :
                          type === 'card_topup' ? 'bg-white text-[#1a1a1a]' :
                          'bg-[#f5f0e8] text-[#1a1a1a]'
                        }`}>
                          {type === 'swap' && <SwapIcon className="h-2.5 w-2.5" />}
                          {type === 'send' && <ArrowUpRight className="h-2.5 w-2.5" />}
                          {type === 'receive' && <ArrowDownLeft className="h-2.5 w-2.5" />}
                          {type === 'card_topup' && <CreditCard className="h-2.5 w-2.5" />}
                          {type === 'card_spend' && <DollarSign className="h-2.5 w-2.5" />}
                          <span>{type}</span>
                        </span>
                      </td>

                      {/* Network */}
                      <td className="py-4 px-4 border-r border-[#1a1a1a]/10 font-bold">
                        {tx.network || 'Sepolia'}
                      </td>

                      {/* Amount */}
                      <td className="py-4 px-4 border-r border-[#1a1a1a]/10">
                        <div className="flex items-center gap-1 font-bold">
                          <span className="text-[#1a1a1a]">{Number(tx.amount).toLocaleString(undefined, { maximumFractionDigits: 5 })}</span>
                          <span className="text-gray-500">{tx.token}</span>
                        </div>
                      </td>

                      {/* Value USD */}
                      <td className="py-4 px-4 border-r border-[#1a1a1a]/10 text-right font-bold text-[#1a1a1a]">
                        ${Number(tx.usd_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Tx Hash */}
                      <td className="py-4 px-4 border-r border-[#1a1a1a]/10 font-bold">
                        {tx.tx_hash ? (
                          <span className="text-[#0055ff] hover:underline cursor-pointer flex items-center gap-1 font-semibold">
                            {tx.tx_hash.slice(0, 14)}...
                            <ExternalLink className="h-3 w-3" />
                          </span>
                        ) : (
                          <span className="text-gray-500 font-bold uppercase text-[9px] border border-dashed border-[#1a1a1a] px-1.5 py-0.2 bg-white">Internal top-up ledger</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 border-r border-[#1a1a1a]/10">
                        <span className={`px-2 py-0.5 border-2 border-[#1a1a1a] text-[9px] font-extrabold uppercase ${
                          status === 'success' || status === 'completed'
                            ? 'bg-[#ffcc00] text-[#1a1a1a]'
                            : 'bg-[#e63b2e] text-white'
                        }`}>
                          {status}
                        </span>
                      </td>

                      {/* Timestamp */}
                      <td className="py-4 px-6 text-right font-bold text-gray-500 font-mono">
                        {new Date(tx.created_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
