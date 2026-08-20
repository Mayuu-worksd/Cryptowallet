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

// Currency definitions — exact metadata per spec
const CURRENCIES = [
  { name: 'Pakistani Rupee',     symbol: 'PKR', decimals: 6, rate: 278500000  }, // 278.5 PKR/USDT
  { name: 'UAE Dirham',          symbol: 'AED', decimals: 6, rate: 3670000    }, // 3.67 AED/USDT
  { name: 'Chinese Yuan',        symbol: 'CNY', decimals: 6, rate: 7230000    }, // 7.23 CNY/USDT
  { name: 'Russian Ruble',       symbol: 'RUB', decimals: 6, rate: 89500000   }, // 89.5 RUB/USDT
  { name: 'Uzbekistani Som',     symbol: 'UZS', decimals: 6, rate: 12600000000}, // 12600 UZS/USDT (rate * 1e6 = 12600 * 1e6)
  { name: 'Vietnamese Dong',     symbol: 'VND', decimals: 6, rate: 25400000000}, // 25400 VND/USDT
  { name: 'Indonesian Rupiah',   symbol: 'IDR', decimals: 6, rate: 16300000000}, // 16300 IDR/USDT
  { name: 'Philippine Peso',     symbol: 'PHP', decimals: 6, rate: 58500000   }, // 58.5 PHP/USDT
];

// NOTE on rates: ReserveConversion uses 6-decimal precision.
// Formula: stablecoinAmount = (usdtAmount * rate) / 1e6
// So rate = fiatPerUSDT * 1e6
// For high-value currencies (UZS=12600, VND=25400, IDR=16300):
//   rate = 12600 * 1e6 = 12_600_000_000 (fits in uint256, no overflow)

async function main() {
  console.log('=================================================');
  console.log('   FIAT CURRENCY BATCH DEPLOYMENT (8 tokens)    ');
  console.log('=================================================\n');

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ PRIVATE_KEY not set. Run: $env:PRIVATE_KEY="0x..."; node scripts/deploy_fiat_currencies.js');
    process.exit(1);
  }

  if (!fs.existsSync(ADDRESSES_PATH)) {
    console.error('❌ deployed_addresses.json not found. Deploy THB infrastructure first.');
    process.exit(1);
  }

  const addresses = JSON.parse(fs.readFileSync(ADDRESSES_PATH, 'utf8'));
  console.log('Using existing infrastructure:');
  console.log(`  Implementation: ${addresses.implementation}`);
  console.log(`  Factory:        ${addresses.factory}`);
  console.log(`  Bridge:         ${addresses.bridge}`);
  console.log(`  Conversion:     ${addresses.conversion}`);
  console.log(`  Admin:          ${addresses.admin}\n`);

  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Deployer: ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`ETH Balance: ${ethers.formatEther(balance)} ETH\n`);

  if (balance < ethers.parseEther('0.05')) {
    console.error('❌ Insufficient ETH. Need at least 0.05 Sepolia ETH for 8 deployments.');
    process.exit(1);
  }

  // Load artifacts
  const artifactsBase = path.resolve(__dirname, '../artifacts/contracts');
  const tokenABI = JSON.parse(fs.readFileSync(
    path.resolve(artifactsBase, 'FiatTokenUpgradeable.sol/FiatTokenUpgradeable.json'), 'utf8'
  )).abi;
  const factoryArtifact = JSON.parse(fs.readFileSync(
    path.resolve(artifactsBase, 'TokenFactory.sol/TokenFactory.json'), 'utf8'
  ));
  const bridgeArtifact = JSON.parse(fs.readFileSync(
    path.resolve(artifactsBase, 'MultiCurrencyBridge.sol/MultiCurrencyBridge.json'), 'utf8'
  ));
  const conversionArtifact = JSON.parse(fs.readFileSync(
    path.resolve(artifactsBase, 'ReserveConversion.sol/ReserveConversion.json'), 'utf8'
  ));

  const factory = new ethers.Contract(addresses.factory, factoryArtifact.abi, wallet);
  const bridge = new ethers.Contract(addresses.bridge, bridgeArtifact.abi, wallet);
  const conversion = new ethers.Contract(addresses.conversion, conversionArtifact.abi, wallet);

  const TokenCreatedTopic = ethers.id('TokenCreated(address,string,string,uint8,address)');
  const INITIAL_SUPPLY = ethers.parseUnits('1000000000', 6); // 1 Billion

  const results = {};

  for (const currency of CURRENCIES) {
    console.log(`\n--- Deploying ${currency.symbol} (${currency.name}) ---`);

    // Check if already deployed in factory
    const existing = await factory.tokensBySymbol(currency.symbol);
    if (existing !== ethers.ZeroAddress) {
      console.log(`  ⚠️  ${currency.symbol} already deployed at ${existing} — skipping factory step.`);
      results[currency.symbol] = existing;
    } else {
      // Step 1: Deploy proxy via factory
      console.log(`  Step 1: Creating proxy via TokenFactory...`);
      const txCreate = await factory.createToken(
        currency.name,
        currency.symbol,
        currency.decimals,
        wallet.address,
        wallet.address,
        wallet.address,
        INITIAL_SUPPLY
      );
      console.log(`    Tx: ${txCreate.hash}`);
      const receipt = await txCreate.wait();

      const log = receipt.logs.find(l => l.topics[0] === TokenCreatedTopic);
      if (!log) throw new Error(`TokenCreated event not found for ${currency.symbol}`);
      const proxyAddress = ethers.getAddress('0x' + log.topics[1].slice(26));
      console.log(`  ✅ Proxy deployed: ${proxyAddress}`);
      results[currency.symbol] = proxyAddress;
    }

    const proxyAddress = results[currency.symbol];
    const tokenContract = new ethers.Contract(proxyAddress, tokenABI, wallet);
    const minterRole = await tokenContract.MINTER_ROLE();
    const burnerRole = await tokenContract.BURNER_ROLE();
    const tokenId = ethers.keccak256(ethers.toUtf8Bytes(currency.symbol));

    // Step 2: Grant roles to Bridge and ReserveConversion
    console.log(`  Step 2: Configuring roles...`);
    const bridgeHasMinter = await tokenContract.hasRole(minterRole, addresses.bridge);
    if (!bridgeHasMinter) {
      const tx = await tokenContract.grantRole(minterRole, addresses.bridge);
      await tx.wait();
      console.log(`    MINTER_ROLE → Bridge ✓`);
    } else {
      console.log(`    MINTER_ROLE → Bridge (already set)`);
    }

    const bridgeHasBurner = await tokenContract.hasRole(burnerRole, addresses.bridge);
    if (!bridgeHasBurner) {
      const tx = await tokenContract.grantRole(burnerRole, addresses.bridge);
      await tx.wait();
      console.log(`    BURNER_ROLE → Bridge ✓`);
    } else {
      console.log(`    BURNER_ROLE → Bridge (already set)`);
    }

    const convHasMinter = await tokenContract.hasRole(minterRole, addresses.conversion);
    if (!convHasMinter) {
      const tx = await tokenContract.grantRole(minterRole, addresses.conversion);
      await tx.wait();
      console.log(`    MINTER_ROLE → ReserveConversion ✓`);
    } else {
      console.log(`    MINTER_ROLE → ReserveConversion (already set)`);
    }

    const convHasBurner = await tokenContract.hasRole(burnerRole, addresses.conversion);
    if (!convHasBurner) {
      const tx = await tokenContract.grantRole(burnerRole, addresses.conversion);
      await tx.wait();
      console.log(`    BURNER_ROLE → ReserveConversion ✓`);
    } else {
      console.log(`    BURNER_ROLE → ReserveConversion (already set)`);
    }

    // Step 3: Register in Bridge
    console.log(`  Step 3: Registering in Bridge...`);
    const bridgeToken = await bridge.supportedTokens(tokenId);
    if (bridgeToken === ethers.ZeroAddress) {
      const tx = await bridge.addSupportedToken(tokenId, proxyAddress);
      await tx.wait();
      console.log(`    Bridge registration ✓`);
    } else {
      console.log(`    Bridge (already registered)`);
    }

    // Step 4: Register in ReserveConversion + set FX rate
    console.log(`  Step 4: Registering in ReserveConversion...`);
    const convToken = await conversion.supportedTokens(tokenId);
    if (convToken === ethers.ZeroAddress) {
      const tx = await conversion.configureToken(tokenId, proxyAddress);
      await tx.wait();
      console.log(`    ReserveConversion registration ✓`);
    } else {
      console.log(`    ReserveConversion (already registered)`);
    }

    const currentRate = await conversion.fxRates(tokenId);
    if (currentRate === 0n) {
      const tx = await conversion.setRate(tokenId, BigInt(currency.rate));
      await tx.wait();
      console.log(`    FX rate set: ${currency.rate} (${currency.rate / 1e6} ${currency.symbol}/USDT) ✓`);
    } else {
      console.log(`    FX rate (already set: ${currentRate})`);
    }

    console.log(`  ✅ ${currency.symbol} fully configured.`);
  }

  // Update deployed_addresses.json with new proxy addresses
  const updatedAddresses = {
    ...addresses,
    pkrProxy: results['PKR'],
    aedProxy: results['AED'],
    cnyProxy: results['CNY'],
    rubProxy: results['RUB'],
    uzsProxy: results['UZS'],
    vndProxy: results['VND'],
    idrProxy: results['IDR'],
    phpProxy: results['PHP'],
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(ADDRESSES_PATH, JSON.stringify(updatedAddresses, null, 2));

  console.log('\n=================================================');
  console.log('         DEPLOYMENT SUMMARY                      ');
  console.log('=================================================');
  console.log(`Shared Implementation: ${addresses.implementation}`);
  console.log(`Factory:               ${addresses.factory}`);
  console.log(`Bridge:                ${addresses.bridge}`);
  console.log(`ReserveConversion:     ${addresses.conversion}`);
  console.log('');
  for (const currency of CURRENCIES) {
    console.log(`${currency.symbol.padEnd(4)} Proxy: ${results[currency.symbol]}`);
  }
  console.log('\n✅ All 8 currencies deployed. Run seed_fiat_currencies.js to register in Supabase.');
  console.log('⚠️  Currencies are NOT yet active in wallet. Run E2E tests before enabling.');
}

main().catch((err) => {
  console.error('❌ Deployment failed:', err);
  process.exitCode = 1;
});
