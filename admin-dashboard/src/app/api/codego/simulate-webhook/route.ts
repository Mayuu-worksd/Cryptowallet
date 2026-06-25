import { NextRequest, NextResponse } from 'next/server';

// POST /api/codego/simulate-webhook
// General-purpose webhook event simulator for ALL Codego event types.
// ✅ Makes "Auto webhooks" go GREEN in sandbox — fire any event from admin dashboard.

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

  // ── Build the correct payload for each event type ───────────────────────────
  let webhookPayload: any;

  switch (eventType) {
    case 'transaction.created':
    case 'transaction.updated': {
      const referenceId = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      webhookPayload = {
        type: eventType,
        data: {
          id:           extraData.id || referenceId,
          cardId:       codegoCardId,
          amount:       extraData.amount ?? -25.00,
          currency:     extraData.currency || 'USD',
          merchantName: extraData.merchantName || 'Test Merchant',
          description:  extraData.description || 'Simulated transaction',
          status:       extraData.status || 'approved',
          createdAt:    new Date().toISOString(),
          ...extraData,
        },
      };
      break;
    }

    case 'card.created':
    case 'card.activated':
    case 'card.locked':
    case 'card.frozen':
    case 'card.unlocked':
    case 'card.unfrozen':
    case 'card.canceled':
    case 'card.cancelled':
    case 'card.blocked': {
      webhookPayload = {
        type: eventType,
        data: { cardId: codegoCardId, id: codegoCardId, ...extraData },
      };
      break;
    }

    case 'card.updated': {
      webhookPayload = {
        type: 'card.updated',
        data: {
          cardId:  codegoCardId,
          id:      codegoCardId,
          status:  extraData.status || 'active',
          balance: extraData.balance ?? 250.00,
          ...extraData,
        },
      };
      break;
    }

    case 'transfer.completed': {
      webhookPayload = {
        type: 'transfer.completed',
        data: {
          id:     extraData.transferId || `transfer-${Date.now()}`,
          cardId: codegoCardId,
          amount: extraData.amount || 100,
          ...extraData,
        },
      };
      break;
    }

    case 'transfer.failed': {
      webhookPayload = {
        type: 'transfer.failed',
        data: {
          id:     extraData.transferId || `transfer-${Date.now()}`,
          cardId: codegoCardId,
          ...extraData,
        },
      };
      break;
    }

    default:
      // Pass through custom event types
      webhookPayload = {
        type: eventType,
        data: { cardId: codegoCardId, id: codegoCardId, ...extraData },
      };
  }

  // ── Fire through the real webhook handler ────────────────────────────────────
  const webhookRes = await fetch(
    new URL('/api/webhooks/codego', req.url).toString(),
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
