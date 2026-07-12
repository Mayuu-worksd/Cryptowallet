/**
 * POST /api/admin/sync-kripicard
 * Syncs any KripiCard (even dashboard-created ones) into vcc_cards for the public page.
 * Body: { secret, card_id, holder_name? }
 * wallet_address is optional — uses "kripicard_<card_id>" as synthetic key if not provided.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { secret, card_id, wallet_address, holder_name } = body;

  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!card_id) {
    return NextResponse.json({ error: 'card_id required' }, { status: 400 });
  }

  const apiKey = process.env.KRIPICARD_API_KEY!;
  const baseUrl = process.env.KRIPICARD_BASE_URL || 'https://appapi.kripicard.com';

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
  // Use provided wallet_address or synthetic key so vcc_cards row is unique
  const walletKey = (wallet_address || `kripicard_${card_id}`).toLowerCase();

  const row = {
    wallet_address:           walletKey,
    codego_card_id:           String(card_id),
    codego_status:            status,
    card_last4:               last4,
    expiry_mm_yy:             expiry,
    card_holder_name:         (holder_name || d.name || 'CARD HOLDER').toUpperCase(),
    card_status:              status,
    card_network:             network,
    card_variant:             'classic',
    balance:                  d.balance ?? 0,
    is_physical:              false,
    provider_name:            'kripicard',
    kyc_verified:             true,
    compliance_status:        'compliant',
    physical_shipping_status: 'not_requested',
    provider_response:        d,
  };

  // upsert by codego_card_id so re-running is safe
  const { error } = await supabase
    .from('vcc_cards')
    .upsert(row, { onConflict: 'codego_card_id' });

  if (error) {
    // fallback: try wallet_address conflict
    const { error: e2 } = await supabase
      .from('vcc_cards')
      .upsert(row, { onConflict: 'wallet_address' });
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    last4,
    expiry,
    status,
    balance: d.balance ?? 0,
    publicUrl: `https://cryptowallet-dun.vercel.app/card-${last4}`,
  });
}
