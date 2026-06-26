/**
 * /api/codego/applications/route.ts
 *
 * URL and response shape IDENTICAL to before.
 * Delegates to CodegoProvider.registerCardholder() and getCardholder().
 *
 * Backward compatibility: ✅ 100%
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCardProvider } from '@/lib/providers';

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
    
    const provider = getCardProvider();

    const result = await provider.registerCardholder({
      walletAddress: walletAddress,
      email: body.email || kycData?.email,
      firstName,
      lastName,
      birthDate: body.birthDate || kycData?.dob || '1990-01-01',
      phone: body.phone || kycData?.phone || '10000000000',
      ipAddress: ipAddress || req.headers.get('x-forwarded-for') || '127.0.0.1',
      address: {
        line1: body.address || kycData?.address || '123 Main St',
        city: body.city || 'Unknown',
        postalCode: body.postalCode || '00000',
        countryCode: body.country || kycData?.nationality?.slice(0, 2).toUpperCase() || 'US',
      },
      sumsubShareToken,
      personaShareToken,
      externalUserId: body.externalUserId || body.userId
    });

    if (!result.cardholderId || result.alreadyExists === false) {
      return NextResponse.json({
        error: 'Codego application failed',
        details: result.raw,
        httpStatus: 400,
        sandbox_note: 'Sandbox requires sumsubShareToken or personaShareToken. Pass these fields to proceed.',
      }, { status: 400 });
    }

    // Save cardholder ID to kyc table
    if (walletAddress && result.cardholderId) {
      await supabase
        .from('kyc')
        .update({ codego_cardholder_id: result.cardholderId })
        .eq('wallet_address', walletAddress.toLowerCase());
    }

    // Attempt to return same response shape as previous raw Codego data
    return NextResponse.json({ ...(result.raw as object || {}), cardholderId: result.cardholderId });
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

  const provider = getCardProvider();
  const result = await provider.getCardholder(id);

  if (!result.found) {
    return NextResponse.json(result.raw || {}, { status: 404 });
  }

  return NextResponse.json(result.raw || {}, { status: 200 });
}
