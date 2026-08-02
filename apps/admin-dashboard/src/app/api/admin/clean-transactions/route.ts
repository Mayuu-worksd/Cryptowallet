import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST — delete duplicate card_topup/card_spend rows, keep only 1 per unique combo
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { walletAddress } = body;

    let query = supabase
      .from('transactions')
      .select('id, wallet_address, type, amount, token, created_at, reference_id')
      .in('type', ['card_topup', 'card_spend'])
      .order('created_at', { ascending: true });

    if (walletAddress) {
      query = (query as any).eq('wallet_address', walletAddress.toLowerCase());
    }

    const { data: rows, error } = await query;
    if (error) throw error;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ deleted: 0, message: 'No card transactions found' });
    }

    const seen = new Map<string, string>();
    const toDelete: string[] = [];

    for (const row of rows) {
      const key = row.reference_id
        ? `ref:${row.reference_id}`
        : `${row.wallet_address}:${row.type}:${row.amount}:${row.token}:${row.created_at}`;

      if (seen.has(key)) {
        toDelete.push(row.id);
      } else {
        seen.set(key, row.id);
      }
    }

    if (toDelete.length === 0) {
      return NextResponse.json({ deleted: 0, message: 'No duplicates found — already clean' });
    }

    // Delete in batches of 100
    let totalDeleted = 0;
    for (let i = 0; i < toDelete.length; i += 100) {
      const batch = toDelete.slice(i, i + 100);
      const { error: delError } = await supabase
        .from('transactions')
        .delete()
        .in('id', batch);
      if (delError) throw delError;
      totalDeleted += batch.length;
    }

    return NextResponse.json({
      success: true,
      deleted: totalDeleted,
      remaining: rows.length - totalDeleted,
      message: `Deleted ${totalDeleted} duplicate transactions`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET — preview duplicates without deleting
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const walletAddress = searchParams.get('walletAddress');

  let query = supabase
    .from('transactions')
    .select('id, wallet_address, type, amount, token, created_at, label')
    .in('type', ['card_topup', 'card_spend'])
    .order('created_at', { ascending: true });

  if (walletAddress) {
    query = (query as any).eq('wallet_address', walletAddress.toLowerCase());
  }

  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const seen = new Map<string, string>();
  const duplicates: any[] = [];

  for (const row of (rows || [])) {
    const key = `${row.wallet_address}:${row.type}:${row.amount}:${row.token}:${row.created_at}`;
    if (seen.has(key)) {
      duplicates.push(row);
    } else {
      seen.set(key, row.id);
    }
  }

  return NextResponse.json({
    total: rows?.length ?? 0,
    duplicates: duplicates.length,
    preview: duplicates.slice(0, 20),
  });
}
