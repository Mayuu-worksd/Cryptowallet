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
    .select('codego_cardholder_id, status')
    .eq('wallet_address', walletAddress.toLowerCase())
    .maybeSingle();

  // If no codego_cardholder_id but admin already verified in Supabase — that's sufficient
  if (kycError) {
    return NextResponse.json({ error: 'Failed to fetch KYC record' }, { status: 400 });
  }

  if (!kycData) {
    return NextResponse.json({ error: 'KYC record not found' }, { status: 404 });
  }

  // Admin-approved users without a Codego sandbox link — trust Supabase directly
  if (!kycData.codego_cardholder_id) {
    const isVerified = kycData.status === 'verified';
    return NextResponse.json({ approved: isVerified, status: isVerified ? 'admin_verified' : kycData.status });
  }

  // 2. Query CodeGo sandbox for user status
  const userRes = await fetch(`${CODEGO_API_URL}/users/${kycData.codego_cardholder_id}`, {
    headers: codegoHeaders,
  });

  // If Codego fetch fails or returns not approved — but Supabase already verified — trust Supabase
  if (!userRes.ok) {
    const isVerified = kycData.status === 'verified';
    return NextResponse.json({ approved: isVerified, status: isVerified ? 'admin_verified' : 'unreachable' });
  }

  const userData = await userRes.json();
  console.log('[kyc/status] Codego user data:', JSON.stringify(userData));
  const codegoApproved = userData.applicationStatus === 'approved';

  // If Codego not approved but Supabase is verified — trust admin approval
  const approved = codegoApproved || kycData.status === 'verified';
  const status = codegoApproved ? 'approved' : kycData.status === 'verified' ? 'admin_verified' : (userData.applicationStatus ?? null);

  // Auto-sync: if Codego approved, make sure Supabase reflects it
  if (codegoApproved) {
    if (kycData.status !== 'verified') {
      await supabase
        .from('kyc')
        .update({ status: 'verified', codego_application_status: 'approved' })
        .eq('wallet_address', walletAddress.toLowerCase());
    } else {
      await supabase
        .from('kyc')
        .update({ codego_application_status: 'approved' })
        .eq('wallet_address', walletAddress.toLowerCase());
    }
  }

  return NextResponse.json({ approved, status });
}
