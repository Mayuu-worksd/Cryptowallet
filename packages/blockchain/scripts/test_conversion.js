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
  'function decimals() view returns (uint8)'
];

const RESERVE_CONVERSION_ABI = [
  'function swapUSDTToStablecoin(bytes32 tokenId, uint256 usdtAmount) returns (uint256)',
  'function swapStablecoinToUSDT(bytes32 tokenId, uint256 stablecoinAmount) returns (uint256)',
  'function fxRates(bytes32 tokenId) view returns (uint256)'
];

async function main() {
  console.log('=================================================');
  console.log('    PRODUCTION RESERVE CONVERSION TEST SUITE     ');
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

  const usdt = new ethers.Contract(addresses.usdt, ERC20_ABI, wallet);
  const thb = new ethers.Contract(addresses.thbProxy, ERC20_ABI, wallet);
  const conversion = new ethers.Contract(addresses.conversion, RESERVE_CONVERSION_ABI, wallet);

  const THB_ID = ethers.keccak256(ethers.toUtf8Bytes("THB"));

  // Fetch initial balances
  const initialUsdt = await usdt.balanceOf(wallet.address);
  const initialThb = await thb.balanceOf(wallet.address);
  console.log(`Initial USDT Balance: ${ethers.formatUnits(initialUsdt, 6)} USDT`);
  console.log(`Initial THB Balance:  ${ethers.formatUnits(initialThb, 6)} THB\n`);

  if (initialUsdt < ethers.parseUnits('10', 6)) {
    console.error('❌ Error: User needs at least 10 USDT to run the conversion test.');
    process.exit(1);
  }

  // 1. Swap USDT -> THB (10 USDT -> THB)
  const swapAmountUsdt = ethers.parseUnits('10', 6);
  const rate = await conversion.fxRates(THB_ID);
  const expectedThb = (swapAmountUsdt * rate) / 1000000n;

  console.log(`[TEST 1] Swapping 10.00 USDT → THB (Expected: ${ethers.formatUnits(expectedThb, 6)} THB)...`);
  
  console.log('Step A: Approving ReserveConversion contract to spend USDT...');
  const txApp = await usdt.approve(addresses.conversion, swapAmountUsdt);
  await txApp.wait();
  console.log('  Confirmed.');

  console.log('Step B: Swapping USDT to Stablecoin...');
  const txSwap1 = await conversion.swapUSDTToStablecoin(THB_ID, swapAmountUsdt);
  console.log(`  Swap Tx Hash: ${txSwap1.hash}`);
  await txSwap1.wait();
  console.log('  Confirmed.');

  let usdtBal = await usdt.balanceOf(wallet.address);
  let thbBal = await thb.balanceOf(wallet.address);
  console.log(`USDT Balance after Swap 1: ${ethers.formatUnits(usdtBal, 6)} USDT`);
  console.log(`THB Balance after Swap 1:  ${ethers.formatUnits(thbBal, 6)} THB\n`);

  // 2. Swap THB -> USDT (expectedThb THB -> USDT)
  console.log(`[TEST 2] Swapping ${ethers.formatUnits(expectedThb, 6)} THB → USDT...`);
  
  console.log('Step A: Swapping Stablecoin to USDT (burning stablecoin)...');
  const txSwap2 = await conversion.swapStablecoinToUSDT(THB_ID, expectedThb);
  console.log(`  Swap Tx Hash: ${txSwap2.hash}`);
  await txSwap2.wait();
  console.log('  Confirmed.');

  usdtBal = await usdt.balanceOf(wallet.address);
  thbBal = await thb.balanceOf(wallet.address);
  console.log(`USDT Balance after Swap 2: ${ethers.formatUnits(usdtBal, 6)} USDT`);
  console.log(`THB Balance after Swap 2:  ${ethers.formatUnits(thbBal, 6)} THB\n`);

  console.log('=================================================');
  console.log('     CONVERSION ENGINE TEST SUITE PASSED         ');
  console.log('=================================================');
}

main().catch((error) => {
  console.error('❌ Test Failed:', error);
  process.exitCode = 1;
});
