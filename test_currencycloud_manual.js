/**
 * Currencycloud API Manual Testing Script
 * 
 * Instructions:
 * 1. Open your terminal in this workspace.
 * 2. Run: node test_currencycloud_manual.js
 */

const DEV_URL = 'https://devapi.currencycloud.com/v2';
const LOGIN_ID = 'dev@thegetnow.com';
const API_KEY = 'dd56c35b20b33e2cab51e6f8f63b60338694c397f176f31757964da7d06c1a02';

async function runManualTests() {
  console.log('==========================================================');
  console.log('STARTING MANUAL CURRENCYCLOUD API VERIFICATION...');
  console.log('==========================================================');

  // STEP 1: AUTHENTICATION
  console.log('\n[1/5] Authenticating...');
  let token = '';
  try {
    const params = new URLSearchParams();
    params.append('login_id', LOGIN_ID);
    params.append('api_key', API_KEY);

    const response = await fetch(`${DEV_URL}/authenticate/api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    if (!response.ok) {
      throw new Error(`Authentication failed with status ${response.status}`);
    }

    const data = await response.json();
    token = data.auth_token;
    console.log(`✅ Success! Auth Token Obtained: ${token}`);
  } catch (error) {
    console.error(`❌ Authentication Error: ${error.message}`);
    return;
  }

  const getHeaders = { 'X-Auth-Token': token };
  const postHeaders = {
    'X-Auth-Token': token,
    'Content-Type': 'application/x-www-form-urlencoded'
  };

  // STEP 2: GET ACCOUNT & BALANCE
  console.log('\n[2/5] Fetching Account and Balance Details...');
  try {
    const accountRes = await fetch(`${DEV_URL}/accounts/current`, { headers: getHeaders });
    const accountData = await accountRes.json();
    console.log(`✅ Account Name: ${accountData.account_name} (Status: ${accountData.status})`);
    console.log(`✅ Process Third Party Funds Allowed?: ${accountData.process_third_party_funds}`);

    const balanceRes = await fetch(`${DEV_URL}/balances/find`, { headers: getHeaders });
    const balanceData = await balanceRes.json();
    console.log('✅ Active Balances:', JSON.stringify(balanceData.balances, null, 2));
  } catch (error) {
    console.error(`❌ Account/Balance Fetch Error: ${error.message}`);
  }

  // STEP 3: FX & DETAILED RATE
  console.log('\n[3/5] Requesting tradeable detailed quote for EUR -> GBP...');
  try {
    const rateRes = await fetch(`${DEV_URL}/rates/detailed?buy_currency=EUR&sell_currency=GBP&fixed_side=buy&amount=100`, { headers: getHeaders });
    const rateData = await rateRes.json();
    if (rateRes.ok) {
      console.log(`✅ Quote Successful!`);
      console.log(`   Buy: ${rateData.client_buy_amount} ${rateData.client_buy_currency}`);
      console.log(`   Sell: ${rateData.client_sell_amount} ${rateData.client_sell_currency}`);
      console.log(`   Rate: ${rateData.client_rate}`);
    } else {
      console.log(`❌ Quote Failed:`, rateData);
    }
  } catch (error) {
    console.error(`❌ FX Quote Error: ${error.message}`);
  }

  // STEP 4: BENEFICIARY VALIDATION
  console.log('\n[4/5] Validating a mock beneficiary for GBP...');
  try {
    const beneParams = new URLSearchParams();
    beneParams.append('bank_country', 'GB');
    beneParams.append('currency', 'GBP');
    beneParams.append('bank_account_holder_name', 'Jane Doe');
    beneParams.append('account_number', '98765432');
    beneParams.append('routing_code_type_1', 'sort_code');
    beneParams.append('routing_code_value_1', '101010');
    beneParams.append('beneficiary_entity_type', 'individual');
    beneParams.append('beneficiary_address', '1 Sheldon Square');
    beneParams.append('beneficiary_country', 'GB');

    const validateRes = await fetch(`${DEV_URL}/beneficiaries/validate`, {
      method: 'POST',
      headers: postHeaders,
      body: beneParams
    });
    const validateData = await validateRes.json();
    
    if (validateRes.ok) {
      console.log(`✅ Beneficiary fields are valid!`);
    } else {
      console.log(`❌ Beneficiary validation failed:`, validateData);
    }
  } catch (error) {
    console.error(`❌ Beneficiary Validation Error: ${error.message}`);
  }

  // STEP 5: CLOSING SESSION
  console.log('\n[5/5] Invalidating session / closing token...');
  try {
    const closeRes = await fetch(`${DEV_URL}/authenticate/close_session`, {
      method: 'POST',
      headers: getHeaders
    });
    if (closeRes.status === 200 || closeRes.status === 204) {
      console.log(`✅ Session closed successfully.`);
    } else {
      console.log(`❌ Failed to close session (Status: ${closeRes.status})`);
    }
  } catch (error) {
    console.error(`❌ Close Session Error: ${error.message}`);
  }

  console.log('\n==========================================================');
  console.log('MANUAL TESTING COMPLETED.');
  console.log('==========================================================');
}

runManualTests();
