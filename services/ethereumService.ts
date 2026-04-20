import { ethers } from 'ethers';
import { NETWORKS } from '../constants';

// Minimal ERC-20 ABI — only balanceOf needed
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

// USDT contract addresses per network
const USDT_CONTRACTS: Record<string, string> = {
  Ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  Polygon:  '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  Arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  // Sepolia has no real USDT — returns 0, handled gracefully
};

const NETWORK_CONFIG: Record<string, { chainId: number; name: string }> = {
  Sepolia:  { chainId: 11155111, name: 'sepolia'   },
  Ethereum: { chainId: 1,        name: 'homestead' },
  Polygon:  { chainId: 137,      name: 'matic'     },
  Arbitrum: { chainId: 42161,    name: 'arbitrum'  },
};

let provider: ethers.providers.JsonRpcProvider | null = null;
let currentNetwork = 'Sepolia';

function getProvider(network: string = currentNetwork): ethers.providers.JsonRpcProvider {
  if (!provider || network !== currentNetwork) {
    const rpcUrl    = NETWORKS[network]    ?? NETWORKS['Sepolia'];
    const netConfig = NETWORK_CONFIG[network] ?? NETWORK_CONFIG['Sepolia'];
    provider = new ethers.providers.JsonRpcProvider(rpcUrl, {
      chainId: netConfig.chainId,
      name:    netConfig.name,
    });
    currentNetwork = network;
  }
  return provider;
}

export const ethereumService = {
  switchNetwork(network: string): void {
    provider = null;
    currentNetwork = network;
  },

  async getTokenBalance(
    address: string,
    tokenSymbol: 'USDT',
    network: string = currentNetwork
  ): Promise<number> {
    const contractAddress = USDT_CONTRACTS[network];
    if (!contractAddress) return 0;
    try {
      const p        = getProvider(network);
      const contract = new ethers.Contract(contractAddress, ERC20_ABI, p);
      const [raw, decimals]: [ethers.BigNumber, number] = await Promise.all([
        contract.balanceOf(address),
        contract.decimals(),
      ]);
      return parseFloat(ethers.utils.formatUnits(raw, decimals));
    } catch {
      return 0;
    }
  },

  async getETHBalance(address: string, network?: string): Promise<string> {
    try {
      const bal = await getProvider(network).getBalance(address);
      return ethers.utils.formatEther(bal);
    } catch (e) {
      console.error('Balance fetch error:', e);
      return '0.0';
    }
  },

  // Returns { gasCostEth, gasPrice, gasLimit } for display in UI
  async estimateGas(
    from: string,
    to: string,
    amount: string,
    network?: string
  ): Promise<{ gasCostEth: string; gasPrice: ethers.BigNumber; gasLimit: ethers.BigNumber }> {
    const fallback = {
      gasCostEth: ethers.utils.formatEther(ethers.BigNumber.from(21000).mul(ethers.utils.parseUnits('20', 'gwei'))),
      gasPrice:   ethers.utils.parseUnits('20', 'gwei'),
      gasLimit:   ethers.BigNumber.from(21000),
    };
    // Guard: don't call RPC with empty addresses
    if (!from || !to || !amount || parseFloat(amount) <= 0) return fallback;
    try {
      const p          = getProvider(network);
      const gasLimit   = await p.estimateGas({ from, to, value: ethers.utils.parseEther(amount) });
      const feeData    = await p.getFeeData();
      const gasPrice   = feeData.maxFeePerGas ?? feeData.gasPrice ?? ethers.utils.parseUnits('20', 'gwei');
      const gasCostWei = gasLimit.mul(gasPrice);
      return { gasCostEth: ethers.utils.formatEther(gasCostWei), gasPrice, gasLimit };
    } catch {
      return fallback;
    }
  },

  async sendETH(
    privateKey: string,
    toAddress: string,
    amount: string,
    network?: string
  ): Promise<{ hash: string; success: boolean; error?: string; gasCostEth?: string }> {
    try {
      // Sanitize inputs before any RPC call
      if (!privateKey || typeof privateKey !== 'string')
        return { hash: '', success: false, error: 'Wallet not available' };
      if (!ethers.utils.isAddress(toAddress))
        return { hash: '', success: false, error: 'Invalid recipient address' };
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount > 1_000_000)
        return { hash: '', success: false, error: 'Invalid amount' };

      const p          = getProvider(network);
      const wallet     = new ethers.Wallet(privateKey, p);
      const balance    = await p.getBalance(wallet.address);
      const sendAmount = ethers.utils.parseEther(amount);

      // Get real gas estimate
      const { gasPrice, gasLimit, gasCostEth } = await ethereumService.estimateGas(
        wallet.address, toAddress, amount, network
      );
      const totalNeeded = sendAmount.add(gasLimit.mul(gasPrice));

      if (balance.lt(totalNeeded)) {
        const balEth  = parseFloat(ethers.utils.formatEther(balance)).toFixed(6);
        const gasEth  = parseFloat(gasCostEth).toFixed(6);
        return {
          hash: '', success: false,
          error: `Insufficient balance. You need ${amount} ETH + ${gasEth} ETH gas. Available: ${balEth} ETH`,
        };
      }

      const tx = await wallet.sendTransaction({
        to:       toAddress,
        value:    sendAmount,
        gasPrice,
        gasLimit,
      });

      await tx.wait(1);
      return { hash: tx.hash, success: true, gasCostEth };
    } catch (e: any) {
      const msg = e?.message ?? 'Transaction failed';
      // Clean up ethers error messages for users
      if (msg.includes('insufficient funds'))
        return { hash: '', success: false, error: 'Insufficient funds for gas + amount' };
      if (msg.includes('nonce'))
        return { hash: '', success: false, error: 'Transaction conflict. Please try again.' };
      return { hash: '', success: false, error: msg };
    }
  },

  async getTransactionCount(address: string): Promise<number> {
    try {
      return await getProvider().getTransactionCount(address);
    } catch {
      return 0;
    }
  },
};
