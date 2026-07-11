/**
 * /api/admin/test-kripicard
 * GET: Test raw KripiCard API — shows exactly what the API returns for createcard + carddetails
 * DELETE THIS FILE after debugging is done.
 */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const apiKey = process.env.KRIPICARD_API_KEY || '';
  const baseUrl = process.env.KRIPICARD_BASE_URL || 'https://appapi.kripicard.com';

  if (!apiKey) {
    return NextResponse.json({ error: 'KRIPICARD_API_KEY not set in env' }, { status: 500 });
  }

  const results: Record<string, any> = {
    env: {
      baseUrl,
      apiKeySet: !!apiKey,
      apiKeyPrefix: apiKey.slice(0, 8) + '...',
    },
  };

  // Step 1: Try createcard
  try {
    const createRes = await fetch(`${baseUrl}/api/external/cards/createcard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        bin: '441357',
        amount: 1,
        name_on_card: 'TEST USER',
        email: 'test@kripicard.user',
      }),
    });
    const createStatus = createRes.status;
    let createBody: any;
    try { createBody = await createRes.json(); } catch { createBody = await createRes.text(); }
    results.createcard = { status: createStatus, body: createBody };

    // Step 2: If card created, try carddetails
    if (createBody?.success && createBody?.card_id) {
      try {
        const detailRes = await fetch(`${baseUrl}/api/external/cards/carddetails`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: apiKey, card_id: createBody.card_id }),
        });
        let detailBody: any;
        try { detailBody = await detailRes.json(); } catch { detailBody = await detailRes.text(); }
        results.carddetails = { status: detailRes.status, body: detailBody };
      } catch (e: any) {
        results.carddetails = { error: e.message };
      }
    }
  } catch (e: any) {
    results.createcard = { error: e.message };
  }

  // Step 3: Try list cards
  try {
    const listRes = await fetch(`${baseUrl}/api/external/cards/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey }),
    });
    let listBody: any;
    try { listBody = await listRes.json(); } catch { listBody = await listRes.text(); }
    results.listcards = { status: listRes.status, body: listBody };
  } catch (e: any) {
    results.listcards = { error: e.message };
  }

  return NextResponse.json(results, { status: 200 });
}
