import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id') || searchParams.get('authorization_id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Authorization ID is required' }, { status: 400 });
    }

    // 1. Fetch transaction authorization record
    const { data: auth, error } = await supabase
      .from('transaction_authorizations')
      .select('*')
      .eq('authorization_id', id)
      .maybeSingle();

    if (error) throw error;
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Authorization request not found' }, { status: 404 });
    }

    // 2. Automatically update state to expired if expires_at is past and status is pending
    const now = new Date();
    let currentStatus = auth.status;

    if (currentStatus === 'pending' && new Date(auth.expires_at) < now) {
      currentStatus = 'expired';
      
      await supabase
        .from('transaction_authorizations')
        .update({ status: 'expired' })
        .eq('authorization_id', id);

      // Log expiry event
      await supabase.from('transaction_authorization_logs').insert({
        authorization_id: id,
        event_type: 'expired',
        details: { reason: 'expiration_time_passed' },
        ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
      });
    }

    // 3. Fetch user email (masked for privacy)
    let maskedEmail = 'user@example.com';
    const { data: kycRow } = await supabase
      .from('kyc')
      .select('email')
      .eq('wallet_address', auth.wallet_address.toLowerCase())
      .maybeSingle();

    if (kycRow && kycRow.email) {
      const parts = kycRow.email.split('@');
      if (parts.length === 2) {
        const name = parts[0];
        const domain = parts[1];
        maskedEmail = name.length > 2 
          ? `${name.slice(0, 2)}••••@${domain}`
          : `••@${domain}`;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        authorization_id: auth.authorization_id,
        transaction_id: auth.transaction_id,
        status: currentStatus,
        expires_at: auth.expires_at,
        amount: Number(auth.amount),
        currency: auth.currency,
        merchant: auth.merchant,
        card_last4: auth.card_last4,
        attempts: auth.attempts,
        masked_email: maskedEmail
      }
    });

  } catch (error: any) {
    console.error('[Auth Status] Error fetching status:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
