/**
 * /api/cards/[id]/status/route.ts
 *
 * Generic provider-independent route to update card status (freeze, unfreeze, block).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCardProvider } from '@/lib/providers';
import { supabase } from '@/lib/supabase';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const body = await req.json();
  const { status } = body;
  const { id: providerCardId } = await params;

  if (!status || !providerCardId) {
    return NextResponse.json({ error: 'status and id are required' }, { status: 400 });
  }

  const accepted = ['active', 'frozen', 'blocked', 'locked', 'canceled'];
  if (!accepted.includes(status)) {
    return NextResponse.json(
      { error: 'Invalid status. Accepted: active, frozen, blocked' },
      { status: 400 },
    );
  }

  const provider = getCardProvider();
  let result;

  switch (status) {
    case 'active':
      result = await provider.unfreezeCard(providerCardId);
      break;
    case 'blocked':
    case 'canceled':
      result = await provider.blockCard(providerCardId);
      break;
    default: // frozen / locked
      result = await provider.freezeCard(providerCardId);
  }

  const normalizedStatus = status === 'locked' ? 'frozen' : status;
  try {
    await supabase
      .from('vcc_cards')
      .update({ card_status: normalizedStatus })
      .eq('codego_card_id', providerCardId);

    await supabase
      .from('provider_cards')
      .update({ status: normalizedStatus })
      .eq('provider_card_id', providerCardId);
  } catch (_e) {
    // Ignore database error if row missing
  }


  return NextResponse.json({
    message:        'Card status updated successfully',
    providerStatus: result.providerStatus,
    internalStatus: result.internalStatus,
  });
}
