// Codego Phase 3: Discover full /applications schema + card creation after a user exists
// Run: node probe_codego_phase3.js

const API_KEY = 'vcck_sbx_f119144ea2221e4796778de28115c4cad97429da86e66552';
const BASE = 'https://vcc-sandbox.codegotech.com/api/v1';

const headers = {
  'X-Api-Key': API_KEY,
  'Content-Type': 'application/json',
};

async function probe(label, method, path, body) {
  const url = `${BASE}${path}`;
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    let data;
    try { data = await res.json(); } catch { data = await res.text(); }
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${res.status}] ${method} ${path}`);
    console.log(`LABEL: ${label}`);
    console.log(`RESPONSE: ${JSON.stringify(data, null, 2).slice(0, 1500)}`);
    return { status: res.status, data };
  } catch (e) {
    console.log(`\n[ERR] ${method} ${path} — ${e.message}`);
    return { status: 0, error: e.message };
  }
}

async function run() {
  console.log('=== CODEGO PHASE 3: FULL SCHEMA DISCOVERY ===');

  // ---- STEP 1: Discover full application schema via sumsubShareToken path ----
  // Known so far: needs sumsubShareToken + birthDate + ipAddress
  await probe('Application: sumsub + birthDate + ipAddress', 'POST', '/applications', {
    sumsubShareToken: 'sandbox-sumsub-token-001',
    birthDate: '1990-01-15',
    ipAddress: '127.0.0.1',
  });

  // ---- STEP 2: Try persona path with ipAddress ----
  await probe('Application: persona + birthDate + ipAddress', 'POST', '/applications', {
    personaShareToken: 'sandbox-persona-token-001',
    birthDate: '1990-01-15',
    ipAddress: '127.0.0.1',
  });

  // ---- STEP 3: Try GET /applications/:id for any user ----
  // The error was "user not found" which is a different error — endpoint EXISTS
  await probe('GET /applications/some-id (endpoint exists?)', 'GET', '/applications/abc-123');

  // ---- STEP 4: GET /users/:id — "user not found" means endpoint exists ----
  await probe('GET /users/some-id (endpoint exists)', 'GET', '/users/abc-123');

  // ---- STEP 5: POST /users/:id/cards — "user not found" means endpoint EXISTS ----
  // Let's try with a realistic-looking UUID
  await probe('POST /users/{uuid}/cards (probe shape)', 'POST', '/users/00000000-0000-0000-0000-000000000001/cards', {
    type: 'virtual',
    currency: 'USD',
    limit: { amount: 50000, frequency: 'monthly' },
  });

  // ---- STEP 6: GET /cards - we know this works, try fetching a specific card ----
  await probe('GET /cards/fake-id (probe endpoint exists)', 'GET', '/cards/00000000-0000-0000-0000-000000000001');

  // ---- STEP 7: Test card-related sub-resources with fake ID ----
  await probe('GET /cards/{id}/transactions', 'GET', '/cards/00000000-0000-0000-0000-000000000001/transactions');
  await probe('GET /cards/{id}/statement', 'GET', '/cards/00000000-0000-0000-0000-000000000001/statement');
  await probe('PATCH /cards/{id}/status (freeze)', 'PATCH', '/cards/00000000-0000-0000-0000-000000000001/status', { status: 'frozen' });
  await probe('GET /cards/{id}/sensitive-data', 'GET', '/cards/00000000-0000-0000-0000-000000000001/sensitive-data');
  await probe('GET /cards/{id}/pin', 'GET', '/cards/00000000-0000-0000-0000-000000000001/pin');

  // ---- STEP 8: Balance / Wallet endpoints ----
  await probe('GET /balance', 'GET', '/balance');
  await probe('GET /ledger', 'GET', '/ledger');
  await probe('GET /fiat', 'GET', '/fiat');
  await probe('GET /fiat/accounts', 'GET', '/fiat/accounts');
  await probe('GET /payment-details', 'GET', '/payment-details');
  await probe('GET /iban', 'GET', '/iban');

  console.log('\n=== PHASE 3 COMPLETE ===');
}

run().catch(console.error);
