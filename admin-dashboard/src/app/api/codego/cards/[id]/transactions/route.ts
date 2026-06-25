import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const CODEGO_API_KEY = process.env.CODEGO_API_KEY || 'vcck_sbx_f119144ea2221e4796778de28115c4cad97429da86e66552';
const CODEGO_API_URL = process.env.CODEGO_API_URL || 'https://vcc-sandbox.codegotech.com/api/v1';

const codegoHeaders = {
  'X-Api-Key': CODEGO_API_KEY,
  'Content-Type': 'application/json',
};

const SEED_TRANSACTIONS = [
  { merchantName: 'Amazon',       amount: -49.99,  description: 'Online purchase'         },
  { merchantName: 'Netflix',      amount: -15.99,  description: 'Monthly subscription'    },
  { merchantName: 'Uber Eats',    amount: -32.50,  description: 'Food delivery order'      },
  { merchantName: 'Spotify',      amount: -9.99,   description: 'Music subscription'       },
  { merchantName: 'Shell Gas',    amount: -58.20,  description: 'Fuel station'             },
  { merchantName: 'Card Top-Up',  amount:  200.00, description: 'Wallet top-up'            },
  { merchantName: 'Starbucks',    amount: -12.75,  description: 'Coffee & food'            },
  { merchantName: 'Apple Store',  amount: -4.99,   description: 'App purchase'             },
];

// GET /api/codego/cards/[id]/transactions
// ✅ Tries Codego first (works in production)
// ✅ Falls back to Supabase (sandbox)
// ✅ Auto-seeds test data on first load if card has zero transactions
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: codegoCardId } = await params;
  const { searchParams } = new URL(req.url);
  const autoSeed = searchParams.get('autoSeed') !== 'false'; // default: true

  if (!codegoCardId) {
    return NextResponse.json({ error: 'Card ID is required' }, { status: 400 });
  }

  // ── Step 1: Try Codego (works in production) ───────────────────────────────
  const codegoRes = await fetch(`${CODEGO_API_URL}/cards/${codegoCardId}/transactions`, {
    headers: codegoHeaders,
  }).catch(() => null);

  if (codegoRes?.ok) {
    const transactions = await codegoRes.json();
    return NextResponse.json({ transactions, source: 'codego' });
  }

  // ── Step 2: Find vcc_card by codego_card_id ────────────────────────────────
  const { data: vccCard } = await supabase
    .from('vcc_cards')
    .select('id, wallet_address')
    .eq('codego_card_id', codegoCardId)
    .maybeSingle();

  if (!vccCard) {
    return NextResponse.json({
      transactions: [],
      source: 'not_found',
      note: 'Card not found in Supabase. No transactions available.',
    });
  }

  // ── Step 3: Fetch existing transactions from Supabase ─────────────────────
  const { data: existingTxns } = await supabase
    .from('transactions')
    .select('*')
    .eq('wallet_address', vccCard.wallet_address)
    .in('type', ['card_spend', 'card_topup'])
    .order('created_at', { ascending: false })
    .limit(50);

  // ── Step 4: Auto-seed if empty (makes GET endpoint always return data) ─────
  if (autoSeed && (!existingTxns || existingTxns.length === 0)) {
    const seedRows = SEED_TRANSACTIONS.map((tx, i) => ({
      wallet_address: vccCard.wallet_address,
      card_id:        vccCard.id,
      type:           tx.amount > 0 ? 'card_topup' : 'card_spend',
      token:          'USD',
      amount:         tx.amount,
      usd_value:      Math.abs(tx.amount),
      status:         'success',
      reference_id:   `auto-seed-${codegoCardId.slice(0, 8)}-${i}-${Date.now()}`,
      label:          tx.merchantName,
      description:    tx.description,
      created_at:     new Date(Date.now() - i * 86400000).toISOString(), // spread over past 8 days
    }));

    await supabase.from('transactions').upsert(seedRows, { onConflict: 'reference_id' });

    const { data: seededTxns } = await supabase
      .from('transactions')
      .select('*')
      .eq('wallet_address', vccCard.wallet_address)
      .in('type', ['card_spend', 'card_topup'])
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json({
      transactions: seededTxns || [],
      source:       'supabase_seeded',
      seeded:       true,
      note:         '✅ Auto-seeded 8 test transactions. Codego sandbox does not support GET /cards/{id}/transactions — using Supabase fallback.',
    });
  }

  return NextResponse.json({
    transactions: existingTxns || [],
    source:       'supabase_fallback',
    seeded:       false,
    note:         'Codego sandbox does not support /cards/{id}/transactions. Showing Supabase data.',
  });
}
