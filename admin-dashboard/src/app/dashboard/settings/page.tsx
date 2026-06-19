'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Settings, Save, Loader2, AlertCircle, CheckCircle, Plus, Trash2 } from 'lucide-react';

export default function AppSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [paymentPriority, setPaymentPriority] = useState('USDT, BTC, ETH, BNB, TRX');
  const [physicalBaseFee, setPhysicalBaseFee] = useState('50');

  // Dynamic Lists for JSON structures
  const [cardPricesList, setCardPricesList] = useState<{ tier: string; price: string }[]>([
    { tier: 'Classic', price: '0' },
    { tier: 'Gold', price: '49.99' },
    { tier: 'Platinum', price: '99.99' },
    { tier: 'Travel', price: '79.99' }
  ]);

  const [commissionList, setCommissionList] = useState<{ action: string; type: string; value: string }[]>([
    { action: 'swap', type: 'percentage', value: '0.5' },
    { action: 'card', type: 'percentage', value: '1.0' },
    { action: 'send', type: 'fixed', value: '0.5' },
    { action: 'receive', type: 'fixed', value: '0' },
    { action: 'p2p_trade', type: 'percentage', value: '0.1' },
    { action: 'settlement_conversion', type: 'percentage', value: '1.5' }
  ]);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('admin_settings').select('*');
      if (error) throw error;

      if (data) {
        data.forEach((row) => {
          if (row.key === 'payment_asset_priority') {
            setPaymentPriority((row.value as string[]).join(', '));
          } else if (row.key === 'physical_base_fee') {
            setPhysicalBaseFee(String(row.value));
          } else if (row.key === 'physical_card_prices') {
            const obj = row.value as Record<string, number>;
            if (obj && typeof obj === 'object') {
              setCardPricesList(Object.entries(obj).map(([tier, price]) => ({ tier, price: String(price) })));
            }
          } else if (row.key === 'commission_rates') {
            const obj = row.value as Record<string, { type: string; value: number }>;
            if (obj && typeof obj === 'object') {
              setCommissionList(Object.entries(obj).map(([action, details]) => ({ action, type: details.type, value: String(details.value) })));
            }
          }
        });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to load settings: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      // 1. Parse values
      const parsedPriority = paymentPriority.split(',').map((s) => s.trim()).filter(Boolean);
      const parsedBaseFee = Number(physicalBaseFee);
      if (isNaN(parsedBaseFee)) throw new Error('Physical Base Fee must be a number.');

      // Transform arrays back to objects for the database
      const parsedCardPrices = cardPricesList.reduce((acc, curr) => {
        if (curr.tier.trim()) {
          const price = Number(curr.price);
          if (isNaN(price)) throw new Error(`Invalid price for tier: ${curr.tier}`);
          acc[curr.tier.trim()] = price;
        }
        return acc;
      }, {} as Record<string, number>);

      const parsedCommissions = commissionList.reduce((acc, curr) => {
        if (curr.action.trim()) {
          const val = Number(curr.value);
          if (isNaN(val)) throw new Error(`Invalid value for commission action: ${curr.action}`);
          acc[curr.action.trim()] = { type: curr.type, value: val };
        }
        return acc;
      }, {} as Record<string, { type: string; value: number }>);

      // 2. Prepare upsert payload
      const payload = [
        { key: 'payment_asset_priority', value: parsedPriority },
        { key: 'physical_base_fee', value: parsedBaseFee },
        { key: 'physical_card_prices', value: parsedCardPrices },
        { key: 'commission_rates', value: parsedCommissions },
      ];

      // 3. Upsert to Supabase
      const { error } = await supabase.from('admin_settings').upsert(payload, { onConflict: 'key' });
      if (error) throw error;

      setMessage({ type: 'success', text: 'Global App Settings successfully updated!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
      // Auto clear success message
      setTimeout(() => {
        setMessage((prev) => (prev?.type === 'success' ? null : prev));
      }, 4000);
    }
  };

  const addCardTier = () => setCardPricesList([...cardPricesList, { tier: '', price: '0' }]);
  const removeCardTier = (index: number) => setCardPricesList(cardPricesList.filter((_, i) => i !== index));

  const addCommission = () => setCommissionList([...commissionList, { action: '', type: 'percentage', value: '0' }]);
  const removeCommission = (index: number) => setCommissionList(commissionList.filter((_, i) => i !== index));

  return (
    <div className="space-y-8 animate-fade-in relative min-h-screen pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-3 border-[#1a1a1a] pb-6 bg-[#0055ff] p-6 text-white shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] border-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-display uppercase leading-none">Global App Settings</h1>
          <p className="text-xs font-bold font-mono uppercase tracking-wider mt-2">Manage dynamic configurations, fees, and operational parameters</p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading || saving}
          className="self-start brutalist-button-white px-6 py-2.5 flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] hover:bg-[#1a1a1a] hover:text-white transition-all"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          <span>SAVE CONFIGURATION</span>
        </button>
      </div>

      {/* Notifications */}
      {message && (
        <div className={`p-4 border-2 border-[#1a1a1a] flex items-center gap-3 text-sm font-bold uppercase tracking-wider font-display shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] ${
          message.type === 'error' ? 'bg-[#e63b2e] text-white' : 'bg-[#00c853] text-[#1a1a1a]'
        }`}>
          {message.type === 'error' ? <AlertCircle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="brutalist-card p-12 flex flex-col items-center justify-center text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin text-[#1a1a1a] mb-4" />
          <span className="font-bold font-display uppercase text-sm text-[#1a1a1a]">Fetching live parameters...</span>
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* Section 1: Core Operations */}
          <div className="brutalist-card p-6 space-y-6">
            <h2 className="text-xl font-extrabold text-[#1a1a1a] font-display uppercase tracking-tight flex items-center gap-2 border-b-2 border-[#1a1a1a] pb-3">
              <Settings className="h-6 w-6 text-[#0055ff]" />
              Core Operations
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-[#1a1a1a] uppercase tracking-wider font-mono mb-2">
                  Payment Settlement Priority
                </label>
                <input
                  type="text"
                  value={paymentPriority}
                  onChange={(e) => setPaymentPriority(e.target.value)}
                  className="w-full brutalist-input font-mono text-sm"
                  placeholder="USDT, BTC, ETH"
                />
                <p className="text-[10px] text-gray-500 font-bold mt-2 uppercase">Comma-separated tickers. Defines the order in which tokens are auto-swapped during a card spend.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1a1a1a] uppercase tracking-wider font-mono mb-2">
                  Physical Card Base Fee (USD)
                </label>
                <input
                  type="text"
                  value={physicalBaseFee}
                  onChange={(e) => setPhysicalBaseFee(e.target.value)}
                  className="w-full brutalist-input font-mono text-sm"
                  placeholder="50"
                />
                <p className="text-[10px] text-gray-500 font-bold mt-2 uppercase">Default fallback fee charged for ordering a physical card.</p>
              </div>
            </div>
          </div>

          {/* Section 2: Physical Card Pricing */}
          <div className="brutalist-card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-[#1a1a1a] pb-3 gap-4">
              <h2 className="text-xl font-extrabold text-[#1a1a1a] font-display uppercase tracking-tight flex items-center gap-2">
                <Settings className="h-6 w-6 text-[#ffcc00]" />
                Physical Card Tier Pricing
              </h2>
              <button 
                onClick={addCardTier}
                className="px-3 py-1.5 border-2 border-[#1a1a1a] bg-[#1a1a1a] text-white hover:bg-[#ffcc00] hover:text-[#1a1a1a] text-xs font-bold font-display uppercase flex items-center justify-center gap-1 transition-colors"
              >
                <Plus className="h-4 w-4" /> Add Tier
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {cardPricesList.map((item, index) => (
                <div key={index} className="p-4 border-2 border-[#1a1a1a] bg-[#f5f0e8] flex flex-col gap-3 relative group shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 font-mono">Tier Name</label>
                    <input
                      type="text"
                      value={item.tier}
                      onChange={(e) => {
                        const newList = [...cardPricesList];
                        newList[index].tier = e.target.value;
                        setCardPricesList(newList);
                      }}
                      className="w-full px-2 py-1.5 border-2 border-[#1a1a1a] font-mono text-sm outline-none focus:ring-2 focus:ring-[#0055ff]/50"
                      placeholder="e.g., Diamond"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 font-mono">Price (USD)</label>
                    <input
                      type="number"
                      value={item.price}
                      onChange={(e) => {
                        const newList = [...cardPricesList];
                        newList[index].price = e.target.value;
                        setCardPricesList(newList);
                      }}
                      className="w-full px-2 py-1.5 border-2 border-[#1a1a1a] font-mono text-sm outline-none focus:ring-2 focus:ring-[#0055ff]/50"
                      placeholder="0.00"
                    />
                  </div>
                  <button 
                    onClick={() => removeCardTier(index)}
                    className="absolute -top-3 -right-3 h-8 w-8 rounded-none border-2 border-[#1a1a1a] bg-white text-[#e63b2e] hover:bg-[#e63b2e] hover:text-white flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] z-10"
                    title="Remove Tier"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {cardPricesList.length === 0 && (
                <div className="col-span-full py-8 text-center border-2 border-dashed border-[#1a1a1a] bg-[#f5f0e8]">
                  <p className="text-gray-500 font-mono text-xs uppercase font-bold">No card tiers defined.</p>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Global Commission Rates */}
          <div className="brutalist-card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-[#1a1a1a] pb-3 gap-4">
              <h2 className="text-xl font-extrabold text-[#1a1a1a] font-display uppercase tracking-tight flex items-center gap-2">
                <Settings className="h-6 w-6 text-[#e63b2e]" />
                Global Commission Rates
              </h2>
              <button 
                onClick={addCommission}
                className="px-3 py-1.5 border-2 border-[#1a1a1a] bg-[#1a1a1a] text-white hover:bg-[#e63b2e] text-xs font-bold font-display uppercase flex items-center justify-center gap-1 transition-colors"
              >
                <Plus className="h-4 w-4" /> Add Rate
              </button>
            </div>

            <div className="overflow-x-auto border-2 border-[#1a1a1a] shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
              <table className="w-full border-collapse text-left bg-white text-sm">
                <thead>
                  <tr className="bg-[#f5f0e8] border-b-2 border-[#1a1a1a] text-xs font-extrabold uppercase tracking-wider text-[#1a1a1a] font-display">
                    <th className="py-3 px-4 border-r-2 border-[#1a1a1a]">Action / Operation</th>
                    <th className="py-3 px-4 border-r-2 border-[#1a1a1a]">Fee Type</th>
                    <th className="py-3 px-4 border-r-2 border-[#1a1a1a]">Value</th>
                    <th className="py-3 px-4 w-16 text-center">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-[#1a1a1a] font-mono text-[#1a1a1a]">
                  {commissionList.map((item, index) => (
                    <tr key={index} className="hover:bg-[#ffcc00]/10 transition-colors">
                      <td className="py-2 px-2 border-r-2 border-[#1a1a1a]">
                        <input
                          type="text"
                          value={item.action}
                          onChange={(e) => {
                            const newList = [...commissionList];
                            newList[index].action = e.target.value;
                            setCommissionList(newList);
                          }}
                          className="w-full px-2 py-1.5 border-2 border-transparent hover:border-[#1a1a1a] focus:border-[#0055ff] font-mono text-sm bg-transparent outline-none transition-all"
                          placeholder="e.g., swap, card, send"
                        />
                      </td>
                      <td className="py-2 px-2 border-r-2 border-[#1a1a1a]">
                        <select
                          value={item.type}
                          onChange={(e) => {
                            const newList = [...commissionList];
                            newList[index].type = e.target.value;
                            setCommissionList(newList);
                          }}
                          className="w-full px-2 py-1.5 border-2 border-transparent hover:border-[#1a1a1a] focus:border-[#0055ff] font-mono text-sm uppercase bg-transparent cursor-pointer outline-none transition-all appearance-none"
                        >
                          <option value="percentage">Percentage (%)</option>
                          <option value="fixed">Fixed Amount (USD)</option>
                        </select>
                      </td>
                      <td className="py-2 px-2 border-r-2 border-[#1a1a1a]">
                        <input
                          type="number"
                          value={item.value}
                          onChange={(e) => {
                            const newList = [...commissionList];
                            newList[index].value = e.target.value;
                            setCommissionList(newList);
                          }}
                          className="w-full px-2 py-1.5 border-2 border-transparent hover:border-[#1a1a1a] focus:border-[#0055ff] font-mono text-sm bg-transparent outline-none transition-all"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button 
                          onClick={() => removeCommission(index)}
                          className="p-2 text-gray-500 hover:text-white hover:bg-[#e63b2e] border-2 border-transparent hover:border-[#1a1a1a] transition-all inline-block shadow-none hover:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]"
                          title="Delete Rate"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {commissionList.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-500 font-mono text-xs bg-[#f5f0e8]">
                        No commission rates defined.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
