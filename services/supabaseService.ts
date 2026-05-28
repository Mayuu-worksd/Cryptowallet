/**
 * supabaseService.ts — v4
 * wallet_address (lowercase) is the primary link across all tables.
 */

import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY, getKYCSignedUrl, extractStoragePath, setWallet } from './supabaseClient';
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
  card_number_encrypted?: string;
  cvv_encrypted?: string;
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
    const addr = walletAddress.toLowerCase();
    // Use atomic RPC — sets wallet context + reads in one transaction
    // Direct table query fails due to RLS session variable not persisting
    const { data, error } = await supabase.rpc('get_kyc_status', { p_wallet: addr });
    if (error) throw error;
    return data as KYCRecord | null;
  },

  async submitKYC(walletAddress: string, form: KYCFormData): Promise<KYCRecord> {
    const addr = walletAddress.toLowerCase();

    // Use atomic RPC — sets wallet context + upserts in one transaction
    // This avoids RLS failures caused by session variable not persisting
    const { data, error } = await supabase.rpc('upsert_kyc', {
      p_wallet:        addr,
      p_full_name:     form.full_name.trim(),
      p_email:         form.email.trim(),
      p_phone:         form.phone.trim(),
      p_address:       form.address.trim(),
      p_nationality:   form.nationality.trim(),
      p_dob:           form.dob.trim(),
      p_document_type: form.document_type,
    });

    if (error) {
      // RPC raises ALREADY_SUBMITTED:status as an exception
      if (error.message?.includes('ALREADY_SUBMITTED')) {
        throw new Error(error.message.replace('ERROR: ', '').split('\n')[0]);
      }
      throw error;
    }
    return data as KYCRecord;
  },

  async updateDetails(
    walletAddress: string,
    patch: Partial<Pick<KYCFormData, 'full_name' | 'email' | 'phone' | 'address' | 'nationality' | 'dob' | 'document_type'>>,
  ): Promise<void> {
    const addr = walletAddress.toLowerCase();
    await setWallet(addr);
    const { error } = await supabase
      .from('kyc')
      .update(patch)
      .eq('wallet_address', walletAddress.toLowerCase())
      .in('status', ['pending', 'rejected']);
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
        // FIX 4: return storage path (not public URL) — display via signed URL
        return storagePath;
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
    const addr = walletAddress.toLowerCase();

    // Use atomic RPC to avoid RLS session variable issues
    const { error } = await supabase.rpc('finalize_kyc', {
      p_wallet:       addr,
      p_document_url: documentUrl,
      p_selfie_url:   selfieUrl,
    });
    if (error) throw error;

    // Optional extra fields — best-effort after main finalize
    if (extra?.selfieVideoUrl) {
      await setWallet(addr);
      supabase.from('kyc').update({ selfie_video_url: extra.selfieVideoUrl })
        .eq('wallet_address', addr).then(({ error: e }) => {
          if (e) console.warn('selfie_video_url update skipped:', e.message);
        });
    }
    if (extra?.uniqueCode) {
      await setWallet(addr);
      supabase.from('kyc').update({ unique_code: extra.uniqueCode })
        .eq('wallet_address', addr).then(({ error: e }) => {
          if (e) console.warn('unique_code update skipped:', e.message);
        });
    }
  },
};

// ─── Card credential encryption (XOR + wallet address as key) ───────────────
// Simple reversible cipher — card number never stored in plaintext
function xorEncrypt(text: string, key: string): string {
  const k = key.toLowerCase().replace('0x', '');
  return Array.from(text).map((ch, i) => {
    const kByte = parseInt(k[i % k.length] ?? '0', 16);
    return ch.charCodeAt(0) ^ kByte;
  }).map(n => n.toString(16).padStart(2, '0')).join('');
}

function xorDecrypt(hex: string, key: string): string {
  const k = key.toLowerCase().replace('0x', '');
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }
  return bytes.map((b, i) => {
    const kByte = parseInt(k[i % k.length] ?? '0', 16);
    return String.fromCharCode(b ^ kByte);
  }).join('');
}

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

  // Decrypt full card number from Supabase
  decryptNumber(card: DBCard, walletAddress: string): string {
    if (!card.card_number_encrypted) return '';
    try {
      const raw = xorDecrypt(card.card_number_encrypted, walletAddress);
      const digits = raw.replace(/\s/g, '').replace(/\D/g, '');
      if (digits.length !== 16) return '';
      return `${digits.slice(0,4)} ${digits.slice(4,8)} ${digits.slice(8,12)} ${digits.slice(12,16)}`;
    } catch { return ''; }
  },

  // Decrypt CVV from Supabase
  decryptCvv(card: DBCard, walletAddress: string): string {
    if (!card.cvv_encrypted) return '';
    try {
      const raw = xorDecrypt(card.cvv_encrypted, walletAddress);
      return /^\d{3}$/.test(raw) ? raw : '';
    } catch { return ''; }
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

  async saveCredentials(walletAddress: string, cardNumber: string, cvv: string): Promise<void> {
    const addr = walletAddress.toLowerCase();
    const encNumber = xorEncrypt(cardNumber.replace(/\s/g, ''), addr);
    const encCvv    = xorEncrypt(cvv, addr);
    const { error } = await supabase
      .from('cards')
      .update({ card_number_encrypted: encNumber, cvv_encrypted: encCvv })
      .eq('wallet_address', addr);
    if (error) console.warn('[dbCardService] saveCredentials:', error.message);
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

  // Legacy — kept for backward compat
  async saveEncryptedNumber(walletAddress: string, encryptedNumber: string): Promise<void> {
    const { error } = await supabase
      .from('cards')
      .update({ card_number_encrypted: encryptedNumber })
      .eq('wallet_address', walletAddress.toLowerCase());
    if (error) console.warn('[dbCardService] saveEncryptedNumber:', error.message);
  },
};

// ─── Card Variants (VCC) ──────────────────────────────────────────────────────

export const FALLBACK_VARIANTS: VCCCardVariant[] = [
  { 
    id: 'classic', name: 'Classic', variant_name: 'Classic Edition', network: 'Visa', 
    features: ['Virtual & physical payments', 'Basic rewards', 'Standard support'], 
    price: 0, annual_fee_usd: 0, activation_fee_usd: 0, transaction_limit_usd: 5000, design_url: '', 
    color_hex: '#2B2B30', card_color_hex: '#2B2B30', is_active: true,
    is_physical: true, is_virtual: true, 
    gradient_colors: ['#2B2B30', '#18181A', '#0D0D0E'],
    currency_support: ['BTC', 'ETH', 'USDT', 'USDC'], fee_rate: 1.50
  },
  { 
    id: 'gold', name: 'Gold', variant_name: 'Gold Centurion', network: 'Visa', 
    features: ['2% retail cashback', 'Priority support', 'Travel insurance'], 
    price: 49.99, annual_fee_usd: 49.99, activation_fee_usd: 19.99, transaction_limit_usd: 20000, design_url: '', 
    color_hex: '#E5A93C', card_color_hex: '#E5A93C', is_active: true,
    is_physical: true, is_virtual: true, 
    gradient_colors: ['#E5A93C', '#996515', '#4A3B18'],
    currency_support: ['BTC', 'ETH', 'USDT', 'USDC', 'BNB'], fee_rate: 1.00
  },
  { 
    id: 'platinum', name: 'Platinum', variant_name: 'Platinum Stellar', network: 'Mastercard', 
    features: ['5% retail cashback', 'Concierge service', 'Airport lounge access', 'No FX fees'], 
    price: 99.99, annual_fee_usd: 99.99, activation_fee_usd: 39.99, transaction_limit_usd: 50000, design_url: '', 
    color_hex: '#E5E7EB', card_color_hex: '#E5E7EB', is_active: true,
    is_physical: true, is_virtual: true, 
    gradient_colors: ['#E5E7EB', '#9CA3AF', '#374151'],
    currency_support: ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'XRP'], fee_rate: 0.50
  },
  { 
    id: 'travel', name: 'Travel', variant_name: 'Travel Expedition', network: 'Mastercard', 
    features: ['No FX fees', 'Travel insurance', 'Lounge key access', '3% travel cashback'], 
    price: 79.99, annual_fee_usd: 79.99, activation_fee_usd: 29.99, transaction_limit_usd: 30000, design_url: '', 
    color_hex: '#1E3A8A', card_color_hex: '#1E3A8A', is_active: true,
    is_physical: true, is_virtual: true, 
    gradient_colors: ['#1E3A8A', '#0F172A', '#050515'],
    currency_support: ['BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'ADA'], fee_rate: 0.80
  },
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

  // FIX 2: Card number is cryptographically random — NOT derived from wallet address
  generateCardNumber(network: 'Visa' | 'Mastercard'): string {
    const prefix = network === 'Visa' ? '4' : '5';
    const digits: number[] = [parseInt(prefix)];
    // Fill 14 random digits
    const arr = new Uint8Array(14);
    crypto.getRandomValues(arr);
    arr.forEach(b => digits.push(b % 10));
    // Luhn checksum for digit 16
    let sum = 0;
    for (let i = 0; i < 15; i++) {
      let d = digits[i];
      if ((15 - i) % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
    }
    digits.push((10 - (sum % 10)) % 10);
    return digits.join('').replace(/(.{4})/g, '$1 ').trim();
  },

  generateExpiry(): string {
    const now = new Date();
    const mm  = String(now.getMonth() + 1).padStart(2, '0');
    const yy  = String(now.getFullYear() + 3).slice(-2);
    return `${mm}/${yy}`;
  },

  // FIX 2: CVV is random — NOT derived from wallet address
  generateCVV(): string {
    const arr = new Uint8Array(1);
    crypto.getRandomValues(arr);
    return String(100 + (arr[0] % 900));
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

// ─── Wallet Profile Service ─────────────────────────────────────────────────

export type WalletProfile = {
  wallet_address:  string;
  wallet_name:     string;
  account_type:    'personal' | 'business';
  p2p_country:     string;
  p2p_currency:    string;
  tron_address?:   string | null;
  network?:        string | null;
  is_dark_mode?:   boolean | null;
  token_balances?: Record<string, number> | null;
  locked_balances?: Record<string, number> | null;
};

export const profileService = {

  async get(walletAddress: string): Promise<WalletProfile | null> {
    const { data, error } = await supabase.rpc('get_wallet_profile', {
      p_wallet: walletAddress.toLowerCase(),
    });
    if (error) throw error;
    return data as WalletProfile | null;
  },

  async upsert(
    walletAddress: string,
    patch: Partial<Omit<WalletProfile, 'wallet_address'>>
  ): Promise<void> {
    const { error } = await supabase.rpc('upsert_wallet_profile', {
      p_wallet:          walletAddress.toLowerCase(),
      p_name:            patch.wallet_name     ?? null,
      p_account_type:    patch.account_type    ?? null,
      p_p2p_country:     patch.p2p_country     ?? null,
      p_p2p_currency:    patch.p2p_currency    ?? null,
      p_tron_address:    patch.tron_address    ?? null,
      p_network:         patch.network         ?? null,
      p_is_dark_mode:    patch.is_dark_mode    ?? null,
      p_token_balances:  patch.token_balances  ? JSON.stringify(patch.token_balances)  : null,
      p_locked_balances: patch.locked_balances ? JSON.stringify(patch.locked_balances) : null,
    });
    if (error) throw error;
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

// ─── Fiat Currency Service ────────────────────────────────────────────────────

export interface FiatCurrency {
  code: string;
  symbol: string;
  name: string;
  rate: number;
  locale?: string;
  format?: string;
}

export const fiatCurrencyService = {
  async getAll(): Promise<FiatCurrency[]> {
    try {
      const { data, error } = await supabase
        .from('fiat_currencies')
        .select('*')
        .order('code', { ascending: true });
      if (error || !data || data.length === 0) return [];
      return data as FiatCurrency[];
    } catch {
      return [];
    }
  }
};
