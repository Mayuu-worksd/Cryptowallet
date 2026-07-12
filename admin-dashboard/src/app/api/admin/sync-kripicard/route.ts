import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const VALID_SECRET = 'cw_change_this_secret_before_deploy_openssl_rand_hex_32';

async function _sync({ secret, card_id, holder_name, wallet_address }: {
  secret: string; card_id: string; holder_name?: string; wallet_address?: string;
}) {
  const validSecret = process.env.ADMIN_SECRET || VALID_SECRET;
  if (secret !== validSecret) {
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

  const { error } = await supabase
    .from('vcc_cards')
    .upsert(row, { onConflict: 'codego_card_id' });

  if (error) {
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
    publicUrl: `https://cryptowallet-dun.vercel.app/card/${last4}`,
  });
}

// GET — open in browser directly
// e.g. /api/admin/sync-kripicard?secret=xxx&card_id=34355&holder_name=LUKE
export async function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams;
  return _sync({
    secret:        p.get('secret') || '',
    card_id:       p.get('card_id') || '',
    holder_name:   p.get('holder_name') || '',
    wallet_address: p.get('wallet_address') || '',
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  return _sync(body);
}
