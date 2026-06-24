import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const CODEGO_API_KEY = process.env.CODEGO_API_KEY || 'vcck_sbx_f119144ea2221e4796778de28115c4cad97429da86e66552';
const CODEGO_API_URL = process.env.CODEGO_API_URL || 'https://vcc-sandbox.codegotech.com/api/v1';

// FIX: Replace Authorization Bearer with X-Api-Key
const codegoHeaders = {
  'X-Api-Key': CODEGO_API_KEY,
  'Content-Type': 'application/json',
};

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: codegoCardId } = await context.params;
  const body = await req.json();
  const { newPin, walletAddress } = body;

  if (!newPin || !/^\d{4}$/.test(newPin)) {
    return NextResponse.json({ error: 'Valid 4-digit PIN required' }, { status: 400 });
  }

  // PUT /cards/{id}/pin — this endpoint EXISTS on Codego (confirmed by probe)
  const response = await fetch(`${CODEGO_API_URL}/cards/${codegoCardId}/pin`, {
    method: 'PUT',
    headers: codegoHeaders,
    body: JSON.stringify({ pin: newPin }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[Codego PIN] Update failed:', errorData);
    return NextResponse.json(
      { error: 'Failed to update Codego card PIN', details: errorData },
      { status: response.status }
    );
  }

  // Audit log — look up the internal vcc_cards UUID from the codego_card_id
  // FIX: Previously used cardId (codego string ID) directly as card_id FK — wrong.
  // The FK references vcc_cards.id (UUID), not the codego_card_id string.
  if (walletAddress) {
    const { data: vccCard } = await supabase
      .from('vcc_cards')
      .select('id')
      .eq('codego_card_id', codegoCardId)
      .maybeSingle();

    if (vccCard?.id) {
      const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
      await supabase.from('codego_card_pin_audits').insert({
        card_id: vccCard.id,   // FIX: internal UUID, not codego string ID
        ip_address: clientIp,
      }).then(({ error }) => {
        if (error) console.warn('[Codego PIN] Audit log failed:', error.message);
      });
    }
  }

  return NextResponse.json({ ok: true, message: 'PIN updated successfully' });
}
