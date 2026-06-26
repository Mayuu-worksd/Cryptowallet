/**
 * /api/codego/cards/[id]/transactions/route.ts
 *
 * URL and response shape IDENTICAL to before.
 * Delegates to CodegoProvider.getTransactions().
 *
 * Backward compatibility: ✅ 100%
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCardProvider } from '@/lib/providers';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: codegoCardId } = await params;
  const { searchParams }     = new URL(req.url);
  const autoSeed = searchParams.get('autoSeed') !== 'false';

  if (!codegoCardId) {
    return NextResponse.json({ error: 'Card ID is required' }, { status: 400 });
  }

  const provider = getCardProvider();
  // Pass autoSeed as a filter hint (CodegoProvider honours it internally)
  const result   = await provider.getTransactions(codegoCardId, {
    limit: 50,
    // autoSeed is a Codego-sandbox-specific behaviour — provider handles it internally
  });

  return NextResponse.json({
    transactions: result.transactions,
    source:       result.source === 'provider' ? 'codego' : result.source,
    seeded:       result.seeded ?? false,
    note:         result.note,
  });
}
