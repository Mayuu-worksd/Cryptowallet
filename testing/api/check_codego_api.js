require('dotenv').config({ path: './admin-dashboard/.env.local' });

const CODEGO_API_KEY = process.env.CODEGO_API_KEY;
const CODEGO_API_URL = process.env.CODEGO_API_URL;

console.log('Testing Codego API URL:', CODEGO_API_URL);

async function testWithBearer() {
  try {
    const response = await fetch(`${CODEGO_API_URL}/users`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CODEGO_API_KEY}`
      }
    });
    console.log('Bearer test status:', response.status);
    const text = await response.text();
    console.log('Bearer test response:', text.slice(0, 300));
  } catch (err) {
    console.error('Bearer test failed:', err);
  }
}

async function testWithXApiKey() {
  try {
    const response = await fetch(`${CODEGO_API_URL}/users`, {
      method: 'GET',
      headers: {
        'X-Api-Key': CODEGO_API_KEY
      }
    });
    console.log('X-Api-Key test status:', response.status);
    const text = await response.text();
    console.log('X-Api-Key test response:', text.slice(0, 300));
  } catch (err) {
    console.error('X-Api-Key test failed:', err);
  }
}

async function run() {
  console.log('--- RUNNING BEARER AUTH TEST ---');
  await testWithBearer();
  console.log('\n--- RUNNING X-API-KEY AUTH TEST ---');
  await testWithXApiKey();
}

run();
