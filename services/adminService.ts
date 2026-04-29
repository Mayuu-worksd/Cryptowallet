import { supabase } from './supabaseClient';
import type { KYCRecord, CardRequest } from './supabaseService';

export type AdminKYCRow = KYCRecord & { created_at: string; updated_at: string };
export type AdminCardRequest = CardRequest & {
  full_name?: string;
  email?: string;
  tracking_number?: string;
  shipped_at?: string;
  admin_notes?: string;
};

export const adminService = {

  // ── KYC ────────────────────────────────────────────────────────────────────

  async getAllKYC(status?: string): Promise<AdminKYCRow[]> {
    let q = supabase.from('kyc').select('*').order('created_at', { ascending: false });
    if (status && status !== 'all') q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async updateKYCStatus(
    walletAddress: string,
    status: 'verified' | 'rejected',
    notes?: string,
  ): Promise<void> {
    const patch: any = { status };
    if (notes) patch.admin_notes = notes;
    const { error } = await supabase
      .from('kyc')
      .update(patch)
      .eq('wallet_address', walletAddress.toLowerCase());
    if (error) throw error;
  },

  // ── Card Requests ──────────────────────────────────────────────────────────

  async getAllCardRequests(status?: string): Promise<AdminCardRequest[]> {
    let q = supabase.from('card_requests').select('*').order('created_at', { ascending: false });
    if (status && status !== 'all') q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;

    // Enrich with KYC name/email
    const rows = data ?? [];
    const wallets = [...new Set(rows.map(r => r.wallet_address))];
    if (wallets.length === 0) return rows;

    const { data: kycRows } = await supabase
      .from('kyc')
      .select('wallet_address, full_name, email')
      .in('wallet_address', wallets);

    const kycMap: Record<string, { full_name: string; email: string }> = {};
    (kycRows ?? []).forEach(k => { kycMap[k.wallet_address] = k; });

    return rows.map(r => ({
      ...r,
      full_name: kycMap[r.wallet_address]?.full_name ?? '',
      email:     kycMap[r.wallet_address]?.email ?? '',
    }));
  },

  async approveCardRequest(id: string): Promise<void> {
    const { error } = await supabase
      .from('card_requests')
      .update({ status: 'approved' })
      .eq('id', id);
    if (error) throw error;
  },

  async rejectCardRequest(id: string, notes?: string): Promise<void> {
    const patch: any = { status: 'rejected' };
    if (notes) patch.admin_notes = notes;
    const { error } = await supabase
      .from('card_requests')
      .update(patch)
      .eq('id', id);
    if (error) throw error;
  },

  async markShipped(id: string, trackingNumber: string, notes?: string): Promise<void> {
    const patch: any = {
      status:          'shipped',
      tracking_number: trackingNumber,
      shipped_at:      new Date().toISOString(),
    };
    if (notes) patch.admin_notes = notes;
    const { error } = await supabase
      .from('card_requests')
      .update(patch)
      .eq('id', id);
    if (error) throw error;
  },

  // ── Stats ──────────────────────────────────────────────────────────────────

  async getStats(): Promise<{
    kyc: Record<string, number>;
    cards: Record<string, number>;
  }> {
    const [{ data: kycData }, { data: cardData }] = await Promise.all([
      supabase.from('kyc').select('status'),
      supabase.from('card_requests').select('status'),
    ]);

    const count = (arr: any[], val: string) => (arr ?? []).filter(r => r.status === val).length;

    return {
      kyc: {
        total:        (kycData ?? []).length,
        pending:      count(kycData ?? [], 'pending'),
        under_review: count(kycData ?? [], 'under_review'),
        verified:     count(kycData ?? [], 'verified'),
        rejected:     count(kycData ?? [], 'rejected'),
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
