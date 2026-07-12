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
  // x-card-id header (Postman) or ?card_id query param — both hidden from browser page
  const internalCardId = req.headers.get('x-card-id') || searchParams.get('card_id');

  const apiKey = process.env.KRIPICARD_API_KEY!;
  const baseUrl = process.env.KRIPICARD_BASE_URL || 'https://appapi.kripicard.com';

  let cardId: string | null = internalCardId;

  // Resolve via Supabase by last4 if no direct card_id provided
  if (!cardId) {
    const { data: card } = await supabase
      .from('vcc_cards')
      .select('codego_card_id')
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

  const txList = txJson?.data?.transactions || txJson?.transactions || txJson?.data || [];
  const transactions = (Array.isArray(txList) ? txList : []).map((tx: any, i: number) => ({
    id: tx.id || `tx-${i}`,
    amount: tx.amount ?? tx.transaction_amount ?? 0,
    type: tx.type === 'credit' ? 'topup' : 'spend',
    merchant: tx.merchant || tx.merchant_name || tx.description || tx.narration || 'Unknown',
    status: tx.success || tx.status === 'approved' || tx.status === 'success' ? 'approved' : 'declined',
    date: tx.date || tx.created_at || tx.transaction_date || null,
  }));

  // Try all possible balance paths from KripiCard API
  const balance =
    txJson?.data?.balance ??
    txJson?.balance ??
    d.balance ??
    d.available_balance ??
    d.current_balance ??
    0;

  return NextResponse.json({
    card: {
      last4: cardLast4,
      maskedNumber: `•••• •••• •••• ${cardLast4}`,
      holderName: d.name || d.card_holder_name || d.holder_name || 'CARD HOLDER',
      network: d.card_type || d.network || 'Visa',
      variant: d.card_variant || 'classic',
      status: (d.status || 'active').toLowerCase(),
      expiry: d.expiry || d.expiry_date || '••/••',
      balance,
      createdAt: d.created_at || '',
    },
    transactions,
  });
}
