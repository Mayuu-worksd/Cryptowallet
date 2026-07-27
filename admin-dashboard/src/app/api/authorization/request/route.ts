import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transaction_id, provider_card_id, amount, currency, merchant, card_last4 } = body;

    if (!transaction_id) {
      return NextResponse.json({ success: false, error: 'transaction_id is required' }, { status: 400 });
    }

    // 1. Resolve Wallet Address from Card details
    let walletAddress = '';
    let resolvedCardLast4 = card_last4 || '0000';
    let resolvedProviderCardId = provider_card_id || '';

    if (provider_card_id) {
      // Lookup in vcc_cards
      const { data: vcc } = await supabase
        .from('vcc_cards')
        .select('wallet_address, card_last4')
        .eq('codego_card_id', provider_card_id)
        .maybeSingle();

      if (vcc) {
        walletAddress = vcc.wallet_address;
        resolvedCardLast4 = vcc.card_last4;
      } else {
        // Fallback to provider_cards
        const { data: pc } = await supabase
          .from('provider_cards')
          .select('wallet_address, card_last4')
          .eq('provider_card_id', provider_card_id)
          .maybeSingle();

        if (pc) {
          walletAddress = pc.wallet_address;
          resolvedCardLast4 = pc.card_last4;
        }
      }
    }

    // Fallback search by last4 if card id lookup failed or wasn't provided
    if (!walletAddress && card_last4) {
      const { data: vcc } = await supabase
        .from('vcc_cards')
        .select('wallet_address, codego_card_id')
        .eq('card_last4', card_last4)
        .maybeSingle();

      if (vcc) {
        walletAddress = vcc.wallet_address;
        resolvedProviderCardId = vcc.codego_card_id || '';
      }
    }

    if (!walletAddress) {
      return NextResponse.json({ success: false, error: 'Linked card/wallet address not found' }, { status: 404 });
    }

    // 2. Resolve User Email from KYC
    const { data: kycRow } = await supabase
      .from('kyc')
      .select('id, email, status')
      .eq('wallet_address', walletAddress.toLowerCase())
      .maybeSingle();

    if (!kycRow || !kycRow.email) {
      return NextResponse.json({ success: false, error: 'Cardholder email not found in KYC record' }, { status: 404 });
    }

    const email = kycRow.email.trim().toLowerCase();

    // 3. Handle Duplicate Authorization Request or Re-runs
    const { data: existing } = await supabase
      .from('transaction_authorizations')
      .select('*')
      .eq('transaction_id', transaction_id)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'authorized') {
        return NextResponse.json({ success: false, error: 'Transaction already approved' }, { status: 400 });
      }

      // If pending and not expired, reuse the authorization request and trigger OTP resend
      const now = new Date();
      if (existing.status === 'pending' && new Date(existing.expires_at) > now) {
        // Trigger OTP resend
        const otpRes = await sendSupabaseOTP(email);
        
        // Log resend audit event
        await supabase.from('transaction_authorization_logs').insert({
          authorization_id: existing.authorization_id,
          event_type: 'otp_resent',
          details: { email, reason: 'duplicate_request_reused' },
          ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
        });

        return NextResponse.json({
          success: true,
          authorization_id: existing.authorization_id,
          email,
          expires_at: existing.expires_at,
          status: 'pending',
          note: 'reused_active_request'
        });
      }
    }

    // 4. Create/Upsert the Authorization Record
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes validity
    const authRow = {
      transaction_id,
      wallet_address: walletAddress.toLowerCase(),
      user_id: kycRow.id,
      status: 'pending',
      attempts: 0,
      expires_at: expiresAt,
      amount: amount || 0.00,
      currency: currency || 'USD',
      merchant: merchant || 'Unknown Merchant',
      card_last4: resolvedCardLast4,
      provider_card_id: resolvedProviderCardId,
      otp_reference: 'supabase_auth_otp'
    };

    let authorizationId = '';

    if (existing) {
      // Update existing record
      const { data: updated, error: updateErr } = await supabase
        .from('transaction_authorizations')
        .update(authRow)
        .eq('transaction_id', transaction_id)
        .select('authorization_id')
        .single();

      if (updateErr) throw updateErr;
      authorizationId = updated.authorization_id;
    } else {
      // Insert new record
      const { data: inserted, error: insertErr } = await supabase
        .from('transaction_authorizations')
        .insert(authRow)
        .select('authorization_id')
        .single();

      if (insertErr) throw insertErr;
      authorizationId = inserted.authorization_id;
    }

    // 5. Send OTP using Supabase Auth
    await sendSupabaseOTP(email);

    // 6. Log created audit event
    await supabase.from('transaction_authorization_logs').insert({
      authorization_id: authorizationId,
      event_type: 'created',
      details: { email, amount, currency, merchant },
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    return NextResponse.json({
      success: true,
      authorization_id: authorizationId,
      email,
      expires_at: expiresAt,
      status: 'pending'
    });

  } catch (error: any) {
    console.error('[Auth Request] Error generating request:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}

async function sendSupabaseOTP(email: string) {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: undefined,
      }
    });
    if (error && error.status !== 429) {
      console.warn('[Supabase OTP] error:', error.message);
    }
  } catch (e: any) {
    console.error('[Supabase OTP] exception:', e?.message || e);
  }
}
