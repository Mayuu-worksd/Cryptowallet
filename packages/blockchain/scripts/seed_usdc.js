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
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ PRIVATE_KEY not found in .env');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Wallet Address: ${wallet.address}`);

  const wallets = [
    '0x351028a22c876e0431b30921c0dd0a836a14899e',
    '0xbf0603ade100dea85e6de47f8c46c8ce55bb4d01'
  ];

  const mockTokenAbi = [
    'function mint(address to, uint256 amount) returns (bool)',
    'function balanceOf(address) view returns (uint256)'
  ];

  const usdc = new ethers.Contract(USDC_ADDRESS, mockTokenAbi, wallet);

  for (const userAddress of wallets) {
    console.log(`\nChecking USDC balance for: ${userAddress}`);
    const beforeBal = await usdc.balanceOf(userAddress);
    console.log(`  Before: ${ethers.formatUnits(beforeBal, 6)} USDC`);

    console.log(`  Minting 10,000 USDC...`);
    const tx = await usdc.mint(userAddress, ethers.parseUnits('10000', 6));
    console.log(`  Submitted tx: ${tx.hash}`);
    await tx.wait(1);
    console.log(`  Confirmed.`);

    const afterBal = await usdc.balanceOf(userAddress);
    console.log(`  After: ${ethers.formatUnits(afterBal, 6)} USDC`);
  }
}

main().catch(err => {
  console.error(err);
});
