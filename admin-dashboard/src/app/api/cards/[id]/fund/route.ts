/**
 * /api/cards/[id]/fund/route.ts
 *
 * POST: Fund / top-up virtual card via active provider (KripiCard /Fund_Card endpoint).
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  getCardProvider,
  ProviderLogger,
  normalizeProviderError,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/providers';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const provider = getCardProvider();
  const { id: cardId } = await params;

  try {
    const body = await req.json();
    const amount = Number(body.amount);
    const currency = body.currency || 'USD';

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        createErrorResponse({
          code: 'INVALID_AMOUNT',
          message: 'Amount must be a positive number (minimum $1.00 for KripiCard top-up)',
          statusCode: 400,
        }, provider.name),
        { status: 400 }
      );
    }

    ProviderLogger.info(provider.name, `POST /api/cards/${cardId}/fund`, `Funding card with ${amount} ${currency}`);
    const result = await provider.fundVirtualCard(cardId, amount, currency);

    // Fetch existing balance or increment
    const { data: vcc } = await supabase
      .from('vcc_cards')
      .select('balance')
      .eq('codego_card_id', cardId)
      .maybeSingle();

    const currentBalance = Number(vcc?.balance || 0);
    const newBalance = currentBalance + amount;

    await supabase
      .from('vcc_cards')
      .update({ balance: newBalance })
      .eq('codego_card_id', cardId);

    await supabase
      .from('provider_cards')
      .update({ balance: newBalance })
      .eq('provider_card_id', cardId);

    return NextResponse.json(
      createSuccessResponse({
        success: true,
        cardId,
        fundedAmount: amount,
        newBalance,
        raw: result.raw,
      }, provider.name)
    );
  } catch (error: any) {
    const normalized = normalizeProviderError(error, provider.name);
    ProviderLogger.error(provider.name, `POST /api/cards/${cardId}/fund`, normalized.message, normalized);
    return NextResponse.json(
      createErrorResponse(normalized, provider.name),
      { status: normalized.statusCode || 500 }
    );
  }
}
