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

const ALCHEMY_KEY = process.env.EXPO_PUBLIC_ALCHEMY_KEY || 'alch_qFLArkppX6O94tKMhIIUO';
const SEPOLIA_RPC = `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`;

async function main() {
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const wallets = [
    '0x351028a22c876e0431b30921c0dd0a836a14899e',
    '0xbf0603ade100dea85e6de47f8c46c8ce55bb4d01',
    '0x7D828173126408B4Fbdd3CEf614698d452BE5a3e'
  ];

  console.log(`Checking Sepolia for recent transactions...`);
  const latestBlock = await provider.getBlockNumber();
  console.log(`Latest block: ${latestBlock}`);
  
  const startBlock = latestBlock - 50;
  
  for (let i = latestBlock; i >= startBlock; i--) {
    const block = await provider.getBlock(i, true).catch(() => null);
    if (!block || !block.transactions) continue;
    
    for (const tx of block.transactions) {
      if (tx && tx.from && wallets.includes(ethers.getAddress(tx.from.toLowerCase()))) {
        console.log(`\nFound On-Chain Tx in block ${tx.blockNumber}: ${tx.hash}`);
        console.log(`  From: ${tx.from}`);
        console.log(`  To:   ${tx.to}`);
        console.log(`  Value: ${ethers.formatEther(tx.value)} ETH`);
        
        const receipt = await provider.getTransactionReceipt(tx.hash);
        console.log(`  Status: ${receipt.status === 1 ? 'SUCCESS (1)' : 'FAILED (0)'}`);
        console.log(`  Gas Used: ${receipt.gasUsed.toString()}`);
      }
    }
  }

  console.log(`\nChecking Supabase transactions table for recent entries...`);
  const headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bWFjcGhnYnBlZGF6ZHZnZG56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMDIyNjAsImV4cCI6MjA5MjY3ODI2MH0.CPQgakkjwT6N7DX1B56yPEVjGe9H9jjMCWCBCC0qM1M",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4bWFjcGhnYnBlZGF6ZHZnZG56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMDIyNjAsImV4cCI6MjA5MjY3ODI2MH0.CPQgakkjwT6N7DX1B56yPEVjGe9H9jjMCWCBCC0qM1M"
  };

  const response = await fetch("https://hxmacphgbpedazdvgdnz.supabase.co/rest/v1/transactions?order=created_at.desc&limit=5", { headers });
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch(err => {
  console.error(err);
});
