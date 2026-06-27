const fs = require('fs');

const collection = JSON.parse(fs.readFileSync('striga_collection.json', 'utf8'));

const targetNames = [
  'Verify Email',
  'Verify Mobile',
  'Start KYC',
  'Simulate APPROVED or REJECTED KYC Status',
  'Create Wallet',
  'Create Card',
  'Simulate Account Deposit',
  'Block Card',
  'Unblock Card'
];

function findRequests(items) {
  const found = {};
  function search(arr) {
    for (const item of arr) {
      if (item.item) {
        search(item.item);
      } else if (item.request && targetNames.includes(item.name)) {
        found[item.name] = {
          method: item.request.method,
          url: item.request.url.raw || item.request.url,
          body: item.request.body ? item.request.body.raw : null,
          preRequest: item.event && item.event.find(e => e.listen === 'prerequest')?.script?.exec || null
        };
      }
    }
  }
  search(items);
  return found;
}

const results = findRequests(collection.item);
console.log(JSON.stringify(results, null, 2));
