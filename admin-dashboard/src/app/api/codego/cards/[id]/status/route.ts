import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const CODEGO_API_KEY = process.env.CODEGO_API_KEY || 'vcck_sbx_f119144ea2221e4796778de28115c4cad97429da86e66552';
const CODEGO_API_URL = process.env.CODEGO_API_URL || 'https://vcc-sandbox.codegotech.com/api/v1';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json();
    const { status } = body; // 'frozen' or 'active'
    const resolvedParams = await params;
    const codegoCardId = resolvedParams.id;

    if (!status || !codegoCardId) {
      return NextResponse.json({ error: 'status and id are required' }, { status: 400 });
    }

    // 1. Update Card in Codego
    const response = await fetch(`${CODEGO_API_URL}/cards/${codegoCardId}/status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${CODEGO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Codego card status update error:', errorData);
      return NextResponse.json({ error: 'Failed to update Codego card status', details: errorData }, { status: response.status });
    }

    const cardData = await response.json();

    // 2. Update vcc_cards in Supabase
    await supabase
      .from('vcc_cards')
      .update({
        codego_status: cardData.status,
        status: cardData.status === 'frozen' ? 'frozen' : 'active'
      })
      .eq('codego_card_id', codegoCardId);

    return NextResponse.json({ message: 'Card status updated successfully', cardData });
  } catch (error: any) {
    console.error('Error updating Codego card status:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
