'use client';
export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  FileText,
  Landmark,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Eye,
  RefreshCw,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  X
} from 'lucide-react';

export default function FiatRequestsPage() {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Action form inputs
  const [adminNotes, setAdminNotes] = useState('');
  const [cryptoAmount, setCryptoAmount] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'active' | 'completed'>('all');

  // Fetch Requests
  const { data: requests, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-fiat-requests'],
    queryFn: async () => {
      const res = await fetch('/api/admin/fiat-queues');
      if (!res.ok) throw new Error('Failed to fetch requests');
      const data = await res.json();
      return data.requests || [];
    },
  });

  // Action Mutation
  const processMutation = useMutation({
    mutationFn: async ({ requestId, action, type, source }: {
      requestId: string;
      action: string;
      type: string;
      source: string;
    }) => {
      const res = await fetch('/api/admin/fiat-queues/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action, type })
      });
      if (!res.ok) throw new Error('Failed to process request');
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-fiat-requests'] });
      closeDrawer();
    },
    onError: (err: any) => {
      alert(`Action failed: ${err.message || 'unknown error'}`);
    }
  });

  const openReview = (req: any) => {
    setSelectedRequest(req);
    setAdminNotes(req.admin_notes || '');
    setCryptoAmount(req.crypto_amount ? req.crypto_amount.toString() : req.amount.toString());
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedRequest(null);
    setAdminNotes('');
    setCryptoAmount('');
  };

  const handleAction = (action: string) => {
    if (!selectedRequest) return;
    
    let parsedAmt = null;
    if (action === 'approve' && selectedRequest.type === 'deposit') {
      parsedAmt = parseFloat(cryptoAmount);
      if (isNaN(parsedAmt) || parsedAmt <= 0) {
        alert('Please enter a valid crypto quantity to credit');
        return;
      }
    }

    if (action === 'reject' && !adminNotes.trim()) {
      alert('Please provide notes indicating the reason for rejection');
      return;
    }

    if (confirm(`Are you sure you want to perform this action (${action.toUpperCase()}) on ticket ${selectedRequest.ticket_id}?`)) {
      processMutation.mutate({
        requestId: selectedRequest.id,
        action,
        type: selectedRequest.type,
        source: selectedRequest.source,
      });
    }
  };

  // Filter requests by active status tab
  const filteredRequests = (requests || []).filter((r: any) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return r.status === 'pending';
    if (activeTab === 'active') return r.status === 'under_review' || r.status === 'approved' || r.status === 'processing';
    if (activeTab === 'completed') return r.status === 'completed' || r.status === 'rejected' || r.status === 'failed';
    return true;
  });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-400';
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-400';
      case 'under_review': return 'bg-yellow-100 text-yellow-800 border-yellow-400';
      case 'pending': return 'bg-orange-100 text-orange-800 border-orange-400';
      case 'failed': return 'bg-red-100 text-red-800 border-red-400';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-400';
      default: return 'bg-gray-100 text-gray-800 border-gray-400';
    }
  };

  const getProofUrl = (path: string) => {
    const supabaseUrl = 'https://hxmacphgbpedazdvgdnz.supabase.co';
    return `${supabaseUrl}/storage/v1/object/public/payment-proofs/${path}`;
  };

  return (
    <div className="space-y-6">
      
      {/* Overview stats header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 border-3 border-[#1a1a1a] bg-[#fdfaf7] shadow-[4px_4px_0px_0px_#1a1a1a]">
        <div>
          <h1 className="text-xl font-black font-display text-[#1a1a1a] uppercase tracking-wider">Fiat Conversion Requests</h1>
          <p className="text-xs text-gray-500 font-mono mt-1">Settle user cash-to-crypto deposits and bank withdrawals manually</p>
        </div>
        
        <button
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className="flex items-center justify-center gap-2 px-4 py-2 border-2 border-[#1a1a1a] bg-[#00ffcc] text-black text-xs font-bold uppercase tracking-wider hover:opacity-90 active:translate-y-[1px] shadow-[2px_2px_0px_0px_#1a1a1a] transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          <span>Sync Node</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b-3 border-[#1a1a1a] bg-white">
        {(['all', 'pending', 'active', 'completed'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 border-r-3 border-[#1a1a1a] text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === tab 
                ? 'bg-[#f59e0b] text-white' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab} requests
          </button>
        ))}
      </div>

      {/* Data Grid */}
      <div className="border-3 border-[#1a1a1a] bg-white shadow-[4px_4px_0px_0px_#1a1a1a] overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b-3 border-[#1a1a1a] bg-gray-50 font-display text-xs text-[#1a1a1a] font-black uppercase tracking-wider">
              <th className="py-3 px-4 border-r-3 border-[#1a1a1a] w-32">Ticket ID</th>
              <th className="py-3 px-4 border-r-3 border-[#1a1a1a] w-32">User UID</th>
              <th className="py-3 px-4 border-r-3 border-[#1a1a1a]">User Name</th>
              <th className="py-3 px-4 border-r-3 border-[#1a1a1a] w-28">Type</th>
              <th className="py-3 px-4 border-r-3 border-[#1a1a1a] w-36 text-right">Amount</th>
              <th className="py-3 px-4 border-r-3 border-[#1a1a1a] w-32">Currency</th>
              <th className="py-3 px-4 border-r-3 border-[#1a1a1a] w-32">Status</th>
              <th className="py-3 px-4 w-24 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y-3 divide-[#1a1a1a] font-mono text-[#1a1a1a]">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="py-16 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-[#1a1a1a]" />
                    <span className="font-bold font-display uppercase text-xs">Fetching ledger tickets...</span>
                  </div>
                </td>
              </tr>
            ) : filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center text-[#1a1a1a] font-bold uppercase font-display">
                  No conversion requests match this category.
                </td>
              </tr>
            ) : (
              filteredRequests.map((req: any) => (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="py-4 px-4 border-r-3 border-[#1a1a1a] font-bold text-[#0055ff]">
                    {req.ticket_id}
                  </td>
                  <td className="py-4 px-4 border-r-3 border-[#1a1a1a] text-xs font-semibold">
                    {req.user_uid}
                  </td>
                  <td className="py-4 px-4 border-r-3 border-[#1a1a1a] text-xs font-bold font-display truncate max-w-[150px]">
                    {req.wallet_name || 'Anonymous User'}
                  </td>
                  <td className="py-4 px-4 border-r-3 border-[#1a1a1a]">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 border text-[10px] font-extrabold uppercase rounded-sm ${
                      req.type === 'deposit' 
                        ? 'bg-green-50 text-green-700 border-green-300' 
                        : 'bg-red-50 text-red-700 border-red-300'
                    }`}>
                      {req.type === 'deposit' ? (
                        <>
                          <ArrowDownLeft className="h-3 w-3" />
                          <span>Deposit</span>
                        </>
                      ) : (
                        <>
                          <ArrowUpRight className="h-3 w-3" />
                          <span>Withdraw</span>
                        </>
                      )}
                    </span>
                  </td>
                  <td className="py-4 px-4 border-r-3 border-[#1a1a1a] text-right font-bold text-xs">
                    {req.amount.toFixed(req.type === 'withdrawal' ? 4 : 2)}
                  </td>
                  <td className="py-4 px-4 border-r-3 border-[#1a1a1a] text-xs font-bold uppercase">
                    {req.type === 'deposit' ? req.fiat_currency : req.crypto_asset}
                  </td>
                  <td className="py-4 px-4 border-r-3 border-[#1a1a1a]">
                    <span className={`px-2 py-0.5 border text-[9px] font-extrabold uppercase rounded-sm ${getStatusStyle(req.status)}`}>
                      {req.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-4 px-2 text-center">
                    <button
                      onClick={() => openReview(req)}
                      className="p-1 border border-[#1a1a1a] bg-white hover:bg-gray-100 text-[#1a1a1a] cursor-pointer inline-flex items-center gap-1 text-[10px] font-bold uppercase"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Review</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Review Drawer */}
      {isDrawerOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Overlay */}
          <div className="fixed inset-0 bg-black/55 backdrop-blur-xs" onClick={closeDrawer} />
          
          {/* Drawer container */}
          <div className="relative w-full max-w-lg bg-[#fdfaf7] border-l-3 border-[#1a1a1a] shadow-2xl h-full overflow-y-auto z-50 p-6 flex flex-col justify-between">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between border-b-2 border-dashed border-[#1a1a1a] pb-4">
                <div>
                  <span className={`inline-flex px-2 py-0.5 border text-[9px] font-extrabold uppercase rounded-sm mb-1.5 ${getStatusStyle(selectedRequest.status)}`}>
                    {selectedRequest.status.replace('_', ' ')}
                  </span>
                  <h2 className="text-lg font-black font-display uppercase text-[#1a1a1a]">
                    Ticket: {selectedRequest.ticket_id}
                  </h2>
                </div>
                <button
                  onClick={closeDrawer}
                  className="p-1.5 border-2 border-[#1a1a1a] bg-white hover:bg-gray-100 text-[#1a1a1a] cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* User details */}
              <div className="p-4 border-2 border-[#1a1a1a] bg-white shadow-[2px_2px_0px_0px_#1a1a1a] space-y-2 text-xs font-mono">
                <p><span className="font-bold font-display uppercase tracking-wider text-[10px] text-gray-400 block">User UID:</span> {selectedRequest.user_uid}</p>
                <p><span className="font-bold font-display uppercase tracking-wider text-[10px] text-gray-400 block">Name:</span> {selectedRequest.wallet_name || 'Anonymous'}</p>
                <p className="truncate"><span className="font-bold font-display uppercase tracking-wider text-[10px] text-gray-400 block">Wallet Address:</span> {selectedRequest.wallet_address}</p>
              </div>

              {/* Transaction details */}
              <div className="grid grid-cols-2 gap-4 border-2 border-[#1a1a1a] p-4 bg-white shadow-[2px_2px_0px_0px_#1a1a1a]">
                <div>
                  <span className="font-bold font-display uppercase tracking-wider text-[10px] text-gray-400 block">
                    {selectedRequest.type === 'deposit' ? 'Paid Fiat' : 'Sold Crypto'}
                  </span>
                  <span className="text-sm font-black font-mono">
                    {selectedRequest.amount.toFixed(selectedRequest.type === 'withdrawal' ? 4 : 2)} {selectedRequest.type === 'deposit' ? selectedRequest.fiat_currency : selectedRequest.crypto_asset}
                  </span>
                </div>
                <div>
                  <span className="font-bold font-display uppercase tracking-wider text-[10px] text-gray-400 block">
                    {selectedRequest.type === 'deposit' ? 'Target Crypto' : 'Payout Fiat'}
                  </span>
                  <span className="text-sm font-black font-mono">
                    {selectedRequest.type === 'deposit' ? selectedRequest.crypto_asset : selectedRequest.fiat_currency}
                  </span>
                </div>
              </div>

              {/* Deposit payment proof view */}
              {selectedRequest.type === 'deposit' && selectedRequest.payment_proof_url && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black font-display uppercase tracking-widest text-[#1a1a1a]">Payment Proof Upload</h4>
                  <div className="border-2 border-[#1a1a1a] bg-white p-2 shadow-[2px_2px_0px_0px_#1a1a1a] relative group">
                    <img 
                      src={getProofUrl(selectedRequest.payment_proof_url)} 
                      alt="Payment proof screenshot" 
                      className="w-full h-auto max-h-60 object-contain border border-[#1a1a1a]"
                    />
                    <a 
                      href={getProofUrl(selectedRequest.payment_proof_url)} 
                      target="_blank" 
                      rel="noreferrer"
                      className="absolute bottom-4 right-4 bg-black text-white p-2 border border-white text-[10px] font-bold flex items-center gap-1 hover:opacity-90 transition-all uppercase"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Open Image</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Withdrawal Bank info */}
              {selectedRequest.type === 'withdrawal' && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black font-display uppercase tracking-widest text-[#1a1a1a]">Target Bank Details</h4>
                  <div className="border-2 border-[#1a1a1a] bg-white p-4 shadow-[2px_2px_0px_0px_#1a1a1a] space-y-3 text-xs font-mono">
                    <div>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Beneficiary Account Name</span>
                      <span className="font-bold text-sm">{selectedRequest.destination_name}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Receiving Bank Name</span>
                      <span className="font-bold">{selectedRequest.destination_bic} (BIC)</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Account / IBAN Number</span>
                      <span className="font-bold text-[#0055ff]">{selectedRequest.destination_iban}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Admin notes & inputs form */}
              <div className="space-y-3 border-t-2 border-dashed border-[#1a1a1a] pt-4">
                {selectedRequest.status !== 'completed' && selectedRequest.status !== 'rejected' && (
                  <>
                    {/* Deposit credit calculation */}
                    {selectedRequest.type === 'deposit' && (
                      <div>
                        <label className="block text-[10px] font-black font-display uppercase tracking-wider mb-1">
                          Crypto Settlement Quantity ({selectedRequest.crypto_asset})
                        </label>
                        <input
                          type="number"
                          step="any"
                          placeholder={`Enter ${selectedRequest.crypto_asset} to credit user`}
                          value={cryptoAmount}
                          onChange={(e) => setCryptoAmount(e.target.value)}
                          className="w-full brutalist-input text-xs font-mono"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-black font-display uppercase tracking-wider mb-1">
                        Review Comments / Audit Notes
                      </label>
                      <textarea
                        placeholder="Write audit logs or notes (rejections require reason)..."
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        className="w-full brutalist-input text-xs h-20 p-2 font-mono resize-none focus:outline-hidden"
                      />
                    </div>
                  </>
                )}

                {/* Show static notes if request is resolved */}
                {(selectedRequest.status === 'completed' || selectedRequest.status === 'rejected') && (
                  <div className="bg-white p-3 border-2 border-[#1a1a1a] shadow-[2px_2px_0px_0px_#1a1a1a]">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Resolved Audit Notes</span>
                    <p className="text-xs font-mono">{selectedRequest.admin_notes || '—'}</p>
                    {selectedRequest.crypto_amount && (
                      <p className="text-xs font-mono mt-2 font-bold text-green-700">
                        Credited Amount: {selectedRequest.crypto_amount} {selectedRequest.crypto_asset}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Actions Footer */}
            {selectedRequest.status !== 'completed' && selectedRequest.status !== 'failed' && (
              <div className="grid grid-cols-2 gap-4 border-t-2 border-dashed border-[#1a1a1a] pt-4 mt-6">
                <button
                  onClick={() => handleAction('approve')}
                  disabled={processMutation.isPending}
                  className="col-span-2 w-full py-2.5 border-2 border-[#1a1a1a] bg-[#00ffcc] text-black text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#1a1a1a] transition-all cursor-pointer disabled:opacity-50"
                >
                  Mark as Completed
                </button>
                <button
                  onClick={() => handleAction('reject')}
                  disabled={processMutation.isPending}
                  className="col-span-2 w-full py-2.5 border-2 border-[#1a1a1a] bg-[#e63b2e] text-white text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#1a1a1a] transition-all cursor-pointer disabled:opacity-50"
                >
                  Mark as Failed
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
