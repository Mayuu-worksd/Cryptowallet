const { ethers } = require('ethers');

const SEPOLIA_RPC = 'https://public.1rpc.io/sepolia';
const SEPOLIA_INRX = '0x51A5F24560547f587999c331788aC495D40d95ba';

const PROBE_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function owner() view returns (address)',
  'function paused() view returns (bool)',
  'function MINTER_ROLE() view returns (bytes32)',
  'function BURNER_ROLE() view returns (bytes32)',
  'function DEFAULT_ADMIN_ROLE() view returns (bytes32)',
  'function hasRole(bytes32 role, address account) view returns (bool)'
];

async function main() {
  console.log('--- Probing INRX Deployed Contract on Sepolia ---');
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const contract = new ethers.Contract(SEPOLIA_INRX, PROBE_ABI, provider);

  // 1. Basic Metadata
  try { console.log(`Name: ${await contract.name()}`); } catch (e) { console.log('name() failed:', e.message); }
  try { console.log(`Symbol: ${await contract.symbol()}`); } catch (e) { console.log('symbol() failed:', e.message); }
  try { console.log(`Decimals: ${await contract.decimals()}`); } catch (e) { console.log('decimals() failed:', e.message); }
  try { console.log(`Total Supply: ${await contract.totalSupply()}`); } catch (e) { console.log('totalSupply() failed:', e.message); }

  // 2. Owner vs AccessControl
  try { console.log(`Owner (Ownable): ${await contract.owner()}`); } catch (e) { console.log('owner() failed (Not Ownable or reverted):', e.message.slice(0, 80)); }
  try { console.log(`MINTER_ROLE: ${await contract.MINTER_ROLE()}`); } catch (e) { console.log('MINTER_ROLE failed:', e.message.slice(0, 80)); }
  try { console.log(`BURNER_ROLE: ${await contract.BURNER_ROLE()}`); } catch (e) { console.log('BURNER_ROLE failed:', e.message.slice(0, 80)); }
  try { console.log(`DEFAULT_ADMIN_ROLE: ${await contract.DEFAULT_ADMIN_ROLE()}`); } catch (e) { console.log('DEFAULT_ADMIN_ROLE failed:', e.message.slice(0, 80)); }

  // 3. Pausable
  try { console.log(`Paused: ${await contract.paused()}`); } catch (e) { console.log('paused() failed (Not Pausable):', e.message.slice(0, 80)); }

  // 4. Test custom/standard burn methods via callStatic / ethers v6 equivalent
  const randomUser = '0x1111111111111111111111111111111111111111';
  
  // Test: burnFrom(address, uint256)
  try {
    const customAbi = ['function burnFrom(address, uint256)'];
    const testContract = new ethers.Contract(SEPOLIA_INRX, customAbi, provider);
    await testContract.burnFrom.staticCall(randomUser, 100);
    console.log('burnFrom(address, uint256) staticCall did NOT revert (exists)');
  } catch (e) {
    console.log('burnFrom(address, uint256) check:', e.message.slice(0, 120));
  }

  // Test: burnFrom(uint256, string)
  try {
    const customAbi = ['function burnFrom(uint256, string) returns (bool)'];
    const testContract = new ethers.Contract(SEPOLIA_INRX, customAbi, provider);
    await testContract.burnFrom.staticCall(100, 'test reason');
    console.log('burnFrom(uint256, string) staticCall did NOT revert (exists)');
  } catch (e) {
    console.log('burnFrom(uint256, string) check:', e.message.slice(0, 120));
  }

  // Test: burn(uint256)
  try {
    const customAbi = ['function burn(uint256)'];
    const testContract = new ethers.Contract(SEPOLIA_INRX, customAbi, provider);
    await testContract.burn.staticCall(100);
    console.log('burn(uint256) staticCall did NOT revert (exists)');
  } catch (e) {
    console.log('burn(uint256) check:', e.message.slice(0, 120));
  }
}

main().catch(console.error);
