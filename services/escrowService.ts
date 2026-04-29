/**
 * escrowService.ts
 * On-chain P2P escrow — supports ETH + ERC20 on Sepolia, Ethereum, Polygon, Arbitrum
 *
 * Deploy the contract once per network using the deploy script below,
 * then paste the deployed addresses into ESCROW_CONTRACTS.
 *
 * HOW TO DEPLOY (run once per network):
 *   npx hardhat run scripts/deployEscrow.ts --network sepolia
 *   npx hardhat run scripts/deployEscrow.ts --network ethereum
 *   npx hardhat run scripts/deployEscrow.ts --network polygon
 *   npx hardhat run scripts/deployEscrow.ts --network arbitrum
 */

import { ethers } from 'ethers';
import { getProvider } from './ethereumService';

// ─── Paste deployed contract addresses here after deploying ──────────────────
export const ESCROW_CONTRACTS: Record<string, string> = {
  Sepolia:  '',   // paste Sepolia address here
  Ethereum: '',   // paste Ethereum mainnet address here
  Polygon:  '',   // ← PASTE YOUR POLYGON ADDRESS HERE after deploying
  Arbitrum: '',   // paste Arbitrum address here
};

// ─── Token contract addresses per network ────────────────────────────────────
const TOKEN_ADDRESSES: Record<string, Record<string, string>> = {
  USDC: {
    Sepolia:  '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    Ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    Polygon:  '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    Arbitrum: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  },
  USDT: {
    Sepolia:  '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
    Ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    Polygon:  '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    Arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  },
  DAI: {
    Sepolia:  '0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6',
    Ethereum: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    Polygon:  '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    Arbitrum: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
  },
};

// ─── ABI (only the functions we call) ────────────────────────────────────────
const ESCROW_ABI = [
  'function depositETH(bytes32 orderId) payable',
  'function depositToken(bytes32 orderId, address token, uint256 amount)',
  'function lockBuyer(bytes32 orderId)',
  'function markFiatSent(bytes32 orderId)',
  'function release(bytes32 orderId)',
  'function cancel(bytes32 orderId)',
  'function raiseDispute(bytes32 orderId)',
  'function getEscrow(bytes32 orderId) view returns (tuple(address seller, address buyer, address token, uint256 amount, uint8 status))',
  'event Deposited(bytes32 indexed orderId, address seller, address token, uint256 amount)',
  'event Released(bytes32 indexed orderId, address buyer, uint256 amount)',
  'event Cancelled(bytes32 indexed orderId)',
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a Supabase UUID string → bytes32 for the contract */
export function orderIdToBytes32(orderId: string): string {
  // Remove dashes, pad/truncate to 32 bytes
  const hex = orderId.replace(/-/g, '');
  return '0x' + hex.padEnd(64, '0').slice(0, 64);
}

function getContract(network: string, signerOrProvider: ethers.Signer | ethers.Provider) {
  const address = ESCROW_CONTRACTS[network];
  if (!address) throw new Error(`Escrow contract not deployed on ${network} yet. Add address to ESCROW_CONTRACTS in escrowService.ts`);
  return new ethers.Contract(address, ESCROW_ABI, signerOrProvider);
}

function getTokenAddress(token: string, network: string): string {
  const addr = TOKEN_ADDRESSES[token]?.[network];
  if (!addr) throw new Error(`Token ${token} not supported on ${network}`);
  return addr;
}

function getTokenDecimals(token: string): number {
  if (token === 'USDC' || token === 'USDT') return 6;
  if (token === 'DAI')  return 18;
  return 18;
}

// ─── Main escrow service ──────────────────────────────────────────────────────

export const escrowService = {

  /**
   * Seller deposits crypto into escrow when creating a P2P order.
   * Called automatically when seller creates an order.
   */
  async deposit(params: {
    orderId:    string;
    token:      string;   // 'ETH' | 'USDC' | 'USDT' | 'DAI'
    amount:     number;
    privateKey: string;
    network:    string;
  }): Promise<{ txHash: string }> {
    const { orderId, token, amount, privateKey, network } = params;

    const provider  = getProvider(network);
    const wallet    = new ethers.Wallet(privateKey, provider);
    const contract  = getContract(network, wallet);
    const orderKey  = orderIdToBytes32(orderId);

    let tx: ethers.TransactionResponse;

    if (token === 'ETH') {
      const value = ethers.parseEther(amount.toString());
      tx = await contract.depositETH(orderKey, { value });
    } else {
      const tokenAddr = getTokenAddress(token, network);
      const decimals  = getTokenDecimals(token);
      const rawAmount = ethers.parseUnits(amount.toString(), decimals);

      // Approve escrow contract to spend tokens first
      const tokenContract = new ethers.Contract(tokenAddr, ERC20_ABI, wallet);
      const allowance: bigint = await tokenContract.allowance(wallet.address, ESCROW_CONTRACTS[network]);
      if (allowance < rawAmount) {
        const approveTx = await tokenContract.approve(ESCROW_CONTRACTS[network], rawAmount);
        await approveTx.wait(1);
      }

      tx = await contract.depositToken(orderKey, tokenAddr, rawAmount);
    }

    await tx.wait(1);
    return { txHash: tx.hash };
  },

  /**
   * Buyer locks themselves into the escrow when clicking "Buy Now".
   */
  async lockBuyer(params: {
    orderId:    string;
    privateKey: string;
    network:    string;
  }): Promise<{ txHash: string }> {
    const { orderId, privateKey, network } = params;
    const provider = getProvider(network);
    const wallet   = new ethers.Wallet(privateKey, provider);
    const contract = getContract(network, wallet);

    const tx = await contract.lockBuyer(orderIdToBytes32(orderId));
    await tx.wait(1);
    return { txHash: tx.hash };
  },

  /**
   * Buyer marks fiat as sent after paying off-chain.
   */
  async markFiatSent(params: {
    orderId:    string;
    privateKey: string;
    network:    string;
  }): Promise<{ txHash: string }> {
    const { orderId, privateKey, network } = params;
    const provider = getProvider(network);
    const wallet   = new ethers.Wallet(privateKey, provider);
    const contract = getContract(network, wallet);

    const tx = await contract.markFiatSent(orderIdToBytes32(orderId));
    await tx.wait(1);
    return { txHash: tx.hash };
  },

  /**
   * Seller releases funds to buyer after confirming fiat received.
   * This is the actual on-chain transfer to the buyer.
   */
  async release(params: {
    orderId:    string;
    privateKey: string;
    network:    string;
  }): Promise<{ txHash: string }> {
    const { orderId, privateKey, network } = params;
    const provider = getProvider(network);
    const wallet   = new ethers.Wallet(privateKey, provider);
    const contract = getContract(network, wallet);

    const tx = await contract.release(orderIdToBytes32(orderId));
    await tx.wait(1);
    return { txHash: tx.hash };
  },

  /**
   * Seller cancels order and gets funds back (only before buyer locks).
   */
  async cancel(params: {
    orderId:    string;
    privateKey: string;
    network:    string;
  }): Promise<{ txHash: string }> {
    const { orderId, privateKey, network } = params;
    const provider = getProvider(network);
    const wallet   = new ethers.Wallet(privateKey, provider);
    const contract = getContract(network, wallet);

    const tx = await contract.cancel(orderIdToBytes32(orderId));
    await tx.wait(1);
    return { txHash: tx.hash };
  },

  /**
   * Either party raises a dispute — admin resolves off-chain.
   */
  async raiseDispute(params: {
    orderId:    string;
    privateKey: string;
    network:    string;
  }): Promise<{ txHash: string }> {
    const { orderId, privateKey, network } = params;
    const provider = getProvider(network);
    const wallet   = new ethers.Wallet(privateKey, provider);
    const contract = getContract(network, wallet);

    const tx = await contract.raiseDispute(orderIdToBytes32(orderId));
    await tx.wait(1);
    return { txHash: tx.hash };
  },

  /**
   * Read escrow state from chain (for verification).
   */
  async getEscrowState(orderId: string, network: string) {
    const provider = getProvider(network);
    const contract = getContract(network, provider);
    const state    = await contract.getEscrow(orderIdToBytes32(orderId));
    const statusMap = ['Open', 'Locked', 'FiatSent', 'Completed', 'Cancelled', 'Disputed'];
    return {
      seller: state.seller,
      buyer:  state.buyer,
      token:  state.token,
      amount: state.amount.toString(),
      status: statusMap[Number(state.status)] ?? 'Unknown',
    };
  },

  /** Check if escrow contract is deployed on this network */
  isDeployed(network: string): boolean {
    return !!ESCROW_CONTRACTS[network];
  },

  /** Get block explorer tx URL for a given network */
  getTxUrl(txHash: string, network: string): string {
    const explorers: Record<string, string> = {
      Sepolia:  `https://sepolia.etherscan.io/tx/${txHash}`,
      Ethereum: `https://etherscan.io/tx/${txHash}`,
      Polygon:  `https://polygonscan.com/tx/${txHash}`,
      Arbitrum: `https://arbiscan.io/tx/${txHash}`,
    };
    return explorers[network] ?? `https://etherscan.io/tx/${txHash}`;
  },
};
