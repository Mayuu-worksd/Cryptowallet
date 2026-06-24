import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const CODEGO_API_KEY = process.env.CODEGO_API_KEY || 'vcck_sbx_f119144ea2221e4796778de28115c4cad97429da86e66552';
const CODEGO_API_URL = process.env.CODEGO_API_URL || 'https://vcc-sandbox.codegotech.com/api/v1';

const codegoHeaders = {
  'X-Api-Key': CODEGO_API_KEY,
  'Content-Type': 'application/json',
};

// NOTE: GET /cards/{id}/transactions does NOT exist on the Codego sandbox.
// Confirmed via probe — returns 404 with path in response body.
// In production this endpoint may be available. We fall back to Supabase local transactions.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: codegoCardId } = await params;

  if (!codegoCardId) {
    return NextResponse.json({ error: 'Card ID is required' }, { status: 400 });
  }

  // Attempt Codego first — if it exists in production it will return data
  const codegoRes = await fetch(`${CODEGO_API_URL}/cards/${codegoCardId}/transactions`, {
    headers: codegoHeaders,
  });

  if (codegoRes.ok) {
    const transactions = await codegoRes.json();
    return NextResponse.json({ transactions, source: 'codego' });
  }

  // FIX: Endpoint not available in sandbox — fall back to Supabase transactions
  // Find the vcc_card internal record matching this codego_card_id
  const { data: vccCard } = await supabase
    .from('vcc_cards')
    .select('id, wallet_address')
    .eq('codego_card_id', codegoCardId)
    .maybeSingle();

  if (!vccCard) {
    return NextResponse.json({
      transactions: [],
      source: 'not_found',
      note: 'GET /cards/{id}/transactions is not available in the Codego sandbox environment.',
    });
  }

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('wallet_address', vccCard.wallet_address)
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({
    transactions: transactions || [],
    source: 'supabase_fallback',
    note: 'Codego sandbox does not support /cards/{id}/transactions. Showing local Supabase data.',
  });
}
