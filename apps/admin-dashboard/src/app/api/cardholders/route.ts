/**
 * /api/cardholders/route.ts
 *
 * Generic provider-independent route to register or lookup a cardholder.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCardProvider } from '@/lib/providers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
    }

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

    if (kycData.codego_cardholder_id) {
      return NextResponse.json({
        message: 'User already mapped to provider',
        cardholderId: kycData.codego_cardholder_id,
        alreadyExists: true,
      });
    }

    const provider = getCardProvider();
    
    const nameParts = (kycData.full_name || 'Unknown User').trim().split(' ');
    const firstName = nameParts[0] || 'Unknown';
    const lastName = nameParts.slice(1).join(' ') || 'User';

    const result = await provider.registerCardholder({
      walletAddress: walletAddress,
      email: kycData.email || '',
      firstName,
      lastName,
      birthDate: kycData.dob || '1990-01-01',
      phone: kycData.phone || '10000000000',
      phoneCountryCode: '1',
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      address: {
        line1: kycData.address || '123 Main St',
        city: 'Unknown',
        postalCode: '00000',
        countryCode: kycData.nationality?.slice(0, 2).toUpperCase() || 'US',
      },
      nationalId: '123456789', // Sandbox requirement
      countryOfIssue: kycData.nationality?.slice(0, 2).toUpperCase() || 'US',
    });

    if (!result.cardholderId || result.alreadyExists === false) {
       return NextResponse.json({
        error: 'Provider application submission failed',
        details: result.raw,
        httpStatus: 400,
        note: 'Provider application failed.',
      }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from('kyc')
      .update({ codego_cardholder_id: result.cardholderId })
      .eq('wallet_address', walletAddress.toLowerCase());

    if (updateError) {
      console.error('[/api/cardholders] Failed to update kyc.codego_cardholder_id:', updateError.message);
    }

    return NextResponse.json({
      message: 'Provider application submitted successfully',
      cardholderId: result.cardholderId,
      externalUserId: result.externalUserId,
    });
  } catch (error: any) {
    console.error('[/api/cardholders] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

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
    return NextResponse.json({ cardholderId: null, message: 'Not yet mapped to provider' });
  }

  const provider = getCardProvider();
  const holderStatus = await provider.getCardholder(kycData.codego_cardholder_id);

  return NextResponse.json({
    cardholderId: kycData.codego_cardholder_id,
    providerStatus: holderStatus.found ? 'found' : 'not_found',
    providerData: holderStatus.found ? holderStatus.raw : null,
  });
}
