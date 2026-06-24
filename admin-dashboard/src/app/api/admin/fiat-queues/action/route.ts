import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';

function getSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase environment variables are missing');
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

export async function POST(request: Request) {
  try {
    const { requestId, type, action, source } = await request.json();

    if (!requestId || !type || !action || !source) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let table = 'fiat_crypto_requests';
    if (source === 'codego') {
      table = type === 'deposit' ? 'fiat_deposits' : 'fiat_withdrawals';
    }

    let newStatus = 'pending';

    if (action === 'approve' || action === 'complete') {
      newStatus = source === 'codego' ? 'completed' : 'approved';
    } else if (action === 'reject') {
      newStatus = source === 'codego' ? 'failed' : 'rejected';
    } else if (action === 'under_review') {
      newStatus = source === 'codego' ? 'processing' : 'under_review';
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(table)
      .update({ status: newStatus })
      .eq('id', requestId)
      .select()
      .single();

    if (error) {
      console.error(`Error updating ${table}:`, error);
      return NextResponse.json({ error: 'Failed to update record' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('Error processing fiat action:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
