const crypto = require('crypto');

const apiKey = 'S51YApQME2DWA0zkceJFlzaGTtz3fQHlV_kKtut1UNM=';
const apiSecret = 'WwZzutNBhTIpQ23bDBRqcO/kXSyO38w1Cvpz6PNy94c=';
const serverUrl = 'https://www.sandbox.striga.com/api/v1';

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

function hmacSha256(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

async function testPath(pathInSignature) {
  const time = Date.now().toString();
  const body = {
    firstName: "Test",
    lastName: "User",
    email: `test_auth_${Date.now()}@example.com`,
    mobile: {
      countryCode: "+372",
      number: "56316716"
    }
  };

  const bodyString = JSON.stringify(body);
  const bodyMd5 = md5(bodyString);
  const signatureRawData = time + 'POST' + pathInSignature + bodyMd5;
  const signature = hmacSha256(signatureRawData, apiSecret);
  const hmacHeader = `HMAC ${time}:${signature}`;

  console.log(`Testing with path in signature: "${pathInSignature}"`);
  try {
    const res = await fetch(`${serverUrl}/user/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
        'Authorization': hmacHeader
      },
      body: bodyString
    });

    console.log('  Status:', res.status);
    const json = await res.json().catch(() => null);
    console.log('  Response:', json);
  } catch (error) {
    console.error('  Error:', error);
  }
}

async function run() {
  await testPath('/api/v1/user/create');
  await testPath('/user/create');
}

run();
