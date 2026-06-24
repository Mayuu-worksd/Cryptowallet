// Codego Deep Probe Phase 2
// Focus on what actually works: POST /applications and card flows
// Run: node probe_codego_phase2.js

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
    console.log(`[${res.status}] ${method} ${url}`);
    console.log(`LABEL: ${label}`);
    console.log(`RESPONSE: ${JSON.stringify(data, null, 2).slice(0, 1000)}`);
    return { status: res.status, data };
  } catch (e) {
    console.log(`\n[ERR] ${method} ${url} — ${e.message}`);
    return { status: 0, error: e.message };
  }
}

async function run() {
  console.log('=== CODEGO DEEP PROBE PHASE 2 ===');

  // 1. The applications endpoint needs 'key' — likely a KYC provider token
  // Let's try with 'key' field (possibly an alternative to sumsub/persona)
  await probe('Application with key field only', 'POST', '/applications', {
    key: 'test-kyc-key-001',
    birthDate: '1990-01-15',
  });

  await probe('Application with personaShareToken (sandbox)', 'POST', '/applications', {
    personaShareToken: 'sandbox-persona-token-001',
    birthDate: '1990-01-15',
    externalUserId: 'test-user-001',
  });

  await probe('Application with sumsubShareToken (sandbox)', 'POST', '/applications', {
    sumsubShareToken: 'sandbox-sumsub-token-001',
    birthDate: '1990-01-15',
    externalUserId: 'test-user-001',
  });

  // 2. Try to get an existing application status
  await probe('GET single application', 'GET', '/applications/test-user-001');
  await probe('GET application by external ID', 'GET', '/applications?externalUserId=test-user-001');

  // 3. Cards — GET /cards works, probe card-specific sub-routes
  await probe('GET /cards (confirmed working)', 'GET', '/cards');
  await probe('GET /cards with query params', 'GET', '/cards?page=1&limit=10');

  // 4. Try user-scoped card creation with a fake ID to see error format
  await probe('POST /users/fake-id/cards', 'POST', '/users/fake-id/cards', {
    type: 'virtual',
    currency: 'USD',
  });

  // 5. Try cardholders sub-resource
  await probe('GET /cardholders (plural)', 'GET', '/cardholders');
  await probe('POST /cardholder (singular)', 'POST', '/cardholder', {
    email: 'test@test.com',
    firstName: 'John',
    lastName: 'Doe',
  });

  // 6. Webhook config
  await probe('GET /webhooks', 'GET', '/webhooks');
  await probe('GET /webhook', 'GET', '/webhook');

  // 7. Try OTP/token flow  
  await probe('GET /tokens', 'GET', '/tokens');
  await probe('POST /otp', 'POST', '/otp', { email: 'test@test.com' });

  // 8. Check API root / docs
  await probe('GET API root', 'GET', '/');
  await probe('GET /health', 'GET', '/health');
  await probe('GET /status', 'GET', '/status');

  console.log('\n=== PHASE 2 COMPLETE ===');
}

run().catch(console.error);
