/**
 * /api/codego/fiat/withdraw/route.ts
 *
 * URL and response shape IDENTICAL to before.
 * Delegates to CodegoProvider.withdrawFiat().
 *
 * Backward compatibility: ✅ 100%
 */
import { NextResponse } from 'next/server';
import { getCardProvider } from '@/lib/providers';

export async function POST(request: Request) {
  try {
    const { walletAddress, cardId, amount, currency, destinationIban, destinationBic, destinationName } = await request.json();

    if (!walletAddress || !amount || !destinationIban || !destinationBic || !destinationName) {
      return NextResponse.json({ error: 'Missing required fields: walletAddress, amount, destinationIban, destinationBic, destinationName' }, { status: 400 });
    }

    const provider = getCardProvider();
    const result = await provider.withdrawFiat({
        walletAddress,
        cardId,
        amount: parseFloat(amount),
        currency: currency || 'USD',
        destinationIban,
        destinationBic,
        destinationName
    });

    if (!result.withdrawalRecord) {
      return NextResponse.json({ error: 'Failed to create withdrawal record' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      withdrawal: result.withdrawalRecord,
      processedViaCodego: result.processedViaProvider,
      sandbox_note: result.sandboxNote,
    });

  } catch (error: any) {
    console.error('[Fiat withdraw] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
