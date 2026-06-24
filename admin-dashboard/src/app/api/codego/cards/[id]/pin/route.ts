import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const CODEGO_API_KEY = process.env.CODEGO_API_KEY || 'vcck_sbx_f119144ea2221e4796778de28115c4cad97429da86e66552';
const CODEGO_API_URL = process.env.CODEGO_API_URL || 'https://vcc-sandbox.codegotech.com/api/v1';

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: cardId } = await context.params;
    const body = await req.json();
    const { newPin, userId } = body; 

    if (!newPin || newPin.length !== 4) {
      return NextResponse.json({ error: 'Valid 4-digit PIN required' }, { status: 400 });
    }

    // According to Codego docs, we PUT /cards/{cardId}/pin
    // The PIN payload is a simple string. The endpoint handles generating the fresh RSA session
    // and ISO PIN block.
    const response = await fetch(`${CODEGO_API_URL}/cards/${cardId}/pin`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CODEGO_API_KEY}`
      },
      body: JSON.stringify({ pin: newPin }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Codego pin update error:', errorData);
      return NextResponse.json(
        { error: 'Failed to update Codego card PIN', details: errorData },
        { status: response.status }
      );
    }

    // Log the PIN change event without storing the PIN itself
    if (userId) {
      const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
      try {
        await supabase.from('codego_card_pin_audits').insert({
          card_id: cardId, // Notice this assumes codego_cards.id is UUID. We should look up the internal UUID first.
          user_id: userId,
          ip_address: clientIp
        });
      } catch (err) {
        console.error('Failed to audit PIN change', err);
      }
    }

    return NextResponse.json({ ok: true, message: 'PIN updated successfully' });
  } catch (error) {
    console.error('Error updating Codego PIN:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
