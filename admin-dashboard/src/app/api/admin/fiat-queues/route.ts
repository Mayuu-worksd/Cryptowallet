import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // 1. Fetch Fiat Requests
    const { data: legacyRequests, error: legacyErr } = await supabase
      .from('fiat_crypto_requests')
      .select(`
        *,
        profile:wallet_address(wallet_name)
      `)
      .order('created_at', { ascending: false });

    if (legacyErr) {
      console.error('Legacy fetch error:', legacyErr);
      throw legacyErr;
    }

    // Normalize
    const normalizedLegacy = (legacyRequests || []).map((r: any) => ({
      id: r.id,
      ticket_id: r.ticket_id || `REQ-${r.id.substring(0, 8).toUpperCase()}`,
      user_uid: r.wallet_address,
      wallet_name: r.profile?.[0]?.wallet_name || r.wallet_address,
      type: r.type,
      amount: r.amount,
      fiat_currency: r.fiat_currency,
      crypto_asset: r.crypto_asset || 'N/A',
      status: r.status,
      created_at: r.created_at,
      payment_proof_url: r.payment_proof_url,
      admin_notes: r.admin_notes,
      crypto_amount: r.crypto_amount,
      source: 'legacy'
    }));

    return NextResponse.json({ requests: normalizedLegacy });
  } catch (error: any) {
    console.error('Error fetching fiat queues:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

