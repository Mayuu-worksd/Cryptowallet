// DEFINITIVE CODEGO ENDPOINT VERIFICATION
// Tests every single endpoint currently referenced in the codebase
// No mocking. No assumptions. Real HTTP calls. Real responses.
// Run: node verify_all_codego_endpoints.js

const API_KEY = 'vcck_sbx_f119144ea2221e4796778de28115c4cad97429da86e66552';
const BASE = 'https://vcc-sandbox.codegotech.com/api/v1';

// Try BOTH auth header styles since they are mixed in the codebase
const headersXApiKey = {
  'X-Api-Key': API_KEY,
  'Content-Type': 'application/json',
};
const headersBearer = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

const FAKE_CARD_ID = '00000000-0000-0000-0000-000000000001';
const FAKE_USER_ID = '00000000-0000-0000-0000-000000000002';

const results = [];

async function test(label, method, path, body, headers = headersXApiKey) {
  const url = `${BASE}${path}`;
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    let data;
    try { data = await res.json(); } catch { data = await res.text(); }
    
    const result = {
      label,
      method,
      path,
      authHeader: headers === headersXApiKey ? 'X-Api-Key' : 'Bearer',
      status: res.status,
      response: JSON.stringify(data).slice(0, 300),
      exists: res.status !== 404 || (data && !data.path), // "path" in 404 = route not found
      errorType: typeof data === 'object' ? data.error : data,
    };
    results.push(result);
    
    const existsStr = result.exists ? '✅ EXISTS' : '❌ 404 NOT FOUND';
    const statusStr = res.status === 200 ? '🟢' : res.status === 400 ? '🟡' : res.status === 401 ? '🔴' : '⚪';
    console.log(`\n${statusStr} [${res.status}] ${method} ${path} [${result.authHeader}]`);
    console.log(`   ${existsStr}`);
    console.log(`   LABEL: ${label}`);
    console.log(`   RESPONSE: ${JSON.stringify(data).slice(0, 250)}`);
    return result;
  } catch (e) {
    console.log(`\n💥 [ERR] ${method} ${path} — ${e.message}`);
    results.push({ label, method, path, status: 0, error: e.message, exists: false });
  }
}

async function run() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     CODEGO SANDBOX — FULL ENDPOINT VERIFICATION          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`API Key: ${API_KEY.slice(0, 20)}...`);
  console.log(`Base: ${BASE}\n`);

  // ─────────────────────────────────────────────
  // GROUP 1: USER / CARDHOLDER CREATION
  // Currently used in: cardholders/route.ts, cards/route.ts
  // ─────────────────────────────────────────────
  console.log('\n══ GROUP 1: USER / CARDHOLDER CREATION ══');

  await test('POST /users [X-Api-Key] — used in cardholders/route.ts', 'POST', '/users', {
    email: 'test@test.com', firstName: 'Test', lastName: 'User'
  }, headersXApiKey);

  await test('POST /users [Bearer] — used in cardholders/route.ts', 'POST', '/users', {
    email: 'test@test.com', firstName: 'Test', lastName: 'User'
  }, headersBearer);

  await test('GET /users [X-Api-Key]', 'GET', '/users', null, headersXApiKey);

  await test('GET /users/{id} [X-Api-Key] — used in cards creation step 2', 'GET', `/users/${FAKE_USER_ID}`, null, headersXApiKey);

  // ─────────────────────────────────────────────
  // GROUP 2: APPLICATIONS (KYC ONBOARDING)
  // Currently used in: applications/route.ts
  // ─────────────────────────────────────────────
  console.log('\n══ GROUP 2: APPLICATIONS (KYC ONBOARDING) ══');

  await test('POST /applications [X-Api-Key] — used in applications/route.ts', 'POST', '/applications', {
    externalUserId: 'test-001', email: 'test@test.com', firstName: 'Test', lastName: 'User'
  }, headersXApiKey);

  await test('GET /applications/{id} [X-Api-Key]', 'GET', '/applications/test-001', null, headersXApiKey);

  // ─────────────────────────────────────────────
  // GROUP 3: CARD CREATION & LISTING
  // Currently used in: cards/route.ts
  // ─────────────────────────────────────────────
  console.log('\n══ GROUP 3: CARD CREATION & LISTING ══');

  await test('GET /cards [X-Api-Key] — global card list', 'GET', '/cards', null, headersXApiKey);

  await test('POST /users/{id}/cards [X-Api-Key] — used in cards/route.ts', 'POST', `/users/${FAKE_USER_ID}/cards`, {
    type: 'virtual', currency: 'USD',
    limit: { amount: 50000, frequency: 'monthly' },
    configuration: { displayName: 'Test Card', productId: '1' }
  }, headersXApiKey);

  await test('GET /users/{id}/cards [X-Api-Key]', 'GET', `/users/${FAKE_USER_ID}/cards`, null, headersXApiKey);

  // ─────────────────────────────────────────────
  // GROUP 4: CARD OPERATIONS
  // Currently used in: cards/[id]/route.ts, status/route.ts, pin/route.ts
  // ─────────────────────────────────────────────
  console.log('\n══ GROUP 4: CARD OPERATIONS ══');

  await test('GET /cards/{id} [X-Api-Key]', 'GET', `/cards/${FAKE_CARD_ID}`, null, headersXApiKey);

  await test('PATCH /cards/{id} [X-Api-Key] — used in cards/[id]/route.ts', 'PATCH', `/cards/${FAKE_CARD_ID}`, {
    status: 'locked'
  }, headersXApiKey);

  await test('PATCH /cards/{id}/status [X-Api-Key] — used in status/route.ts', 'PATCH', `/cards/${FAKE_CARD_ID}/status`, {
    status: 'frozen'
  }, headersXApiKey);

  await test('PUT /cards/{id}/pin [X-Api-Key] — used in pin/route.ts', 'PUT', `/cards/${FAKE_CARD_ID}/pin`, {
    pin: '1234'
  }, headersXApiKey);

  await test('PUT /cards/{id}/pin [Bearer] — used in pin/route.ts (wrong header)', 'PUT', `/cards/${FAKE_CARD_ID}/pin`, {
    pin: '1234'
  }, headersBearer);

  // ─────────────────────────────────────────────
  // GROUP 5: TRANSACTIONS & STATEMENTS
  // Currently used in: transactions/route.ts, statement/route.ts
  // ─────────────────────────────────────────────
  console.log('\n══ GROUP 5: TRANSACTIONS & STATEMENTS ══');

  await test('GET /cards/{id}/transactions [X-Api-Key] — used in transactions/route.ts', 'GET', `/cards/${FAKE_CARD_ID}/transactions`, null, headersXApiKey);

  await test('GET /cards/{id}/statement [X-Api-Key] — used in statement/route.ts', 'GET', `/cards/${FAKE_CARD_ID}/statement`, null, headersXApiKey);

  // ─────────────────────────────────────────────
  // GROUP 6: FIAT OPERATIONS
  // Currently used in: fiat/deposit/route.ts, fiat/withdraw/route.ts
  // ─────────────────────────────────────────────
  console.log('\n══ GROUP 6: FIAT OPERATIONS ══');

  await test('POST /transfers/outgoing [X-Api-Key] — used in withdraw/route.ts', 'POST', '/transfers/outgoing', {
    amount: 100, currency: 'USD',
    beneficiary: { name: 'Test', iban: 'GB82TEST12345678', bic: 'TESTGB2L' }
  }, headersXApiKey);

  await test('GET /transfers [X-Api-Key]', 'GET', '/transfers', null, headersXApiKey);

  // Deposit route does NOT call Codego — it returns fake IBAN only
  console.log('\n⚠️  NOTE: fiat/deposit/route.ts does NOT call Codego — returns hardcoded fake IBAN');

  // ─────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────
  console.log('\n\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                     SUMMARY TABLE                        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  
  const endpointSummary = results.map(r => {
    const exists = r.exists ? 'YES' : 'NO';
    const works = (r.status === 200 || r.status === 201) ? 'YES' : 'NO';
    const sandboxOnly = 'UNKNOWN';
    return `${r.method.padEnd(6)} ${r.path.padEnd(40)} | Exists: ${exists.padEnd(3)} | Works: ${works.padEnd(3)} | Status: ${r.status} | ${(r.errorType || '').slice(0, 60)}`;
  });
  
  endpointSummary.forEach(s => console.log(s));

  console.log('\n\n══ DETAILED STATUS ══');
  console.log(`Total endpoints tested: ${results.length}`);
  console.log(`Endpoints that exist (not route-level 404): ${results.filter(r => r.exists).length}`);
  console.log(`Endpoints returning 200: ${results.filter(r => r.status === 200).length}`);
  console.log(`Endpoints returning 404: ${results.filter(r => r.status === 404).length}`);
  console.log(`Endpoints returning 400 (exists, wrong params): ${results.filter(r => r.status === 400).length}`);
  console.log(`Endpoints returning 401 (exists, auth issue): ${results.filter(r => r.status === 401).length}`);
}

run().catch(console.error);
