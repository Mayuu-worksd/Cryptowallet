import { ethers } from 'ethers';
import { NETWORKS } from '../constants';

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

const TOKEN_CONTRACTS: Record<string, Record<string, string>> = {
  USDT: {
    Ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    Polygon:  '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    Arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    Sepolia:  '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
  },
  USDC: {
    Ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    Polygon:  '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    Arbitrum: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    Sepolia:  '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  },
  DAI: {
    Ethereum: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    Polygon:  '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    Arbitrum: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    Sepolia:  '0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6',
  },
};

const NETWORK_CONFIG: Record<string, { chainId: number; name: string }> = {
  Sepolia:  { chainId: 11155111, name: 'sepolia'   },
  Ethereum: { chainId: 1,        name: 'homestead' },
  Polygon:  { chainId: 137,      name: 'matic'     },
  Arbitrum: { chainId: 42161,    name: 'arbitrum'  },
};

let provider: ethers.JsonRpcProvider | null = null;
let currentNetwork = 'Sepolia';

export function getProvider(network: string = currentNetwork): ethers.JsonRpcProvider {
  if (!provider || network !== currentNetwork) {
    const rpcUrl    = NETWORKS[network]    ?? NETWORKS['Sepolia'];
    const netConfig = NETWORK_CONFIG[network] ?? NETWORK_CONFIG['Sepolia'];
    provider = new ethers.JsonRpcProvider(rpcUrl, { chainId: netConfig.chainId, name: netConfig.name }, { staticNetwork: true });
    currentNetwork = network;
  }
  return provider;
}

export const ethereumService = {
  switchNetwork(network: string): void {
    provider = null;
    currentNetwork = network;
  },

  async getTokenBalance(address: string, tokenSymbol: string, network: string = currentNetwork): Promise<number> {
    const contractAddress = TOKEN_CONTRACTS[tokenSymbol]?.[network];
    if (!contractAddress) return 0;
    try {
      const p        = getProvider(network);
      const contract = new ethers.Contract(contractAddress, ERC20_ABI, p);
      const [raw, decimals]: [bigint, bigint] = await Promise.all([
        contract.balanceOf(address),
        contract.decimals(),
      ]);
      return parseFloat(ethers.formatUnits(raw, Number(decimals)));
    } catch {
      return 0;
    }
  },

  async getETHBalance(address: string, network?: string): Promise<string> {
    try {
      const bal = await getProvider(network).getBalance(address);
      return ethers.formatEther(bal);
    } catch {
      return '0.0';
    }
  },

  async estimateGas(
    from: string,
    to: string,
    amount: string,
    network?: string
  ): Promise<{ gasCostEth: string; gasPrice: bigint; gasLimit: bigint }> {
    const defaultGasPrice = ethers.parseUnits('20', 'gwei');
    const defaultGasLimit = 21000n;
    const fallback = {
      gasCostEth: ethers.formatEther(defaultGasLimit * defaultGasPrice),
      gasPrice:   defaultGasPrice,
      gasLimit:   defaultGasLimit,
    };
    if (!from || !to || !amount || parseFloat(amount) <= 0) return fallback;
    try {
      const p        = getProvider(network);
      const gasLimit = await p.estimateGas({ from, to, value: ethers.parseEther(amount) });
      const feeData  = await p.getFeeData();
      const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? defaultGasPrice;
      return { gasCostEth: ethers.formatEther(gasLimit * gasPrice), gasPrice, gasLimit };
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
      if (!privateKey || typeof privateKey !== 'string')
        return { hash: '', success: false, error: 'Wallet not available' };
      if (!ethers.isAddress(toAddress))
        return { hash: '', success: false, error: 'Invalid recipient address' };
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount > 1_000_000)
        return { hash: '', success: false, error: 'Invalid amount' };

      const p           = getProvider(network);
      const wallet      = new ethers.Wallet(privateKey, p);
      const balance     = await p.getBalance(wallet.address);
      const sendAmount  = ethers.parseEther(amount);
      const { gasPrice, gasLimit, gasCostEth } = await ethereumService.estimateGas(wallet.address, toAddress, amount, network);
      const totalNeeded = sendAmount + gasLimit * gasPrice;

      if (balance < totalNeeded) {
        const balEth = parseFloat(ethers.formatEther(balance)).toFixed(6);
        const gasEth = parseFloat(gasCostEth).toFixed(6);
        return { hash: '', success: false, error: `Insufficient balance. You need ${amount} ETH + ${gasEth} ETH gas. Available: ${balEth} ETH` };
      }

      const tx = await wallet.sendTransaction({ to: toAddress, value: sendAmount, gasPrice, gasLimit });
      await tx.wait(1);
      return { hash: tx.hash, success: true, gasCostEth };
    } catch (e: any) {
      const msg = e?.message ?? 'Transaction failed';
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
