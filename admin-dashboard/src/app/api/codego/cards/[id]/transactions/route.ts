import { NextRequest, NextResponse } from 'next/server';

const CODEGO_API_KEY = process.env.CODEGO_API_KEY || 'vcck_sbx_f119144ea2221e4796778de28115c4cad97429da86e66552';
const CODEGO_API_URL = process.env.CODEGO_API_URL || 'https://vcc-sandbox.codegotech.com/api/v1';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const codegoCardId = resolvedParams.id;

    if (!codegoCardId) {
      return NextResponse.json({ error: 'Card ID is required' }, { status: 400 });
    }

    // Fetch Transactions from Codego
    const response = await fetch(`${CODEGO_API_URL}/cards/${codegoCardId}/transactions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CODEGO_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Codego card transactions fetch error:', errorData);
      return NextResponse.json({ error: 'Failed to fetch Codego card transactions', details: errorData }, { status: response.status });
    }

    const transactions = await response.json();

    return NextResponse.json({ transactions });
  } catch (error: any) {
    console.error('Error fetching Codego card transactions:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
