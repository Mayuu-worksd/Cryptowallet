/**
 * merchantService.ts
 * Handles Business KYC, Merchant QR codes, and P2P marketplace
 */

import { supabase, setWallet } from './supabaseClient';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseClient';
import { escrowService } from './escrowService';
import { storageService } from './storageService';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type BusinessKYCStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | null;

export type BusinessKYC = {
  id?: string;
  wallet_address: string;
  business_name: string;
  business_type: string;
  registration_number: string;
  vat_tax_id?: string;
  business_address: string;
  country: string;
  director_name?: string;
  director_nationality?: string;
  document_url?: string;
  director_id_url?: string;
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
  platform_fee?: number;
  fiat_total_after_fee?: number;
  payment_method: string;
  seller_payment_details?: string;  // JSON string: bank/UPI details shown to buyer
  country: string;
  status: 'open' | 'escrow_locked' | 'payment_pending' | 'payment_verification' | 'crypto_released' | 'completed' | 'cancelled' | 'disputed';
  is_merchant?: boolean;
  seller_completion_rate?: number;
  deposit_tx_hash?: string;
  release_tx_hash?: string;
  payment_proof_url?: string;        // buyer uploads payment screenshot
  payment_reference?: string;        // UTR / transaction reference from buyer
  payment_verified_at?: string;
  payment_verified_by?: string;
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

// Admin support wallet â€” messages from this address get the SUPPORT badge in chat
export const ADMIN_SUPPORT_WALLET = 'support@cryptowallet';

export const BUSINESS_TYPES = [
  'E-Commerce', 'Retail', 'Services', 'Technology', 'Finance',
  'Healthcare', 'Education', 'Real Estate', 'Food & Beverage', 'Other',
];

export const FIAT_CURRENCIES = ['USD', 'GBP', 'AED', 'EUR', 'INR', 'SGD', 'CAD', 'AUD', 'JPY', 'MYR', 'NGN', 'BRL'];

export const PAYMENT_METHODS = [
  'Bank Transfer', 'PayPal', 'Wise', 'Cash App', 'Revolut',
  'Zelle', 'Venmo', 'SEPA', 'UPI', 'IMPS', 'PhonePe', 'GPay', 'Other',
];

// Platform fee: 0.5% of fiat_total, charged to seller
export const PLATFORM_FEE_RATE = 0.005;

export function calcPlatformFee(fiatTotal: number): number {
  return parseFloat((fiatTotal * PLATFORM_FEE_RATE).toFixed(2));
}

// Fetch live fiat rate vs USD (uses exchangerate-api free tier)
export async function getLiveRate(fromToken: string, toFiat: string): Promise<number | null> {
  try {
    const cgId: Record<string, string> = {
      ETH: 'ethereum', BTC: 'bitcoin', USDT: 'tether', USDC: 'usd-coin', BNB: 'binancecoin', TRX: 'tron',
    };
    const id = cgId[fromToken];
    if (!id) return null;

    // For INR specifically, use a more reliable source
    const fiatUpper = toFiat.toUpperCase();
    const [cgRes, fxRes] = await Promise.all([
      fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd,inr,gbp,eur,aed,sgd,jpy,aud,cad`),
      fetch(`https://open.er-api.com/v6/latest/USD`),
    ]);
    const cgJson = await cgRes.json();
    const fxJson = await fxRes.json();

    // CoinGecko directly supports INR â€” use it if available
    const directRate = cgJson?.[id]?.[fiatUpper.toLowerCase()];
    if (directRate) return parseFloat(directRate.toFixed(2));

    // Fallback: USD price * FX rate
    const usdPrice: number = cgJson?.[id]?.usd ?? 0;
    const fxRate: number   = fxJson?.rates?.[fiatUpper] ?? 1;
    if (!usdPrice) return null;
    return parseFloat((usdPrice * fxRate).toFixed(2));
  } catch {
    return null;
  }
}

// â”€â”€â”€ Business KYC Service â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const businessKYCService = {

  async getStatus(walletAddress: string): Promise<BusinessKYC | null> {
    // Use atomic RPC â€” sets wallet context + reads in one transaction (same as KYC)
    const { data, error } = await supabase.rpc('get_business_kyc_status', {
      p_wallet: walletAddress.toLowerCase(),
    });
    if (error) throw error;
    return data as BusinessKYC | null;
  },

  async submit(walletAddress: string, form: Omit<BusinessKYC, 'id' | 'wallet_address' | 'status' | 'created_at' | 'updated_at'>): Promise<BusinessKYC> {
    const { data, error } = await supabase.rpc('upsert_business_kyc', {
      p_wallet:               walletAddress.toLowerCase(),
      p_business_name:        form.business_name,
      p_business_type:        form.business_type,
      p_registration_number:  form.registration_number,
      p_vat_tax_id:           form.vat_tax_id ?? '',
      p_business_address:     form.business_address,
      p_country:              form.country,
      p_director_name:        form.director_name ?? '',
      p_director_nationality: form.director_nationality ?? '',
    });
    if (error) {
      if (error.message?.includes('ALREADY_SUBMITTED')) {
        throw new Error(error.message.replace('ERROR: ', '').split('\n')[0]);
      }
      throw error;
    }
    return data as BusinessKYC;
  },

  async uploadDocument(walletAddress: string, fileUri: string): Promise<string> {
    const addr        = walletAddress.toLowerCase().replace('0x', '');
    const storagePath = `business_kyc/${addr}/document_${Date.now()}.jpg`;
    const uploadUrl   = `${SUPABASE_URL}/storage/v1/object/kyc-docs/${storagePath}`;

    // Fetch the file as a blob directly from the URI (works on both iOS and Android)
    const fileResponse = await fetch(fileUri);
    if (!fileResponse.ok) throw new Error('Could not read the selected file.');
    const blob = await fileResponse.blob();

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true',
      },
      body: blob,
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => response.status.toString());
      throw new Error(`Upload failed: ${errText}`);
    }

    const { data } = supabase.storage.from('kyc-docs').getPublicUrl(storagePath);
    return data.publicUrl;
  },

  async finalizeSubmission(walletAddress: string, documentUrl: string): Promise<void> {
    const { error } = await supabase.rpc('finalize_business_kyc', {
      p_wallet:       walletAddress.toLowerCase(),
      p_document_url: documentUrl,
    });
    if (error) throw error;
  },
};

// â”€â”€â”€ Merchant QR Service â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ P2P Service â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const p2pService = {

  async createOrder(
    order: Omit<P2POrder, 'id' | 'status' | 'created_at'>,
    network: string = 'Sepolia'
  ): Promise<P2POrder> {
    if (!network || network.trim() === '') throw new Error('Network must be specified when creating an order');

    const platformFee = calcPlatformFee(order.fiat_total);
    const insertPayload = {
      ...order,
      seller_wallet: order.seller_wallet.toLowerCase(),
      status: 'open',
      network,
      platform_fee: platformFee,
      fiat_total_after_fee: parseFloat((order.fiat_total - platformFee).toFixed(2)),
    };

    // Call set_wallet and insert in the same RPC to avoid connection pool session loss
    await supabase.rpc('set_wallet', { wallet: order.seller_wallet.toLowerCase() });
    const { data, error } = await supabase
      .from('p2p_orders')
      .insert(insertPayload)
      .select()
      .single();
    if (error) throw error;

    // Attempt on-chain escrow deposit only if deployed on EVM networks
    // TRON networks don't use EVM escrow contracts
    let depositTxHash: string | undefined;
    const isEVMNetwork = !['TRON', 'TRON Nile'].includes(network);
    
    if (isEVMNetwork && escrowService.isDeployed(network)) {
      try {
        const privateKey = await storageService.getPrivateKey();
        if (privateKey) {
          const { txHash } = await escrowService.deposit({
            orderId: data.id, token: order.token, amount: order.amount, privateKey, network,
          });
          depositTxHash = txHash;
          await supabase.from('p2p_orders').update({ deposit_tx_hash: txHash }).eq('id', data.id);
        }
      } catch (e: any) {
        await supabase.from('p2p_orders').update({ status: 'cancelled' }).eq('id', data.id);
        throw new Error(`Escrow deposit failed: ${e?.message ?? 'Unknown error'}`);
      }
    }

    await supabase.from('escrow_locks').insert({
      order_id:      data.id,
      seller_wallet: order.seller_wallet.toLowerCase(),
      token:         order.token,
      amount:        order.amount,
      status:        'locked',
    });

    return { ...data, deposit_tx_hash: depositTxHash };
  },

  async getOpenOrders(walletAddress?: string, country?: string, fiatCurrency?: string): Promise<P2POrder[]> {
    // Set wallet context so RLS policy evaluates correctly on pooled connections
    await supabase.rpc('set_wallet', { wallet: walletAddress?.toLowerCase() ?? '' });
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
    // Fetch as seller AND as buyer in one query â€” OR filter covers both
    const { data, error } = await supabase
      .from('p2p_orders')
      .select('*')
      .or(`seller_wallet.eq.${addr},buyer_wallet.eq.${addr}`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  // Returns all active orders where this wallet is the buyer (in_escrow / fiat_sent)
  // Used to recover "lost" buy orders after a refresh on the buyer's device
  async getActiveBuyOrders(walletAddress: string): Promise<P2POrder[]> {
    const addr = walletAddress.toLowerCase();
    const { data, error } = await supabase
      .from('p2p_orders')
      .select('*')
      .eq('buyer_wallet', addr)
      .in('status', ['escrow_locked', 'payment_pending', 'payment_verification', 'crypto_released', 'disputed'])
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getActiveLockedAmount(walletAddress: string, token: string): Promise<number> {
    const addr = walletAddress.toLowerCase();
    const { data } = await supabase
      .from('p2p_orders')
      .select('amount')
      .eq('seller_wallet', addr)
      .eq('token', token)
      .in('status', ['open', 'escrow_locked', 'payment_pending', 'payment_verification', 'crypto_released']);
    return (data ?? []).reduce((sum, o) => sum + (o.amount ?? 0), 0);
  },

  async getPendingSellerOrders(walletAddress: string): Promise<P2POrder[]> {
    const { data, error } = await supabase
      .from('p2p_orders')
      .select('*')
      .eq('seller_wallet', walletAddress.toLowerCase())
      .in('status', ['payment_pending', 'payment_verification', 'crypto_released']);
    if (error) throw error;
    return data ?? [];
  },

  async buyOrder(orderId: string, buyerWallet: string, network: string = 'Sepolia'): Promise<void> {
    if (!network || network.trim() === '') throw new Error('Network must be specified');
    await setWallet(buyerWallet);

    // Buyer does NOT lock their own crypto â€” seller already locked it at listing creation.
    // We only register the buyer on-chain so the contract knows who to release to.
    const isEVMNetwork = !['TRON', 'TRON Nile'].includes(network);
    if (isEVMNetwork && escrowService.isDeployed(network)) {
      try {
        const privateKey = await storageService.getPrivateKey();
        if (privateKey) {
          const state = await escrowService.getEscrowState(orderId, network);
          if (state.status === 'Open') {
            await escrowService.lockBuyer({ orderId, privateKey, network });
          }
        }
      } catch (e: any) {
        console.warn('[p2pService] On-chain lockBuyer skipped:', e?.message);
      }
    }

    await supabase.rpc('set_wallet', { wallet: buyerWallet.toLowerCase() });
    const { error } = await supabase
      .from('p2p_orders')
      .update({ status: 'escrow_locked', buyer_wallet: buyerWallet.toLowerCase() })
      .eq('id', orderId)
      .eq('status', 'open');
    if (error) throw error;
    await supabase.rpc('set_wallet', { wallet: buyerWallet.toLowerCase() });
    await supabase.from('escrow_locks').update({ buyer_wallet: buyerWallet.toLowerCase() }).eq('order_id', orderId);
  },

  // Buyer initiates payment â€” moves order from escrow_locked â†’ payment_pending
  async initiatePayment(orderId: string, buyerWallet: string): Promise<void> {
    await setWallet(buyerWallet);
    const { error } = await supabase
      .from('p2p_orders')
      .update({ status: 'payment_pending' })
      .eq('id', orderId)
      .eq('buyer_wallet', buyerWallet.toLowerCase())
      .eq('status', 'escrow_locked');
    if (error) throw error;
  },

  // Buyer uploads payment proof and marks fiat as sent â†’ payment_verification
  async submitPaymentProof(
    orderId: string,
    buyerWallet: string,
    proofUrl: string,
    reference: string,
    network: string = 'Sepolia'
  ): Promise<void> {
    if (!network || network.trim() === '') throw new Error('Network must be specified');
    await setWallet(buyerWallet);

    const isEVMNetwork = !['TRON', 'TRON Nile'].includes(network);
    if (isEVMNetwork && escrowService.isDeployed(network)) {
      try {
        const privateKey = await storageService.getPrivateKey();
        if (privateKey) {
          const state = await escrowService.getEscrowState(orderId, network);
          if (state.status === 'Locked') {
            await escrowService.markFiatSent({ orderId, privateKey, network });
          }
        }
      } catch (e: any) {
        console.warn('[p2pService] On-chain markFiatSent skipped:', e?.message);
      }
    }

    const { error } = await supabase
      .from('p2p_orders')
      .update({
        status: 'payment_verification',
        payment_proof_url: proofUrl,
        payment_reference: reference,
      })
      .eq('id', orderId)
      .eq('buyer_wallet', buyerWallet.toLowerCase())
      .in('status', ['escrow_locked', 'payment_pending']);
    if (error) throw error;
  },

  // Legacy alias kept for backward compat â€” use submitPaymentProof for new flow
  async markPaymentInitiated(orderId: string, network: string = 'Sepolia'): Promise<void> {
    if (!network || network.trim() === '') throw new Error('Network must be specified');
    const walletAddr = await storageService.getWalletAddress();
    if (walletAddr) await setWallet(walletAddr);
    const { error } = await supabase
      .from('p2p_orders')
      .update({ status: 'payment_pending' })
      .eq('id', orderId)
      .eq('status', 'escrow_locked');
    if (error) throw error;
  },

  // Legacy alias â€” use submitPaymentProof for new flow
  async markFiatSent(orderId: string, network: string = 'Sepolia'): Promise<void> {
    if (!network || network.trim() === '') throw new Error('Network must be specified');
    const walletAddr = await storageService.getWalletAddress();
    if (walletAddr) await setWallet(walletAddr);

    const isEVMNetwork = !['TRON', 'TRON Nile'].includes(network);
    if (isEVMNetwork && escrowService.isDeployed(network)) {
      try {
        const privateKey = await storageService.getPrivateKey();
        if (privateKey) {
          const state = await escrowService.getEscrowState(orderId, network);
          if (state.status === 'Locked') {
            await escrowService.markFiatSent({ orderId, privateKey, network });
          }
        }
      } catch (e: any) {
        console.warn('[p2pService] On-chain markFiatSent skipped:', e?.message);
      }
    }
    const { error } = await supabase
      .from('p2p_orders')
      .update({ status: 'payment_verification' })
      .eq('id', orderId)
      .in('status', ['escrow_locked', 'payment_pending']);
    if (error) throw error;
  },

  async confirmPaymentReceived(orderId: string, network: string = 'Sepolia', sellerWallet?: string): Promise<{ txHash?: string }> {
    if (!network || network.trim() === '') throw new Error('Network must be specified');
    if (sellerWallet) await setWallet(sellerWallet);

    let releaseTxHash: string | undefined;
    const isEVMNetwork = !['TRON', 'TRON Nile'].includes(network);
    
    if (isEVMNetwork && escrowService.isDeployed(network)) {
      try {
        const privateKey = await storageService.getPrivateKey();
        if (privateKey) {
          const state = await escrowService.getEscrowState(orderId, network);
          if (state.status === 'FiatSent') {
            const { txHash } = await escrowService.release({ orderId, privateKey, network });
            releaseTxHash = txHash;
          }
        }
      } catch (e: any) {
        console.warn('[p2pService] On-chain release skipped:', e?.message);
      }
    }
    // Move to crypto_released â€” stable state so buyer device can detect and credit balance
    const { error: releaseError } = await supabase
      .from('p2p_orders')
      .update({
        status: 'crypto_released',
        release_tx_hash: releaseTxHash,
        payment_verified_at: new Date().toISOString(),
        payment_verified_by: sellerWallet?.toLowerCase() ?? 'seller',
      })
      .eq('id', orderId)
      .in('status', ['payment_verification', 'payment_pending']);
    if (releaseError) throw releaseError;
    await supabase.from('escrow_locks').update({ status: 'released' }).eq('order_id', orderId);
    return { txHash: releaseTxHash };
  },

  // Called by buyer device after crediting balance â€” finalises the order
  async acknowledgeReceipt(orderId: string, buyerWallet: string): Promise<void> {
    await setWallet(buyerWallet);
    const { error } = await supabase
      .from('p2p_orders')
      .update({ status: 'completed' })
      .eq('id', orderId)
      .eq('buyer_wallet', buyerWallet.toLowerCase())
      .eq('status', 'crypto_released');
    if (error) throw error;
  },


  async raiseDispute(orderId: string, network: string = 'Sepolia'): Promise<void> {
    if (!network || network.trim() === '') throw new Error('Network must be specified');
    const walletAddr = await storageService.getWalletAddress();
    if (walletAddr) await setWallet(walletAddr);

    const isEVMNetwork = !['TRON', 'TRON Nile'].includes(network);
    if (isEVMNetwork && escrowService.isDeployed(network)) {
      try {
        const privateKey = await storageService.getPrivateKey();
        if (privateKey) {
          const state = await escrowService.getEscrowState(orderId, network);
          if (state.status === 'Locked' || state.status === 'FiatSent') {
            await escrowService.raiseDispute({ orderId, privateKey, network });
          }
        }
      } catch (e: any) {
        console.warn('[p2pService] On-chain raiseDispute skipped:', e?.message);
      }
    }

    const { error } = await supabase
      .from('p2p_orders')
      .update({ status: 'disputed' })
      .eq('id', orderId);
    if (error) throw error;

    try {
      await supabase.from('p2p_chat').insert({
        order_id:      orderId,
        sender_wallet: ADMIN_SUPPORT_WALLET,
        message:       "👋 Hi, I'm from the CryptoWallet support team. I've been assigned to your dispute. Please describe the issue and provide any payment proof. We will resolve this within 24 hours.",
        is_support:    true,
      });
    } catch (_) {}
  },

  async cancelOrder(orderId: string, walletAddress: string, network: string = 'Sepolia'): Promise<void> {
    if (!network || network.trim() === '') throw new Error('Network must be specified');
    await setWallet(walletAddress);

    const isEVMNetwork = !['TRON', 'TRON Nile'].includes(network);
    if (isEVMNetwork && escrowService.isDeployed(network)) {
      try {
        const privateKey = await storageService.getPrivateKey();
        if (privateKey) {
          const state = await escrowService.getEscrowState(orderId, network);
          if (state.status === 'Open') {
            await escrowService.cancel({ orderId, privateKey, network });
          }
        }
      } catch (e: any) {
        console.warn('[p2pService] On-chain cancel skipped:', e?.message);
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
