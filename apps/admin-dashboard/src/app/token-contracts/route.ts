import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from('token_contracts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    // If the table doesn't exist yet, return seed placeholders as fallbacks
    if (error.code === 'PGRST116' || error.message.includes('relation') || error.message.includes('schema cache') || error.message.includes('does not exist')) {
      return NextResponse.json([
        {
          id: 'placeholder-usd',
          currency: 'USD',
          currency_code: 'USD',
          network: 'Polygon',
          network_name: 'Polygon',
          contractAddress: '',
          contract_address: '',
          decimals: 18,
          enabled: true,
          is_enabled: true
        },
        {
          id: 'placeholder-aed',
          currency: 'AED',
          currency_code: 'AED',
          network: 'Polygon',
          network_name: 'Polygon',
          contractAddress: '',
          contract_address: '',
          decimals: 18,
          enabled: false,
          is_enabled: false
        },
        {
          id: 'placeholder-pkr',
          currency: 'PKR',
          currency_code: 'PKR',
          network: 'Polygon',
          network_name: 'Polygon',
          contractAddress: '',
          contract_address: '',
          decimals: 18,
          enabled: false,
          is_enabled: false
        }
      ]);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Format to match both backend naming (snake_case) and expected API response format
  const formatted = (data || []).map(c => ({
    id: c.id,
    currency: c.currency_code,
    currency_code: c.currency_code,
    network: c.network_name,
    network_name: c.network_name,
    contractAddress: c.contract_address,
    contract_address: c.contract_address,
    decimals: c.decimals,
    enabled: c.is_enabled,
    is_enabled: c.is_enabled,
    created_at: c.created_at,
    updated_at: c.updated_at
  }));

  return NextResponse.json(formatted);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { currency, network, contractAddress, decimals, enabled } = body;

    const currency_code = currency || body.currency_code;
    const network_name = network || body.network_name;
    const contract_address = contractAddress !== undefined ? contractAddress : (body.contract_address || '');
    const decimals_val = decimals !== undefined ? Number(decimals) : (body.decimals !== undefined ? Number(body.decimals) : 18);
    const is_enabled = enabled !== undefined ? !!enabled : (body.is_enabled !== undefined ? !!body.is_enabled : true);

    if (!currency_code || !network_name) {
      return NextResponse.json({ error: 'Missing currency or network' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('token_contracts')
      .insert({
        currency_code,
        network_name,
        contract_address,
        decimals: decimals_val,
        is_enabled
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const formatted = {
      id: data.id,
      currency: data.currency_code,
      currency_code: data.currency_code,
      network: data.network_name,
      network_name: data.network_name,
      contractAddress: data.contract_address,
      contract_address: data.contract_address,
      decimals: data.decimals,
      enabled: data.is_enabled,
      is_enabled: data.is_enabled,
      created_at: data.created_at,
      updated_at: data.updated_at
    };

    return NextResponse.json(formatted, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
