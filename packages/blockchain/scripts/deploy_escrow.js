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

async function main() {
  console.log('=================================================');
  console.log('         DEPLOY P2P ESCROW SMART CONTRACT        ');
  console.log('=================================================');

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ ERROR: PRIVATE_KEY environment variable is not set!');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const deployer = new ethers.Wallet(privateKey, provider);

  const balance = await provider.getBalance(deployer.address);
  console.log(`🔑 Deployer Account: ${deployer.address}`);
  console.log(`💰 Balance:          ${ethers.formatEther(balance)} ETH\n`);

  if (balance === 0n) {
    throw new Error('❌ Deployer wallet has 0 ETH on Sepolia. Fund it first.');
  }

  // Deployer wallet collects the 0.5% platform fee.
  const feeRecipient = deployer.address;
  console.log(`💸 Fee Recipient:    ${feeRecipient}`);
  console.log('⏳ Deploying P2PEscrow contract to Sepolia...');

  // Load artifact
  const artifactPath = path.resolve(__dirname, '../artifacts/contracts/P2PEscrow.sol/P2PEscrow.json');
  if (!fs.existsSync(artifactPath)) {
    console.log('ℹ Contract artifacts not compiled. Compiling first...');
    // We will let Hardhat compile run
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

  const EscrowFactory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
  const escrow = await EscrowFactory.deploy(feeRecipient);
  await escrow.waitForDeployment();

  const address = await escrow.getAddress();
  const network = await provider.getNetwork();

  console.log('\n✅ P2PEscrow deployed successfully!');
  console.log(`📋 Contract address: ${address}`);
  console.log(`🌐 Network:          Sepolia (chainId: ${network.chainId})`);
  console.log('\n👉 Update your apps/mobile/services/escrowService.ts with:');
  console.log(`   Sepolia: '${address}'\n`);
}

main().catch((error) => {
  console.error('\n❌ Deployment failed:', error);
  process.exitCode = 1;
});
