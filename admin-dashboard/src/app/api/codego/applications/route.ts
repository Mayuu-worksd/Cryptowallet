import { NextRequest, NextResponse } from 'next/server';

const CODEGO_API_KEY = process.env.CODEGO_API_KEY || 'vcck_sbx_f119144ea2221e4796778de28115c4cad97429da86e66552';
const CODEGO_API_URL = process.env.CODEGO_API_URL || 'https://vcc-sandbox.codegotech.com/api/v1';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Map existing KYC data to Codego application format
    const codegoPayload = {
      externalUserId: body.userId,
      applicantType: 'individual',
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      // Pass other necessary existing KYC data
      ...body
    };

    const response = await fetch(`${CODEGO_API_URL}/applications`, {
      method: 'POST',
      headers: {
        'X-Api-Key': CODEGO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(codegoPayload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Codego application error:', errorData);
      return NextResponse.json(
        { error: 'Failed to create Codego application', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating Codego application:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
