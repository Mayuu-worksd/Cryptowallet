// ══════════════════════════════════════════════════════════════════════════════
// TEST TRANSACTION E2E — Mirrors exactly how Codego production webhooks work
//
// What this does:
//   1. Finds your card's codego_card_id from Supabase
//   2. POSTs a fake webhook to your admin API (same as Codego would in production)
//   3. The webhook handler inserts into the transactions table
//   4. Verifies the transaction appeared in Supabase
//
// Run: node test_transaction_e2e.js YOUR_WALLET_ADDRESS
// ══════════════════════════════════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js');

// ── CONFIG ────────────────────────────────────────────────────────────────────
const SUPABASE_URL      = 'https://hxmacphgbpedazdvgdnz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bWFjcGhnYnBlZGF6ZHZnZG56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMDIyNjAsImV4cCI6MjA5MjY3ODI2MH0.CPQgakkjwT6N7DX1B56yPEVjGe9H9jjMCWCBCC0qM1M';
const API_URL           = 'https://admin-dashboard-tau-flame.vercel.app';
const WEBHOOK_ENDPOINT  = `${API_URL}/api/webhooks/codego`;

// ── FAKE MERCHANT DATA (mirrors what Codego sends in production) ──────────────
const FAKE_TRANSACTIONS = [
  { merchantName: 'Netflix',        amount: -15.99, description: 'Monthly subscription',  currency: 'USD' },
  { merchantName: 'Uber Eats',      amount: -32.50, description: 'Food delivery order',   currency: 'USD' },
  { merchantName: 'Amazon',         amount: -89.99, description: 'Online purchase',        currency: 'USD' },
  { merchantName: 'Spotify',        amount: -9.99,  description: 'Music subscription',     currency: 'USD' },
  { merchantName: 'Card Top-Up',    amount: 100.00, description: 'Wallet top-up',          currency: 'USD' },
];

// ── MAIN ──────────────────────────────────────────────────────────────────────
const walletAddress = process.argv[2];
if (!walletAddress) {
  console.error('\n❌ Usage: node test_transaction_e2e.js YOUR_WALLET_ADDRESS\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║     CODEGO TRANSACTION — END-TO-END TEST             ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`\nWallet : ${walletAddress}`);
  console.log(`Webhook: ${WEBHOOK_ENDPOINT}\n`);

  // ── STEP 1: Find the card ──────────────────────────────────────────────────
  console.log('── STEP 1: Finding your card in Supabase...');
  const { data: card, error: cardErr } = await supabase
    .from('vcc_cards')
    .select('id, codego_card_id, card_last4, card_status, card_holder_name')
    .eq('wallet_address', walletAddress.toLowerCase())
    .maybeSingle();

  if (cardErr || !card) {
    console.error('❌ No card found for this wallet address.');
    console.error('   Make sure you have created a card first.');
    if (cardErr) console.error('   Error:', cardErr.message);
    process.exit(1);
  }

  console.log(`✅ Card found:`);
  console.log(`   Card ID (Supabase): ${card.id}`);
  console.log(`   CodeGo Card ID    : ${card.codego_card_id || '⚠️  MOCK (no codego_card_id)'}`);
  console.log(`   Last 4            : ${card.card_last4}`);
  console.log(`   Status            : ${card.card_status}`);
  console.log(`   Holder            : ${card.card_holder_name}`);

  const codegoCardId = card.codego_card_id || `mock_cg_test_${card.id.slice(0,8)}`;

  // ── STEP 2: Fire fake webhooks (same format as Codego production) ──────────
  console.log('\n── STEP 2: Sending fake webhook events to your API...\n');

  const results = [];

  for (const tx of FAKE_TRANSACTIONS) {
    const referenceId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    // This is EXACTLY the same payload format Codego sends in production
    const webhookPayload = {
      type: 'transaction.created',        // eventType field your webhook reads
      data: {
        id:           referenceId,         // → reference_id in transactions table
        cardId:       codegoCardId,        // → used to look up wallet_address
        amount:       tx.amount,           // → amount in transactions table
        currency:     tx.currency,         // → token in transactions table
        merchantName: tx.merchantName,     // → label in transactions table
        description:  tx.description,      // → description in transactions table
        status:       'approved',          // → maps to 'success' in transactions
        createdAt:    new Date().toISOString(),
      }
    };

    try {
      const res = await fetch(WEBHOOK_ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(webhookPayload),
      });

      const data = await res.json();
      const ok   = res.status === 200 && data.success;

      console.log(`${ok ? '✅' : '❌'} [${res.status}] ${tx.merchantName.padEnd(15)} ${String(tx.amount).padStart(8)} USD — ${ok ? 'Webhook accepted' : JSON.stringify(data)}`);
      results.push({ tx, ok, referenceId });

    } catch (e) {
      console.log(`💥 ${tx.merchantName} — Network error: ${e.message}`);
      results.push({ tx, ok: false, referenceId });
    }

    // Small delay between requests
    await new Promise(r => setTimeout(r, 300));
  }

  // ── STEP 3: Verify transactions appeared in Supabase ──────────────────────
  console.log('\n── STEP 3: Verifying transactions in Supabase...\n');
  await new Promise(r => setTimeout(r, 1500)); // wait for DB writes

  const { data: txns, error: txErr } = await supabase
    .from('transactions')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .eq('type', 'card_spend')
    .order('created_at', { ascending: false })
    .limit(10);

  if (txErr) {
    console.error('❌ Failed to read transactions:', txErr.message);
  } else if (!txns || txns.length === 0) {
    console.log('⚠️  No card_spend transactions found in Supabase.');
    console.log('   Check if the webhook endpoint is reachable and your API is deployed.');
  } else {
    console.log(`✅ Found ${txns.length} card_spend transaction(s) in Supabase:\n`);
    txns.forEach((t, i) => {
      console.log(`   ${i + 1}. ${(t.label || 'N/A').padEnd(16)} | ${String(t.amount).padStart(8)} ${t.token} | Status: ${t.status} | Ref: ${t.reference_id?.slice(0,20)}`);
    });
  }

  // ── STEP 4: Test card.updated webhook (balance update) ────────────────────
  console.log('\n── STEP 4: Testing card.updated webhook (simulates balance change)...');
  const balanceWebhook = {
    type: 'card.updated',
    data: {
      cardId:  codegoCardId,
      id:      codegoCardId,
      status:  'active',
      balance: 250.00,
    }
  };

  try {
    const res  = await fetch(WEBHOOK_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(balanceWebhook) });
    const data = await res.json();
    console.log(res.status === 200 ? `✅ Balance update webhook accepted` : `❌ Failed: ${JSON.stringify(data)}`);
  } catch (e) {
    console.log(`💥 Balance webhook error: ${e.message}`);
  }

  // ── SUMMARY ────────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.ok).length;
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║                    SUMMARY                           ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`\n  Webhooks sent    : ${results.length}`);
  console.log(`  Accepted (2xx)   : ${passed}`);
  console.log(`  Failed           : ${results.length - passed}`);
  console.log(`\n  ✅ Now open the mobile app → Statements → CARD TXNS`);
  console.log(`     Pull to refresh — transactions should appear!\n`);
}

run().catch(console.error);
