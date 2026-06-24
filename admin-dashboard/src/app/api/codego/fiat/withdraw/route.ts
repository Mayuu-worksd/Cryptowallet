import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const CODEGO_API_KEY = process.env.CODEGO_API_KEY!;
const CODEGO_API_URL = process.env.CODEGO_API_URL || 'https://vcc-sandbox.codegotech.com/api/v1';

export async function POST(request: Request) {
  try {
    const { userId, cardId, amount, currency, destinationIban, destinationBic, destinationName } = await request.json();

    if (!userId || !cardId || !amount || !destinationIban || !destinationBic || !destinationName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Verify user has enough balance in their wallet/card
    // In a real system, you'd check `codego_cards` limits and `fiat_ledger` balance,
    // and deduct it immediately or put a hold on it.

    // 2. Call Codego API to initiate an outgoing bank transfer (Withdrawal)
    // POST /v1/transfers/outgoing
    const codegoRes = await fetch(`${CODEGO_API_URL}/transfers/outgoing`, {
      method: 'POST',
      headers: {
        'X-Api-Key': CODEGO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: parseFloat(amount),
        currency: currency || 'USD',
        beneficiary: {
          name: destinationName,
          iban: destinationIban,
          bic: destinationBic
        },
        description: 'CryptoWallet User Withdrawal'
      })
    });

    if (!codegoRes.ok) {
      const errData = await codegoRes.json().catch(() => ({}));
      console.error('Codego transfer failed:', errData);
      return NextResponse.json({ error: 'Failed to initiate Codego withdrawal' }, { status: 500 });
    }

    const codegoData = await codegoRes.json();

    // 3. Insert the withdrawal record into Supabase
    const { data: withdrawal, error: dbError } = await supabase
      .from('fiat_withdrawals')
      .insert({
        user_id: userId,
        codego_card_id: cardId,
        amount: parseFloat(amount),
        currency: currency || 'USD',
        destination_iban: destinationIban,
        destination_bic: destinationBic,
        destination_name: destinationName,
        status: 'processing',
        codego_withdrawal_id: codegoData.id || `TXN-${Math.random().toString(36).substring(2)}`
      })
      .select()
      .single();

    if (dbError) {
      console.error('DB Error inserting fiat withdrawal:', dbError);
      return NextResponse.json({ error: 'Failed to create withdrawal record' }, { status: 500 });
    }

    return NextResponse.json({ success: true, withdrawal });

  } catch (error: any) {
    console.error('Error processing fiat withdrawal:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
