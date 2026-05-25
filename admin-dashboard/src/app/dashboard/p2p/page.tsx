'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  RefreshCw,
  Search,
  Eye,
  CheckCircle,
  XCircle,
  HelpCircle,
  Loader2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Coins,
  ShieldCheck,
  Building,
  Info,
  ExternalLink,
  DollarSign,
  Gavel,
  Lock,
  X,
} from 'lucide-react';

export default function P2PPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [disputeNotes, setDisputeNotes] = useState('');
  const queryClient = useQueryClient();

  // 1. Fetch P2P Orders List
  const { data: orders, isLoading: ordersLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-p2p-orders', statusFilter],
    queryFn: async () => {
      // Try dedicated RPC first, fallback to standard select
      const { data, error } = await supabase.rpc('admin_get_all_p2p_orders');
      if (error) {
        console.warn('RPC admin_get_all_p2p_orders failed, direct query:', error.message);
        const { data: tableData, error: tableError } = await supabase
          .from('p2p_orders')
          .select('*')
          .order('created_at', { ascending: false });
        if (tableError) throw tableError;
        return tableData || [];
      }
      return data || [];
    },
  });

  // 2. Fetch Escrow Locks list
  const { data: escrowLocks, isLoading: locksLoading } = useQuery({
    queryKey: ['admin-escrow-locks'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_all_escrow_locks');
      if (error) {
        console.warn('RPC admin_get_all_escrow_locks failed, direct query:', error.message);
        const { data: tableData, error: tableError } = await supabase
          .from('escrow_locks')
          .select('*')
          .order('created_at', { ascending: false });
        if (tableError) throw tableError;
        return tableData || [];
      }
      return data || [];
    },
  });

  // 3. Resolve Dispute Mutation
  const resolveDispute = useMutation({
    mutationFn: async ({ orderId, resolution }: { orderId: string; resolution: 'release' | 'refund' }) => {
      const { error } = await supabase.rpc('admin_resolve_p2p_dispute', {
        p_order_id: orderId,
        p_resolution: resolution,
      });

      if (error) {
        console.warn('RPC admin_resolve_p2p_dispute failed, using fallback database updates:', error.message);
        // Fallback updates:
        // First get the escrow lock
        const { data: locks } = await supabase.from('escrow_locks').select('*').eq('order_id', orderId).eq('status', 'locked').maybeSingle();
        
        if (resolution === 'release') {
          if (locks) {
            await supabase.from('escrow_locks').update({ status: 'released' }).eq('id', locks.id);
          }
          const { error: orderError } = await supabase.from('p2p_orders').update({ status: 'completed' }).eq('id', orderId);
          if (orderError) throw orderError;
        } else {
          if (locks) {
            await supabase.from('escrow_locks').update({ status: 'refunded' }).eq('id', locks.id);
          }
          const { error: orderError } = await supabase.from('p2p_orders').update({ status: 'cancelled' }).eq('id', orderId);
          if (orderError) throw orderError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-p2p-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-escrow-locks'] });
      setSelectedOrder(null);
      setDisputeNotes('');
      alert('Dispute successfully resolved. Ledger updated.');
    },
  });

  // Count helper functions
  const activeOrdersCount = (orders || []).filter((o: any) => o.status === 'open' || o.status === 'in_escrow' || o.status === 'fiat_sent').length;
  const disputedCount = (orders || []).filter((o: any) => o.status === 'disputed').length;
  const lockedEscrowSum = (escrowLocks || []).filter((l: any) => l.status === 'locked').reduce((acc: number, curr: any) => acc + Number(curr.amount), 0);

  // Local filtering based on searching & tabs
  const filteredOrders = (orders || []).filter((o: any) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      o.seller_wallet.toLowerCase().includes(term) ||
      (o.buyer_wallet || '').toLowerCase().includes(term) ||
      o.token.toLowerCase().includes(term) ||
      o.fiat_currency.toLowerCase().includes(term) ||
      (o.payment_method || '').toLowerCase().includes(term);

    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'disputed') return o.status === 'disputed' && matchesSearch;
    if (statusFilter === 'escrow') return (o.status === 'in_escrow' || o.status === 'fiat_sent') && matchesSearch;
    if (statusFilter === 'completed') return o.status === 'completed' && matchesSearch;
    return matchesSearch;
  });

  return (
    <div className="space-y-8 animate-fade-in relative min-h-screen pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-3 border-[#1a1a1a] pb-6 bg-[#e63b2e] p-6 text-white shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] border-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-display uppercase leading-none">P2P Escrow & Dispute Desk</h1>
          <p className="text-xs font-bold font-mono uppercase tracking-wider mt-2">Monitor active peer trades, trace locked escrows, and adjudicate open disputes</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={ordersLoading || isRefetching}
          className="self-start brutalist-button-white px-4 py-2 flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] hover:bg-[#1a1a1a] hover:text-white"
        >
          <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          <span>Sync Escrow Ledger</span>
        </button>
      </div>

      {/* P2P Metrics widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        
        {/* Active Orders */}
        <div className="brutalist-card p-4">
          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">Active P2P Placements</p>
          <h4 className="text-2xl font-extrabold text-[#1a1a1a] mt-1.5 font-mono">
            {ordersLoading ? '...' : activeOrdersCount}
          </h4>
        </div>

        {/* Escrow Sum */}
        <div className="brutalist-card p-4 !bg-[#0055ff]/10">
          <p className="text-[9px] text-[#0055ff] font-bold uppercase tracking-wider font-mono">Locked Escrow Pool</p>
          <h4 className="text-2xl font-extrabold text-[#1a1a1a] mt-1.5 font-mono">
            {locksLoading ? '...' : `${lockedEscrowSum.toLocaleString(undefined, { maximumFractionDigits: 4 })} Token Units`}
          </h4>
        </div>

        {/* Disputed Trades */}
        <div className="brutalist-card p-4 !bg-[#e63b2e]/10">
          <p className="text-[9px] text-[#e63b2e] font-bold uppercase tracking-wider font-mono">Disputed Trades</p>
          <h4 className="text-2xl font-extrabold text-[#e63b2e] mt-1.5 font-mono">
            {ordersLoading ? '...' : disputedCount}
          </h4>
        </div>
      </div>

      {/* Main Monitoring Desk */}
      <div className="brutalist-card">
        
        {/* Filter Toolbar */}
        <div className="p-4 border-b-3 border-[#1a1a1a] flex flex-col md:flex-row gap-4 items-center justify-between bg-[#f5f0e8]">
          <div className="flex flex-wrap items-center gap-1.5 p-1 border-2 border-[#1a1a1a] bg-white">
            {[
              { name: 'All Orders', id: 'all' },
              { name: 'Active Escrow', id: 'escrow' },
              { name: 'Disputes Only', id: 'disputed' },
              { name: 'Completed', id: 'completed' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1 text-xs font-bold uppercase font-display tracking-wider transition-all ${
                  statusFilter === tab.id
                    ? 'text-white bg-[#1a1a1a]'
                    : 'text-[#1a1a1a] hover:bg-[#ffcc00]/20'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>

          <div className="relative w-full md:max-w-xs">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
              <Search className="h-4 w-4 text-[#1a1a1a]" />
            </span>
            <input
              type="text"
              placeholder="Search wallet, asset, fiat..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full brutalist-input pl-9 focus:ring-0"
            />
          </div>
        </div>

        {/* P2P Orders Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-[#f5f0e8] border-b-2 border-[#1a1a1a] text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]">
                <th className="py-3.5 px-6 border-r border-[#1a1a1a] font-display">Seller Wallet Node</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Buyer Wallet Node</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Crypto Placed</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] text-right font-display">Fiat Total</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Payment Gateway</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Trade Status</th>
                <th className="py-3.5 px-6 text-right font-display">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]/10 font-mono text-[#1a1a1a]">
              {ordersLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-[#1a1a1a]" />
                      <span className="font-bold font-display uppercase text-xs">Loading P2P order books...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-[#1a1a1a] font-bold uppercase font-display">
                    No P2P trades mapped in this queue.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order: any) => {
                  const hasDispute = order.status === 'disputed';
                  return (
                    <tr key={order.id} className={`hover:bg-[#ffcc00]/5 transition-colors ${hasDispute ? 'bg-[#e63b2e]/5' : ''}`}>
                      
                      {/* Seller */}
                      <td className="py-4 px-6 border-r border-[#1a1a1a]/10 font-bold">
                        {order.seller_wallet}
                        {order.is_merchant && (
                          <span className="ml-1.5 text-[8px] font-extrabold border border-[#1a1a1a] bg-[#ffcc00] text-[#1a1a1a] px-1.5 py-0.2 uppercase font-mono">
                            MERCHANT
                          </span>
                        )}
                      </td>

                      {/* Buyer */}
                      <td className="py-4 px-4 border-r border-[#1a1a1a]/10 font-bold text-gray-600">
                        {order.buyer_wallet || <span className="text-gray-500 font-bold uppercase text-[9px] border border-dashed border-[#1a1a1a] px-1.5 py-0.2 bg-white">Awaiting Taker</span>}
                      </td>

                      {/* Crypto Amount */}
                      <td className="py-4 px-4 border-r border-[#1a1a1a]/10">
                        <div className="flex items-center gap-1.5 font-bold">
                          <Coins className="h-3.5 w-3.5 text-[#0055ff]" />
                          <span className="text-[#1a1a1a]">{Number(order.amount).toLocaleString(undefined, { maximumFractionDigits: 5 })}</span>
                          <span className="text-gray-500">{order.token}</span>
                        </div>
                      </td>

                      {/* Fiat Total */}
                      <td className="py-4 px-4 border-r border-[#1a1a1a]/10 text-right font-bold text-[#1a1a1a]">
                        {Number(order.fiat_total).toLocaleString()} {order.fiat_currency}
                        <p className="text-[9px] text-gray-500 mt-0.5 uppercase font-bold">Rate: {Number(order.rate).toFixed(2)}</p>
                      </td>

                      {/* Payment Method */}
                      <td className="py-4 px-4 border-r border-[#1a1a1a]/10 font-bold">
                        {order.payment_method}
                        <p className="text-[9px] text-gray-500 mt-0.5 uppercase font-bold">{order.country || 'United States'}</p>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 border-r border-[#1a1a1a]/10">
                        <span className={`px-2.5 py-0.5 border-2 border-[#1a1a1a] text-[9px] font-extrabold uppercase ${
                          order.status === 'completed' ? 'bg-[#ffcc00] text-[#1a1a1a]' :
                          order.status === 'disputed' ? 'bg-[#e63b2e] text-white animate-pulse' :
                          order.status === 'cancelled' ? 'bg-[#f5f0e8] text-[#1a1a1a]' :
                          order.status === 'open' ? 'bg-white text-gray-400' :
                          'bg-[#0055ff] text-white'
                        }`}>
                          {order.status}
                        </span>
                      </td>

                      {/* Inspect Action */}
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="px-3 py-1.5 brutalist-button text-xs shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]"
                        >
                          <Eye className="h-3.5 w-3.5 inline mr-1" />
                          <span>Audit</span>
                        </button>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ────────────────── SLIDEOUT P2P RESOLUTION DRAWER ────────────────── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-[#1a1a1a]/60 backdrop-blur-xs"
            onClick={() => setSelectedOrder(null)}
          />

          <div className="relative w-full max-w-2xl h-full bg-white border-l-3 border-[#1a1a1a] shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-slide-in-right z-50">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-5 border-b-3 border-[#1a1a1a] mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 border-2 border-[#1a1a1a] bg-[#ffcc00] flex items-center justify-center text-[#1a1a1a] shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
                    <RefreshCw className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-[#1a1a1a] font-display uppercase leading-tight">P2P Escrow Node Audit</h2>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">Order UUID: {selectedOrder.id}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-1.5 border-2 border-[#1a1a1a] hover:bg-[#f5f0e8] text-[#1a1a1a]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Dispute alert warning */}
                {selectedOrder.status === 'disputed' && (
                  <div className="p-4 border-2 border-[#1a1a1a] bg-[#e63b2e] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-3 animate-pulse">
                    <AlertTriangle className="h-6 w-6 shrink-0" />
                    <span>DISPUTED ORDER PROTOCOL: A formal dispute has been raised. Verify proof of payments before executing any release or refund overriding.</span>
                  </div>
                )}

                {/* Details layout */}
                <div className="grid grid-cols-2 gap-4 font-mono">
                  <div className="p-3.5 border-2 border-[#1a1a1a] bg-[#f5f0e8]">
                    <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mb-1">Blockchain Network</p>
                    <p className="text-xs font-bold text-[#1a1a1a] uppercase font-display">{selectedOrder.network || 'Sepolia'}</p>
                  </div>
                  <div className="p-3.5 border-2 border-[#1a1a1a] bg-[#f5f0e8]">
                    <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mb-1">Platform Swap Fee</p>
                    <p className="text-xs font-bold text-[#0055ff]">{Number(selectedOrder.platform_fee || 0).toFixed(5)} {selectedOrder.token}</p>
                  </div>
                </div>

                {/* Trade details flow */}
                <div className="p-4 border-2 border-[#1a1a1a] bg-white font-mono">
                  <h3 className="text-xs font-extrabold text-[#1a1a1a] uppercase tracking-wider mb-3 font-display">Order Flow Nodes</h3>
                  <div className="flex items-center justify-between bg-[#f5f0e8] border-2 border-[#1a1a1a] p-4 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Seller Node</p>
                      <p className="text-xs font-bold text-[#1a1a1a] truncate mt-0.5">{selectedOrder.seller_wallet}</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-[#0055ff] shrink-0 mx-4" />
                    <div className="min-w-0 flex-1 text-right">
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Buyer Node</p>
                      <p className="text-xs font-bold text-[#1a1a1a] truncate mt-0.5">{selectedOrder.buyer_wallet || 'Awaiting Taker'}</p>
                    </div>
                  </div>
                </div>

                {/* Asset & Value */}
                <div className="p-4 border-2 border-[#1a1a1a] bg-white font-mono grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mb-1">Cryptocurrency Amount</p>
                    <p className="text-lg font-extrabold text-[#1a1a1a] font-display">{Number(selectedOrder.amount).toLocaleString(undefined, { maximumFractionDigits: 5 })} {selectedOrder.token}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mb-1">Fiat Amount</p>
                    <p className="text-lg font-extrabold text-[#1a1a1a] font-display">{Number(selectedOrder.fiat_total).toLocaleString()} {selectedOrder.fiat_currency}</p>
                  </div>
                </div>

                {/* Escrow Lock Details */}
                <div className="p-4 border-2 border-[#1a1a1a] bg-white font-mono">
                  <h3 className="text-xs font-extrabold text-[#1a1a1a] uppercase tracking-wider mb-3 flex items-center gap-1.5 font-display">
                    <Lock className="h-4 w-4 text-[#0055ff]" />
                    <span>Audit Escrow Lock Record</span>
                  </h3>
                  {(() => {
                    const matchedLock = (escrowLocks || []).find((l: any) => l.order_id === selectedOrder.id);
                    if (!matchedLock) {
                      return <p className="text-xs text-gray-500 italic">No associated locked escrow contract found in registry.</p>;
                    }
                    return (
                      <div className="p-3 border-2 border-[#1a1a1a] bg-[#f5f0e8] flex items-center justify-between shadow-[1px_1px_0px_0px_rgba(26,26,26,1)]">
                        <div>
                          <p className="text-xs font-bold text-[#1a1a1a]">Escrow Lock Node</p>
                          <p className="text-[9px] text-gray-500 font-bold uppercase mt-0.5">Lock: {matchedLock.id}</p>
                          <p className="text-[9px] text-gray-500 font-bold uppercase mt-0.5">Created: {new Date(matchedLock.created_at).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-extrabold text-[#0055ff]">{Number(matchedLock.amount).toLocaleString()} {matchedLock.token}</p>
                          <span className={`px-2 py-0.2 border-2 border-[#1a1a1a] text-[9px] font-extrabold uppercase ${
                            matchedLock.status === 'locked' ? 'bg-[#ffcc00] text-[#1a1a1a]' :
                            matchedLock.status === 'released' ? 'bg-[#0055ff] text-white' :
                            'bg-[#e63b2e] text-white'
                          }`}>
                            {matchedLock.status}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Audit proof txn hashes */}
                <div className="p-4 border-2 border-[#1a1a1a] bg-white space-y-3 font-mono">
                  <h3 className="text-xs font-extrabold text-[#1a1a1a] uppercase tracking-wider font-display">On-chain Audit Signatures</h3>
                  
                  {/* Deposit Tx */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-bold uppercase text-[9px]">Deposit Transaction:</span>
                    {selectedOrder.deposit_tx_hash ? (
                      <span className="font-bold text-[#0055ff] hover:underline cursor-pointer flex items-center gap-1">
                        {selectedOrder.deposit_tx_hash.slice(0, 16)}...
                        <ExternalLink className="h-3 w-3" />
                      </span>
                    ) : (
                      <span className="text-gray-400">No deposit recorded</span>
                    )}
                  </div>

                  {/* Release Tx */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-bold uppercase text-[9px]">Release Transaction:</span>
                    {selectedOrder.release_tx_hash ? (
                      <span className="font-bold text-[#0055ff] hover:underline cursor-pointer flex items-center gap-1">
                        {selectedOrder.release_tx_hash.slice(0, 16)}...
                        <ExternalLink className="h-3 w-3" />
                      </span>
                    ) : (
                      <span className="text-gray-400">No release recorded</span>
                    )}
                  </div>
                </div>

                {/* Resolution Remarks */}
                <div className="p-4 border-2 border-[#1a1a1a] bg-white">
                  <label className="block text-xs font-bold text-[#1a1a1a] uppercase tracking-wider mb-2 font-display">
                    Disciplinary Resolution Remarks
                  </label>
                  <textarea
                    value={disputeNotes}
                    onChange={(e) => setDisputeNotes(e.target.value)}
                    placeholder="Enter details of dispute analysis, proof of payment validation, or decision reasons here..."
                    rows={3}
                    className="w-full brutalist-input focus:ring-0 resize-none font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Resolving controls footer */}
            <div className="mt-8 pt-4 border-t-3 border-[#1a1a1a] bg-white">
              {selectedOrder.status === 'disputed' ? (
                <div className="space-y-4 font-mono">
                  <div className="flex items-center gap-2 text-xs text-[#e63b2e] font-extrabold uppercase">
                    <Gavel className="h-4.5 w-4.5 text-[#e63b2e] shrink-0 animate-pulse" />
                    <span>Disciplinary Action: overriding locked P2P escrow state</span>
                  </div>
                  <div className="flex gap-4">
                    {/* Refund to Seller */}
                    <button
                      onClick={() => {
                        if (!disputeNotes.trim()) {
                          alert('Please explain the decision in the remarks field.');
                          return;
                        }
                        if (confirm('GAVEL DECISION: Are you sure you want to REFUND the locked tokens to the SELLER?')) {
                          resolveDispute.mutate({ orderId: selectedOrder.id, resolution: 'refund' });
                        }
                      }}
                      disabled={resolveDispute.isPending}
                      className="flex-1 brutalist-button py-3 !bg-[#e63b2e] !text-white text-xs disabled:opacity-50"
                    >
                      {resolveDispute.isPending && <Loader2 className="h-4 w-4 animate-spin inline mr-1" />}
                      <XCircle className="h-4 w-4 inline mr-1" />
                      <span>Refund to Seller</span>
                    </button>

                    {/* Release to Buyer */}
                    <button
                      onClick={() => {
                        if (!disputeNotes.trim()) {
                          alert('Please explain the decision in the remarks field.');
                          return;
                        }
                        if (confirm('GAVEL DECISION: Are you sure you want to FORCE RELEASE the locked tokens to the BUYER?')) {
                          resolveDispute.mutate({ orderId: selectedOrder.id, resolution: 'release' });
                        }
                      }}
                      disabled={resolveDispute.isPending}
                      className="flex-1 brutalist-button-blue py-3 text-xs disabled:opacity-50"
                    >
                      {resolveDispute.isPending && <Loader2 className="h-4 w-4 animate-spin inline mr-1" />}
                      <CheckCircle className="h-4 w-4 inline mr-1" />
                      <span>Release to Buyer</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="w-full brutalist-button-white py-2.5 text-xs text-center"
                >
                  Close Audit Panel
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
