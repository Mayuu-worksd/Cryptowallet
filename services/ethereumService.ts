import { ethers } from 'ethers';
import { NETWORKS } from '../constants';

// ethers v5/v6 compatibility shims
const formatEther  = (ethers as any).formatEther  ?? ethers.utils.formatEther;
const formatUnits  = (ethers as any).formatUnits  ?? ethers.utils.formatUnits;
const parseEther   = (ethers as any).parseEther   ?? ethers.utils.parseEther;
const parseUnits   = (ethers as any).parseUnits   ?? ethers.utils.parseUnits;
const isAddress    = (ethers as any).isAddress    ?? ethers.utils.isAddress;
const JsonRpcProvider = (ethers as any).JsonRpcProvider ?? ethers.providers.JsonRpcProvider;

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
  Sepolia:        { chainId: 11155111, name: 'sepolia'   },
  Ethereum:       { chainId: 1,        name: 'homestead' },
  Polygon:        { chainId: 137,      name: 'matic'     },
  Arbitrum:       { chainId: 42161,    name: 'arbitrum'  },
  BSC:            { chainId: 56,       name: 'bnb'       },
  'BSC Testnet':  { chainId: 97,       name: 'bnbt'      },
};

const providers: Record<string, any> = {};
let currentNetwork = 'Sepolia';

export function getProvider(network: string = currentNetwork): any {
  // Prevent TRON networks from being used with EVM provider
  if (network === 'TRON' || network === 'TRON Nile') {
    throw new Error(`Cannot use EVM provider for ${network}. Use tronService instead.`);
  }
  if (!providers[network]) {
    const rpcUrl    = NETWORKS[network]    ?? NETWORKS['Sepolia'];
    const netConfig = NETWORK_CONFIG[network] ?? NETWORK_CONFIG['Sepolia'];
    providers[network] = new JsonRpcProvider(rpcUrl, { chainId: netConfig.chainId, name: netConfig.name }, { staticNetwork: true });
  }
  return providers[network];
}

export const ethereumService = {
  switchNetwork(network: string): void {
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
      return parseFloat(formatUnits(raw, Number(decimals)));
    } catch {
      return 0;
    }
  },

  async getETHBalance(address: string, network?: string): Promise<string> {
    try {
      const bal = await getProvider(network).getBalance(address);
      return formatEther(bal);
    } catch {
      return '0.0';
    }
  },

  async estimateGas(
    from: string,
    to: string,
    amount: string,
    network?: string
  ): Promise<{ gasCostEth: string; gasPrice: string; gasLimit: string }> {
    const defaultGasPrice = '20000000000'; // 20 gwei in wei as string
    const defaultGasLimit = '21000';
    const fallback = {
      gasCostEth: '0.00042',
      gasPrice:   defaultGasPrice,
      gasLimit:   defaultGasLimit,
    };
    if (!from || !to || !amount || parseFloat(amount) <= 0) return fallback;
    try {
      const p        = getProvider(network);
      const gasLimitRaw = await p.estimateGas({ from, to, value: parseEther(amount) });
      const feeData  = await p.getFeeData();
      const gasPriceRaw = feeData.maxFeePerGas ?? feeData.gasPrice ?? parseUnits('20', 'gwei');
      
      // Convert to strings to handle both ethers.js BigNumber and native bigint
      const gasLimitStr = typeof gasLimitRaw === 'bigint' ? gasLimitRaw.toString() : gasLimitRaw?.toString?.() ?? defaultGasLimit;
      const gasPriceStr = typeof gasPriceRaw === 'bigint' ? gasPriceRaw.toString() : gasPriceRaw?.toString?.() ?? defaultGasPrice;
      
      // Calculate cost
      const costWei = BigInt(gasLimitStr) * BigInt(gasPriceStr);
      const gasCostEth = formatEther(costWei);
      
      return { gasCostEth, gasPrice: gasPriceStr, gasLimit: gasLimitStr };
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
      if (!isAddress(toAddress))
        return { hash: '', success: false, error: 'Invalid recipient address' };
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount > 1_000_000)
        return { hash: '', success: false, error: 'Invalid amount' };

      const p           = getProvider(network);
      const wallet      = new ethers.Wallet(privateKey, p);
      const balance     = await p.getBalance(wallet.address);
      const sendAmount  = parseEther(amount);
      const { gasPrice, gasLimit, gasCostEth } = await ethereumService.estimateGas(wallet.address, toAddress, amount, network);
      
      // Convert string gas values to BigInt for calculation
      const gasPriceBig = BigInt(gasPrice);
      const gasLimitBig = BigInt(gasLimit);
      const totalNeeded = sendAmount + gasLimitBig * gasPriceBig;

      if (balance < totalNeeded) {
        const balEth = parseFloat(formatEther(balance)).toFixed(6);
        const gasEth = parseFloat(gasCostEth).toFixed(6);
        return { hash: '', success: false, error: `Insufficient balance. You need ${amount} ETH + ${gasEth} ETH gas. Available: ${balEth} ETH` };
      }

      const tx = await wallet.sendTransaction({ 
        to: toAddress, 
        value: sendAmount, 
        gasPrice,
        gasLimit
      });
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

  async sendERC20(
    privateKey: string,
    toAddress: string,
    amount: string,
    contractAddress: string,
    decimals: number,
    network?: string
  ): Promise<{ hash: string; success: boolean; error?: string }> {
    try {
      if (!privateKey) return { hash: '', success: false, error: 'Wallet not available' };
      if (!isAddress(toAddress)) return { hash: '', success: false, error: 'Invalid recipient address' };
      const parsed = parseFloat(amount);
      if (isNaN(parsed) || parsed <= 0) return { hash: '', success: false, error: 'Invalid amount' };

      const p = getProvider(network);
      const wallet = new ethers.Wallet(privateKey, p);
      const contract = new ethers.Contract(contractAddress, [
        'function transfer(address to, uint256 amount) returns (bool)',
        'function balanceOf(address owner) view returns (uint256)',
      ], wallet);

      const amountBig = parseUnits(amount, decimals);
      const bal: bigint = await contract.balanceOf(wallet.address);
      if (bal < amountBig) {
        return { hash: '', success: false, error: `Insufficient token balance` };
      }

      const tx = await contract.transfer(toAddress, amountBig);
      await tx.wait(1);
      return { hash: tx.hash, success: true };
    } catch (e: any) {
      const msg = e?.message ?? 'ERC20 transfer failed';
      if (msg.includes('insufficient funds')) return { hash: '', success: false, error: 'Not enough ETH for gas fees' };
      return { hash: '', success: false, error: msg };
    }
  },
};
