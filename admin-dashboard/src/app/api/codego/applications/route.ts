import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const CODEGO_API_KEY = process.env.CODEGO_API_KEY || 'vcck_sbx_f119144ea2221e4796778de28115c4cad97429da86e66552';
const CODEGO_API_URL = process.env.CODEGO_API_URL || 'https://vcc-sandbox.codegotech.com/api/v1';

// FIX: Always X-Api-Key
const codegoHeaders = {
  'X-Api-Key': CODEGO_API_KEY,
  'Content-Type': 'application/json',
};

// POST /applications — submit a Codego KYC application for a verified user
// Requires: walletAddress (looks up KYC) or full fields directly
// In sandbox: requires sumsubShareToken or personaShareToken
// In production: provide the KYC token from admin-approved flow
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress, sumsubShareToken, personaShareToken, ipAddress } = body;

    let kycData: any = null;
    if (walletAddress) {
      const { data } = await supabase
        .from('kyc')
        .select('*')
        .eq('wallet_address', walletAddress.toLowerCase())
        .maybeSingle();
      kycData = data;
    }

    if (!kycData && !body.email) {
      return NextResponse.json({ error: 'walletAddress or email required' }, { status: 400 });
    }

    const nameParts = ((kycData?.full_name || body.firstName + ' ' + body.lastName) || 'Unknown User').trim().split(' ');
    const firstName = body.firstName || nameParts[0] || 'Unknown';
    const lastName = body.lastName || nameParts.slice(1).join(' ') || 'User';
    const externalUserId = body.externalUserId
      || (walletAddress ? `cw_${walletAddress.toLowerCase().replace('0x', '').slice(0, 16)}` : undefined)
      || body.userId;

    const codegoPayload: any = {
      externalUserId,
      email: body.email || kycData?.email,
      firstName,
      lastName,
      birthDate: body.birthDate || kycData?.dob || '1990-01-01',
      phone: body.phone || kycData?.phone || '+10000000000',
      ipAddress: ipAddress || req.headers.get('x-forwarded-for') || '127.0.0.1',
      address: {
        line1: body.address || kycData?.address || '123 Main St',
        city: body.city || 'Unknown',
        postalCode: body.postalCode || '00000',
        country: body.country || kycData?.nationality?.slice(0, 2).toUpperCase() || 'US',
      },
    };

    // Sandbox requires one of these KYC tokens
    if (sumsubShareToken) codegoPayload.sumsubShareToken = sumsubShareToken;
    if (personaShareToken) codegoPayload.personaShareToken = personaShareToken;

    const response = await fetch(`${CODEGO_API_URL}/applications`, {
      method: 'POST',
      headers: codegoHeaders,
      body: JSON.stringify(codegoPayload),
    });

    const responseText = await response.text();
    let data: any;
    try { data = JSON.parse(responseText); } catch { data = { raw: responseText }; }

    if (!response.ok) {
      return NextResponse.json({
        error: 'Codego application failed',
        details: data,
        httpStatus: response.status,
        sandbox_note: 'Sandbox requires sumsubShareToken or personaShareToken. Pass these fields to proceed.',
      }, { status: response.status });
    }

    // Save cardholder ID to kyc table
    const cardholderId = data.id || data.userId;
    if (walletAddress && cardholderId) {
      await supabase
        .from('kyc')
        .update({ codego_cardholder_id: cardholderId })
        .eq('wallet_address', walletAddress.toLowerCase());
    }

    return NextResponse.json({ ...data, cardholderId });
  } catch (error: any) {
    console.error('[Codego applications] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// GET /applications/{id} — check application status
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id query param required' }, { status: 400 });
  }

  const response = await fetch(`${CODEGO_API_URL}/applications/${id}`, {
    headers: codegoHeaders,
  });

  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}
