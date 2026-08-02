require('dotenv').config({ path: './admin-dashboard/.env.local' });

const CODEGO_API_KEY = process.env.CODEGO_API_KEY;
const CODEGO_API_URL = process.env.CODEGO_API_URL;

async function testPost(endpoint, headers) {
  try {
    const res = await fetch(`${CODEGO_API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify({
        email: 'test' + Math.floor(Math.random() * 10000) + '@example.com',
        firstName: 'Test',
        lastName: 'User',
      })
    });
    console.log(`POST ${endpoint} -> Status: ${res.status}`);
    const text = await res.text();
    console.log(`POST ${endpoint} -> Response:`, text.slice(0, 300));
  } catch (err) {
    console.error(`POST ${endpoint} failed:`, err.message);
  }
}

async function run() {
  console.log('--- Testing /users with X-Api-Key ---');
  await testPost('/users', { 'X-Api-Key': CODEGO_API_KEY });
  console.log('--- Testing /users with Authorization Bearer ---');
  await testPost('/users', { 'Authorization': `Bearer ${CODEGO_API_KEY}` });

  console.log('--- Testing /cardholders with X-Api-Key ---');
  await testPost('/cardholders', { 'X-Api-Key': CODEGO_API_KEY });
  console.log('--- Testing /cardholders with Authorization Bearer ---');
  await testPost('/cardholders', { 'Authorization': `Bearer ${CODEGO_API_KEY}` });

  console.log('--- Testing /cards with X-Api-Key ---');
  await testPost('/cards', { 'X-Api-Key': CODEGO_API_KEY });
}

run();
