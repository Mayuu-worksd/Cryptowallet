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
  return { time: t, auth: `HMAC ${t}:${sig}`, bodyStr };
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
  let json;
  try { json = JSON.parse(txt); } catch { json = txt; }
  const ok = r.status >= 200 && r.status < 300;
  console.log(`\n[${r.status}] ${ok ? '✅' : '❌'} ${label}`);
  console.log(JSON.stringify(json, null, 2));
  return { status: r.status, json, ok };
}

const state = {};

async function run() {

  // 1. CREATE USER
  let r = await call('POST', '/user/create', {
    firstName: 'Eval', lastName: 'Tester',
    email: `eval_${Date.now()}@mailinator.com`,
    mobile: { countryCode: '+372', number: '56316716' }
  }, 'FLOW 1 — Create User');
  state.userId = r.json?.userId;
  if (!state.userId) { console.log('❌ Halted: no userId'); return; }

  // 2. UPDATE USER — all required fields, no placeOfBirth
  r = await call('PATCH', '/user/update', {
    userId: state.userId,
    selfPepDeclaration: true,
    dateOfBirth: { month: 1, day: 15, year: 2000 },
    address: { addressLine1: 'Sepapaja 12', city: 'Tallinn', country: 'EE', postalCode: '11412' },
    documentIssuingCountry: 'EE',
    nationality: 'EE',
    occupation: 'PRECIOUS_GOODS_JEWELRY',
    sourceOfFunds: 'OTHER',
    sourceOfFundsOther: 'Sale of shares',
    purposeOfAccount: 'OTHER',
    purposeOfAccountOther: 'To buy shares',
    expectedOutgoingTxVolumeYearly: 'BETWEEN_5000_AND_10000_EUR',
    expectedIncomingTxVolumeYearly: 'BETWEEN_5000_AND_10000_EUR'
  }, 'FLOW 2 — Update User (KYC fields)');

  // 3. GET USER
  await call('GET', `/user/${state.userId}`, {}, 'FLOW 3 — Get User By Id');

  // 4. VERIFY EMAIL
  await call('POST', '/user/verify-email', {
    userId: state.userId, verificationId: '123456'
  }, 'FLOW 4 — Verify Email');

  // 5. VERIFY MOBILE
  await call('POST', '/user/verify-mobile', {
    userId: state.userId, verificationCode: '123456'
  }, 'FLOW 5 — Verify Mobile');

  // 6. START KYC
  r = await call('POST', '/user/kyc/start', { userId: state.userId }, 'FLOW 6 — Start KYC');
  state.kycToken = r.json?.token;

  // 7. SIMULATE KYC APPROVED
  await call('PATCH', '/simulate/user/kyc', {
    userId: state.userId, status: 'APPROVED'
  }, 'FLOW 7 — Simulate KYC Approved');

  // 8. GET KYC STATUS
  r = await call('GET', `/user/kyc/${state.userId}`, {}, 'FLOW 8 — Get KYC Status');
  state.kycStatus = r.json?.status;

  // 9. CREATE WALLET
  r = await call('POST', '/wallets/create', {
    userId: state.userId, includeCustodyOnlyAssets: false
  }, 'FLOW 9 — Create Wallet');
  state.walletId      = r.json?.walletId;
  state.eurAccountId  = r.json?.accounts?.EUR?.accountId;
  state.btcAccountId  = r.json?.accounts?.BTC?.accountId;
  state.ethAccountId  = r.json?.accounts?.ETH?.accountId;

  // 10. GET ALL WALLETS
  await call('POST', '/wallets/get/all', {
    userId: state.userId,
    startDate: Date.now() - 86400000 * 30,
    endDate: Date.now(),
    page: 1
  }, 'FLOW 10 — Get All Wallets');

  // 11. SIMULATE DEPOSIT (EUR)
  if (state.eurAccountId) {
    await call('PATCH', '/simulate/accounts/deposit', {
      accountId: state.eurAccountId, amount: '3200000'
    }, 'FLOW 11 — Simulate EUR Deposit (3200000 cents = €32000)');
  }

  // 12. ACCOUNT STATEMENT
  if (state.eurAccountId) {
    await call('POST', '/wallets/get/account/statement', {
      userId: state.userId,
      accountId: state.eurAccountId,
      startDate: Date.now() - 86400000 * 7,
      endDate: Date.now(),
      page: 1
    }, 'FLOW 12 — Get Account Statement');
  }

  // 13. VIRTUAL CARD
  if (state.eurAccountId) {
    r = await call('POST', '/cards/create', {
      userId: state.userId,
      cardType: 'VIRTUAL',
      linkedAccountId: state.eurAccountId
    }, 'FLOW 13 — Create Virtual Card');
    state.virtualCardId = r.json?.cardId ?? r.json?.id;
  }

  // 14a. GET CARD
  if (state.virtualCardId) {
    await call('POST', '/cards/get', {
      userId: state.userId, cardId: state.virtualCardId
    }, 'FLOW 14a — Get Card Details');
  }

  // 14b. FREEZE
  if (state.virtualCardId) {
    await call('POST', '/cards/block', {
      userId: state.userId, cardId: state.virtualCardId
    }, 'FLOW 14b — Freeze Card');
  }

  // 14c. UNFREEZE
  if (state.virtualCardId) {
    await call('POST', '/cards/unblock', {
      userId: state.userId, cardId: state.virtualCardId
    }, 'FLOW 14c — Unfreeze Card');
  }

  // 14d. SIMULATE CARD TRANSACTION
  if (state.virtualCardId) {
    await call('POST', '/simulate/card/authorization', {
      cardId: state.virtualCardId, amountEURCents: 1000
    }, 'FLOW 14d — Simulate Card Transaction (€10)');
  }

  // 14e. CARD STATEMENT
  if (state.virtualCardId) {
    await call('POST', '/cards/get/statement', {
      userId: state.userId, cardId: state.virtualCardId,
      startDate: Date.now() - 86400000 * 7,
      endDate: Date.now(),
      page: 1
    }, 'FLOW 14e — Card Statement');
  }

  // 15. PHYSICAL CARD
  if (state.eurAccountId) {
    r = await call('POST', '/cards/create', {
      userId: state.userId,
      cardType: 'PHYSICAL',
      linkedAccountId: state.eurAccountId
    }, 'FLOW 15 — Create Physical Card');
    state.physicalCardId = r.json?.cardId ?? r.json?.id;
  }

  // 16. SEPA WITHDRAWAL
  if (state.eurAccountId) {
    r = await call('POST', '/wallets/send/sepa', {
      userId: state.userId,
      sourceAccountId: state.eurAccountId,
      amount: '100000',
      bankAccount: {
        bankAccountHolderName: 'Eval Tester',
        iban: 'EE382200221020145685',
        bic: 'HABAEE2X',
        country: 'EE',
        bankName: 'SEB Pank'
      }
    }, 'FLOW 16 — Initiate SEPA Withdrawal');
    state.sepaTxId = r.json?.transactionId ?? r.json?.id;
  }

  // 17. SIMULATE SEPA COMPLETED
  if (state.sepaTxId && state.eurAccountId) {
    await call('PATCH', '/simulate/sepa', {
      transactionId: state.sepaTxId,
      accountId: state.eurAccountId,
      status: 'COMPLETED'
    }, 'FLOW 17 — Simulate SEPA Completed');
  }

  // 18. WEBHOOK PING
  await call('POST', '/simulate/webhook/ping', {
    payload: { msg: 'Test webhook ping', type: 'TEST' }
  }, 'FLOW 18 — Send Test Webhook Ping');

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  console.log('\n\n══════════════════════════════════════════');
  console.log('EVALUATION STATE SUMMARY');
  console.log('══════════════════════════════════════════');
  console.log(JSON.stringify(state, null, 2));
}

run().catch(console.error);
