const { ethers } = require('ethers');

const SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
const AMOY_RPC = 'https://polygon-amoy.drpc.org';

const SEPOLIA_BRIDGE = '0xA7283676630FbcA55f3f0743755A0815CcF78103';
const AMOY_BRIDGE = '0xC18ff9369B9aa703716c975C1aB0fF8fd1Ef50c1';

const BRIDGE_ABI = [
  'function supportedTokens(bytes32 tokenId) view returns (address)'
];

async function main() {
  const fetchOpts = { fetchOptions: { family: 4 } };
  const sepoliaProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC, 11155111, fetchOpts);
  const amoyProvider = new ethers.JsonRpcProvider(AMOY_RPC, 80002, fetchOpts);

  const tokenId = ethers.keccak256(ethers.toUtf8Bytes('INRX'));
  console.log(`Token ID for INRX: ${tokenId}`);

  const sepBridge = new ethers.Contract(SEPOLIA_BRIDGE, BRIDGE_ABI, sepoliaProvider);
  const sepToken = await sepBridge.supportedTokens(tokenId).catch(e => `Reverted: ${e.message}`);
  console.log(`Sepolia Bridge supported token for INRX: ${sepToken}`);

  const amoyBridge = new ethers.Contract(AMOY_BRIDGE, BRIDGE_ABI, amoyProvider);
  const amoyToken = await amoyBridge.supportedTokens(tokenId).catch(e => `Reverted: ${e.message}`);
  console.log(`Amoy Bridge supported token for INRX:    ${amoyToken}`);
}

main().catch(console.error);
