'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAddress } from 'ethers';
import { supabase, getKYCSignedUrl, extractStoragePath } from '@/lib/supabase';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Search,
  Eye,
  CheckCircle,
  XCircle,
  FileText,
  Video,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  AlertTriangle,
  Globe,
  RefreshCw,
  X,
} from 'lucide-react';

export default function KycPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedKyc, setSelectedKyc] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState<string>('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [signedUrls, setSignedUrls] = useState<{ doc?: string; selfie?: string; video?: string }>({});
  const [urlsLoading, setUrlsLoading] = useState(false);
  const queryClient = useQueryClient();

  const openKyc = async (kyc: any) => {
    setSelectedKyc(kyc);
    setAdminNotes(kyc.admin_notes || '');
    setSignedUrls({});
    setUrlsLoading(true);
    try {
      const [doc, selfie, video] = await Promise.all([
        kyc.document_url ? getKYCSignedUrl(extractStoragePath(kyc.document_url)) : Promise.resolve(''),
        kyc.selfie_url ? getKYCSignedUrl(extractStoragePath(kyc.selfie_url)) : Promise.resolve(''),
        kyc.selfie_video_url ? getKYCSignedUrl(extractStoragePath(kyc.selfie_video_url)) : Promise.resolve(''),
      ]);
      setSignedUrls({ doc: doc || undefined, selfie: selfie || undefined, video: video || undefined });
    } catch (e: any) {
      console.error('Failed to generate signed URLs for KYC documents:', e);
      alert(e?.message || 'Failed to load document URLs. They might be missing or private.');
    } finally {
      setUrlsLoading(false);
    }
  };

  // 1. Fetch KYC Stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-kyc-stats'],
    queryFn: async () => {
      const { data: allKyc, error } = await supabase.from('kyc').select('status');
      if (error) throw error;
      const kList = allKyc || [];
      return {
        total: kList.length,
        pending: kList.filter(k => k.status === 'pending').length,
        under_review: kList.filter(k => k.status === 'under_review').length,
        verified: kList.filter(k => k.status === 'verified').length,
        rejected: kList.filter(k => k.status === 'rejected').length,
      };
    },
  });

  // 2. Fetch KYC Submissions list
  const { data: submissions, isLoading: listLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-kyc-list', statusFilter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_all_kyc', {
        p_status: statusFilter === 'all' ? null : statusFilter,
      });

      if (error) {
        console.error('RPC admin_get_all_kyc failed:', error.message);
        throw error;
      }
      return data || [];
    },
  });

  // 3. Process Review Mutation (Approve/Reject)
  const processReview = useMutation({
    mutationFn: async ({ wallet, status, notes }: { wallet: string; status: string; notes: string }) => {
      const addr = wallet.trim();
      if (!isAddress(addr)) throw new Error('Invalid wallet address format (checksum failed)');
      const normalizedAddr = addr.toLowerCase();
      const mappedStatus = status === 'approve' ? 'verified' : 'rejected';
      
      if (mappedStatus === 'rejected' && (!notes || notes.trim().length < 10)) {
        throw new Error('Rejection requires at least 10 characters of remarks.');
      }
      
      const { error } = await supabase.rpc('admin_update_kyc', {
        p_wallet: normalizedAddr,
        p_status: mappedStatus,
        p_notes: notes || null,
      });

      if (error) {
        console.error('RPC admin_update_kyc failed:', error.message);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-kyc-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-kyc-list'] });
      setSelectedKyc(null);
      setAdminNotes('');
      setShowRejectForm(false);
    },
  });

  // Filter local submissions on search term
  const filteredSubmissions = (submissions || []).filter((s: any) => {
    const term = searchTerm.toLowerCase();
    return (
      (s.full_name || '').toLowerCase().includes(term) ||
      (s.wallet_address || '').toLowerCase().includes(term) ||
      (s.email || '').toLowerCase().includes(term) ||
      (s.nationality || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-8 animate-fade-in relative min-h-screen pb-12">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-3 border-[#1a1a1a] pb-6 bg-[#ffcc00] p-6 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] border-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-display uppercase leading-none">Identity & KYC Desk</h1>
          <p className="text-xs font-bold font-mono uppercase tracking-wider mt-2">Inspect compliance documentation, verify liveness nodes, and validate records</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={listLoading || isRefetching}
          className="self-start brutalist-button px-4 py-2 flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]"
        >
          <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          <span>Sync Submissions</span>
        </button>
      </div>

      {/* Row of KYC Counters */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        
        {/* Total */}
        <div className="brutalist-card p-4">
          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">Total Submissions</p>
          <h4 className="text-2xl font-extrabold text-[#1a1a1a] mt-1.5 font-mono">
            {statsLoading ? '...' : stats?.total}
          </h4>
        </div>

        {/* Pending */}
        <div className="brutalist-card p-4 !bg-[#ffcc00]/10 border-2 border-[#1a1a1a]">
          <p className="text-[9px] text-[#1a1a1a] font-bold uppercase tracking-wider font-mono">Pending Desk</p>
          <h4 className="text-2xl font-extrabold text-[#1a1a1a] mt-1.5 font-mono">
            {statsLoading ? '...' : stats?.pending}
          </h4>
        </div>

        {/* Under Review */}
        <div className="brutalist-card p-4 !bg-[#0055ff]/10">
          <p className="text-[9px] text-[#0055ff] font-bold uppercase tracking-wider font-mono">Under Review</p>
          <h4 className="text-2xl font-extrabold text-[#0055ff] mt-1.5 font-mono">
            {statsLoading ? '...' : stats?.under_review}
          </h4>
        </div>

        {/* Verified */}
        <div className="brutalist-card p-4 !bg-[#ffcc00]/20">
          <p className="text-[9px] text-[#1a1a1a] font-bold uppercase tracking-wider font-mono">Verified Nodes</p>
          <h4 className="text-2xl font-extrabold text-[#1a1a1a] mt-1.5 font-mono">
            {statsLoading ? '...' : stats?.verified}
          </h4>
        </div>

        {/* Rejected */}
        <div className="brutalist-card p-4 !bg-[#e63b2e]/10">
          <p className="text-[9px] text-[#e63b2e] font-bold uppercase tracking-wider font-mono">Rejected Desk</p>
          <h4 className="text-2xl font-extrabold text-[#e63b2e] mt-1.5 font-mono">
            {statsLoading ? '...' : stats?.rejected}
          </h4>
        </div>
      </div>

      {/* Main Content Box */}
      <div className="brutalist-card">
        
        {/* Filters and Searching Bar */}
        <div className="p-4 border-b-3 border-[#1a1a1a] flex flex-col md:flex-row gap-4 items-center justify-between bg-[#f5f0e8]">
          <div className="flex flex-wrap items-center gap-1.5 p-1 border-2 border-[#1a1a1a] bg-white">
            {['all', 'pending', 'under_review', 'verified', 'rejected'].map((filter) => (
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
              placeholder="Search name, wallet, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full brutalist-input !pl-9 focus:ring-0"
            />
          </div>
        </div>

        {/* KYC table lists */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-[#f5f0e8] border-b-2 border-[#1a1a1a] text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]">
                <th className="py-3.5 px-6 border-r border-[#1a1a1a] font-display">Profile Name / Address</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Email & Contact</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Nationality</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Doc Type</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Doc Code</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Compliance Status</th>
                <th className="py-3.5 px-6 text-right font-display">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]/10 font-mono text-[#1a1a1a]">
              {listLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-[#1a1a1a]" />
                      <span className="font-bold font-display uppercase text-xs">Fetching KYC submissions...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-[#1a1a1a] font-bold uppercase font-display">
                    No matching compliance documents in this queue.
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((kyc: any) => (
                  <tr key={kyc.id} className="hover:bg-[#ffcc00]/5 transition-colors">
                    {/* Name & Wallet */}
                    <td className="py-4 px-6 border-r border-[#1a1a1a]/10">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 border-2 border-[#1a1a1a] bg-[#ffcc00] flex items-center justify-center text-[#1a1a1a] font-bold font-display uppercase">
                          {kyc.full_name ? kyc.full_name[0] : 'K'}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#1a1a1a] font-display uppercase">{kyc.full_name || 'Unspecified Name'}</p>
                          <p className="text-[10px] text-gray-500 font-mono mt-0.5">{kyc.wallet_address}</p>
                        </div>
                      </div>
                    </td>

                    {/* Email / Phone */}
                    <td className="py-4 px-4 border-r border-[#1a1a1a]/10">
                      <div>
                        <p className="text-xs text-[#1a1a1a] font-semibold">{kyc.email || 'No email'}</p>
                        <p className="text-[9px] text-gray-500 font-semibold">{kyc.phone || 'No phone'}</p>
                      </div>
                    </td>

                    {/* Nationality */}
                    <td className="py-4 px-4 border-r border-[#1a1a1a]/10 font-bold">
                      {kyc.nationality || '—'}
                    </td>

                    {/* Doc type */}
                    <td className="py-4 px-4 border-r border-[#1a1a1a]/10">
                      <span className="px-2 py-0.5 border border-[#1a1a1a] bg-white text-[#1a1a1a] text-[9px] font-extrabold uppercase font-mono">
                        {kyc.document_type || 'Unknown'}
                      </span>
                    </td>

                    {/* Unique Code */}
                    <td className="py-4 px-4 border-r border-[#1a1a1a]/10 font-mono font-bold text-gray-600">
                      {kyc.unique_code || '---'}
                    </td>

                    {/* Status badge */}
                    <td className="py-4 px-4 border-r border-[#1a1a1a]/10">
                      <span className={`px-2.5 py-0.5 border-2 border-[#1a1a1a] text-[9px] font-extrabold uppercase ${
                        kyc.status === 'verified' ? 'bg-[#ffcc00] text-[#1a1a1a]' :
                        kyc.status === 'rejected' ? 'bg-[#e63b2e] text-white' :
                        kyc.status === 'under_review' ? 'bg-[#0055ff] text-white' :
                        'bg-white text-[#1a1a1a] animate-pulse'
                      }`}>
                        {kyc.status}
                      </span>
                    </td>

                    {/* Audit action */}
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => openKyc(kyc)}
                        className="px-3 py-1.5 brutalist-button text-xs shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] flex items-center gap-1.5"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Inspect Doc</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ────────────────── SLIDEOUT IDENTITY AUDIT PANEL ────────────────── */}
      {selectedKyc && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-[#1a1a1a]/60 backdrop-blur-xs"
            onClick={() => setSelectedKyc(null)}
          />

          <div className="relative w-full max-w-2xl h-full bg-white border-l-3 border-[#1a1a1a] shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-slide-in-right z-50">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-5 border-b-3 border-[#1a1a1a] mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 border-2 border-[#1a1a1a] bg-[#ffcc00] flex items-center justify-center text-[#1a1a1a] shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
                    <Shield className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-[#1a1a1a] font-display uppercase leading-tight">Identity Compliance Audit</h2>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{selectedKyc.wallet_address}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedKyc(null)}
                  className="p-1.5 border-2 border-[#1a1a1a] hover:bg-[#f5f0e8] text-[#1a1a1a]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Details layout */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3.5 border-2 border-[#1a1a1a] bg-[#f5f0e8] flex items-center gap-2.5">
                    <User className="h-5 w-5 text-gray-600" />
                    <div>
                      <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider font-mono">Full Name</p>
                      <p className="text-xs font-bold text-[#1a1a1a] font-display uppercase">{selectedKyc.full_name || 'Unspecified Name'}</p>
                    </div>
                  </div>
                  <div className="p-3.5 border-2 border-[#1a1a1a] bg-[#f5f0e8] flex items-center gap-2.5">
                    <Globe className="h-5 w-5 text-gray-600" />
                    <div>
                      <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider font-mono">Nationality</p>
                      <p className="text-xs font-bold text-[#1a1a1a] font-display uppercase">{selectedKyc.nationality || 'Unknown'}</p>
                    </div>
                  </div>
                  <div className="p-3.5 border-2 border-[#1a1a1a] bg-[#f5f0e8] flex items-center gap-2.5">
                    <Calendar className="h-5 w-5 text-gray-600" />
                    <div>
                      <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider font-mono">Date of Birth</p>
                      <p className="text-xs font-mono font-bold text-[#1a1a1a]">{selectedKyc.dob || 'Unknown'}</p>
                    </div>
                  </div>
                  <div className="p-3.5 border-2 border-[#1a1a1a] bg-[#f5f0e8] flex items-center gap-2.5">
                    <FileText className="h-5 w-5 text-gray-600" />
                    <div>
                      <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider font-mono">Document Code</p>
                      <p className="text-xs font-bold text-[#0055ff] font-mono">{selectedKyc.unique_code || '---'}</p>
                    </div>
                  </div>
                </div>

                {/* Section: Documents visual preview */}
                <div className="space-y-4 font-mono">
                  <h3 className="text-xs font-extrabold text-[#1a1a1a] uppercase tracking-wider flex items-center gap-1.5 font-display">
                    <FileText className="h-4 w-4 text-[#0055ff]" />
                    <span>Uploaded Identity Credentials</span>
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    
                    {/* Document ID */}
                    <div className="p-4 border-2 border-[#1a1a1a] bg-[#f5f0e8] flex flex-col justify-between h-[160px]">
                      <div>
                        <p className="text-xs font-bold text-[#1a1a1a]">1. ID Document Front</p>
                        <p className="text-[10px] text-gray-500 mt-1 uppercase font-semibold">Passport / ID Card scanned copy</p>
                      </div>
                      {urlsLoading ? (
                        <div className="mt-4 flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
                      ) : signedUrls.doc ? (
                        <a
                          href={signedUrls.doc}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 brutalist-button px-3 py-2 text-center text-[10px] flex items-center justify-center gap-1.5"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>View Doc File</span>
                        </a>
                      ) : (
                        <div className="text-[10px] text-gray-400 italic mt-4 text-center">No document uploaded</div>
                      )}
                    </div>

                    {/* Liveness Selfie */}
                    <div className="p-4 border-2 border-[#1a1a1a] bg-[#f5f0e8] flex flex-col justify-between h-[160px]">
                      <div>
                        <p className="text-xs font-bold text-[#1a1a1a]">2. Liveness Selfie</p>
                        <p className="text-[10px] text-gray-500 mt-1 uppercase font-semibold">Selfie face scan credential</p>
                      </div>
                      {urlsLoading ? (
                        <div className="mt-4 flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
                      ) : signedUrls.selfie ? (
                        <a
                          href={signedUrls.selfie}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 brutalist-button px-3 py-2 text-center text-[10px] !bg-[#0055ff] !text-white hover:!bg-[#1a1a1a] hover:!text-white flex items-center justify-center gap-1.5"
                        >
                          <User className="h-3.5 w-3.5" />
                          <span>View Selfie File</span>
                        </a>
                      ) : (
                        <div className="text-[10px] text-gray-400 italic mt-4 text-center">No selfie uploaded</div>
                      )}
                    </div>

                  </div>

                  {/* Liveness Video (if exists) */}
                  {signedUrls.video && (
                    <div className="p-3 border-2 border-[#1a1a1a] bg-[#f5f0e8] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 border border-[#1a1a1a] bg-[#ffcc00] flex items-center justify-center text-[#1a1a1a]">
                          <Video className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#1a1a1a]">3. Selfie Liveness Video</p>
                          <p className="text-[9px] text-gray-500 font-semibold uppercase">Real-time motion checklist check</p>
                        </div>
                      </div>
                      <a
                        href={signedUrls.video}
                        target="_blank"
                        rel="noreferrer"
                        className="brutalist-button px-3.5 py-1.5 text-[10px]"
                      >
                        Stream Video
                      </a>
                    </div>
                  )}
                </div>

                {/* Section: Admin Notes / Review reason */}
                <div className="p-4 border-2 border-[#1a1a1a] bg-white">
                  <label className="block text-xs font-bold text-[#1a1a1a] uppercase tracking-wider mb-2 font-display">
                    Review Remarks / Admin Remarks
                  </label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Enter compliance notes, verification logs, or rejection reason here..."
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
                  <p className="text-[10px] text-[#e63b2e] font-extrabold uppercase tracking-wider">Provide rejection remarks first (min. 10 characters)</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowRejectForm(false)}
                      className="flex-1 brutalist-button-white py-2.5 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (adminNotes.trim().length < 10) return;
                        processReview.mutate({ wallet: selectedKyc.wallet_address, status: 'reject', notes: adminNotes });
                      }}
                      disabled={processReview.isPending || adminNotes.trim().length < 10}
                      className="flex-1 brutalist-button py-2.5 !bg-[#e63b2e] !text-white text-xs disabled:opacity-50"
                    >
                      {processReview.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin inline mr-1" />}
                      Confirm Reject
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
                    <span>Reject Identity</span>
                  </button>
                  <button
                    onClick={() => setShowVerifyModal(true)}
                    disabled={processReview.isPending}
                    className="flex-1 brutalist-button-blue py-3 text-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {processReview.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    <span>Verify Identity</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Verify Confirmation Modal ── */}
      {showVerifyModal && selectedKyc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="fixed inset-0 bg-[#1a1a1a]/70" onClick={() => setShowVerifyModal(false)} />
          <div className="relative z-10 bg-white border-3 border-[#1a1a1a] shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] p-8 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 bg-[#ffcc00] border-2 border-[#1a1a1a] flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-[#1a1a1a]" />
              </div>
              <h3 className="text-lg font-extrabold text-[#1a1a1a] font-display uppercase">Confirm Verification</h3>
            </div>
            <p className="text-sm text-[#1a1a1a] font-mono mb-2">
              You are about to <strong>verify</strong> the identity of:
            </p>
            <p className="text-sm font-extrabold text-[#1a1a1a] font-display uppercase mb-1">
              {selectedKyc.full_name || 'Unspecified Name'}
            </p>
            <p className="text-[10px] text-gray-500 font-mono mb-6">{selectedKyc.wallet_address}</p>
            <p className="text-xs text-gray-600 font-mono mb-6">
              This will unlock full fiat card capabilities for this profile. This action is logged and cannot be undone without a manual override.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowVerifyModal(false)}
                className="flex-1 brutalist-button-white py-2.5 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowVerifyModal(false);
                  processReview.mutate({ wallet: selectedKyc.wallet_address, status: 'approve', notes: adminNotes });
                }}
                disabled={processReview.isPending}
                className="flex-1 brutalist-button-blue py-2.5 text-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {processReview.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                Confirm Verify
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
