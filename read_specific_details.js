const fs = require('fs');
const collection = JSON.parse(fs.readFileSync('striga_collection.json', 'utf8'));

const targetNames = [
  'Verify Email',
  'Verify Mobile',
  'Simulate APPROVED or REJECTED KYC Status'
];

function findAndPrint(items) {
  for (const item of items) {
    if (item.item) {
      findAndPrint(item.item);
    } else if (item.request && targetNames.includes(item.name)) {
      console.log(`=== ${item.name} ===`);
      console.log(`Method: ${item.request.method}`);
      console.log(`URL: ${item.request.url.raw || item.request.url}`);
      console.log(`Body:`, item.request.body ? item.request.body.raw : 'none');
      console.log(`Pre-request Script:`, item.event && item.event.find(e => e.listen === 'prerequest')?.script?.exec.join('\n'));
      console.log('\n');
    }
  }
}

findAndPrint(collection.item);
