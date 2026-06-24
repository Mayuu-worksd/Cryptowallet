import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const CODEGO_API_KEY = process.env.CODEGO_API_KEY || 'vcck_sbx_f119144ea2221e4796778de28115c4cad97429da86e66552';
const CODEGO_API_URL = process.env.CODEGO_API_URL || 'https://vcc-sandbox.codegotech.com/api/v1';

// FIX: Correct auth header
const codegoHeaders = {
  'X-Api-Key': CODEGO_API_KEY,
  'Content-Type': 'application/json',
};

// Maps Codego card status to internal vcc_cards card_status
function mapCodegoStatus(s: string): 'pending' | 'active' | 'frozen' | 'blocked' {
  switch (s?.toLowerCase()) {
    case 'active': case 'activated': return 'active';
    case 'locked': case 'frozen': return 'frozen';
    case 'canceled': case 'cancelled': case 'blocked': return 'blocked';
    default: return 'pending';
  }
}

// GET — fetch single card from Codego
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: codegoCardId } = await params;

  const res = await fetch(`${CODEGO_API_URL}/cards/${codegoCardId}`, {
    headers: codegoHeaders,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json({ error: 'Card not found in Codego', details: err }, { status: res.status });
  }

  const cardData = await res.json();
  return NextResponse.json({ cardData });
}

// PATCH — update card status or limit
// FIX: PATCH /cards/{id}/status does NOT exist on Codego sandbox.
// The correct endpoint is PATCH /cards/{id} with { status } in the body.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: codegoCardId } = await params;
  const body = await req.json();
  const { status, limit } = body;

  const updatePayload: any = {};

  if (status) {
    // FIX: Codego accepts 'active', 'locked', 'canceled' — NOT 'frozen'
    const codegoStatusMap: Record<string, string> = {
      active: 'active',
      frozen: 'locked',     // our 'frozen' maps to Codego 'locked'
      blocked: 'canceled',
      cancelled: 'canceled',
    };
    const codegoStatus = codegoStatusMap[status] ?? status;
    if (!['active', 'locked', 'canceled'].includes(codegoStatus)) {
      return NextResponse.json({ error: 'Invalid status. Use: active, frozen, blocked' }, { status: 400 });
    }
    updatePayload.status = codegoStatus;
  }

  if (limit) {
    updatePayload.limit = limit;
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: 'No update parameters provided' }, { status: 400 });
  }

  // FIX: PATCH /cards/{id} — NOT /cards/{id}/status
  const res = await fetch(`${CODEGO_API_URL}/cards/${codegoCardId}`, {
    method: 'PATCH',
    headers: codegoHeaders,
    body: JSON.stringify(updatePayload),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    return NextResponse.json({ error: 'Failed to update Codego card', details: errData }, { status: res.status });
  }

  const cardData = await res.json();

  // FIX: Update vcc_cards (not codego_cards) using codego_card_id column
  const dbUpdate: any = {};
  if (cardData.status) {
    dbUpdate.codego_status = cardData.status;
    dbUpdate.card_status = mapCodegoStatus(cardData.status);
  }
  if (cardData.limit?.amount) dbUpdate.balance = cardData.limit.amount;

  if (Object.keys(dbUpdate).length > 0) {
    const { error: dbError } = await supabase
      .from('vcc_cards')
      .update(dbUpdate)
      .eq('codego_card_id', codegoCardId);

    if (dbError) {
      console.error('[Codego cards/[id]] vcc_cards update failed:', dbError.message);
    }
  }

  return NextResponse.json({ cardData });
}
