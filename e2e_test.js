/**
 * E2E INTEGRATION TEST — CODEGO + SUPABASE + ADMIN DASHBOARD
 * Run: node e2e_test.js
 * No mocking. Real HTTP. Real DB queries. Real responses.
 */

const SUPABASE_URL     = 'https://hxmacphgbpedazdvgdnz.supabase.co';
const SUPABASE_ANON    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bWFjcGhnYnBlZGF6ZHZnZG56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMDIyNjAsImV4cCI6MjA5MjY3ODI2MH0.CPQgakkjwT6N7DX1B56yPEVjGe9H9jjMCWCBCC0qM1M';
const SUPABASE_SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bWFjcGhnYnBlZGF6ZHZnZG56Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEwMjI2MCwiZXhwIjoyMDkyNjc4MjYwfQ.vZ1uvQ8R_zu8ZjVZtyRSiGKMaACTmc6T0WgHx2_LE80';
const ADMIN_URL        = process.env.ADMIN_URL || 'http://localhost:3001';
const CODEGO_KEY       = 'vcck_sbx_f119144ea2221e4796778de28115c4cad97429da86e66552';
const CODEGO_URL       = 'https://vcc-sandbox.codegotech.com/api/v1';

const results = [];

function log(section, status, data) {
  const line = { section, status, data };
  results.push(line);
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : status === 'PARTIAL' ? '⚠️' : 'ℹ️';
  console.log(`\n${icon} [${status}] ${section}`);
  if (typeof data === 'object') {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(data);
  }
}

async function supabaseQuery(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
    headers: {
      'apikey': SUPABASE_SERVICE,
      'Authorization': `Bearer ${SUPABASE_SERVICE}`,
      'Content-Type': 'application/json',
    }
  });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: text }; }
}

async function supabasePatch(table, params, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_SERVICE,
      'Authorization': `Bearer ${SUPABASE_SERVICE}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: text }; }
}

async function codegoCall(method, path, body) {
  const res = await fetch(`${CODEGO_URL}${path}`, {
    method,
    headers: { 'X-Api-Key': CODEGO_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: text }; }
}

async function adminCall(method, path, body, auth) {
  const res = await fetch(`${ADMIN_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { 'Cookie': auth } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: text.slice(0, 500) }; }
}

async function run() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   CRYPTOWALLET — CODEGO E2E INTEGRATION TEST');
  console.log('   ' + new Date().toISOString());
  console.log('═══════════════════════════════════════════════════════');

  // ─────────────────────────────────────────────────────────
  // STEP 1: Find a KYC-verified user
  // ─────────────────────────────────────────────────────────
  console.log('\n\n══ STEP 1: FIND VERIFIED KYC USER ══');

  const kycRes = await supabaseQuery('kyc', '?status=eq.verified&order=updated_at.desc&limit=5&select=id,wallet_address,full_name,email,phone,dob,address,nationality,status,codego_cardholder_id');
  
  if (kycRes.status !== 200 || !Array.isArray(kycRes.data) || kycRes.data.length === 0) {
    log('KYC User Lookup', 'FAIL', { httpStatus: kycRes.status, response: kycRes.data });
    console.log('\n❌ FATAL: No verified KYC users found. Cannot continue.');
    return;
  }

  const kycUser = kycRes.data[0];
  log('KYC User Found', 'PASS', {
    wallet_address: kycUser.wallet_address,
    full_name: kycUser.full_name,
    email: kycUser.email,
    status: kycUser.status,
    codego_cardholder_id: kycUser.codego_cardholder_id || 'NOT SET',
  });

  const WALLET = kycUser.wallet_address;

  // ─────────────────────────────────────────────────────────
  // STEP 2: Check existing vcc_cards record
  // ─────────────────────────────────────────────────────────
  console.log('\n\n══ STEP 2: CHECK EXISTING VCC_CARDS RECORD ══');

  const vccRes = await supabaseQuery('vcc_cards', `?wallet_address=eq.${WALLET}&select=*`);
  
  if (vccRes.status === 200 && Array.isArray(vccRes.data) && vccRes.data.length > 0) {
    const existingCard = vccRes.data[0];
    log('Existing vcc_cards record', 'INFO', {
      id: existingCard.id,
      wallet_address: existingCard.wallet_address,
      card_last4: existingCard.card_last4,
      card_status: existingCard.card_status,
      codego_card_id: existingCard.codego_card_id || 'NOT SYNCED',
      codego_status: existingCard.codego_status || 'N/A',
      is_physical: existingCard.is_physical,
      created_at: existingCard.created_at,
    });
  } else {
    log('Existing vcc_cards record', 'INFO', 'No card found for this wallet — will create fresh');
  }

  // ─────────────────────────────────────────────────────────
  // STEP 3: Check if codego_cardholder_id column exists on kyc
  // ─────────────────────────────────────────────────────────
  console.log('\n\n══ STEP 3: VERIFY SCHEMA MIGRATION RAN ══');

  const schemaCheck = await supabaseQuery('kyc', `?wallet_address=eq.${WALLET}&select=codego_cardholder_id&limit=1`);
  
  if (schemaCheck.status === 200) {
    log('codego_cardholder_id column exists on kyc', 'PASS', schemaCheck.data);
  } else {
    log('codego_cardholder_id column missing — migration NOT run', 'FAIL', schemaCheck.data);
  }

  const vccSchemaCheck = await supabaseQuery('vcc_cards', `?wallet_address=eq.${WALLET}&select=codego_card_id,codego_status&limit=1`);
  
  if (vccSchemaCheck.status === 200) {
    log('codego_card_id + codego_status columns exist on vcc_cards', 'PASS', vccSchemaCheck.data);
  } else {
    log('codego_card_id / codego_status columns missing — migration NOT run', 'FAIL', vccSchemaCheck.data);
  }

  // ─────────────────────────────────────────────────────────
  // STEP 4: Call Admin Dashboard — Create Codego Cardholder
  // ─────────────────────────────────────────────────────────
  console.log('\n\n══ STEP 4: CREATE CODEGO CARDHOLDER (via admin API) ══');

  const cardholderPayload = { walletAddress: WALLET };
  log('Request payload', 'INFO', { url: `${ADMIN_URL}/api/codego/cardholders`, method: 'POST', body: cardholderPayload });

  const cardholderRes = await adminCall('POST', '/api/codego/cardholders', cardholderPayload);
  log('Codego Cardholder API Response', cardholderRes.status === 200 || cardholderRes.status === 201 ? 'PASS' : 'FAIL', {
    httpStatus: cardholderRes.status,
    response: cardholderRes.data,
  });

  // Re-check kyc table for codego_cardholder_id
  const kycAfter = await supabaseQuery('kyc', `?wallet_address=eq.${WALLET}&select=codego_cardholder_id&limit=1`);
  const cardholderId = kycAfter.data?.[0]?.codego_cardholder_id;
  log('codego_cardholder_id in Supabase after call', cardholderId ? 'PASS' : 'FAIL', {
    codego_cardholder_id: cardholderId || 'STILL NULL',
  });

  // ─────────────────────────────────────────────────────────
  // STEP 5: Call Codego directly — GET /users/{id}
  // ─────────────────────────────────────────────────────────
  console.log('\n\n══ STEP 5: VERIFY USER IN CODEGO DIRECTLY ══');

  if (cardholderId) {
    const codegoUserRes = await codegoCall('GET', `/users/${cardholderId}`);
    log('GET /users/{id} from Codego', codegoUserRes.status === 200 ? 'PASS' : 'FAIL', {
      httpStatus: codegoUserRes.status,
      response: codegoUserRes.data,
    });
  } else {
    log('GET /users/{id} — skipped (no cardholder ID)', 'FAIL', 'cardholderId is null');
  }

  // ─────────────────────────────────────────────────────────
  // STEP 6: Create Virtual Card via Admin API
  // ─────────────────────────────────────────────────────────
  console.log('\n\n══ STEP 6: CREATE VIRTUAL CARD (via admin API) ══');

  const cardPayload = {
    walletAddress: WALLET,
    type: 'virtual',
    variant: 'classic',
    nameOnCard: kycUser.full_name || 'TEST USER',
  };
  log('Request payload', 'INFO', { url: `${ADMIN_URL}/api/codego/cards`, method: 'POST', body: cardPayload });

  const cardCreateRes = await adminCall('POST', '/api/codego/cards', cardPayload);
  log('Virtual Card Creation API Response', (cardCreateRes.status === 200 || cardCreateRes.status === 201) ? 'PASS' : 'FAIL', {
    httpStatus: cardCreateRes.status,
    response: cardCreateRes.data,
  });

  // ─────────────────────────────────────────────────────────
  // STEP 7: Verify card in Supabase vcc_cards
  // ─────────────────────────────────────────────────────────
  console.log('\n\n══ STEP 7: VERIFY CARD IN SUPABASE (vcc_cards) ══');

  const vccAfter = await supabaseQuery('vcc_cards', `?wallet_address=eq.${WALLET}&select=*&order=created_at.desc&limit=1`);
  
  if (vccAfter.status === 200 && vccAfter.data?.length > 0) {
    const card = vccAfter.data[0];
    const hasCodego = !!card.codego_card_id;
    log('vcc_cards record in Supabase', hasCodego ? 'PASS' : 'PARTIAL', {
      id: card.id,
      wallet_address: card.wallet_address,
      card_last4: card.card_last4,
      card_holder_name: card.card_holder_name,
      card_status: card.card_status,
      card_network: card.card_network,
      card_variant: card.card_variant,
      codego_card_id: card.codego_card_id || 'NOT SYNCED TO CODEGO',
      codego_status: card.codego_status || 'N/A',
      is_physical: card.is_physical,
      created_at: card.created_at,
    });

    // Store codego_card_id for further tests
    global.TEST_CARD = card;
    global.CODEGO_CARD_ID = card.codego_card_id;
  } else {
    log('vcc_cards in Supabase', 'FAIL', { status: vccAfter.status, data: vccAfter.data });
  }

  // ─────────────────────────────────────────────────────────
  // STEP 8: Verify card in Codego directly (GET /cards)
  // ─────────────────────────────────────────────────────────
  console.log('\n\n══ STEP 8: VERIFY CARD IN CODEGO (GET /cards) ══');

  const codegoCardsRes = await codegoCall('GET', '/cards');
  log('GET /cards from Codego sandbox', codegoCardsRes.status === 200 ? 'PASS' : 'FAIL', {
    httpStatus: codegoCardsRes.status,
    total_cards: Array.isArray(codegoCardsRes.data) ? codegoCardsRes.data.length : 'N/A',
    cards: Array.isArray(codegoCardsRes.data) ? codegoCardsRes.data : codegoCardsRes.data,
  });

  // If we have a codego_card_id, fetch it specifically
  if (global.CODEGO_CARD_ID) {
    const codegoSingleCard = await codegoCall('GET', `/cards/${global.CODEGO_CARD_ID}`);
    log('GET /cards/{id} from Codego', codegoSingleCard.status === 200 ? 'PASS' : 'FAIL', {
      httpStatus: codegoSingleCard.status,
      response: codegoSingleCard.data,
    });
  }

  // ─────────────────────────────────────────────────────────
  // STEP 9: Verify card in Admin Dashboard API
  // ─────────────────────────────────────────────────────────
  console.log('\n\n══ STEP 9: VERIFY CARD IN ADMIN DASHBOARD API ══');

  const adminCardsRes = await adminCall('GET', `/api/codego/cards?walletAddress=${WALLET}`);
  log('Admin Dashboard GET /api/codego/cards', adminCardsRes.status === 200 ? 'PASS' : 'FAIL', {
    httpStatus: adminCardsRes.status,
    response: adminCardsRes.data,
  });

  const adminPhysicalRes = await adminCall('GET', '/api/admin/physical-cards');
  log('Admin Dashboard GET /api/admin/physical-cards', adminPhysicalRes.status === 200 ? 'PASS' : 'FAIL', {
    httpStatus: adminPhysicalRes.status,
    total: adminPhysicalRes.data?.cards?.length ?? 'N/A',
    sample: adminPhysicalRes.data?.cards?.slice(0, 2) ?? adminPhysicalRes.data,
  });

  // ─────────────────────────────────────────────────────────
  // STEP 10: Physical Card Request
  // ─────────────────────────────────────────────────────────
  console.log('\n\n══ STEP 10: PHYSICAL CARD REQUEST ══');

  // Check if a physical card already exists
  const physicalCheck = await supabaseQuery('vcc_cards', `?wallet_address=eq.${WALLET}&is_physical=eq.true&select=id,card_status,physical_shipping_status,created_at`);
  
  if (physicalCheck.data?.length > 0) {
    log('Physical card already exists in vcc_cards', 'INFO', physicalCheck.data[0]);
  } else {
    // Create a physical card request via admin API
    const physicalPayload = {
      walletAddress: WALLET,
      type: 'physical',
      variant: 'classic',
      nameOnCard: kycUser.full_name || 'TEST USER',
    };
    log('Physical Card Request payload', 'INFO', physicalPayload);

    const physicalRes = await adminCall('POST', '/api/codego/cards', physicalPayload);
    log('Physical Card Request Response', (physicalRes.status === 200 || physicalRes.status === 201 || physicalRes.status === 422) ? 'PARTIAL' : 'FAIL', {
      httpStatus: physicalRes.status,
      response: physicalRes.data,
    });
  }

  // Verify physical card in DB
  const physicalDB = await supabaseQuery('vcc_cards', `?wallet_address=eq.${WALLET}&is_physical=eq.true&select=id,card_status,physical_shipping_status,codego_card_id,created_at&order=created_at.desc&limit=1`);
  log('Physical card in vcc_cards (Supabase)', physicalDB.data?.length > 0 ? 'PASS' : 'FAIL', physicalDB.data?.[0] || 'No record found');

  // ─────────────────────────────────────────────────────────
  // STEP 11: Freeze Card
  // ─────────────────────────────────────────────────────────
  console.log('\n\n══ STEP 11: FREEZE CARD ══');

  const cardToFreeze = global.TEST_CARD;

  if (!cardToFreeze) {
    log('Freeze Card', 'FAIL', 'No card record found from Step 7');
  } else if (cardToFreeze.codego_card_id) {
    // Has Codego ID — call admin API status endpoint
    const freezePayload = { status: 'frozen' };
    log('Freeze Request payload', 'INFO', { url: `${ADMIN_URL}/api/codego/cards/${cardToFreeze.codego_card_id}/status`, body: freezePayload });

    const freezeRes = await adminCall('PATCH', `/api/codego/cards/${cardToFreeze.codego_card_id}/status`, freezePayload);
    log('Freeze via Admin API (Codego PATCH /cards/{id})', freezeRes.status === 200 ? 'PASS' : 'FAIL', {
      httpStatus: freezeRes.status,
      response: freezeRes.data,
    });

    // Verify in Supabase
    const freezeCheck = await supabaseQuery('vcc_cards', `?id=eq.${cardToFreeze.id}&select=card_status,codego_status`);
    log('Freeze verified in Supabase vcc_cards', freezeCheck.data?.[0]?.card_status === 'frozen' ? 'PASS' : 'FAIL', {
      card_status: freezeCheck.data?.[0]?.card_status,
      codego_status: freezeCheck.data?.[0]?.codego_status,
    });
  } else {
    // No Codego ID — freeze locally in Supabase only
    log('Freeze Card — no codego_card_id, freezing in Supabase only', 'PARTIAL', 'Card not synced to Codego');
    const freezeLocal = await supabasePatch('vcc_cards', `?id=eq.${cardToFreeze.id}`, { card_status: 'frozen' });
    log('Local freeze in Supabase', freezeLocal.status === 200 ? 'PASS' : 'FAIL', {
      httpStatus: freezeLocal.status,
      response: freezeLocal.data,
    });
  }

  // ─────────────────────────────────────────────────────────
  // STEP 12: Unfreeze Card
  // ─────────────────────────────────────────────────────────
  console.log('\n\n══ STEP 12: UNFREEZE CARD ══');

  if (!cardToFreeze) {
    log('Unfreeze Card', 'FAIL', 'No card record found');
  } else if (cardToFreeze.codego_card_id) {
    const unfreezePayload = { status: 'active' };
    log('Unfreeze Request payload', 'INFO', { url: `${ADMIN_URL}/api/codego/cards/${cardToFreeze.codego_card_id}/status`, body: unfreezePayload });

    const unfreezeRes = await adminCall('PATCH', `/api/codego/cards/${cardToFreeze.codego_card_id}/status`, unfreezePayload);
    log('Unfreeze via Admin API', unfreezeRes.status === 200 ? 'PASS' : 'FAIL', {
      httpStatus: unfreezeRes.status,
      response: unfreezeRes.data,
    });

    // Verify in Supabase
    const unfreezeCheck = await supabaseQuery('vcc_cards', `?id=eq.${cardToFreeze.id}&select=card_status,codego_status`);
    log('Unfreeze verified in Supabase vcc_cards', unfreezeCheck.data?.[0]?.card_status === 'active' ? 'PASS' : 'FAIL', {
      card_status: unfreezeCheck.data?.[0]?.card_status,
      codego_status: unfreezeCheck.data?.[0]?.codego_status,
    });
  } else {
    const unfreezeLocal = await supabasePatch('vcc_cards', `?id=eq.${cardToFreeze.id}`, { card_status: 'active' });
    log('Local unfreeze in Supabase', unfreezeLocal.status === 200 ? 'PASS' : 'FAIL', {
      httpStatus: unfreezeLocal.status,
      response: unfreezeLocal.data,
    });
  }

  // ─────────────────────────────────────────────────────────
  // STEP 13: Check Webhook Log
  // ─────────────────────────────────────────────────────────
  console.log('\n\n══ STEP 13: CHECK CODEGO WEBHOOKS LOG ══');

  const webhookLog = await supabaseQuery('codego_webhooks_log', '?order=created_at.desc&limit=5&select=*');
  log('codego_webhooks_log in Supabase', webhookLog.status === 200 ? 'PASS' : 'FAIL', {
    httpStatus: webhookLog.status,
    total: Array.isArray(webhookLog.data) ? webhookLog.data.length : 'N/A',
    entries: webhookLog.data,
  });

  // ─────────────────────────────────────────────────────────
  // STEP 14: Check Fiat Queue in Admin Dashboard API
  // ─────────────────────────────────────────────────────────
  console.log('\n\n══ STEP 14: FIAT QUEUE IN ADMIN DASHBOARD ══');

  const fiatQueue = await adminCall('GET', '/api/admin/fiat-queues');
  log('Admin Dashboard GET /api/admin/fiat-queues', fiatQueue.status === 200 ? 'PASS' : 'FAIL', {
    httpStatus: fiatQueue.status,
    total: fiatQueue.data?.requests?.length ?? 'N/A',
    sample: fiatQueue.data?.requests?.slice(0, 2) ?? fiatQueue.data,
  });

  // ─────────────────────────────────────────────────────────
  // FINAL SUMMARY
  // ─────────────────────────────────────────────────────────
  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('   FINAL TEST REPORT');
  console.log('═══════════════════════════════════════════════════════');

  const pass    = results.filter(r => r.status === 'PASS').length;
  const fail    = results.filter(r => r.status === 'FAIL').length;
  const partial = results.filter(r => r.status === 'PARTIAL').length;
  const info    = results.filter(r => r.status === 'INFO').length;

  console.log(`\nTotal checks : ${results.length}`);
  console.log(`✅ PASS      : ${pass}`);
  console.log(`❌ FAIL      : ${fail}`);
  console.log(`⚠️  PARTIAL   : ${partial}`);
  console.log(`ℹ️  INFO      : ${info}`);

  console.log('\n── Per-Feature Status ──');
  const features = [
    { name: 'KYC user lookup',             keys: ['KYC User Found'] },
    { name: 'Schema migration',            keys: ['codego_cardholder_id column exists on kyc', 'codego_card_id + codego_status columns exist on vcc_cards'] },
    { name: 'Codego cardholder creation',  keys: ['Codego Cardholder API Response', 'codego_cardholder_id in Supabase after call'] },
    { name: 'Virtual card creation',       keys: ['Virtual Card Creation API Response', 'vcc_cards record in Supabase'] },
    { name: 'Card in Codego dashboard',    keys: ['GET /cards from Codego sandbox'] },
    { name: 'Card in Admin Dashboard',     keys: ['Admin Dashboard GET /api/codego/cards', 'Admin Dashboard GET /api/admin/physical-cards'] },
    { name: 'Physical card request',       keys: ['Physical card in vcc_cards (Supabase)'] },
    { name: 'Freeze card',                 keys: ['Freeze via Admin API (Codego PATCH /cards/{id})', 'Freeze verified in Supabase vcc_cards', 'Local freeze in Supabase'] },
    { name: 'Unfreeze card',               keys: ['Unfreeze via Admin API', 'Unfreeze verified in Supabase vcc_cards', 'Local unfreeze in Supabase'] },
    { name: 'Webhook log',                 keys: ['codego_webhooks_log in Supabase'] },
    { name: 'Fiat queue',                  keys: ['Admin Dashboard GET /api/admin/fiat-queues'] },
  ];

  features.forEach(f => {
    const relevant = results.filter(r => f.keys.includes(r.section));
    let overall;
    if (relevant.every(r => r.status === 'PASS'))         overall = '✅ WORKING';
    else if (relevant.some(r => r.status === 'PASS'))     overall = '⚠️  PARTIALLY WORKING';
    else if (relevant.some(r => r.status === 'PARTIAL'))  overall = '⚠️  PARTIALLY WORKING';
    else if (relevant.length === 0)                       overall = 'ℹ️  NOT TESTED';
    else                                                   overall = '❌ NOT WORKING';
    console.log(`  ${overall.padEnd(28)} ${f.name}`);
  });

  console.log('\n═══════════════════════════════════════════════════════\n');
}

run().catch(e => {
  console.error('\n💥 UNHANDLED ERROR:', e.message);
  process.exit(1);
});
