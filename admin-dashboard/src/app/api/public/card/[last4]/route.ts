import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ last4: string }> }
) {
  const { last4 } = await params;
  const { searchParams } = new URL(req.url);
  // Allow direct card_id override: /api/public/card/0648?card_id=34355
  const cardIdOverride = searchParams.get('card_id');

  const apiKey = process.env.KRIPICARD_API_KEY!;
  const baseUrl = process.env.KRIPICARD_BASE_URL || 'https://appapi.kripicard.com';

  let cardId: string | null = cardIdOverride;

  // Try Supabase first
  if (!cardId) {
    const { data: card } = await supabase
      .from('vcc_cards')
      .select('codego_card_id, card_holder_name, card_network, card_variant, card_status, balance, expiry_mm_yy')
      .eq('card_last4', last4)
      .not('codego_card_id', 'is', null)
      .not('codego_card_id', 'like', 'mock_cg_%')
      .maybeSingle();
    cardId = card?.codego_card_id ?? null;
  }

  if (!cardId) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }

  // Fetch live data from KripiCard
  const [detailRes, txRes] = await Promise.all([
    fetch(`${baseUrl}/api/external/cards/carddetails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, card_id: cardId }),
    }),
    fetch(`${baseUrl}/api/external/cards/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, card_id: cardId }),
    }),
  ]);

  const detailJson = await detailRes.json();
  const txJson = await txRes.json();

  if (!detailJson?.success) {
    return NextResponse.json({ error: 'KripiCard fetch failed', detail: detailJson }, { status: 502 });
  }

  const d = detailJson.data || detailJson;
  const cardLast4 = (d.last_4 || d.last4 || d.card_number?.slice(-4) || last4).toString();

  const transactions = (txJson?.data?.transactions || []).map((tx: any, i: number) => ({
    id: tx.id || `tx-${i}`,
    amount: tx.amount ?? 0,
    type: tx.type || 'spend',
    merchant: tx.merchant || tx.description || 'Unknown',
    status: tx.success ? 'approved' : 'declined',
    date: tx.date || tx.created_at || null,
  }));

  return NextResponse.json({
    card: {
      last4: cardLast4,
      maskedNumber: `•••• •••• •••• ${cardLast4}`,
      holderName: d.name || d.card_holder_name || 'CARD HOLDER',
      network: d.card_type || 'Visa',
      variant: 'classic',
      status: (d.status || 'active').toLowerCase(),
      expiry: d.expiry || '••/••',
      balance: txJson?.data?.balance ?? d.balance ?? 0,
      createdAt: d.created_at || '',
    },
    transactions,
  });
}
