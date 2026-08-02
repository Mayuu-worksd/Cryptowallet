require('dotenv').config({ path: './admin-dashboard/.env.local' });

const CODEGO_API_KEY = process.env.CODEGO_API_KEY;
const CODEGO_API_URL = process.env.CODEGO_API_URL;

const endpoints = [
  '/users',
  '/cardholders',
  '/cards',
  '/applications',
  '/transfers',
  '/transfers/outgoing',
  '/accounts',
];

async function probe() {
  for (const ep of endpoints) {
    try {
      const res = await fetch(`${CODEGO_API_URL}${ep}`, {
        method: 'GET',
        headers: {
          'X-Api-Key': CODEGO_API_KEY,
          'Authorization': `Bearer ${CODEGO_API_KEY}`
        }
      });
      console.log(`GET ${ep} -> Status: ${res.status}`);
      const text = await res.text();
      console.log(`GET ${ep} -> Response:`, text.slice(0, 200));
    } catch (err) {
      console.error(`GET ${ep} failed:`, err.message);
    }
  }
}

probe();
