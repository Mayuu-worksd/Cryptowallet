/**
 * /api/cards/[id]/statement/route.ts
 *
 * Generic provider-independent route to get card statement.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCardProvider } from '@/lib/providers';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: providerCardId } = await params;
  if (!providerCardId) {
    return NextResponse.json({ error: 'Missing Card ID' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start_date') ?? undefined;
  const endDate   = searchParams.get('end_date')   ?? undefined;

  const provider = getCardProvider();
  const result   = await provider.getStatement(providerCardId, { startDate, endDate });

  if (result.source === 'provider') {
    return NextResponse.json({ ...(result as any).raw, source: 'provider' });
  }

  return NextResponse.json({
    cardId:       providerCardId,
    holderName:   result.holderName,
    balance:      result.balance,
    transactions: result.transactions,
    source:       result.source,
    note:         result.note,
  });
}
