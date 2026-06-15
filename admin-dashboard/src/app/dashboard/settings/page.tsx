'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Settings, Save, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

export default function AppSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states (using strings for easy textarea/input editing)
  const [paymentPriority, setPaymentPriority] = useState('USDT, BTC, ETH, BNB, TRX');
  const [physicalBaseFee, setPhysicalBaseFee] = useState('50');
  const [physicalCardPrices, setPhysicalCardPrices] = useState(
    JSON.stringify({ Classic: 0, Gold: 49.99, Platinum: 99.99, Travel: 79.99 }, null, 2)
  );
  const [commissionRates, setCommissionRates] = useState(
    JSON.stringify({
      swap: { type: "percentage", value: 0.5 },
      card: { type: "percentage", value: 1.0 },
      send: { type: "fixed", value: 0.5 },
      receive: { type: "fixed", value: 0 },
      p2p_trade: { type: "percentage", value: 0.1 },
      settlement_conversion: { type: "percentage", value: 1.5 }
    }, null, 2)
  );

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('admin_settings').select('*');
      if (error) throw error;

      if (data) {
        data.forEach((row) => {
          if (row.key === 'payment_priority') {
            setPaymentPriority((row.value as string[]).join(', '));
          } else if (row.key === 'physical_base_fee') {
            setPhysicalBaseFee(String(row.value));
          } else if (row.key === 'physical_card_prices') {
            setPhysicalCardPrices(JSON.stringify(row.value, null, 2));
          } else if (row.key === 'commission_rates') {
            setCommissionRates(JSON.stringify(row.value, null, 2));
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
      
      let parsedCardPrices;
      try {
        parsedCardPrices = JSON.parse(physicalCardPrices);
      } catch (e) {
        throw new Error('Physical Card Prices must be valid JSON.');
      }

      let parsedCommissions;
      try {
        parsedCommissions = JSON.parse(commissionRates);
      } catch (e) {
        throw new Error('Commission Rates must be valid JSON.');
      }

      // 2. Prepare upsert payload
      const payload = [
        { key: 'payment_priority', value: parsedPriority },
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
          className="self-start brutalist-button-white px-6 py-2.5 flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] hover:bg-[#1a1a1a] hover:text-white"
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Card 1: Operations */}
          <div className="brutalist-card p-6 space-y-6">
            <h2 className="text-lg font-extrabold text-[#1a1a1a] font-display uppercase tracking-wider flex items-center gap-2 border-b-2 border-[#1a1a1a] pb-2">
              <Settings className="h-5 w-5 text-[#0055ff]" />
              Core Operations
            </h2>

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

          {/* Card 2: JSON Configs */}
          <div className="brutalist-card p-6 space-y-6">
            <h2 className="text-lg font-extrabold text-[#1a1a1a] font-display uppercase tracking-wider flex items-center gap-2 border-b-2 border-[#1a1a1a] pb-2">
              <Settings className="h-5 w-5 text-[#e63b2e]" />
              JSON Configurations
            </h2>

            <div>
              <label className="block text-xs font-bold text-[#1a1a1a] uppercase tracking-wider font-mono mb-2">
                Physical Card Tier Pricing (USD)
              </label>
              <textarea
                value={physicalCardPrices}
                onChange={(e) => setPhysicalCardPrices(e.target.value)}
                className="w-full brutalist-input font-mono text-xs min-h-[120px] resize-y"
                spellCheck="false"
              />
              <p className="text-[10px] text-gray-500 font-bold mt-2 uppercase">Valid JSON object mapping card tier to USD price.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1a1a1a] uppercase tracking-wider font-mono mb-2">
                Global Commission Rates
              </label>
              <textarea
                value={commissionRates}
                onChange={(e) => setCommissionRates(e.target.value)}
                className="w-full brutalist-input font-mono text-xs min-h-[180px] resize-y"
                spellCheck="false"
              />
              <p className="text-[10px] text-gray-500 font-bold mt-2 uppercase">Valid JSON defining fee structures for swap, card, send, receive, etc.</p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
