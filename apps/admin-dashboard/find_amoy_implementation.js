const { ethers } = require('ethers');

// Amoy RPC
const AMOY_RPC = 'https://polygon-amoy-bor-rpc.publicnode.com';
const AMOY_TOKEN = '0xd52280A15b30e5EdfFF858E7EC22266604358F26';
const IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

async function main() {
  const provider = new ethers.JsonRpcProvider(AMOY_RPC);
  console.log(`Querying storage slot on Amoy token proxy...`);
  try {
    const val = await provider.getStorage(AMOY_TOKEN, IMPLEMENTATION_SLOT);
    console.log(`Storage value: ${val}`);
    const implAddr = ethers.getAddress('0x' + val.slice(-40));
    console.log(`Implementation Address: ${implAddr}`);
  } catch (e) {
    console.error('Failed querying storage:', e);
  }
}

main().catch(console.error);
