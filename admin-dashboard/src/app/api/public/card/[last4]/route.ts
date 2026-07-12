/**
 * /api/public/card/[last4]
 * Public — no auth needed. Finds card by last4 digits from vcc_cards.
 * Returns masked card info, balance, and transaction history.
 */
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

  if (!last4 || last4.length !== 4 || !/^\d{4}$/.test(last4)) {
    return NextResponse.json({ error: 'Invalid card last4' }, { status: 400 });
  }

  // Find card in vcc_cards by last4 — must be a real KripiCard (not mock)
  const { data: card, error } = await supabase
    .from('vcc_cards')
    .select('codego_card_id, card_last4, card_holder_name, card_network, card_variant, card_status, balance, expiry_mm_yy, created_at')
    .eq('card_last4', last4)
    .not('codego_card_id', 'is', null)
    .not('codego_card_id', 'like', 'mock_cg_%')
    .maybeSingle();

  if (error || !card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }

  const apiKey = process.env.KRIPICARD_API_KEY!;
  const baseUrl = process.env.KRIPICARD_BASE_URL || 'https://appapi.kripicard.com';

  // Fetch live balance + transactions from KripiCard
  let liveBalance = card.balance ?? 0;
  let transactions: any[] = [];

  try {
    const txRes = await fetch(`${baseUrl}/api/external/cards/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, card_id: card.codego_card_id }),
    });
    const txJson = await txRes.json();
    if (txJson?.success) {
      liveBalance = txJson.data?.balance ?? liveBalance;
      transactions = txJson.data?.transactions ?? [];
    }
  } catch (_) {}

  return NextResponse.json({
    card: {
      last4: card.card_last4,
      maskedNumber: `•••• •••• •••• ${card.card_last4}`,
      holderName: card.card_holder_name,
      network: card.card_network || 'Visa',
      variant: card.card_variant || 'classic',
      status: card.card_status,
      expiry: card.expiry_mm_yy,
      balance: liveBalance,
      createdAt: card.created_at,
    },
    transactions: transactions.map((tx: any, i: number) => ({
      id: tx.id || `tx-${i}`,
      amount: tx.amount ?? 0,
      type: tx.type || 'spend',
      merchant: tx.merchant || tx.description || 'Unknown',
      status: tx.success ? 'approved' : 'declined',
      date: tx.date || tx.created_at || null,
    })),
  });
}
