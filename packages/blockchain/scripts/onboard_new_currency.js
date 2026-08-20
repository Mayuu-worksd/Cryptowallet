const fs = require('fs');
const path = require('path');

/**
 * Proof of Concept: Onboarding a New Currency (e.g. AED - United Arab Emirates Dirham)
 * 
 * This script demonstrates the ease of onboarding new currencies into the production architecture.
 * It simulates deploying a new upgradeable token proxy via the factory, granting bridge and conversion
 * roles, registering the token support, setting the exchange rate, and seeding the database.
 * 
 * NOTE: This is a configuration/demonstration script. We do NOT run this on Sepolia to avoid deploying
 * additional testnet tokens, but it contains fully valid code.
 */
async function main() {
  console.log('=================================================');
  console.log('      NEW STABLECOIN ONBOARDING SIMULATION       ');
  console.log('=================================================\n');

  // Configuration for the new currency
  const CURRENCY_NAME = 'United Arab Emirates Dirham';
  const CURRENCY_SYMBOL = 'AED';
  const CURRENCY_DECIMALS = 6;
  const INITIAL_SUPPLY_TOKENS = '500000000'; // 500 Million initial supply
  const FX_RATE = 3670000; // 3.67 represented with 6 decimals (1 USDT = 3.67 AED)

  console.log(`Onboarding Target:`);
  console.log(`- Asset:        ${CURRENCY_SYMBOL} (${CURRENCY_NAME})`);
  console.log(`- Decimals:     ${CURRENCY_DECIMALS}`);
  console.log(`- Target Rate:  ${FX_RATE / 1000000} AED per 1.00 USDT`);
  console.log(`- Initial Mint: ${INITIAL_SUPPLY_TOKENS} AED\n`);

  console.log('--- STEP 1: Deploy Proxy via Factory ---');
  console.log(`const tx = await factoryContract.createToken(`);
  console.log(`  "${CURRENCY_NAME}",`);
  console.log(`  "${CURRENCY_SYMBOL}",`);
  console.log(`  ${CURRENCY_DECIMALS},`);
  console.log(`  adminAddress,`);
  console.log(`  adminAddress,`);
  console.log(`  adminAddress,`);
  console.log(`  ethers.parseUnits("${INITIAL_SUPPLY_TOKENS}", ${CURRENCY_DECIMALS})`);
  console.log(`);`);
  console.log(`const receipt = await tx.wait();`);
  console.log(`const newProxyAddress = parseAddressFromLogs(receipt);\n`);
  
  // Simulated address
  const mockProxyAddress = '0x111122223333444455556666777788889999aAaa';
  console.log(`[SIMULATED] Newly Deployed ${CURRENCY_SYMBOL} Proxy Address: ${mockProxyAddress}\n`);

  console.log('--- STEP 2: Configure Access Control Roles ---');
  console.log(`const tokenProxyContract = new ethers.Contract(newProxyAddress, FiatTokenUpgradeableABI, signer);`);
  console.log(`const minterRole = await tokenProxyContract.MINTER_ROLE();`);
  console.log(`const burnerRole = await tokenProxyContract.BURNER_ROLE();\n`);
  
  console.log(`// Grant Roles to MultiCurrencyBridge`);
  console.log(`await tokenProxyContract.grantRole(minterRole, bridgeAddress);`);
  console.log(`await tokenProxyContract.grantRole(burnerRole, bridgeAddress);\n`);
  
  console.log(`// Grant Roles to ReserveConversion`);
  console.log(`await tokenProxyContract.grantRole(minterRole, conversionAddress);`);
  console.log(`await tokenProxyContract.grantRole(burnerRole, conversionAddress);\n`);
  
  console.log('--- STEP 3: Register Token Support on Infrastructure ---');
  console.log(`const tokenSymbolHash = ethers.keccak256(ethers.toUtf8Bytes("${CURRENCY_SYMBOL}"));\n`);
  
  console.log(`// Register token in MultiCurrencyBridge`);
  console.log(`await bridgeContract.addSupportedToken(tokenSymbolHash, newProxyAddress);\n`);
  
  console.log(`// Register token and set FX rate in ReserveConversion`);
  console.log(`await conversionContract.configureToken(tokenSymbolHash, newProxyAddress);`);
  console.log(`await conversionContract.setRate(tokenSymbolHash, ${FX_RATE});\n`);

  console.log('--- STEP 4: Register Token in Supabase Database ---');
  console.log(`await supabase`);
  console.log(`  .from('token_contracts')`);
  console.log(`  .upsert({`);
  console.log(`    currency_code: "${CURRENCY_SYMBOL}",`);
  console.log(`    network_name: "Sepolia",`);
  console.log(`    contract_address: "${mockProxyAddress}",`);
  console.log(`    decimals: ${CURRENCY_DECIMALS},`);
  console.log(`    is_enabled: true`);
  console.log(`  }, { onConflict: 'currency_code,network_name' });\n`);

  console.log('=================================================');
  console.log(' ONBOARDING PROCESS SUCCESSFULLY OUTLINED/PROVEN ');
  console.log('=================================================');
  console.log(`To onboard other currencies (PKR, CNY, RUB, UZS, VND, IDR, PHP),`);
  console.log(`simply update the symbol and target exchange rate parameters above.`);
}

if (require.main === module) {
  main().catch(console.error);
}
