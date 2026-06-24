import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// NOTE: POST /transfers/outgoing and fiat deposit endpoints do NOT exist on the
// Codego sandbox. Fiat is admin-managed. This route creates a pending deposit
// record and returns the admin-configured bank account details.

export async function POST(request: Request) {
  try {
    const { walletAddress, cardId, amount, currency } = await request.json();

    if (!walletAddress || !amount) {
      return NextResponse.json({ error: 'walletAddress and amount are required' }, { status: 400 });
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

    // 2. Get active admin bank accounts from Supabase — NOT hardcoded
    const { data: bankAccounts } = await supabase
      .from('admin_bank_accounts')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1);

    const bankAccount = bankAccounts?.[0] ?? null;

    // 3. Generate unique reference code for bank transfer memo
    const referenceCode = `DEP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // 4. Look up the vcc_cards UUID for this wallet if cardId is a codego_card_id
    let internalCardId: string | null = cardId || null;
    if (cardId) {
      const { data: vccCard } = await supabase
        .from('vcc_cards')
        .select('id')
        .eq('codego_card_id', cardId)
        .maybeSingle();
      if (vccCard) internalCardId = vccCard.id;
    }

    // 5. Insert pending deposit record into fiat_deposits
    const { data: deposit, error: dbError } = await supabase
      .from('fiat_deposits')
      .insert({
        user_id: kycData.id,
        codego_card_id: internalCardId,
        amount: parseFloat(amount),
        currency: currency || 'USD',
        reference_code: referenceCode,
        status: 'pending',
      })
      .select()
      .single();

    if (dbError) {
      console.error('[Fiat deposit] DB insert error:', dbError);
      return NextResponse.json({ error: 'Failed to create deposit record', details: dbError.message }, { status: 500 });
    }

    // 6. Return real admin bank details (or a placeholder if none configured)
    const paymentInstructions = bankAccount
      ? {
          bankName: bankAccount.bank_name,
          beneficiary: bankAccount.beneficiary_name,
          accountNumber: bankAccount.account_number,
          routingNumber: bankAccount.routing_number,
          iban: bankAccount.iban || null,
          swiftCode: bankAccount.swift_code || null,
          currency: bankAccount.currency,
          instructions: bankAccount.deposit_instructions || null,
          reference: referenceCode,
        }
      : {
          reference: referenceCode,
          note: 'No bank account configured. Please contact support or configure an admin bank account.',
        };

    return NextResponse.json({
      success: true,
      deposit,
      paymentInstructions,
      sandbox_note: 'POST /transfers/outgoing is not available in Codego sandbox. Fiat deposits are admin-managed.',
    });

  } catch (error: any) {
    console.error('[Fiat deposit] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
