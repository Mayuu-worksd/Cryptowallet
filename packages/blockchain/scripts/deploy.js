const fs = require('fs');
const path = require('path');

// Import ethers from the admin-dashboard workspace to run without local package issues
const ethersPath = path.resolve(__dirname, '../../../apps/admin-dashboard/node_modules/ethers');
if (!fs.existsSync(ethersPath)) {
  console.error(`❌ Ethers not found at: ${ethersPath}`);
  console.error('Please make sure apps/admin-dashboard has node_modules installed.');
  process.exit(1);
}
const { ethers } = require(ethersPath);

// Config
const SEPOLIA_RPC = process.env.SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com';

async function main() {
  console.log('=================================================');
  console.log('      ERC-20 FACTORY & THB DEPLOYER SCRIPT       ');
  console.log('=================================================');

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.log('❌ ERROR: PRIVATE_KEY environment variable is not set!');
    console.log('\nTo deploy to Sepolia, please run:');
    console.log('  $env:PRIVATE_KEY="0xYourPrivateKey"; node scripts/deploy.js');
    console.log('\nAlternatively, generating a mock run with a random wallet key...');
    
    const tempWallet = ethers.Wallet.createRandom();
    console.log(`\nGenerated Temporary Wallet:`);
    console.log(`Address: ${tempWallet.address}`);
    console.log(`Private Key: ${tempWallet.privateKey}`);
    console.log(`\nPlease fund this wallet with Sepolia ETH and run the script with its private key to deploy.`);
    return;
  }

  // Set up provider and wallet
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Deployer Wallet Address: ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer Balance: ${ethers.formatEther(balance)} ETH\n`);

  if (balance === 0n) {
    console.log('❌ Error: Deployer address has 0 ETH. Please fund the wallet with Sepolia ETH before deploying.');
    return;
  }

  // Load compiled artifacts
  const factoryArtifactPath = path.resolve(__dirname, '../artifacts/TokenFactory.json');
  const tokenArtifactPath = path.resolve(__dirname, '../artifacts/FiatToken.json');

  if (!fs.existsSync(factoryArtifactPath) || !fs.existsSync(tokenArtifactPath)) {
    console.log('❌ Error: Compiled artifacts not found. Please run node scripts/compile.js first.');
    return;
  }

  const factoryArtifact = JSON.parse(fs.readFileSync(factoryArtifactPath, 'utf8'));
  const tokenArtifact = JSON.parse(fs.readFileSync(tokenArtifactPath, 'utf8'));

  // 1. Deploy TokenFactory
  console.log('Deploying TokenFactory...');
  const FactoryObj = new ethers.ContractFactory(factoryArtifact.abi, factoryArtifact.bytecode, wallet);
  const factoryContract = await FactoryObj.deploy(wallet.address);
  await factoryContract.waitForDeployment();
  const factoryAddress = await factoryContract.getAddress();
  console.log(`✅ TokenFactory deployed successfully at: ${factoryAddress}\n`);

  // 2. Deploy Thai Baht (THB) token via Factory
  console.log('Deploying Thai Baht (THB) token via TokenFactory...');
  
  // 1 Billion supply with 6 decimals = 1,000,000,000.000000 = 10^15 units
  const initialSupply = ethers.parseUnits('1000000000', 6);
  
  const tx = await factoryContract.createToken(
    'Thai Baht',
    'THB',
    6,
    wallet.address, // Admin
    wallet.address, // Minter
    wallet.address, // Burner
    initialSupply
  );
  console.log(`Transaction submitted. Hash: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log('Transaction confirmed.');

  // Parse logs to find TokenCreated
  const TokenCreatedTopic = ethers.id('TokenCreated(address,string,string,uint8,address)');
  const log = receipt.logs.find(l => l.topics[0] === TokenCreatedTopic);
  
  if (!log) {
    throw new Error('TokenCreated event log not found in transaction receipt!');
  }

  // Decode the parameters
  const thbAddress = ethers.getAddress('0x' + log.topics[1].slice(26));
  console.log(`✅ Thai Baht (THB) Token deployed successfully at: ${thbAddress}\n`);

  // 3. E2E On-Chain Verification
  console.log('-------------------------------------------------');
  console.log('         E2E ON-CHAIN VERIFICATION SUITE         ');
  console.log('-------------------------------------------------');
  
  const tokenContract = new ethers.Contract(thbAddress, tokenArtifact.abi, wallet);

  // A. Check Metadata
  const name = await tokenContract.name();
  const symbol = await tokenContract.symbol();
  const decimals = await tokenContract.decimals();
  console.log(`Metadata Check:`);
  console.log(`  Name:     ${name} (Expected: Thai Baht)`);
  console.log(`  Symbol:   ${symbol} (Expected: THB)`);
  console.log(`  Decimals: ${decimals} (Expected: 6)`);

  if (name !== 'Thai Baht' || symbol !== 'THB' || Number(decimals) !== 6) {
    console.error('❌ E2E Failed: Metadata mismatch!');
    return;
  }
  console.log('✅ Metadata check PASSED.');

  // B. Check Supply
  const totalSupply = await tokenContract.totalSupply();
  const deployerBalance = await tokenContract.balanceOf(wallet.address);
  console.log(`Supply Check:`);
  console.log(`  Total Supply:     ${ethers.formatUnits(totalSupply, 6)} THB`);
  console.log(`  Deployer Balance: ${ethers.formatUnits(deployerBalance, 6)} THB`);

  if (totalSupply !== initialSupply || deployerBalance !== initialSupply) {
    console.error('❌ E2E Failed: Initial supply mismatch!');
    return;
  }
  console.log('✅ Supply check PASSED.');

  // C. Check Roles
  const minterRole = await tokenContract.MINTER_ROLE();
  const isMinter = await tokenContract.hasRole(minterRole, wallet.address);
  console.log(`Access Control Check:`);
  console.log(`  Deployer has MINTER_ROLE: ${isMinter}`);
  
  if (!isMinter) {
    console.error('❌ E2E Failed: Deployer missing MINTER_ROLE!');
    return;
  }
  console.log('✅ Access control check PASSED.');

  // D. Run test mint
  console.log('Testing Minter minting to a test recipient...');
  const testRecipient = ethers.Wallet.createRandom().address;
  const mintAmount = ethers.parseUnits('500', 6);
  const mintTx = await tokenContract.mint(testRecipient, mintAmount);
  await mintTx.wait();
  
  const recipientBalance = await tokenContract.balanceOf(testRecipient);
  console.log(`  Recipient Balance after mint: ${ethers.formatUnits(recipientBalance, 6)} THB`);
  if (recipientBalance !== mintAmount) {
    console.error('❌ E2E Failed: Mint balance check mismatch!');
    return;
  }
  console.log('✅ Mint check PASSED.');

  // E. Run test burn
  console.log('Testing custom burnFrom(amount, reason)...');
  const burnAmount = ethers.parseUnits('100', 6);
  const burnTx = await tokenContract.getFunction("burnFrom(uint256,string)")(burnAmount, 'Verification Test Burn');
  await burnTx.wait();
  
  const deployerBalanceAfterBurn = await tokenContract.balanceOf(wallet.address);
  console.log(`  Deployer balance after burning 100 THB: ${ethers.formatUnits(deployerBalanceAfterBurn, 6)} THB`);
  if (deployerBalanceAfterBurn !== initialSupply - burnAmount) {
    console.error('❌ E2E Failed: Burn balance check mismatch!');
    return;
  }
  console.log('✅ Burn check PASSED.');

  console.log('\n=================================================');
  console.log('           DEPLOYMENT & E2E TESTS PASSED         ');
  console.log('=================================================');
  console.log(`Factory Contract:  ${factoryAddress}`);
  console.log(`THB Token Contract: ${thbAddress}`);
  console.log('=================================================');
}

main().catch((error) => {
  console.error('❌ Deployment Failed:', error);
  process.exitCode = 1;
});
