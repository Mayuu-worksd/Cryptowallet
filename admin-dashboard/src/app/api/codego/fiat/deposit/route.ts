import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const CODEGO_API_KEY = process.env.CODEGO_API_KEY!;
const CODEGO_API_URL = process.env.CODEGO_API_URL || 'https://vcc-sandbox.codegotech.com/api/v1';

export async function POST(request: Request) {
  try {
    const { userId, cardId, amount, currency } = await request.json();

    if (!userId || !cardId || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Generate a unique reference code for the user to put in their bank transfer memo
    const referenceCode = `DEP-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    // 2. Insert the pending deposit record into Supabase
    const { data: deposit, error: dbError } = await supabase
      .from('fiat_deposits')
      .insert({
        user_id: userId,
        codego_card_id: cardId,
        amount: parseFloat(amount),
        currency: currency || 'USD',
        reference_code: referenceCode,
        status: 'pending'
      })
      .select()
      .single();

    if (dbError) {
      console.error('DB Error inserting fiat deposit:', dbError);
      return NextResponse.json({ error: 'Failed to create deposit record' }, { status: 500 });
    }

    // 3. Optional: Call Codego to pre-register the expected deposit, or fetch the Codego IBAN
    // In many BaaS systems, you either pull a dedicated IBAN for the user or instruct them
    // to wire to a master Codego IBAN with the referenceCode.
    // We'll mock returning master IBAN details here, as the Sandbox usually provides a static one.
    
    return NextResponse.json({
      success: true,
      deposit: deposit,
      paymentInstructions: {
        bankName: 'Codego Sandbox Bank',
        iban: 'GB82SANDBOX1234567890123',
        bic: 'SANDGB2L',
        reference: referenceCode,
        beneficiary: 'CryptoWallet User Trust'
      }
    });

  } catch (error: any) {
    console.error('Error processing fiat deposit:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
