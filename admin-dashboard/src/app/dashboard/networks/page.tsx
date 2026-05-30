'use client';
export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  Network,
  Server,
  Plus,
  Loader2,
  Trash2,
  Edit,
  Power,
  PowerOff,
  RefreshCw,
  X,
  Globe,
  Link as LinkIcon
} from 'lucide-react';

export default function NetworksPage() {
  const queryClient = useQueryClient();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingNetwork, setEditingNetwork] = useState<any>(null);

  const [formData, setFormData] = useState({
    network_name: '',
    rpc_url: '',
    chain_id: '',
    explorer_url: '',
    symbol: '',
    is_mainnet: true,
  });

  // Fetch Networks
  const { data: networks, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-networks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_networks')
        .select('*')
        .order('is_mainnet', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Create/Update Network Mutation
  const saveNetwork = useMutation({
    mutationFn: async (payload: any) => {
      if (editingNetwork) {
        const { error } = await supabase
          .from('admin_networks')
          .update(payload)
          .eq('id', editingNetwork.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('admin_networks')
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-networks'] });
      closeDrawer();
    },
  });

  // Toggle Active Status Mutation
  const toggleStatus = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('admin_networks')
        .update({ is_active: !is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-networks'] });
    },
  });

  // Delete Network Mutation
  const deleteNetwork = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('admin_networks')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-networks'] });
    },
  });

  const openDrawer = (network: any = null) => {
    if (network) {
      setEditingNetwork(network);
      setFormData({
        network_name: network.network_name,
        rpc_url: network.rpc_url,
        chain_id: network.chain_id,
        explorer_url: network.explorer_url || '',
        symbol: network.symbol,
        is_mainnet: network.is_mainnet,
      });
    } else {
      setEditingNetwork(null);
      setFormData({
        network_name: '',
        rpc_url: '',
        chain_id: '',
        explorer_url: '',
        symbol: '',
        is_mainnet: true,
      });
    }
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setEditingNetwork(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveNetwork.mutate(formData);
  };

  const activeCount = (networks || []).filter((n: any) => n.is_active).length;
  const mainnetCount = (networks || []).filter((n: any) => n.is_mainnet).length;
  const totalCount = (networks || []).length;

  return (
    <div className="space-y-8 animate-fade-in relative min-h-screen pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-3 border-[#1a1a1a] pb-6 bg-[#0055ff] p-6 text-white shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] border-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-display uppercase leading-none text-white">Blockchain Networks</h1>
          <p className="text-xs font-bold font-mono uppercase tracking-wider mt-2 text-white/80">Configure RPC nodes, chain IDs, and supported ledgers</p>
        </div>
        <div className="flex items-center gap-3 self-start">
          <button
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="brutalist-button-white px-4 py-2 flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync</span>
          </button>
          <button
            onClick={() => openDrawer()}
            className="brutalist-button px-4 py-2 flex items-center gap-2 !bg-[#ffcc00] !text-[#1a1a1a]"
          >
            <Plus className="h-4 w-4" />
            <span>New Network</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="brutalist-card p-4">
          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">Total Networks</p>
          <h4 className="text-2xl font-extrabold text-[#1a1a1a] mt-1.5 font-mono">
            {isLoading ? '...' : totalCount}
          </h4>
        </div>
        <div className="brutalist-card p-4 !bg-[#0055ff]/10">
          <p className="text-[9px] text-[#0055ff] font-bold uppercase tracking-wider font-mono">Active Nodes</p>
          <h4 className="text-2xl font-extrabold text-[#0055ff] mt-1.5 font-mono">
            {isLoading ? '...' : activeCount}
          </h4>
        </div>
        <div className="brutalist-card p-4 !bg-emerald-500/10 border-emerald-600">
          <p className="text-[9px] text-emerald-700 font-bold uppercase tracking-wider font-mono">Mainnets</p>
          <h4 className="text-2xl font-extrabold text-emerald-700 mt-1.5 font-mono">
            {isLoading ? '...' : mainnetCount}
          </h4>
        </div>
        <div className="brutalist-card p-4 !bg-amber-500/10 border-amber-600">
          <p className="text-[9px] text-amber-700 font-bold uppercase tracking-wider font-mono">Testnets</p>
          <h4 className="text-2xl font-extrabold text-amber-700 mt-1.5 font-mono">
            {isLoading ? '...' : totalCount - mainnetCount}
          </h4>
        </div>
      </div>

      {/* Main Table */}
      <div className="brutalist-card">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-[#f5f0e8] border-b-3 border-[#1a1a1a] text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]">
                <th className="py-3.5 px-6 border-r-3 border-[#1a1a1a] font-display">Network Info</th>
                <th className="py-3.5 px-4 border-r-3 border-[#1a1a1a] font-display">Chain / RPC</th>
                <th className="py-3.5 px-4 border-r-3 border-[#1a1a1a] font-display">Environment</th>
                <th className="py-3.5 px-4 border-r-3 border-[#1a1a1a] font-display">Status</th>
                <th className="py-3.5 px-6 text-right font-display">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-3 divide-[#1a1a1a] font-mono text-[#1a1a1a]">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-[#1a1a1a]" />
                      <span className="font-bold font-display uppercase text-xs">Fetching networks...</span>
                    </div>
                  </td>
                </tr>
              ) : (networks || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-[#1a1a1a] font-bold uppercase font-display">
                    No blockchain networks configured.
                  </td>
                </tr>
              ) : (
                (networks || []).map((network: any) => (
                  <tr key={network.id} className="hover:bg-[#0055ff]/5 transition-colors">
                    
                    {/* Network Details */}
                    <td className="py-4 px-6 border-r-3 border-[#1a1a1a]">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 border-2 border-[#1a1a1a] bg-[#f5f0e8] flex items-center justify-center text-[#1a1a1a]">
                          <Network className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#1a1a1a] font-display uppercase">{network.network_name}</p>
                          <p className="text-[10px] font-bold text-[#0055ff] mt-0.5 font-mono">{network.symbol}</p>
                        </div>
                      </div>
                    </td>

                    {/* Chain / RPC */}
                    <td className="py-4 px-4 border-r-3 border-[#1a1a1a]">
                      <p className="text-[10px] font-bold text-[#1a1a1a]">Chain ID: {network.chain_id}</p>
                      <div className="flex items-center gap-1 mt-1 text-[9px] text-gray-500 w-48 truncate">
                        <LinkIcon className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{network.rpc_url}</span>
                      </div>
                    </td>

                    {/* Environment */}
                    <td className="py-4 px-4 border-r-3 border-[#1a1a1a]">
                      <span className={`px-2 py-0.5 border-2 border-[#1a1a1a] text-[9px] font-extrabold uppercase ${
                        network.is_mainnet ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {network.is_mainnet ? 'Mainnet' : 'Testnet'}
                      </span>
                    </td>

                    {/* Status badge */}
                    <td className="py-4 px-4 border-r-3 border-[#1a1a1a]">
                      <span className={`px-2.5 py-1 border-2 border-[#1a1a1a] text-[9px] font-extrabold uppercase ${
                        network.is_active ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {network.is_active ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {network.explorer_url && (
                          <a 
                            href={network.explorer_url} 
                            target="_blank" 
                            rel="noreferrer"
                            className="p-2 border-2 border-[#1a1a1a] bg-white hover:bg-gray-100 transition-colors"
                            title="Block Explorer"
                          >
                            <Globe className="h-4 w-4" />
                          </a>
                        )}
                        <button
                          onClick={() => toggleStatus.mutate({ id: network.id, is_active: network.is_active })}
                          className={`p-2 border-2 border-[#1a1a1a] ${network.is_active ? 'bg-amber-100 hover:bg-amber-200' : 'bg-emerald-100 hover:bg-emerald-200'} transition-colors`}
                          title={network.is_active ? "Disable" : "Enable"}
                        >
                          {network.is_active ? <PowerOff className="h-4 w-4 text-amber-700" /> : <Power className="h-4 w-4 text-emerald-700" />}
                        </button>
                        <button
                          onClick={() => openDrawer(network)}
                          className="p-2 border-2 border-[#1a1a1a] bg-[#f5f0e8] hover:bg-[#1a1a1a] hover:text-white transition-colors"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to completely delete ${network.network_name}? This could disrupt user transactions.`)) {
                              deleteNetwork.mutate(network.id);
                            }
                          }}
                          className="p-2 border-2 border-[#1a1a1a] bg-[#e63b2e] text-white hover:opacity-80 transition-opacity"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slideout Drawer Form */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-[#1a1a1a]/60 backdrop-blur-xs"
            onClick={closeDrawer}
          />
          <div className="relative w-full max-w-lg h-full bg-white border-l-3 border-[#1a1a1a] shadow-2xl flex flex-col justify-between overflow-y-auto animate-slide-in-right z-50">
            <div>
              <div className="flex items-center justify-between p-6 border-b-3 border-[#1a1a1a] bg-[#0055ff]">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 border-2 border-[#1a1a1a] bg-white flex items-center justify-center text-[#1a1a1a]">
                    <Server className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-white font-display uppercase">{editingNetwork ? 'Edit Network' : 'Add Network'}</h2>
                  </div>
                </div>
                <button
                  onClick={closeDrawer}
                  className="p-1.5 border-2 border-[#1a1a1a] bg-white hover:bg-[#f5f0e8] text-[#1a1a1a]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form id="network-form" onSubmit={handleSave} className="p-6 space-y-6 font-mono">
                <div className="space-y-4">
                  
                  <div>
                    <label className="block text-[10px] font-bold text-[#1a1a1a] uppercase tracking-wider mb-2">Network Name</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Ethereum Mainnet"
                      value={formData.network_name}
                      onChange={(e) => setFormData({...formData, network_name: e.target.value})}
                      className="w-full brutalist-input text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#1a1a1a] uppercase tracking-wider mb-2">RPC Endpoint URL</label>
                    <input
                      required
                      type="url"
                      placeholder="https://mainnet.infura.io/v3/..."
                      value={formData.rpc_url}
                      onChange={(e) => setFormData({...formData, rpc_url: e.target.value})}
                      className="w-full brutalist-input text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-[#1a1a1a] uppercase tracking-wider mb-2">Chain ID</label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. 1"
                        value={formData.chain_id}
                        onChange={(e) => setFormData({...formData, chain_id: e.target.value})}
                        className="w-full brutalist-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#1a1a1a] uppercase tracking-wider mb-2">Native Symbol</label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. ETH"
                        value={formData.symbol}
                        onChange={(e) => setFormData({...formData, symbol: e.target.value})}
                        className="w-full brutalist-input text-xs uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#1a1a1a] uppercase tracking-wider mb-2">Block Explorer URL (Optional)</label>
                    <input
                      type="url"
                      placeholder="https://etherscan.io"
                      value={formData.explorer_url}
                      onChange={(e) => setFormData({...formData, explorer_url: e.target.value})}
                      className="w-full brutalist-input text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#1a1a1a] uppercase tracking-wider mb-2">Environment</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                        <input
                          type="radio"
                          checked={formData.is_mainnet}
                          onChange={() => setFormData({...formData, is_mainnet: true})}
                          className="w-4 h-4 text-[#0055ff] border-2 border-[#1a1a1a] focus:ring-0"
                        />
                        Mainnet
                      </label>
                      <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                        <input
                          type="radio"
                          checked={!formData.is_mainnet}
                          onChange={() => setFormData({...formData, is_mainnet: false})}
                          className="w-4 h-4 text-[#0055ff] border-2 border-[#1a1a1a] focus:ring-0"
                        />
                        Testnet
                      </label>
                    </div>
                  </div>

                </div>
              </form>
            </div>

            <div className="p-6 border-t-3 border-[#1a1a1a] bg-[#f5f0e8] flex gap-3">
              <button
                type="button"
                onClick={closeDrawer}
                className="flex-1 brutalist-button-white text-xs py-3"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="network-form"
                disabled={saveNetwork.isPending}
                className="flex-1 brutalist-button text-xs py-3 !bg-[#ffcc00] !text-[#1a1a1a] hover:!bg-[#1a1a1a] hover:!text-white disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {saveNetwork.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{editingNetwork ? 'Save Configuration' : 'Deploy Network'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
