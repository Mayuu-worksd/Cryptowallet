import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

    // Sync to Codego if status is shipped and not already synced
    if (newStatus === 'shipped' && !data.codego_card_id) {
      try {
        const origin = new URL(request.url).origin;
        const codegoRes = await fetch(`${origin}/api/codego/cards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: data.wallet_address,
            type: 'physical',
            variant: data.card_variant,
            nameOnCard: data.card_holder_name,
          }),
        });
        
        const codegoResult = await codegoRes.json();
        if (!codegoRes.ok) {
          console.warn('[Physical Card Action] Codego physical card sync warning:', codegoResult.error || codegoResult);
        } else {
          console.log('[Physical Card Action] Codego physical card issued successfully:', codegoResult);
        }
      } catch (err) {
        console.error('[Physical Card Action] Error syncing physical card to Codego:', err);
      }
    }

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('Error processing physical card action:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
