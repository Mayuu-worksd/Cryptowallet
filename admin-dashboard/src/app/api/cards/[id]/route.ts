/**
 * /api/cards/[id]/route.ts
 *
 * GET: Retrieve live card details from the active provider (KripiCard) + local database record.
 * DELETE: Soft terminate card (freeze card and update status to terminated).
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const provider = getCardProvider();
  const { id: cardId } = await params;

  try {
    ProviderLogger.info(provider.name, `GET /api/cards/${cardId}`, 'Fetching live card details');
    const liveCard = await provider.getCardDetails(cardId);

    const { data: dbCard } = await supabase
      .from('vcc_cards')
      .select('*')
      .eq('codego_card_id', cardId)
      .maybeSingle();

    return NextResponse.json(
      createSuccessResponse({
        card: liveCard,
        dbRecord: dbCard,
      }, provider.name)
    );
  } catch (error: any) {
    const normalized = normalizeProviderError(error, provider.name);
    ProviderLogger.error(provider.name, `GET /api/cards/${cardId}`, normalized.message, normalized);
    return NextResponse.json(
      createErrorResponse(normalized, provider.name),
      { status: normalized.statusCode || 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const provider = getCardProvider();
  const { id: cardId } = await params;

  try {
    ProviderLogger.info(provider.name, `DELETE /api/cards/${cardId}`, 'Soft-terminating card');
    const result = await provider.deleteCard(cardId);

    await supabase
      .from('vcc_cards')
      .update({ card_status: 'terminated' })
      .eq('codego_card_id', cardId);

    await supabase
      .from('provider_cards')
      .update({ status: 'terminated' })
      .eq('provider_card_id', cardId);

    return NextResponse.json(
      createSuccessResponse({
        success: true,
        message: 'Card terminated successfully via freeze',
        providerCardId: cardId,
        status: 'terminated',
      }, provider.name)
    );
  } catch (error: any) {
    const normalized = normalizeProviderError(error, provider.name);
    ProviderLogger.error(provider.name, `DELETE /api/cards/${cardId}`, normalized.message, normalized);
    return NextResponse.json(
      createErrorResponse(normalized, provider.name),
      { status: normalized.statusCode || 500 }
    );
  }
}
