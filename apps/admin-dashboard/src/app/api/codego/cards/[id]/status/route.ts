/**
 * /api/codego/cards/[id]/status/route.ts
 *
 * URL and response shape IDENTICAL to before.
 * Delegates freeze/unfreeze/block to CodegoProvider.
 *
 * Backward compatibility: ✅ 100%
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCardProvider } from '@/lib/providers';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const body = await req.json();
  const { status } = body;
  const { id: codegoCardId } = await params;

  if (!status || !codegoCardId) {
    return NextResponse.json({ error: 'status and id are required' }, { status: 400 });
  }

  const accepted = ['active', 'frozen', 'blocked', 'locked', 'canceled'];
  if (!accepted.includes(status)) {
    return NextResponse.json(
      { error: 'Invalid status. Accepted: active, frozen, blocked' },
      { status: 400 },
    );
  }

  const provider = getCardProvider();
  let result;

  switch (status) {
    case 'active':
      result = await provider.unfreezeCard(codegoCardId);
      break;
    case 'blocked':
    case 'canceled':
      result = await provider.blockCard(codegoCardId);
      break;
    default: // frozen / locked
      result = await provider.freezeCard(codegoCardId);
  }

  return NextResponse.json({
    message:        'Card status updated successfully',
    codegoStatus:   result.providerStatus,
    internalStatus: result.internalStatus,
  });
}
