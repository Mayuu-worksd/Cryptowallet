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

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ PRIVATE_KEY not found in .env');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Wallet Address: ${wallet.address}`);

  if (!fs.existsSync(ADDRESSES_PATH)) {
    console.error('❌ deployed_addresses.json not found.');
    return;
  }
  const addresses = JSON.parse(fs.readFileSync(ADDRESSES_PATH, 'utf8'));

  const usdtAddress = addresses.usdt;
  const conversionAddress = addresses.conversion;
  const userAddress = '0x351028a22c876e0431b30921c0dd0a836a14899e';

  const mockUsdtAbi = [
    'function mint(address to, uint256 amount) returns (bool)',
    'function balanceOf(address) view returns (uint256)'
  ];

  const usdt = new ethers.Contract(usdtAddress, mockUsdtAbi, wallet);

  // 1. Mint 1,000,000 USDT to Reserve Conversion contract
  console.log(`\nMinting 1,000,000 USDT to Reserve Conversion contract (${conversionAddress})...`);
  const tx1 = await usdt.mint(conversionAddress, ethers.parseUnits('1000000', 6));
  console.log(`Tx submitted: ${tx1.hash}`);
  await tx1.wait(1);
  console.log('Confirmed.');

  // 2. Mint 10,000 USDT to user wallet
  console.log(`\nMinting 10,000 USDT to User Wallet (${userAddress})...`);
  const tx2 = await usdt.mint(userAddress, ethers.parseUnits('10000', 6));
  console.log(`Tx submitted: ${tx2.hash}`);
  await tx2.wait(1);
  console.log('Confirmed.');

  // Verify
  const reserveBal = await usdt.balanceOf(conversionAddress);
  const userBal = await usdt.balanceOf(userAddress);
  console.log(`\nNew Reserve Conversion USDT Balance: ${ethers.formatUnits(reserveBal, 6)} USDT`);
  console.log(`New User USDT Balance: ${ethers.formatUnits(userBal, 6)} USDT`);
}

main().catch(err => {
  console.error(err);
});
