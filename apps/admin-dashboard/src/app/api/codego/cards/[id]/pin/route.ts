/**
 * /api/codego/cards/[id]/pin/route.ts
 *
 * URL and response shape IDENTICAL to before.
 * Delegates PIN update to CodegoProvider.
 * Audit log (codego_card_pin_audits) retained exactly as before.
 *
 * Backward compatibility: ✅ 100%
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCardProvider } from '@/lib/providers';

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: codegoCardId } = await context.params;
  const body = await req.json();
  const { newPin, walletAddress } = body;

  if (!newPin || !/^\d{4}$/.test(newPin)) {
    return NextResponse.json({ error: 'Valid 4-digit PIN required' }, { status: 400 });
  }

  const provider = getCardProvider();
  const result   = await provider.setPin(codegoCardId, newPin);

  // Audit log — identical to original implementation
  if (walletAddress || codegoCardId) {
    try {
      const { data: vccCard } = await supabase
        .from('vcc_cards')
        .select('id')
        .eq('codego_card_id', codegoCardId)
        .maybeSingle();

      if (vccCard?.id) {
        const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
        await supabase.from('codego_card_pin_audits').insert({
          card_id:    vccCard.id,
          ip_address: clientIp,
        });
      }
    } catch (e) {
      console.warn('[/api/codego/cards/[id]/pin] Audit log failed:', e);
    }
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: result.message });
}
