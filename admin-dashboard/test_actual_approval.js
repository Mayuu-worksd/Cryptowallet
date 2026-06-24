const CODEGO_API_KEY = 'vcck_sbx_f119144ea2221e4796778de28115c4cad97429da86e66552';
const CODEGO_API_URL = 'https://vcc-sandbox.codegotech.com/api/v1';

const headers = {
  'X-Api-Key': CODEGO_API_KEY,
  'Content-Type': 'application/json',
};

const appId = 'df565811-106a-418e-9695-d1b24132226f'; // Aakash Chopra's application ID

async function callApi(method, path, body) {
  try {
    const res = await fetch(`${CODEGO_API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    console.log(`[${res.status}] ${method} ${path}`);
    const text = await res.text();
    console.log(`Response:`, text.slice(0, 400));
  } catch (err) {
    console.error(`Failed:`, err.message);
  }
}

async function run() {
  console.log('--- Test PATCH /applications/{appId} ---');
  await callApi('PATCH', `/applications/${appId}`, { applicationStatus: 'approved' });
  await callApi('PATCH', `/applications/${appId}`, { status: 'approved' });

  console.log('--- Test POST /applications/{appId}/approve ---');
  await callApi('POST', `/applications/${appId}/approve`, {});
  await callApi('POST', `/applications/${appId}/verify`, {});
  await callApi('POST', `/applications/${appId}/bypass`, {});

  console.log('--- Test PUT /applications/{appId} ---');
  await callApi('PUT', `/applications/${appId}`, { applicationStatus: 'approved' });
}

run();
