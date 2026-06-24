import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const codegoCardId = resolvedParams.id;
    if (!codegoCardId) {
      return NextResponse.json({ error: 'Missing Card ID' }, { status: 400 });
    }

    // Optional: Get start/end dates from searchParams
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // Build Codego URL
    let codegoUrl = `https://vcc-sandbox.codegotech.com/api/v1/cards/${codegoCardId}/statement`;
    if (startDate || endDate) {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      codegoUrl += `?${params.toString()}`;
    }

    const codegoApiKey = process.env.CODEGO_API_KEY!;
    if (!codegoApiKey) {
      return NextResponse.json({ error: 'Server misconfiguration: missing API key' }, { status: 500 });
    }

    // Make request to Codego
    const response = await fetch(codegoUrl, {
      method: 'GET',
      headers: {
        'X-Api-Key': codegoApiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Codego statement fetch error:', errorText);
      return NextResponse.json({ error: 'Failed to fetch statement from Codego' }, { status: response.status });
    }

    const statementData = await response.json();
    return NextResponse.json(statementData);

  } catch (error: any) {
    console.error('Error fetching card statement:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
