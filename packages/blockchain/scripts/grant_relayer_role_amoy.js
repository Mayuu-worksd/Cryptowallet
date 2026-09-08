const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const ethersPath = path.resolve(__dirname, '../../../apps/admin-dashboard/node_modules/ethers');
const { ethers } = require(ethersPath);

const AMOY_RPCS = [
  'https://polygon-amoy.drpc.org',
  'https://polygon-amoy-bor-rpc.publicnode.com',
  'https://polygon-amoy.g.alchemy.com/v2/alch_qFLArkppX6O94tKMhIIUO'
];

const AMOY_BRIDGE_ADDR = '0xC18ff9369B9aa703716c975C1aB0fF8fd1Ef50c1';
const RELAYER_ADDR = '0x7D828173126408B4Fbdd3CEf614698d452BE5a3e';

const BRIDGE_ABI = [
  'function RELAYER_ROLE() view returns (bytes32)',
  'function DEFAULT_ADMIN_ROLE() view returns (bytes32)',
  'function grantRole(bytes32 role, address account) external',
  'function hasRole(bytes32 role, address account) view returns (bool)'
];

async function main() {
  let provider;
  for (const rpc of AMOY_RPCS) {
    try {
      console.log(`Connecting to RPC: ${rpc}...`);
      const p = new ethers.JsonRpcProvider(rpc, 80002, { staticNetwork: ethers.Network.from(80002), fetchOptions: { family: 4 } });
      await p.getBlockNumber();
      provider = p;
      console.log(`✅ Connected to ${rpc}`);
      break;
    } catch (e) {
      console.warn(`  ⚠️ Failed ${rpc}: ${e.message}`);
    }
  }

  if (!provider) throw new Error('Could not connect to any Amoy RPC');

  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`Executing with wallet: ${wallet.address}`);

  const bridge = new ethers.Contract(AMOY_BRIDGE_ADDR, BRIDGE_ABI, wallet);

  // Helper retry wrapper
  const callWithRetry = async (fn, maxAttempts = 5) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (attempt === maxAttempts) throw err;
        console.warn(`  Attempt ${attempt} failed: ${err.message}. Retrying...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  };

  const relayerRole = await callWithRetry(() => bridge.RELAYER_ROLE());
  const isRelayer = await callWithRetry(() => bridge.hasRole(relayerRole, RELAYER_ADDR));
  console.log(`Is wallet already relayer on Amoy Bridge? ${isRelayer}`);

  if (!isRelayer) {
    console.log(`Granting RELAYER_ROLE on Amoy Bridge...`);
    const feeData = await callWithRetry(() => provider.getFeeData());
    const txOptions = {
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? (feeData.maxPriorityFeePerGas * 150n) / 100n : ethers.parseUnits('3', 'gwei'),
      maxFeePerGas: feeData.maxFeePerGas ? (feeData.maxFeePerGas * 150n) / 100n : ethers.parseUnits('30', 'gwei')
    };

    const tx = await callWithRetry(() => bridge.grantRole(relayerRole, RELAYER_ADDR, txOptions));
    console.log(`Tx submitted: ${tx.hash}. Waiting for confirmation...`);
    await tx.wait(1);
    console.log(`✅ RELAYER_ROLE granted successfully on Polygon Amoy Bridge!`);
  } else {
    console.log(`✅ RELAYER_ROLE is already granted on Polygon Amoy Bridge.`);
  }
}

main().catch(console.error);
