import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const CODEGO_API_KEY = process.env.CODEGO_API_KEY || 'vcck_sbx_f119144ea2221e4796778de28115c4cad97429da86e66552';
const CODEGO_API_URL = process.env.CODEGO_API_URL || 'https://vcc-sandbox.codegotech.com/api/v1';

// FIX: Correct auth header
const codegoHeaders = {
  'X-Api-Key': CODEGO_API_KEY,
  'Content-Type': 'application/json',
};

// NOTE: POST /transfers/outgoing does NOT exist on the Codego sandbox.
// Confirmed via probe — 404 with path in response body.
// In production this endpoint will be available. In sandbox, the withdrawal
// is stored in Supabase as pending and processed manually by admin.
export async function POST(request: Request) {
  try {
    const { walletAddress, cardId, amount, currency, destinationIban, destinationBic, destinationName } = await request.json();

    if (!walletAddress || !amount || !destinationIban || !destinationBic || !destinationName) {
      return NextResponse.json({ error: 'Missing required fields: walletAddress, amount, destinationIban, destinationBic, destinationName' }, { status: 400 });
    }

    // 1. Verify KYC
    const { data: kycData } = await supabase
      .from('kyc')
      .select('id, status')
      .eq('wallet_address', walletAddress.toLowerCase())
      .maybeSingle();

    if (!kycData || kycData.status !== 'verified') {
      return NextResponse.json({ error: 'KYC not verified' }, { status: 400 });
    }

    // 2. Resolve internal card UUID from codego_card_id if needed
    let internalCardId: string | null = cardId || null;
    if (cardId) {
      const { data: vccCard } = await supabase
        .from('vcc_cards')
        .select('id')
        .eq('codego_card_id', cardId)
        .maybeSingle();
      if (vccCard) internalCardId = vccCard.id;
    }

    // 3. Attempt Codego transfer — will work in production, returns 404 in sandbox
    let codegoWithdrawalId: string | null = null;
    let usedCodego = false;

    const codegoRes = await fetch(`${CODEGO_API_URL}/transfers/outgoing`, {
      method: 'POST',
      headers: codegoHeaders,
      body: JSON.stringify({
        amount: parseFloat(amount),
        currency: currency || 'USD',
        beneficiary: { name: destinationName, iban: destinationIban, bic: destinationBic },
        description: 'CryptoWallet User Withdrawal',
      }),
    });

    if (codegoRes.ok) {
      const codegoData = await codegoRes.json();
      codegoWithdrawalId = codegoData.id || null;
      usedCodego = true;
    } else {
      console.warn('[Fiat withdraw] Codego transfer failed (expected in sandbox):', codegoRes.status);
    }

    // 4. Store in fiat_withdrawals table regardless
    const { data: withdrawal, error: dbError } = await supabase
      .from('fiat_withdrawals')
      .insert({
        user_id: kycData.id,
        codego_card_id: internalCardId,
        amount: parseFloat(amount),
        currency: currency || 'USD',
        destination_iban: destinationIban,
        destination_bic: destinationBic,
        destination_name: destinationName,
        status: usedCodego ? 'processing' : 'pending',
        codego_withdrawal_id: codegoWithdrawalId,
      })
      .select()
      .single();

    if (dbError) {
      console.error('[Fiat withdraw] DB insert error:', dbError);
      return NextResponse.json({ error: 'Failed to create withdrawal record', details: dbError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      withdrawal,
      processedViaCodego: usedCodego,
      sandbox_note: usedCodego
        ? undefined
        : 'POST /transfers/outgoing is not available in sandbox. Withdrawal is pending admin processing.',
    });

  } catch (error: any) {
    console.error('[Fiat withdraw] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
