/**
 * deploy_hardened_conversion.js
 * Migration script to deploy the new ReserveConversion contract on Sepolia,
 * transfer MINTER/BURNER proxy roles to it, configure the stablecoins, and set rates.
 * Hardened with automatic network retry logic and Alchemy provider fallback.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const ethersPath = path.resolve(__dirname, '../../../apps/admin-dashboard/node_modules/ethers');
if (!fs.existsSync(ethersPath)) {
  console.error(`❌ Ethers not found at: ${ethersPath}`);
  process.exit(1);
}
const { ethers } = require(ethersPath);

const ALCHEMY_KEY = process.env.EXPO_PUBLIC_ALCHEMY_KEY || '';
const SEPOLIA_RPC = process.env.SEPOLIA_RPC || (ALCHEMY_KEY 
  ? `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}` 
  : 'https://ethereum-sepolia-rpc.publicnode.com');

const ADDRESSES_PATH = path.resolve(__dirname, '../deployed_addresses.json');

const PROXY_ABI = [
  'function grantRole(bytes32 role, address account) external',
  'function revokeRole(bytes32 role, address account) external',
  'function MINTER_ROLE() view returns (bytes32)',
  'function BURNER_ROLE() view returns (bytes32)',
  'function hasRole(bytes32 role, address account) view returns (bool)'
];

const CURRENCIES = [
  { symbol: 'THB', key: 'thbProxy', rate: 36500000 },
  { symbol: 'PKR', key: 'pkrProxy', rate: 280000000 },
  { symbol: 'AED', key: 'aedProxy', rate: 3670000 },
  { symbol: 'CNY', key: 'cnyProxy', rate: 7240000 },
  { symbol: 'RUB', key: 'rubProxy', rate: 90000000 },
  { symbol: 'UZS', key: 'uzsProxy', rate: 12700000000 },
  { symbol: 'VND', key: 'vndProxy', rate: 25400000000 },
  { symbol: 'IDR', key: 'idrProxy', rate: 16400000000 },
  { symbol: 'PHP', key: 'phpProxy', rate: 58500000 }
];

// Helper to retry operations on network errors
async function retry(fn, maxRetries = 5, delay = 5000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      const isNetworkError = 
        err.message.includes('ECONNRESET') || 
        err.message.includes('ETIMEDOUT') || 
        err.message.includes('network') || 
        err.message.includes('timeout') || 
        err.message.includes('429');
      
      if (isNetworkError && i < maxRetries - 1) {
        console.warn(`⚠️ Network warning: "${err.message}". Retrying in ${delay / 1000}s... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

async function main() {
  console.log('=================================================');
  console.log('    MIGRATING TO HARDENED RESERVE CONVERSION     ');
  console.log('=================================================');
  console.log(`Using RPC URL: ${SEPOLIA_RPC.split('/v2/')[0] || SEPOLIA_RPC} (Key: ${ALCHEMY_KEY ? 'Present' : 'Absent'})\n`);

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ ERROR: PRIVATE_KEY environment variable is not set!');
    process.exit(1);
  }

  if (!fs.existsSync(ADDRESSES_PATH)) {
    console.error('❌ ERROR: deployed_addresses.json not found!');
    process.exit(1);
  }

  const addresses = JSON.parse(fs.readFileSync(ADDRESSES_PATH, 'utf8'));

  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Admin/Deployer Wallet: ${wallet.address}`);

  const balance = await retry(() => provider.getBalance(wallet.address));
  console.log(`Deployer Balance: ${ethers.formatEther(balance)} ETH\n`);

  // Load ReserveConversion artifact
  const artifactsBase = path.resolve(__dirname, '../artifacts/contracts');
  const conversionArtifactPath = path.resolve(artifactsBase, 'ReserveConversion.sol/ReserveConversion.json');
  if (!fs.existsSync(conversionArtifactPath)) {
    console.error('❌ Compiled ReserveConversion artifact not found. Please compile first.');
    process.exit(1);
  }
  const conversionArtifact = JSON.parse(fs.readFileSync(conversionArtifactPath, 'utf8'));

  // 1. Deploy the new contract
  console.log('Step 1: Deploying hardened ReserveConversion contract...');
  const ConversionObj = new ethers.ContractFactory(conversionArtifact.abi, conversionArtifact.bytecode, wallet);
  
  const newConversion = await retry(() => ConversionObj.deploy(wallet.address, addresses.usdt));
  await retry(() => newConversion.waitForDeployment());
  const newConversionAddress = await newConversion.getAddress();
  console.log(`✅ Hardened ReserveConversion deployed at: ${newConversionAddress}\n`);

  // 2. Fetch rates from old contract if available, otherwise use defaults
  console.log('Step 2: Configuring tokens and rates on new contract...');
  const oldConversion = new ethers.Contract(addresses.conversion, conversionArtifact.abi, wallet);

  for (const item of CURRENCIES) {
    const tokenId = ethers.keccak256(ethers.toUtf8Bytes(item.symbol));
    const proxyAddress = addresses[item.key];
    if (!proxyAddress) {
      console.log(`  ⚠️ Proxy address for ${item.symbol} not found in deployed_addresses.json. Skipping.`);
      continue;
    }

    // Configure Token
    console.log(`  Configuring ${item.symbol} (${proxyAddress})...`);
    const txConf = await retry(() => newConversion.configureToken(tokenId, proxyAddress));
    await retry(() => txConf.wait());

    // Query rate from old contract
    let rate = item.rate;
    try {
      const oldRate = await retry(() => oldConversion.fxRates(tokenId));
      if (oldRate > 0n) {
        rate = Number(oldRate);
        console.log(`    - Queried rate from old contract: ${rate / 1e6} (from ${addresses.conversion})`);
      }
    } catch (err) {
      console.log(`    - Failed to query old rate. Using default: ${rate / 1e6}`);
    }

    // Set rate
    const txRate = await retry(() => newConversion.setRate(tokenId, rate));
    await retry(() => txRate.wait());
    console.log(`    - Rate set.`);
  }
  console.log('✅ Configuration completed.\n');

  // 3. Migrate Proxy MINTER/BURNER roles to new conversion contract
  console.log('Step 3: Migrating proxy permissions (MINTER_ROLE/BURNER_ROLE)...');
  const oldConversionAddress = addresses.conversion;

  for (const item of CURRENCIES) {
    const proxyAddress = addresses[item.key];
    if (!proxyAddress) continue;

    console.log(`  Transitioning roles for ${item.symbol}...`);
    const proxyContract = new ethers.Contract(proxyAddress, PROXY_ABI, wallet);

    const minterRole = await retry(() => proxyContract.MINTER_ROLE());
    const burnerRole = await retry(() => proxyContract.BURNER_ROLE());

    // Grant new roles
    console.log(`    - Granting MINTER_ROLE to new ReserveConversion...`);
    const txG1 = await retry(() => proxyContract.grantRole(minterRole, newConversionAddress));
    await retry(() => txG1.wait());

    console.log(`    - Granting BURNER_ROLE to new ReserveConversion...`);
    const txG2 = await retry(() => proxyContract.grantRole(burnerRole, newConversionAddress));
    await retry(() => txG2.wait());

    // Revoke old roles
    console.log(`    - Revoking MINTER_ROLE from old ReserveConversion...`);
    const txR1 = await retry(() => proxyContract.revokeRole(minterRole, oldConversionAddress));
    await retry(() => txR1.wait());

    console.log(`    - Revoking BURNER_ROLE from old ReserveConversion...`);
    const txR2 = await retry(() => proxyContract.revokeRole(burnerRole, oldConversionAddress));
    await retry(() => txR2.wait());
  }
  console.log('✅ Role migration completed.\n');

  // 4. Update deployed_addresses.json
  console.log('Step 4: Updating deployed_addresses.json...');
  const oldConversionAddressString = oldConversionAddress;
  addresses.conversion = newConversionAddress;
  addresses.timestamp = new Date().toISOString();

  fs.writeFileSync(ADDRESSES_PATH, JSON.stringify(addresses, null, 2));
  console.log(`✅ Updated deployed_addresses.json with new conversion address.`);
  console.log(`   Old: ${oldConversionAddressString}`);
  console.log(`   New: ${newConversionAddress}`);
  console.log('\n=================================================');
  console.log('      MIGRATION SYSTEM DEPLOYMENT SUCCESS        ');
  console.log('=================================================');
}

main().catch((error) => {
  console.error('❌ Migration Failed:', error);
  process.exitCode = 1;
});
