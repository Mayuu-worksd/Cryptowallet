const crypto = require('crypto');

const API_KEY    = 'S51YApQME2DWA0zkceJFlzaGTtz3fQHlV_kKtut1UNM=';
const API_SECRET = 'WwZzutNBhTIpQ23bDBRqcO/kXSyO38w1Cvpz6PNy94c=';
const BASE       = 'https://www.sandbox.striga.com/api/v1';

function md5(s)        { return crypto.createHash('md5').update(s).digest('hex'); }
function hmac(data, k) { return crypto.createHmac('sha256', k).update(data).digest('hex'); }

function sign(method, path, body = {}) {
  const t       = Date.now().toString();
  const bodyStr = JSON.stringify(body);
  const sig     = hmac(t + method + path + md5(bodyStr), API_SECRET);
  return { auth: `HMAC ${t}:${sig}`, bodyStr };
}

async function call(method, path, body, label) {
  const { auth, bodyStr } = sign(method, path, body);
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'api-key': API_KEY, 'Authorization': auth }
  };
  if (method !== 'GET') opts.body = bodyStr;
  const r   = await fetch(`${BASE}${path}`, opts);
  const txt = await r.text();
  let json; try { json = JSON.parse(txt); } catch { json = txt; }
  const ok  = r.status >= 200 && r.status < 300;
  console.log(`\n[${r.status}] ${ok ? '✅' : '❌'} ${label}`);
  console.log(JSON.stringify(json, null, 2));
  return { status: r.status, json, ok };
}

async function createApprovedUser() {
  // Step 1: create
  let r = await call('POST', '/user/create', {
    firstName: 'Approved', lastName: 'User',
    email: `approved_${Date.now()}@mailinator.com`,
    mobile: { countryCode: '+372', number: '56316716' }
  }, 'Create User');
  const userId = r.json?.userId;
  if (!userId) throw new Error('No userId');

  // Step 2: fill all required fields
  await call('PATCH', '/user/update', {
    userId,
    selfPepDeclaration: true,
    dateOfBirth: { month: 6, day: 15, year: 1990 },
    address: { addressLine1: 'Sepapaja 12', city: 'Tallinn', country: 'EE', postalCode: '11412' },
    documentIssuingCountry: 'EE',
    nationality: 'EE',
    occupation: 'PRECIOUS_GOODS_JEWELRY',
    sourceOfFunds: 'OTHER',
    sourceOfFundsOther: 'Sale of shares',
    purposeOfAccount: 'OTHER',
    purposeOfAccountOther: 'Investment',
    expectedOutgoingTxVolumeYearly: 'BETWEEN_5000_AND_10000_EUR',
    expectedIncomingTxVolumeYearly: 'BETWEEN_5000_AND_10000_EUR'
  }, 'Update User');

  // Step 3: verify email + mobile (sandbox accepts any code)
  await call('POST', '/user/verify-email',  { userId, verificationId: '123456' }, 'Verify Email');
  await call('POST', '/user/verify-mobile', { userId, verificationCode: '123456' }, 'Verify Mobile');

  // Step 4: start KYC
  await call('POST', '/user/kyc/start', { userId }, 'Start KYC');

  // Step 5a: simulate APPROVED
  await call('PATCH', '/simulate/user/kyc', { userId, status: 'APPROVED' }, 'Simulate KYC APPROVED');

  // Step 5b: get status
  r = await call('GET', `/user/kyc/${userId}`, {}, 'Check KYC status after simulate');
  console.log('\n>>> KYC status after simulate:', r.json?.status, '| currentTier:', r.json?.currentTier);

  return userId;
}

async function run() {
  const userId = await createApprovedUser();

  // ── WALLETS ───────────────────────────────────────────────────────────────
  let r = await call('POST', '/wallets/create', {
    userId, includeCustodyOnlyAssets: false
  }, 'FLOW 9 — Create Wallet');

  const walletId      = r.json?.walletId;
  const eurAccountId  = r.json?.accounts?.EUR?.accountId;
  const btcAccountId  = r.json?.accounts?.BTC?.accountId;

  if (!walletId) {
    console.log('\n⚠️  Wallet creation blocked. KYC approval still not working in sandbox.');
    console.log('Remaining flows that require wallet (10–17) cannot be tested without it.');
    return;
  }

  await call('POST', '/wallets/get/all', {
    userId,
    startDate: Date.now() - 86400000 * 30,
    endDate: Date.now(),
    page: 1
  }, 'FLOW 10 — Get All Wallets');

  // ── SIMULATE DEPOSIT ──────────────────────────────────────────────────────
  await call('PATCH', '/simulate/accounts/deposit', {
    accountId: eurAccountId, amount: '3200000'
  }, 'FLOW 11 — Simulate EUR Deposit');

  // ── STATEMENTS ────────────────────────────────────────────────────────────
  await call('POST', '/wallets/get/account/statement', {
    userId, accountId: eurAccountId,
    startDate: Date.now() - 86400000 * 7,
    endDate: Date.now(),
    page: 1
  }, 'FLOW 12 — Account Statement');

  // ── VIRTUAL CARD ──────────────────────────────────────────────────────────
  r = await call('POST', '/cards/create', {
    userId, cardType: 'VIRTUAL', linkedAccountId: eurAccountId
  }, 'FLOW 13 — Create Virtual Card');
  const cardId = r.json?.cardId ?? r.json?.id;

  if (cardId) {
    await call('POST', '/cards/get',     { userId, cardId }, 'FLOW 14a — Get Card');
    await call('POST', '/cards/block',   { userId, cardId }, 'FLOW 14b — Freeze Card');
    await call('POST', '/cards/unblock', { userId, cardId }, 'FLOW 14c — Unfreeze Card');
    await call('POST', '/simulate/card/authorization', { cardId, amountEURCents: 1000 }, 'FLOW 14d — Simulate Card Tx');
    await call('POST', '/cards/get/statement', {
      userId, cardId,
      startDate: Date.now() - 86400000 * 7,
      endDate: Date.now(),
      page: 1
    }, 'FLOW 14e — Card Statement');
  }

  // ── PHYSICAL CARD ─────────────────────────────────────────────────────────
  r = await call('POST', '/cards/create', {
    userId, cardType: 'PHYSICAL', linkedAccountId: eurAccountId
  }, 'FLOW 15 — Create Physical Card');

  // ── SEPA WITHDRAWAL ───────────────────────────────────────────────────────
  r = await call('POST', '/wallets/send/sepa', {
    userId,
    sourceAccountId: eurAccountId,
    amount: '100000',
    bankAccount: {
      bankAccountHolderName: 'Approved User',
      iban: 'EE382200221020145685',
      bic: 'HABAEE2X',
      country: 'EE',
      bankName: 'SEB Pank'
    }
  }, 'FLOW 16 — SEPA Withdrawal');
  const sepaTxId = r.json?.transactionId ?? r.json?.id;

  if (sepaTxId) {
    await call('PATCH', '/simulate/sepa', {
      transactionId: sepaTxId,
      accountId: eurAccountId,
      status: 'COMPLETED'
    }, 'FLOW 17 — Simulate SEPA Completed');
  }

  // ── WEBHOOK ───────────────────────────────────────────────────────────────
  await call('POST', '/simulate/webhook/ping', {
    payload: { msg: 'ping', type: 'TEST' }
  }, 'FLOW 18 — Webhook Ping');
}

run().catch(console.error);
