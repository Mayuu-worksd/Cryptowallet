import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateObj: any = {};
    if (body.currency !== undefined) updateObj.currency_code = body.currency;
    if (body.currency_code !== undefined) updateObj.currency_code = body.currency_code;
    if (body.network !== undefined) updateObj.network_name = body.network;
    if (body.network_name !== undefined) updateObj.network_name = body.network_name;
    if (body.contractAddress !== undefined) updateObj.contract_address = body.contractAddress;
    if (body.contract_address !== undefined) updateObj.contract_address = body.contract_address;
    if (body.decimals !== undefined) updateObj.decimals = Number(body.decimals);
    if (body.enabled !== undefined) updateObj.is_enabled = !!body.enabled;
    if (body.is_enabled !== undefined) updateObj.is_enabled = !!body.is_enabled;

    updateObj.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('token_contracts')
      .update(updateObj)
      .eq('id', id)
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

    return NextResponse.json(formatted);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error } = await supabase
      .from('token_contracts')
      .delete()
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
