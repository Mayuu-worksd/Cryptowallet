require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { ethers } = require('../apps/mobile/node_modules/ethers');

const RESERVE_CONVERSION = '0x463A8dB7CE733d0DF5F05Bb2Fe58c845a08f5b33';
const ABI = [
  'function setRateOverride(bytes32 tokenId, uint256 rate) external',
  'function fxRates(bytes32) view returns (uint256)',
  'function rateLastUpdated(bytes32) view returns (uint256)',
];

// Rates: 1 USDT = X token (6 decimal precision)
const RATES = {
  THB: 36_500_000,       // 36.5 THB
  PKR: 278_000_000,      // 278 PKR
  AED: 3_670_000,        // 3.67 AED
  CNY: 7_250_000,        // 7.25 CNY
  RUB: 90_000_000,       // 90 RUB
  UZS: 12_700_000_000,   // 12700 UZS
  VND: 25_000_000_000,   // 25000 VND
  IDR: 16_000_000_000,   // 16000 IDR
  PHP: 56_000_000,       // 56 PHP
};

async function main() {
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY not set in .env');
    process.exit(1);
  }
  const provider = new ethers.providers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const contract = new ethers.Contract(RESERVE_CONVERSION, ABI, wallet);

  console.log('Refreshing FX rates on ReserveConversion...\n');

  for (const [sym, rate] of Object.entries(RATES)) {
    const tokenId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(sym));
    try {
      const tx = await contract.setRateOverride(tokenId, rate, { gasLimit: 100000 });
      await tx.wait(1);
      console.log(`✅ ${sym}: ${rate} — tx: ${tx.hash}`);
    } catch (e) {
      console.error(`❌ ${sym} failed: ${e.reason ?? e.message}`);
    }
  }
  console.log('\nDone.');
}

main().catch(console.error);
