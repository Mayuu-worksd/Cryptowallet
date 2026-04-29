/**
 * merchantService.ts
 * Handles Business KYC, Merchant QR codes, and P2P marketplace
 */

import { supabase } from './supabaseClient';
import * as FileSystem from 'expo-file-system/legacy';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseClient';
import { escrowService } from './escrowService';
import { storageService } from './storageService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BusinessKYCStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | null;

export type BusinessKYC = {
  id?: string;
  wallet_address: string;
  business_name: string;
  business_type: string;
  registration_number: string;
  business_address: string;
  country: string;
  document_url?: string;
  status: BusinessKYCStatus;
  created_at?: string;
  updated_at?: string;
};

export type MerchantQR = {
  id?: string;
  wallet_address: string;
  token: string;
  amount?: string;
  reference?: string;
  qr_string: string;
  created_at?: string;
};

export type P2POrder = {
  id?: string;
  seller_wallet: string;
  buyer_wallet?: string;
  token: string;
  amount: number;
  fiat_currency: string;
  rate: number;
  fiat_total: number;
  payment_method: string;
  country: string;
  status: 'open' | 'in_escrow' | 'fiat_sent' | 'completed' | 'cancelled' | 'disputed';
  is_merchant?: boolean;
  seller_completion_rate?: number;
  deposit_tx_hash?: string;
  release_tx_hash?: string;
  network?: string;
  created_at?: string;
};

export type EscrowLock = {
  id?: string;
  order_id: string;
  seller_wallet: string;
  buyer_wallet?: string;
  token: string;
  amount: number;
  status: 'locked' | 'released' | 'refunded';
  created_at?: string;
};

export const BUSINESS_TYPES = [
  'E-Commerce', 'Retail', 'Services', 'Technology', 'Finance',
  'Healthcare', 'Education', 'Real Estate', 'Food & Beverage', 'Other',
];

export const FIAT_CURRENCIES = ['USD', 'GBP', 'AED', 'EUR', 'INR', 'SGD'];

export const PAYMENT_METHODS = [
  'Bank Transfer', 'PayPal', 'Wise', 'Cash App', 'Revolut',
  'Zelle', 'Venmo', 'SEPA', 'UPI', 'Other',
];

// ─── Business KYC Service ─────────────────────────────────────────────────────

export const businessKYCService = {

  async getStatus(walletAddress: string): Promise<BusinessKYC | null> {
    const { data, error } = await supabase
      .from('business_kyc')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async submit(walletAddress: string, form: Omit<BusinessKYC, 'id' | 'wallet_address' | 'status' | 'created_at' | 'updated_at'>): Promise<BusinessKYC> {
    const addr = walletAddress.toLowerCase();
    const { data, error } = await supabase
      .from('business_kyc')
      .upsert({
        wallet_address: addr,
        ...form,
        status: 'pending',
        document_url: null,
      }, { onConflict: 'wallet_address' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async uploadDocument(walletAddress: string, fileUri: string): Promise<string> {
    const addr        = walletAddress.toLowerCase().replace('0x', '');
    const storagePath = `business_kyc/${addr}/document_${Date.now()}.jpg`;
    const uploadUrl   = `${SUPABASE_URL}/storage/v1/object/kyc-docs/${storagePath}`;

    const base64 = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
      body: bytes,
    });
    if (!response.ok) throw new Error(`Upload failed (${response.status})`);

    const { data } = supabase.storage.from('kyc-docs').getPublicUrl(storagePath);
    return data.publicUrl;
  },

  async finalizeSubmission(walletAddress: string, documentUrl: string): Promise<void> {
    const { error } = await supabase
      .from('business_kyc')
      .update({ document_url: documentUrl, status: 'under_review' })
      .eq('wallet_address', walletAddress.toLowerCase());
    if (error) throw error;
  },
};

// ─── Merchant QR Service ──────────────────────────────────────────────────────

export const merchantQRService = {

  generateQRString(address: string, token: string, amount?: string, reference?: string): string {
    // EIP-681 format
    let qr = `ethereum:${address}`;
    const params: string[] = [];
    if (token !== 'ETH') params.push(`token=${token}`);
    if (amount && parseFloat(amount) > 0) params.push(`value=${amount}`);
    if (reference) params.push(`label=${encodeURIComponent(reference)}`);
    if (params.length > 0) qr += '?' + params.join('&');
    return qr;
  },

  async save(walletAddress: string, qr: Omit<MerchantQR, 'id' | 'wallet_address' | 'created_at'>): Promise<MerchantQR> {
    const { data, error } = await supabase
      .from('merchant_qr_codes')
      .insert({ ...qr, wallet_address: walletAddress.toLowerCase() })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getAll(walletAddress: string): Promise<MerchantQR[]> {
    const { data, error } = await supabase
      .from('merchant_qr_codes')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('merchant_qr_codes').delete().eq('id', id);
    if (error) throw error;
  },
};

// ─── P2P Service ──────────────────────────────────────────────────────────────

export const p2pService = {

  async createOrder(
    order: Omit<P2POrder, 'id' | 'status' | 'created_at'>,
    network: string = 'Polygon'  // default to Polygon for real users (cheapest gas)
  ): Promise<P2POrder> {
    // 1. Insert order into DB first to get the UUID
    const { data, error } = await supabase
      .from('p2p_orders')
      .insert({ ...order, seller_wallet: order.seller_wallet.toLowerCase(), status: 'open', network })
      .select()
      .single();
    if (error) throw error;

    // 2. Attempt on-chain escrow deposit
    let depositTxHash: string | undefined;
    if (escrowService.isDeployed(network)) {
      try {
        const privateKey = await storageService.getPrivateKey();
        if (privateKey) {
          const { txHash } = await escrowService.deposit({
            orderId:    data.id,
            token:      order.token,
            amount:     order.amount,
            privateKey,
            network,
          });
          depositTxHash = txHash;
          // Update order with tx hash
          await supabase.from('p2p_orders').update({ deposit_tx_hash: txHash }).eq('id', data.id);
        }
      } catch (e: any) {
        // On-chain failed — cancel the DB order and throw
        await supabase.from('p2p_orders').update({ status: 'cancelled' }).eq('id', data.id);
        throw new Error(`On-chain escrow deposit failed: ${e?.message ?? 'Unknown error'}`);
      }
    }

    // 3. Lock escrow record in DB
    await supabase.from('escrow_locks').insert({
      order_id:      data.id,
      seller_wallet: order.seller_wallet.toLowerCase(),
      token:         order.token,
      amount:        order.amount,
      status:        'locked',
    });

    return { ...data, deposit_tx_hash: depositTxHash };
  },

  async getOpenOrders(country?: string, fiatCurrency?: string): Promise<P2POrder[]> {
    let query = supabase
      .from('p2p_orders')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    if (country)       query = query.eq('country', country);
    if (fiatCurrency)  query = query.eq('fiat_currency', fiatCurrency);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  async getMyOrders(walletAddress: string): Promise<P2POrder[]> {
    const addr = walletAddress.toLowerCase();
    const { data, error } = await supabase
      .from('p2p_orders')
      .select('*')
      .or(`seller_wallet.eq.${addr},buyer_wallet.eq.${addr}`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getPendingSellerOrders(walletAddress: string): Promise<P2POrder[]> {
    const { data, error } = await supabase
      .from('p2p_orders')
      .select('*')
      .eq('seller_wallet', walletAddress.toLowerCase())
      .eq('status', 'fiat_sent');
    if (error) throw error;
    return data ?? [];
  },

  async buyOrder(orderId: string, buyerWallet: string, network: string = 'Polygon'): Promise<void> {
    // 1. On-chain: lock buyer into escrow contract
    if (escrowService.isDeployed(network)) {
      try {
        const privateKey = await storageService.getPrivateKey();
        if (privateKey) {
          await escrowService.lockBuyer({ orderId, privateKey, network });
        }
      } catch (e: any) {
        throw new Error(`On-chain lock failed: ${e?.message ?? 'Unknown error'}`);
      }
    }

    // 2. Update DB
    const { error } = await supabase
      .from('p2p_orders')
      .update({ status: 'in_escrow', buyer_wallet: buyerWallet.toLowerCase() })
      .eq('id', orderId)
      .eq('status', 'open');
    if (error) throw error;
    await supabase.from('escrow_locks').update({ buyer_wallet: buyerWallet.toLowerCase() }).eq('order_id', orderId);
  },

  async markFiatSent(orderId: string, network: string = 'Polygon'): Promise<void> {
    // On-chain: mark fiat sent
    if (escrowService.isDeployed(network)) {
      try {
        const privateKey = await storageService.getPrivateKey();
        if (privateKey) {
          await escrowService.markFiatSent({ orderId, privateKey, network });
        }
      } catch (e: any) {
        throw new Error(`On-chain markFiatSent failed: ${e?.message ?? 'Unknown error'}`);
      }
    }

    const { error } = await supabase
      .from('p2p_orders')
      .update({ status: 'fiat_sent' })
      .eq('id', orderId)
      .eq('status', 'in_escrow');
    if (error) throw error;
  },

  async confirmPaymentReceived(orderId: string, network: string = 'Polygon'): Promise<{ txHash?: string }> {
    let releaseTxHash: string | undefined;

    // On-chain: release funds to buyer — THIS is the actual crypto transfer
    if (escrowService.isDeployed(network)) {
      try {
        const privateKey = await storageService.getPrivateKey();
        if (privateKey) {
          const { txHash } = await escrowService.release({ orderId, privateKey, network });
          releaseTxHash = txHash;
        }
      } catch (e: any) {
        throw new Error(`On-chain release failed: ${e?.message ?? 'Unknown error'}`);
      }
    }

    // Update DB
    const { error: orderError } = await supabase
      .from('p2p_orders')
      .update({ status: 'completed', release_tx_hash: releaseTxHash })
      .eq('id', orderId);
    if (orderError) throw orderError;

    await supabase.from('escrow_locks').update({ status: 'released' }).eq('order_id', orderId);
    return { txHash: releaseTxHash };
  },

  async raiseDispute(orderId: string, network: string = 'Polygon'): Promise<void> {
    // On-chain: freeze escrow
    if (escrowService.isDeployed(network)) {
      try {
        const privateKey = await storageService.getPrivateKey();
        if (privateKey) {
          await escrowService.raiseDispute({ orderId, privateKey, network });
        }
      } catch {}
    }

    const { error } = await supabase
      .from('p2p_orders')
      .update({ status: 'disputed' })
      .eq('id', orderId);
    if (error) throw error;
  },

  async cancelOrder(orderId: string, walletAddress: string, network: string = 'Polygon'): Promise<void> {
    // On-chain: refund seller
    if (escrowService.isDeployed(network)) {
      try {
        const privateKey = await storageService.getPrivateKey();
        if (privateKey) {
          await escrowService.cancel({ orderId, privateKey, network });
        }
      } catch (e: any) {
        throw new Error(`On-chain cancel failed: ${e?.message ?? 'Unknown error'}`);
      }
    }

    const { error } = await supabase
      .from('p2p_orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId)
      .eq('seller_wallet', walletAddress.toLowerCase())
      .eq('status', 'open');
    if (error) throw error;
    await supabase.from('escrow_locks').update({ status: 'refunded' }).eq('order_id', orderId);
  },

  async getSellerStats(walletAddress: string): Promise<{ total: number; completed: number; rate: number }> {
    const { data } = await supabase
      .from('p2p_orders')
      .select('status')
      .eq('seller_wallet', walletAddress.toLowerCase());
    const total     = data?.length ?? 0;
    const completed = data?.filter(o => o.status === 'completed').length ?? 0;
    return { total, completed, rate: total > 0 ? Math.round((completed / total) * 100) : 100 };
  },
};
