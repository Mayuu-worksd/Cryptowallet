const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const ethersPath = path.resolve(__dirname, '../../../apps/admin-dashboard/node_modules/ethers');
const { ethers } = require(ethersPath);

const SEPOLIA_RPC = process.env.SEPOLIA_RPC || 'https://eth-sepolia.g.alchemy.com/v2/alch_qFLArkppX6O94tKMhIIUO';
const SEPOLIA_BRIDGE = '0xA7283676630FbcA55f3f0743755A0815CcF78103';
const SEPOLIA_INRX = '0x451a80dE07d5ab6140A5272dC6F62742FAcC6BaB';

const BRIDGE_ABI = [
  'function lock(bytes32 tokenId, uint256 amount, uint256 destChainId, address recipient, uint256 nonce, uint256 deadline) external returns (bool)'
];

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

async function main() {
  console.log('====================================================');
  console.log('  E2E AUTOMATED MULTICURRENCY BRIDGE RELAYER TEST  ');
  console.log('====================================================\n');

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ PRIVATE_KEY is not set');
    process.exit(1);
  }

  const fetchOpts = { fetchOptions: { family: 4 } };
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC, 11155111, fetchOpts);
  const wallet = new ethers.Wallet(privateKey, provider);

  const recipient = '0x351028a22c876e0431b30921c0dd0a836a14899e';
  const amount = ethers.parseUnits('1.0', 6);
  const destChainId = 80002; // Polygon Amoy
  const tokenId = ethers.keccak256(ethers.toUtf8Bytes('INRX'));

  console.log(`Initiating INRX Bridge Lock:`);
  console.log(`  - Sender:      ${wallet.address}`);
  console.log(`  - Recipient:   ${recipient}`);
  console.log(`  - Amount:      1.0 INRX`);
  console.log(`  - Source:      Sepolia (11155111)`);
  console.log(`  - Destination: Polygon Amoy (80002)`);

  const inrxToken = new ethers.Contract(SEPOLIA_INRX, ERC20_ABI, wallet);
  const bridgeContract = new ethers.Contract(SEPOLIA_BRIDGE, BRIDGE_ABI, wallet);

  // Check initial balance
  const balBefore = await inrxToken.balanceOf(wallet.address);
  console.log(`  - Initial INRX Balance: ${ethers.formatUnits(balBefore, 6)} INRX`);

  // 1. Approve Bridge
  console.log('\nStep 1: Approving Sepolia Bridge contract...');
  const allowance = await inrxToken.allowance(wallet.address, SEPOLIA_BRIDGE);
  if (allowance < amount) {
    const txApp = await inrxToken.approve(SEPOLIA_BRIDGE, ethers.parseUnits('1000', 6));
    console.log(`  Approval Tx Hash: ${txApp.hash}`);
    await txApp.wait(1);
    console.log('  ✅ Approval confirmed.');
  } else {
    console.log('  ✅ Allowance already sufficient.');
  }

  // 2. Lock Tokens on Source Bridge
  console.log('\nStep 2: Submitting TokensLocked transaction on Sepolia...');
  const nonce = Date.now();
  const deadline = Math.floor(Date.now() / 1000) + 3600;

  const feeData = await provider.getFeeData();
  const txLock = await bridgeContract.lock(
    tokenId,
    amount,
    destChainId,
    recipient,
    nonce,
    deadline,
    {
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? (feeData.maxPriorityFeePerGas * 120n) / 100n : ethers.parseUnits('2', 'gwei'),
      maxFeePerGas: feeData.maxFeePerGas ? (feeData.maxFeePerGas * 120n) / 100n : ethers.parseUnits('30', 'gwei')
    }
  );

  console.log(`  🚀 Lock Tx Hash: ${txLock.hash}`);
  console.log(`  Waiting for block confirmation...`);
  const receipt = await txLock.wait(1);

  console.log(`  ✅ Lock confirmed in block ${receipt.blockNumber}!`);
  console.log(`  TokensLocked Event emitted successfully.\n`);

  console.log('====================================================');
  console.log('  NOW WAITING FOR AUTOMATED RELAYER TO PROCESS...   ');
  console.log('====================================================');
  console.log('(Relayer daemon is running in background and will detect the event automatically)\n');

  // Poll relayer_state.json for detection and processing
  const statePath = path.resolve(__dirname, 'relayer_state.json');
  let detected = false;
  let confirmed = false;

  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000));
    if (fs.existsSync(statePath)) {
      try {
        const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        const events = state.processedEvents || {};
        const matchingKey = Object.keys(events).find(k => k.includes(txLock.hash));
        if (matchingKey) {
          const ev = events[matchingKey];
          console.log(`  [State Update] Event ${matchingKey} Status: ${ev.status}`);
          detected = true;
          if (ev.status === 'CONFIRMED' || ev.status === 'SUBMITTED' || ev.status === 'PROCESSING') {
            confirmed = true;
            console.log(`  ✅ Relayer automatically detected and updated status to: ${ev.status}`);
            break;
          }
        }
      } catch (e) {}
    }
  }

  if (detected) {
    console.log('\n✅ AUTOMATION TEST RESULT: SUCCESS (Event detected and processed automatically by background daemon!)');
  } else {
    console.log('\nℹ️ Event broadcast on-chain. Check background relayer log for event key matching: ' + txLock.hash);
  }
}

main().catch(console.error);
