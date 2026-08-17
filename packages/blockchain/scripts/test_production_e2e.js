const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load env variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Import ethers
const ethersPath = path.resolve(__dirname, '../../../apps/admin-dashboard/node_modules/ethers');
if (!fs.existsSync(ethersPath)) {
  console.error(`❌ Ethers not found at: ${ethersPath}`);
  process.exit(1);
}
const { ethers } = require(ethersPath);

// Config
const ALCHEMY_KEY = process.env.EXPO_PUBLIC_ALCHEMY_KEY || '';
const SEPOLIA_RPC = process.env.SEPOLIA_RPC || (ALCHEMY_KEY 
  ? `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}` 
  : 'https://ethereum-sepolia-rpc.publicnode.com');
const ADDRESSES_PATH = path.resolve(__dirname, '../deployed_addresses.json');

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function mint(address to, uint256 amount) returns (bool)'
];

// Helper to retry operations on network errors
async function retry(fn, maxRetries = 5, delay = 5000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      const isNetworkError = 
        err.message.includes('ECONNRESET') || 
        err.message.includes('ETIMEDOUT') || 
        err.message.includes('network') || 
        err.message.includes('timeout') || 
        err.message.includes('429');
      
      if (isNetworkError && i < maxRetries - 1) {
        console.warn(`⚠️ Network warning: "${err.message}". Retrying in ${delay / 1000}s... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

// Custom receipt polling helper to bypass Ethers wait() timeouts
async function waitForReceipt(provider, txHash, maxAttempts = 30, interval = 4000) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt) {
        if (receipt.status === 1) {
          return receipt;
        } else {
          throw new Error(`Transaction reverted: ${txHash}`);
        }
      }
    } catch (err) {
      console.warn(`  ⚠️ Warning fetching receipt for ${txHash}: ${err.message}. Retrying...`);
    }
    await new Promise(r => setTimeout(r, interval));
  }
  throw new Error(`Timeout waiting for transaction receipt: ${txHash}`);
}

async function main() {
  console.log('=================================================');
  console.log('    PRODUCTION STABLECOIN ON-CHAIN E2E TESTS     ');
  console.log('=================================================');

  if (!fs.existsSync(ADDRESSES_PATH)) {
    console.error('❌ Deployed addresses file not found! Deploy contracts first.');
    return;
  }

  const addresses = JSON.parse(fs.readFileSync(ADDRESSES_PATH, 'utf8'));
  console.log(`Using Deployed Addresses:`);
  console.log(JSON.stringify(addresses, null, 2));
  console.log('');

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ PRIVATE_KEY env variable is not set!');
    return;
  }

  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`User Wallet Address: ${wallet.address}`);

  const chainId = Number(addresses.chainId);
  const THB_ID = ethers.keccak256(ethers.toUtf8Bytes("THB"));

  // Instantiate contracts
  const usdt = new ethers.Contract(addresses.usdt, ERC20_ABI, wallet);
  const thb = new ethers.Contract(addresses.thbProxy, ERC20_ABI, wallet);
  
  const tokenImplArtifact = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../artifacts/contracts/FiatTokenUpgradeable.sol/FiatTokenUpgradeable.json'), 'utf8'));
  const bridgeArtifact = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../artifacts/contracts/MultiCurrencyBridge.sol/MultiCurrencyBridge.json'), 'utf8'));
  const conversionArtifact = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../artifacts/contracts/ReserveConversion.sol/ReserveConversion.json'), 'utf8'));

  const bridge = new ethers.Contract(addresses.bridge, bridgeArtifact.abi, wallet);
  const conversion = new ethers.Contract(addresses.conversion, conversionArtifact.abi, wallet);

  // Mint some USDT if the balance is low
  let usdtBal = await retry(() => usdt.balanceOf(wallet.address));
  console.log(`Initial USDT Balance: ${ethers.formatUnits(usdtBal, 6)} USDT`);
  if (usdtBal < ethers.parseUnits('20', 6)) {
    console.log('Minting 100 Mock USDT to user for E2E testing...');
    const txMintUSDT = await retry(() => usdt.mint(wallet.address, ethers.parseUnits('100', 6)));
    await waitForReceipt(provider, txMintUSDT.hash);
    usdtBal = await retry(() => usdt.balanceOf(wallet.address));
    console.log(`New USDT Balance: ${ethers.formatUnits(usdtBal, 6)} USDT`);
  }

  let thbBal = await retry(() => thb.balanceOf(wallet.address));
  console.log(`Initial THB Balance:  ${ethers.formatUnits(thbBal, 6)} THB\n`);

  // ---------------------------------------------------------------------------
  // TEST 1: USDT -> THB Swap (Reserve Conversion)
  // ---------------------------------------------------------------------------
  console.log('[TEST 1] Swapping 10 USDT → THB...');
  const usdtAmount = ethers.parseUnits('10', 6);
  const expectedTHB = ethers.parseUnits('365', 6); // 10 * 36.5 = 365 THB

  console.log('  Approving ReserveConversion contract to spend 10 USDT...');
  const txApp1 = await retry(() => usdt.approve(addresses.conversion, usdtAmount));
  await waitForReceipt(provider, txApp1.hash);
  console.log('  Allowance set.');

  console.log('  Executing swapUSDTToStablecoin...');
  const txSwap1 = await retry(() => conversion.swapUSDTToStablecoin(THB_ID, usdtAmount));
  console.log(`  Tx Hash: ${txSwap1.hash}`);
  await waitForReceipt(provider, txSwap1.hash);
  console.log('  Confirmed!');

  let usdtBalAfter = await retry(() => usdt.balanceOf(wallet.address));
  let thbBalAfter = await retry(() => thb.balanceOf(wallet.address));
  console.log(`  USDT Balance: ${ethers.formatUnits(usdtBalAfter, 6)} USDT`);
  console.log(`  THB Balance:  ${ethers.formatUnits(thbBalAfter, 6)} THB`);
  
  if (thbBalAfter - thbBal !== expectedTHB) {
    throw new Error('❌ Test 1 Failed: THB balance did not increase by 365 THB!');
  }
  console.log('✅ USDT -> THB swap PASSED.\n');

  // ---------------------------------------------------------------------------
  // TEST 2: THB -> USDT Swap (Reserve Conversion)
  // ---------------------------------------------------------------------------
  console.log('[TEST 2] Swapping 365 THB → USDT...');
  
  // Funding reserve with some USDT if needed (ReserveConversion holds the reserve)
  const reserveUsdt = await retry(() => usdt.balanceOf(addresses.conversion));
  console.log(`  Reserve USDT Liquidity: ${ethers.formatUnits(reserveUsdt, 6)} USDT`);
  if (reserveUsdt < usdtAmount) {
    console.log('  Funding ReserveConversion contract with 50 USDT...');
    const txFund = await retry(() => usdt.transfer(addresses.conversion, ethers.parseUnits('50', 6)));
    await waitForReceipt(provider, txFund.hash);
  }

  // Approve THB (ReserveConversion will burn, it holds BURNER_ROLE on THB so no allowance is required, let's verify!)
  console.log('  Executing swapStablecoinToUSDT (burning stablecoin)...');
  const txSwap2 = await retry(() => conversion.swapStablecoinToUSDT(THB_ID, expectedTHB));
  console.log(`  Tx Hash: ${txSwap2.hash}`);
  await waitForReceipt(provider, txSwap2.hash);
  console.log('  Confirmed!');

  usdtBalAfter = await retry(() => usdt.balanceOf(wallet.address));
  thbBalAfter = await retry(() => thb.balanceOf(wallet.address));
  console.log(`  USDT Balance: ${ethers.formatUnits(usdtBalAfter, 6)} USDT`);
  console.log(`  THB Balance:  ${ethers.formatUnits(thbBalAfter, 6)} THB`);
  console.log('✅ THB -> USDT swap PASSED.\n');

  // ---------------------------------------------------------------------------
  // TEST 3: Bridge Lock (Sepolia THB -> Lock/Burn)
  // ---------------------------------------------------------------------------
  console.log('[TEST 3] Locking 50 THB on Sepolia Bridge (Cross-Chain outbound)...');
  const lockAmount = ethers.parseUnits('50', 6);
  const destChainId = 80002; // Polygon Amoy
  const recipient = wallet.address;
  const nonce = Date.now();
  const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour

  console.log('  Approving Bridge contract to spend 50 THB...');
  // We need to resolve overloaded getFunction for Ethers v6
  const thbContractWithSigner = new ethers.Contract(addresses.thbProxy, tokenImplArtifact.abi, wallet);
  const txAppBridge = await retry(() => thbContractWithSigner.approve(addresses.bridge, lockAmount));
  await waitForReceipt(provider, txAppBridge.hash);

  console.log('  Executing lock (outbound bridge)...');
  const txLock = await retry(() => bridge.lock(THB_ID, lockAmount, destChainId, recipient, nonce, deadline));
  console.log(`  Lock Tx Hash: ${txLock.hash}`);
  await waitForReceipt(provider, txLock.hash);
  console.log('  Confirmed! Tokens successfully locked (burned).');
  console.log('✅ Lock/Burn outbound bridge transaction PASSED.\n');

  // ---------------------------------------------------------------------------
  // TEST 4: Bridge Release with signature (Replay/Double execution protection)
  // ---------------------------------------------------------------------------
  console.log('[TEST 4] Simulating Inbound Bridge Release with Relayer Signature...');
  const releaseAmount = ethers.parseUnits('50', 6);
  const sourceChainId = 80002;
  const releaseNonce = Date.now() + 1;
  const releaseDeadline = Math.floor(Date.now() / 1000) + 3600;

  // Calculate the message hash on-chain (using abi.encode equivalent in ethers)
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const txHash = ethers.keccak256(
    abiCoder.encode(
      ["uint256", "bytes32", "uint256", "uint256", "address", "uint256", "uint256"],
      [chainId, THB_ID, releaseAmount, sourceChainId, recipient, releaseNonce, releaseDeadline]
    )
  );

  console.log(`  Computed txHash: ${txHash}`);
  
  // Sign the digest with our relayer key (the deployer wallet holds RELAYER_ROLE on bridge)
  const messageHashBytes = ethers.getBytes(ethers.hashMessage(ethers.getBytes(txHash)));
  const signature = await retry(() => wallet.signMessage(ethers.getBytes(txHash)));
  console.log(`  Signature generated.`);

  console.log('  Executing release (inbound bridge)...');
  const txRelease = await retry(() => bridge.release(
    THB_ID,
    releaseAmount,
    sourceChainId,
    recipient,
    releaseNonce,
    releaseDeadline,
    signature
  ));
  console.log(`  Release Tx Hash: ${txRelease.hash}`);
  await waitForReceipt(provider, txRelease.hash);
  console.log('  Confirmed! Tokens successfully released (minted).');

  // ---------------------------------------------------------------------------
  // TEST 5: Double execution protection check
  // ---------------------------------------------------------------------------
  console.log('[TEST 5] Checking Replay Protection (Double Release execution)...');
  try {
    console.log('  Attempting to call release again with the same parameters...');
    const txReplay = await retry(() => bridge.release(
      THB_ID,
      releaseAmount,
      sourceChainId,
      recipient,
      releaseNonce,
      releaseDeadline,
      signature
    ));
    await waitForReceipt(provider, txReplay.hash);
    throw new Error('❌ Test 5 FAILED: Replay transaction was executed successfully!');
  } catch (err) {
    if (err.message.includes('Bridge: transaction already processed') || err.message.includes('revert')) {
      console.log('  Replay transaction reverted as expected.');
      console.log('✅ Double execution check PASSED.');
    } else {
      throw err;
    }
  }

  console.log('\n=================================================');
  console.log('        ON-CHAIN E2E TESTS PASSED SUCCESSFULLY   ');
  console.log('=================================================');
}

main().catch((error) => {
  console.error('❌ E2E Test Failed:', error);
  process.exitCode = 1;
});
