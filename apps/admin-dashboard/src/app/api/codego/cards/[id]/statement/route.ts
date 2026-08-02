/**
 * /api/codego/cards/[id]/statement/route.ts
 *
 * URL and response shape IDENTICAL to before.
 * Delegates to CodegoProvider.getStatement().
 *
 * Backward compatibility: ✅ 100%
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCardProvider } from '@/lib/providers';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: codegoCardId } = await params;
  if (!codegoCardId) {
    return NextResponse.json({ error: 'Missing Card ID' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start_date') ?? undefined;
  const endDate   = searchParams.get('end_date')   ?? undefined;

  const provider = getCardProvider();
  const result   = await provider.getStatement(codegoCardId, { startDate, endDate });

  // Return the same shape as the original route
  if (result.source === 'provider') {
    return NextResponse.json({ ...(result as any).raw, source: 'codego' });
  }

  return NextResponse.json({
    cardId:       codegoCardId,
    holderName:   result.holderName,
    balance:      result.balance,
    transactions: result.transactions,
    source:       result.source,
    note:         result.note,
  });
}
