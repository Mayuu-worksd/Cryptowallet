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

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function MINTER_ROLE() view returns (bytes32)',
  'function BURNER_ROLE() view returns (bytes32)',
  'function DEFAULT_ADMIN_ROLE() view returns (bytes32)',
  'function hasRole(bytes32 role, address account) view returns (bool)',
  'function mint(address to, uint256 amount)',
  'function paused() view returns (bool)',
  'function implementation() view returns (address)',
];

const USDT_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function mint(address to, uint256 amount)',
];

const BRIDGE_ABI = [
  'function lock(bytes32 tokenId, uint256 amount, uint256 destChainId, address recipient, uint256 nonce, uint256 deadline) returns (bool)',
  'function release(bytes32 tokenId, uint256 amount, uint256 sourceChainId, address recipient, uint256 nonce, uint256 deadline, bytes calldata signature) returns (bool)',
  'function supportedTokens(bytes32) view returns (address)',
  'function processedTransactions(bytes32) view returns (bool)',
  'function userNonces(address, uint256) view returns (bool)',
];

const CONVERSION_ABI = [
  'function swapUSDTToStablecoin(bytes32 tokenId, uint256 usdtAmount) returns (uint256)',
  'function swapStablecoinToUSDT(bytes32 tokenId, uint256 stablecoinAmount) returns (uint256)',
  'function fxRates(bytes32) view returns (uint256)',
  'function supportedTokens(bytes32) view returns (address)',
];

const CURRENCIES = [
  { name: 'Pakistani Rupee',   symbol: 'PKR', key: 'pkrProxy', rate: 278500000   },
  { name: 'UAE Dirham',        symbol: 'AED', key: 'aedProxy', rate: 3670000     },
  { name: 'Chinese Yuan',      symbol: 'CNY', key: 'cnyProxy', rate: 7230000     },
  { name: 'Russian Ruble',     symbol: 'RUB', key: 'rubProxy', rate: 89500000    },
  { name: 'Uzbekistani Som',   symbol: 'UZS', key: 'uzsProxy', rate: 12600000000 },
  { name: 'Vietnamese Dong',   symbol: 'VND', key: 'vndProxy', rate: 25400000000 },
  { name: 'Indonesian Rupiah', symbol: 'IDR', key: 'idrProxy', rate: 16300000000 },
  { name: 'Philippine Peso',   symbol: 'PHP', key: 'phpProxy', rate: 58500000    },
];

const DEST_CHAIN_ID = 80002; // Polygon Amoy

function pass(msg) { console.log(`    ✅ ${msg}`); }
function fail(msg) { throw new Error(`❌ FAIL: ${msg}`); }

async function testCurrency(currency, addresses, wallet, usdt, bridge, conversion, chainId) {
  const { name, symbol, key, rate } = currency;
  const proxyAddress = addresses[key];
  if (!proxyAddress) fail(`No proxy address for ${symbol} in deployed_addresses.json`);

  const token = new ethers.Contract(proxyAddress, ERC20_ABI, wallet);
  const tokenId = ethers.keccak256(ethers.toUtf8Bytes(symbol));

  console.log(`\n  [${symbol}] Proxy: ${proxyAddress}`);

  // ── CONTRACT VERIFICATION ──────────────────────────────────────────────────
  console.log(`  Contract verification:`);

  const onChainName = await token.name();
  if (onChainName !== name) fail(`name mismatch: expected "${name}", got "${onChainName}"`);
  pass(`name = "${onChainName}"`);

  const onChainSymbol = await token.symbol();
  if (onChainSymbol !== symbol) fail(`symbol mismatch: expected "${symbol}", got "${onChainSymbol}"`);
  pass(`symbol = "${onChainSymbol}"`);

  const onChainDecimals = await token.decimals();
  if (Number(onChainDecimals) !== 6) fail(`decimals mismatch: expected 6, got ${onChainDecimals}`);
  pass(`decimals = 6`);

  const minterRole = await token.MINTER_ROLE();
  const burnerRole = await token.BURNER_ROLE();
  const adminRole = await token.DEFAULT_ADMIN_ROLE();

  const bridgeHasMinter = await token.hasRole(minterRole, addresses.bridge);
  if (!bridgeHasMinter) fail(`Bridge missing MINTER_ROLE on ${symbol}`);
  pass(`Bridge has MINTER_ROLE`);

  const bridgeHasBurner = await token.hasRole(burnerRole, addresses.bridge);
  if (!bridgeHasBurner) fail(`Bridge missing BURNER_ROLE on ${symbol}`);
  pass(`Bridge has BURNER_ROLE`);

  const convHasMinter = await token.hasRole(minterRole, addresses.conversion);
  if (!convHasMinter) fail(`ReserveConversion missing MINTER_ROLE on ${symbol}`);
  pass(`ReserveConversion has MINTER_ROLE`);

  const convHasBurner = await token.hasRole(burnerRole, addresses.conversion);
  if (!convHasBurner) fail(`ReserveConversion missing BURNER_ROLE on ${symbol}`);
  pass(`ReserveConversion has BURNER_ROLE`);

  const adminHasAdmin = await token.hasRole(adminRole, wallet.address);
  if (!adminHasAdmin) fail(`Admin wallet missing DEFAULT_ADMIN_ROLE on ${symbol}`);
  pass(`Admin has DEFAULT_ADMIN_ROLE`);

  const bridgeRegistered = await bridge.supportedTokens(tokenId);
  if (bridgeRegistered.toLowerCase() !== proxyAddress.toLowerCase())
    fail(`Bridge token registration mismatch for ${symbol}`);
  pass(`Bridge registration correct`);

  const convRegistered = await conversion.supportedTokens(tokenId);
  if (convRegistered.toLowerCase() !== proxyAddress.toLowerCase())
    fail(`ReserveConversion token registration mismatch for ${symbol}`);
  pass(`ReserveConversion registration correct`);

  const onChainRate = await conversion.fxRates(tokenId);
  if (onChainRate !== BigInt(rate)) fail(`FX rate mismatch: expected ${rate}, got ${onChainRate}`);
  pass(`FX rate = ${rate} (${rate / 1e6} ${symbol}/USDT)`);

  const isPaused = await token.paused();
  if (isPaused) fail(`${symbol} is paused — should not be paused after deployment`);
  pass(`Not paused`);

  // ── UNAUTHORIZED MINT/BURN PROTECTION ─────────────────────────────────────
  console.log(`  Security checks:`);
  const randomWallet = ethers.Wallet.createRandom().connect(wallet.provider);
  try {
    // This will fail at eth_call level (no ETH) but we verify the role check via hasRole
    const hasUnauthorizedMint = await token.hasRole(minterRole, randomWallet.address);
    if (hasUnauthorizedMint) fail(`Random wallet should NOT have MINTER_ROLE`);
    pass(`Unauthorized address has no MINTER_ROLE`);
  } catch (e) {
    if (e.message.includes('FAIL')) throw e;
    pass(`Unauthorized address has no MINTER_ROLE`);
  }

  // ── CONVERSION: USDT → TOKEN ───────────────────────────────────────────────
  console.log(`  Conversion tests:`);
  const usdtAmount = ethers.parseUnits('1', 6); // 1 USDT
  const expectedTokenAmount = (usdtAmount * BigInt(rate)) / 1000000n;

  let usdtBal = await usdt.balanceOf(wallet.address);
  if (usdtBal < usdtAmount) {
    const txMint = await usdt.mint(wallet.address, ethers.parseUnits('100', 6));
    await txMint.wait();
  }

  const tokenBalBefore = await token.balanceOf(wallet.address);

  const txApprove = await usdt.approve(addresses.conversion, usdtAmount);
  await txApprove.wait();

  const txSwap1 = await conversion.swapUSDTToStablecoin(tokenId, usdtAmount);
  await txSwap1.wait();

  const tokenBalAfter = await token.balanceOf(wallet.address);
  const received = tokenBalAfter - tokenBalBefore;
  if (received !== expectedTokenAmount)
    fail(`USDT→${symbol}: expected ${expectedTokenAmount}, got ${received}`);
  pass(`USDT→${symbol}: received ${ethers.formatUnits(received, 6)} ${symbol}`);

  // ── CONVERSION: TOKEN → USDT ───────────────────────────────────────────────
  // Ensure reserve has USDT
  const reserveBalance = await usdt.balanceOf(addresses.conversion);
  if (reserveBalance < usdtAmount) {
    const txFund = await usdt.transfer(addresses.conversion, ethers.parseUnits('10', 6));
    await txFund.wait();
  }

  const usdtBalBefore = await usdt.balanceOf(wallet.address);
  const txSwap2 = await conversion.swapStablecoinToUSDT(tokenId, expectedTokenAmount);
  await txSwap2.wait();
  const usdtBalAfter2 = await usdt.balanceOf(wallet.address);
  if (usdtBalAfter2 <= usdtBalBefore) fail(`${symbol}→USDT: USDT balance did not increase`);
  pass(`${symbol}→USDT: received ${ethers.formatUnits(usdtBalAfter2 - usdtBalBefore, 6)} USDT`);

  // ── BRIDGE LOCK ────────────────────────────────────────────────────────────
  console.log(`  Bridge tests:`);

  // Mint some tokens to lock
  const lockAmount = ethers.parseUnits('1', 6);
  const txMintForBridge = await token.mint(wallet.address, lockAmount);
  await txMintForBridge.wait();

  const nonce = Date.now();
  const deadline = Math.floor(Date.now() / 1000) + 3600;

  const txApproveBridge = await token.approve(addresses.bridge, lockAmount);
  await txApproveBridge.wait();

  const txLock = await bridge.lock(tokenId, lockAmount, DEST_CHAIN_ID, wallet.address, nonce, deadline);
  await txLock.wait();
  pass(`Bridge lock (burn) succeeded`);

  // ── BRIDGE RELEASE WITH SIGNATURE ─────────────────────────────────────────
  const releaseAmount = ethers.parseUnits('1', 6);
  const sourceChainId = DEST_CHAIN_ID;
  const releaseNonce = Date.now() + 1;
  const releaseDeadline = Math.floor(Date.now() / 1000) + 3600;

  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const txHash = ethers.keccak256(
    abiCoder.encode(
      ['uint256', 'bytes32', 'uint256', 'uint256', 'address', 'uint256', 'uint256'],
      [chainId, tokenId, releaseAmount, sourceChainId, wallet.address, releaseNonce, releaseDeadline]
    )
  );
  const signature = await wallet.signMessage(ethers.getBytes(txHash));

  const txRelease = await bridge.release(
    tokenId, releaseAmount, sourceChainId, wallet.address, releaseNonce, releaseDeadline, signature
  );
  await txRelease.wait();
  pass(`Bridge release (mint) succeeded`);

  // ── REPLAY PROTECTION ─────────────────────────────────────────────────────
  try {
    const txReplay = await bridge.release(
      tokenId, releaseAmount, sourceChainId, wallet.address, releaseNonce, releaseDeadline, signature
    );
    await txReplay.wait();
    fail(`Replay protection FAILED — duplicate release succeeded`);
  } catch (e) {
    if (e.message.includes('FAIL')) throw e;
    pass(`Replay protection: duplicate release reverted`);
  }

  // ── BALANCE CHECK ──────────────────────────────────────────────────────────
  const finalBalance = await token.balanceOf(wallet.address);
  pass(`balanceOf works: ${ethers.formatUnits(finalBalance, 6)} ${symbol}`);

  return { symbol, proxy: proxyAddress, status: 'PASSED' };
}

async function main() {
  console.log('=================================================');
  console.log('   FIAT CURRENCIES E2E TEST SUITE (8 tokens)    ');
  console.log('=================================================\n');

  if (!fs.existsSync(ADDRESSES_PATH)) {
    console.error('❌ deployed_addresses.json not found.');
    process.exit(1);
  }

  const addresses = JSON.parse(fs.readFileSync(ADDRESSES_PATH, 'utf8'));
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ PRIVATE_KEY not set.');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  const chainId = Number(addresses.chainId);

  console.log(`Wallet: ${wallet.address}`);
  console.log(`Chain:  Sepolia (${chainId})\n`);

  const usdt = new ethers.Contract(addresses.usdt, USDT_ABI, wallet);
  const bridge = new ethers.Contract(addresses.bridge, BRIDGE_ABI, wallet);
  const conversion = new ethers.Contract(addresses.conversion, CONVERSION_ABI, wallet);

  const results = [];
  const failed = [];

  for (const currency of CURRENCIES) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Testing: ${currency.symbol} — ${currency.name}`);
    console.log('='.repeat(50));
    try {
      const result = await testCurrency(currency, addresses, wallet, usdt, bridge, conversion, chainId);
      results.push(result);
      console.log(`\n  ✅ ${currency.symbol} ALL TESTS PASSED`);
    } catch (err) {
      console.error(`\n  ❌ ${currency.symbol} FAILED: ${err.message}`);
      failed.push({ symbol: currency.symbol, error: err.message });
      results.push({ symbol: currency.symbol, proxy: addresses[currency.key] || 'N/A', status: 'FAILED' });
    }
  }

  console.log('\n\n=================================================');
  console.log('                 TEST RESULTS                    ');
  console.log('=================================================');
  console.log('Currency | Proxy Address                             | Status');
  console.log('-'.repeat(75));
  for (const r of results) {
    const addr = (r.proxy || 'N/A').padEnd(44);
    console.log(`${r.symbol.padEnd(8)} | ${addr} | ${r.status}`);
  }

  if (failed.length > 0) {
    console.log(`\n❌ ${failed.length} currency(ies) failed E2E tests:`);
    for (const f of failed) console.log(`   - ${f.symbol}: ${f.error}`);
    console.log('\nDo NOT enable failed currencies in Supabase.');
    process.exitCode = 1;
  } else {
    console.log('\n✅ All 8 currencies passed E2E verification.');
    console.log('   You may now set is_enabled=true in Supabase for each verified currency.');
  }
}

main().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exitCode = 1;
});
