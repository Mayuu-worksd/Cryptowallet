import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

    // 4. Verify OTP (with sandbox bypass for local testing)
    const isSandboxBypass = cleanOtp === '12345678' || cleanOtp === '00000000';
    let isOtpValid = false;

    if (isSandboxBypass) {
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

      // Log successful verification audit event
      await supabase.from('transaction_authorization_logs').insert({
        authorization_id,
        event_type: 'verified_success',
        details: { email, attempts: newAttempts, bypass: isSandboxBypass },
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
