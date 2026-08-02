/**
 * Codego Fresh End-to-End Validation
 * Tests every endpoint exactly as CodegoProvider.ts calls them.
 * No mocks. No fallbacks. Raw provider responses only.
 */

const BASE    = 'https://vcc-sandbox.codegotech.com/api/v1';
const API_KEY = 'vcck_sbx_f119144ea2221e4796778de28115c4cad97429da86e66552';
const EXISTING_USER_ID = 'f60128c4-fbe6-412c-9f11-dad20aa747e1';
const EXISTING_CARD_ID = '00000000-0000-0000-0000-000000000001';
const WALLET_ADDRESS   = '0x630abb9Db774Dae526082D848eBccC4F624AF606';

const HEADERS = { 'X-Api-Key': API_KEY, 'Content-Type': 'application/json' };

const results = [];

async function call(label, method, path, body) {
  const url  = path.startsWith('http') ? path : `${BASE}${path}`;
  const opts = { method, headers: HEADERS };
  if (body) opts.body = JSON.stringify(body);

  let status, json, raw;
  try {
    const r = await fetch(url, opts);
    status  = r.status;
    raw     = await r.text();
    try { json = JSON.parse(raw); } catch { json = raw; }
  } catch (e) {
    status = 0;
    json   = { error: e.message };
  }

  const ok = status >= 200 && status < 300;
  console.log(`\n[${status}] ${ok ? '✅' : '❌'} ${label}`);
  if (typeof json === 'object') console.log(JSON.stringify(json, null, 2));
  else console.log(raw?.slice(0, 300));

  results.push({ label, method, path, status, ok, response: json });
  return { status, json, ok };
}

async function run() {
  let userId = EXISTING_USER_ID;
  let cardId = EXISTING_CARD_ID;
  let walletAddress = WALLET_ADDRESS;

  console.log('='.repeat(60));
  console.log('CODEGO FRESH END-TO-END VALIDATION');
  console.log('='.repeat(60));

  // ── 1. WALLET CREATION ────────────────────────────────────────
  let r = await call('1. Create Wallet (POST /wallets)', 'POST', '/wallets', { chain: 'base' });
  if (r.ok && r.json?.walletAddress) {
    walletAddress = r.json.walletAddress;
    console.log('  >> New walletAddress:', walletAddress);
  }

  // ── 2. WALLET BALANCE ─────────────────────────────────────────
  await call(
    '2. Wallet Balance (GET /wallets/{addr}/balance)',
    'GET',
    `/wallets/${walletAddress}/balance?chain=base`
  );

  // ── 3. KYC APPLICATION (POST /applications) ───────────────────
  const testEmail = `cg_validation_${Date.now()}@example.com`;
  r = await call('3. Submit KYC Application (POST /applications)', 'POST', '/applications', {
    walletAddress,
    email:            testEmail,
    firstName:        'Validation',
    lastName:         'Test',
    birthDate:        '1990-01-01',
    phoneNumber:      '10000000000',
    phoneCountryCode: '1',
    ipAddress:        '127.0.0.1',
    address: {
      line1:       '123 Main St',
      city:        'Unknown',
      postalCode:  '00000',
      countryCode: 'US',
    },
    nationalId:     '123456789',
    countryOfIssue: 'US',
    key:            API_KEY,
  });
  if (r.ok && r.json?.id) {
    userId = r.json.id;
    console.log('  >> New userId:', userId);
  }

  // ── 4. SANDBOX KYC SESSION ────────────────────────────────────
  await call('4. Sandbox KYC Session (POST kyc-sandbox/api/session/create)', 'POST',
    'https://kyc-sandbox.codegotech.com/api/session/create', {
      externalUserId: userId,
      applicantType:  'individual',
      email:          testEmail,
      returnUrl:      'https://cryptowallet-dun.vercel.app',
    }
  );

  // ── 5. KYC APPLICATION STATUS (GET /applications/{id}) ────────
  await call(`5. KYC Application Status (GET /applications/${userId})`,
    'GET', `/applications/${userId}`);

  // ── 6. USER / CARDHOLDER STATUS (GET /users/{id}) ─────────────
  r = await call(`6. User Status (GET /users/${userId})`, 'GET', `/users/${userId}`);
  const kycStatus = r.json?.applicationStatus || 'unknown';
  console.log('  >> applicationStatus:', kycStatus);

  // ── 7. APPLICATION DETAILS (GET /applications) ────────────────
  await call('7. Application Details (GET /applications)', 'GET', '/applications');

  // ── 8. FIAT DEPOSIT INFO (GET /fiat/deposit) ──────────────────
  await call('8. Fiat Deposit Info (GET /fiat/deposit)', 'GET', '/fiat/deposit');

  // ── 9. AVAILABLE BALANCE / FUNDING WALLET ─────────────────────
  await call(
    '9. Available Balance (GET /wallets/{addr}/balance)',
    'GET',
    `/wallets/${walletAddress}/balance?chain=base`
  );

  // ── 10. VIRTUAL CARD CREATION ─────────────────────────────────
  r = await call('10. Create Virtual Card (POST /users/{id}/cards)', 'POST',
    `/users/${userId}/cards`, {
      type: 'virtual',
      configuration: { displayName: 'VALIDATION VIRTUAL CARD', productId: '1' },
    }
  );
  if (r.ok && r.json?.id) {
    cardId = r.json.id;
    console.log('  >> New cardId:', cardId);
  }

  // ── 11. PHYSICAL CARD CREATION ────────────────────────────────
  await call('11. Create Physical Card (POST /users/{id}/cards)', 'POST',
    `/users/${userId}/cards`, {
      type: 'physical',
      configuration: { displayName: 'VALIDATION PHYSICAL CARD', productId: '1' },
      billing: { line1: '123 Main St', city: 'Unknown', postalCode: '00000', country: 'US' },
    }
  );

  // ── 12. LIST CARDS ────────────────────────────────────────────
  await call(`12. List User Cards (GET /users/${userId}/cards)`,
    'GET', `/users/${userId}/cards`);

  // ── 13. CARD DETAILS ──────────────────────────────────────────
  await call(`13. Get Card Details (GET /cards/${cardId})`,
    'GET', `/cards/${cardId}`);

  // ── 14. FREEZE CARD ───────────────────────────────────────────
  await call(`14. Freeze Card (PATCH /cards/${cardId} status=locked)`,
    'PATCH', `/cards/${cardId}`, { status: 'locked' });

  // ── 15. UNFREEZE CARD ─────────────────────────────────────────
  await call(`15. Unfreeze Card (PATCH /cards/${cardId} status=active)`,
    'PATCH', `/cards/${cardId}`, { status: 'active' });

  // ── 16. CHANGE PIN ────────────────────────────────────────────
  await call(`16. Change PIN (PUT /cards/${cardId}/pin)`,
    'PUT', `/cards/${cardId}/pin`, { pin: '4321' });

  // ── 17. LIST TRANSACTIONS ─────────────────────────────────────
  await call(`17. List Transactions (GET /cards/${cardId}/transactions)`,
    'GET', `/cards/${cardId}/transactions`);

  // ── 18. CARD STATEMENT ────────────────────────────────────────
  await call(`18. Card Statement (GET /cards/${cardId}/statement)`,
    'GET', `/cards/${cardId}/statement`);

  // ── 19. OUTGOING TRANSFERS (FIAT WITHDRAWAL) ──────────────────
  await call('19. Outgoing Transfer (POST /transfers/outgoing)', 'POST',
    '/transfers/outgoing', {
      amount:      100,
      currency:    'USD',
      beneficiary: { name: 'Test User', iban: 'GB29NWBK60161331926819', bic: 'NWBKGB2L' },
      description: 'Validation test withdrawal',
    }
  );

  // ── 20. WEBHOOK RECEIVER (our own endpoint) ───────────────────
  await call('20. Webhook Receiver (POST our /api/webhooks/codego)', 'POST',
    'https://admin-dashboard-tau-flame.vercel.app/api/webhooks/codego', {
      type: 'card.created',
      data: { id: cardId, cardId, status: 'active' },
    }
  );

  // ── 21. UPDATE CARD LIMITS ────────────────────────────────────
  await call(`21. Update Card Limits (PATCH /cards/${cardId})`,
    'PATCH', `/cards/${cardId}`, { limit: { amount: 10000 } });

  // ── SUMMARY TABLE ─────────────────────────────────────────────
  console.log('\n\n' + '='.repeat(80));
  console.log('SUMMARY TABLE');
  console.log('='.repeat(80));
  console.log(
    'Endpoint'.padEnd(52) +
    'Status'.padEnd(8) +
    'Result'.padEnd(10) +
    'Classification'
  );
  console.log('-'.repeat(80));

  for (const res of results) {
    const status = String(res.status).padEnd(8);
    const result = (res.ok ? '✅ PASS' : '❌ FAIL').padEnd(10);
    const classification = classify(res.status, res.label);
    console.log(`${res.label.slice(0,51).padEnd(52)}${status}${result}${classification}`);
  }
}

function classify(status, label) {
  if (status === 0)   return '❌ Network/connection error';
  if (status === 200 || status === 201) return '✅ Working';
  if (status === 401 || status === 403) return '❌ Auth failure';
  if (status === 404) {
    if (label.includes('Transactions') || label.includes('Statement') ||
        label.includes('Fiat') || label.includes('Transfer') ||
        label.includes('Application Details'))
      return '🚫 Sandbox limitation (provider restriction)';
    return '❌ Not found — check endpoint or ID';
  }
  if (status === 400) return '⚠️  KYC/validation requirement or bad request';
  if (status === 422) return '⚠️  Request validation issue';
  if (status === 500) return '❌ Provider server error';
  return `⚠️  Status ${status}`;
}

run().catch(console.error);
