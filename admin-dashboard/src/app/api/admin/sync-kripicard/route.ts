/**
 * POST /api/admin/sync-kripicard
 * Manually upserts a KripiCard card into vcc_cards so the public page works.
 * Body: { secret, card_id, wallet_address, holder_name }
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { secret, card_id, wallet_address, holder_name } = body;

  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!card_id || !wallet_address) {
    return NextResponse.json({ error: 'card_id and wallet_address required' }, { status: 400 });
  }

  const apiKey = process.env.KRIPICARD_API_KEY!;
  const baseUrl = process.env.KRIPICARD_BASE_URL || 'https://appapi.kripicard.com';

  // Fetch live card details from KripiCard
  const detailRes = await fetch(`${baseUrl}/api/external/cards/carddetails`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, card_id }),
  });
  const detail = await detailRes.json();

  if (!detail?.success) {
    return NextResponse.json({ error: 'KripiCard fetch failed', detail }, { status: 502 });
  }

  const d = detail.data || detail;
  const last4 = (d.last_4 || d.last4 || d.card_number?.slice(-4) || '0000').toString();
  const expiry = d.expiry || '12/28';
  const status = (d.status || 'active').toLowerCase();
  const network = d.card_type || 'Visa';

  const row = {
    wallet_address:   wallet_address.toLowerCase(),
    codego_card_id:   String(card_id),
    codego_status:    status,
    card_last4:       last4,
    expiry_mm_yy:     expiry,
    card_holder_name: (holder_name || d.name || 'CARD HOLDER').toUpperCase(),
    card_status:      status,
    card_network:     network,
    card_variant:     'classic',
    balance:          d.balance ?? 0,
    is_physical:      false,
    provider_name:    'kripicard',
    kyc_verified:     true,
    compliance_status: 'compliant',
    physical_shipping_status: 'not_requested',
    provider_response: d,
  };

  const { error } = await supabase
    .from('vcc_cards')
    .upsert(row, { onConflict: 'wallet_address' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, last4, expiry, status, publicUrl: `/card-${last4}` });
}
