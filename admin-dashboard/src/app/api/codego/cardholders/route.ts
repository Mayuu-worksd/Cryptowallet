import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const CODEGO_API_KEY = process.env.CODEGO_API_KEY || 'vcck_sbx_f119144ea2221e4796778de28115c4cad97429da86e66552';
const CODEGO_API_URL = process.env.CODEGO_API_URL || 'https://vcc-sandbox.codegotech.com/api/v1';

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
      .single();

    if (kycError || !kycData) {
      return NextResponse.json({ error: 'User KYC not found' }, { status: 404 });
    }

    if (kycData.codego_cardholder_id) {
      return NextResponse.json({ message: 'User is already a Codego cardholder', cardholderId: kycData.codego_cardholder_id });
    }

    // 2. Create Cardholder in Codego
    const response = await fetch(`${CODEGO_API_URL}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CODEGO_API_KEY}`
      },
      body: JSON.stringify({
        email: kycData.email,
        firstName: kycData.first_name || kycData.full_name?.split(' ')[0] || 'User',
        lastName: kycData.last_name || kycData.full_name?.split(' ').slice(1).join(' ') || 'Unknown',
        address: {
          line1: kycData.address || '123 Test St',
          city: kycData.city || 'Test City',
          postalCode: kycData.postal_code || '00000',
          country: kycData.country || 'US'
        },
        dateOfBirth: kycData.date_of_birth || '1990-01-01',
        phone: kycData.phone_number || '+10000000000'
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Codego cardholder creation error:', errorData);
      return NextResponse.json({ error: 'Failed to create Codego cardholder', details: errorData }, { status: response.status });
    }

    const codegoUser = await response.json();

    // 3. Update KYC table
    await supabase
      .from('kyc')
      .update({ codego_cardholder_id: codegoUser.id })
      .eq('wallet_address', walletAddress.toLowerCase());

    return NextResponse.json({ message: 'Cardholder created successfully', cardholderId: codegoUser.id });
  } catch (error: any) {
    console.error('Error creating Codego cardholder:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
