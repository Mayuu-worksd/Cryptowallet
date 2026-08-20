import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCardProvider } from '@/lib/providers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { authorization_id, otp } = body;

    if (!authorization_id || !otp) {
      return NextResponse.json({ success: false, error: 'authorization_id and otp are required' }, { status: 400 });
    }

    const cleanOtp = otp.trim();

    // 1. Fetch authorization request details
    const { data: auth, error } = await supabase
      .from('transaction_authorizations')
      .select('*')
      .eq('authorization_id', authorization_id)
      .maybeSingle();

    if (error) throw error;
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Authorization request not found' }, { status: 404 });
    }

    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';

    // 2. Perform security validations
    if (auth.status === 'authorized') {
      return NextResponse.json({ success: false, error: 'Transaction already approved', status: 'authorized' }, { status: 400 });
    }
    if (auth.status === 'rejected') {
      return NextResponse.json({ success: false, error: 'Transaction already rejected', status: 'rejected' }, { status: 400 });
    }
    if (auth.status === 'expired' || new Date(auth.expires_at) < new Date()) {
      if (auth.status === 'pending') {
        await supabase
          .from('transaction_authorizations')
          .update({ status: 'expired' })
          .eq('authorization_id', authorization_id);
      }
      return NextResponse.json({ success: false, error: 'Verification code expired', status: 'expired' }, { status: 400 });
    }
    if (auth.attempts >= 3) {
      return NextResponse.json({ success: false, error: 'Maximum verification attempts exceeded. Transaction rejected.', status: 'rejected' }, { status: 400 });
    }

    // Rate Limiting: 30-second cooldown check after a failure
    const cooldownMs = 30000;
    if (auth.attempts > 0 && auth.updated_at && auth.otp_reference !== 'supabase_auth_otp_sim') {
      const elapsed = Date.now() - new Date(auth.updated_at).getTime();
      if (elapsed < cooldownMs) {
        const remaining = Math.ceil((cooldownMs - elapsed) / 1000);
        return NextResponse.json({
          success: false,
          error: `Too many attempts. Please wait ${remaining} seconds cooldown period before trying again.`,
          cooldown_remaining: remaining
        }, { status: 429 });
      }
    }

    // 3. Retrieve user email to verify with Supabase Auth
    const { data: kycRow } = await supabase
      .from('kyc')
      .select('email')
      .eq('wallet_address', auth.wallet_address.toLowerCase())
      .maybeSingle();

    if (!kycRow || !kycRow.email) {
      return NextResponse.json({ success: false, error: 'User email not found' }, { status: 404 });
    }

    const email = kycRow.email.trim().toLowerCase();

    // 4. Verify OTP (Sandbox bypass code '12345678' allowed for simulation requests)
    let isOtpValid = false;

    if (auth.otp_reference === 'supabase_auth_otp_sim' && cleanOtp === '12345678') {
      isOtpValid = true;
    } else {
      try {
        const { error: otpErr } = await supabase.auth.verifyOtp({
          email,
          token: cleanOtp,
          type: 'email',
        });
        if (!otpErr) {
          isOtpValid = true;
        }
      } catch (err) {
        console.error('[Supabase OTP verify exception]:', err);
      }
    }

    const newAttempts = auth.attempts + 1;

    if (isOtpValid) {
      // 5. SUCCESS: Approve Transaction
      // Call provider callback
      let approvalSuccess = false;
      try {
        const provider = getCardProvider();
        if (provider.approveTransaction && auth.otp_reference !== 'supabase_auth_otp_sim') {
          approvalSuccess = await provider.approveTransaction(auth.transaction_id);
        } else {
          approvalSuccess = true;
        }
      } catch (e: any) {
        console.error('[Verify Route] Provider approval callback error:', e.message);
        return NextResponse.json({
          success: false,
          error: `Card provider failed to authorize payment: ${e.message || 'Connection offline'}`
        }, { status: 502 });
      }

      if (!approvalSuccess) {
        return NextResponse.json({
          success: false,
          error: 'Card provider declined the transaction authorization.'
        }, { status: 502 });
      }

      // Update authorization request status
      await supabase
        .from('transaction_authorizations')
        .update({
          status: 'authorized',
          authorized_at: new Date().toISOString(),
          attempts: newAttempts
        })
        .eq('authorization_id', authorization_id);

      // Create/Update the core transactions table to success
      const { data: vcc } = await supabase
        .from('vcc_cards')
        .select('id')
        .eq('wallet_address', auth.wallet_address)
        .limit(1)
        .maybeSingle();

      const cardId = vcc?.id || null;

      await supabase.from('transactions').upsert({
        wallet_address: auth.wallet_address,
        card_id: cardId,
        type: 'card_spend',
        token: auth.currency,
        amount: Number(auth.amount),
        usd_value: Number(auth.amount),
        status: 'success',
        reference_id: auth.transaction_id,
        label: auth.merchant,
        description: `KripiCard payment authorized via Email OTP`,
        created_at: new Date().toISOString(),
      }, { onConflict: 'reference_id' });

      // Deduct funds from user's wallet_profiles balance
      try {
        const { data: profile } = await supabase
          .from('wallet_profiles')
          .select('token_balances')
          .eq('wallet_address', auth.wallet_address.toLowerCase())
          .maybeSingle();

        if (profile?.token_balances) {
          const balances: Record<string, number> = typeof profile.token_balances === 'string'
            ? JSON.parse(profile.token_balances)
            : { ...profile.token_balances };

          const priority = ['USDT', 'USDC', 'ETH', 'BNB', 'TRX'];
          let remaining = Number(auth.amount);
          const ETH_PRICE = 3500;

          for (const token of priority) {
            if (remaining <= 0) break;
            const bal = balances[token] ?? 0;
            if (bal <= 0) continue;
            const tokenPrice = (token === 'ETH' || token === 'BNB') ? ETH_PRICE : 1;
            const balUSD = bal * tokenPrice;
            const deductUSD = Math.min(balUSD, remaining);
            const deductToken = deductUSD / tokenPrice;
            balances[token] = Math.max(0, bal - deductToken);
            remaining -= deductUSD;
          }

          await supabase
            .from('wallet_profiles')
            .update({ token_balances: balances })
            .eq('wallet_address', auth.wallet_address.toLowerCase());
        }
      } catch (balErr: any) {
        console.error('[Verify Route] Local wallet balance deduction failed:', balErr.message);
      }

      // Log successful verification audit event
      await supabase.from('transaction_authorization_logs').insert({
        authorization_id,
        event_type: 'verified_success',
        details: { email, attempts: newAttempts, bypass: false },
        ip_address: ipAddress
      });

      return NextResponse.json({
        success: true,
        status: 'authorized',
        message: 'Transaction authorized successfully.'
      });

    } else {
      // 6. FAILURE: Increment attempts and reject if attempts >= 3
      const isLimitReached = newAttempts >= 3;
      const finalStatus = isLimitReached ? 'rejected' : 'pending';

      await supabase
        .from('transaction_authorizations')
        .update({
          status: finalStatus,
          attempts: newAttempts
        })
        .eq('authorization_id', authorization_id);

      if (isLimitReached) {
        // Call provider callback for rejection
        try {
          const provider = getCardProvider();
          if (provider.rejectTransaction) {
            await provider.rejectTransaction(auth.transaction_id);
          }
        } catch (e: any) {
          console.error('[Verify Route] Provider rejection callback error:', e.message);
        }

        // Create/Update the core transactions table to failed status
        const { data: vcc } = await supabase
          .from('vcc_cards')
          .select('id')
          .eq('wallet_address', auth.wallet_address)
          .limit(1)
          .maybeSingle();

        const cardId = vcc?.id || null;

        await supabase.from('transactions').upsert({
          wallet_address: auth.wallet_address,
          card_id: cardId,
          type: 'card_spend',
          token: auth.currency,
          amount: Number(auth.amount),
          usd_value: Number(auth.amount),
          status: 'failed',
          reference_id: auth.transaction_id,
          label: auth.merchant,
          description: `KripiCard payment rejected - OTP max attempts reached`,
          created_at: new Date().toISOString(),
        }, { onConflict: 'reference_id' });

        // Log transaction rejection audit event
        await supabase.from('transaction_authorization_logs').insert({
          authorization_id,
          event_type: 'rejected',
          details: { email, reason: 'attempts_limit_reached', attempts: newAttempts },
          ip_address: ipAddress
        });

        return NextResponse.json({
          success: false,
          status: 'rejected',
          error: 'Maximum verification attempts exceeded. Transaction rejected.',
        }, { status: 400 });
      }

      // Log failed attempt audit event
      await supabase.from('transaction_authorization_logs').insert({
        authorization_id,
        event_type: 'verified_failed',
        details: { email, attempts: newAttempts },
        ip_address: ipAddress
      });

      return NextResponse.json({
        success: false,
        status: 'pending',
        error: 'Invalid verification code. Please check and try again.',
        attempts_remaining: 3 - newAttempts
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error('[Auth Verify] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
