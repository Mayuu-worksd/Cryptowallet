/**
 * supabaseService.ts — v4
 * wallet_address (lowercase) is the primary link across all tables.
 */

import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseClient';
import * as FileSystem from 'expo-file-system/legacy';

// ─── Types ────────────────────────────────────────────────────────────────────

export type KYCStatus = 'pending' | 'under_review' | 'verified' | 'rejected' | null;

export type KYCRecord = {
  id?: string;
  wallet_address: string;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  nationality: string;
  dob: string;
  document_type: string;
  document_url?: string;
  selfie_url?: string;
  selfie_video_url?: string;
  unique_code?: string;
  status: KYCStatus;
  created_at?: string;
  updated_at?: string;
};

export type KYCFormData = {
  full_name: string;
  email: string;
  phone: string;
  nationality: string;
  dob: string;
  address: string;
  document_type: string;
};

export type DBCard = {
  id?: string;
  wallet_address: string;
  card_last4: string;
  expiry_month: string;
  expiry_year: string;
  card_type: string;
  balance: number;
  status: 'active' | 'frozen';
  holder_name: string;
  design: string;
  created_at?: string;
  updated_at?: string;
};

export type VCCCardVariant = {
  id: string;
  name: string;
  variant_name: string;
  network: 'Visa' | 'Mastercard';
  features: string[];
  price: number;
  annual_fee_usd: number;
  transaction_limit_usd: number;
  design_url: string;
  color_hex: string;
  card_color_hex: string;
  is_active: boolean;
};

// Legacy type kept for existing card_variants usage
export type CardVariant = VCCCardVariant;

export type VCCCard = {
  id?: string;
  wallet_address: string;
  card_last4: string;
  card_holder_name: string;
  expiry_mm_yy: string;
  card_variant: string;
  card_network: string;
  card_status: 'pending' | 'active' | 'frozen' | 'blocked';
  balance: number;
  is_physical: boolean;
  physical_shipping_status: 'not_requested' | 'processing' | 'shipped' | 'delivered';
  physical_fee_usd: number;
  shipping_fee_usd: number;
  kyc_verified: boolean;
  name_match: boolean;
  compliance_status: 'compliant' | 'flagged';
  created_at?: string;
};

export type ShippingFee = {
  id?: string;
  country_name: string;
  country_code: string;
  fee_usd: number;
};

export type CardRequest = {
  id?: string;
  wallet_address: string;
  card_type: string;
  country: string;
  shipping_fee: number;
  total_cost: number;
  status: 'pending' | 'approved' | 'rejected' | 'shipped';
  created_at?: string;
};

export type TxType = 'send' | 'receive' | 'swap' | 'card_topup' | 'card_spend' | 'debit' | 'credit' | 'fee';
export type TxStatus = 'pending' | 'success' | 'failed';

export type DBTransaction = {
  id?: string;
  wallet_address: string;
  card_id?: string;
  type: TxType;
  token: string;
  amount: number;
  usd_value: number;
  status: TxStatus;
  tx_hash?: string;
  reference_id?: string;
  label?: string;
  to_address?: string;
  description?: string;
  created_at?: string;
};

// ─── Shipping fees (static fallback) ─────────────────────────────────────────

export const SHIPPING_FEES: Record<string, number> = {
  'United States':   9.99,
  'United Kingdom': 12.99,
  'Canada':         11.99,
  'Australia':      14.99,
  'Germany':        13.99,
  'France':         13.99,
  'India':          19.99,
  'Singapore':      16.99,
  'UAE':            17.99,
  'Brazil':         22.99,
  'Japan':          15.99,
  'South Korea':    15.99,
  'Other':          24.99,
};

export const COUNTRIES = Object.keys(SHIPPING_FEES);

// ─── KYC Service ──────────────────────────────────────────────────────────────

export const kycService = {

  async getStatus(walletAddress: string): Promise<KYCRecord | null> {
    const { data, error } = await supabase
      .from('kyc')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async submitKYC(walletAddress: string, form: KYCFormData): Promise<KYCRecord> {
    const addr = walletAddress.toLowerCase();
    const existing = await kycService.getStatus(addr);

    const canSubmit = !existing
      || existing.status === 'rejected'
      || (existing.status === 'pending' && !existing.document_url);

    if (!canSubmit) throw new Error(`ALREADY_SUBMITTED:${existing!.status}`);

    const payload = {
      wallet_address: addr,
      full_name:      form.full_name.trim(),
      email:          form.email.trim(),
      phone:          form.phone.trim(),
      address:        form.address.trim(),
      nationality:    form.nationality.trim(),
      dob:            form.dob.trim(),
      document_type:  form.document_type,
      status:         'pending' as KYCStatus,
      document_url:   null,
      selfie_url:     null,
    };

    const { data, error } = await supabase
      .from('kyc')
      .upsert(payload, { onConflict: 'wallet_address' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateDetails(
    walletAddress: string,
    patch: Partial<Pick<KYCFormData, 'full_name' | 'email' | 'phone' | 'address' | 'nationality' | 'dob' | 'document_type'>>,
  ): Promise<void> {
    const { error } = await supabase
      .from('kyc')
      .update(patch)
      .eq('wallet_address', walletAddress.toLowerCase());
    if (error) throw error;
  },

  async uploadFile(
    walletAddress: string,
    fileUri: string,
    fileType: 'document' | 'selfie' | 'selfie_video',
    mimeType: string = 'image/jpeg',
  ): Promise<string> {
    const addr        = walletAddress.toLowerCase().replace('0x', '');
    const ext         = mimeType.split('/')[1] ?? 'jpg';
    const storagePath = `kyc/${addr}/${fileType}_${Date.now()}.${ext}`;
    const uploadUrl   = `${SUPABASE_URL}/storage/v1/object/kyc-docs/${storagePath}`;

    const attempt = async () => {
      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          Authorization:  `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': mimeType,
          'x-upsert':     'true',
        },
        body: bytes,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Upload failed (${response.status}): ${body}`);
      }
    };

    let lastError: any;
    for (let i = 0; i < 3; i++) {
      try {
        await attempt();
        const { data } = supabase.storage.from('kyc-docs').getPublicUrl(storagePath);
        return data.publicUrl;
      } catch (e: any) {
        lastError = e;
        if (i < 2) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
    throw lastError;
  },

  async finalizeSubmission(
    walletAddress: string,
    documentUrl: string,
    selfieUrl: string,
    extra?: { selfieVideoUrl?: string; uniqueCode?: string },
  ): Promise<void> {
    const patch: Record<string, any> = {
      document_url: documentUrl,
      selfie_url:   selfieUrl,
      status:       'under_review',
    };
    // Only include optional columns if they have a value — avoids
    // "column not found" errors if the DB schema doesn't have them yet
    if (extra?.selfieVideoUrl) {
      try {
        const { error } = await supabase.from('kyc').update({ selfie_video_url: extra.selfieVideoUrl }).eq('wallet_address', walletAddress.toLowerCase());
        if (error) console.warn('selfie_video_url column missing, skipping:', error.message);
      } catch {}
    }
    if (extra?.uniqueCode) {
      try {
        const { error } = await supabase.from('kyc').update({ unique_code: extra.uniqueCode }).eq('wallet_address', walletAddress.toLowerCase());
        if (error) console.warn('unique_code column missing, skipping:', error.message);
      } catch {}
    }

    const { error } = await supabase
      .from('kyc')
      .update(patch)
      .eq('wallet_address', walletAddress.toLowerCase());
    if (error) throw error;
  },
};

// ─── Card Service (virtual card — DB-backed, secure) ─────────────────────────

export const dbCardService = {

  async getCard(walletAddress: string): Promise<DBCard | null> {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async createCard(card: Omit<DBCard, 'id' | 'created_at' | 'updated_at'>): Promise<DBCard> {
    const { data, error } = await supabase
      .from('cards')
      .insert({ ...card, wallet_address: card.wallet_address.toLowerCase() })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateStatus(walletAddress: string, status: 'active' | 'frozen'): Promise<void> {
    const { error } = await supabase
      .from('cards')
      .update({ status })
      .eq('wallet_address', walletAddress.toLowerCase());
    if (error) throw error;
  },

  async updateBalance(walletAddress: string, balance: number): Promise<void> {
    const { error } = await supabase
      .from('cards')
      .update({ balance })
      .eq('wallet_address', walletAddress.toLowerCase());
    if (error) throw error;
  },

  async updateDesign(walletAddress: string, patch: { holder_name?: string; design?: string }): Promise<void> {
    const { error } = await supabase
      .from('cards')
      .update(patch)
      .eq('wallet_address', walletAddress.toLowerCase());
    if (error) throw error;
  },
};

// ─── Card Variants (VCC) ──────────────────────────────────────────────────────

export const FALLBACK_VARIANTS: VCCCardVariant[] = [
  { id: 'classic',  name: 'Classic',  variant_name: 'Classic',  network: 'Visa',       features: ['Virtual payments','Basic rewards','Standard support'],                                price: 0,     annual_fee_usd: 0,     transaction_limit_usd: 2000,  design_url: '', color_hex: '#2A2B31', card_color_hex: '#2A2B31', is_active: true },
  { id: 'gold',     name: 'Gold',     variant_name: 'Gold',     network: 'Visa',       features: ['2% cashback','Priority support','Travel insurance'],                                  price: 9.99,  annual_fee_usd: 9.99,  transaction_limit_usd: 5000,  design_url: '', color_hex: '#B8860B', card_color_hex: '#B8860B', is_active: true },
  { id: 'platinum', name: 'Platinum', variant_name: 'Platinum', network: 'Mastercard', features: ['5% cashback','Concierge service','Airport lounge access','No FX fees'],             price: 24.99, annual_fee_usd: 24.99, transaction_limit_usd: 15000, design_url: '', color_hex: '#708090', card_color_hex: '#708090', is_active: true },
  { id: 'travel',   name: 'Travel',   variant_name: 'Travel',   network: 'Mastercard', features: ['No FX fees','Travel insurance','Lounge access','3% travel cashback'],               price: 14.99, annual_fee_usd: 14.99, transaction_limit_usd: 10000, design_url: '', color_hex: '#1A3A5C', card_color_hex: '#1A3A5C', is_active: true },
];

export const cardVariantService = {
  async getVariants(): Promise<VCCCardVariant[]> {
    try {
      const { data, error } = await supabase
        .from('card_variants')
        .select('*')
        .eq('is_active', true)
        .order('annual_fee_usd', { ascending: true });
      if (error || !data || data.length === 0) return FALLBACK_VARIANTS;
      return data;
    } catch {
      return FALLBACK_VARIANTS;
    }
  },
};

// ─── VCC Card Service ─────────────────────────────────────────────────────────

export const vccService = {

  async getCard(walletAddress: string): Promise<VCCCard | null> {
    const { data, error } = await supabase
      .from('vcc_cards')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // Generates card number locally — never stored in full
  generateCardNumber(network: 'Visa' | 'Mastercard'): string {
    const prefix = network === 'Visa' ? '4' : '5';
    let num = prefix;
    while (num.length < 16) num += Math.floor(Math.random() * 10);
    return num.replace(/(.{4})/g, '$1 ').trim();
  },

  generateExpiry(): string {
    const now = new Date();
    const mm  = String(now.getMonth() + 1).padStart(2, '0');
    const yy  = String(now.getFullYear() + 3).slice(-2);
    return `${mm}/${yy}`;
  },

  generateCVV(): string {
    return String(Math.floor(100 + Math.random() * 900));
  },

  async applyCard(
    walletAddress: string,
    variant: VCCCardVariant,
    holderName: string,
    isPhysical: boolean,
    shippingFeeUsd: number,
  ): Promise<{ vccCard: VCCCard; cardNumber: string; cvv: string }> {
    const addr = walletAddress.toLowerCase();

    // 1. Verify KYC
    const kyc = await kycService.getStatus(addr);
    if (!kyc || kyc.status !== 'verified') {
      throw new Error('KYC_NOT_VERIFIED');
    }

    // 2. Name match check
    const kycName    = (kyc.full_name ?? '').trim().toLowerCase();
    const inputName  = holderName.trim().toLowerCase();
    const nameMatch  = kycName === inputName || kycName.includes(inputName) || inputName.includes(kycName);
    if (!nameMatch) {
      throw new Error('NAME_MISMATCH');
    }

    // 3. Generate card details locally
    const cardNumber = vccService.generateCardNumber(variant.network);
    const last4      = cardNumber.replace(/\s/g, '').slice(-4);
    const expiry     = vccService.generateExpiry();
    const cvv        = vccService.generateCVV();

    // 4. Insert VCC card
    const payload: Omit<VCCCard, 'id' | 'created_at'> = {
      wallet_address:           addr,
      card_last4:               last4,
      card_holder_name:         holderName.trim(),
      expiry_mm_yy:             expiry,
      card_variant:             variant.id,
      card_network:             variant.network,
      card_status:              'active',
      balance:                  0,
      is_physical:              isPhysical,
      physical_shipping_status: isPhysical ? 'processing' : 'not_requested',
      physical_fee_usd:         isPhysical ? 50 : 0,
      shipping_fee_usd:         shippingFeeUsd,
      kyc_verified:             true,
      name_match:               true,
      compliance_status:        'compliant',
    };

    const { data, error } = await supabase
      .from('vcc_cards')
      .upsert(payload, { onConflict: 'wallet_address' })
      .select()
      .single();
    if (error) throw error;

    // 5. Log issuance fee transaction
    if (variant.annual_fee_usd > 0) {
      await supabase.from('transactions').insert({
        wallet_address: addr,
        card_id:        data.id,
        type:           'fee',
        token:          'USD',
        amount:         variant.annual_fee_usd,
        usd_value:      variant.annual_fee_usd,
        status:         'success',
        description:    'VCC Issuance Fee',
        label:          `${variant.variant_name} Card Annual Fee`,
      });
    }

    return { vccCard: data, cardNumber, cvv };
  },

  async updateBalance(walletAddress: string, balance: number): Promise<void> {
    const { error } = await supabase
      .from('vcc_cards')
      .update({ balance })
      .eq('wallet_address', walletAddress.toLowerCase());
    if (error) throw error;
  },

  async updateStatus(walletAddress: string, status: 'active' | 'frozen' | 'blocked'): Promise<void> {
    const { error } = await supabase
      .from('vcc_cards')
      .update({ card_status: status })
      .eq('wallet_address', walletAddress.toLowerCase());
    if (error) throw error;
  },
};

// ─── Shipping Fees Service ────────────────────────────────────────────────────

export const shippingFeeService = {
  async getAll(): Promise<ShippingFee[]> {
    try {
      const { data, error } = await supabase
        .from('shipping_fees')
        .select('*')
        .order('country_name', { ascending: true });
      if (error || !data || data.length === 0) {
        return Object.entries(SHIPPING_FEES).map(([country_name, fee_usd]) => ({
          country_name, country_code: '', fee_usd,
        }));
      }
      return data;
    } catch {
      return Object.entries(SHIPPING_FEES).map(([country_name, fee_usd]) => ({
        country_name, country_code: '', fee_usd,
      }));
    }
  },
};

// ─── Physical Card Requests ───────────────────────────────────────────────────

export const cardRequestService = {
  async getRequests(walletAddress: string): Promise<CardRequest[]> {
    const { data, error } = await supabase
      .from('card_requests')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async hasPendingRequest(walletAddress: string): Promise<boolean> {
    const { data } = await supabase
      .from('card_requests')
      .select('id')
      .eq('wallet_address', walletAddress.toLowerCase())
      .eq('status', 'pending')
      .maybeSingle();
    return !!data;
  },

  async submitRequest(req: Omit<CardRequest, 'id' | 'created_at' | 'status'>): Promise<CardRequest> {
    const { data, error } = await supabase
      .from('card_requests')
      .insert({ ...req, wallet_address: req.wallet_address.toLowerCase(), status: 'pending' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

// ─── Transaction Service ──────────────────────────────────────────────────────

export const txService = {

  async log(tx: Omit<DBTransaction, 'id' | 'created_at'>): Promise<DBTransaction> {
    const { data, error } = await supabase
      .from('transactions')
      .insert({ ...tx, wallet_address: tx.wallet_address.toLowerCase() })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateStatus(id: string, status: TxStatus, tx_hash?: string): Promise<void> {
    const { error } = await supabase
      .from('transactions')
      .update({ status, ...(tx_hash ? { tx_hash } : {}) })
      .eq('id', id);
    if (error) throw error;
  },

  async getAll(walletAddress: string, limit = 50): Promise<DBTransaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  async getByType(walletAddress: string, type: TxType): Promise<DBTransaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .eq('type', type)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
};
