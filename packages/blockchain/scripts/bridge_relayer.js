/**
 * bridge_relayer.js
 * Automated cross-chain bridge relayer daemon for MultiCurrencyBridge.
 *
 * Listens for TokensLocked events on Sepolia and Polygon Amoy, validates them,
 * signs payloads using authorized relayer key, submits release transactions,
 * handles retries, enforces idempotency, and maintains persistent state.
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

// Configured RPC URLs with fallback
const SEPOLIA_RPC = process.env.SEPOLIA_RPC || 'https://eth-sepolia.g.alchemy.com/v2/alch_qFLArkppX6O94tKMhIIUO';
const AMOY_RPC = process.env.AMOY_RPC || 'https://polygon-amoy.g.alchemy.com/v2/alch_qFLArkppX6O94tKMhIIUO';
const ADDRESSES_PATH = path.resolve(__dirname, '../deployed_addresses.json');
const STATE_FILE_PATH = path.resolve(__dirname, 'relayer_state.json');

// Relayer Private Key (Must hold RELAYER_ROLE on destination bridge contract)
const RELAYER_KEY = process.env.PRIVATE_KEY;

// Verified Deployed Contracts
const SEPOLIA_CHAIN_ID = 11155111;
const AMOY_CHAIN_ID = 80002;
const SEPOLIA_BRIDGE_ADDR = '0xA7283676630FbcA55f3f0743755A0815CcF78103';
const AMOY_BRIDGE_ADDR = '0xC18ff9369B9aa703716c975C1aB0fF8fd1Ef50c1';

const BRIDGE_ABI = [
  'event TokensLocked(bytes32 indexed tokenId, address indexed token, address indexed sender, address recipient, uint256 amount, uint256 destChainId, uint256 nonce, uint256 deadline)',
  'event TokensReleased(bytes32 indexed tokenId, address indexed token, address indexed recipient, uint256 amount, uint256 sourceChainId, uint256 nonce)',
  'function release(bytes32 tokenId, uint256 amount, uint256 sourceChainId, address recipient, uint256 nonce, uint256 deadline, bytes calldata signature) external returns (bool)',
  'function processedTransactions(bytes32 txHash) view returns (bool)',
  'function supportedTokens(bytes32 tokenId) view returns (address)',
  'function hasRole(bytes32 role, address account) view returns (bool)',
  'function RELAYER_ROLE() view returns (bytes32)'
];

const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

// Persistent Relayer State Management
function loadState() {
  if (fs.existsSync(STATE_FILE_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE_PATH, 'utf8'));
    } catch (e) {
      console.warn('⚠️ Could not parse relayer_state.json, creating new state.');
    }
  }
  return {
    lastProcessedBlock: {
      [SEPOLIA_CHAIN_ID]: 0,
      [AMOY_CHAIN_ID]: 0
    },
    processedEvents: {},
    failedEvents: {}
  };
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('❌ Failed to save relayer state:', e.message);
  }
}

const relayerState = loadState();
const inFlightEvents = new Set();

async function main() {
  console.log('=================================================');
  console.log('    AUTOMATED MULTI-CURRENCY BRIDGE RELAYER     ');
  console.log('=================================================');

  if (!RELAYER_KEY) {
    console.error('❌ Error: PRIVATE_KEY environment variable is not configured.');
    process.exit(1);
  }

  // Setup Fetch options to avoid IPv6 issues on Node.js
  const fetchReqOpts = { fetchOptions: { family: 4 } };
  const sepoliaProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC, undefined, fetchReqOpts);
  const amoyProvider = new ethers.JsonRpcProvider(AMOY_RPC, undefined, fetchReqOpts);

  const relayerSepolia = new ethers.Wallet(RELAYER_KEY, sepoliaProvider);
  const relayerAmoy = new ethers.Wallet(RELAYER_KEY, amoyProvider);

  console.log(`Relayer Wallet Address: ${relayerSepolia.address}`);
  console.log(`Sepolia Bridge: ${SEPOLIA_BRIDGE_ADDR}`);
  console.log(`Amoy Bridge:    ${AMOY_BRIDGE_ADDR}\n`);

  const sepoliaBridge = new ethers.Contract(SEPOLIA_BRIDGE_ADDR, BRIDGE_ABI, relayerSepolia);
  const amoyBridge = new ethers.Contract(AMOY_BRIDGE_ADDR, BRIDGE_ABI, relayerAmoy);

  // Verify Relayer Authorization
  try {
    const roleSep = await sepoliaBridge.RELAYER_ROLE();
    const isRelSep = await sepoliaBridge.hasRole(roleSep, relayerSepolia.address);
    console.log(`Sepolia Bridge Authorization: ${isRelSep ? '✅ AUTHORIZED' : '❌ NOT AUTHORIZED'}`);

    const roleAmoy = await amoyBridge.RELAYER_ROLE();
    const isRelAmoy = await amoyBridge.hasRole(roleAmoy, relayerAmoy.address);
    console.log(`Amoy Bridge Authorization:    ${isRelAmoy ? '✅ AUTHORIZED' : '❌ NOT AUTHORIZED'}`);

    if (!isRelSep || !isRelAmoy) {
      console.warn('⚠️ Warning: Relayer key does not hold RELAYER_ROLE on one or both bridges.');
    }
  } catch (err) {
    console.warn(`⚠️ Role check warning:`, err.message);
  }

  // ---------------------------------------------------------------------------
  // Core Event Processing Logic
  // ---------------------------------------------------------------------------
  const processLockEvent = async (eventData) => {
    const {
      tokenId, token, sender, recipient, amount, destChainId, nonce, deadline,
      transactionHash, logIndex, blockNumber, sourceChainId
    } = eventData;

    const eventKey = `${sourceChainId}-${transactionHash}-${logIndex}`;

    // PHASE 5: Idempotency Check
    if (relayerState.processedEvents[eventKey]?.status === 'CONFIRMED') {
      return;
    }
    if (inFlightEvents.has(eventKey)) {
      return;
    }

    inFlightEvents.add(eventKey);
    console.log(`\n🔔 Processing Bridge Event [${eventKey}]:`);
    console.log(`  - Source Chain: ${sourceChainId}`);
    console.log(`  - Dest Chain:   ${destChainId}`);
    console.log(`  - Token ID:     ${tokenId}`);
    console.log(`  - Sender:       ${sender}`);
    console.log(`  - Recipient:    ${recipient}`);
    console.log(`  - Amount:       ${ethers.formatUnits(amount, 6)}`);
    console.log(`  - Nonce:        ${nonce}`);
    console.log(`  - Tx Hash:      ${transactionHash}`);

    // Update state to DETECTED / PROCESSING
    relayerState.processedEvents[eventKey] = {
      sourceChainId: Number(sourceChainId),
      destChainId: Number(destChainId),
      tokenId,
      token,
      sender,
      recipient,
      amount: amount.toString(),
      nonce: nonce.toString(),
      deadline: deadline.toString(),
      sourceTxHash: transactionHash,
      status: 'PROCESSING',
      detectedAt: new Date().toISOString(),
      retryCount: (relayerState.processedEvents[eventKey]?.retryCount || 0)
    };
    saveState(relayerState);

    try {
      // Determine destination provider & bridge contract
      const isToAmoy = Number(destChainId) === AMOY_CHAIN_ID;
      const destProvider = isToAmoy ? amoyProvider : sepoliaProvider;
      const destBridge = isToAmoy ? amoyBridge : sepoliaBridge;
      const sourceProvider = isToAmoy ? sepoliaProvider : amoyProvider;
      const destChainName = isToAmoy ? 'Polygon Amoy' : 'Ethereum Sepolia';

      // PHASE 4: Validation
      // 1. Confirm source transaction is mined & succeeded
      const txReceipt = await sourceProvider.getTransactionReceipt(transactionHash);
      if (!txReceipt || txReceipt.status !== 1) {
        console.error(`  ❌ Validation failed: Source transaction reverted or invalid.`);
        relayerState.processedEvents[eventKey].status = 'FAILED_VALIDATION';
        relayerState.processedEvents[eventKey].error = 'Source tx reverted or not found';
        saveState(relayerState);
        inFlightEvents.delete(eventKey);
        return;
      }

      // 2. Check token support on destination bridge
      const KNOWN_TOKENS = {
        [SEPOLIA_CHAIN_ID]: {
          '0xe180a7c54025b5cdc639f291fceba569fa569e50b34951ff0be0e473a8edfc96': '0x451a80dE07d5ab6140A5272dC6F62742FAcC6BaB'
        },
        [AMOY_CHAIN_ID]: {
          '0xe180a7c54025b5cdc639f291fceba569fa569e50b34951ff0be0e473a8edfc96': '0xd52280A15b30e5EdfFF858E7EC22266604358F26'
        }
      };

      let destTokenAddress = await destBridge.supportedTokens(tokenId).catch(() => ethers.ZeroAddress);
      if (destTokenAddress === ethers.ZeroAddress) {
        destTokenAddress = KNOWN_TOKENS[Number(destChainId)]?.[tokenId] || ethers.ZeroAddress;
      }

      if (destTokenAddress === ethers.ZeroAddress) {
        console.error(`  ❌ Validation failed: Token ${tokenId} not supported on destination bridge.`);
        relayerState.processedEvents[eventKey].status = 'FAILED_VALIDATION';
        relayerState.processedEvents[eventKey].error = 'Token not supported on dest bridge';
        saveState(relayerState);
        inFlightEvents.delete(eventKey);
        return;
      }

      // 3. Check deadline
      const currentBlock = await sourceProvider.getBlock('latest');
      if (currentBlock.timestamp > Number(deadline)) {
        console.error(`  ❌ Validation failed: Lock deadline expired.`);
        relayerState.processedEvents[eventKey].status = 'EXPIRED';
        relayerState.processedEvents[eventKey].error = 'Deadline expired';
        saveState(relayerState);
        inFlightEvents.delete(eventKey);
        return;
      }

      // 4. Compute unique txHash for replay protection
      const abiCoder = ethers.AbiCoder.defaultAbiCoder();
      const txHash = ethers.keccak256(
        abiCoder.encode(
          ["uint256", "bytes32", "uint256", "uint256", "address", "uint256", "uint256"],
          [Number(destChainId), tokenId, amount, Number(sourceChainId), recipient, nonce, deadline]
        )
      );

      // PHASE 5: Double-spend / On-chain Replay Check
      const isAlreadyProcessedOnChain = await destBridge.processedTransactions(txHash);
      if (isAlreadyProcessedOnChain) {
        console.log(`  ℹ️ Event already executed on-chain on ${destChainName}.`);
        relayerState.processedEvents[eventKey].status = 'CONFIRMED';
        relayerState.processedEvents[eventKey].confirmedAt = new Date().toISOString();
        saveState(relayerState);
        inFlightEvents.delete(eventKey);
        return;
      }

      // PHASE 6: Generate Relayer Authorization & Signature
      const wallet = new ethers.Wallet(RELAYER_KEY);
      const signature = await wallet.signMessage(ethers.getBytes(txHash));
      console.log(`  ✍️ Relayer Signature generated: ${signature.slice(0, 18)}...`);

      // Record pre-release destination balance
      const destToken = new ethers.Contract(destTokenAddress, ERC20_ABI, destProvider);
      const balBefore = await destToken.balanceOf(recipient).catch(() => 0n);

      // Submit Destination Release Transaction
      console.log(`  🚀 Submitting release transaction to ${destChainName}...`);

      const feeData = await destProvider.getFeeData();
      const txOptions = {
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? (feeData.maxPriorityFeePerGas * 120n) / 100n : ethers.parseUnits('2', 'gwei'),
        maxFeePerGas: feeData.maxFeePerGas ? (feeData.maxFeePerGas * 120n) / 100n : ethers.parseUnits('30', 'gwei')
      };

      let txRelease;
      try {
        txRelease = await destBridge.release(
          tokenId,
          amount,
          Number(sourceChainId),
          recipient,
          nonce,
          deadline,
          signature,
          txOptions
        );
        console.log(`  Tx Broadcast Hash: ${txRelease.hash}. Waiting for block confirmation...`);
        relayerState.processedEvents[eventKey].destTxHash = txRelease.hash;
        relayerState.processedEvents[eventKey].status = 'SUBMITTED';
        saveState(relayerState);
      } catch (subErr) {
        // PHASE 7: Retries & Verification on error
        console.warn(`  ⚠️ Release submission warning/error: ${subErr.message}`);

        // Re-check if transaction actually succeeded on chain despite RPC error
        const recheckOnChain = await destBridge.processedTransactions(txHash);
        if (recheckOnChain) {
          console.log(`  ✅ Verified: Transaction was processed on-chain!`);
          relayerState.processedEvents[eventKey].status = 'CONFIRMED';
          relayerState.processedEvents[eventKey].confirmedAt = new Date().toISOString();
          saveState(relayerState);
          inFlightEvents.delete(eventKey);
          return;
        }

        // Otherwise throw for retry block
        throw subErr;
      }

      // PHASE 8: Confirm Destination Mining & Balance Change
      const receipt = await txRelease.wait(1);
      if (receipt.status === 1) {
        const balAfter = await destToken.balanceOf(recipient).catch(() => 0n);
        console.log(`  ✅ Confirmed in block ${receipt.blockNumber}!`);
        console.log(`  💰 Destination Balance Change: ${ethers.formatUnits(balBefore, 6)} → ${ethers.formatUnits(balAfter, 6)} INRX`);

        relayerState.processedEvents[eventKey].status = 'CONFIRMED';
        relayerState.processedEvents[eventKey].destBlockNumber = receipt.blockNumber;
        relayerState.processedEvents[eventKey].confirmedAt = new Date().toISOString();
        saveState(relayerState);
      } else {
        console.error(`  ❌ Destination transaction reverted on-chain.`);
        relayerState.processedEvents[eventKey].status = 'REVERTED';
        saveState(relayerState);
      }

    } catch (err) {
      console.error(`  ❌ Error processing lock event:`, err.message);
      relayerState.processedEvents[eventKey].status = 'FAILED';
      relayerState.processedEvents[eventKey].error = err.message;
      relayerState.processedEvents[eventKey].retryCount = (relayerState.processedEvents[eventKey].retryCount || 0) + 1;
      saveState(relayerState);
    } finally {
      inFlightEvents.delete(eventKey);
    }
  };

  // ---------------------------------------------------------------------------
  // PHASE 3: Automatic Event Listeners & Safe Polling Fallback
  // ---------------------------------------------------------------------------

  // Helper to extract log properties safely from Ethers v6 EventPayload or EventLog
  const extractEventData = (args, defaultSourceChainId) => {
    const lastArg = args[args.length - 1];
    const txHash = lastArg?.log?.transactionHash || lastArg?.transactionHash || lastArg?.transaction?.hash;
    const logIdx = lastArg?.log?.index ?? lastArg?.index ?? 0;
    const blkNum = lastArg?.log?.blockNumber ?? lastArg?.blockNumber ?? 0;

    return {
      tokenId: args[0],
      token: args[1],
      sender: args[2],
      recipient: args[3],
      amount: args[4],
      destChainId: args[5],
      nonce: args[6],
      deadline: args[7],
      transactionHash: txHash,
      logIndex: logIdx,
      blockNumber: blkNum,
      sourceChainId: defaultSourceChainId
    };
  };

  // Polling function for past blocks (max 10 blocks per request for Alchemy / Public nodes)
  const pollPastBlocks = async (provider, bridgeContract, sourceChainId, chainName) => {
    try {
      const latestBlock = await provider.getBlockNumber();
      let startBlock = relayerState.lastProcessedBlock[sourceChainId] || (latestBlock - 10);
      if (startBlock <= 0) startBlock = latestBlock - 10;

      if (latestBlock < startBlock) return;

      // Scan up to 10 blocks at a time to satisfy RPC rate limits
      const toBlock = Math.min(latestBlock, startBlock + 9);

      const filter = bridgeContract.filters.TokensLocked();
      const events = await bridgeContract.queryFilter(filter, startBlock, toBlock);

      for (const event of events) {
        const args = event.args;
        if (!args) continue;
        await processLockEvent({
          tokenId: args.tokenId,
          token: args.token,
          sender: args.sender,
          recipient: args.recipient,
          amount: args.amount,
          destChainId: args.destChainId,
          nonce: args.nonce,
          deadline: args.deadline,
          transactionHash: event.transactionHash,
          logIndex: event.index,
          blockNumber: event.blockNumber,
          sourceChainId
        });
      }

      relayerState.lastProcessedBlock[sourceChainId] = toBlock + 1;
      saveState(relayerState);
    } catch (pollErr) {
      console.warn(`⚠️ Polling warning on ${chainName}:`, pollErr.message);
    }
  };

  // Real-time Event Subscription Listeners
  sepoliaBridge.on('TokensLocked', (...args) => {
    const eventData = extractEventData(args, SEPOLIA_CHAIN_ID);
    if (eventData.transactionHash) {
      processLockEvent(eventData);
    }
  });

  amoyBridge.on('TokensLocked', (...args) => {
    const eventData = extractEventData(args, AMOY_CHAIN_ID);
    if (eventData.transactionHash) {
      processLockEvent(eventData);
    }
  });

  console.log('✅ Real-time event listeners attached to Sepolia and Amoy Bridges.');

  // Initial Sync & Polling Loop
  await pollPastBlocks(sepoliaProvider, sepoliaBridge, SEPOLIA_CHAIN_ID, 'Ethereum Sepolia');
  await pollPastBlocks(amoyProvider, amoyBridge, AMOY_CHAIN_ID, 'Polygon Amoy');

  setInterval(async () => {
    await pollPastBlocks(sepoliaProvider, sepoliaBridge, SEPOLIA_CHAIN_ID, 'Ethereum Sepolia');
    await pollPastBlocks(amoyProvider, amoyBridge, AMOY_CHAIN_ID, 'Polygon Amoy');
  }, 10000); // Poll every 10 seconds

  console.log('🔄 Relayer daemon active & polling every 10s. Press Ctrl+C to terminate.');
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

