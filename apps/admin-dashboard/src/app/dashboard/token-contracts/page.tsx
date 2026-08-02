'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Coins,
  Plus,
  Loader2,
  Trash2,
  Edit,
  Power,
  PowerOff,
  Search,
  X,
  Network,
  Copy,
  Check,
  Code
} from 'lucide-react';

interface TokenContract {
  id: string;
  currency_code: string;
  currency: string;
  network_name: string;
  network: string;
  contract_address: string;
  contractAddress: string;
  decimals: number;
  is_enabled: boolean;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export default function TokenContractsPage() {
  const [contracts, setContracts] = useState<TokenContract[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [networks, setNetworks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNetworkFilter, setSelectedNetworkFilter] = useState('ALL');
  
  // Modal/Drawer state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<TokenContract | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    currency: '',
    network: '',
    contractAddress: '',
    decimals: 18,
    enabled: true
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setMessage(null);
    try {
      // 1. Fetch currencies
      const resCur = await fetch('/currencies');
      const curData = await resCur.json();
      setCurrencies(Array.isArray(curData) ? curData : []);

      // 2. Fetch networks
      const { data: netData, error: netErr } = await supabase
        .from('admin_networks')
        .select('*')
        .eq('is_active', true);
      
      if (netErr) throw netErr;
      setNetworks(netData || []);

      // 3. Fetch token contracts
      const resCon = await fetch('/token-contracts');
      const conData = await resCon.json();
      setContracts(Array.isArray(conData) ? conData : []);
    } catch (e: any) {
      console.error(e);
      setMessage({ type: 'error', text: 'Error loading backend data: ' + e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (address: string, id: string) => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenAdd = () => {
    setEditingContract(null);
    setFormData({
      currency: currencies[0]?.code || '',
      network: networks[0]?.network_name || 'Polygon',
      contractAddress: '',
      decimals: 18,
      enabled: true
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (contract: TokenContract) => {
    setEditingContract(contract);
    setFormData({
      currency: contract.currency_code,
      network: contract.network_name,
      contractAddress: contract.contract_address,
      decimals: contract.decimals,
      enabled: contract.is_enabled
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setMessage(null);

    try {
      if (editingContract) {
        // PUT update
        const res = await fetch(`/token-contracts/${editingContract.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currency: formData.currency,
            network: formData.network,
            contractAddress: formData.contractAddress,
            decimals: formData.decimals,
            enabled: formData.enabled
          })
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to update token contract.');
        }

        setMessage({ type: 'success', text: `Token contract updated for ${formData.currency}` });
      } else {
        // POST create
        const res = await fetch('/token-contracts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currency: formData.currency,
            network: formData.network,
            contractAddress: formData.contractAddress,
            decimals: formData.decimals,
            enabled: formData.enabled
          })
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to create token contract.');
        }

        setMessage({ type: 'success', text: `Token contract created for ${formData.currency}` });
      }

      setIsModalOpen(false);
      await loadAllData();
      setTimeout(() => setMessage(null), 5000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string, currency: string) => {
    if (!confirm(`Are you sure you want to delete the token contract mapping for ${currency}?`)) {
      return;
    }

    setActionLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/token-contracts/${id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete token contract.');
      }

      setMessage({ type: 'success', text: `Token contract deleted successfully.` });
      await loadAllData();
      setTimeout(() => setMessage(null), 5000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleEnable = async (contract: TokenContract) => {
    try {
      const res = await fetch(`/token-contracts/${contract.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: !contract.is_enabled
        })
      });

      if (!res.ok) throw new Error('Toggle failed');

      setContracts(prev =>
        prev.map(c => (c.id === contract.id ? { ...c, is_enabled: !c.is_enabled, enabled: !c.is_enabled } : c))
      );
      setMessage({ type: 'success', text: `Contract status toggled.` });
      setTimeout(() => setMessage(null), 3000);
    } catch (e: any) {
      setMessage({ type: 'error', text: 'Failed to toggle status: ' + e.message });
    }
  };

  // Search & filter computations
  const filteredContracts = contracts.filter(c => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      c.currency_code.toLowerCase().includes(q) ||
      c.contract_address.toLowerCase().includes(q) ||
      c.network_name.toLowerCase().includes(q);
    
    const matchesNetwork = selectedNetworkFilter === 'ALL' || c.network_name === selectedNetworkFilter;

    return matchesSearch && matchesNetwork;
  });

  const totalContracts = contracts.length;
  const activeContracts = contracts.filter(c => c.is_enabled).length;

  return (
    <div className="space-y-8 animate-fade-in pb-12 text-[#1a1a1a]">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-3 border-[#1a1a1a] pb-6 bg-[#0055ff] p-6 text-white shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] border-3 border-[#1a1a1a]">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-display uppercase leading-none">
            Token Contract Manager
          </h1>
          <p className="text-xs font-bold font-mono uppercase tracking-wider mt-2">
            Configure dynamic on-chain stablecoin and token contracts for multi-currency wallets
          </p>
        </div>
        <div>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 bg-white text-[#1a1a1a] hover:bg-gray-100 font-bold px-4 py-2.5 border-2 border-[#1a1a1a] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] transition-all text-xs uppercase"
          >
            <Plus className="h-4 w-4" />
            <span>Add Token Contract</span>
          </button>
        </div>
      </div>

      {/* Toast Alert Banner */}
      {message && (
        <div className={`p-4 border-3 border-[#1a1a1a] font-mono text-xs font-bold flex items-center gap-3 shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] ${
          message.type === 'success' ? 'bg-emerald-500/10 border-emerald-600 text-emerald-800' : 'bg-rose-500/10 border-rose-600 text-rose-800'
        }`}>
          <span className="text-lg">{message.type === 'success' ? '⚡' : '⚠️'}</span>
          <span>{message.text}</span>
        </div>
      )}

      {/* Metrics Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="brutalist-card p-4 bg-white border-3 border-[#1a1a1a] shadow-[3px_3px_0px_0px_rgba(26,26,26,1)]">
          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">Total Mappings</p>
          <h4 className="text-2xl font-extrabold mt-1.5 font-mono">{loading ? '...' : totalContracts}</h4>
        </div>
        <div className="brutalist-card p-4 !bg-emerald-500/10 border-emerald-600 border-3 shadow-[3px_3px_0px_0px_rgba(26,26,26,1)]">
          <p className="text-[9px] text-emerald-700 font-bold uppercase tracking-wider font-mono">Active Mappings</p>
          <h4 className="text-2xl font-extrabold text-emerald-700 mt-1.5 font-mono">{loading ? '...' : activeContracts}</h4>
        </div>
        <div className="brutalist-card p-4 !bg-amber-500/10 border-amber-600 border-3 shadow-[3px_3px_0px_0px_rgba(26,26,26,1)]">
          <p className="text-[9px] text-amber-700 font-bold uppercase tracking-wider font-mono">Inactive Placeholder Mappings</p>
          <h4 className="text-2xl font-extrabold text-amber-700 mt-1.5 font-mono">
            {loading ? '...' : totalContracts - activeContracts}
          </h4>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="brutalist-card p-4 bg-[#f5f0e8] border-3 border-[#1a1a1a] flex flex-col md:flex-row gap-4 items-center justify-between shadow-[3px_3px_0px_0px_rgba(26,26,26,1)]">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by currency, address, or network..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border-2 border-[#1a1a1a] bg-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#0055ff]"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto items-center justify-end">
          <span className="text-xs font-bold font-mono">Network:</span>
          <select
            value={selectedNetworkFilter}
            onChange={e => setSelectedNetworkFilter(e.target.value)}
            className="p-2 border-2 border-[#1a1a1a] bg-white font-mono text-xs focus:outline-none"
          >
            <option value="ALL">All Networks</option>
            {networks.map(n => (
              <option key={n.id} value={n.network_name}>{n.network_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Contracts Table */}
      <div className="brutalist-card bg-white border-3 border-[#1a1a1a] shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-[#f5f0e8] border-b-3 border-[#1a1a1a] text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]">
                <th className="py-3.5 px-6 border-r-3 border-[#1a1a1a] font-display">Currency</th>
                <th className="py-3.5 px-4 border-r-3 border-[#1a1a1a] font-display">Network</th>
                <th className="py-3.5 px-4 border-r-3 border-[#1a1a1a] font-display">Contract Address</th>
                <th className="py-3.5 px-4 border-r-3 border-[#1a1a1a] font-display">Decimals</th>
                <th className="py-3.5 px-4 border-r-3 border-[#1a1a1a] font-display">Status</th>
                <th className="py-3.5 px-6 text-right font-display">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-3 divide-[#1a1a1a] font-mono text-[#1a1a1a]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-[#1a1a1a]" />
                      <span className="font-bold font-display uppercase text-xs">Fetching contracts...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-[#1a1a1a] font-bold uppercase font-display">
                    No token contract mappings found.
                  </td>
                </tr>
              ) : (
                filteredContracts.map((contract) => (
                  <tr key={contract.id} className="hover:bg-[#0055ff]/5 transition-colors">
                    
                    {/* Currency info */}
                    <td className="py-4 px-6 border-r-3 border-[#1a1a1a]">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 border border-[#1a1a1a] bg-[#f5f0e8] flex items-center justify-center text-[#1a1a1a] font-bold rounded-sm text-xs">
                          {contract.currency_code}
                        </div>
                        <div>
                          <p className="text-sm font-bold uppercase">{contract.currency_code}</p>
                          <p className="text-[9px] text-gray-500 leading-none">
                            {currencies.find(c => c.code === contract.currency_code)?.name || 'Custom'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Network name */}
                    <td className="py-4 px-4 border-r-3 border-[#1a1a1a]">
                      <div className="flex items-center gap-1">
                        <Network className="h-3.5 w-3.5 text-gray-600" />
                        <span className="font-bold uppercase text-[10px]">{contract.network_name}</span>
                      </div>
                    </td>

                    {/* Contract Address */}
                    <td className="py-4 px-4 border-r-3 border-[#1a1a1a]">
                      {contract.contract_address ? (
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded border border-gray-300 font-mono select-all">
                            {contract.contract_address}
                          </code>
                          <button
                            onClick={() => handleCopy(contract.contract_address, contract.id)}
                            className="p-1 hover:bg-gray-200 border border-gray-400 rounded text-gray-600"
                            title="Copy Address"
                          >
                            {copiedId === contract.id ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">No Contract Deployed (Placeholder)</span>
                      )}
                    </td>

                    {/* Decimals */}
                    <td className="py-4 px-4 border-r-3 border-[#1a1a1a] text-center font-bold">
                      {contract.decimals}
                    </td>

                    {/* Enabled Toggle */}
                    <td className="py-4 px-4 border-r-3 border-[#1a1a1a]">
                      <button
                        onClick={() => handleToggleEnable(contract)}
                        className={`px-2 py-0.5 border border-[#1a1a1a] text-[9px] font-extrabold uppercase rounded-sm cursor-pointer ${
                          contract.is_enabled 
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-600' 
                            : 'bg-rose-100 text-rose-800 border-rose-600'
                        }`}
                      >
                        {contract.is_enabled ? 'Active' : 'Inactive'}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleOpenEdit(contract)}
                          className="p-1 border border-[#1a1a1a] hover:bg-gray-100 rounded text-[#1a1a1a]"
                          title="Edit mapping"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(contract.id, contract.currency_code)}
                          disabled={actionLoading}
                          className="p-1 border border-red-600 text-red-600 hover:bg-red-50 rounded"
                          title="Delete contract"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      {/* Add/Edit Modal Drawer */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end">
          <div className="w-full max-w-lg bg-white border-l-3 border-[#1a1a1a] p-6 flex flex-col justify-between text-[#1a1a1a]">
            <div>
              <div className="flex justify-between items-center pb-4 border-b-2 border-[#1a1a1a] mb-6">
                <h3 className="text-lg font-extrabold uppercase font-display">
                  {editingContract ? 'Edit Token Contract' : 'Add Token Contract'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 border-2 border-[#1a1a1a] hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4 font-mono text-xs">
                {/* Select Currency */}
                <div>
                  <label className="block font-bold mb-1.5 uppercase">Currency Code:</label>
                  <select
                    value={formData.currency}
                    onChange={e => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                    disabled={!!editingContract}
                    className="w-full p-2.5 border-2 border-[#1a1a1a] bg-[#f5f0e8] focus:outline-none"
                  >
                    {currencies.map(c => (
                      <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Select Network */}
                <div>
                  <label className="block font-bold mb-1.5 uppercase">Network:</label>
                  <select
                    value={formData.network}
                    onChange={e => setFormData(prev => ({ ...prev, network: e.target.value }))}
                    disabled={!!editingContract}
                    className="w-full p-2.5 border-2 border-[#1a1a1a] bg-[#f5f0e8] focus:outline-none"
                  >
                    {networks.map(n => (
                      <option key={n.id} value={n.network_name}>{n.network_name}</option>
                    ))}
                  </select>
                </div>

                {/* Contract Address */}
                <div>
                  <label className="block font-bold mb-1.5 uppercase">Contract Address (0x...):</label>
                  <input
                    type="text"
                    placeholder="Leave empty for Placeholder/Native"
                    value={formData.contractAddress}
                    onChange={e => setFormData(prev => ({ ...prev, contractAddress: e.target.value }))}
                    className="w-full p-2.5 border-2 border-[#1a1a1a] bg-[#f5f0e8] focus:outline-none"
                  />
                  <p className="text-[9px] text-gray-500 mt-1 italic uppercase">
                    Provide the deployed contract address on the selected network.
                  </p>
                </div>

                {/* Decimals */}
                <div>
                  <label className="block font-bold mb-1.5 uppercase">Decimals:</label>
                  <input
                    type="number"
                    min="0"
                    max="36"
                    value={formData.decimals}
                    onChange={e => setFormData(prev => ({ ...prev, decimals: Number(e.target.value) }))}
                    className="w-full p-2.5 border-2 border-[#1a1a1a] bg-[#f5f0e8] focus:outline-none"
                  />
                </div>

                {/* Enabled Toggle */}
                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="enabled-checkbox"
                    checked={formData.enabled}
                    onChange={e => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
                    className="w-4 h-4 accent-[#0055ff] border-2 border-[#1a1a1a] rounded-sm"
                  />
                  <label htmlFor="enabled-checkbox" className="font-bold uppercase cursor-pointer">
                    Enable Token Contract Mapping
                  </label>
                </div>

                {/* Save Button */}
                <div className="pt-6">
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-[#0055ff] hover:bg-[#0055ff]/90 text-white font-bold border-2 border-[#1a1a1a] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] transition-all uppercase tracking-wide"
                  >
                    {actionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Save Configuration'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
