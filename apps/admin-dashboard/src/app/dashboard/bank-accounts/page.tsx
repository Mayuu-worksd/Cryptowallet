'use client';
export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  Landmark,
  Building,
  Plus,
  Loader2,
  Trash2,
  Edit,
  Power,
  PowerOff,
  RefreshCw,
  X,
} from 'lucide-react';

export default function BankAccountsPage() {
  const queryClient = useQueryClient();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<any>(null);

  const [formData, setFormData] = useState({
    beneficiary_name: '',
    bank_name: '',
    routing_number: '',
    account_number: '',
    account_type: 'Checking',
    currency: 'USD',
    iban: '',
    swift_code: '',
    deposit_instructions: '',
  });

  // Fetch Bank Accounts
  const { data: banks, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-bank-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_bank_accounts');
      if (error) throw error;
      return data || [];
    },
  });

  // Create/Update Bank Mutation
  const saveBank = useMutation({
    mutationFn: async (payload: any) => {
      if (editingBank) {
        const { error } = await supabase.rpc('admin_update_bank_account', {
          p_id: editingBank.id,
          p_beneficiary_name: payload.beneficiary_name,
          p_bank_name: payload.bank_name,
          p_routing_number: payload.routing_number,
          p_account_number: payload.account_number,
          p_account_type: payload.account_type,
          p_currency: payload.currency,
          p_iban: payload.iban || null,
          p_swift_code: payload.swift_code || null,
          p_deposit_instructions: payload.deposit_instructions || null,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc('admin_insert_bank_account', {
          p_beneficiary_name: payload.beneficiary_name,
          p_bank_name: payload.bank_name,
          p_routing_number: payload.routing_number,
          p_account_number: payload.account_number,
          p_account_type: payload.account_type,
          p_currency: payload.currency,
          p_iban: payload.iban || null,
          p_swift_code: payload.swift_code || null,
          p_deposit_instructions: payload.deposit_instructions || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bank-accounts'] });
      closeDrawer();
    },
  });

  // Toggle Active Status Mutation
  const toggleStatus = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.rpc('admin_toggle_bank_account', {
        p_id: id,
        p_is_active: !is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bank-accounts'] });
    },
  });

  // Delete Bank Mutation
  const deleteBank = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('admin_delete_bank_account', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bank-accounts'] });
    },
  });

  const openDrawer = (bank: any = null) => {
    if (bank) {
      setEditingBank(bank);
      setFormData({
        beneficiary_name: bank.beneficiary_name || '',
        bank_name: bank.bank_name || '',
        routing_number: bank.routing_number || '',
        account_number: bank.account_number || '',
        account_type: bank.account_type || 'Checking',
        currency: bank.currency || 'USD',
        iban: bank.iban || '',
        swift_code: bank.swift_code || '',
        deposit_instructions: bank.deposit_instructions || '',
      });
    } else {
      setEditingBank(null);
      setFormData({
        beneficiary_name: '',
        bank_name: '',
        routing_number: '',
        account_number: '',
        account_type: 'Checking',
        currency: 'USD',
        iban: '',
        swift_code: '',
        deposit_instructions: '',
      });
    }
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setEditingBank(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveBank.mutate(formData);
  };

  const activeCount = (banks || []).filter((b: any) => b.is_active).length;
  const totalCount = (banks || []).length;

  return (
    <div className="space-y-8 animate-fade-in relative min-h-screen pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-3 border-[#1a1a1a] pb-6 bg-[#0055ff] p-6 text-white shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] border-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-display uppercase leading-none text-white">Fiat Bank Accounts</h1>
          <p className="text-xs font-bold font-mono uppercase tracking-wider mt-2 text-white/80">Manage institutional deposit accounts for fiat on-ramps</p>
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
            <span>New Account</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="brutalist-card p-4">
          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">Total Bank Accounts</p>
          <h4 className="text-2xl font-extrabold text-[#1a1a1a] mt-1.5 font-mono">
            {isLoading ? '...' : totalCount}
          </h4>
        </div>
        <div className="brutalist-card p-4 !bg-emerald-500/10 border-emerald-600">
          <p className="text-[9px] text-emerald-700 font-bold uppercase tracking-wider font-mono">Active Receivers</p>
          <h4 className="text-2xl font-extrabold text-emerald-700 mt-1.5 font-mono">
            {isLoading ? '...' : activeCount}
          </h4>
        </div>
      </div>

      {/* Main Table */}
      <div className="brutalist-card">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-[#f5f0e8] border-b-3 border-[#1a1a1a] text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]">
                <th className="py-3.5 px-6 border-r-3 border-[#1a1a1a] font-display">Bank Details</th>
                <th className="py-3.5 px-4 border-r-3 border-[#1a1a1a] font-display">Beneficiary</th>
                <th className="py-3.5 px-4 border-r-3 border-[#1a1a1a] font-display">Account & Routing</th>
                <th className="py-3.5 px-4 border-r-3 border-[#1a1a1a] font-display">Type / Curr</th>
                <th className="py-3.5 px-4 border-r-3 border-[#1a1a1a] font-display">Status</th>
                <th className="py-3.5 px-6 text-right font-display">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y-3 divide-[#1a1a1a] font-mono text-[#1a1a1a]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-[#1a1a1a]" />
                      <span className="font-bold font-display uppercase text-xs">Fetching accounts...</span>
                    </div>
                  </td>
                </tr>
              ) : (banks || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-[#1a1a1a] font-bold uppercase font-display">
                    No bank accounts configured.
                  </td>
                </tr>
              ) : (
                (banks || []).map((bank: any) => (
                  <tr key={bank.id} className="hover:bg-[#ffcc00]/5 transition-colors">
                    
                    {/* Bank Details */}
                    <td className="py-4 px-6 border-r-3 border-[#1a1a1a]">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 border-2 border-[#1a1a1a] bg-[#ffcc00] flex items-center justify-center text-[#1a1a1a]">
                          <Landmark className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#1a1a1a] font-display uppercase">{bank.bank_name}</p>
                        </div>
                      </div>
                    </td>

                    {/* Beneficiary */}
                    <td className="py-4 px-4 border-r-3 border-[#1a1a1a] font-bold font-mono">
                      {bank.beneficiary_name}
                    </td>

                    {/* Account & Routing */}
                    <td className="py-4 px-4 border-r-3 border-[#1a1a1a]">
                      <p className="text-xs font-bold font-mono text-[#1a1a1a]">{bank.account_number}</p>
                      <p className="text-[10px] font-bold text-gray-500 mt-0.5 font-mono">RTN: {bank.routing_number}</p>
                      {bank.iban && <p className="text-[9px] font-bold text-gray-500 mt-0.5 font-mono">IBAN: {bank.iban}</p>}
                      {bank.swift_code && <p className="text-[9px] font-bold text-gray-500 mt-0.5 font-mono">BIC/SWIFT: {bank.swift_code}</p>}
                    </td>

                    {/* Type / Curr */}
                    <td className="py-4 px-4 border-r-3 border-[#1a1a1a]">
                      <p className="text-xs font-bold text-[#1a1a1a]">{bank.account_type}</p>
                      <p className="text-[10px] font-bold text-gray-500">{bank.currency}</p>
                    </td>

                    {/* Status badge */}
                    <td className="py-4 px-4 border-r-3 border-[#1a1a1a]">
                      <span className={`px-2.5 py-1 border-2 border-[#1a1a1a] text-[9px] font-extrabold uppercase ${
                        bank.is_active ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {bank.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => toggleStatus.mutate({ id: bank.id, is_active: bank.is_active })}
                          className={`p-2 border-2 border-[#1a1a1a] ${bank.is_active ? 'bg-amber-100 hover:bg-amber-200' : 'bg-emerald-100 hover:bg-emerald-200'} transition-colors`}
                          title={bank.is_active ? "Deactivate" : "Activate"}
                        >
                          {bank.is_active ? <PowerOff className="h-4 w-4 text-amber-700" /> : <Power className="h-4 w-4 text-emerald-700" />}
                        </button>
                        <button
                          onClick={() => openDrawer(bank)}
                          className="p-2 border-2 border-[#1a1a1a] bg-[#f5f0e8] hover:bg-[#1a1a1a] hover:text-white transition-colors"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to permanently delete this bank account?')) {
                              deleteBank.mutate(bank.id);
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
              <div className="flex items-center justify-between p-6 border-b-3 border-[#1a1a1a] bg-[#ffcc00]">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 border-2 border-[#1a1a1a] bg-white flex items-center justify-center text-[#1a1a1a]">
                    <Building className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-[#1a1a1a] font-display uppercase">{editingBank ? 'Edit Bank' : 'Add Bank'}</h2>
                  </div>
                </div>
                <button
                  onClick={closeDrawer}
                  className="p-1.5 border-2 border-[#1a1a1a] bg-white hover:bg-[#f5f0e8] text-[#1a1a1a]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form id="bank-form" onSubmit={handleSave} className="p-6 space-y-6 font-mono">
                <div className="space-y-4">
                  
                  <div>
                    <label className="block text-[10px] font-bold text-[#1a1a1a] uppercase tracking-wider mb-2">Bank Name</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. JPMorgan Chase"
                      value={formData.bank_name}
                      onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
                      className="w-full brutalist-input text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#1a1a1a] uppercase tracking-wider mb-2">Beneficiary Name</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. CryptoWallet Inc."
                      value={formData.beneficiary_name}
                      onChange={(e) => setFormData({...formData, beneficiary_name: e.target.value})}
                      className="w-full brutalist-input text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#1a1a1a] uppercase tracking-wider mb-2">Account Number</label>
                    <input
                      required
                      type="text"
                      placeholder="Enter Account Number"
                      value={formData.account_number}
                      onChange={(e) => setFormData({...formData, account_number: e.target.value})}
                      className="w-full brutalist-input text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#1a1a1a] uppercase tracking-wider mb-2">Routing Number / Sort Code</label>
                    <input
                      required
                      type="text"
                      placeholder="Enter Routing Number"
                      value={formData.routing_number}
                      onChange={(e) => setFormData({...formData, routing_number: e.target.value})}
                      className="w-full brutalist-input text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#1a1a1a] uppercase tracking-wider mb-2">IBAN</label>
                    <input
                      type="text"
                      placeholder="e.g. AE8601000000000001234567"
                      value={formData.iban}
                      onChange={(e) => setFormData({...formData, iban: e.target.value})}
                      className="w-full brutalist-input text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#1a1a1a] uppercase tracking-wider mb-2">SWIFT / BIC Code</label>
                    <input
                      type="text"
                      placeholder="e.g. CHASUS33"
                      value={formData.swift_code}
                      onChange={(e) => setFormData({...formData, swift_code: e.target.value})}
                      className="w-full brutalist-input text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#1a1a1a] uppercase tracking-wider mb-2">Deposit Instructions</label>
                    <textarea
                      placeholder="Instructions shown to the depositor..."
                      value={formData.deposit_instructions}
                      onChange={(e) => setFormData({...formData, deposit_instructions: e.target.value})}
                      className="w-full brutalist-input text-xs min-h-[60px] py-2 px-3"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-[#1a1a1a] uppercase tracking-wider mb-2">Account Type</label>
                      <select
                        value={formData.account_type}
                        onChange={(e) => setFormData({...formData, account_type: e.target.value})}
                        className="w-full brutalist-input text-xs bg-white"
                      >
                        <option value="Checking">Checking</option>
                        <option value="Savings">Savings</option>
                        <option value="Corporate">Corporate</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#1a1a1a] uppercase tracking-wider mb-2">Currency</label>
                      <select
                        value={formData.currency}
                        onChange={(e) => setFormData({...formData, currency: e.target.value})}
                        className="w-full brutalist-input text-xs bg-white"
                      >
                        <option value="USD">USD</option>
                        <option value="AED">AED</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                        <option value="INR">INR</option>
                        <option value="SGD">SGD</option>
                      </select>
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
                form="bank-form"
                disabled={saveBank.isPending}
                className="flex-1 brutalist-button text-xs py-3 !bg-[#0055ff] !text-white hover:!bg-[#1a1a1a] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saveBank.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{editingBank ? 'Save Changes' : 'Create Bank'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
