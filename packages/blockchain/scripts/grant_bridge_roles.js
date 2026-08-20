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

const ACCESS_CONTROL_ABI = [
  'function MINTER_ROLE() view returns (bytes32)',
  'function BURNER_ROLE() view returns (bytes32)',
  'function grantRole(bytes32 role, address account) returns (bool)',
  'function hasRole(bytes32 role, address account) view returns (bool)'
];

async function main() {
  console.log('=================================================');
  console.log('       GRANT BRIDGE ROLES ON THB CONTRACT        ');
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
  console.log(`Admin Wallet Address: ${wallet.address}`);

  const thbContract = new ethers.Contract(addresses.thbProxy, ACCESS_CONTROL_ABI, wallet);

  // Compute or get role hashes
  const minterRole = await thbContract.MINTER_ROLE();
  const burnerRole = await thbContract.BURNER_ROLE();

  console.log(`THB MINTER_ROLE Hash: ${minterRole}`);
  console.log(`THB BURNER_ROLE Hash: ${burnerRole}`);
  console.log(`Bridge Address:       ${addresses.bridge}\n`);

  // Check if roles are already granted
  const hasMinter = await thbContract.hasRole(minterRole, addresses.bridge);
  const hasBurner = await thbContract.hasRole(burnerRole, addresses.bridge);

  if (hasMinter) {
    console.log('✔ Bridge already has MINTER_ROLE.');
  } else {
    console.log('Granting MINTER_ROLE to Sepolia Bridge...');
    const tx = await thbContract.grantRole(minterRole, addresses.bridge);
    console.log(`  Transaction submitted: ${tx.hash}`);
    await tx.wait(1);
    console.log('  MINTER_ROLE granted successfully.');
  }

  if (hasBurner) {
    console.log('✔ Bridge already has BURNER_ROLE.');
  } else {
    console.log('Granting BURNER_ROLE to Sepolia Bridge...');
    const tx = await thbContract.grantRole(burnerRole, addresses.bridge);
    console.log(`  Transaction submitted: ${tx.hash}`);
    await tx.wait(1);
    console.log('  BURNER_ROLE granted successfully.');
  }

  console.log('\n=================================================');
  console.log('             ROLE ASSIGNMENT SUCCESS             ');
  console.log('=================================================');
}

main().catch((error) => {
  console.error('❌ Failed to grant roles:', error);
  process.exitCode = 1;
});
