const crypto = require('crypto');

// Let's try the credentials from the postman collection's mock response first
const apiKey = '670ac5d8-6f80-44e4-98a4-74eb9692e59a';
const apiSecret = 'r88XIrUVF6obl+NYwSpsdfIFtDQx+adHgvvrlXZ9ix0=';
const applicationId = '9969308c-1520-41fe-b0c7-ffe9300035f7';
const serverUrl = 'https://www.sandbox.striga.com/api/v1';

// Function to compute MD5 in hex (like CryptoJS.MD5(body).toString(Hex))
function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

// Function to compute HMAC SHA256 in hex
function hmacSha256(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

async function testCreateUser() {
  const path = '/api/v1/user/create'; // Wait, let's verify if the path should include /api/v1 or not!
  // In the Postman script: getPath() returns /api/v1/user/create if server_url is https://www.sandbox.striga.com/api/v1
  // Let's compute both /api/v1/user/create and /user/create to see which one works if there's any discrepancy.
  
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
  
  // Let's check with /api/v1/user/create
  const signatureRawData = time + 'POST' + path + bodyMd5;
  const signature = hmacSha256(signatureRawData, apiSecret);
  const hmacHeader = `HMAC ${time}:${signature}`;

  console.log('Sending request...');
  console.log('Body:', bodyString);
  console.log('MD5:', bodyMd5);
  console.log('Signature Data:', signatureRawData);
  console.log('Signature:', signature);
  console.log('HMAC Header:', hmacHeader);

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

    console.log('Status:', res.status);
    const json = await res.json().catch(() => null);
    console.log('Response:', json);
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

testCreateUser();
