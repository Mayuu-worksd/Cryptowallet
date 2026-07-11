/**
 * /api/admin/test-kripicard — DEBUG ONLY, delete after use
 * Tests all KripiCard API endpoints against card 34350
 */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const apiKey = process.env.KRIPICARD_API_KEY || '';
  const baseUrl = process.env.KRIPICARD_BASE_URL || 'https://appapi.kripicard.com';

  if (!apiKey) return NextResponse.json({ error: 'KRIPICARD_API_KEY not set' }, { status: 500 });

  const results: Record<string, any> = {
    env: { baseUrl, apiKeySet: !!apiKey, apiKeyPrefix: apiKey.slice(0, 8) + '...' },
  };

  const post = async (path: string, body: Record<string, any>) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, ...body }),
    });
    let data: any;
    try { data = await res.json(); } catch { data = await res.text(); }
    return { status: res.status, body: data };
  };

  const CARD_ID = '34350';

  // 1. List cards
  results.list = await post('/api/external/cards/list', {}).catch(e => ({ error: e.message }));

  // 2. Card details
  results.carddetails = await post('/api/external/cards/carddetails', { card_id: CARD_ID }).catch(e => ({ error: e.message }));

  // 3. Fund card
  results.fund = await post('/api/external/cards/fundcard', { card_id: CARD_ID, amount: 5 }).catch(e => ({ error: e.message }));

  // 4. Freeze card
  results.freeze = await post('/api/external/premium/Freeze_Unfreeze', { card_id: CARD_ID, action: 'freeze' }).catch(e => ({ error: e.message }));

  // 5. Unfreeze card
  results.unfreeze = await post('/api/external/premium/Freeze_Unfreeze', { card_id: CARD_ID, action: 'unfreeze' }).catch(e => ({ error: e.message }));

  // 6. Transactions
  results.transactions = await post('/api/external/cards/transactions', { card_id: CARD_ID }).catch(e => ({ error: e.message }));

  // 7. Delete card (soft)
  results.deletecard = await post('/api/external/cards/deletecard', { card_id: CARD_ID }).catch(e => ({ error: e.message }));

  // 8. Create card (will fail if insufficient balance — shows exact error)
  results.createcard = await post('/api/external/cards/createcard', {
    bin: '441357', amount: 10, name_on_card: 'TEST USER', email: 'test@kripicard.user',
  }).catch(e => ({ error: e.message }));

  return NextResponse.json(results, { status: 200 });
}
