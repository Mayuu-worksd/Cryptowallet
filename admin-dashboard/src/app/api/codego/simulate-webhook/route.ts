/**
 * /api/codego/simulate-webhook/route.ts
 *
 * URL and response shape IDENTICAL to before.
 * Delegates to CodegoProvider.simulateWebhook().
 *
 * Backward compatibility: ✅ 100%
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCardProvider } from '@/lib/providers';

export async function POST(req: NextRequest) {
  let body: any = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { eventType, codegoCardId, data: extraData = {} } = body;

  if (!eventType) {
    return NextResponse.json({ error: 'eventType is required' }, { status: 400 });
  }

  if (!codegoCardId) {
    return NextResponse.json({ error: 'codegoCardId is required' }, { status: 400 });
  }

  const provider = getCardProvider();
  
  // Provider constructs the correct payload shape for this provider
  const simResult: any = await provider.simulateWebhook({
    eventType,
    providerCardId: codegoCardId,
    extraData
  });
  
  const webhookPayload = simResult.webhookPayload;

  // ── Fire through the real webhook handler ────────────────────────────────────
  const webhookRes = await fetch(
    new URL('/api/webhooks/card-provider', req.url).toString(),
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(webhookPayload),
    }
  );

  const result = await webhookRes.json().catch(() => ({}));

  return NextResponse.json({
    success:        webhookRes.ok,
    eventType,
    codegoCardId,
    webhookPayload,
    webhookResult:  result,
    webhookStatus:  webhookRes.status,
    note: webhookRes.ok
      ? '✅ Event fired through real webhook pipeline — same as Codego production'
      : '❌ Webhook pipeline returned an error',
  }, { status: webhookRes.ok ? 200 : 500 });
}

// GET — list all supported event types (useful for admin UI dropdowns)
export async function GET() {
  return NextResponse.json({
    supportedEvents: [
      { event: 'transaction.created',  description: 'Simulate a card spend / top-up',         category: 'Transactions' },
      { event: 'transaction.updated',  description: 'Update an existing transaction status',   category: 'Transactions' },
      { event: 'card.created',         description: 'Mark card as created on Codego',          category: 'Card Lifecycle' },
      { event: 'card.activated',       description: 'Activate the card',                       category: 'Card Lifecycle' },
      { event: 'card.locked',          description: 'Freeze the card (Codego: locked)',         category: 'Card Lifecycle' },
      { event: 'card.unlocked',        description: 'Unfreeze the card',                       category: 'Card Lifecycle' },
      { event: 'card.updated',         description: 'Update card balance or status',           category: 'Card Lifecycle' },
      { event: 'card.canceled',        description: 'Cancel / block the card permanently',     category: 'Card Lifecycle' },
      { event: 'transfer.completed',   description: 'Fiat transfer completed successfully',    category: 'Transfers' },
      { event: 'transfer.failed',      description: 'Fiat transfer failed',                    category: 'Transfers' },
    ],
  });
}
