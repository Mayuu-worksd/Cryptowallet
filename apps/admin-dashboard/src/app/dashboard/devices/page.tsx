'use client';
export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  Smartphone,
  Search,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Filter,
  Layers,
  Lock,
  Unlock,
  Loader2,
  X,
  AlertTriangle,
} from 'lucide-react';

export default function AdminDevicesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'blocked' | 'active'>('all');
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockReasonInput, setBlockReasonInput] = useState('');

  // 1. Fetch devices via RPC admin_get_all_devices (or direct table fallback)
  const { data: devices, isLoading, isRefetching, isError, error, refetch } = useQuery({
    queryKey: ['admin-devices'],
    queryFn: async () => {
      const { data, error: rpcError } = await supabase.rpc('admin_get_all_devices');
      if (!rpcError && data) return data;

      // Fallback: direct table select
      const { data: tableData, error: tableError } = await supabase
        .from('registered_devices')
        .select('*')
        .order('updated_at', { ascending: false });
      if (tableError) throw tableError;
      return tableData || [];
    },
    refetchInterval: 10000,
  });

  // 2. Toggle Device Block Mutation
  const toggleDeviceBlock = useMutation({
    mutationFn: async ({ deviceId, block, reason }: { deviceId: string; block: boolean; reason?: string }) => {
      const { error: rpcError } = await supabase.rpc('admin_toggle_device_block', {
        p_device_id: deviceId.trim(),
        p_block: block,
        p_reason: reason ?? null,
      });
      if (rpcError) {
        // Fallback: direct table update
        const patch: any = {
          is_blocked: block,
          block_reason: block ? (reason || 'Device blocked by administrator') : null,
          updated_at: new Date().toISOString(),
        };
        const { error: tableError } = await supabase
          .from('registered_devices')
          .update(patch)
          .eq('device_id', deviceId.trim());
        if (tableError) throw tableError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-devices'] });
      setBlockModalOpen(false);
      setSelectedDevice(null);
      setBlockReasonInput('');
    },
    onError: (err: any) => {
      alert(`Failed to update device status: ${err.message}`);
    },
  });

  // Filter devices
  const filteredDevices = (devices || []).filter((d: any) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (d.device_id || '').toLowerCase().includes(term) ||
      (d.last_wallet_address || '').toLowerCase().includes(term) ||
      (d.platform || '').toLowerCase().includes(term) ||
      (d.block_reason || '').toLowerCase().includes(term);

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'blocked'
        ? d.is_blocked
        : !d.is_blocked;

    return matchesSearch && matchesStatus;
  });

  const handleOpenBlockModal = (device: any) => {
    setSelectedDevice(device);
    setBlockReasonInput(device.block_reason || 'Suspicious automated activity detected');
    setBlockModalOpen(true);
  };

  const handleConfirmBlock = () => {
    if (!selectedDevice) return;
    toggleDeviceBlock.mutate({
      deviceId: selectedDevice.device_id,
      block: true,
      reason: blockReasonInput.trim(),
    });
  };

  const handleUnblock = (deviceId: string) => {
    if (confirm(`Are you sure you want to unblock device: ${deviceId}?`)) {
      toggleDeviceBlock.mutate({
        deviceId,
        block: false,
      });
    }
  };

  return (
    <div className="space-y-8 animate-fade-in relative min-h-screen pb-12">
      {/* ── Brutalist Top Banner ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-3 border-[#1a1a1a] pb-6 bg-[#0055ff] p-6 text-white shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] border-3">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 border-2 border-[#1a1a1a] bg-[#ffcc00] text-[#1a1a1a] flex items-center justify-center font-bold">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight font-display uppercase leading-none">
                Hardware Device Registry
              </h1>
              <p className="text-xs font-bold font-mono uppercase tracking-wider mt-1.5 opacity-90">
                Enforce hardware-level perimeter blocks independently of wallet addresses
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className="self-start brutalist-button-white px-4 py-2 flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] hover:bg-[#1a1a1a] hover:text-white"
        >
          <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          <span>Refresh Devices</span>
        </button>
      </div>

      {/* ── Brutalist Protocol Distinction Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="brutalist-card p-5 border-l-8 border-l-[#ffcc00]">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 border-2 border-[#1a1a1a] bg-[#ffcc00] text-[#1a1a1a] flex items-center justify-center font-bold shrink-0 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <span className="font-display font-extrabold uppercase text-xs tracking-wider text-[#1a1a1a] dark:text-white">
                Device-Level Perimeter Block
              </span>
              <p className="text-xs font-mono text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                Locks down the entire app installation on that hardware UUID. Prevents creating, importing, or accessing ANY wallet on that phone.
              </p>
            </div>
          </div>
        </div>

        <div className="brutalist-card p-5 border-l-8 border-l-[#0055ff]">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 border-2 border-[#1a1a1a] bg-[#0055ff] text-white flex items-center justify-center font-bold shrink-0 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <span className="font-display font-extrabold uppercase text-xs tracking-wider text-[#1a1a1a] dark:text-white">
                Wallet-Level Account Freeze
              </span>
              <p className="text-xs font-mono text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                Managed on the <strong>Users</strong> registry. Suspends a specific public key address across all devices while leaving innocent hardware unblocked.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Directory Search & Filter Bar ── */}
      <div className="brutalist-card p-5 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
            <Search className="h-4.5 w-4.5 text-[#1a1a1a]" />
          </span>
          <input
            type="text"
            placeholder="Search Device UUID, Wallet, Platform, or Reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full brutalist-input !pl-10 focus:ring-0 focus:border-[#1a1a1a]"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex border-2 border-[#1a1a1a] p-1 bg-white dark:bg-[#201F1F] shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
            {(['all', 'blocked', 'active'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1 font-display uppercase text-[10px] font-bold transition cursor-pointer ${
                  statusFilter === filter
                    ? 'bg-[#1a1a1a] text-white dark:bg-white dark:text-[#1a1a1a]'
                    : 'text-gray-500 hover:text-[#1a1a1a] dark:hover:text-white'
                }`}
              >
                {filter === 'blocked' ? '🔴 Blocked' : filter === 'active' ? '🟢 Active' : 'All Devices'}
              </button>
            ))}
          </div>

          <div className="text-xs font-bold text-[#1a1a1a] uppercase font-display border-2 border-[#1a1a1a] bg-[#ffcc00] px-3 py-1.5 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] whitespace-nowrap">
            {filteredDevices.length} Hardware Units
          </div>
        </div>
      </div>

      {/* ── Main Brutalist Table ── */}
      <div className="overflow-x-auto brutalist-card">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#f5f0e8] border-b-3 border-[#1a1a1a] text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]">
              <th className="py-4 px-6 border-r-2 border-[#1a1a1a] font-display">Hardware Device UUID</th>
              <th className="py-4 px-4 border-r-2 border-[#1a1a1a] font-display">Platform</th>
              <th className="py-4 px-6 border-r-2 border-[#1a1a1a] font-display">Last Wallet Associated</th>
              <th className="py-4 px-4 border-r-2 border-[#1a1a1a] font-display">Security State</th>
              <th className="py-4 px-4 border-r-2 border-[#1a1a1a] font-display">Enforcement Reason</th>
              <th className="py-4 px-4 border-r-2 border-[#1a1a1a] font-display">Last Ping</th>
              <th className="py-4 px-6 text-right font-display">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1a1a]/10 font-mono text-[#1a1a1a]">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-[#1a1a1a] dark:text-white" />
                    <span className="font-bold font-display uppercase text-xs">Querying hardware registry...</span>
                  </div>
                </td>
              </tr>
            ) : filteredDevices.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-gray-500 font-bold uppercase font-display">
                  No matching hardware instances registered.
                </td>
              </tr>
            ) : (
              filteredDevices.map((d: any) => {
                const isBlocked = d.is_blocked;
                return (
                  <tr key={d.device_id} className="hover:bg-[#ffcc00]/5 transition-colors">
                    {/* Device ID */}
                    <td className="py-4 px-6 border-r-2 border-[#1a1a1a]/10">
                      <div className="flex items-center gap-2 font-mono font-bold text-xs text-[#0055ff]">
                        <Smartphone className="h-4 w-4 text-[#1a1a1a] dark:text-white shrink-0" />
                        <span className="truncate max-w-[220px]" title={d.device_id}>{d.device_id}</span>
                      </div>
                    </td>

                    {/* Platform */}
                    <td className="py-4 px-4 border-r-2 border-[#1a1a1a]/10">
                      <span className="px-2 py-0.5 border border-[#1a1a1a] bg-white dark:bg-[#201F1F] text-[#1a1a1a] dark:text-white text-[9px] font-extrabold uppercase shadow-[1px_1px_0px_0px_rgba(26,26,26,1)]">
                        {d.platform || 'UNKNOWN'}
                      </span>
                    </td>

                    {/* Associated Wallet */}
                    <td className="py-4 px-6 border-r-2 border-[#1a1a1a]/10">
                      {d.last_wallet_address ? (
                        <span className="font-mono text-xs text-gray-600 dark:text-gray-300 font-bold" title={d.last_wallet_address}>
                          {d.last_wallet_address.slice(0, 10)}...{d.last_wallet_address.slice(-8)}
                        </span>
                      ) : (
                        <span className="text-gray-400 font-mono text-[10px] italic">No active wallet</span>
                      )}
                    </td>

                    {/* Security State */}
                    <td className="py-4 px-4 border-r-2 border-[#1a1a1a]/10">
                      {isBlocked ? (
                        <span className="px-2 py-0.5 border border-[#1a1a1a] bg-[#e63b2e] text-white text-[9px] font-extrabold uppercase shadow-[1px_1px_0px_0px_rgba(26,26,26,1)]">
                          ⛔ BLOCKED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 border border-[#1a1a1a] bg-[#00C853] text-white text-[9px] font-extrabold uppercase shadow-[1px_1px_0px_0px_rgba(26,26,26,1)]">
                          ✓ ACTIVE
                        </span>
                      )}
                    </td>

                    {/* Block Reason */}
                    <td className="py-4 px-4 border-r-2 border-[#1a1a1a]/10">
                      <span className="text-[11px] text-gray-500 font-mono truncate max-w-[180px] block">
                        {d.block_reason || '—'}
                      </span>
                    </td>

                    {/* Last Ping */}
                    <td className="py-4 px-4 border-r-2 border-[#1a1a1a]/10 font-mono text-[10px] text-gray-500">
                      {d.updated_at ? new Date(d.updated_at).toLocaleString() : '—'}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right">
                      {isBlocked ? (
                        <button
                          onClick={() => handleUnblock(d.device_id)}
                          disabled={toggleDeviceBlock.isPending}
                          className="px-3 py-1 bg-[#00C853] hover:bg-[#009624] text-white border-2 border-[#1a1a1a] font-display uppercase font-bold text-[10px] shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] transition cursor-pointer"
                        >
                          <Unlock className="h-3 w-3 inline mr-1" />
                          Unblock
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenBlockModal(d)}
                          disabled={toggleDeviceBlock.isPending}
                          className="px-3 py-1 bg-[#e63b2e] hover:bg-[#b71c1c] text-white border-2 border-[#1a1a1a] font-display uppercase font-bold text-[10px] shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] transition cursor-pointer"
                        >
                          <Lock className="h-3 w-3 inline mr-1" />
                          Block
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Brutalist Block Confirmation Modal ── */}
      {blockModalOpen && selectedDevice && (
        <div className="fixed inset-0 z-50 bg-[#1a1a1a]/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="brutalist-card p-6 max-w-md w-full shadow-[8px_8px_0px_0px_rgba(26,26,26,1)] border-3 border-[#1a1a1a] space-y-4">
            <div className="flex items-center justify-between border-b-2 border-[#1a1a1a] pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 border-2 border-[#1a1a1a] bg-[#e63b2e] text-white flex items-center justify-center font-bold">
                  <ShieldAlert className="h-4.5 w-4.5" />
                </div>
                <h3 className="text-base font-extrabold uppercase font-display text-[#1a1a1a] dark:text-white">
                  Enforce Hardware Block
                </h3>
              </div>
              <button
                onClick={() => setBlockModalOpen(false)}
                className="p-1 hover:bg-[#ffcc00] border-2 border-transparent hover:border-[#1a1a1a] text-[#1a1a1a] dark:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-2 border-[#1a1a1a] bg-[#ffcc00]/15 p-3 text-xs font-mono text-[#1a1a1a] dark:text-gray-200 leading-relaxed shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
              <span className="font-bold text-[#e63b2e]">CRITICAL ACTION:</span> Blocking device <span className="font-bold font-mono underline">{selectedDevice.device_id}</span> will instantly revoke all wallet creation, imports, and access on that phone installation.
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider font-display text-gray-500 mb-1.5">
                Enforcement Reason (Broadcast to Client):
              </label>
              <textarea
                rows={3}
                value={blockReasonInput}
                onChange={(e) => setBlockReasonInput(e.target.value)}
                placeholder="Specify security violation or suspicious activity..."
                className="w-full brutalist-input text-xs font-mono"
              />
            </div>

            <div className="flex gap-3 justify-end pt-2 border-t-2 border-[#1a1a1a]">
              <button
                onClick={() => setBlockModalOpen(false)}
                className="brutalist-button-white px-4 py-2 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBlock}
                disabled={toggleDeviceBlock.isPending}
                className="px-4 py-2 bg-[#e63b2e] hover:bg-[#b71c1c] text-white border-2 border-[#1a1a1a] font-display uppercase font-bold text-xs shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] cursor-pointer"
              >
                {toggleDeviceBlock.isPending ? 'Enforcing...' : 'Enforce Hardware Block'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
