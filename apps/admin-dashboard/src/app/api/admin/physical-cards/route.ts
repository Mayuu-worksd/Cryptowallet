import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: cards, error } = await supabase
      .from('vcc_cards')
      .select('*')
      .eq('is_physical', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedCards = (cards || []).map((c: any) => ({
      id: c.id,
      wallet_address: c.wallet_address,
      card_type: c.card_variant,
      country: c.shipping_address?.country || 'Unknown',
      shipping_address: c.shipping_address,
      activation_status: c.physical_shipping_status || 'not_requested',
      shipping_tracking_number: c.tracking_number, // The database doesn't have a tracking_number column in vcc_cards, but we'll try to map it if it exists.
      created_at: c.created_at,
      masked_pan: c.card_last4
    }));

    return NextResponse.json({ cards: formattedCards });
  } catch (error: any) {
    console.error('Error fetching physical cards:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
