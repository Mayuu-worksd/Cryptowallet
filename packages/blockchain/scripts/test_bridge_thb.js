const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Import ethers
const ethersPath = path.resolve(__dirname, '../../../apps/admin-dashboard/node_modules/ethers');
if (!fs.existsSync(ethersPath)) {
  console.error(`❌ Ethers not found at: ${ethersPath}`);
  process.exit(1);
}
const { ethers } = require(ethersPath);

const SEPOLIA_RPC = process.env.SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com';

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function MINTER_ROLE() view returns (bytes32)',
  'function hasRole(bytes32 role, address account) view returns (bool)'
];

const BRIDGE_ABI = [
  'function lock(bytes32 tokenId, uint256 amount, uint256 destChainId, address recipient, uint256 nonce, uint256 deadline) returns (bool)'
];

async function main() {
  console.log('=================================================');
  console.log('       PRODUCTION MULTI-CURRENCY BRIDGE TEST     ');
  console.log('=================================================');

  const addressesPath = path.resolve(__dirname, '../deployed_addresses.json');
  if (!fs.existsSync(addressesPath)) {
    console.error('❌ Deployed addresses file not found! Deploy contracts first.');
    return;
  }
  const addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ ERROR: PRIVATE_KEY environment variable is not set!');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`User Wallet Address: ${wallet.address}`);

  const thbContract = new ethers.Contract(addresses.thbProxy, ERC20_ABI, wallet);
  const bridgeContract = new ethers.Contract(addresses.bridge, BRIDGE_ABI, wallet);

  // 1. Verify roles on THB
  const minterRole = await thbContract.MINTER_ROLE();
  const bridgeHasMinter = await thbContract.hasRole(minterRole, addresses.bridge);
  console.log(`Bridge Address: ${addresses.bridge}`);
  console.log(`Does Bridge hold MINTER_ROLE on THB? -> ${bridgeHasMinter}`);

  if (!bridgeHasMinter) {
    console.error('❌ Error: Bridge does not have MINTER_ROLE on THB proxy.');
    process.exit(1);
  }

  // 2. Fetch balance
  const balance = await thbContract.balanceOf(wallet.address);
  console.log(`User THB Balance: ${ethers.formatUnits(balance, 6)} THB\n`);

  const bridgeAmount = ethers.parseUnits('1', 6);
  if (balance < bridgeAmount) {
    console.error('❌ Error: User needs at least 1.0 THB to run bridge lock test.');
    process.exit(1);
  }

  // 3. Approve Bridge
  console.log('Step A: Approving Bridge contract to spend 1.0 THB...');
  const txApprove = await thbContract.approve(addresses.bridge, bridgeAmount);
  console.log(`  Approval Tx Hash: ${txApprove.hash}`);
  await txApprove.wait(1);
  console.log('  Confirmed.');

  // 4. Lock Tokens on Bridge
  console.log('Step B: Locking 1.0 THB on Sepolia Bridge...');
  const tokenId = ethers.keccak256(ethers.toUtf8Bytes('THB'));
  const destChainId = 80002; // Polygon Amoy
  const recipient = wallet.address;
  const nonce = Date.now();
  const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour

  console.log(`  Token ID (keccak256("THB")): ${tokenId}`);
  const txLock = await bridgeContract.lock(
    tokenId,
    bridgeAmount,
    destChainId,
    recipient,
    nonce,
    deadline
  );
  console.log(`  Lock Tx Hash: ${txLock.hash}`);
  await txLock.wait(1);
  console.log('  Confirmed! Tokens successfully locked in bridge.');

  console.log('\n=================================================');
  console.log('        BRIDGE LOCK TEST COMPLETED PASSED        ');
  console.log('=================================================');
}

main().catch((error) => {
  console.error('❌ Bridge lock test failed:', error);
  process.exitCode = 1;
});
