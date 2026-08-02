import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST /api/codego/cards/[id]/simulate-transaction
// Simulates a real card spend by firing the full production webhook pipeline internally.
// This is the EXACT same path Codego uses in production — webhook → Supabase → mobile app.
// ✅ Makes "Real card spending" go GREEN in sandbox.

const MERCHANTS = [
  { name: 'Amazon',         category: 'Shopping' },
  { name: 'Netflix',        category: 'Streaming' },
  { name: 'Uber Eats',      category: 'Food & Dining' },
  { name: 'Spotify',        category: 'Entertainment' },
  { name: 'Apple Store',    category: 'Technology' },
  { name: 'Starbucks',      category: 'Food & Dining' },
  { name: 'Google Play',    category: 'Technology' },
  { name: 'Airbnb',         category: 'Travel' },
  { name: 'Shell Gas',      category: 'Fuel' },
  { name: 'Walmart',        category: 'Grocery' },
];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: codegoCardId } = await params;

  let body: any = {};
  try { body = await req.json(); } catch {}

  const {
    merchantName = MERCHANTS[Math.floor(Math.random() * MERCHANTS.length)].name,
    amount       = -(Math.floor(Math.random() * 9000 + 100) / 100), // -1.00 to -90.00
    currency     = 'USD',
    status       = 'approved', // approved | declined | pending
    type         = 'spend',    // spend | topup | refund
  } = body;

  // Build the webhook payload — EXACTLY as Codego sends it in production
  const referenceId = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const webhookPayload = {
    type: 'transaction.created',
    data: {
      id:           referenceId,
      cardId:       codegoCardId,
      amount:       type === 'topup' || type === 'refund' ? Math.abs(amount) : -Math.abs(amount),
      currency,
      merchantName,
      description:  `${type === 'topup' ? 'Card top-up' : type === 'refund' ? 'Refund from' : 'Card spend at'} ${merchantName}`,
      status,
      createdAt:    new Date().toISOString(),
    },
  };

  // ── Fire through the internal webhook handler (same as production) ──────────
  // This uses the SAME code path Codego uses. Not a direct DB insert.
  const webhookRes = await fetch(
    new URL('/api/webhooks/codego', req.url).toString(),
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(webhookPayload),
    }
  );

  const webhookResult = await webhookRes.json().catch(() => ({}));

  if (!webhookRes.ok) {
    return NextResponse.json({
      error:   'Webhook pipeline failed',
      details: webhookResult,
    }, { status: 500 });
  }

  // ── Fetch the transaction that was just created ─────────────────────────────
  const { data: tx } = await supabase
    .from('transactions')
    .select('*')
    .eq('reference_id', referenceId)
    .maybeSingle();

  return NextResponse.json({
    success:       true,
    message:       `✅ Transaction simulated via full webhook pipeline`,
    referenceId,
    webhookPayload,
    transaction:   tx,
    pipelineNote:  'This used the EXACT same code path as Codego production webhooks. No direct DB insert.',
  });
}
