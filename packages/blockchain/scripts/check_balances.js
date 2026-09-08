const { ethers } = require('ethers');

const SEPOLIA_RPC = 'https://eth-sepolia.g.alchemy.com/v2/alch_qFLArkppX6O94tKMhIIUO';
const AMOY_RPC = 'https://polygon-amoy.drpc.org';

const WALLET_A = '0x7D828173126408B4Fbdd3CEf614698d452BE5a3e';
const WALLET_B = '0x351028a22c876e0431b30921c0dd0a836a14899e';

const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];

const SEPOLIA_INRX = '0x451a80dE07d5ab6140A5272dC6F62742FAcC6BaB';
const AMOY_INRX = '0xd52280A15b30e5EdfFF858E7EC22266604358F26';

async function main() {
  const sepoliaProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const amoyProvider = new ethers.JsonRpcProvider(AMOY_RPC);

  console.log('--- SEPOLIA BALANCES ---');
  const sepEthA = await sepoliaProvider.getBalance(WALLET_A);
  const sepEthB = await sepoliaProvider.getBalance(WALLET_B);
  const sepInrxA = await new ethers.Contract(SEPOLIA_INRX, ERC20_ABI, sepoliaProvider).balanceOf(WALLET_A);
  const sepInrxB = await new ethers.Contract(SEPOLIA_INRX, ERC20_ABI, sepoliaProvider).balanceOf(WALLET_B);

  console.log(`Wallet A (Relayer): ${ethers.formatEther(sepEthA)} ETH | ${ethers.formatUnits(sepInrxA, 6)} INRX`);
  console.log(`Wallet B:          ${ethers.formatEther(sepEthB)} ETH | ${ethers.formatUnits(sepInrxB, 6)} INRX`);

  console.log('\n--- AMOY BALANCES ---');
  const amoyPolA = await amoyProvider.getBalance(WALLET_A);
  const amoyPolB = await amoyProvider.getBalance(WALLET_B);
  const amoyInrxA = await new ethers.Contract(AMOY_INRX, ERC20_ABI, amoyProvider).balanceOf(WALLET_A);
  const amoyInrxB = await new ethers.Contract(AMOY_INRX, ERC20_ABI, amoyProvider).balanceOf(WALLET_B);

  console.log(`Wallet A (Relayer): ${ethers.formatEther(amoyPolA)} POL | ${ethers.formatUnits(amoyInrxA, 6)} INRX`);
  console.log(`Wallet B:          ${ethers.formatEther(amoyPolB)} POL | ${ethers.formatUnits(amoyInrxB, 6)} INRX`);
}

main().catch(console.error);
