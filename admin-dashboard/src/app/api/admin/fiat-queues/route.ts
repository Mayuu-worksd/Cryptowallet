import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Fetch all three fiat request sources in parallel
    const [legacyRes, depositsRes, withdrawalsRes] = await Promise.all([
      supabase
        .from('fiat_crypto_requests')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('fiat_deposits')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('fiat_withdrawals')
        .select('*')
        .order('created_at', { ascending: false }),
    ]);

    const legacy = (legacyRes.data || []).map((r: any) => ({
      id: r.id,
      ticket_id: r.ticket_id || `REQ-${r.id.substring(0, 8).toUpperCase()}`,
      user_uid: r.wallet_address,
      wallet_name: r.wallet_address,
      type: r.type,
      amount: r.amount,
      fiat_currency: r.fiat_currency,
      crypto_asset: r.crypto_asset || 'N/A',
      status: r.status,
      created_at: r.created_at,
      payment_proof_url: r.payment_proof_url,
      admin_notes: r.admin_notes,
      crypto_amount: r.crypto_amount,
      source: 'legacy',
    }));

    const deposits = (depositsRes.data || []).map((r: any) => ({
      id: r.id,
      ticket_id: r.reference_code || `DEP-${r.id.substring(0, 8).toUpperCase()}`,
      user_uid: r.user_id,
      wallet_name: r.user_id,
      type: 'deposit',
      amount: r.amount,
      fiat_currency: r.currency,
      crypto_asset: 'N/A',
      status: r.status,
      created_at: r.created_at,
      codego_card_id: r.codego_card_id,
      reference_code: r.reference_code,
      source: 'codego',
    }));

    const withdrawals = (withdrawalsRes.data || []).map((r: any) => ({
      id: r.id,
      ticket_id: `WDR-${r.id.substring(0, 8).toUpperCase()}`,
      user_uid: r.user_id,
      wallet_name: r.user_id,
      type: 'withdrawal',
      amount: r.amount,
      fiat_currency: r.currency,
      crypto_asset: 'N/A',
      status: r.status,
      created_at: r.created_at,
      destination_iban: r.destination_iban,
      destination_name: r.destination_name,
      codego_withdrawal_id: r.codego_withdrawal_id,
      source: 'codego',
    }));

    const requests = [...legacy, ...deposits, ...withdrawals].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json({ requests });
  } catch (error: any) {
    console.error('Error fetching fiat queues:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
