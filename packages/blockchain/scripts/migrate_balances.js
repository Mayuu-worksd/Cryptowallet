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

const OLD_THB_ADDRESS = '0x5DA1034636F90b1b2e62F917847502FA5796653f';

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function mint(address to, uint256 amount)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

async function main() {
  console.log('=================================================');
  console.log('       STABLECOIN BALANCE MIGRATION SCRIPT       ');
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
  const adminWallet = new ethers.Wallet(privateKey, provider);
  console.log(`Admin Wallet Address: ${adminWallet.address}`);
  console.log(`Old THB Address:      ${OLD_THB_ADDRESS}`);
  console.log(`New THB Proxy:         ${addresses.thbProxy}\n`);

  const oldThb = new ethers.Contract(OLD_THB_ADDRESS, ERC20_ABI, adminWallet);
  const newThb = new ethers.Contract(addresses.thbProxy, ERC20_ABI, adminWallet);

  // 1. Fetch all Transfer logs of the old contract to discover holders
  console.log('Step 1: Querying historical Transfer events from old THB...');
  const filter = oldThb.filters.Transfer();
  
  const latestBlock = await provider.getBlockNumber();
  const startBlock = latestBlock - 40000;
  console.log(`  Scanning from block ${startBlock} to ${latestBlock} (last 40,000 blocks)...`);
  const transferEvents = await oldThb.queryFilter(filter, startBlock, latestBlock);
  console.log(`  Found ${transferEvents.length} transfer events.`);

  const uniqueAddresses = new Set();
  for (const event of transferEvents) {
    if (event.args) {
      const from = event.args.from;
      const to = event.args.to;
      if (from !== ethers.ZeroAddress) uniqueAddresses.add(from);
      if (to !== ethers.ZeroAddress) uniqueAddresses.add(to);
    }
  }
  
  // Exclude admin wallet (it already has initial mint of 1B on new contract)
  uniqueAddresses.delete(adminWallet.address);
  console.log(`  Discovered ${uniqueAddresses.size} unique user addresses (excluding admin).\n`);

  // 2. Fetch balances of all holders on old contract
  console.log('Step 2: Taking snapshot of old balances...');
  const snapshot = [];
  for (const addr of uniqueAddresses) {
    const bal = await oldThb.balanceOf(addr);
    if (bal > 0n) {
      snapshot.push({ address: addr, balance: bal });
      console.log(`    - Holder: ${addr} | Balance: ${ethers.formatUnits(bal, 6)} THB`);
    }
  }
  console.log(`  Snapshot compile complete. Total holders with balance: ${snapshot.length}\n`);

  if (snapshot.length === 0) {
    console.log('ℹ No other accounts hold THB balances on the old contract. Migration complete!');
    return;
  }

  // 3. Batch-mint the balances on the new proxy contract
  console.log('Step 3: Batch-minting equivalent balances on the new Upgradeable THB proxy...');
  for (const item of snapshot) {
    // Check if they already have balance on new contract to prevent double-minting
    const currentNewBal = await newThb.balanceOf(item.address);
    if (currentNewBal >= item.balance) {
      console.log(`  ✔ ${item.address} already has equivalent or greater balance on new proxy (${ethers.formatUnits(currentNewBal, 6)} THB). Skipping.`);
      continue;
    }
    
    const mintAmount = item.balance - currentNewBal;
    console.log(`  Minting ${ethers.formatUnits(mintAmount, 6)} THB to ${item.address}...`);
    const tx = await newThb.mint(item.address, mintAmount);
    console.log(`    Tx Submitted: ${tx.hash}`);
    await tx.wait(1);
    console.log('    Confirmed.');
  }

  console.log('\n=================================================');
  console.log('         BALANCE MIGRATION COMPLETED SUCCESS     ');
  console.log('=================================================');
}

main().catch((error) => {
  console.error('❌ Balance migration failed:', error);
  process.exitCode = 1;
});
