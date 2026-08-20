const fs = require('fs');
const path = require('path');

// Import ethers from the admin-dashboard workspace
const ethersPath = path.resolve(__dirname, '../../../apps/admin-dashboard/node_modules/ethers');
if (!fs.existsSync(ethersPath)) {
  console.error(`❌ Ethers not found at: ${ethersPath}`);
  process.exit(1);
}
const { ethers } = require(ethersPath);

const SEPOLIA_RPC = process.env.SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com';
const USDT_ADDRESS = '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06';

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ ERROR: PRIVATE_KEY environment variable is not set!');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Wallet Address: ${wallet.address}`);

  // Let's try different mock minting interfaces
  const methods = [
    {
      name: 'mint(address,uint256)',
      abi: ['function mint(address to, uint256 amount) returns (bool)'],
      call: async (contract) => await contract.mint(wallet.address, ethers.parseUnits('1000', 6))
    },
    {
      name: 'faucet()',
      abi: ['function faucet() returns (bool)'],
      call: async (contract) => await contract.faucet()
    },
    {
      name: 'allocateTo(address,uint256)',
      abi: ['function allocateTo(address to, uint256 amount) returns (bool)'],
      call: async (contract) => await contract.allocateTo(wallet.address, ethers.parseUnits('1000', 6))
    }
  ];

  for (const method of methods) {
    console.log(`Trying mock method: ${method.name}...`);
    try {
      const contract = new ethers.Contract(USDT_ADDRESS, method.abi, wallet);
      const tx = await method.call(contract);
      console.log(`  Success! Tx submitted: ${tx.hash}`);
      await tx.wait(1);
      console.log(`  Tx confirmed. Balance updated!`);
      return;
    } catch (err) {
      console.log(`  Failed: ${err.reason || err.message}`);
    }
  }

  console.log('❌ Could not mint mock USDT automatically.');
}

main().catch((err) => {
  console.error(err);
});
