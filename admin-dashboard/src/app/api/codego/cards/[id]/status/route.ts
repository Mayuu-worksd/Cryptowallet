import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const CODEGO_API_KEY = process.env.CODEGO_API_KEY || 'vcck_sbx_f119144ea2221e4796778de28115c4cad97429da86e66552';
const CODEGO_API_URL = process.env.CODEGO_API_URL || 'https://vcc-sandbox.codegotech.com/api/v1';

// FIX: Correct auth header
const codegoHeaders = {
  'X-Api-Key': CODEGO_API_KEY,
  'Content-Type': 'application/json',
};

// FIX: PATCH /cards/{id}/status does NOT exist on Codego.
// Correct endpoint: PATCH /cards/{id} with { status } in body.
// Also fix: Codego accepts 'active'|'locked'|'canceled' — our app uses 'frozen' which maps to 'locked'.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = await req.json();
  const { status } = body;
  const { id: codegoCardId } = await params;

  if (!status || !codegoCardId) {
    return NextResponse.json({ error: 'status and id are required' }, { status: 400 });
  }

  // Map our internal status to Codego status values
  const codegoStatusMap: Record<string, string> = {
    active: 'active',
    frozen: 'locked',     // FIX: our 'frozen' → Codego 'locked'
    blocked: 'canceled',
    locked: 'locked',
    canceled: 'canceled',
  };

  const codegoStatus = codegoStatusMap[status];
  if (!codegoStatus) {
    return NextResponse.json({
      error: 'Invalid status. Accepted: active, frozen, blocked',
    }, { status: 400 });
  }

  // FIX: Use PATCH /cards/{id} (not /cards/{id}/status which doesn't exist)
  const response = await fetch(`${CODEGO_API_URL}/cards/${codegoCardId}`, {
    method: 'PATCH',
    headers: codegoHeaders,
    body: JSON.stringify({ status: codegoStatus }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[Codego status] Card update error:', errorData);

    // Local fallback for mock cards or when not found in sandbox
    if (codegoCardId.startsWith('mock_cg_') || response.status === 404) {
      console.warn('[Codego status] Card not found on CodeGo, updating locally in Supabase');
      const internalStatus = status === 'frozen' ? 'frozen' : status === 'active' ? 'active' : 'blocked';
      const { error: dbErr } = await supabase
        .from('vcc_cards')
        .update({
          codego_status: codegoStatus,
          card_status: internalStatus,
        })
        .eq('codego_card_id', codegoCardId);

      if (dbErr) {
        console.error('[Codego status] Local update failed:', dbErr.message);
      }

      return NextResponse.json({
        message: 'Card status updated successfully (local mock fallback)',
        codegoStatus,
        internalStatus,
      });
    }

    return NextResponse.json({
      error: 'Failed to update Codego card status',
      details: errorData,
    }, { status: response.status });
  }

  const cardData = await response.json();

  // FIX: Update vcc_cards (not codego_cards), map status back to internal values
  const internalStatus = cardData.status === 'locked' ? 'frozen'
    : cardData.status === 'active' ? 'active'
    : cardData.status === 'canceled' ? 'blocked'
    : status;

  await supabase
    .from('vcc_cards')
    .update({
      codego_status: cardData.status,
      card_status: internalStatus,
    })
    .eq('codego_card_id', codegoCardId);

  return NextResponse.json({
    message: 'Card status updated successfully',
    codegoStatus: cardData.status,
    internalStatus,
    cardData,
  });
}
