'use client';
export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  CreditCard, RefreshCw, Search, Eye, CheckCircle,
  XCircle, Loader2, Package, Truck, X, MapPin, DollarSign,
  Plus, Trash2, Edit, Check, Settings, ToggleLeft, ToggleRight,
  Info, AlertTriangle, Shield, Coins, Sparkles, Layers, Globe, Landmark
} from 'lucide-react';

interface CardRequest {
  id: string;
  wallet_address: string;
  card_type: string;
  country: string;
  shipping_address: any;
  activation_status: string;
  shipping_tracking_number?: string;
  masked_pan: string;
  created_at: string;
}

interface VirtualCard {
  id: string;
  wallet_address: string;
  card_last4: string;
  card_holder_name: string;
  expiry_mm_yy: string;
  card_variant: string;
  card_network: string;
  card_status: string;
  balance: number;
  is_physical: boolean;
  codego_card_id?: string;
  codego_status?: string;
  created_at: string;
}

interface CardVariant {
  id: string;
  name: string;
  variant_name: string;
  network: 'Visa' | 'Mastercard';
  features: string[];
  price: number;
  annual_fee_usd: number;
  activation_fee_usd?: number;
  transaction_limit_usd: number;
  design_url: string;
  color_hex: string;
  card_color_hex: string;
  is_active: boolean;
  is_physical?: boolean;
  is_virtual?: boolean;
  gradient_colors?: string[];
  currency_support?: string[];
  fee_rate?: number;
}

interface ShippingFee {
  id: string;
  country_name: string;
  country_code: string;
  fee_usd: number;
}

interface FiatCurrency {
  code: string;
  symbol: string;
  name: string;
  rate: number;
  locale?: string;
  format?: string;
}

function safeParseFloat(value: string | number | null | undefined): number {
  const n = parseFloat(String(value ?? 0));
  return isNaN(n) ? 0 : n;
}

export default function CardsPage() {
  const [activeTab, setActiveTab] = useState<'requests' | 'virtual' | 'variants' | 'pricing'>('virtual');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<CardRequest | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  
  // Variants search/state
  const [variantSearch, setVariantSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<CardVariant | null>(null);
  
  // Form State for Variant
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formVariantName, setFormVariantName] = useState('');
  const [formNetwork, setFormNetwork] = useState<'Visa' | 'Mastercard'>('Visa');
  const [formPrice, setFormPrice] = useState('0');
  const [formAnnualFee, setFormAnnualFee] = useState('0');
  const [formActivationFee, setFormActivationFee] = useState('0');
  const [formLimit, setFormLimit] = useState('5000');
  const [formColorHex, setFormColorHex] = useState('#2A2B31');
  const [formCardColorHex, setFormCardColorHex] = useState('#2A2B31');
  const [formDesignUrl, setFormDesignUrl] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formIsPhysical, setFormIsPhysical] = useState(true);
  const [formIsVirtual, setFormIsVirtual] = useState(true);
  const [formFeeRate, setFormFeeRate] = useState('1.5');
  const [formFeaturesText, setFormFeaturesText] = useState('');
  const [formCurrenciesText, setFormCurrenciesText] = useState('BTC, ETH, USDT, USDC');
  const [formGradientsText, setFormGradientsText] = useState('#2B2B30, #18181A, #0D0D0E');

  // Form State for Shipping
  const [shippingCountry, setShippingCountry] = useState('');
  const [shippingCode, setShippingCode] = useState('');
  const [shippingCost, setShippingCost] = useState('9.99');
  const [editingShippingId, setEditingShippingId] = useState<string | null>(null);

  // Form State for Currency
  const [fiatCode, setFiatCode] = useState('');
  const [fiatSymbol, setFiatSymbol] = useState('');
  const [fiatName, setFiatName] = useState('');
  const [fiatRate, setFiatRate] = useState('1.0');
  const [fiatLocale, setFiatLocale] = useState('');
  const [editingFiatCode, setEditingFiatCode] = useState<string | null>(null);

  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mutateError, setMutateError] = useState<string | null>(null);
  const [syncingCardId, setSyncingCardId] = useState<string | null>(null);
  const [fixingCardId, setFixingCardId] = useState<string | null>(null);
  const [vCardSearch, setVCardSearch] = useState('');
  const queryClient = useQueryClient();

  // Realtime: invalidate virtual cards cache on any INSERT/UPDATE to vcc_cards
  React.useEffect(() => {
    const channel = supabase
      .channel('admin_vcc_cards_live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vcc_cards' },
        () => { queryClient.invalidateQueries({ queryKey: ['admin-vcc-cards'] }); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // ─── Query Virtual Cards (vcc_cards) ─────────────────────────────────────────
  const { data: virtualCards, isLoading: isVirtualLoading, refetch: refetchVirtual } = useQuery({
    queryKey: ['admin-vcc-cards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vcc_cards')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as VirtualCard[];
    },
    refetchInterval: 30000,
  });

  const handleFixCardSync = async (card: VirtualCard) => {
    if (!confirm(`Resync card credentials for ${card.wallet_address.slice(0, 10)}...?\n\nThis will regenerate the encrypted card number in the cards table to match vcc_cards (last4: ${card.card_last4}).\n\nThe user must pull-to-refresh in the app to see the updated card.`)) return;
    setFixingCardId(card.id);
    try {
      const res = await fetch('/api/admin/fix-card-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: card.wallet_address }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Fix failed');
      alert(`✅ ${result.message}\n\nTell the user to pull-to-refresh in the app.`);
      queryClient.invalidateQueries({ queryKey: ['admin-vcc-cards'] });
    } catch (err: any) {
      alert('❌ Fix failed: ' + err.message);
    } finally {
      setFixingCardId(null);
    }
  };

  const handleSyncToCodego = async (card: VirtualCard) => {
    if (!confirm(`Sync card for ${card.wallet_address.slice(0, 10)}... to Codego?`)) return;
    setSyncingCardId(card.id);
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: card.wallet_address,
          nameOnCard: card.card_holder_name,
          type: 'virtual',
          variant: card.card_variant === 'platinum' ? 'premium' : card.card_variant === 'gold' ? 'gold' : 'standard',
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Codego sync failed');
      queryClient.invalidateQueries({ queryKey: ['admin-vcc-cards'] });
      alert('✅ Card synced to Codego successfully!');
    } catch (err: any) {
      alert('❌ Sync failed: ' + err.message);
    } finally {
      setSyncingCardId(null);
    }
  };

  // ─── Query Requests ──────────────────────────────────────────────────────────
  const { data: requests, isLoading: isRequestsLoading, error: queryError, refetch: refetchRequests, isRefetching: isRefetchingRequests } = useQuery({
    queryKey: ['admin-card-requests', statusFilter],
    queryFn: async () => {
      const res = await fetch('/api/admin/physical-cards');
      if (!res.ok) throw new Error('Failed to fetch physical cards');
      const data = await res.json();
      let results = data.cards || [];
      if (statusFilter !== 'all') {
        results = results.filter((r: any) => r.activation_status === statusFilter);
      }
      return results as CardRequest[];
    },
    refetchInterval: 20000,
    enabled: activeTab === 'requests',
  });

  // ─── Query Variants ──────────────────────────────────────────────────────────
  const { data: variants, isLoading: isVariantsLoading, error: variantsError, refetch: refetchVariants, isRefetching: isRefetchingVariants } = useQuery({
    queryKey: ['admin-card-variants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('card_variants')
        .select('*')
        .order('annual_fee_usd', { ascending: true });
      if (error) throw error;
      return (data || []) as CardVariant[];
    },
    enabled: activeTab === 'variants' || activeTab === 'pricing',
  });

  // ─── Query Shipping Fees ──────────────────────────────────────────────────────
  const { data: shippingFees, isLoading: isShippingLoading, error: shippingError, refetch: refetchShipping } = useQuery({
    queryKey: ['admin-shipping-fees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipping_fees')
        .select('*')
        .order('country_name', { ascending: true });
      if (error) throw error;
      return (data || []) as ShippingFee[];
    },
    enabled: activeTab === 'pricing',
  });

  // ─── Query Fiat Currencies ────────────────────────────────────────────────────
  const { data: fiatCurrencies, isLoading: isFiatLoading, error: fiatError, refetch: refetchFiat } = useQuery({
    queryKey: ['admin-fiat-currencies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fiat_currencies')
        .select('*')
        .order('code', { ascending: true });
      if (error) throw error;
      return (data || []) as FiatCurrency[];
    },
    enabled: activeTab === 'pricing',
  });

  React.useEffect(() => {
    if (queryError) setFetchError((queryError as Error).message || 'Failed to load card requests.');
  }, [queryError]);

  React.useEffect(() => {
    if (variantsError) setFetchError((variantsError as Error).message || 'Failed to load card variants.');
  }, [variantsError]);

  React.useEffect(() => {
    if (shippingError) setFetchError((shippingError as Error).message || 'Failed to load shipping fees.');
  }, [shippingError]);

  React.useEffect(() => {
    if (fiatError) setFetchError((fiatError as Error).message || 'Failed to load fiat currencies.');
  }, [fiatError]);

  // ─── Mutations Requests ───────────────────────────────────────────────────────
  const updateStatus = useMutation({
    mutationFn: async ({ id, status, tracking }: { id: string; status: string; tracking?: string }) => {
      const res = await fetch('/api/admin/physical-cards/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: id, action: status, trackingNumber: tracking })
      });
      if (!res.ok) throw new Error('Failed to process card request');
      return status;
    },
    onSuccess: (newStatus) => {
      setMutateError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-card-requests'] });
      setSelectedRequest((prev) => prev ? { ...prev, activation_status: newStatus } : null);
      setTrackingNumber('');
    },
    onError: (err) => {
      setMutateError((err as Error).message || 'Failed to update card request status.');
    },
  });

  // ─── Mutations Variants ───────────────────────────────────────────────────────
  const saveVariant = useMutation({
    mutationFn: async (variantData: any) => {
      const isEdit = !!editingVariant;
      if (isEdit) {
        const { error } = await supabase
          .from('card_variants')
          .update(variantData)
          .eq('id', editingVariant.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('card_variants')
          .insert([variantData]);
        if (error) throw error;
      }
      return variantData;
    },
    onSuccess: () => {
      setMutateError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-card-variants'] });
      setIsFormOpen(false);
      setEditingVariant(null);
    },
    onError: (err) => {
      setMutateError((err as Error).message || 'Failed to save card variant. Verify DB column sync.');
    },
  });

  const deleteVariant = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('card_variants')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      setMutateError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-card-variants'] });
    },
    onError: (err) => {
      setMutateError((err as Error).message || 'Failed to delete variant.');
    },
  });

  const toggleVariantStatus = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('card_variants')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
      return { id, is_active };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-card-variants'] });
    },
    onError: (err) => {
      setMutateError((err as Error).message || 'Failed to toggle status.');
    },
  });

  // ─── Mutations Shipping ──────────────────────────────────────────────────────
  const saveShipping = useMutation({
    mutationFn: async (shippingData: any) => {
      const { error } = await supabase
        .from('shipping_fees')
        .upsert(shippingData, { onConflict: 'country_name' });
      if (error) throw error;
      return shippingData;
    },
    onSuccess: () => {
      setMutateError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-shipping-fees'] });
      setShippingCountry('');
      setShippingCode('');
      setShippingCost('9.99');
      setEditingShippingId(null);
    },
    onError: (err) => {
      setMutateError((err as Error).message || 'Failed to save shipping fee.');
    },
  });

  const deleteShipping = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('shipping_fees')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shipping-fees'] });
    },
    onError: (err) => {
      setMutateError((err as Error).message || 'Failed to delete shipping fee.');
    },
  });

  // ─── Mutations Currency ─────────────────────────────────────────────────────
  const saveCurrency = useMutation({
    mutationFn: async (currencyData: any) => {
      const { error } = await supabase
        .from('fiat_currencies')
        .upsert(currencyData, { onConflict: 'code' });
      if (error) throw error;
      return currencyData;
    },
    onSuccess: () => {
      setMutateError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-fiat-currencies'] });
      setFiatCode('');
      setFiatSymbol('');
      setFiatName('');
      setFiatRate('1.0');
      setFiatLocale('');
      setEditingFiatCode(null);
    },
    onError: (err) => {
      setMutateError((err as Error).message || 'Failed to save fiat currency.');
    },
  });

  const deleteCurrency = useMutation({
    mutationFn: async (code: string) => {
      const { error } = await supabase
        .from('fiat_currencies')
        .delete()
        .eq('code', code);
      if (error) throw error;
      return code;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-fiat-currencies'] });
    },
    onError: (err) => {
      setMutateError((err as Error).message || 'Failed to delete fiat currency.');
    },
  });

  // ─── Event Handlers ──────────────────────────────────────────────────────────
  const handleStatusChange = (id: string, status: string, tracking?: string) => {
    const labels: Record<string, string> = { pending: 'APPROVE', rejected: 'REJECT', shipped: 'mark as SHIPPED', delivered: 'mark as DELIVERED' };
    const label = labels[status] ?? status.toUpperCase();
    if (status === 'shipped' && !tracking) {
      alert("Please provide a tracking number before marking as shipped.");
      return;
    }
    if (!confirm(`Are you sure you want to ${label} this card request?`)) return;
    setMutateError(null);
    updateStatus.mutate({ id, status, tracking });
  };

  const handleOpenCreateForm = () => {
    setEditingVariant(null);
    setFormId('');
    setFormName('');
    setFormVariantName('');
    setFormNetwork('Visa');
    setFormPrice('0');
    setFormAnnualFee('0');
    setFormActivationFee('0');
    setFormLimit('5000');
    setFormColorHex('#2A2B31');
    setFormCardColorHex('#2A2B31');
    setFormDesignUrl('');
    setFormIsActive(true);
    setFormIsPhysical(true);
    setFormIsVirtual(true);
    setFormFeeRate('1.5');
    setFormFeaturesText('Virtual & Physical payments, Priority service desk');
    setFormCurrenciesText('BTC, ETH, USDT, USDC');
    setFormGradientsText('#2B2B30, #18181A, #0D0D0E');
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (v: CardVariant) => {
    setEditingVariant(v);
    setFormId(v.id);
    setFormName(v.name);
    setFormVariantName(v.variant_name);
    setFormNetwork(v.network);
    setFormPrice(String(v.price));
    setFormAnnualFee(String(v.annual_fee_usd));
    setFormActivationFee(String(v.activation_fee_usd ?? 0));
    setFormLimit(String(v.transaction_limit_usd));
    setFormColorHex(v.color_hex);
    setFormCardColorHex(v.card_color_hex);
    setFormDesignUrl(v.design_url);
    setFormIsActive(v.is_active);
    setFormIsPhysical(v.is_physical ?? true);
    setFormIsVirtual(v.is_virtual ?? true);
    setFormFeeRate(String(v.fee_rate ?? 1.5));
    setFormFeaturesText(v.features.join(', '));
    setFormCurrenciesText((v.currency_support || ['BTC', 'ETH', 'USDT', 'USDC']).join(', '));
    setFormGradientsText((v.gradient_colors || [v.card_color_hex]).join(', '));
    setIsFormOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formId.trim()) { alert('ID is required'); return; }
    if (!formName.trim()) { alert('Name is required'); return; }

    const features = formFeaturesText.split(',').map(s => s.trim()).filter(Boolean);
    const currency_support = formCurrenciesText.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    const gradient_colors = formGradientsText.split(',').map(s => s.trim()).filter(Boolean);

    const payload = {
      id: formId.trim().toLowerCase(),
      name: formName.trim(),
      variant_name: formVariantName.trim() || formName.trim(),
      network: formNetwork,
      price: safeParseFloat(formPrice),
      annual_fee_usd: safeParseFloat(formAnnualFee),
      activation_fee_usd: safeParseFloat(formActivationFee),
      transaction_limit_usd: safeParseFloat(formLimit),
      color_hex: formColorHex.trim() || '#2A2B31',
      card_color_hex: gradient_colors[0] || formCardColorHex.trim() || '#2A2B31',
      design_url: formDesignUrl.trim(),
      is_active: formIsActive,
      features,
      is_physical: formIsPhysical,
      is_virtual: formIsVirtual,
      fee_rate: safeParseFloat(formFeeRate),
      currency_support,
      gradient_colors,
    };

    saveVariant.mutate(payload);
  };

  const handleDeleteVariant = (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this card variant? Users holding this variant will fall back to default card states.')) return;
    deleteVariant.mutate(id);
  };

  const handleToggleActive = (id: string, currentStatus: boolean) => {
    toggleVariantStatus.mutate({ id, is_active: !currentStatus });
  };

  // ─── Filter Functions ────────────────────────────────────────────────────────
  const filteredRequests = (requests || []).filter((r: CardRequest) => {
    const term = searchTerm.toLowerCase();
    return (
      r.wallet_address?.toLowerCase().includes(term) ||
      r.card_type?.toLowerCase().includes(term) ||
      r.country?.toLowerCase().includes(term)
    );
  });

  const filteredVariants = (variants || []).filter((v: CardVariant) => {
    const term = variantSearch.toLowerCase();
    return (
      v.name?.toLowerCase().includes(term) ||
      v.variant_name?.toLowerCase().includes(term) ||
      v.network?.toLowerCase().includes(term)
    );
  });

  const countByStatus = (s: string) => (requests || []).filter((r: CardRequest) => r.activation_status === s).length;

  const STATUS_STYLES: Record<string, string> = {
    not_requested: 'bg-white text-[#1a1a1a]',
    pending:  'bg-white text-[#1a1a1a] animate-pulse',
    shipped:  'bg-[#0055ff] text-white',
    delivered: 'bg-[#00ffcc] text-[#1a1a1a]',
  };

  return (
    <div className="space-y-8 animate-fade-in relative min-h-screen pb-12">
      {/* Error banners */}
      {fetchError && (
        <div className="flex items-center gap-2 px-4 py-3 border-2 border-[#1a1a1a] bg-[#e63b2e] text-white text-xs font-bold font-mono uppercase">
          <XCircle className="h-4 w-4 shrink-0" />
          <span>{fetchError}</span>
          <button onClick={() => setFetchError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}
      {mutateError && (
        <div className="flex items-center gap-2 px-4 py-3 border-2 border-[#1a1a1a] bg-[#e63b2e] text-white text-xs font-bold font-mono uppercase">
          <XCircle className="h-4 w-4 shrink-0" />
          <span>{mutateError}</span>
          <button onClick={() => setMutateError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-3 border-[#1a1a1a] pb-6 bg-[#ffcc00] p-6 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] border-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#1a1a1a] font-display uppercase leading-none">
            {activeTab === 'virtual' ? 'Virtual Cards' : activeTab === 'requests' ? 'Physical Card Requests' : activeTab === 'variants' ? 'Card Variant Architecture' : 'Card Pricing & Currencies'}
          </h1>
          <p className="text-xs text-[#1a1a1a] font-bold mt-2 font-mono uppercase tracking-wider">
            {activeTab === 'virtual'
              ? 'All virtual cards issued to users — sync unregistered cards to Codego'
              : activeTab === 'requests'
              ? 'Review, approve, and dispatch physical smartcard orders from verified wallets'
              : activeTab === 'variants'
              ? 'Admin panel to create, configure, theme and control cryptocurrency debit card designs'
              : 'Configure currency exchange rates, custom activation fees, shipping costs, and card ledger rates'}
          </p>
        </div>
        <button
          onClick={() => {
            if (activeTab === 'virtual') refetchVirtual();
            else if (activeTab === 'requests') refetchRequests();
            else if (activeTab === 'variants') refetchVariants();
            else { refetchShipping(); refetchFiat(); }
          }}
          disabled={isRequestsLoading || isVariantsLoading || isVirtualLoading || isRefetchingRequests || isRefetchingVariants}
          className="self-start brutalist-button px-4 py-2 flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Sync Ledger</span>
        </button>
      </div>

      {/* Tab Interface */}
      <div className="flex border-b-3 border-[#1a1a1a] bg-[#f5f0e8] p-1 gap-1 border-3 shadow-[3px_3px_0px_0px_rgba(26,26,26,1)]">
        <button
          onClick={() => setActiveTab('virtual')}
          className={`flex-1 sm:flex-none px-6 py-3.5 text-xs font-extrabold uppercase font-display tracking-wider border-2 border-transparent transition-all flex items-center justify-center gap-2 ${
            activeTab === 'virtual'
              ? 'bg-[#1a1a1a] border-[#1a1a1a] text-white'
              : 'text-[#1a1a1a] hover:bg-[#ffcc00]/20 hover:border-[#1a1a1a]'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>Virtual Cards ({virtualCards?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex-1 sm:flex-none px-6 py-3.5 text-xs font-extrabold uppercase font-display tracking-wider border-2 border-transparent transition-all flex items-center justify-center gap-2 ${
            activeTab === 'requests'
              ? 'bg-[#1a1a1a] border-[#1a1a1a] text-white'
              : 'text-[#1a1a1a] hover:bg-[#ffcc00]/20 hover:border-[#1a1a1a]'
          }`}
        >
          <CreditCard className="h-4 w-4" />
          <span>Card Orders ({requests?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('variants')}
          className={`flex-1 sm:flex-none px-6 py-3.5 text-xs font-extrabold uppercase font-display tracking-wider border-2 border-transparent transition-all flex items-center justify-center gap-2 ${
            activeTab === 'variants'
              ? 'bg-[#1a1a1a] border-[#1a1a1a] text-white'
              : 'text-[#1a1a1a] hover:bg-[#ffcc00]/20 hover:border-[#1a1a1a]'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Variants Manager ({variants?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('pricing')}
          className={`flex-1 sm:flex-none px-6 py-3.5 text-xs font-extrabold uppercase font-display tracking-wider border-2 border-transparent transition-all flex items-center justify-center gap-2 ${
            activeTab === 'pricing'
              ? 'bg-[#1a1a1a] border-[#1a1a1a] text-white'
              : 'text-[#1a1a1a] hover:bg-[#ffcc00]/20 hover:border-[#1a1a1a]'
          }`}
        >
          <Globe className="h-4 w-4" />
          <span>Pricing & Currencies</span>
        </button>
      </div>

      {/* ────────────────── VIRTUAL CARDS TAB ────────────────── */}
      {activeTab === 'virtual' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Issued', value: (virtualCards || []).length },
              { label: 'Synced to Codego', value: (virtualCards || []).filter(c => c.codego_card_id).length },
              { label: 'Pending Sync', value: (virtualCards || []).filter(c => !c.codego_card_id).length },
              { label: 'Active', value: (virtualCards || []).filter(c => c.card_status === 'active').length },
            ].map(s => (
              <div key={s.label} className="brutalist-card p-4">
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">{s.label}</p>
                <h4 className="text-2xl font-extrabold text-[#1a1a1a] mt-1.5 font-mono">
                  {isVirtualLoading ? '...' : s.value}
                </h4>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="brutalist-card">
            <div className="p-4 border-b-3 border-[#1a1a1a] flex items-center gap-3 bg-[#f5f0e8]">
              <Search className="h-4 w-4 text-[#1a1a1a]" />
              <input
                type="text"
                placeholder="Search wallet address or holder name..."
                value={vCardSearch}
                onChange={e => setVCardSearch(e.target.value)}
                className="flex-1 bg-transparent text-xs font-mono text-[#1a1a1a] outline-none placeholder-gray-400"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-[#f5f0e8] border-b-2 border-[#1a1a1a] text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]">
                    <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Wallet</th>
                    <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Holder Name</th>
                    <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Card</th>
                    <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Variant</th>
                    <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Status</th>
                    <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Codego</th>
                    <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Created</th>
                    <th className="py-3.5 px-4 font-display text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a1a]/10 font-mono text-[#1a1a1a]">
                  {isVirtualLoading ? (
                    <tr><td colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-[#1a1a1a]" />
                        <span className="font-bold font-display uppercase text-xs">Loading virtual cards...</span>
                      </div>
                    </td></tr>
                  ) : (virtualCards || []).filter(c =>
                    !vCardSearch ||
                    c.wallet_address.toLowerCase().includes(vCardSearch.toLowerCase()) ||
                    c.card_holder_name.toLowerCase().includes(vCardSearch.toLowerCase())
                  ).length === 0 ? (
                    <tr><td colSpan={8} className="py-16 text-center text-[#1a1a1a] font-bold uppercase font-display">No virtual cards found.</td></tr>
                  ) : (
                    (virtualCards || []).filter(c =>
                      !vCardSearch ||
                      c.wallet_address.toLowerCase().includes(vCardSearch.toLowerCase()) ||
                      c.card_holder_name.toLowerCase().includes(vCardSearch.toLowerCase())
                    ).map(card => (
                      <tr key={card.id} className="hover:bg-[#ffcc00]/5 transition-colors">
                        <td className="py-3 px-4 border-r border-[#1a1a1a]/10">
                          <span className="text-[10px] font-bold truncate block max-w-[120px]" title={card.wallet_address}>
                            {card.wallet_address.slice(0, 6)}...{card.wallet_address.slice(-4)}
                          </span>
                        </td>
                        <td className="py-3 px-4 border-r border-[#1a1a1a]/10 font-bold uppercase text-[10px]">{card.card_holder_name}</td>
                        <td className="py-3 px-4 border-r border-[#1a1a1a]/10">
                          <span className="font-bold">•••• {card.card_last4}</span>
                          <span className="text-gray-400 ml-1">{card.expiry_mm_yy}</span>
                        </td>
                        <td className="py-3 px-4 border-r border-[#1a1a1a]/10">
                          <span className="px-2 py-0.5 border border-[#1a1a1a] text-[9px] font-bold uppercase bg-[#f5f0e8]">
                            {card.card_network} {card.card_variant}
                          </span>
                        </td>
                        <td className="py-3 px-4 border-r border-[#1a1a1a]/10">
                          <span className={`px-2 py-0.5 border-2 border-[#1a1a1a] text-[9px] font-extrabold uppercase ${
                            card.card_status === 'active' ? 'bg-[#00ffcc] text-[#1a1a1a]' :
                            card.card_status === 'frozen' ? 'bg-[#0055ff] text-white' :
                            'bg-[#e63b2e] text-white'
                          }`}>{card.card_status}</span>
                        </td>
                        <td className="py-3 px-4 border-r border-[#1a1a1a]/10">
                          {card.codego_card_id ? (
                            <div className="flex items-center gap-1.5">
                              <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                              <span className="text-[9px] font-mono text-green-700 font-bold truncate max-w-[80px]" title={card.codego_card_id}>
                                {card.codego_card_id.slice(0, 8)}...
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5 text-[#e63b2e]" />
                              <span className="text-[9px] font-bold text-[#e63b2e] uppercase">Not synced</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 border-r border-[#1a1a1a]/10 text-gray-500 text-[10px]">
                          {new Date(card.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Fix Card Sync — always visible, fixes cards table mismatch */}
                            <button
                              onClick={() => handleFixCardSync(card)}
                              disabled={fixingCardId === card.id}
                              title="Regenerate encrypted card credentials to match vcc_cards last4"
                              className="px-2 py-1.5 bg-[#ffcc00] text-[#1a1a1a] border-2 border-[#1a1a1a] text-[10px] font-bold uppercase hover:bg-[#f0bf00] disabled:opacity-50 flex items-center gap-1 shadow-[1px_1px_0px_0px_rgba(26,26,26,1)]"
                            >
                              {fixingCardId === card.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Settings className="h-3 w-3" />}
                              {fixingCardId === card.id ? 'Fixing...' : 'Fix Sync'}
                            </button>

                            {!card.codego_card_id ? (
                              <button
                                onClick={() => handleSyncToCodego(card)}
                                disabled={syncingCardId === card.id}
                                className="px-3 py-1.5 bg-[#0055ff] text-white border-2 border-[#1a1a1a] text-[10px] font-bold uppercase hover:bg-[#003cc5] disabled:opacity-50 flex items-center gap-1 shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]"
                              >
                                {syncingCardId === card.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                {syncingCardId === card.id ? 'Syncing...' : 'Sync to Codego'}
                              </button>
                            ) : (
                              <span className="text-[10px] font-bold text-green-600 uppercase flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" /> Registered
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ────────────────── VIEW TAB 1: PHYSICAL REQUESTS ────────────────── */}
      {activeTab === 'requests' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Requests', value: (requests || []).length, color: '' },
              { label: 'Pending Review', value: countByStatus('pending'), color: '!bg-[#ffcc00]/10' },
              { label: 'Approved / Shipped', value: countByStatus('approved') + countByStatus('shipped'), color: '!bg-[#0055ff]/10' },
              { label: 'Rejected', value: countByStatus('rejected'), color: '!bg-[#e63b2e]/10' },
            ].map(s => (
              <div key={s.label} className={`brutalist-card p-4 ${s.color}`}>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">{s.label}</p>
                <h4 className="text-2xl font-extrabold text-[#1a1a1a] mt-1.5 font-mono">
                  {isRequestsLoading ? '...' : s.value}
                </h4>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="brutalist-card">
            <div className="p-4 border-b-3 border-[#1a1a1a] flex flex-col md:flex-row gap-4 items-center justify-between bg-[#f5f0e8]">
              <div className="flex flex-wrap items-center gap-1.5 p-1 border-2 border-[#1a1a1a] bg-white">
                {['all', 'not_requested', 'pending', 'shipped', 'delivered'].map(f => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`px-3 py-1 text-xs font-bold uppercase font-display tracking-wider transition-all ${
                      statusFilter === f ? 'text-white bg-[#1a1a1a]' : 'text-[#1a1a1a] hover:bg-[#ffcc00]/20'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="relative w-full md:max-w-xs">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-[#1a1a1a]" />
                </span>
                <input
                  type="text"
                  placeholder="Search wallet, card type, country..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full brutalist-input !pl-9 focus:ring-0"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-[#f5f0e8] border-b-2 border-[#1a1a1a] text-[10px] font-bold uppercase tracking-wider text-[#1a1a1a]">
                    <th className="py-3.5 px-6 border-r border-[#1a1a1a] font-display">Wallet Address</th>
                    <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Card Specification</th>
                    <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Country</th>
                    <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display text-right">Total Invoice</th>
                    <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Submitted</th>
                    <th className="py-3.5 px-4 border-r border-[#1a1a1a] font-display">Status</th>
                    <th className="py-3.5 px-6 text-right font-display">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a1a]/10 font-mono text-[#1a1a1a]">
                  {isRequestsLoading ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-gray-500">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin text-[#1a1a1a]" />
                          <span className="font-bold font-display uppercase text-xs">Loading ledger queue...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-[#1a1a1a] font-bold uppercase font-display">
                        No invoices registered in this partition.
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((r: any) => (
                      <tr key={r.id} className="hover:bg-[#ffcc00]/5 transition-colors">
                        <td className="py-4 px-6 border-r border-[#1a1a1a]/10 font-bold">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 border-2 border-[#1a1a1a] bg-[#ffcc00] flex items-center justify-center text-[#1a1a1a]">
                              <CreditCard className="h-4 w-4" />
                            </div>
                            <span className="text-[10px] truncate max-w-[160px]">{r.wallet_address}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 border-r border-[#1a1a1a]/10 font-bold uppercase">{r.masked_pan}</td>
                        <td className="py-4 px-4 border-r border-[#1a1a1a]/10">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 text-gray-500" />
                            <span className="font-bold">{r.country}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 border-r border-[#1a1a1a]/10 text-right font-bold">
                          {r.shipping_tracking_number || 'N/A'}
                        </td>
                        <td className="py-4 px-4 border-r border-[#1a1a1a]/10 text-gray-500">
                          {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="py-4 px-4 border-r border-[#1a1a1a]/10">
                          <span className={`px-2.5 py-0.5 border-2 border-[#1a1a1a] text-[9px] font-extrabold uppercase ${STATUS_STYLES[r.activation_status] ?? 'bg-white text-[#1a1a1a]'}`}>
                            {r.activation_status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => {
                              setSelectedRequest(r);
                              setTrackingNumber(r.shipping_tracking_number || '');
                            }}
                            className="px-3 py-1.5 brutalist-button text-xs shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]"
                          >
                            <Eye className="h-3.5 w-3.5 inline mr-1" />
                            <span>Review</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Drawer Details */}
          {selectedRequest && (
            <div className="fixed inset-0 z-50 flex justify-end">
              <div className="fixed inset-0 bg-[#1a1a1a]/60 backdrop-blur-xs" onClick={() => setSelectedRequest(null)} />
              <div className="relative w-full max-w-lg h-full bg-white border-l-3 border-[#1a1a1a] shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-slide-in-right z-50">
                <div>
                  <div className="flex items-center justify-between pb-5 border-b-3 border-[#1a1a1a] mb-6">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 border-2 border-[#1a1a1a] bg-[#ffcc00] flex items-center justify-center text-[#1a1a1a] shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
                        <Package className="h-6 w-6" />
                      </div>
                      <div>
                        <h2 className="text-xl font-extrabold text-[#1a1a1a] font-display uppercase leading-tight">Card Order Review</h2>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">ID: {selectedRequest.id}</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedRequest(null)} className="p-1.5 border-2 border-[#1a1a1a] hover:bg-[#f5f0e8] text-[#1a1a1a]">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-4 font-mono">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Card Name', value: selectedRequest.card_type },
                        { label: 'Masked PAN', value: selectedRequest.masked_pan },
                        { label: 'Destination Country', value: selectedRequest.country },
                        { label: 'Timestamp', value: new Date(selectedRequest.created_at).toLocaleString() },
                        { label: 'Current State', value: selectedRequest.activation_status?.toUpperCase() },
                        { label: 'Tracking No', value: selectedRequest.shipping_tracking_number || 'Pending' }
                      ].map(row => (
                        <div key={row.label} className="p-3 border-2 border-[#1a1a1a] bg-[#f5f0e8]">
                          <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mb-1">{row.label}</p>
                          <p className="text-xs font-bold text-[#1a1a1a] uppercase">{row.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="p-3 border-2 border-[#1a1a1a] bg-[#f5f0e8]">
                      <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mb-1">Wallet Public Address</p>
                      <p className="text-xs font-bold text-[#0055ff] break-all">{selectedRequest.wallet_address}</p>
                    </div>

                    {selectedRequest.shipping_address && (
                      <div className="p-3 border-2 border-[#1a1a1a] bg-[#f5f0e8]">
                        <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mb-1">Full Shipping Address</p>
                        <p className="text-xs font-bold text-[#1a1a1a] break-all">
                          {selectedRequest.shipping_address.street1} {selectedRequest.shipping_address.street2}
                          <br />
                          {selectedRequest.shipping_address.city}, {selectedRequest.shipping_address.state} {selectedRequest.shipping_address.postal_code}
                          <br />
                          {selectedRequest.country}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t-3 border-[#1a1a1a] space-y-3">
                  {selectedRequest.activation_status === 'pending' && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleStatusChange(selectedRequest.id, 'shipped')}
                        disabled={updateStatus.isPending}
                        className="flex-1 brutalist-button-blue py-3 text-xs disabled:opacity-50"
                      >
                        <Truck className="h-4 w-4 inline mr-1" />
                        Mark as Shipped (Requires Tracking)
                      </button>
                    </div>
                  )}
                  {selectedRequest.activation_status === 'pending' && (
                    <div className="mt-2">
                       <label className="text-[10px] uppercase font-bold mb-1 block">Carrier Tracking Number</label>
                       <input 
                         type="text" 
                         value={trackingNumber} 
                         onChange={(e) => setTrackingNumber(e.target.value)}
                         placeholder="Enter tracking ID..."
                         className="w-full brutalist-input mb-2"
                       />
                    </div>
                  )}
                  {selectedRequest.activation_status === 'shipped' && (
                    <button
                      onClick={() => handleStatusChange(selectedRequest.id, 'delivered')}
                      disabled={updateStatus.isPending}
                      className="w-full brutalist-button-blue py-3 text-xs disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Mark as Delivered
                    </button>
                  )}
                  <button onClick={() => setSelectedRequest(null)} className="w-full brutalist-button-white py-2.5 text-xs">
                    Close Sheet
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ────────────────── VIEW TAB 2: VARIANTS MANAGER ────────────────── */}
      {activeTab === 'variants' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 border-3 border-[#1a1a1a] bg-[#f5f0e8] shadow-[3px_3px_0px_0px_rgba(26,26,26,1)]">
            <div className="relative w-full sm:max-w-xs">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-[#1a1a1a]" />
              </span>
              <input
                type="text"
                placeholder="Search variant name or brand..."
                value={variantSearch}
                onChange={e => setVariantSearch(e.target.value)}
                className="w-full brutalist-input !pl-9 focus:ring-0 text-xs"
              />
            </div>
            
            <button
              onClick={handleOpenCreateForm}
              className="w-full sm:w-auto brutalist-button !bg-[#ffcc00] px-5 py-2.5 flex items-center justify-center gap-2 text-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Create Card Variant</span>
            </button>
          </div>

          {isVariantsLoading ? (
            <div className="py-24 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#1a1a1a] mb-2" />
              <p className="font-bold font-mono text-xs uppercase tracking-wider">Syncing Dynamic Card Variant Index...</p>
            </div>
          ) : filteredVariants.length === 0 ? (
            <div className="p-16 border-3 border-dashed border-[#1a1a1a] text-center bg-white">
              <AlertTriangle className="h-8 w-8 text-[#ffcc00] mx-auto mb-3" />
              <h3 className="text-sm font-black uppercase font-display">No Card Variants Found</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredVariants.map((v) => {
                const colors = v.gradient_colors && v.gradient_colors.length >= 2
                  ? v.gradient_colors
                  : [v.card_color_hex || v.color_hex || '#2A2B31', v.color_hex || '#1a1a1a'];
                
                return (
                  <div key={v.id} className="brutalist-card flex flex-col justify-between overflow-hidden !p-0">
                    <div 
                      className="p-5 relative text-white flex flex-col justify-between h-[180px]"
                      style={{ 
                        background: colors.length >= 2 
                          ? `linear-gradient(135deg, ${colors.join(', ')})`
                          : colors[0]
                      }}
                    >
                      <div className="absolute inset-0 bg-white/5 pointer-events-none" />
                      
                      <div className="flex justify-between items-start z-10">
                        <div>
                          <span className="text-[10px] font-extrabold font-mono tracking-widest bg-black/30 px-2 py-0.5 uppercase">
                            {v.id}
                          </span>
                          <h4 className="text-lg font-black tracking-tight mt-1 font-display leading-tight">{v.variant_name}</h4>
                          <span className="text-[9px] font-mono opacity-80 uppercase tracking-widest">{v.name} Edition</span>
                        </div>
                        <div className="h-7 px-3 border border-white/20 bg-white/10 flex items-center justify-center text-[10px] font-extrabold uppercase">
                          {v.network}
                        </div>
                      </div>

                      <div className="flex justify-between items-end z-10">
                        <div className="flex items-center gap-1.5 bg-black/45 px-2 py-1 border border-white/10">
                          <Coins className="h-3.5 w-3.5 text-[#ffcc00]" />
                          <span className="text-[9px] font-bold font-mono">LIMIT: ${v.transaction_limit_usd.toLocaleString()}</span>
                        </div>

                        <div className="flex gap-1">
                          {v.is_physical && (
                            <span className="text-[8px] font-mono font-black bg-emerald-600 px-1.5 py-0.5 border border-white/15">PHY</span>
                          )}
                          {v.is_virtual && (
                            <span className="text-[8px] font-mono font-black bg-cyan-600 px-1.5 py-0.5 border border-white/15">VIR</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 border-t-2 border-[#1a1a1a] bg-[#f5f0e8] font-mono text-xs text-[#1a1a1a] space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-bold uppercase text-[9px]">Mint Fee (Cost):</span>
                        <span className="font-bold">${v.price.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-bold uppercase text-[9px]">Activation Fee:</span>
                        <span className="font-bold text-[#e63b2e]">${(v.activation_fee_usd ?? 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-bold uppercase text-[9px]">Annual Fee:</span>
                        <span className="font-bold">${v.annual_fee_usd.toFixed(2)}/yr</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-bold uppercase text-[9px]">Tx Commission:</span>
                        <span className="font-bold text-amber-600">{(v.fee_rate ?? 1.50).toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-[#1a1a1a]/10">
                        <span className="text-gray-500 font-bold uppercase text-[9px]">Ledger Sync Status:</span>
                        <button
                          onClick={() => handleToggleActive(v.id, v.is_active)}
                          disabled={toggleVariantStatus.isPending}
                          className={`px-2 py-0.5 text-[9px] font-black border-2 border-[#1a1a1a] uppercase shadow-[1px_1px_0px_0px_rgba(26,26,26,1)] active:translate-y-[1px] ${
                            v.is_active 
                              ? 'bg-emerald-400 text-black' 
                              : 'bg-[#e63b2e] text-white'
                          }`}
                        >
                          {v.is_active ? 'ACTIVE' : 'DISABLED'}
                        </button>
                      </div>

                      <div className="pt-2 border-t border-[#1a1a1a]/10">
                        <p className="text-gray-500 font-bold uppercase text-[8px] mb-1">Supported Settlement Assets:</p>
                        <div className="flex flex-wrap gap-1">
                          {(v.currency_support || ['BTC', 'ETH', 'USDT', 'USDC']).map(coin => (
                            <span key={coin} className="text-[9px] font-black bg-white px-1.5 py-0.5 border border-[#1a1a1a]">
                              {coin}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2">
                        <p className="text-gray-500 font-bold uppercase text-[8px] mb-1">Privileges:</p>
                        <ul className="text-[10px] space-y-1 list-none font-sans font-semibold">
                          {v.features.slice(0, 3).map((f, i) => (
                            <li key={i} className="truncate flex items-center gap-1">
                              <span className="h-1.5 w-1.5 bg-[#1a1a1a] shrink-0" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="p-3 border-t-3 border-[#1a1a1a] flex gap-2 bg-white">
                      <button
                        onClick={() => handleOpenEditForm(v)}
                        className="flex-1 brutalist-button py-2 flex items-center justify-center gap-1.5 text-xs shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        <span>Config</span>
                      </button>
                      <button
                        onClick={() => handleDeleteVariant(v.id)}
                        disabled={deleteVariant.isPending}
                        className="brutalist-button py-2 px-3 !bg-[#e63b2e] !text-white flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ────────────────── VIEW TAB 3: PRICING & CURRENCIES ────────────────── */}
      {activeTab === 'pricing' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* Section A: Shipping Fees */}
          <div className="space-y-6">
            <div className="brutalist-card bg-[#f5f0e8] border-3 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
              <h3 className="text-lg font-black uppercase font-display border-b-3 border-[#1a1a1a] pb-3 mb-4 flex items-center gap-2 text-[#1a1a1a]">
                <MapPin className="h-5 w-5" />
                <span>Shipping Fees Manager</span>
              </h3>

              {/* Add/Edit Form */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!shippingCountry.trim()) { alert('Country name is required'); return; }
                  saveShipping.mutate({
                    id: editingShippingId || undefined,
                    country_name: shippingCountry.trim(),
                    country_code: shippingCode.trim().toUpperCase(),
                    fee_usd: safeParseFloat(shippingCost),
                  });
                }}
                className="p-4 border-2 border-[#1a1a1a] bg-white space-y-4 mb-6 font-mono text-xs"
              >
                <h4 className="font-extrabold uppercase text-[10px] text-amber-600 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{editingShippingId ? 'Modify Shipping Fee Rules' : 'Declare New Shipping Fee Rule'}</span>
                </h4>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block font-bold uppercase text-[8px] text-gray-500 mb-1">Country Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Switzerland"
                      value={shippingCountry}
                      onChange={e => setShippingCountry(e.target.value)}
                      className="w-full brutalist-input text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold uppercase text-[8px] text-gray-500 mb-1">ISO Code</label>
                    <input
                      type="text"
                      placeholder="e.g. CH"
                      maxLength={3}
                      value={shippingCode}
                      onChange={e => setShippingCode(e.target.value)}
                      className="w-full brutalist-input text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 items-end">
                  <div className="col-span-2">
                    <label className="block font-bold uppercase text-[8px] text-gray-500 mb-1">Shipping Fee (USD) *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 font-bold">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="19.99"
                        value={shippingCost}
                        onChange={e => setShippingCost(e.target.value)}
                        className="w-full brutalist-input !pl-7 text-xs"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {editingShippingId && (
                      <button
                        type="button"
                        onClick={() => {
                          setShippingCountry('');
                          setShippingCode('');
                          setShippingCost('9.99');
                          setEditingShippingId(null);
                        }}
                        className="brutalist-button-white px-3 py-2.5 text-[10px]"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={saveShipping.isPending}
                      className="flex-1 brutalist-button px-3 py-2.5 text-[10px] !bg-[#ffcc00]"
                    >
                      {saveShipping.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </form>

              {/* Table list */}
              {isShippingLoading ? (
                <div className="text-center py-10 font-mono text-xs uppercase">Loading Shipping Invoices...</div>
              ) : (
                <div className="max-h-[360px] overflow-y-auto border-2 border-[#1a1a1a] bg-white divide-y divide-[#1a1a1a]">
                  {(shippingFees || []).map((fee) => (
                    <div key={fee.id} className="p-3 flex items-center justify-between font-mono text-xs hover:bg-[#ffcc00]/5 transition-colors">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded border border-[#1a1a1a] bg-[#f5f0e8] flex items-center justify-center font-bold text-[#1a1a1a] text-[10px]">
                          {fee.country_code || 'XX'}
                        </div>
                        <div>
                          <p className="font-extrabold text-[#1a1a1a]">{fee.country_name}</p>
                          <p className="text-[9px] text-gray-400">Ruleset ID: {fee.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-black text-[#e63b2e]">${fee.fee_usd.toFixed(2)}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setShippingCountry(fee.country_name);
                              setShippingCode(fee.country_code);
                              setShippingCost(String(fee.fee_usd));
                              setEditingShippingId(fee.id);
                            }}
                            className="p-1.5 border border-[#1a1a1a] bg-white hover:bg-amber-100"
                          >
                            <Edit className="h-3.5 w-3.5 text-[#1a1a1a]" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete shipping rule for ${fee.country_name}?`)) {
                                deleteShipping.mutate(fee.id);
                              }
                            }}
                            className="p-1.5 border border-[#1a1a1a] bg-white hover:bg-red-100"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-[#e63b2e]" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section B: Currency pricing & exchange rates */}
          <div className="space-y-6">
            <div className="brutalist-card bg-[#f5f0e8] border-3 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
              <h3 className="text-lg font-black uppercase font-display border-b-3 border-[#1a1a1a] pb-3 mb-4 flex items-center gap-2 text-[#1a1a1a]">
                <Globe className="h-5 w-5" />
                <span>Fiat Currencies & Pricing Rates</span>
              </h3>

              {/* Add/Edit Form */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!fiatCode.trim()) { alert('Currency code is required'); return; }
                  saveCurrency.mutate({
                    code: fiatCode.trim().toUpperCase(),
                    symbol: fiatSymbol.trim(),
                    name: fiatName.trim(),
                    rate: safeParseFloat(fiatRate),
                    locale: fiatLocale.trim() || undefined,
                    format: fiatLocale.trim() || undefined,
                  });
                }}
                className="p-4 border-2 border-[#1a1a1a] bg-white space-y-4 mb-6 font-mono text-xs"
              >
                <h4 className="font-extrabold uppercase text-[10px] text-amber-600 flex items-center gap-1">
                  <Landmark className="h-3.5 w-3.5" />
                  <span>{editingFiatCode ? `Modify Exchange Rate for ${editingFiatCode}` : 'Declare New Fiat Support & Rate'}</span>
                </h4>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold uppercase text-[8px] text-gray-500 mb-1">Currency Code *</label>
                    <input
                      type="text"
                      placeholder="e.g. CHF"
                      maxLength={3}
                      disabled={!!editingFiatCode}
                      value={fiatCode}
                      onChange={e => setFiatCode(e.target.value)}
                      className="w-full brutalist-input text-xs uppercase"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold uppercase text-[8px] text-gray-500 mb-1">Symbol *</label>
                    <input
                      type="text"
                      placeholder="e.g. Fr."
                      value={fiatSymbol}
                      onChange={e => setFiatSymbol(e.target.value)}
                      className="w-full brutalist-input text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold uppercase text-[8px] text-gray-500 mb-1">Rate (vs 1 USD) *</label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      value={fiatRate}
                      onChange={e => setFiatRate(e.target.value)}
                      className="w-full brutalist-input text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 items-end">
                  <div className="col-span-2">
                    <label className="block font-bold uppercase text-[8px] text-gray-500 mb-1">Full Name & Locale</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Swiss Franc"
                        value={fiatName}
                        onChange={e => setFiatName(e.target.value)}
                        className="w-full brutalist-input text-xs"
                      />
                      <input
                        type="text"
                        placeholder="fr-CH"
                        value={fiatLocale}
                        onChange={e => setFiatLocale(e.target.value)}
                        className="w-full brutalist-input text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {editingFiatCode && (
                      <button
                        type="button"
                        onClick={() => {
                          setFiatCode('');
                          setFiatSymbol('');
                          setFiatName('');
                          setFiatRate('1.0');
                          setFiatLocale('');
                          setEditingFiatCode(null);
                        }}
                        className="brutalist-button-white px-3 py-2.5 text-[10px]"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={saveCurrency.isPending}
                      className="flex-1 brutalist-button px-3 py-2.5 text-[10px] !bg-[#ffcc00]"
                    >
                      {saveCurrency.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </form>

              {/* Table list */}
              {isFiatLoading ? (
                <div className="text-center py-10 font-mono text-xs uppercase">Syncing Exchange Rates...</div>
              ) : (
                <div className="max-h-[360px] overflow-y-auto border-2 border-[#1a1a1a] bg-white divide-y divide-[#1a1a1a]">
                  {(fiatCurrencies || []).map((cur) => (
                    <div key={cur.code} className="p-3 flex items-center justify-between font-mono text-xs hover:bg-[#ffcc00]/5 transition-colors">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full border-2 border-[#1a1a1a] bg-[#ffcc00] flex items-center justify-center font-black text-[#1a1a1a] text-xs">
                          {cur.symbol}
                        </div>
                        <div>
                          <p className="font-extrabold text-[#1a1a1a]">{cur.code} - {cur.name}</p>
                          <p className="text-[9px] text-gray-400">1 USD = {cur.rate.toFixed(4)} {cur.code}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-black text-amber-600">{cur.rate.toFixed(2)}x</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setFiatCode(cur.code);
                              setFiatSymbol(cur.symbol);
                              setFiatName(cur.name);
                              setFiatRate(String(cur.rate));
                              setFiatLocale(cur.locale || '');
                              setEditingFiatCode(cur.code);
                            }}
                            className="p-1.5 border border-[#1a1a1a] bg-white hover:bg-amber-100"
                          >
                            <Edit className="h-3.5 w-3.5 text-[#1a1a1a]" />
                          </button>
                          <button
                            onClick={() => {
                              if (cur.code === 'USD') { alert('USD is the system base currency and cannot be deleted.'); return; }
                              if (confirm(`Remove fiat currency support for ${cur.code}?`)) {
                                deleteCurrency.mutate(cur.code);
                              }
                            }}
                            className="p-1.5 border border-[#1a1a1a] bg-white hover:bg-red-100"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-[#e63b2e]" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dynamic Card Pricing Preview Panel */}
            <div className="brutalist-card bg-white border-3 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
              <h3 className="text-md font-black uppercase font-display border-b-2 border-[#1a1a1a] pb-2 mb-3 flex items-center gap-1.5 text-gray-700">
                <Info className="h-4.5 w-4.5 text-[#0055ff]" />
                <span>Dynamic Currency Conversion Sandbox</span>
              </h3>
              <p className="text-[10px] font-mono text-gray-500 mb-4 uppercase">
                Displays physical card fees dynamically inside the mobile wallet context using current database rates.
              </p>

              <div className="space-y-3 font-mono text-xs">
                {(variants || []).map((v) => (
                  <div key={v.id} className="p-3 border border-[#1a1a1a] bg-[#f5f0e8]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="font-extrabold text-[#1a1a1a] uppercase">{v.variant_name || v.name}</span>
                    <div className="flex flex-wrap gap-2">
                      {(fiatCurrencies || []).slice(0, 5).map((cur) => {
                        const localPrice = v.price * cur.rate;
                        const localAct = (v.activation_fee_usd ?? 0) * cur.rate;
                        const localAnn = v.annual_fee_usd * cur.rate;
                        return (
                          <div key={cur.code} className="px-2 py-1 bg-white border border-[#1a1a1a] text-[9px] flex flex-col">
                            <span className="font-black text-amber-600">{cur.code}</span>
                            <span>Mint: {cur.symbol}{localPrice.toFixed(2)}</span>
                            <span>Act: {cur.symbol}{localAct.toFixed(2)}</span>
                            <span>Yearly: {cur.symbol}{localAnn.toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ────────────────── POPUP DIALOG: CREATE/EDIT VARIANT ────────────────── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-[#1a1a1a]/60 backdrop-blur-xs" onClick={() => setIsFormOpen(false)} />
          
          <div className="relative w-full max-w-2xl bg-white border-3 border-[#1a1a1a] shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] max-h-[90vh] flex flex-col justify-between overflow-hidden animate-zoom-in z-50">
            {/* Modal Header */}
            <div className="p-5 border-b-3 border-[#1a1a1a] bg-[#ffcc00] flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[#1a1a1a]" />
                <h3 className="text-lg font-black uppercase font-display leading-none">
                  {editingVariant ? 'Modify Card Specification' : 'Declare New Card Variant'}
                </h3>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1 border-2 border-[#1a1a1a] bg-white hover:bg-gray-100 text-[#1a1a1a]"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Modal Body (Form scroll) */}
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 font-mono text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* ID Field */}
                <div>
                  <label className="block font-bold uppercase text-[9px] text-gray-500 mb-1.5">Unique ID (lowercase, no spaces) *</label>
                  <input
                    type="text"
                    disabled={!!editingVariant}
                    placeholder="e.g., stellar_black"
                    value={formId}
                    onChange={e => setFormId(e.target.value)}
                    className="w-full brutalist-input text-xs"
                    required
                  />
                  <p className="text-[9px] text-gray-400 mt-1">Cannot be modified after creation.</p>
                </div>

                {/* Name */}
                <div>
                  <label className="block font-bold uppercase text-[9px] text-gray-500 mb-1.5">Tier Name *</label>
                  <input
                    type="text"
                    placeholder="e.g., Platinum, Titanium"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full brutalist-input text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Variant Name Accent */}
                <div>
                  <label className="block font-bold uppercase text-[9px] text-gray-500 mb-1.5">Card Variant Label Accent</label>
                  <input
                    type="text"
                    placeholder="e.g., Titanium Centurion"
                    value={formVariantName}
                    onChange={e => setFormVariantName(e.target.value)}
                    className="w-full brutalist-input text-xs"
                  />
                </div>

                {/* Card Network */}
                <div>
                  <label className="block font-bold uppercase text-[9px] text-gray-500 mb-1.5">Card Settlement Network *</label>
                  <select
                    value={formNetwork}
                    onChange={e => setFormNetwork(e.target.value as any)}
                    className="w-full brutalist-input text-xs"
                  >
                    <option value="Visa">Visa Network</option>
                    <option value="Mastercard">Mastercard Network</option>
                  </select>
                </div>
              </div>

              {/* Theme Gradients */}
              <div>
                <label className="block font-bold uppercase text-[9px] text-gray-500 mb-1.5">
                  Visual Themes (Comma-separated Hex values for background gradient)
                </label>
                <input
                  type="text"
                  placeholder="e.g., #E5A93C, #996515, #4A3B18"
                  value={formGradientsText}
                  onChange={e => setFormGradientsText(e.target.value)}
                  className="w-full brutalist-input text-xs"
                />
                <p className="text-[8px] text-gray-400 mt-1">Specify 1 Hex color for flat card theme, or 2 to 3 Hex values to render gorgeous gradients.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                {/* Price */}
                <div>
                  <label className="block font-bold uppercase text-[8px] text-gray-500 mb-1.5">Mint Cost (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formPrice}
                    onChange={e => setFormPrice(e.target.value)}
                    className="w-full brutalist-input text-xs"
                  />
                </div>

                {/* Activation fee */}
                <div>
                  <label className="block font-bold uppercase text-[8px] text-gray-500 mb-1.5">Act Fee (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formActivationFee}
                    onChange={e => setFormActivationFee(e.target.value)}
                    className="w-full brutalist-input text-xs"
                  />
                </div>

                {/* Annual fee */}
                <div>
                  <label className="block font-bold uppercase text-[8px] text-gray-500 mb-1.5">Annual (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formAnnualFee}
                    onChange={e => setFormAnnualFee(e.target.value)}
                    className="w-full brutalist-input text-xs"
                  />
                </div>

                {/* Daily limit */}
                <div>
                  <label className="block font-bold uppercase text-[8px] text-gray-500 mb-1.5">Limit (USD)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={formLimit}
                    onChange={e => setFormLimit(e.target.value)}
                    className="w-full brutalist-input text-xs"
                  />
                </div>

                {/* Tx commission fee */}
                <div>
                  <label className="block font-bold uppercase text-[8px] text-gray-500 mb-1.5">Tx Comm (%)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="100"
                    value={formFeeRate}
                    onChange={e => setFormFeeRate(e.target.value)}
                    className="w-full brutalist-input text-xs"
                  />
                </div>
              </div>

              {/* Supported Currencies */}
              <div>
                <label className="block font-bold uppercase text-[9px] text-gray-500 mb-1.5">Supported Settlement Currencies (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="BTC, ETH, USDT, USDC, SOL"
                  value={formCurrenciesText}
                  onChange={e => setFormCurrenciesText(e.target.value)}
                  className="w-full brutalist-input text-xs"
                />
              </div>

              {/* Card features */}
              <div>
                <label className="block font-bold uppercase text-[9px] text-gray-500 mb-1.5">Features & Privileges (Comma-separated)</label>
                <textarea
                  placeholder="e.g., 2% retail cashback, Complimentary global lounge access, 24/7 dedicated concierge"
                  value={formFeaturesText}
                  onChange={e => setFormFeaturesText(e.target.value)}
                  className="w-full brutalist-input text-xs h-20"
                />
              </div>

              {/* Flags and availability toggles */}
              <div className="p-4 border-2 border-[#1a1a1a] bg-[#f5f0e8] grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <p className="font-bold uppercase text-[9px] text-gray-500 border-b border-[#1a1a1a]/15 pb-1">Availability Channels</p>
                  <div className="flex gap-5">
                    <label className="flex items-center gap-2 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsPhysical}
                        onChange={e => setFormIsPhysical(e.target.checked)}
                        className="h-4 w-4 accent-amber-500"
                      />
                      <span>Physical Card Support</span>
                    </label>

                    <label className="flex items-center gap-2 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsVirtual}
                        onChange={e => setFormIsVirtual(e.target.checked)}
                        className="h-4 w-4 accent-amber-500"
                      />
                      <span>Virtual Card Support</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="font-bold uppercase text-[9px] text-gray-500 border-b border-[#1a1a1a]/15 pb-1">Ledger Status</p>
                  <div className="flex gap-5">
                    <label className="flex items-center gap-2 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsActive}
                        onChange={e => setFormIsActive(e.target.checked)}
                        className="h-4 w-4 accent-amber-500"
                      />
                      <span>Publish Instantly (Active)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Extra styling fallbacks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold uppercase text-[9px] text-gray-500 mb-1.5">Primary Branding Hex Color</label>
                  <input
                    type="text"
                    value={formColorHex}
                    onChange={e => setFormColorHex(e.target.value)}
                    className="w-full brutalist-input text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-[9px] text-gray-500 mb-1.5">Design Resource URL (External Skin Image)</label>
                  <input
                    type="text"
                    placeholder="e.g., https://storage.resource/skin.png"
                    value={formDesignUrl}
                    onChange={e => setFormDesignUrl(e.target.value)}
                    className="w-full brutalist-input text-xs"
                  />
                </div>
              </div>

              {/* Form Actions Footer */}
              <div className="pt-4 border-t-2 border-[#1a1a1a] flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 brutalist-button-white py-3 text-xs"
                >
                  Discard Changes
                </button>
                <button
                  type="submit"
                  disabled={saveVariant.isPending}
                  className="flex-1 brutalist-button py-3 text-xs !bg-[#ffcc00] font-black"
                >
                  {saveVariant.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin inline mr-1" />
                  ) : (
                    <Check className="h-4 w-4 inline mr-1" />
                  )}
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
