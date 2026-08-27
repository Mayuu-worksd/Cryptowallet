const hre = require("hardhat");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("❌ PRIVATE_KEY not found in root .env");
  }

  const provider = new hre.ethers.JsonRpcProvider(process.env.SEPOLIA_RPC || "https://ethereum-sepolia-rpc.publicnode.com");
  const wallet = new hre.ethers.Wallet(privateKey, provider);
  
  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer Wallet: ${wallet.address}`);
  console.log(`ETH Balance: ${hre.ethers.formatEther(balance)} ETH`);

  console.log("Deploying MockUSDC to Sepolia...");
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC", wallet);
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const address = await usdc.getAddress();
  console.log(`✅ MockUSDC deployed successfully to: ${address}`);
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
