/**
 * /api/cards/[id]/pin/route.ts
 *
 * Generic provider-independent route to update card PIN.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCardProvider } from '@/lib/providers';

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: providerCardId } = await context.params;
  const body = await req.json();
  const { newPin, walletAddress } = body;

  if (!newPin || !/^\d{4}$/.test(newPin)) {
    return NextResponse.json({ error: 'Valid 4-digit PIN required' }, { status: 400 });
  }

  const provider = getCardProvider();
  const result   = await provider.setPin(providerCardId, newPin);

  // Audit log
  if (walletAddress || providerCardId) {
    try {
      const { data: vccCard } = await supabase
        .from('vcc_cards')
        .select('id')
        .eq('codego_card_id', providerCardId)
        .maybeSingle();

      if (vccCard?.id) {
        const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
        await supabase.from('codego_card_pin_audits').insert({
          card_id:    vccCard.id,
          ip_address: clientIp,
        });
      }
    } catch (e) {
      console.warn('[/api/cards/[id]/pin] Audit log failed:', e);
    }
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: result.message });
}
