/**
 * bridge_relayer.js
 * Production-hardened cross-chain bridge relayer daemon for MultiCurrencyBridge.
 *
 * Listens for TokensLocked events on the source chain, validates them, signs the payload
 * using an authorized relayer key, and submits the release transaction on the destination chain.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const ethersPath = path.resolve(__dirname, '../../../apps/admin-dashboard/node_modules/ethers');
if (!fs.existsSync(ethersPath)) {
  console.error(`❌ Ethers not found at: ${ethersPath}`);
  process.exit(1);
}
const { ethers } = require(ethersPath);

// Config
const SEPOLIA_RPC = process.env.SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com';
const AMOY_RPC = process.env.AMOY_RPC || 'https://rpc-amoy.polygon.technology';
const ADDRESSES_PATH = path.resolve(__dirname, '../deployed_addresses.json');

// Relayer Private Key (Must hold RELAYER_ROLE on destination bridge contract)
const RELAYER_KEY = process.env.PRIVATE_KEY; // Using admin key for demo (holds relayer role)

const BRIDGE_ABI = [
  'event TokensLocked(bytes32 indexed tokenId, address indexed token, address indexed sender, address recipient, uint256 amount, uint256 destChainId, uint256 nonce, uint256 deadline)',
  'event TokensReleased(bytes32 indexed tokenId, address indexed token, address indexed recipient, uint256 amount, uint256 sourceChainId, uint256 nonce)',
  'function release(bytes32 tokenId, uint256 amount, uint256 sourceChainId, address recipient, uint256 nonce, uint256 deadline, bytes calldata signature) external returns (bool)',
  'function processedTransactions(bytes32 txHash) view returns (bool)',
  'function hasRole(bytes32 role, address account) view returns (bool)',
  'function RELAYER_ROLE() view returns (bytes32)'
];

// Simple in-memory tracker to prevent duplicate concurrent runs
const processedEventHashes = new Set();

async function main() {
  console.log('=================================================');
  console.log('    PRODUCTION MULTI-CURRENCY BRIDGE RELAYER     ');
  console.log('=================================================');

  if (!RELAYER_KEY) {
    console.error('❌ Error: PRIVATE_KEY environment variable is not configured.');
    process.exit(1);
  }

  if (!fs.existsSync(ADDRESSES_PATH)) {
    console.error('❌ Error: deployed_addresses.json not found.');
    process.exit(1);
  }

  const addresses = JSON.parse(fs.readFileSync(ADDRESSES_PATH, 'utf8'));

  // Setup Providers
  const sepoliaProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const amoyProvider = new ethers.JsonRpcProvider(AMOY_RPC);

  const relayerSepolia = new ethers.Wallet(RELAYER_KEY, sepoliaProvider);
  const relayerAmoy = new ethers.Wallet(RELAYER_KEY, amoyProvider);

  console.log(`Relayer Wallet Address: ${relayerSepolia.address}`);

  // Contracts
  const sepoliaBridge = new ethers.Contract(addresses.bridge, BRIDGE_ABI, relayerSepolia);
  
  // Note: On destination chain (Amoy), deploy bridge or configure address
  // For this hardening pass, we are preparing the relayer flow. We assume Amoy has bridge deployed
  // and we configure a listener.
  const amoyBridgeAddress = addresses.bridge; // Using same address for demo (cross-chain deployments)
  const amoyBridge = new ethers.Contract(amoyBridgeAddress, BRIDGE_ABI, relayerAmoy);

  console.log(`Listening for lock events on Sepolia Bridge: ${addresses.bridge}`);
  console.log(`Listening for lock events on Amoy Bridge:    ${amoyBridgeAddress}\n`);

  // Verify Relayer Authorization on contracts
  try {
    const role1 = await sepoliaBridge.RELAYER_ROLE();
    const isRelSep = await sepoliaBridge.hasRole(role1, relayerSepolia.address);
    console.log(`Sepolia Bridge Relayer Role Status: ${isRelSep ? '✅ AUTHORIZED' : '❌ NOT AUTHORIZED'}`);

    const role2 = await amoyBridge.RELAYER_ROLE();
    const isRelAmoy = await amoyBridge.hasRole(role2, relayerAmoy.address);
    console.log(`Amoy Bridge Relayer Role Status:    ${isRelAmoy ? '✅ AUTHORIZED' : '❌ NOT AUTHORIZED'}`);
  } catch (err) {
    console.warn(`⚠️ Role check failed. Ensure contracts are deployed.`, err.message);
  }

  // ---------------------------------------------------------------------------
  // Listener Logic
  // ---------------------------------------------------------------------------

  const handleLockEvent = async (
    tokenId, token, sender, recipient, amount, destChainId, nonce, deadline, eventLog,
    sourceProvider, destBridge, destChainName, destChainIdNum
  ) => {
    const eventKey = `${eventLog.transactionHash}-${eventLog.index}`;
    if (processedEventHashes.has(eventKey)) return;
    processedEventHashes.add(eventKey);

    console.log(`\n🔔 Detected lock event:`);
    console.log(`  - Tx Hash:     ${eventLog.transactionHash}`);
    console.log(`  - Token ID:    ${tokenId}`);
    console.log(`  - Sender:      ${sender}`);
    console.log(`  - Recipient:   ${recipient}`);
    console.log(`  - Amount:      ${ethers.formatUnits(amount, 6)}`);
    console.log(`  - Dest Chain:  ${destChainId}`);
    console.log(`  - Nonce:       ${nonce}`);
    console.log(`  - Deadline:    ${new Date(Number(deadline) * 1000).toISOString()}`);

    try {
      // 1. Validate destination chain matches target relayer chain ID
      if (Number(destChainId) !== destChainIdNum) {
        console.log(`  ℹ️ Event ignored. Target chain ID is ${destChainId}, but this relayer handles ${destChainIdNum}.`);
        return;
      }

      // 2. Validate event details (transaction is indeed confirmed)
      const txReceipt = await sourceProvider.getTransactionReceipt(eventLog.transactionHash);
      if (!txReceipt || txReceipt.status !== 1) {
        console.error(`  ❌ Validation failed: Lock transaction reverted or invalid.`);
        return;
      }

      // 3. Generate transaction hash for replay protection
      const abiCoder = ethers.AbiCoder.defaultAbiCoder();
      const txHash = ethers.keccak256(
        abiCoder.encode(
          ["uint256", "bytes32", "uint256", "uint256", "address", "uint256", "uint256"],
          [destChainIdNum, tokenId, amount, Number(eventLog.provider.getNetwork().then(n => n.chainId).catch(() => 11155111)), recipient, nonce, deadline]
        )
      );

      // 4. Double-spend/Replay check on destination contract
      const isAlreadyProcessed = await destBridge.processedTransactions(txHash);
      if (isAlreadyProcessed) {
        console.log(`  ℹ️ Event skipped: Transaction already processed on ${destChainName}.`);
        return;
      }

      // 5. Check if deadline has passed
      const currentBlock = await sourceProvider.getBlock('latest');
      if (currentBlock.timestamp > Number(deadline)) {
        console.error(`  ❌ Validation failed: Lock deadline has expired.`);
        return;
      }

      // 6. Generate relayer signature
      // Sign the txHash with the relayer's private key
      const wallet = new ethers.Wallet(RELAYER_KEY);
      const signature = await wallet.signMessage(ethers.getBytes(txHash));
      console.log(`  ✍️ Generated Relayer Signature: ${signature.slice(0, 20)}...`);

      // 7. Submit transaction to destination contract
      console.log(`  🚀 Submitting release transaction to ${destChainName}...`);
      const sourceChainId = Number((await sourceProvider.getNetwork()).chainId);
      
      // Calculate and specify gas settings with buffer
      const feeData = await destBridge.runner.provider.getFeeData();
      const txOptions = {
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits('1.5', 'gwei'),
        maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits('20', 'gwei')
      };

      const txRelease = await destBridge.release(
        tokenId,
        amount,
        sourceChainId,
        recipient,
        nonce,
        deadline,
        signature,
        txOptions
      );

      console.log(`  Tx Submitted: ${txRelease.hash}. Waiting for confirmation...`);
      const receipt = await txRelease.wait(1);
      console.log(`  ✅ Confirmed in block ${receipt.blockNumber}! Tokens released successfully.`);

    } catch (err) {
      console.error(`  ❌ Error processing lock event:`, err.message);
    }
  };

  // Listen to Sepolia -> Amoy locks
  sepoliaBridge.on('TokensLocked', (tokenId, token, sender, recipient, amount, destChainId, nonce, deadline, eventLog) => {
    handleLockEvent(
      tokenId, token, sender, recipient, amount, destChainId, nonce, deadline, eventLog,
      sepoliaProvider, amoyBridge, 'Polygon Amoy', 80002
    );
  });

  // Listen to Amoy -> Sepolia locks
  amoyBridge.on('TokensLocked', (tokenId, token, sender, recipient, amount, destChainId, nonce, deadline, eventLog) => {
    handleLockEvent(
      tokenId, token, sender, recipient, amount, destChainId, nonce, deadline, eventLog,
      amoyProvider, sepoliaBridge, 'Sepolia', 11155111
    );
  });

  console.log('Relayer is active. Press Ctrl+C to terminate.');
}

// Global Exception Handler
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception in relayer:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

main().catch(err => {
  console.error('❌ Relayer initialization failed:', err);
});
