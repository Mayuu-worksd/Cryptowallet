import { supabase } from './supabaseClient';
import type { KYCRecord, CardRequest } from './supabaseService';
import { p2pService, P2POrder } from './merchantService';

export type AdminKYCRow = KYCRecord & {
  created_at: string; updated_at: string;
  admin_notes?: string; selfie_url?: string; selfie_video_url?: string;
};

export type AdminBusinessKYCRow = {
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
  status: string;
  admin_notes?: string;
  created_at: string;
  updated_at?: string;
};

export type AdminCardRequest = CardRequest & {
  full_name?: string;
  email?: string;
  tracking_number?: string;
  shipped_at?: string;
  admin_notes?: string;
};

export const adminService = {

  // ── Personal KYC ──────────────────────────────────────────────────────────

  async getAllKYC(status?: string): Promise<AdminKYCRow[]> {
    const { data, error } = await supabase.rpc('admin_get_all_kyc', {
      p_status: (status && status !== 'all') ? status : null,
    });
    if (error) throw error;
    return (data ?? []) as AdminKYCRow[];
  },

  async updateKYCStatus(walletAddress: string, status: 'verified' | 'rejected', notes?: string): Promise<void> {
    const { error } = await supabase.rpc('admin_update_kyc', {
      p_wallet: walletAddress.toLowerCase(),
      p_status: status,
      p_notes:  notes ?? null,
    });
    if (error) throw error;
  },

  // ── Business KYC ──────────────────────────────────────────────────────────

  async getAllBusinessKYC(status?: string): Promise<AdminBusinessKYCRow[]> {
    const { data, error } = await supabase.rpc('admin_get_business_kyc', {
      p_status: (status && status !== 'all') ? status : null,
    });
    if (error) throw error;
    return (data ?? []) as AdminBusinessKYCRow[];
  },

  async updateBusinessKYCStatus(walletAddress: string, status: 'approved' | 'rejected' | 'under_review' | 'pending', notes?: string): Promise<void> {
    const { error } = await supabase.rpc('admin_update_business_kyc', {
      p_wallet: walletAddress.toLowerCase(),
      p_status: status,
      p_notes:  notes ?? null,
    });
    if (error) throw error;
  },

  // ── Card Requests ──────────────────────────────────────────────────────────

  async getAllCardRequests(status?: string): Promise<AdminCardRequest[]> {
    let q = supabase.from('card_requests').select('*').order('created_at', { ascending: false });
    if (status && status !== 'all') q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;

    const rows = data ?? [];
    const wallets = [...new Set(rows.map(r => r.wallet_address))];
    if (wallets.length === 0) return rows;

    const { data: kycRows } = await supabase
      .from('kyc').select('wallet_address, full_name, email').in('wallet_address', wallets);

    const kycMap: Record<string, { full_name: string; email: string }> = {};
    (kycRows ?? []).forEach(k => { kycMap[k.wallet_address] = k; });

    return rows.map(r => ({
      ...r,
      full_name: kycMap[r.wallet_address]?.full_name ?? '',
      email:     kycMap[r.wallet_address]?.email ?? '',
    }));
  },

  async approveCardRequest(id: string): Promise<void> {
    const { error } = await supabase.from('card_requests').update({ status: 'approved' }).eq('id', id);
    if (error) throw error;
  },

  async rejectCardRequest(id: string, notes?: string): Promise<void> {
    const patch: any = { status: 'rejected' };
    if (notes) patch.admin_notes = notes;
    const { error } = await supabase.from('card_requests').update(patch).eq('id', id);
    if (error) throw error;
  },

  async markShipped(id: string, trackingNumber: string, notes?: string): Promise<void> {
    const patch: any = { status: 'shipped', tracking_number: trackingNumber, shipped_at: new Date().toISOString() };
    if (notes) patch.admin_notes = notes;
    const { error } = await supabase.from('card_requests').update(patch).eq('id', id);
    if (error) throw error;
  },

  // ── P2P Orders ─────────────────────────────────────────────────────────────

  async getAllP2POrders(status?: string): Promise<P2POrder[]> {
    return p2pService.getAllOrders(status);
  },

  async verifyPaymentAndRelease(orderId: string, note?: string): Promise<void> {
    return p2pService.adminVerifyAndRelease(orderId, note);
  },

  async resolveDisputeRelease(orderId: string): Promise<void> {
    return p2pService.adminVerifyAndRelease(orderId, 'Dispute resolved in buyer\'s favour');
  },

  async resolveDisputeRefund(orderId: string): Promise<void> {
    return p2pService.adminRefundSeller(orderId);
  },

  // ── Stats ──────────────────────────────────────────────────────────────────

  async getStats(): Promise<{ kyc: Record<string, number>; businessKyc: Record<string, number>; cards: Record<string, number> }> {
    const [{ data: kycStats }, { data: cardData }, { data: bizData }] = await Promise.all([
      supabase.rpc('admin_get_kyc_stats'),
      supabase.from('card_requests').select('status'),
      supabase.rpc('admin_get_business_kyc', { p_status: null }),
    ]);

    const count = (arr: any[], val: string) => (arr ?? []).filter(r => r.status === val).length;

    return {
      kyc: {
        total:        kycStats?.total        ?? 0,
        pending:      kycStats?.pending      ?? 0,
        under_review: kycStats?.under_review ?? 0,
        verified:     kycStats?.verified     ?? 0,
        rejected:     kycStats?.rejected     ?? 0,
      },
      businessKyc: {
        total:        (bizData ?? []).length,
        pending:      count(bizData ?? [], 'pending'),
        under_review: count(bizData ?? [], 'under_review'),
        approved:     count(bizData ?? [], 'approved'),
        rejected:     count(bizData ?? [], 'rejected'),
      },
      cards: {
        total:    (cardData ?? []).length,
        pending:  count(cardData ?? [], 'pending'),
        approved: count(cardData ?? [], 'approved'),
        rejected: count(cardData ?? [], 'rejected'),
      },
    };
  },
};
