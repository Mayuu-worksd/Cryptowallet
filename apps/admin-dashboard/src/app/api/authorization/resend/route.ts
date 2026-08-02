import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { authorization_id } = body;

    if (!authorization_id) {
      return NextResponse.json({ success: false, error: 'authorization_id is required' }, { status: 400 });
    }

    // 1. Fetch authorization record
    const { data: auth, error } = await supabase
      .from('transaction_authorizations')
      .select('*')
      .eq('authorization_id', authorization_id)
      .maybeSingle();

    if (error) throw error;
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Authorization request not found' }, { status: 404 });
    }

    // 2. Security validation
    if (auth.status !== 'pending') {
      return NextResponse.json({ success: false, error: `Cannot resend OTP. Request status is '${auth.status}'` }, { status: 400 });
    }

    if (new Date(auth.expires_at) < new Date()) {
      // Update DB to expired
      await supabase
        .from('transaction_authorizations')
        .update({ status: 'expired' })
        .eq('authorization_id', authorization_id);

      return NextResponse.json({ success: false, error: 'Verification code expired', status: 'expired' }, { status: 400 });
    }

    // 3. Retrieve user email
    const { data: kycRow } = await supabase
      .from('kyc')
      .select('email')
      .eq('wallet_address', auth.wallet_address.toLowerCase())
      .maybeSingle();

    if (!kycRow || !kycRow.email) {
      return NextResponse.json({ success: false, error: 'User email not found' }, { status: 404 });
    }

    const email = kycRow.email.trim().toLowerCase();

    // 4. Trigger Supabase OTP resend
    await sendSupabaseOTP(email);

    // 5. Log resend audit log
    await supabase.from('transaction_authorization_logs').insert({
      authorization_id,
      event_type: 'otp_resent',
      details: { email, manual_resend: true },
      ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    return NextResponse.json({
      success: true,
      message: 'Verification code resent successfully.'
    });

  } catch (error: any) {
    console.error('[Auth Resend] Error:', error);
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
      console.warn('[Supabase OTP resend] error:', error.message);
    }
  } catch (e: any) {
    console.error('[Supabase OTP resend] exception:', e?.message || e);
  }
}
