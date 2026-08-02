import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Endpoint: GET /api/admin/kyc/unsanctioned_cards
// Returns a list of cards that exist but whose sandbox KYC is not approved.
// This helps admins identify users who managed to create a virtual card without completing the sandbox KYC.

export async function GET() {
  // 1. Fetch cards from Supabase that have a CodeGo card ID.
  const { data: cards, error } = await supabase
    .from('vcc_cards')
    .select('id, codego_card_id, card_status, codego_status')
    .not('codego_card_id', 'is', null);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch cards from Supabase' }, { status: 500 });
  }

  // 2. Filter cards where sandbox status is not approved.
  // In our system, approved status is represented by codego_status === 'approved'.
  const unsanctioned = cards?.filter((c) => c.codego_status !== 'approved') || [];

  return NextResponse.json({ unsanctionedCards: unsanctioned }, { status: 200 });
}
