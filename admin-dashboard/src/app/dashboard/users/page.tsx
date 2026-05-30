'use client';
export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  Search,
  User,
  Shield,
  CreditCard,
  History,
  Ban,
  CheckCircle,
  Eye,
  X,
  TrendingUp,
  MapPin,
  RefreshCw,
  Coins,
  Globe,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const queryClient = useQueryClient();

  // 1. Fetch Users
  const { data: users, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      // Try fetching via custom RPC first, fallback to standard table select
      const { data, error } = await supabase.rpc('admin_get_wallet_profiles');
      if (error) {
        console.warn('RPC admin_get_wallet_profiles failed, querying table directly:', error.message);
        const { data: tableData, error: tableError } = await supabase
          .from('wallet_profiles')
          .select('*')
          .order('created_at', { ascending: false });
        if (tableError) throw tableError;
        return tableData || [];
      }
      return data || [];
    },
  });

  // 2. Fetch selected user detailed items in parallel (cards, transactions)
  const { data: userDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['admin-user-details', selectedUser?.wallet_address],
    enabled: !!selectedUser,
    queryFn: async () => {
      const addr = selectedUser.wallet_address.toLowerCase();
      
      const { data, error } = await supabase.rpc('admin_get_user_details', { p_wallet: addr });
      
      if (error) {
        console.error('Failed to fetch user details:', error.message);
        throw error;
      }

      return {
        cards: data?.cards || [],
        vccCards: data?.vccCards || [],
        transactions: data?.transactions || [],
        kyc: data?.kyc || null,
        bkyc: data?.bkyc || null,
      };
    },
  });

  // 3. Toggle Suspension Mutation
  const toggleSuspension = useMutation({
    mutationFn: async ({ wallet, suspend }: { wallet: string; suspend: boolean }) => {
      const addr = wallet.toLowerCase().trim();
      
      // Try the dedicated RPC toggle first, fallback to standard table update
      const { error: rpcError } = await supabase.rpc('admin_toggle_user_suspension', {
        p_wallet: addr,
        p_suspend: suspend,
      });

      if (rpcError) {
        console.warn('RPC admin_toggle_user_suspension failed, direct table update:', rpcError.message);
        const { error: tableError } = await supabase
          .from('wallet_profiles')
          .update({ is_suspended: suspend })
          .eq('wallet_address', addr);
        if (tableError) throw tableError;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      // Update local selected state
      if (selectedUser && selectedUser.wallet_address === variables.wallet) {
        setSelectedUser((prev: any) => ({ ...prev, is_suspended: variables.suspend }));
      }
    },
  });
  const updateCardName = useMutation({
    mutationFn: async ({ id, isVcc, newName }: { id: string; isVcc: boolean; newName: string }) => {
      const { error } = await supabase.rpc('admin_update_cardholder_name', {
        p_card_id: id,
        p_is_vcc: isVcc,
        p_new_name: newName,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-details'] });
    },
    onError: (err: any) => {
      alert(`Failed to update name: ${err.message}`);
    }
  });

  const handleEditCardholderName = (id: string, isVcc: boolean, currentName: string) => {
    const newName = window.prompt("Enter new cardholder name (or leave empty to fallback to CARD HOLDER):", currentName);
    if (newName !== null) {
      updateCardName.mutate({ id, isVcc, newName: newName.trim().toUpperCase() });
    }
  };
  // Filter users based on search
  const filteredUsers = (users || []).filter((u: any) => {
    const term = searchTerm.toLowerCase();
    return (
      u.wallet_address.toLowerCase().includes(term) ||
      (u.wallet_name || '').toLowerCase().includes(term) ||
      (u.p2p_country || '').toLowerCase().includes(term)
    );
  });

  // Parse token balances safely
  const renderBalances = (balances: any) => {
    if (!balances) return '0.00';
    try {
      const parsed = typeof balances === 'string' ? JSON.parse(balances) : balances;
      const keys = Object.keys(parsed);
      if (keys.length === 0) return '0.00';
      return keys.map((k) => `${Number(parsed[k]).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${k}`).join(', ');
    } catch {
      return '0.00';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in relative min-h-screen pb-12">
      {/* Header and Sync Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-3 border-[#1a1a1a] pb-6 bg-[#0055ff] p-6 text-white shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] border-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-display uppercase leading-none">User Registry Node</h1>
          <p className="text-xs font-bold font-mono uppercase tracking-wider mt-2">Audit wallet balances, profiles, and enforce suspension protocols</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className="self-start brutalist-button-white px-4 py-2 flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] hover:bg-[#1a1a1a] hover:text-white"
        >
          <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          <span>Refresh Directory</span>
        </button>
      </div>

      {/* Directory Searching bar */}
      <div className="brutalist-card p-5 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
            <Search className="h-4.5 w-4.5 text-[#1a1a1a]" />
          </span>
          <input
            type="text"
            placeholder="Search wallet, profile name, or country..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full brutalist-input !pl-10 focus:ring-0 focus:border-[#1a1a1a]"
          />
        </div>
        <div className="text-xs font-bold text-[#1a1a1a] uppercase font-display border-2 border-[#1a1a1a] bg-[#ffcc00] px-3 py-1.5 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
          Directory: {filteredUsers.length} of {(users || []).length} Nodes
        </div>
      </div>

      {/* Main Table view */}
      <div className="overflow-x-auto brutalist-card">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#f5f0e8] border-b-3 border-[#1a1a1a] text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]">
              <th className="py-4 px-6 border-r-2 border-[#1a1a1a] font-display">Wallet Node Address</th>
              <th className="py-4 px-4 border-r-2 border-[#1a1a1a] font-display">Scope</th>
              <th className="py-4 px-4 border-r-2 border-[#1a1a1a] font-display">Country / Fiat</th>
              <th className="py-4 px-4 border-r-2 border-[#1a1a1a] font-display">Balances Mapped</th>
              <th className="py-4 px-4 border-r-2 border-[#1a1a1a] font-display">Status</th>
              <th className="py-4 px-6 text-right font-display">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1a1a]/10 font-mono text-[#1a1a1a]">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-[#1a1a1a]" />
                    <span className="font-bold font-display uppercase text-xs">Loading operational profiles...</span>
                  </div>
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-gray-500 font-bold uppercase font-display">
                  No registered profiles found matching the query.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u: any) => {
                const isSuspended = u.is_suspended;
                return (
                  <tr key={u.wallet_address} className="hover:bg-[#ffcc00]/5 transition-colors">
                    {/* Name & Wallet */}
                    <td className="py-4 px-6 border-r-2 border-[#1a1a1a]/10">
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 border-2 border-[#1a1a1a] flex items-center justify-center ${
                          isSuspended
                            ? 'bg-[#e63b2e] text-white'
                            : 'bg-[#ffcc00] text-[#1a1a1a]'
                        }`}>
                          <User className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#1a1a1a] font-display uppercase">
                            {u.wallet_name || 'My Wallet'}
                          </p>
                          <p className="text-[10px] text-gray-500 font-mono mt-0.5">{u.wallet_address}</p>
                        </div>
                      </div>
                    </td>

                    {/* Scope (Personal / Business) */}
                    <td className="py-4 px-4 border-r-2 border-[#1a1a1a]/10">
                      <span className={`px-2 py-0.5 border border-[#1a1a1a] text-[9px] font-extrabold uppercase ${
                        u.account_type === 'business'
                          ? 'bg-[#0055ff] text-white'
                          : 'bg-white text-[#1a1a1a]'
                      }`}>
                        {u.account_type || 'personal'}
                      </span>
                    </td>

                    {/* Country & Currency */}
                    <td className="py-4 px-4 border-r-2 border-[#1a1a1a]/10">
                      <div className="flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 text-[#1a1a1a]" />
                        <span className="font-bold">{u.p2p_country} ({u.p2p_currency})</span>
                      </div>
                    </td>

                    {/* Token balances JSONB */}
                    <td className="py-4 px-4 max-w-[220px] truncate border-r-2 border-[#1a1a1a]/10 font-bold">
                      {renderBalances(u.token_balances)}
                    </td>

                    {/* Suspension Status */}
                    <td className="py-4 px-4 border-r-2 border-[#1a1a1a]/10">
                      <span className={`px-2 py-0.5 border-2 border-[#1a1a1a] text-[9px] font-extrabold uppercase ${
                        isSuspended
                          ? 'bg-[#e63b2e] text-white'
                          : 'bg-[#f5f0e8] text-[#1a1a1a]'
                      }`}>
                        {isSuspended ? 'SUSPENDED' : 'OPERATIONAL'}
                      </span>
                    </td>

                    {/* Operation action */}
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => setSelectedUser(u)}
                        className="px-3 py-1.5 brutalist-button text-xs shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]"
                      >
                        <Eye className="h-3.5 w-3.5 inline mr-1" />
                        <span>Audit Node</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ────────────────── SLIDEOUT AUDIT DRAWER ────────────────── */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Overlay background */}
          <div
            className="fixed inset-0 bg-[#1a1a1a]/60 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setSelectedUser(null)}
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-2xl h-full bg-white border-l-3 border-[#1a1a1a] shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-slide-in-right z-50">
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-5 border-b-3 border-[#1a1a1a] mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 border-2 border-[#1a1a1a] bg-[#ffcc00] flex items-center justify-center text-[#1a1a1a] shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-[#1a1a1a] font-display uppercase leading-tight">{selectedUser.wallet_name || 'My Wallet'}</h2>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{selectedUser.wallet_address}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-1.5 border-2 border-[#1a1a1a] hover:bg-[#f5f0e8] text-[#1a1a1a] transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* suspension banner warning */}
              {selectedUser.is_suspended && (
                <div className="flex items-center gap-3 p-4 border-2 border-[#1a1a1a] bg-[#e63b2e] text-white text-xs mb-6 font-bold uppercase tracking-wider">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <span>CRITICAL ALERT: Node operations currently frozen. All swap trades and escrow updates blocked.</span>
                </div>
              )}

              {/* Detailed tabs in grid */}
              <div className="space-y-6">
                
                {/* Section A: Profile Config */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3.5 border-2 border-[#1a1a1a] bg-[#f5f0e8]">
                    <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mb-1 font-mono">Account Scope</p>
                    <p className="text-xs font-bold text-[#1a1a1a] uppercase font-display">{selectedUser.account_type || 'personal'}</p>
                  </div>
                  <div className="p-3.5 border-2 border-[#1a1a1a] bg-[#f5f0e8]">
                    <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mb-1 font-mono">P2P Location</p>
                    <p className="text-xs font-bold text-[#1a1a1a] font-display uppercase">{selectedUser.p2p_country} ({selectedUser.p2p_currency})</p>
                  </div>
                  <div className="p-3.5 border-2 border-[#1a1a1a] bg-[#f5f0e8]">
                    <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mb-1 font-mono">Tron Ledger Address</p>
                    <p className="text-xs font-mono text-[#1a1a1a] truncate font-semibold">{selectedUser.tron_address || 'Unconfigured'}</p>
                  </div>
                  <div className="p-3.5 border-2 border-[#1a1a1a] bg-[#f5f0e8]">
                    <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mb-1 font-mono">Default Network</p>
                    <p className="text-xs font-bold text-[#0055ff] uppercase font-display">{selectedUser.network || 'Sepolia'}</p>
                  </div>
                </div>

                {/* Section B: Asset Balances map */}
                <div className="p-4 border-2 border-[#1a1a1a] bg-white">
                  <h3 className="text-xs font-extrabold text-[#1a1a1a] uppercase tracking-wider mb-3 flex items-center gap-1.5 font-display">
                    <Coins className="h-4 w-4 text-[#0055ff]" />
                    <span>Cryptocurrency Node Balances</span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {(() => {
                      if (!selectedUser.token_balances) return <p className="text-xs text-gray-500 font-mono italic col-span-3">Empty balances</p>;
                      try {
                        const parsed = typeof selectedUser.token_balances === 'string' ? JSON.parse(selectedUser.token_balances) : selectedUser.token_balances;
                        const keys = Object.keys(parsed);
                        if (keys.length === 0) return <p className="text-xs text-gray-500 font-mono col-span-3">Empty balances</p>;
                        return keys.map((k) => (
                          <div key={k} className="p-2 border-2 border-[#1a1a1a] bg-[#f5f0e8] flex items-center justify-between shadow-[1px_1px_0px_0px_rgba(26,26,26,1)] font-mono">
                            <span className="text-[10px] font-bold text-gray-500">{k}</span>
                            <span className="text-xs font-extrabold text-[#1a1a1a]">{Number(parsed[k]).toLocaleString(undefined, { maximumFractionDigits: 5 })}</span>
                          </div>
                        ));
                      } catch {
                        return <p className="text-xs text-red-500 font-mono col-span-3">Parsing failed</p>;
                      }
                    })()}
                  </div>
                </div>

                {/* Section C: Linked Virtual Credit Cards (VCC) */}
                <div className="p-4 border-2 border-[#1a1a1a] bg-white">
                  <h3 className="text-xs font-extrabold text-[#1a1a1a] uppercase tracking-wider mb-3 flex items-center gap-1.5 font-display">
                    <CreditCard className="h-4 w-4 text-[#ffcc00]" />
                    <span>Linked Virtual Cards (VCC)</span>
                  </h3>
                  {isLoadingDetails ? (
                    <div className="py-4 text-center">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto text-[#1a1a1a]" />
                    </div>
                  ) : !userDetails || (userDetails.cards.length === 0 && userDetails.vccCards.length === 0) ? (
                    <p className="text-xs text-gray-500 font-mono italic">No virtual credit card nodes mapped for this wallet.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {[...(userDetails.cards || []), ...(userDetails.vccCards || [])].map((c: any, cidx: number) => {
                        const isVcc = !!c.card_status;
                        const currentName = c.holder_name || c.card_holder_name || 'CARD HOLDER';
                        return (
                          <div key={cidx} className="p-3 border-2 border-[#1a1a1a] bg-[#f5f0e8] flex items-center justify-between hover:bg-[#ffcc00]/5 transition-all">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-14 border border-[#1a1a1a] bg-white flex items-center justify-center text-[9px] font-extrabold text-[#1a1a1a] tracking-wider uppercase font-mono">
                                {c.card_type || c.card_variant || 'Classic'}
                              </div>
                              <div className="font-mono flex flex-col justify-center">
                                <p className="text-xs font-bold text-[#1a1a1a]">•••• •••• •••• {c.card_last4 || '0000'}</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-[9px] text-gray-500 font-semibold uppercase">{currentName} | EXP: {c.expiry_month || c.expiry_mm_yy}/{c.expiry_year || ''}</p>
                                  <button
                                    onClick={() => handleEditCardholderName(c.id, isVcc, currentName)}
                                    className="text-[9px] text-[#0055ff] hover:underline font-bold"
                                  >
                                    (EDIT NAME)
                                  </button>
                                </div>
                              </div>
                            </div>
                            <div className="text-right font-mono">
                              <p className="text-xs font-bold text-[#1a1a1a]">${Number(c.balance).toFixed(2)}</p>
                              <span className="text-[8px] font-extrabold border border-[#1a1a1a] bg-white text-emerald-600 px-1.5 py-0.2 uppercase">
                                {c.status || c.card_status || 'active'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Section D: Recent Transaction History */}
                <div className="p-4 border-2 border-[#1a1a1a] bg-white font-mono">
                  <h3 className="text-xs font-extrabold text-[#1a1a1a] uppercase tracking-wider mb-3 flex items-center gap-1.5 font-display">
                    <History className="h-4 w-4 text-[#0055ff]" />
                    <span>Recent Transaction History</span>
                  </h3>
                  {isLoadingDetails ? (
                    <div className="py-4 text-center">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto text-[#1a1a1a]" />
                    </div>
                  ) : !userDetails || userDetails.transactions.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">No transactions mapped for this wallet node.</p>
                  ) : (
                    <div className="max-h-[180px] overflow-y-auto space-y-2 pr-1">
                      {userDetails.transactions.map((tx: any) => (
                        <div key={tx.id} className="p-2 border border-[#1a1a1a] bg-[#f5f0e8] hover:bg-white flex items-center justify-between transition-all">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[8px] font-extrabold border border-[#1a1a1a] px-1.5 py-0.2 uppercase ${
                                tx.type === 'swap' ? 'bg-[#ffcc00]' :
                                tx.type === 'send' ? 'bg-[#e63b2e] text-white' :
                                'bg-[#0055ff] text-white'
                              }`}>
                                {tx.type}
                              </span>
                              <span className="text-[9px] text-gray-500 font-bold">{new Date(tx.created_at).toLocaleDateString()}</span>
                            </div>
                            <p className="text-[9px] text-gray-400 font-mono mt-1 font-semibold truncate max-w-[280px]">Hash: {tx.tx_hash || 'Internal Swap'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-[#1a1a1a]">{Number(tx.amount).toLocaleString()} {tx.token}</p>
                            <p className="text-[9px] text-gray-500 font-bold">${Number(tx.usd_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Audit Operations Drawer Actions */}
            <div className="mt-8 pt-4 border-t-3 border-[#1a1a1a] bg-white flex items-center gap-4">
              {selectedUser.is_suspended ? (
                <button
                  onClick={() => toggleSuspension.mutate({ wallet: selectedUser.wallet_address, suspend: false })}
                  disabled={toggleSuspension.isPending}
                  className="flex-1 brutalist-button-blue py-3 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {toggleSuspension.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  <span>REACTIVATE WALLET NODE</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (confirm(`CRITICAL CONFIRMATION: Are you sure you want to suspend wallet node ${selectedUser.wallet_address}? This will block all swap trading and escrows.`)) {
                      toggleSuspension.mutate({ wallet: selectedUser.wallet_address, suspend: true });
                    }
                  }}
                  disabled={toggleSuspension.isPending}
                  className="flex-1 brutalist-button py-3 !bg-[#e63b2e] !text-white flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {toggleSuspension.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Ban className="h-4 w-4" />
                  )}
                  <span>SUSPEND WALLET NODE</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
