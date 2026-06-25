import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const CODEGO_API_KEY = process.env.CODEGO_API_KEY || 'vcc_sbx_f119144ea2221e4796778de28115c4cad97429da86e66552';
const CODEGO_API_URL = process.env.CODEGO_API_URL || 'https://vcc-sandbox.codegotech.com/api/v1';

const codegoHeaders = {
  'X-Api-Key': CODEGO_API_KEY,
  'Content-Type': 'application/json',
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const walletAddress = searchParams.get('walletAddress');
  if (!walletAddress) {
    return NextResponse.json({ error: 'walletAddress query param required' }, { status: 400 });
  }

  // 1. Get KYC record to retrieve codego_cardholder_id
  const { data: kycData, error: kycError } = await supabase
    .from('kyc')
    .select('codego_cardholder_id')
    .eq('wallet_address', walletAddress.toLowerCase())
    .maybeSingle();

  if (kycError || !kycData?.codego_cardholder_id) {
    return NextResponse.json({ error: 'User not linked to CodeGo sandbox' }, { status: 400 });
  }

  // 2. Query CodeGo sandbox for user status
  const userRes = await fetch(`${CODEGO_API_URL}/users/${kycData.codego_cardholder_id}`, {
    headers: codegoHeaders,
  });

  if (!userRes.ok) {
    return NextResponse.json({ error: 'Failed to fetch sandbox user status' }, { status: 400 });
  }

  const userData = await userRes.json();
  const approved = userData.applicationStatus === 'approved';

  // Auto-sync: if Codego says approved but Supabase kyc.status isn't verified yet, fix it now
  if (approved) {
    const { data: currentKyc } = await supabase
      .from('kyc')
      .select('status')
      .eq('wallet_address', walletAddress.toLowerCase())
      .maybeSingle();

    if (currentKyc && currentKyc.status !== 'verified') {
      await supabase
        .from('kyc')
        .update({ status: 'verified', codego_application_status: 'approved' })
        .eq('wallet_address', walletAddress.toLowerCase());
    } else if (currentKyc?.status === 'verified') {
      // Already verified — just ensure codego_application_status is synced
      await supabase
        .from('kyc')
        .update({ codego_application_status: 'approved' })
        .eq('wallet_address', walletAddress.toLowerCase());
    }
  }

  return NextResponse.json({ approved, status: userData.applicationStatus ?? null });
}
