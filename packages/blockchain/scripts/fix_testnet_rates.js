const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const ethersPath = path.resolve(__dirname, '../../../apps/admin-dashboard/node_modules/ethers');
if (!fs.existsSync(ethersPath)) {
  console.error(`❌ Ethers not found at: ${ethersPath}`);
  process.exit(1);
}
const { ethers } = require(ethersPath);

const SEPOLIA_RPC = process.env.SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com';
const ADDRESSES_PATH = path.resolve(__dirname, '../deployed_addresses.json');

const RESERVE_CONVERSION_ABI = [
  'function setRateValidityDuration(uint256 duration) external',
  'function setRate(bytes32 tokenId, uint256 rate) external',
  'function setRateOverride(bytes32 tokenId, uint256 rate) external',
  'function hasRole(bytes32 role, address account) view returns (bool)',
  'function DEFAULT_ADMIN_ROLE() view returns (bytes32)',
  'function ORACLE_ROLE() view returns (bytes32)',
  'function rateValidityDuration() view returns (uint256)',
  'function fxRates(bytes32 tokenId) view returns (uint256)'
];

const CURRENCIES = [
  { symbol: 'PKR', rate: 278500000n },
  { symbol: 'AED', rate: 3670000n },
  { symbol: 'CNY', rate: 7230000n },
  { symbol: 'RUB', rate: 89500000n },
  { symbol: 'UZS', rate: 12600000000n },
  { symbol: 'VND', rate: 25400000000n },
  { symbol: 'IDR', rate: 16300000000n },
  { symbol: 'PHP', rate: 58500000n },
  { symbol: 'THB', rate: 36500000n },
  { symbol: 'INRX', rate: 83500000n } // 83.5 INR/USDT -> 83.5 * 10^6
];

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ PRIVATE_KEY not found in .env');
    process.exit(1);
  }

  const addresses = JSON.parse(fs.readFileSync(ADDRESSES_PATH, 'utf8'));
  const conversionAddr = addresses.conversion;
  console.log(`Conversion Contract Address: ${conversionAddr}`);

  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Wallet Address: ${wallet.address}`);

  const conversion = new ethers.Contract(conversionAddr, RESERVE_CONVERSION_ABI, wallet);

  // Check roles
  const adminRole = await conversion.DEFAULT_ADMIN_ROLE();
  const oracleRole = await conversion.ORACLE_ROLE();
  const isAdmin = await conversion.hasRole(adminRole, wallet.address);
  const isOracle = await conversion.hasRole(oracleRole, wallet.address);

  console.log(`Is Admin: ${isAdmin}`);
  console.log(`Is Oracle: ${isOracle}`);

  // 1. Set Rate Validity Duration to 100 years (3,153,600,000 seconds)
  const currentDuration = await conversion.rateValidityDuration();
  console.log(`Current Rate Validity Duration: ${currentDuration.toString()} seconds`);

  if (isAdmin) {
    console.log('Extending rate validity duration to 100 years...');
    const tx = await conversion.setRateValidityDuration(3153600000n);
    console.log(`Sent transaction: ${tx.hash}`);
    await tx.wait();
    console.log('Rate validity duration updated successfully.');
  } else {
    console.warn('⚠️ Wallet does not have DEFAULT_ADMIN_ROLE, skipping validity duration update.');
  }

  // 2. Update Rates
  for (const { symbol, rate } of CURRENCIES) {
    const tokenId = ethers.keccak256(ethers.toUtf8Bytes(symbol));
    console.log(`\nUpdating rate for ${symbol}...`);
    try {
      let tx;
      if (isAdmin) {
        // Use override to bypass deviation checks
        tx = await conversion.setRateOverride(tokenId, rate);
      } else if (isOracle) {
        tx = await conversion.setRate(tokenId, rate);
      } else {
        throw new Error('Wallet has neither admin nor oracle role');
      }
      console.log(`Sent rate update transaction: ${tx.hash}`);
      await tx.wait();
      console.log(`✅ Rate for ${symbol} set to ${rate.toString()}`);
    } catch (err) {
      console.error(`❌ Failed to update rate for ${symbol}:`, err.message || err);
    }
  }

  console.log('\nAll rates updated!');
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
