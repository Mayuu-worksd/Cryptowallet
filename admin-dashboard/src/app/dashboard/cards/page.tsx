'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  CreditCard, RefreshCw, Search, Eye, CheckCircle,
  XCircle, Loader2, Package, Truck, X, MapPin, DollarSign,
} from 'lucide-react';

export default function CardsPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: requests, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-card-requests', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('card_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 20000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('card_requests')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-card-requests'] });
      setSelectedRequest((prev: any) => prev ? { ...prev, status: selectedRequest?._pendingStatus } : null);
    },
  });

  const handleStatusChange = (id: string, status: string) => {
    const label = status === 'approved' ? 'APPROVE' : status === 'rejected' ? 'REJECT' : 'mark as SHIPPED';
    if (!confirm(`Are you sure you want to ${label} this card request?`)) return;
    setSelectedRequest((prev: any) => prev ? { ...prev, _pendingStatus: status } : null);
    updateStatus.mutate({ id, status });
  };

  const filtered = (requests || []).filter((r: any) => {
    const term = searchTerm.toLowerCase();
    return (
      r.wallet_address?.toLowerCase().includes(term) ||
      r.card_type?.toLowerCase().includes(term) ||
      r.country?.toLowerCase().includes(term)
    );
  });

  const countByStatus = (s: string) => (requests || []).filter((r: any) => r.status === s).length;

  const STATUS_STYLES: Record<string, string> = {
    pending:  'bg-white text-[#1a1a1a] animate-pulse',
    approved: 'bg-[#ffcc00] text-[#1a1a1a]',
    rejected: 'bg-[#e63b2e] text-white',
    shipped:  'bg-[#0055ff] text-white',
  };

  return (
    <div className="space-y-8 animate-fade-in relative min-h-screen pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-3 border-[#1a1a1a] pb-6 bg-[#ffcc00] p-6 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] border-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#1a1a1a] font-display uppercase leading-none">Physical Card Requests</h1>
          <p className="text-xs text-[#1a1a1a] font-bold mt-2 font-mono uppercase tracking-wider">Review, approve, and dispatch physical smartcard orders from verified wallets</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className="self-start brutalist-button px-4 py-2 flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]"
        >
          <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          <span>Sync Requests</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Requests', value: (requests || []).length, color: '' },
          { label: 'Pending Review', value: countByStatus('pending'), color: '!bg-[#ffcc00]/10' },
          { label: 'Approved / Shipped', value: countByStatus('approved') + countByStatus('shipped'), color: '!bg-[#0055ff]/10' },
          { label: 'Rejected', value: countByStatus('rejected'), color: '!bg-[#e63b2e]/10' },
        ].map(s => (
          <div key={s.label} className={`brutalist-card p-4 ${s.color}`}>
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">{s.label}</p>
            <h4 className="text-2xl font-extrabold text-[#1a1a1a] mt-1.5 font-mono">
              {isLoading ? '...' : s.value}
            </h4>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="brutalist-card">
        {/* Filter bar */}
        <div className="p-4 border-b-3 border-[#1a1a1a] flex flex-col md:flex-row gap-4 items-center justify-between bg-[#f5f0e8]">
          <div className="flex flex-wrap items-center gap-1.5 p-1 border-2 border-[#1a1a1a] bg-white">
            {['all', 'pending', 'approved', 'shipped', 'rejected'].map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1 text-xs font-bold uppercase font-display tracking-wider transition-all ${
                  statusFilter === f ? 'text-white bg-[#1a1a1a]' : 'text-[#1a1a1a] hover:bg-[#ffcc00]/20'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="relative w-full md:max-w-xs">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-[#1a1a1a]" />
            </span>
            <input
              type="text"
              placeholder="Search wallet, card type, country..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full brutalist-input pl-9 focus:ring-0"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-[#f5f0e8] border-b-2 border-[#1a1a1a] text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]">
                <th className="py-3.5 px-6 border-r border-[#1a1a1a] font-display">Wallet Address</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Card Type</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Country</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display text-right">Total Cost</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Submitted</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Status</th>
                <th className="py-3.5 px-6 text-right font-display">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]/10 font-mono text-[#1a1a1a]">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-[#1a1a1a]" />
                      <span className="font-bold font-display uppercase text-xs">Loading card requests...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-[#1a1a1a] font-bold uppercase font-display">
                    No card requests found.
                  </td>
                </tr>
              ) : (
                filtered.map((r: any) => (
                  <tr key={r.id} className="hover:bg-[#ffcc00]/5 transition-colors">
                    <td className="py-4 px-6 border-r border-[#1a1a1a]/10 font-bold">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 border-2 border-[#1a1a1a] bg-[#ffcc00] flex items-center justify-center text-[#1a1a1a]">
                          <CreditCard className="h-4 w-4" />
                        </div>
                        <span className="text-[10px] truncate max-w-[160px]">{r.wallet_address}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 border-r border-[#1a1a1a]/10 font-bold uppercase">{r.card_type}</td>
                    <td className="py-4 px-4 border-r border-[#1a1a1a]/10">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 text-gray-500" />
                        <span className="font-bold">{r.country}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 border-r border-[#1a1a1a]/10 text-right font-bold">
                      ${parseFloat(r.total_cost || 0).toFixed(2)}
                    </td>
                    <td className="py-4 px-4 border-r border-[#1a1a1a]/10 text-gray-500">
                      {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="py-4 px-4 border-r border-[#1a1a1a]/10">
                      <span className={`px-2.5 py-0.5 border-2 border-[#1a1a1a] text-[9px] font-extrabold uppercase ${STATUS_STYLES[r.status] ?? 'bg-white text-[#1a1a1a]'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => setSelectedRequest(r)}
                        className="px-3 py-1.5 brutalist-button text-xs shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]"
                      >
                        <Eye className="h-3.5 w-3.5 inline mr-1" />
                        <span>Review</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slideout Drawer */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-[#1a1a1a]/60 backdrop-blur-xs" onClick={() => setSelectedRequest(null)} />
          <div className="relative w-full max-w-lg h-full bg-white border-l-3 border-[#1a1a1a] shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-slide-in-right z-50">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-5 border-b-3 border-[#1a1a1a] mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 border-2 border-[#1a1a1a] bg-[#ffcc00] flex items-center justify-center text-[#1a1a1a] shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
                    <Package className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-[#1a1a1a] font-display uppercase leading-tight">Card Order Review</h2>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">ID: {selectedRequest.id}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedRequest(null)} className="p-1.5 border-2 border-[#1a1a1a] hover:bg-[#f5f0e8] text-[#1a1a1a]">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 font-mono">
                {/* Details grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Card Type', value: selectedRequest.card_type },
                    { label: 'Country', value: selectedRequest.country },
                    { label: 'Shipping Fee', value: `$${parseFloat(selectedRequest.shipping_fee || 0).toFixed(2)}` },
                    { label: 'Total Cost', value: `$${parseFloat(selectedRequest.total_cost || 0).toFixed(2)}` },
                    { label: 'Submitted', value: new Date(selectedRequest.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
                    { label: 'Current Status', value: selectedRequest.status?.toUpperCase() },
                  ].map(row => (
                    <div key={row.label} className="p-3 border-2 border-[#1a1a1a] bg-[#f5f0e8]">
                      <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mb-1">{row.label}</p>
                      <p className="text-xs font-bold text-[#1a1a1a] uppercase">{row.value}</p>
                    </div>
                  ))}
                </div>

                {/* Wallet address */}
                <div className="p-3 border-2 border-[#1a1a1a] bg-[#f5f0e8]">
                  <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mb-1">Wallet Address</p>
                  <p className="text-xs font-bold text-[#0055ff] break-all">{selectedRequest.wallet_address}</p>
                </div>

                {/* Current status badge */}
                <div className="flex items-center gap-3 p-3 border-2 border-[#1a1a1a] bg-white">
                  <span className={`px-3 py-1 border-2 border-[#1a1a1a] text-[10px] font-extrabold uppercase ${STATUS_STYLES[selectedRequest.status] ?? 'bg-white text-[#1a1a1a]'}`}>
                    {selectedRequest.status}
                  </span>
                  <p className="text-xs text-gray-500 font-mono">Current order status</p>
                </div>
              </div>
            </div>

            {/* Action footer */}
            <div className="mt-8 pt-4 border-t-3 border-[#1a1a1a] space-y-3">
              {selectedRequest.status === 'pending' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleStatusChange(selectedRequest.id, 'rejected')}
                    disabled={updateStatus.isPending}
                    className="flex-1 brutalist-button py-3 !bg-[#e63b2e] !text-white text-xs disabled:opacity-50"
                  >
                    {updateStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> : <XCircle className="h-4 w-4 inline mr-1" />}
                    Reject Order
                  </button>
                  <button
                    onClick={() => handleStatusChange(selectedRequest.id, 'approved')}
                    disabled={updateStatus.isPending}
                    className="flex-1 brutalist-button-blue py-3 text-xs disabled:opacity-50"
                  >
                    {updateStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> : <CheckCircle className="h-4 w-4 inline mr-1" />}
                    Approve Order
                  </button>
                </div>
              )}
              {selectedRequest.status === 'approved' && (
                <button
                  onClick={() => handleStatusChange(selectedRequest.id, 'shipped')}
                  disabled={updateStatus.isPending}
                  className="w-full brutalist-button-blue py-3 text-xs disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updateStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                  Mark as Shipped
                </button>
              )}
              <button onClick={() => setSelectedRequest(null)} className="w-full brutalist-button-white py-2.5 text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
