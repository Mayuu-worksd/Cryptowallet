import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function getSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase environment variables are missing');
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

export async function POST(request: Request) {
  try {
    const { requestId, type, action, source, adminNotes, cryptoAmount } = await request.json();

    if (!requestId || !type || !action || !source) {
      return NextResponse.json({ error: 'Missing required fields: requestId, type, action, source' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    let data = null;
    let error = null;

    if (source !== 'codego') {
      // For legacy (fiat-crypto requests), use the database RPC function to process the request
      // (which credits user's token balance, updates transactions, and ledger records)
      const rpcParams = {
        p_request_id: requestId,
        p_action: action, // 'under_review', 'approve', 'reject', 'complete'
        p_crypto_amount: cryptoAmount ? parseFloat(cryptoAmount) : null,
        p_admin_notes: adminNotes || null
      };

      console.log('[Fiat queues action] Invoking admin_process_fiat_request RPC:', rpcParams);
      const res = await supabase.rpc('admin_process_fiat_request', rpcParams);
      data = res.data;
      error = res.error;
    } else {
      // For Codego fiat deposits/withdrawals, update the record directly in the respective table
      const table = type === 'deposit' ? 'fiat_deposits' : 'fiat_withdrawals';
      let newStatus = 'pending';

      if (action === 'approve' || action === 'complete') {
        newStatus = 'completed';
      } else if (action === 'reject') {
        newStatus = 'failed';
      } else if (action === 'under_review') {
        newStatus = 'processing';
      }

      console.log(`[Fiat queues action] Updating table ${table} directly for Codego fiat request: status = ${newStatus}`);
      const { data: updatedData, error: updateError } = await supabase
        .from(table)
        .update({ status: newStatus })
        .eq('id', requestId)
        .select()
        .single();
      
      data = updatedData;
      error = updateError;
    }

    if (error) {
      console.error('[Fiat queues action] Supabase error:', error);
      return NextResponse.json({ error: error.message || 'Failed to update record' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('Error processing fiat action:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
