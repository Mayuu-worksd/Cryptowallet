'use client';
export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, getKYCSignedUrl, extractStoragePath } from '@/lib/supabase';
import {
  Store,
  Briefcase,
  Building,
  Loader2,
  Search,
  Eye,
  CheckCircle,
  XCircle,
  FileText,
  User,
  Globe,
  RefreshCw,
  X,
  CreditCard,
  Building2,
  FileCheck,
  AlertTriangle,
} from 'lucide-react';

export default function MerchantsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedMerchant, setSelectedMerchant] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState<string>('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [signedUrls, setSignedUrls] = useState<{ doc?: string; directorId?: string }>({});
  const queryClient = useQueryClient();

  const openMerchant = async (m: any) => {
    setSelectedMerchant(m);
    setAdminNotes(m.admin_notes || '');
    setSignedUrls({});
    try {
      const [doc, directorId] = await Promise.all([
        m.document_url ? getKYCSignedUrl(extractStoragePath(m.document_url)) : Promise.resolve(''),
        m.director_id_url ? getKYCSignedUrl(extractStoragePath(m.director_id_url)) : Promise.resolve(''),
      ]);
      setSignedUrls({ doc: doc || undefined, directorId: directorId || undefined });
    } catch (e) {
      console.error('Failed to generate signed URLs:', e);
    }
  };

  // 1. Fetch Business KYC applications
  const { data: merchants, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-merchants-list', statusFilter],
    queryFn: async () => {
      // Try dedicated RPC first, fallback to standard table queries
      const { data, error } = await supabase.rpc('admin_get_business_kyc', {
        p_status: statusFilter === 'all' ? null : statusFilter,
      });

      if (error) {
        console.error('RPC admin_get_business_kyc failed:', error.message);
        throw error;
      }
      return data || [];
    },
  });

  // 2. Process Business KYC Review Mutation
  const processReview = useMutation({
    mutationFn: async ({ wallet, status, notes }: { wallet: string; status: string; notes: string }) => {
      const addr = wallet.toLowerCase().trim();
      const mappedStatus = status === 'approve' ? 'approved' : 'rejected';

      const { error } = await supabase.rpc('admin_update_business_kyc', {
        p_wallet: addr,
        p_status: mappedStatus,
        p_notes: notes || null,
      });

      if (error) {
        console.error('RPC admin_update_business_kyc failed:', error.message);
        throw error;
      }

      // Automatically upgrade/revert wallet account_type
      if (mappedStatus === 'approved') {
        const { error: upgradeError } = await supabase
          .from('wallet_profiles')
          .update({ account_type: 'business' })
          .eq('wallet_address', addr);
        if (upgradeError) {
          console.warn('Failed to upgrade wallet_profile account_type:', upgradeError.message);
        }
      } else if (mappedStatus === 'rejected') {
        const { error: revertError } = await supabase
          .from('wallet_profiles')
          .update({ account_type: 'personal' })
          .eq('wallet_address', addr);
        if (revertError) {
          console.warn('Failed to revert wallet_profile account_type:', revertError.message);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-merchants-list'] });
      // Also invalidate users to reflect upgraded business status
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setSelectedMerchant(null);
      setAdminNotes('');
      setShowRejectForm(false);
    },
  });

  // Local filtering based on searching
  const filteredMerchants = (merchants || []).filter((m: any) => {
    const term = searchTerm.toLowerCase();
    return (
      m.business_name.toLowerCase().includes(term) ||
      m.wallet_address.toLowerCase().includes(term) ||
      m.registration_number.toLowerCase().includes(term) ||
      (m.director_name || '').toLowerCase().includes(term)
    );
  });

  // Count helper functions
  const countByStatus = (status: string) => {
    return (merchants || []).filter((m: any) => m.status === status).length;
  };

  return (
    <div className="space-y-8 animate-fade-in relative min-h-screen pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-3 border-[#1a1a1a] pb-6 bg-[#0055ff] p-6 text-white shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] border-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-display uppercase leading-none">Corporate Merchant Desk</h1>
          <p className="text-xs font-bold font-mono uppercase tracking-wider mt-2">Audit business applications, inspect trade registries, and authorize merchant wallets</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className="self-start brutalist-button-white px-4 py-2 flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] hover:bg-[#1a1a1a] hover:text-white"
        >
          <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          <span>Sync Registry</span>
        </button>
      </div>

      {/* Overview Stats for Merchants */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        
        {/* Total Apps */}
        <div className="brutalist-card p-4">
          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">Total Corporate Hubs</p>
          <h4 className="text-2xl font-extrabold text-[#1a1a1a] mt-1.5 font-mono">
            {isLoading ? '...' : (merchants || []).length}
          </h4>
        </div>

        {/* Pending Review */}
        <div className="brutalist-card p-4 !bg-[#ffcc00]/10">
          <p className="text-[9px] text-[#1a1a1a] font-bold uppercase tracking-wider font-mono">Awaiting Review</p>
          <h4 className="text-2xl font-extrabold text-[#1a1a1a] mt-1.5 font-mono">
            {isLoading ? '...' : countByStatus('pending') + countByStatus('under_review')}
          </h4>
        </div>

        {/* Approved Merchants */}
        <div className="brutalist-card p-4 !bg-[#ffcc00]/20">
          <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider font-mono">Authorized Corporate</p>
          <h4 className="text-2xl font-extrabold text-[#1a1a1a] mt-1.5 font-mono">
            {isLoading ? '...' : countByStatus('approved')}
          </h4>
        </div>

        {/* Rejected Hubs */}
        <div className="brutalist-card p-4 !bg-[#e63b2e]/10">
          <p className="text-[9px] text-[#e63b2e] font-bold uppercase tracking-wider font-mono">Declined Apps</p>
          <h4 className="text-2xl font-extrabold text-[#e63b2e] mt-1.5 font-mono">
            {isLoading ? '...' : countByStatus('rejected')}
          </h4>
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="brutalist-card">
        
        {/* Search & Tabs */}
        <div className="p-4 border-b-3 border-[#1a1a1a] flex flex-col md:flex-row gap-4 items-center justify-between bg-[#f5f0e8]">
          <div className="flex flex-wrap items-center gap-1.5 p-1 border-2 border-[#1a1a1a] bg-white">
            {['all', 'pending', 'under_review', 'approved', 'rejected'].map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1 text-xs font-bold uppercase font-display tracking-wider transition-all ${
                  statusFilter === filter
                    ? 'text-white bg-[#1a1a1a]'
                    : 'text-[#1a1a1a] hover:bg-[#ffcc00]/20'
                }`}
              >
                {filter.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="relative w-full md:max-w-xs">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
              <Search className="h-4 w-4 text-[#1a1a1a]" />
            </span>
            <input
              type="text"
              placeholder="Search business, reg no, wallet..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full brutalist-input !pl-9 focus:ring-0"
            />
          </div>
        </div>

        {/* Merchant table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-[#f5f0e8] border-b-2 border-[#1a1a1a] text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]">
                <th className="py-3.5 px-6 border-r border-[#1a1a1a] font-display">Company / Business Name</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Registration Number</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">VAT / TAX ID</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Managing Director</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Type / Country</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Compliance Status</th>
                <th className="py-3.5 px-6 text-right font-display">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]/10 font-mono text-[#1a1a1a]">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-[#1a1a1a]" />
                      <span className="font-bold font-display uppercase text-xs">Fetching merchant records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredMerchants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-[#1a1a1a] font-bold uppercase font-display">
                    No matching merchant profiles found in the registry.
                  </td>
                </tr>
              ) : (
                filteredMerchants.map((m: any) => (
                  <tr key={m.id} className="hover:bg-[#ffcc00]/5 transition-colors">
                    
                    {/* Name & Wallet */}
                    <td className="py-4 px-6 border-r border-[#1a1a1a]/10">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 border-2 border-[#1a1a1a] bg-[#ffcc00] flex items-center justify-center text-[#1a1a1a] font-bold font-display uppercase">
                          <Building className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#1a1a1a] font-display uppercase">{m.business_name || 'Business Entity'}</p>
                          <p className="text-[10px] text-gray-500 font-mono mt-0.5">{m.wallet_address}</p>
                        </div>
                      </div>
                    </td>

                    {/* Registration No */}
                    <td className="py-4 px-4 border-r border-[#1a1a1a]/10 font-bold font-mono">
                      {m.registration_number}
                    </td>

                    {/* VAT Tax ID */}
                    <td className="py-4 px-4 border-r border-[#1a1a1a]/10 font-bold font-mono text-gray-600">
                      {m.vat_tax_id || '---'}
                    </td>

                    {/* Director */}
                    <td className="py-4 px-4 border-r border-[#1a1a1a]/10 font-bold text-[#1a1a1a]">
                      {m.director_name || '---'}
                    </td>

                    {/* Type & Country */}
                    <td className="py-4 px-4 border-r border-[#1a1a1a]/10">
                      <div>
                        <p className="text-xs text-[#1a1a1a] font-semibold">{m.business_type}</p>
                        <p className="text-[9px] text-gray-500 font-semibold uppercase">{m.country || 'United States'}</p>
                      </div>
                    </td>

                    {/* Status badge */}
                    <td className="py-4 px-4 border-r border-[#1a1a1a]/10">
                      <span className={`px-2.5 py-0.5 border-2 border-[#1a1a1a] text-[9px] font-extrabold uppercase ${
                        m.status === 'approved' || m.status === 'verified' ? 'bg-[#ffcc00] text-[#1a1a1a]' :
                        m.status === 'rejected' ? 'bg-[#e63b2e] text-white' :
                        m.status === 'under_review' ? 'bg-[#0055ff] text-white' :
                        'bg-white text-[#1a1a1a] animate-pulse'
                      }`}>
                        {m.status}
                      </span>
                    </td>

                    {/* Operation details */}
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => openMerchant(m)}
                        className="px-3 py-1.5 brutalist-button text-xs shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] flex items-center gap-1.5"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Inspect Corporate</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ────────────────── SLIDEOUT CORPORATE AUDIT DRAWER ────────────────── */}
      {selectedMerchant && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-[#1a1a1a]/60 backdrop-blur-xs"
            onClick={() => setSelectedMerchant(null)}
          />

          <div className="relative w-full max-w-2xl h-full bg-white border-l-3 border-[#1a1a1a] shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-slide-in-right z-50">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-5 border-b-3 border-[#1a1a1a] mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 border-2 border-[#1a1a1a] bg-[#ffcc00] flex items-center justify-center text-[#1a1a1a] shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
                    <Store className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-[#1a1a1a] font-display uppercase leading-tight font-display">Corporate Merchant Hub</h2>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{selectedMerchant.wallet_address}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedMerchant(null)}
                  className="p-1.5 border-2 border-[#1a1a1a] hover:bg-[#f5f0e8] text-[#1a1a1a]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Details layout */}
                <div className="grid grid-cols-2 gap-4 font-mono">
                  <div className="p-3.5 border-2 border-[#1a1a1a] bg-[#f5f0e8] flex items-center gap-2.5">
                    <Building2 className="h-5 w-5 text-[#0055ff]" />
                    <div>
                      <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Business Name</p>
                      <p className="text-xs font-bold text-[#1a1a1a] font-display uppercase">{selectedMerchant.business_name}</p>
                    </div>
                  </div>
                  <div className="p-3.5 border-2 border-[#1a1a1a] bg-[#f5f0e8] flex items-center gap-2.5">
                    <Briefcase className="h-5 w-5 text-gray-600" />
                    <div>
                      <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Industry Scope</p>
                      <p className="text-xs font-bold text-[#1a1a1a] uppercase font-display">{selectedMerchant.business_type}</p>
                    </div>
                  </div>
                  <div className="p-3.5 border-2 border-[#1a1a1a] bg-[#f5f0e8] flex items-center gap-2.5">
                    <FileText className="h-5 w-5 text-gray-600" />
                    <div>
                      <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Registry No</p>
                      <p className="text-xs font-bold text-[#0055ff] font-mono">{selectedMerchant.registration_number}</p>
                    </div>
                  </div>
                  <div className="p-3.5 border-2 border-[#1a1a1a] bg-[#f5f0e8] flex items-center gap-2.5">
                    <FileCheck className="h-5 w-5 text-gray-600" />
                    <div>
                      <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">VAT / TAX ID</p>
                      <p className="text-xs font-bold text-[#0055ff] font-mono">{selectedMerchant.vat_tax_id || 'Unconfigured'}</p>
                    </div>
                  </div>
                  <div className="p-3.5 border-2 border-[#1a1a1a] bg-[#f5f0e8] flex items-center gap-2.5">
                    <User className="h-5 w-5 text-gray-600" />
                    <div>
                      <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Director Name</p>
                      <p className="text-xs font-bold text-[#1a1a1a] font-display uppercase">{selectedMerchant.director_name || '---'}</p>
                    </div>
                  </div>
                  <div className="p-3.5 border-2 border-[#1a1a1a] bg-[#f5f0e8] flex items-center gap-2.5">
                    <Globe className="h-5 w-5 text-gray-600" />
                    <div>
                      <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Jurisdiction</p>
                      <p className="text-xs font-bold text-[#1a1a1a] font-display uppercase">{selectedMerchant.country || 'United States'}</p>
                    </div>
                  </div>
                </div>

                {/* Corporate Address */}
                <div className="p-3.5 border-2 border-[#1a1a1a] bg-[#f5f0e8] font-mono">
                  <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mb-1">Corporate Registration Address</p>
                  <p className="text-xs text-[#1a1a1a] font-bold">{selectedMerchant.business_address || 'No registration address provided'}</p>
                </div>

                {/* Corporate Document */}
                <div className="p-4 border-2 border-[#1a1a1a] bg-white font-mono">
                  <h3 className="text-xs font-extrabold text-[#1a1a1a] uppercase tracking-wider mb-3 flex items-center gap-1.5 font-display">
                    <FileText className="h-4 w-4 text-[#0055ff]" />
                    <span>Registry Credentials Preview</span>
                  </h3>
                  
                  <div className="p-3 border-2 border-[#1a1a1a] bg-[#f5f0e8] flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#1a1a1a]">articles_of_incorporation.pdf</p>
                      <p className="text-[9px] text-gray-500 mt-1 uppercase font-semibold">Trade registry confirming corporate registration</p>
                    </div>
                    {signedUrls.doc ? (
                      <a
                        href={signedUrls.doc}
                        target="_blank"
                        rel="noreferrer"
                        className="brutalist-button px-3.5 py-1.5 text-[10px] flex items-center justify-center gap-1.5"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>View doc</span>
                      </a>
                    ) : (
                      <span className="text-[10px] text-gray-400 italic">Unuploaded</span>
                    )}
                  </div>
                </div>

                {/* Director ID Scans if any */}
                {signedUrls.directorId && (
                  <div className="p-3 border-2 border-[#1a1a1a] bg-white flex items-center justify-between font-mono">
                    <div>
                      <p className="text-xs font-bold text-[#1a1a1a]">Director Identity Document Scan</p>
                      <p className="text-[9px] text-gray-500 font-semibold uppercase mt-0.5">Government ID Check ({selectedMerchant.director_nationality})</p>
                    </div>
                    <a
                      href={signedUrls.directorId}
                      target="_blank"
                      rel="noreferrer"
                      className="brutalist-button px-3.5 py-1.5 text-[10px] !bg-[#0055ff] !text-white hover:!bg-[#1a1a1a] hover:!text-white flex items-center justify-center gap-1.5"
                    >
                      <User className="h-3.5 w-3.5" />
                      <span>View ID</span>
                    </a>
                  </div>
                )}

                {/* Remarks */}
                <div className="p-4 border-2 border-[#1a1a1a] bg-white">
                  <label className="block text-xs font-bold text-[#1a1a1a] uppercase tracking-wider mb-2 font-display">
                    Review Remarks / Corporate Remarks
                  </label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Enter trade registry verification remarks here..."
                    rows={3}
                    className="w-full brutalist-input focus:ring-0 resize-none font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Decision Footer Operations */}
            <div className="mt-8 pt-4 border-t-3 border-[#1a1a1a] bg-white">
              {showRejectForm ? (
                <div className="space-y-3 font-mono">
                  <p className="text-[10px] text-[#e63b2e] font-extrabold uppercase tracking-wider">Provide corporate rejection comments first</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowRejectForm(false)}
                      className="flex-1 brutalist-button-white py-2.5 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (!adminNotes.trim()) {
                          alert('Please supply corporate rejection comments.');
                          return;
                        }
                        processReview.mutate({ wallet: selectedMerchant.wallet_address, status: 'reject', notes: adminNotes });
                      }}
                      disabled={processReview.isPending}
                      className="flex-1 brutalist-button py-2.5 !bg-[#e63b2e] !text-white text-xs disabled:opacity-50"
                    >
                      {processReview.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin inline mr-1" />}
                      Decline Hub
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowRejectForm(true)}
                    className="flex-1 brutalist-button py-3 !bg-[#e63b2e] !text-white text-xs flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>Decline Hub</span>
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Verify corporate credentials? This will authorize corporate card issuance and activate business account type.')) {
                        processReview.mutate({ wallet: selectedMerchant.wallet_address, status: 'approve', notes: adminNotes });
                      }
                    }}
                    disabled={processReview.isPending}
                    className="flex-1 brutalist-button-blue py-3 text-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {processReview.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    <span>Authorize Corp</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
