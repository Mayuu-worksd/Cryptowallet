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

async function getRevertReason(txHash, provider) {
  try {
    const tx = await provider.getTransaction(txHash);
    if (!tx) return 'Transaction not found';
    
    const code = await provider.call({
      to: tx.to,
      from: tx.from,
      data: tx.data,
      value: tx.value,
      gasLimit: tx.gasLimit,
      gasPrice: tx.gasPrice,
      blockTag: tx.blockNumber
    });
    return 'Call succeeded without reverting?';
  } catch (err) {
    // Ethers usually parses the revert reason in the error message
    return err.message || err;
  }
}

async function main() {
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const userAddress = '0x351028a22c876e0431b30921c0dd0a836a14899e';
  
  console.log(`Scanning recent blocks on Sepolia for user: ${userAddress}...`);
  
  const latestBlock = await provider.getBlockNumber();
  console.log(`Latest block: ${latestBlock}`);
  
  // Scan the last 150 blocks (approx. 30 minutes)
  const startBlock = latestBlock - 150;
  
  for (let i = latestBlock; i >= startBlock; i--) {
    const block = await provider.getBlock(i, true);
    if (!block || !block.transactions) continue;
    
    for (const tx of block.transactions) {
      if (tx.from && tx.from.toLowerCase() === userAddress.toLowerCase()) {
        console.log(`\nFound transaction: ${tx.hash}`);
        console.log(`  Block: ${tx.blockNumber}`);
        console.log(`  To: ${tx.to}`);
        console.log(`  Value: ${ethers.formatEther(tx.value)} ETH`);
        console.log(`  Input length: ${tx.data.length} chars`);
        
        const receipt = await provider.getTransactionReceipt(tx.hash);
        if (receipt) {
          console.log(`  Status: ${receipt.status === 1 ? 'SUCCESS (1)' : 'FAILED (0)'}`);
          console.log(`  Gas Used: ${receipt.gasUsed.toString()}`);
          
          if (receipt.status === 0) {
            console.log('  Retrieving revert reason...');
            const reason = await getRevertReason(tx.hash, provider);
            console.log(`  Revert Reason: ${reason}`);
          }
        } else {
          console.log('  Receipt not available (pending?)');
        }
      }
    }
  }
  
  console.log('\nScan complete.');
}

main().catch(err => {
  console.error(err);
});
