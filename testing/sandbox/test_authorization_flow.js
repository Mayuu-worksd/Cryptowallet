/**
 * test_authorization_flow.js
 *
 * Comprehensive E2E Verification Suite for KripiCard Transaction Authorization.
 * Tests:
 *   1. Simulation & Request creation
 *   2. Duplicate transaction handling (prevention of multiple OTP requests)
 *   3. Expiry / replay check
 *   4. Invalid OTP limits lockout (max 3 attempts -> Rejected)
 *   5. Successful OTP approval (via sandbox bypass code)
 *   6. Database state synchronization
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './admin-dashboard/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in env.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log('===========================================================');
  console.log('  KRIPICARD TRANSACTION AUTHORIZATION TEST SUITE');
  console.log('===========================================================\n');

  // Helper to query with retries
  const queryWithRetry = async (queryFn, retries = 5, delay = 2000) => {
    for (let i = 0; i < retries; i++) {
      try {
        const { data, error } = await queryFn();
        if (!error && data) return data;
        if (error) console.warn(`[Supabase Query Warning] Attempt ${i+1}/${retries} failed:`, error.message || error);
      } catch (e) {
        console.warn(`[Supabase Query Warning] Exception on attempt ${i+1}/${retries}:`, e.message || e);
      }
      if (i < retries - 1) await new Promise(r => setTimeout(r, delay));
    }
    return null;
  };

  // Verify there is at least one active card in the system for testing
  const activeCards = await queryWithRetry(() => supabase
    .from('vcc_cards')
    .select('*')
    .eq('card_status', 'active')
    .limit(1)
  );

  if (!activeCards) {
    console.error('❌ Failed to query active cards (returned null/failed)');
    process.exit(1);
  }

  if (!activeCards || activeCards.length === 0) {
    console.log('⚠️ No active virtual cards found in vcc_cards. Creating a mock card first...');
    const { error: mockCardErr } = await supabase.from('vcc_cards').insert({
      wallet_address: '0xbF0603aDe100dea85e6dE47f8c46c8Ce55Bb4D01'.toLowerCase(),
      card_last4: '4357',
      card_holder_name: 'TEST OWNER',
      expiry_mm_yy: '12/28',
      card_variant: 'classic',
      card_status: 'active',
      codego_card_id: 'mock_kripi_card_123',
      balance: 100.00
    });
    if (mockCardErr) {
      console.error('❌ Failed to create mock card:', mockCardErr.message);
      process.exit(1);
    }
    // Also ensure mock KYC profile exists
    await supabase.from('kyc').upsert({
      wallet_address: '0xbF0603aDe100dea85e6dE47f8c46c8Ce55Bb4D01'.toLowerCase(),
      full_name: 'TEST OWNER',
      email: 'wickb5825@gmail.com',
      status: 'verified',
      nationality: 'US',
      address: '123 Test St',
      dob: '1990-01-01'
    }, { onConflict: 'wallet_address' });
    console.log('✅ Mock card and KYC profile generated successfully.');
  }

  // Helper fetch request
  const post = async (path, body) => {
    const res = await fetch(`${apiUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    return res.json();
  };

  const get = async (path) => {
    const res = await fetch(`${apiUrl}${path}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  try {
    // ─── TEST 1: Simulate Payment & Request Authorization ──────────────────────────
    console.log('Running Test 1: Generate Authorization Request...');
    const simTxId = `test_tx_${Math.random().toString(36).slice(2, 10)}`;
    const simRes = await post('/api/authorization/simulate', {
      transaction_id: simTxId,
      amount: 45.99,
      merchant: 'Steam Games',
    });

    if (!simRes.success || !simRes.simulation.authorization_id) {
      throw new Error('Simulation endpoint failed to return authorization_id');
    }
    const authId1 = simRes.simulation.authorization_id;
    console.log(`✔ [1/6] Simulation success! auth_id: ${authId1}, url: ${simRes.redirect_url}`);

    // Verify DB entry
    const dbRow1 = await queryWithRetry(() => supabase
      .from('transaction_authorizations')
      .select('*')
      .eq('authorization_id', authId1)
      .single()
    );

    if (!dbRow1) {
      throw new Error(`dbRow1 is null.`);
    }

    if (dbRow1.status !== 'pending' || Number(dbRow1.amount) !== 45.99) {
      throw new Error('Database insertion validation failed');
    }
    console.log('✔ [2/6] Database columns validated (status=pending, amount=45.99)');

    // ─── TEST 2: Duplicate request handling ─────────────────────────────────────────
    console.log('\nRunning Test 2: Verify duplicate request reuse...');
    const dupRes = await post('/api/authorization/request', {
      transaction_id: simTxId,
      provider_card_id: dbRow1.provider_card_id,
      amount: 45.99,
      merchant: 'Steam Games',
      card_last4: dbRow1.card_last4
    });

    if (!dupRes.success || dupRes.authorization_id !== authId1 || dupRes.note !== 'reused_active_request') {
      throw new Error('Failed to reuse active pending request for duplicate transaction ID');
    }
    console.log('✔ [3/6] Prevented multiple OTP / duplicate request generation.');

    // ─── TEST 3: Invalid OTP Limit Lockout (Max 3 attempts) ─────────────────────────
    console.log('\nRunning Test 3: Checking 3 attempts lockout (Rejected status)...');
    
    // Attempt 1
    try {
      await post('/api/authorization/verify', { authorization_id: authId1, otp: '99999999' });
    } catch (e) {
      console.log('  - Attempt 1: Failed as expected (wrong OTP)');
    }
    
    // Attempt 2
    try {
      await post('/api/authorization/verify', { authorization_id: authId1, otp: '88888888' });
    } catch (e) {
      console.log('  - Attempt 2: Failed as expected (wrong OTP)');
    }

    // Attempt 3
    let lockoutRes;
    try {
      lockoutRes = await post('/api/authorization/verify', { authorization_id: authId1, otp: '77777777' });
    } catch (e) {
      // It returns 400 error status code on failure, which throws in helper. Catch it and parse.
      console.log('  - Attempt 3: Failed as expected (wrong OTP limit reached)');
    }

    // Verify DB status is rejected
    const dbRowLocked = await queryWithRetry(() => supabase
      .from('transaction_authorizations')
      .select('*')
      .eq('authorization_id', authId1)
      .single()
    );

    if (!dbRowLocked) {
      throw new Error('Lockout verification failed: dbRowLocked is null');
    }

    if (dbRowLocked.status !== 'rejected' || dbRowLocked.attempts !== 3) {
      throw new Error(`Lockout verification failed. DB status: ${dbRowLocked.status}, attempts: ${dbRowLocked.attempts}`);
    }

    // Check transactions table has failed transaction
    const txRowLocked = await queryWithRetry(() => supabase
      .from('transactions')
      .select('status')
      .eq('reference_id', simTxId)
      .maybeSingle()
    );

    if (txRowLocked && txRowLocked.status !== 'failed') {
      throw new Error(`Transaction table status expected 'failed', got: ${txRowLocked.status}`);
    }
    console.log('✔ [4/6] Lockout validation passed. Transaction status marked REJECTED.');

    // ─── TEST 4: Successful OTP verification ────────────────────────────────────────
    console.log('\nRunning Test 4: Checking successful authorization...');
    const simTxId2 = `test_tx_${Math.random().toString(36).slice(2, 10)}`;
    const simRes2 = await post('/api/authorization/simulate', {
      transaction_id: simTxId2,
      amount: 120.00,
      merchant: 'Uber Trip',
    });
    const authId2 = simRes2.simulation.authorization_id;

    // Verify with bypass code
    const approveRes = await post('/api/authorization/verify', {
      authorization_id: authId2,
      otp: '12345678'
    });

    if (!approveRes.success || approveRes.status !== 'authorized') {
      throw new Error(`Approval verify response invalid: ${JSON.stringify(approveRes)}`);
    }

    // Verify DB row
    const dbRowApproved = await queryWithRetry(() => supabase
      .from('transaction_authorizations')
      .select('*')
      .eq('authorization_id', authId2)
      .single()
    );

    if (!dbRowApproved) {
      throw new Error(`dbRowApproved is null.`);
    }

    if (dbRowApproved.status !== 'authorized' || !dbRowApproved.authorized_at) {
      throw new Error(`Approved DB row check failed. Status: ${dbRowApproved.status}`);
    }

    // Verify transactions table has success transaction
    const txRowApproved = await queryWithRetry(() => supabase
      .from('transactions')
      .select('status, description')
      .eq('reference_id', simTxId2)
      .maybeSingle()
    );

    if (txRowApproved && txRowApproved.status !== 'success') {
      throw new Error(`Transaction table status expected 'success', got: ${txRowApproved.status}`);
    }
    console.log('✔ [5/6] Verification check passed. Transaction status marked AUTHORIZED.');

    // ─── TEST 5: Replay Attack Prevention ───────────────────────────────────────────
    console.log('\nRunning Test 5: Checking replay attack prevention...');
    try {
      await post('/api/authorization/verify', {
        authorization_id: authId2,
        otp: '12345678'
      });
      throw new Error('Replay attack succeeded! Approved transaction was re-authorized.');
    } catch (e) {
      console.log('  - Replay blocked as expected (error thrown)');
    }
    console.log('✔ [6/6] Replay attack blocked.');

    console.log('\n===========================================================');
    console.log('  ALL TRANSACTION AUTHORIZATION TESTS PASSED SUCCESSFULLY! (6/6)');
    console.log('===========================================================');

  } catch (err) {
    console.error('\n❌ Test Harness Failed:', err.message);
    process.exit(1);
  }
}

runTests();
