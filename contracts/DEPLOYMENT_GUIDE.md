# P2P Escrow Contract Deployment Guide

## Overview
The `P2PEscrow.sol` contract needs to be deployed once per network (Sepolia, Ethereum, Polygon, Arbitrum).

After deploying, paste the contract addresses into `escrowService.ts` → `ESCROW_CONTRACTS`.

---

## Option 1: Deploy using Remix (Easiest — No CLI needed)

### Step 1: Open Remix
Go to https://remix.ethereum.org

### Step 2: Create the contract
1. In the File Explorer, create a new file: `P2PEscrow.sol`
2. Copy the entire contents of `contracts/P2PEscrow.sol` and paste it into Remix

### Step 3: Compile
1. Click the "Solidity Compiler" tab (left sidebar)
2. Select compiler version `0.8.20` or higher
3. Click "Compile P2PEscrow.sol"

### Step 4: Deploy to Sepolia (Testnet)
1. Click "Deploy & Run Transactions" tab
2. Set **Environment** to "Injected Provider - MetaMask"
3. Make sure MetaMask is connected to **Sepolia Testnet**
4. Make sure you have Sepolia ETH (get from https://sepoliafaucet.com)
5. Click **Deploy**
6. Confirm the transaction in MetaMask
7. **Copy the deployed contract address** (e.g. `0xAbC123...`)

### Step 5: Deploy to Mainnet Networks
Repeat Step 4 for:
- **Ethereum Mainnet** (expensive gas ~$50-100)
- **Polygon** (cheap gas ~$0.01) ✅ Recommended
- **Arbitrum** (cheap gas ~$0.50) ✅ Recommended

### Step 6: Update `escrowService.ts`
Open `services/escrowService.ts` and paste your deployed addresses:

```typescript
export const ESCROW_CONTRACTS: Record<string, string> = {
  Sepolia:  '0xYourSepoliaAddress',
  Ethereum: '0xYourEthereumAddress',
  Polygon:  '0xYourPolygonAddress',
  Arbitrum: '0xYourArbitrumAddress',
};
```

---

## Option 2: Deploy using Hardhat (Advanced)

### Prerequisites
```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npx hardhat init
```

### Create deployment script
Create `scripts/deployEscrow.ts`:

```typescript
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying P2PEscrow with account:", deployer.address);

  const P2PEscrow = await ethers.getContractFactory("P2PEscrow");
  const escrow = await P2PEscrow.deploy();
  await escrow.waitForDeployment();

  const address = await escrow.getAddress();
  console.log("P2PEscrow deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

### Configure networks in `hardhat.config.ts`:

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";
const ALCHEMY_KEY = process.env.ALCHEMY_KEY || "";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
      accounts: [PRIVATE_KEY],
    },
    ethereum: {
      url: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
      accounts: [PRIVATE_KEY],
    },
    polygon: {
      url: `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
      accounts: [PRIVATE_KEY],
    },
    arbitrum: {
      url: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
      accounts: [PRIVATE_KEY],
    },
  },
};

export default config;
```

### Deploy:
```bash
# Sepolia
npx hardhat run scripts/deployEscrow.ts --network sepolia

# Polygon (recommended for real users)
npx hardhat run scripts/deployEscrow.ts --network polygon

# Arbitrum
npx hardhat run scripts/deployEscrow.ts --network arbitrum

# Ethereum (expensive)
npx hardhat run scripts/deployEscrow.ts --network ethereum
```

---

## Verify Contract on Etherscan (Optional but Recommended)

After deploying, verify the contract so users can see the source code:

### Remix:
1. Go to the "Plugin Manager" tab
2. Activate "Etherscan - Contract Verification"
3. Enter your contract address + Etherscan API key
4. Click "Verify"

### Hardhat:
```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

---

## Testing the Contract

After deploying to Sepolia, test it:

1. Create a P2P sell order in the app
2. Check Sepolia Etherscan for the deposit transaction
3. Have another wallet buy the order
4. Complete the flow and verify the release transaction

---

## Gas Costs (Estimates)

| Network  | Deploy Cost | Deposit | Release | Total per Trade |
|----------|-------------|---------|---------|-----------------|
| Sepolia  | Free (test) | Free    | Free    | Free            |
| Ethereum | ~$100       | ~$15    | ~$10    | ~$25            |
| Polygon  | ~$0.01      | ~$0.005 | ~$0.005 | ~$0.01          |
| Arbitrum | ~$0.50      | ~$0.10  | ~$0.10  | ~$0.20          |

**Recommendation:** Deploy on **Polygon** for real users (cheapest gas).

---

## Security Notes

- The contract admin (deployer) can resolve disputes
- Keep your deployer private key safe
- Consider using a multisig wallet as admin for production
- Audit the contract before deploying to mainnet with real funds

---

## Next Steps

1. Deploy to Sepolia first and test thoroughly
2. Deploy to Polygon for real users
3. Update `escrowService.ts` with contract addresses
4. Run the updated schema SQL in Supabase to add the new columns
5. Test creating/buying/releasing orders in the app

Done! 🔥
