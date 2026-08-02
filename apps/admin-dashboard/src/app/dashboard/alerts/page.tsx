'use client';
export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  AlertTriangle,
  RefreshCw,
  Loader2,
  CheckCircle,
  Trash2,
  Search,
  User,
  CreditCard,
  ChevronRight,
  Check,
  ShieldAlert,
  Inbox,
} from 'lucide-react';
import Link from 'next/link';

export default function AlertsPage() {
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const queryClient = useQueryClient();

  // 1. Fetch Alerts List
  const { data: alerts, isLoading: listLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-alerts-list', typeFilter],
    queryFn: async () => {
      let query = supabase.from('admin_alerts').select('*');
      
      if (typeFilter === 'unread') {
        query = query.eq('is_read', false);
      } else if (typeFilter === 'card_lost') {
        query = query.eq('type', 'card_lost');
      } else if (typeFilter === 'card_frozen') {
        query = query.eq('type', 'card_frozen');
      } else if (typeFilter === 'card_unfrozen') {
        query = query.eq('type', 'card_unfrozen');
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) {
        console.error('Failed to fetch admin alerts:', error.message);
        throw error;
      }
      return data || [];
    },
    refetchInterval: 10000, // Poll every 10 seconds for real-time vibe
  });

  // 2. Fetch Stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-alerts-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_alerts').select('type, is_read');
      if (error) throw error;
      
      const total = data.length;
      const unread = data.filter(a => !a.is_read).length;
      const lost = data.filter(a => a.type === 'card_lost').length;
      const frozen = data.filter(a => a.type === 'card_frozen').length;
      
      return { total, unread, lost, frozen };
    },
    refetchInterval: 10000,
  });

  // 3. Mark Alert as Read Mutation
  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('admin_alerts')
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-alerts-list'] });
      queryClient.invalidateQueries({ queryKey: ['admin-alerts-stats'] });
    },
  });

  // 4. Delete Alert Mutation
  const deleteAlert = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('admin_alerts')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-alerts-list'] });
      queryClient.invalidateQueries({ queryKey: ['admin-alerts-stats'] });
    },
  });

  // 5. Mark All as Read Mutation
  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('admin_alerts')
        .update({ is_read: true })
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-alerts-list'] });
      queryClient.invalidateQueries({ queryKey: ['admin-alerts-stats'] });
    },
  });

  // 6. Clear All Read Mutation
  const clearAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('admin_alerts')
        .delete()
        .eq('is_read', true);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-alerts-list'] });
      queryClient.invalidateQueries({ queryKey: ['admin-alerts-stats'] });
    },
  });

  // Filter alerts locally on search term (wallet address or message content)
  const filteredAlerts = (alerts || []).filter((a: any) => {
    const term = searchTerm.toLowerCase();
    return (
      (a.wallet_address || '').toLowerCase().includes(term) ||
      (a.message || '').toLowerCase().includes(term) ||
      (a.type || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-8 animate-fade-in relative min-h-screen pb-12">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-3 border-[#1a1a1a] pb-6 bg-[#ffcc00] p-6 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] border-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-display uppercase leading-none flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-[#1a1a1a] stroke-[2.5]" />
            <span>Alerts &amp; Reports Desk</span>
          </h1>
          <p className="text-xs font-bold font-mono uppercase tracking-wider mt-2">
            Monitor real-time card security incidents, lost card reports, and customer freezes
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={listLoading || isRefetching}
          className="self-start brutalist-button px-4 py-2 flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]"
        >
          <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          <span>Sync Alerts</span>
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total */}
        <div className="brutalist-card p-4">
          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">Total Logged Incidents</p>
          <h4 className="text-2xl font-extrabold text-[#1a1a1a] mt-1.5 font-mono">
            {statsLoading ? '...' : stats?.total}
          </h4>
        </div>

        {/* Unread */}
        <div className="brutalist-card p-4 !bg-[#ffcc00]/10 border-2 border-[#1a1a1a]">
          <p className="text-[9px] text-[#1a1a1a] font-bold uppercase tracking-wider font-mono">Unread Notifications</p>
          <h4 className="text-2xl font-extrabold text-[#1a1a1a] mt-1.5 font-mono flex items-center gap-2">
            {statsLoading ? '...' : stats?.unread}
            {stats?.unread && stats.unread > 0 ? (
              <span className="w-2.5 h-2.5 rounded-full bg-[#e63b2e] inline-block animate-ping" />
            ) : null}
          </h4>
        </div>

        {/* Lost Card Reports */}
        <div className="brutalist-card p-4 !bg-[#e63b2e]/10">
          <p className="text-[9px] text-[#e63b2e] font-bold uppercase tracking-wider font-mono">Card Lost Reports</p>
          <h4 className="text-2xl font-extrabold text-[#e63b2e] mt-1.5 font-mono">
            {statsLoading ? '...' : stats?.lost}
          </h4>
        </div>

        {/* Card Freeze Alerts */}
        <div className="brutalist-card p-4 !bg-[#0055ff]/10">
          <p className="text-[9px] text-[#0055ff] font-bold uppercase tracking-wider font-mono">Freeze Actions</p>
          <h4 className="text-2xl font-extrabold text-[#0055ff] mt-1.5 font-mono">
            {statsLoading ? '...' : stats?.frozen}
          </h4>
        </div>
      </div>

      {/* Main log view */}
      <div className="brutalist-card">
        {/* Filters and search */}
        <div className="p-4 border-b-3 border-[#1a1a1a] flex flex-col md:flex-row gap-4 items-center justify-between bg-[#f5f0e8]">
          <div className="flex flex-wrap items-center gap-1.5 p-1 border-2 border-[#1a1a1a] bg-white">
            {[
              { id: 'all', label: 'All Log' },
              { id: 'unread', label: 'Unread Only' },
              { id: 'card_lost', label: 'Cards Lost' },
              { id: 'card_frozen', label: 'Freezes' },
              { id: 'card_unfrozen', label: 'Unfreezes' },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setTypeFilter(filter.id)}
                className={`px-3 py-1 text-xs font-bold uppercase font-display tracking-wider transition-all ${
                  typeFilter === filter.id
                    ? 'text-white bg-[#1a1a1a]'
                    : 'text-[#1a1a1a] hover:bg-[#ffcc00]/20'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:max-w-xs">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
              <Search className="h-4 w-4 text-[#1a1a1a]" />
            </span>
            <input
              type="text"
              placeholder="Search wallet or content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full brutalist-input !pl-9 focus:ring-0"
            />
          </div>
        </div>

        {/* Global actions bar */}
        <div className="px-6 py-3 border-b-2 border-[#1a1a1a] bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-gray-500 font-mono">
            Showing {filteredAlerts.length} incidents
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending || (alerts || []).filter(a => !a.is_read).length === 0}
              className="px-3 py-1.5 border-2 border-[#1a1a1a] bg-white hover:bg-[#ffcc00] text-[#1a1a1a] font-bold font-display uppercase tracking-wider transition-all disabled:opacity-50"
            >
              Mark All Read
            </button>
            <button
              onClick={() => clearAllRead.mutate()}
              disabled={clearAllRead.isPending || (alerts || []).filter(a => a.is_read).length === 0}
              className="px-3 py-1.5 border-2 border-[#1a1a1a] bg-[#e63b2e] text-white hover:bg-[#1a1a1a] font-bold font-display uppercase tracking-wider transition-all disabled:opacity-50"
            >
              Clear Read Logs
            </button>
          </div>
        </div>

        {/* Alerts table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-[#f5f0e8] border-b-2 border-[#1a1a1a] text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]">
                <th className="py-3.5 px-6 border-r border-[#1a1a1a] font-display w-[160px]">Incident Severity</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Message & Details</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Reporter Node Address</th>
                <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display text-right w-[180px]">Occurred At</th>
                <th className="py-3.5 px-6 text-right font-display w-[160px]">Operations Desk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]/10 font-mono text-[#1a1a1a]">
              {listLoading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-[#1a1a1a]" />
                      <span className="font-bold font-display uppercase text-xs">Loading incident registers...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center p-6 text-[#1a1a1a]">
                      <Inbox className="h-10 w-10 text-emerald-600 mb-2" />
                      <p className="text-xs font-bold font-display uppercase">Incident Ledger Clean</p>
                      <p className="text-[10px] text-gray-500 mt-1">No security reports matching this filter.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alert: any) => {
                  const isLost = alert.type === 'card_lost';
                  const isFrozen = alert.type === 'card_frozen';
                  const isUnread = !alert.is_read;

                  return (
                    <tr
                      key={alert.id}
                      className={`hover:bg-[#ffcc00]/5 transition-colors ${
                        isUnread ? 'bg-[#ffcc00]/3 font-semibold' : ''
                      }`}
                    >
                      {/* Severity badge */}
                      <td className="py-4 px-6 border-r border-[#1a1a1a]/10">
                        <span
                          className={`px-2 py-0.5 border-2 border-[#1a1a1a] text-[9px] font-extrabold uppercase flex items-center gap-1.5 w-fit ${
                            isLost ? 'bg-[#e63b2e] text-white shadow-[1px_1px_0px_0px_rgba(26,26,26,1)]' :
                            isFrozen ? 'bg-[#ffcc00] text-[#1a1a1a]' :
                            'bg-[#0055ff] text-white'
                          }`}
                        >
                          {isLost ? (
                            <ShieldAlert className="w-3 h-3 text-white" />
                          ) : (
                            <AlertTriangle className="w-3 h-3 text-current" />
                          )}
                          {alert.type.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Message details */}
                      <td className="py-4 px-4 border-r border-[#1a1a1a]/10 text-xs">
                        <div className="flex items-center gap-2">
                          {isUnread && (
                            <span className="w-2 h-2 bg-[#e63b2e] rounded-full shrink-0" title="Unread incident" />
                          )}
                          <span>{alert.message}</span>
                        </div>
                      </td>

                      {/* Wallet address linkable */}
                      <td className="py-4 px-4 border-r border-[#1a1a1a]/10 font-bold text-gray-700">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate max-w-[120px] md:max-w-none">{alert.wallet_address}</span>
                          <Link
                            href={`/dashboard/users?search=${alert.wallet_address}`}
                            className="p-1 border border-[#1a1a1a]/30 hover:border-[#1a1a1a] bg-white text-gray-600 hover:text-[#1a1a1a] transition-all hover:bg-[#ffcc00]/30 shadow-[1px_1px_0px_0px_rgba(26,26,26,1)]"
                            title="Inspect User Node"
                          >
                            <ChevronRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </td>

                      {/* Timestamps */}
                      <td className="py-4 px-4 border-r border-[#1a1a1a]/10 text-right text-gray-500 font-bold">
                        <div>{new Date(alert.created_at).toLocaleDateString()}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(alert.created_at).toLocaleTimeString('en-US', { hour12: false })}
                        </div>
                      </td>

                      {/* Operators Desk actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isUnread && (
                            <button
                              onClick={() => markAsRead.mutate(alert.id)}
                              disabled={markAsRead.isPending}
                              className="p-1.5 border-2 border-[#1a1a1a] bg-white hover:bg-emerald-500 hover:text-white transition-all shadow-[1.5px_1.5px_0px_0px_rgba(26,26,26,1)] active:translate-y-[1px]"
                              title="Resolve / Mark Read"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm('Delete this incident log permanently?')) {
                                deleteAlert.mutate(alert.id);
                              }
                            }}
                            disabled={deleteAlert.isPending}
                            className="p-1.5 border-2 border-[#1a1a1a] bg-white text-[#e63b2e] hover:bg-[#e63b2e] hover:text-white transition-all shadow-[1.5px_1.5px_0px_0px_rgba(26,26,26,1)] active:translate-y-[1px]"
                            title="Archive / Delete Log"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
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
