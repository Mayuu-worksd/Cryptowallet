/**
 * /api/admin/test-kripicard — DEBUG ONLY, delete after use
 */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const apiKey = process.env.KRIPICARD_API_KEY || '';
  const baseUrl = process.env.KRIPICARD_BASE_URL || 'https://appapi.kripicard.com';

  if (!apiKey) return NextResponse.json({ error: 'KRIPICARD_API_KEY not set' }, { status: 500 });

  const results: Record<string, any> = {
    env: { baseUrl, apiKeySet: !!apiKey, apiKeyPrefix: apiKey.slice(0, 8) + '...' },
  };

  // 1. createcard with amount=10
  try {
    const res = await fetch(`${baseUrl}/api/external/cards/createcard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, bin: '441357', amount: 10, name_on_card: 'TEST USER', email: 'test@kripicard.user' }),
    });
    let body: any;
    try { body = await res.json(); } catch { body = await res.text(); }
    results.createcard = { status: res.status, body };

    // 2. carddetails on newly created card
    if (body?.success && body?.card_id) {
      try {
        const dRes = await fetch(`${baseUrl}/api/external/cards/carddetails`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: apiKey, card_id: body.card_id }),
        });
        let dBody: any;
        try { dBody = await dRes.json(); } catch { dBody = await dRes.text(); }
        results.carddetails_new = { status: dRes.status, body: dBody };
      } catch (e: any) { results.carddetails_new = { error: e.message }; }
    }
  } catch (e: any) { results.createcard = { error: e.message }; }

  // 3. carddetails on existing card 34350
  try {
    const res = await fetch(`${baseUrl}/api/external/cards/carddetails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, card_id: '34350' }),
    });
    let body: any;
    try { body = await res.json(); } catch { body = await res.text(); }
    results.carddetails_34350 = { status: res.status, body };
  } catch (e: any) { results.carddetails_34350 = { error: e.message }; }

  // 4. list all cards
  try {
    const res = await fetch(`${baseUrl}/api/external/cards/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey }),
    });
    let body: any;
    try { body = await res.json(); } catch { body = await res.text(); }
    results.listcards = { status: res.status, body };
  } catch (e: any) { results.listcards = { error: e.message }; }

  return NextResponse.json(results, { status: 200 });
}
