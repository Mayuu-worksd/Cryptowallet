/**
 * /api/cards/[id]/transactions/route.ts
 *
 * Generic provider-independent route to get card transactions.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCardProvider } from '@/lib/providers';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: providerCardId } = await params;
  const { searchParams }     = new URL(req.url);

  if (!providerCardId) {
    return NextResponse.json({ error: 'Card ID is required' }, { status: 400 });
  }

  const provider = getCardProvider();
  const result   = await provider.getTransactions(providerCardId, {
    limit: 50,
  });

  return NextResponse.json({
    transactions: result.transactions,
    source:       result.source,
    seeded:       result.seeded ?? false,
    note:         result.note,
  });
}
