import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const CODEGO_API_KEY = process.env.CODEGO_API_KEY || 'vcck_sbx_f119144ea2221e4796778de28115c4cad97429da86e66552';
const CODEGO_API_URL = process.env.CODEGO_API_URL || 'https://vcc-sandbox.codegotech.com/api/v1';

const codegoHeaders = {
  'X-Api-Key': CODEGO_API_KEY,
  'Content-Type': 'application/json',
};

function formatBirthDate(dobStr: string | null | undefined): string {
  if (!dobStr) return '1990-01-01';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dobStr)) return dobStr;
  const parts = dobStr.split(/[-/]/);
  if (parts.length === 3) {
    let year = '';
    let month = '';
    let day = '';
    if (parts[2].length === 4) {
      year = parts[2];
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      if (p0 > 12) {
        day = String(p0).padStart(2, '0');
        month = String(p1).padStart(2, '0');
      } else {
        month = String(p0).padStart(2, '0');
        day = String(p1).padStart(2, '0');
      }
    } else if (parts[0].length === 4) {
      year = parts[0];
      month = String(parts[1]).padStart(2, '0');
      day = String(parts[2]).padStart(2, '0');
    }
    if (year && month && day) return `${year}-${month}-${day}`;
  }
  return '1990-01-01';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
    }

    // 1. Fetch KYC record
    const { data: kycData, error: kycError } = await supabase
      .from('kyc')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .maybeSingle();

    if (kycError || !kycData) {
      return NextResponse.json({ error: 'KYC record not found for this wallet' }, { status: 404 });
    }

    let codegoCardholderId = kycData.codego_cardholder_id;

    // 2. If not yet mapped to Codego, register the application first
    if (!codegoCardholderId) {
      const nameParts = (kycData.full_name || 'Unknown User').trim().split(' ');
      const firstName = nameParts[0] || 'Unknown';
      const lastName = nameParts.slice(1).join(' ') || 'User';
      const externalUserId = `cw_${walletAddress.toLowerCase().replace('0x', '').slice(0, 16)}`;
      const email = kycData.email || `${externalUserId}@example.com`;

      console.log(`[Sandbox KYC Helper] Creating Codego application for ${walletAddress}`);

      const appRes = await fetch(`${CODEGO_API_URL}/applications`, {
        method: 'POST',
        headers: codegoHeaders,
        body: JSON.stringify({
          walletAddress: walletAddress.toLowerCase(),
          email,
          firstName,
          lastName,
          birthDate: formatBirthDate(kycData.dob),
          phoneNumber: (kycData.phone || '10000000000').replace(/\D/g, ''),
          phoneCountryCode: '1',
          ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
          address: {
            line1: kycData.address || '123 Main St',
            city: 'Unknown',
            postalCode: '00000',
            countryCode: kycData.nationality?.slice(0, 2).toUpperCase() || 'US',
          },
          nationalId: '123456789',
          countryOfIssue: kycData.nationality?.slice(0, 2).toUpperCase() || 'US',
          key: CODEGO_API_KEY,
        }),
      });

      if (!appRes.ok) {
        const errData = await appRes.json().catch(() => ({}));
        console.error('[Sandbox KYC Helper] Codego application failed:', appRes.status, errData);
        return NextResponse.json({
          error: 'Failed to create application on Codego',
          details: errData,
        }, { status: appRes.status });
      }

      const appData = await appRes.json();
      codegoCardholderId = appData.id || appData.userId || externalUserId;

      // Update local KYC record
      await supabase
        .from('kyc')
        .update({ codego_cardholder_id: codegoCardholderId })
        .eq('wallet_address', walletAddress.toLowerCase());
    }

    // 3. Request Sandbox KYC session from Codego
    console.log(`[Sandbox KYC Helper] Fetching KYC session for ${codegoCardholderId}`);
    const sessionRes = await fetch('https://kyc-sandbox.codegotech.com/api/session/create', {
      method: 'POST',
      headers: {
        'X-Api-Key': CODEGO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        externalUserId: codegoCardholderId,
        applicantType: 'individual',
        email: kycData.email || 'user@example.com',
        returnUrl: 'https://cryptowallet-dun.vercel.app',
      }),
    });

    if (!sessionRes.ok) {
      const errData = await sessionRes.json().catch(() => ({}));
      console.error('[Sandbox KYC Helper] KYC Session creation failed:', sessionRes.status, errData);
      return NextResponse.json({
        error: 'Failed to generate KYC session on Codego Sandbox',
        details: errData,
      }, { status: sessionRes.status });
    }

    const sessionData = await sessionRes.json();

    return NextResponse.json({
      success: true,
      cardholderId: codegoCardholderId,
      iframeUrl: sessionData.iframeUrl,
      sessionId: sessionData.sessionId,
    });
  } catch (error: any) {
    console.error('[Sandbox KYC Helper] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
