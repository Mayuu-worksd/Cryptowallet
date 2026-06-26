/**
 * /api/fiat/deposit/route.ts
 *
 * Generic provider-independent route to deposit fiat.
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
      sandbox_note: 'POST /transfers/outgoing may not be available in provider sandbox. Fiat deposits are admin-managed.',
    });

  } catch (error: any) {
    console.error('[/api/fiat/deposit] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
