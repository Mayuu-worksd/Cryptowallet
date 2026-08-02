const http = require('http');
http.get('http://localhost:3000/api/cards?walletAddress=0x742d35Cc6634C0532925a3b844Bc454e4438f44e', (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (chunk) => console.log(`BODY: ${chunk.toString()}`));
}).on('error', (e) => {
  console.log(`ERROR: ${e.message}`);
});
