import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { amount, currency, merchant, card_last4, provider_card_id, transaction_id } = body;

    // 1. Find a card in the database to run the simulation against
    let card: any = null;

    if (provider_card_id) {
      const { data: vcc } = await supabase
        .from('vcc_cards')
        .select('*')
        .eq('codego_card_id', provider_card_id)
        .maybeSingle();
      card = vcc;
    }

    if (!card && card_last4) {
      const { data: vcc } = await supabase
        .from('vcc_cards')
        .select('*')
        .eq('card_last4', card_last4)
        .maybeSingle();
      card = vcc;
    }

    if (!card) {
      // Get any active card
      const { data: vccList } = await supabase
        .from('vcc_cards')
        .select('*')
        .eq('card_status', 'active')
        .limit(1);
      
      if (vccList && vccList.length > 0) {
        card = vccList[0];
      }
    }

    if (!card) {
      // Try provider_cards
      const { data: pcList } = await supabase
        .from('provider_cards')
        .select('*')
        .eq('status', 'active')
        .limit(1);
      
      if (pcList && pcList.length > 0) {
        card = pcList[0];
      }
    }

    if (!card) {
      return NextResponse.json({
        success: false,
        error: 'No active cards found in database. Please issue a virtual card first.'
      }, { status: 400 });
    }

    // 2. Fetch linked KYC owner email
    const { data: kycRow } = await supabase
      .from('kyc')
      .select('id, email')
      .eq('wallet_address', card.wallet_address.toLowerCase())
      .maybeSingle();

    if (!kycRow || !kycRow.email) {
      return NextResponse.json({
        success: false,
        error: `Card found but owner wallet (${card.wallet_address}) has no verified KYC email.`
      }, { status: 400 });
    }

    // 3. Generate mock merchant details
    const finalTxId = transaction_id || `sim_tx_${Math.random().toString(36).substring(2, 10)}`;
    const finalAmount = amount || Number((Math.random() * 150 + 10).toFixed(2));
    const finalCurrency = currency || 'USD';
    const finalMerchant = merchant || ['Amazon.com', 'Uber Trip', 'Netflix Inc', 'Steam Games', 'GitHub Copilot'][Math.floor(Math.random() * 5)];

    // 4. Upsert authorization record
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const authRow = {
      transaction_id: finalTxId,
      wallet_address: card.wallet_address.toLowerCase(),
      user_id: kycRow.id,
      status: 'pending',
      attempts: 0,
      expires_at: expiresAt,
      amount: finalAmount,
      currency: finalCurrency,
      merchant: finalMerchant,
      card_last4: card.card_last4 || '0000',
      provider_card_id: card.codego_card_id || card.provider_card_id || '',
      otp_reference: 'supabase_auth_otp_sim'
    };

    const { data: inserted, error: insertErr } = await supabase
      .from('transaction_authorizations')
      .upsert(authRow, { onConflict: 'transaction_id' })
      .select('authorization_id')
      .single();

    if (insertErr) throw insertErr;
    const authId = inserted.authorization_id;

    // 5. Send OTP via Supabase Auth
    try {
      await supabase.auth.signInWithOtp({
        email: kycRow.email.trim().toLowerCase(),
        options: { shouldCreateUser: false }
      });
    } catch (_e) {}

    // 6. Log audit log
    await supabase.from('transaction_authorization_logs').insert({
      authorization_id: authId,
      event_type: 'created',
      details: { email: kycRow.email, amount: finalAmount, merchant: finalMerchant, is_simulation: true },
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const redirectUrl = `/auth-payment/${authId}`;

    return NextResponse.json({
      success: true,
      simulation: {
        authorization_id: authId,
        transaction_id: finalTxId,
        amount: finalAmount,
        currency: finalCurrency,
        merchant: finalMerchant,
        email: kycRow.email,
        expires_at: expiresAt,
      },
      redirect_url: redirectUrl,
      full_redirect_url: `${protocol}://${host}${redirectUrl}`
    });

  } catch (error: any) {
    console.error('[Simulator API] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
