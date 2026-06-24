import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const CODEGO_API_KEY = process.env.CODEGO_API_KEY || 'vcck_sbx_f119144ea2221e4796778de28115c4cad97429da86e66552';
const CODEGO_API_URL = process.env.CODEGO_API_URL || 'https://vcc-sandbox.codegotech.com/api/v1';

const codegoHeaders = {
  'X-Api-Key': CODEGO_API_KEY,
  'Content-Type': 'application/json',
};

// NOTE: GET /cards/{id}/statement does NOT exist on the Codego sandbox.
// Confirmed via probe — returns 404 with path in response body.
// Falls back to local Supabase data; in production, try Codego first.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: codegoCardId } = await params;
  if (!codegoCardId) {
    return NextResponse.json({ error: 'Missing Card ID' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  // Attempt Codego first — available in production
  let codegoUrl = `${CODEGO_API_URL}/cards/${codegoCardId}/statement`;
  if (startDate || endDate) {
    const qp = new URLSearchParams();
    if (startDate) qp.append('start_date', startDate);
    if (endDate) qp.append('end_date', endDate);
    codegoUrl += `?${qp.toString()}`;
  }

  const codegoRes = await fetch(codegoUrl, { headers: codegoHeaders });

  if (codegoRes.ok) {
    const data = await codegoRes.json();
    return NextResponse.json({ ...data, source: 'codego' });
  }

  // FIX: Sandbox fallback — return Supabase transactions as statement
  const { data: vccCard } = await supabase
    .from('vcc_cards')
    .select('id, wallet_address, balance, card_holder_name')
    .eq('codego_card_id', codegoCardId)
    .maybeSingle();

  if (!vccCard) {
    return NextResponse.json({
      transactions: [],
      balance: 0,
      source: 'not_found',
      note: 'GET /cards/{id}/statement is not available in sandbox. Not found in Supabase either.',
    });
  }

  let query = supabase
    .from('transactions')
    .select('*')
    .eq('wallet_address', vccCard.wallet_address)
    .order('created_at', { ascending: false });

  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate);

  const { data: transactions } = await query.limit(100);

  return NextResponse.json({
    cardId: codegoCardId,
    holderName: vccCard.card_holder_name,
    balance: vccCard.balance,
    transactions: transactions || [],
    source: 'supabase_fallback',
    note: 'Codego sandbox does not support /cards/{id}/statement. Showing local Supabase data.',
  });
}
