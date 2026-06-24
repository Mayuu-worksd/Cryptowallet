import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(request: Request) {
  try {
    const { cardId, action, trackingNumber } = await request.json();

    if (!cardId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let newStatus = action;
    const updateData = { 
      physical_shipping_status: newStatus,
      ...(trackingNumber !== undefined && { tracking_number: trackingNumber })
    };

    const { data, error } = await supabase
      .from('vcc_cards')
      .update(updateData)
      .eq('id', cardId)
      .select()
      .single();

    if (error) {
      console.error(`Error updating vcc_cards:`, error);
      return NextResponse.json({ error: 'Failed to update record' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('Error processing physical card action:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
