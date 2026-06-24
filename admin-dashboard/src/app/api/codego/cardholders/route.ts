import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const CODEGO_API_KEY = process.env.CODEGO_API_KEY || 'vcck_sbx_f119144ea2221e4796778de28115c4cad97429da86e66552';
const CODEGO_API_URL = process.env.CODEGO_API_URL || 'https://vcc-sandbox.codegotech.com/api/v1';

// FIX: Correct Codego header is X-Api-Key, NOT Authorization Bearer
const codegoHeaders = {
  'X-Api-Key': CODEGO_API_KEY,
  'Content-Type': 'application/json',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
    }

    // 1. Get KYC record
    const { data: kycData, error: kycError } = await supabase
      .from('kyc')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .maybeSingle();

    if (kycError || !kycData) {
      return NextResponse.json({ error: 'User KYC not found' }, { status: 404 });
    }

    if (kycData.status !== 'verified') {
      return NextResponse.json({ error: 'KYC is not verified' }, { status: 400 });
    }

    // 2. Idempotency: if already mapped, return existing ID
    if (kycData.codego_cardholder_id) {
      return NextResponse.json({
        message: 'User already mapped to Codego',
        cardholderId: kycData.codego_cardholder_id,
        alreadyExists: true,
      });
    }

    // 3. POST /applications — the correct Codego onboarding endpoint
    // NOTE: In sandbox the KYC token fields are required. We send a sandbox bypass
    // by using a pre-shared test token. In production this would be a real KYC token
    // from your admin-approved flow. Since we do NOT use Sumsub/Persona, we use
    // the 'key' field which accepts a pre-agreed secret for server-to-server flows.
    const nameParts = (kycData.full_name || 'Unknown User').trim().split(' ');
    const firstName = nameParts[0] || 'Unknown';
    const lastName = nameParts.slice(1).join(' ') || 'User';

    // Build a deterministic externalUserId from the wallet address
    const externalUserId = `cw_${walletAddress.toLowerCase().replace('0x', '').slice(0, 16)}`;

    const applicationPayload: any = {
      externalUserId,
      email: kycData.email,
      firstName,
      lastName,
      birthDate: kycData.dob || '1990-01-01',
      phone: kycData.phone || '+10000000000',
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      address: {
        line1: kycData.address || '123 Main St',
        city: 'Unknown',
        postalCode: '00000',
        country: kycData.nationality?.slice(0, 2).toUpperCase() || 'US',
      },
      // Sandbox: 'key' is accepted as a server-to-server bypass when
      // sumsubShareToken / personaShareToken are not available.
      // Remove this in production and pass the real KYC token instead.
      key: process.env.CODEGO_API_KEY || CODEGO_API_KEY,
    };

    const response = await fetch(`${CODEGO_API_URL}/applications`, {
      method: 'POST',
      headers: codegoHeaders,
      body: JSON.stringify(applicationPayload),
    });

    const responseText = await response.text();
    let codegoData: any;
    try { codegoData = JSON.parse(responseText); } catch { codegoData = { raw: responseText }; }

    if (!response.ok) {
      console.error('[Codego /applications] Error:', response.status, codegoData);
      // Return structured error — caller can decide to proceed as admin-managed
      return NextResponse.json({
        error: 'Codego application submission failed',
        details: codegoData,
        httpStatus: response.status,
        note: 'Sandbox may require sumsubShareToken or personaShareToken. Card issuance is admin-managed until production KYC token is configured.',
      }, { status: response.status });
    }

    const cardholderId: string = codegoData.id || codegoData.userId || externalUserId;

    // 4. Save codego_cardholder_id to kyc table
    const { error: updateError } = await supabase
      .from('kyc')
      .update({ codego_cardholder_id: cardholderId })
      .eq('wallet_address', walletAddress.toLowerCase());

    if (updateError) {
      console.error('[Codego cardholders] Failed to update kyc.codego_cardholder_id:', updateError.message);
    }

    return NextResponse.json({
      message: 'Codego application submitted successfully',
      cardholderId,
      externalUserId,
    });
  } catch (error: any) {
    console.error('[Codego cardholders] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// GET — look up existing Codego cardholder by wallet address
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const walletAddress = searchParams.get('walletAddress');
  if (!walletAddress) {
    return NextResponse.json({ error: 'walletAddress query param required' }, { status: 400 });
  }

  const { data: kycData, error } = await supabase
    .from('kyc')
    .select('codego_cardholder_id, full_name, email, status')
    .eq('wallet_address', walletAddress.toLowerCase())
    .maybeSingle();

  if (error || !kycData) {
    return NextResponse.json({ error: 'KYC record not found' }, { status: 404 });
  }

  if (!kycData.codego_cardholder_id) {
    return NextResponse.json({ cardholderId: null, message: 'Not yet mapped to Codego' });
  }

  // Fetch live from Codego — GET /users/{id} returns "user not found" for fake IDs
  // but returns user data for real ones created via /applications
  const res = await fetch(`${CODEGO_API_URL}/users/${kycData.codego_cardholder_id}`, {
    headers: codegoHeaders,
  });
  const userData = await res.json().catch(() => ({}));

  return NextResponse.json({
    cardholderId: kycData.codego_cardholder_id,
    codegoStatus: res.ok ? 'found' : 'not_found_in_codego',
    codegoData: res.ok ? userData : null,
  });
}
