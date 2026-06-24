import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const CODEGO_API_KEY = process.env.CODEGO_API_KEY || 'vcck_sbx_f119144ea2221e4796778de28115c4cad97429da86e66552';
const CODEGO_API_URL = process.env.CODEGO_API_URL || 'https://vcc-sandbox.codegotech.com/api/v1';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const cardId = resolvedParams.id;
    const body = await req.json();
    const { status, limit } = body; // status: 'active', 'locked', 'canceled'. limit: { amount, frequency }

    const updatePayload: any = {};
    if (status) {
      if (!['active', 'locked', 'canceled'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updatePayload.status = status;
    }
    
    if (limit) {
      updatePayload.limit = limit;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No update parameters provided' }, { status: 400 });
    }

    const response = await fetch(`${CODEGO_API_URL}/cards/${cardId}`, {
      method: 'PATCH',
      headers: {
        'X-Api-Key': CODEGO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Codego card update error:', errorData);
      return NextResponse.json(
        { error: 'Failed to update Codego card', details: errorData },
        { status: response.status }
      );
    }

    const cardData = await response.json();

    // Update in Supabase
    const dbUpdate: any = {};
    if (cardData.status) dbUpdate.status = cardData.status;
    if (cardData.limit?.amount) dbUpdate.limit_amount = cardData.limit.amount;
    if (cardData.limit?.frequency) dbUpdate.limit_frequency = cardData.limit.frequency;

    if (Object.keys(dbUpdate).length > 0) {
      const { error: dbError } = await supabase
        .from('codego_cards')
        .update(dbUpdate)
        .eq('codego_card_id', cardId);

      if (dbError) {
        console.error('Failed to update card details in db:', dbError);
      }
    }

    return NextResponse.json({ cardData });
  } catch (error) {
    console.error('Error updating Codego card:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
