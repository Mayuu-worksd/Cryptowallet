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

async function main() {
  console.log('=================================================');
  console.log('            DEPLOYING MOCK USDT CONTRACT         ');
  console.log('=================================================');

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ ERROR: PRIVATE_KEY environment variable is not set!');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Deployer Wallet Address: ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer Balance: ${ethers.formatEther(balance)} ETH\n`);

  // Load compiled artifacts
  const usdtArtifactPath = path.resolve(__dirname, '../artifacts/MockUSDT.json');
  if (!fs.existsSync(usdtArtifactPath)) {
    console.error('❌ Error: MockUSDT.json artifact not found. Run node scripts/compile.js first.');
    return;
  }
  const usdtArtifact = JSON.parse(fs.readFileSync(usdtArtifactPath, 'utf8'));

  console.log('Deploying MockUSDT...');
  const USDTFactory = new ethers.ContractFactory(usdtArtifact.abi, usdtArtifact.bytecode, wallet);
  const usdtContract = await USDTFactory.deploy();
  await usdtContract.waitForDeployment();
  const usdtAddress = await usdtContract.getAddress();
  
  console.log('\n=================================================');
  console.log('           MockUSDT DEPLOYED SUCCESSFULLY        ');
  console.log('=================================================');
  console.log(`MockUSDT Contract Address: ${usdtAddress}`);
  console.log('=================================================');
}

main().catch((err) => {
  console.error(err);
});
