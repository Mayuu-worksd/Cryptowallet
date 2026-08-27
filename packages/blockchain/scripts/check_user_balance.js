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
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const wallets = [
    '0xbf0603ade100dea85e6de47f8c46c8ce55bb4d01',
    '0x99df7447a307fc05507defa20ba57d9ea4458c50'
  ];

  if (!fs.existsSync(ADDRESSES_PATH)) {
    console.error('❌ deployed_addresses.json not found.');
    return;
  }
  const addresses = JSON.parse(fs.readFileSync(ADDRESSES_PATH, 'utf8'));
  const erc20Abi = ['function balanceOf(address) view returns (uint256)'];
  const usdtContract = new ethers.Contract(addresses.usdt, erc20Abi, provider);

  for (const walletAddress of wallets) {
    console.log(`\nChecking balances for: ${walletAddress}`);
    try {
      const ethBal = await provider.getBalance(walletAddress);
      console.log(`  Sepolia ETH: ${ethers.formatEther(ethBal)} ETH`);
      
      const usdtBal = await usdtContract.balanceOf(walletAddress);
      console.log(`  MockUSDT: ${ethers.formatUnits(usdtBal, 6)} USDT`);
    } catch (err) {
      console.error(`  Error:`, err.message);
    }
  }
}

main().catch(err => {
  console.error(err);
});
