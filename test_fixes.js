// Test preservation logic directly
function resolveINRXBalance(chainINRX, localINRX) {
  return chainINRX !== null && chainINRX > 0 ? chainINRX : Math.max(chainINRX ?? 0, localINRX ?? 0);
}

console.log('=== Testing INRX Balance Preservation Logic ===');

console.log('Case 1: Chain returns 0, local has 50 INRX:');
const res1 = resolveINRXBalance(0, 50);
console.log(`Result: ${res1} -> ${res1 === 50 ? '✔ PASSED' : '✖ FAILED'}`);

console.log('Case 2: Chain returns 100 INRX (on-chain mint/swap), local has 50:');
const res2 = resolveINRXBalance(100, 50);
console.log(`Result: ${res2} -> ${res2 === 100 ? '✔ PASSED' : '✖ FAILED'}`);

console.log('Case 3: Chain returns null (RPC error), local has 50:');
const res3 = resolveINRXBalance(null, 50);
console.log(`Result: ${res3} -> ${res3 === 50 ? '✔ PASSED' : '✖ FAILED'}`);
