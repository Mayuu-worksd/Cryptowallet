'use client';

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
  Clock,
  Filter,
  Layers,
  Lock,
  Unlock,
} from 'lucide-react';

export default function AdminDevicesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'blocked' | 'active'>('all');
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockReasonInput, setBlockReasonInput] = useState('');

  // 1. Fetch devices via RPC admin_get_all_devices (or direct table fallback)
  const { data: devices, isLoading, isError, error, refetch } = useQuery({
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
    <div className="space-y-6">
      {/* Top Banner & Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-900 border border-gray-800 p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Device-Level Management</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                Block or reactivate entire app installation instances independently of wallet addresses.
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium rounded-xl transition border border-gray-700"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Distinction Info Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <Layers className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-amber-300 text-sm">Device-Level Block</span>
            <p className="text-xs text-amber-200/70 mt-1">
              Blocks the entire app installation on that hardware instance. Prevents creating, importing, or accessing ANY wallet on that device.
            </p>
          </div>
        </div>

        <div className="bg-blue-950/20 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
          <Lock className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-blue-300 text-sm">Wallet-Level Suspension</span>
            <p className="text-xs text-blue-200/70 mt-1">
              Managed on the <strong>Users</strong> page. Suspends a specific wallet address across all devices while leaving unblocked devices accessible.
            </p>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Device ID, Wallet Address, Platform, or Reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800/80 border border-gray-700 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400 ml-1" />
          <div className="flex bg-gray-800 p-1 rounded-xl border border-gray-700">
            {(['all', 'blocked', 'active'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
                  statusFilter === filter
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Devices Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
            <span className="text-sm">Loading registered devices...</span>
          </div>
        ) : isError ? (
          <div className="p-12 text-center text-red-400 flex flex-col items-center gap-2">
            <AlertCircle className="w-6 h-6" />
            <span className="text-sm font-medium">Failed to load registered devices</span>
            <span className="text-xs text-gray-500">{(error as any)?.message}</span>
          </div>
        ) : filteredDevices.length === 0 ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
            <Smartphone className="w-8 h-8 text-gray-600" />
            <span className="text-sm font-medium">No matching registered devices found</span>
            <span className="text-xs text-gray-500">Mobile app installations register automatically upon launch.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-800/40 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Device ID</th>
                  <th className="py-3.5 px-4">Platform</th>
                  <th className="py-3.5 px-4">Last Associated Wallet</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Block Reason</th>
                  <th className="py-3.5 px-4">Last Active</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-sm">
                {filteredDevices.map((d: any) => {
                  const isBlocked = d.is_blocked;
                  return (
                    <tr key={d.device_id} className="hover:bg-gray-800/30 transition">
                      <td className="py-3.5 px-4 font-mono text-xs text-blue-400 font-medium">
                        {d.device_id}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 bg-gray-800 border border-gray-700 text-gray-300 rounded-md text-xs uppercase font-medium">
                          {d.platform || 'unknown'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-gray-300">
                        {d.last_wallet_address ? (
                          <span title={d.last_wallet_address}>
                            {d.last_wallet_address.slice(0, 10)}...{d.last_wallet_address.slice(-8)}
                          </span>
                        ) : (
                          <span className="text-gray-500 italic">No wallet associated</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {isBlocked ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            Blocked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-400 max-w-xs truncate">
                        {d.block_reason || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-400">
                        {d.updated_at ? new Date(d.updated_at).toLocaleString() : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {isBlocked ? (
                          <button
                            onClick={() => handleUnblock(d.device_id)}
                            disabled={toggleDeviceBlock.isPending}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-medium transition"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            Unblock Device
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenBlockModal(d)}
                            disabled={toggleDeviceBlock.isPending}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 rounded-lg text-xs font-medium transition"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            Block Device
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Block Confirmation Modal */}
      {blockModalOpen && selectedDevice && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Block Device Access</h3>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{selectedDevice.device_id}</p>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed bg-red-950/20 border border-red-500/20 p-3 rounded-xl">
              Blocking this device will lock out the ENTIRE mobile application on this hardware installation. No wallet can be created, imported, or accessed until unblocked.
            </p>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Block Reason (displayed to user):
              </label>
              <textarea
                rows={3}
                value={blockReasonInput}
                onChange={(e) => setBlockReasonInput(e.target.value)}
                placeholder="Specify reason for blocking this device..."
                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-gray-200 focus:outline-none focus:border-red-500 placeholder-gray-500"
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setBlockModalOpen(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBlock}
                disabled={toggleDeviceBlock.isPending}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-red-600/20"
              >
                {toggleDeviceBlock.isPending ? 'Blocking...' : 'Confirm Device Block'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
