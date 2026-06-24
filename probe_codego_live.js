// Codego Live Endpoint Probe
// Tests every candidate endpoint with your real sandbox key
// Run: node probe_codego_live.js

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
    console.log(`\n[${res.status}] ${method} ${url}`);
    console.log(`  LABEL: ${label}`);
    console.log(`  RESPONSE: ${JSON.stringify(data).slice(0, 400)}`);
    return { status: res.status, data };
  } catch (e) {
    console.log(`\n[ERR] ${method} ${url} — ${e.message}`);
    return { status: 0, error: e.message };
  }
}

async function run() {
  console.log('=== CODEGO SANDBOX PROBE ===');
  console.log(`Base URL: ${BASE}`);
  console.log(`API Key: ${API_KEY.slice(0, 20)}...`);

  // --- ONBOARDING / APPLICATIONS ---
  await probe('List Applications', 'GET', '/applications');
  await probe('Create Application (KYC onboarding)', 'POST', '/applications', {
    externalUserId: 'probe-test-001',
    applicantType: 'individual',
    email: 'probe@test.com',
    firstName: 'John',
    lastName: 'Probe',
    dateOfBirth: '1990-01-15',
    nationality: 'US',
    phone: '+14155550100',
    address: { line1: '123 Test St', city: 'San Francisco', postalCode: '94102', country: 'US' }
  });

  // --- USER / CARDHOLDER ---
  await probe('List Users/Cardholders', 'GET', '/users');
  await probe('List Cardholders (alt)', 'GET', '/cardholders');
  await probe('Create User', 'POST', '/users', {
    email: 'probe@test.com', firstName: 'John', lastName: 'Probe'
  });
  await probe('Create Cardholder (alt)', 'POST', '/cardholders', {
    email: 'probe@test.com', firstName: 'John', lastName: 'Probe'
  });

  // --- CARDS ---
  await probe('List Cards (global)', 'GET', '/cards');
  await probe('Create Virtual Card (direct, no user path)', 'POST', '/cards', {
    type: 'virtual',
    currency: 'USD',
    limit: { amount: 50000, frequency: 'monthly' },
    configuration: { displayName: 'Test VCC', productId: '1' }
  });

  // --- ACCOUNTS / WALLETS ---
  await probe('List Accounts', 'GET', '/accounts');
  await probe('List Wallets', 'GET', '/wallets');

  // --- FIAT / TRANSFERS ---
  await probe('Get Deposit Bank Details', 'GET', '/fiat/deposit');
  await probe('Get Deposit Info (alt)', 'GET', '/deposit-details');
  await probe('List Transfers', 'GET', '/transfers');

  // --- ME / PROFILE ---
  await probe('Get Own Profile', 'GET', '/me');
  await probe('Get Profile (alt)', 'GET', '/profile');
  await probe('Get Merchant Info', 'GET', '/merchant');

  console.log('\n=== PROBE COMPLETE ===');
}

run().catch(console.error);
