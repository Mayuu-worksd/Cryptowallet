/**
 * /api/codego/fiat/deposit/route.ts
 *
 * URL and response shape IDENTICAL to before.
 * Delegates to CodegoProvider.depositFiat().
 *
 * Backward compatibility: ✅ 100%
 */
import { NextResponse } from 'next/server';
import { getCardProvider } from '@/lib/providers';

export async function POST(request: Request) {
  try {
    const { walletAddress, cardId, amount, currency } = await request.json();

    if (!walletAddress || !amount) {
      return NextResponse.json({ error: 'walletAddress and amount are required' }, { status: 400 });
    }

    const provider = getCardProvider();
    const result = await provider.depositFiat({
      walletAddress,
      cardId,
      amount: parseFloat(amount),
      currency: currency || 'USD'
    });

    if (!result.depositRecord) {
        return NextResponse.json({ error: 'Failed to create deposit record' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deposit: result.depositRecord,
      paymentInstructions: result.paymentInstructions,
      sandbox_note: 'POST /transfers/outgoing is not available in Codego sandbox. Fiat deposits are admin-managed.',
    });

  } catch (error: any) {
    console.error('[Fiat deposit] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
