const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load env variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Import ethers from the admin-dashboard workspace
const ethersPath = path.resolve(__dirname, '../../../apps/admin-dashboard/node_modules/ethers');
if (!fs.existsSync(ethersPath)) {
  console.error(`❌ Ethers not found at: ${ethersPath}`);
  process.exit(1);
}
const { ethers } = require(ethersPath);

// Config
const SEPOLIA_RPC = process.env.SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com';
const USDT_ADDRESS = '0xbD1ea96750Ef2E971D4B17F80DeB29a081BbA9A0'; // Standard mock USDT on Sepolia
const THB_RATE = 36500000; // 36.5 (6 decimals)
const THB_ID = ethers.keccak256(ethers.toUtf8Bytes("THB"));

async function main() {
  console.log('=================================================');
  console.log('  PRODUCTION UPGRADEABLE STABLECOIN DEPLOYER    ');
  console.log('=================================================');

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.log('❌ ERROR: PRIVATE_KEY environment variable is not set!');
    console.log('\nTo deploy to Sepolia, please run:');
    console.log('  $env:PRIVATE_KEY="0xYourPrivateKey"; node scripts/deploy_production.js');
    console.log('\nAlternatively, generating a temporary wallet for you to fund...');
    
    const tempWallet = ethers.Wallet.createRandom();
    console.log(`\nGenerated Temporary Wallet:`);
    console.log(`Address: ${tempWallet.address}`);
    console.log(`Private Key: ${tempWallet.privateKey}`);
    console.log(`\nPlease fund this wallet with Sepolia ETH and set its private key in the environment to deploy.`);
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

  // ---------------------------------------------------------------------------
  // Load Compiled Artifacts from Hardhat
  // ---------------------------------------------------------------------------
  const artifactsBase = path.resolve(__dirname, '../artifacts/contracts');
  const tokenImplPath = path.resolve(artifactsBase, 'FiatTokenUpgradeable.sol/FiatTokenUpgradeable.json');
  const factoryPath = path.resolve(artifactsBase, 'TokenFactory.sol/TokenFactory.json');
  const bridgePath = path.resolve(artifactsBase, 'MultiCurrencyBridge.sol/MultiCurrencyBridge.json');
  const conversionPath = path.resolve(artifactsBase, 'ReserveConversion.sol/ReserveConversion.json');

  if (!fs.existsSync(tokenImplPath) || !fs.existsSync(factoryPath) || !fs.existsSync(bridgePath) || !fs.existsSync(conversionPath)) {
    console.log('❌ Error: Compiled Hardhat artifacts not found. Please run: pnpm compile first.');
    return;
  }

  const tokenImplArtifact = JSON.parse(fs.readFileSync(tokenImplPath, 'utf8'));
  const factoryArtifact = JSON.parse(fs.readFileSync(factoryPath, 'utf8'));
  const bridgeArtifact = JSON.parse(fs.readFileSync(bridgePath, 'utf8'));
  const conversionArtifact = JSON.parse(fs.readFileSync(conversionPath, 'utf8'));

  // ---------------------------------------------------------------------------
  // 1. Deploy FiatTokenUpgradeable (Shared Implementation)
  // ---------------------------------------------------------------------------
  console.log('Step 1: Deploying FiatTokenUpgradeable implementation...');
  const TokenImplFactory = new ethers.ContractFactory(tokenImplArtifact.abi, tokenImplArtifact.bytecode, wallet);
  const tokenImplContract = await TokenImplFactory.deploy();
  await tokenImplContract.waitForDeployment();
  const tokenImplAddress = await tokenImplContract.getAddress();
  console.log(`✅ FiatTokenUpgradeable implementation deployed at: ${tokenImplAddress}\n`);

  // ---------------------------------------------------------------------------
  // 2. Deploy TokenFactory
  // ---------------------------------------------------------------------------
  console.log('Step 2: Deploying TokenFactory pointing to implementation...');
  const FactoryObj = new ethers.ContractFactory(factoryArtifact.abi, factoryArtifact.bytecode, wallet);
  const factoryContract = await FactoryObj.deploy(wallet.address, tokenImplAddress);
  await factoryContract.waitForDeployment();
  const factoryAddress = await factoryContract.getAddress();
  console.log(`✅ TokenFactory deployed successfully at: ${factoryAddress}\n`);

  // ---------------------------------------------------------------------------
  // 3. Deploy THB Proxy via Factory
  // ---------------------------------------------------------------------------
  console.log('Step 3: Deploying Thai Baht (THB) token proxy via Factory...');
  const initialSupply = ethers.parseUnits('1000000000', 6); // 1 Billion supply with 6 decimals
  
  const txCreate = await factoryContract.createToken(
    'Thai Baht',
    'THB',
    6,
    wallet.address, // Admin
    wallet.address, // Minter
    wallet.address, // Burner
    initialSupply
  );
  console.log(`  Submitting tx: ${txCreate.hash}`);
  const receiptCreate = await txCreate.wait();
  console.log('  Confirmed.');

  // Decode TokenCreated event from logs
  const TokenCreatedTopic = ethers.id('TokenCreated(address,string,string,uint8,address)');
  const log = receiptCreate.logs.find(l => l.topics[0] === TokenCreatedTopic);
  if (!log) {
    throw new Error('TokenCreated event log not found in transaction receipt!');
  }
  const thbProxyAddress = ethers.getAddress('0x' + log.topics[1].slice(26));
  console.log(`✅ THB Proxy deployed successfully at: ${thbProxyAddress}\n`);

  // ---------------------------------------------------------------------------
  // 4. Deploy Independent MultiCurrencyBridge
  // ---------------------------------------------------------------------------
  console.log('Step 4: Deploying MultiCurrencyBridge...');
  const BridgeObj = new ethers.ContractFactory(bridgeArtifact.abi, bridgeArtifact.bytecode, wallet);
  const bridgeContract = await BridgeObj.deploy(wallet.address);
  await bridgeContract.waitForDeployment();
  const bridgeAddress = await bridgeContract.getAddress();
  console.log(`✅ MultiCurrencyBridge deployed successfully at: ${bridgeAddress}\n`);

  // ---------------------------------------------------------------------------
  // 5. Deploy ReserveConversion
  // ---------------------------------------------------------------------------
  console.log('Step 5: Deploying ReserveConversion...');
  const ConversionObj = new ethers.ContractFactory(conversionArtifact.abi, conversionArtifact.bytecode, wallet);
  const conversionContract = await ConversionObj.deploy(wallet.address, USDT_ADDRESS);
  await conversionContract.waitForDeployment();
  const conversionAddress = await conversionContract.getAddress();
  console.log(`✅ ReserveConversion deployed successfully at: ${conversionAddress}\n`);

  // ---------------------------------------------------------------------------
  // 6. Configure Roles on THB Token Proxy
  // ---------------------------------------------------------------------------
  console.log('Step 6: Configuring smart contract roles on THB Token Proxy...');
  const thbContract = new ethers.Contract(thbProxyAddress, tokenImplArtifact.abi, wallet);

  // Grant MINTER_ROLE to Bridge and ReserveConversion
  const minterRole = await thbContract.MINTER_ROLE();
  console.log(`  Granting MINTER_ROLE to Bridge (${bridgeAddress})...`);
  const txM1 = await thbContract.grantRole(minterRole, bridgeAddress);
  await txM1.wait();
  console.log(`  Granting MINTER_ROLE to ReserveConversion (${conversionAddress})...`);
  const txM2 = await thbContract.grantRole(minterRole, conversionAddress);
  await txM2.wait();

  // Grant BURNER_ROLE to Bridge and ReserveConversion
  const burnerRole = await thbContract.BURNER_ROLE();
  console.log(`  Granting BURNER_ROLE to Bridge (${bridgeAddress})...`);
  const txB1 = await thbContract.grantRole(burnerRole, bridgeAddress);
  await txB1.wait();
  console.log(`  Granting BURNER_ROLE to ReserveConversion (${conversionAddress})...`);
  const txB2 = await thbContract.grantRole(burnerRole, conversionAddress);
  await txB2.wait();
  console.log('✅ Token Proxy roles configured.\n');

  // ---------------------------------------------------------------------------
  // 7. Register THB in Bridge and ReserveConversion support
  // ---------------------------------------------------------------------------
  console.log('Step 7: Registering THB in Bridge and ReserveConversion contracts...');
  
  // Register in Bridge
  console.log(`  Registering THB in Bridge...`);
  const bridgeObj = new ethers.Contract(bridgeAddress, bridgeArtifact.abi, wallet);
  const txRegBridge = await bridgeObj.addSupportedToken(THB_ID, thbProxyAddress);
  await txRegBridge.wait();

  // Register in ReserveConversion
  console.log(`  Registering THB in ReserveConversion...`);
  const conversionObj = new ethers.Contract(conversionAddress, conversionArtifact.abi, wallet);
  const txRegConv = await conversionObj.configureToken(THB_ID, thbProxyAddress);
  await txRegConv.wait();

  // Set FX Rate in ReserveConversion
  console.log(`  Setting FX Rate for THB to 36.5 (rate: ${THB_RATE})...`);
  const txRate = await conversionObj.setRate(THB_ID, THB_RATE);
  await txRate.wait();
  console.log('✅ Configuration completed.\n');

  console.log('=================================================');
  console.log('      PRODUCTION SYSTEM DEPLOYMENT SUCCESS       ');
  console.log('=================================================');
  console.log(`Network/Chain ID:        Sepolia (11155111)`);
  console.log(`Implementation Address:  ${tokenImplAddress}`);
  console.log(`Factory Address:         ${factoryAddress}`);
  console.log(`THB Token Proxy Address: ${thbProxyAddress}`);
  console.log(`MultiCurrencyBridge:     ${bridgeAddress}`);
  console.log(`ReserveConversion:       ${conversionAddress}`);
  console.log(`USDT Reference:          ${USDT_ADDRESS}`);
  console.log(`Admin Wallet:            ${wallet.address}`);
  console.log('=================================================');

  // Save deployed addresses locally
  const addressesPath = path.resolve(__dirname, '../deployed_addresses.json');
  fs.writeFileSync(addressesPath, JSON.stringify({
    chainId: 11155111,
    implementation: tokenImplAddress,
    factory: factoryAddress,
    thbProxy: thbProxyAddress,
    bridge: bridgeAddress,
    conversion: conversionAddress,
    usdt: USDT_ADDRESS,
    admin: wallet.address,
    timestamp: new Date().toISOString()
  }, null, 2));
  console.log(`Saved addresses to: ${addressesPath}`);
}

main().catch((error) => {
  console.error('❌ Deployment Failed:', error);
  process.exitCode = 1;
});
