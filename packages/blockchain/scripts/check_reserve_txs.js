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
    
    await provider.call({
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
    return err.message || err;
  }
}

async function main() {
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const reserveAddress = '0x463A8dB7CE733d0DF5F05Bb2Fe58c845a08f5b33';
  
  console.log(`Scanning recent blocks on Sepolia for transactions to ReserveConversion (${reserveAddress}) concurrently...`);
  
  const latestBlock = await provider.getBlockNumber();
  console.log(`Latest block: ${latestBlock}`);
  
  const startBlock = latestBlock - 200;
  const blockNumbers = [];
  for (let i = latestBlock; i >= startBlock; i--) {
    blockNumbers.push(i);
  }
  
  const chunkSize = 40;
  for (let c = 0; c < blockNumbers.length; c += chunkSize) {
    const chunk = blockNumbers.slice(c, c + chunkSize);
    console.log(`Checking blocks ${chunk[0]} down to ${chunk[chunk.length - 1]}...`);
    
    const blocks = await Promise.all(
      chunk.map(num => provider.getBlock(num, true).catch(() => null))
    );
    
    for (const block of blocks) {
      if (!block || !block.transactions) continue;
      
      for (const tx of block.transactions) {
        if (tx && tx.to && tx.to.toLowerCase() === reserveAddress.toLowerCase()) {
          console.log(`\nFound transaction: ${tx.hash}`);
          console.log(`  Block: ${tx.blockNumber}`);
          console.log(`  From: ${tx.from}`);
          console.log(`  Value: ${ethers.formatEther(tx.value)} ETH`);
          
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
  }
  
  console.log('\nScan complete.');
}

main().catch(err => {
  console.error(err);
});
