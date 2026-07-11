/**
 * /api/cards/[id]/sync/route.ts
 *
 * POST: Sync live card status, balance, and details from KripiCard provider into Supabase.
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
    ProviderLogger.info(provider.name, `POST /api/cards/${cardId}/sync`, 'Syncing card with live provider');
    const liveCard = await provider.getCard(cardId);

    if (!liveCard) {
      return NextResponse.json(
        createErrorResponse({
          code: 'CARD_NOT_FOUND_ON_PROVIDER',
          message: `Card ${cardId} not found on provider ${provider.name}`,
          statusCode: 404,
        }, provider.name),
        { status: 404 }
      );
    }

    const liveBalance = Number((liveCard.raw as any)?.balance || 0);
    const updates = {
      card_status: liveCard.status,
      codego_status: liveCard.providerStatus || liveCard.status,
      balance: liveBalance,
    };

    await supabase
      .from('vcc_cards')
      .update(updates)
      .eq('codego_card_id', cardId);

    await supabase
      .from('provider_cards')
      .update({
        status: liveCard.status,
        provider_status: liveCard.providerStatus || liveCard.status,
        balance: liveBalance,
        provider_response: liveCard.raw || {},
      })
      .eq('provider_card_id', cardId);

    return NextResponse.json(
      createSuccessResponse({
        success: true,
        cardId,
        synced: liveCard,
      }, provider.name)
    );
  } catch (error: any) {
    const normalized = normalizeProviderError(error, provider.name);
    ProviderLogger.error(provider.name, `POST /api/cards/${cardId}/sync`, normalized.message, normalized);
    return NextResponse.json(
      createErrorResponse(normalized, provider.name),
      { status: normalized.statusCode || 500 }
    );
  }
}
