import { ethers } from 'ethers';
import { Platform } from 'react-native';
import AsyncStorageNative from '@react-native-async-storage/async-storage';
import { RPC_URLS } from '../config';

// ethers v5/v6 compatibility shims
const formatEther = (ethers as any).formatEther ?? ethers.utils.formatEther;
const formatUnits = (ethers as any).formatUnits ?? ethers.utils.formatUnits;
const JsonRpcProvider = (ethers as any).JsonRpcProvider ?? ethers.providers.JsonRpcProvider;

const AsyncStorage = Platform.OS === 'web'
  ? {
      getItem: async (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
      setItem: async (k: string, v: string) => { try { localStorage.setItem(k, v); } catch (_e) {} },
    }
  : AsyncStorageNative;

const ERC20_ABI = ['function balanceOf(address owner) view returns (uint256)'];

const TOKEN_CONTRACTS: Record<string, Record<string, string>> = {
  USDC: {
    Ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    Sepolia:  '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    Polygon:  '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    Arbitrum: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  },
  USDT: {
    Ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    Sepolia:  '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
    Polygon:  '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    Arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  },
};

const TOKEN_DECIMALS: Record<string, number> = {
  USDT: 6,
  USDC: 6,
  ETH: 18,
  BTC: 8,
  SOL: 9,
  BNB: 18,
  XRP: 6,
  TON: 9,
  TRX: 6,
  SUI: 9,
};

const NETWORK_CONFIG: Record<string, { chainId: number; name: string }> = {
  Sepolia:  { chainId: 11155111, name: 'sepolia'   },
  Ethereum: { chainId: 1,        name: 'homestead' },
  Polygon:  { chainId: 137,      name: 'matic'     },
  Arbitrum: { chainId: 42161,    name: 'arbitrum'  },
};

export type WalletBalances = {
  USDT: number;
  USDC: number;
  ETH: number;
  BTC: number;
  SOL: number;
  BNB: number;
  XRP: number;
  TON: number;
  TRX: number;
  SUI: number;
  [key: string]: number;
};

function makeProvider(network: string) {
  const rpcUrl = RPC_URLS[network] ?? RPC_URLS['Sepolia'];
  const netCfg = NETWORK_CONFIG[network] ?? NETWORK_CONFIG['Sepolia'];
  return new JsonRpcProvider(rpcUrl, { chainId: netCfg.chainId, name: netCfg.name }, { staticNetwork: true });
}

export async function getWalletBalances(
  walletAddress: string,
  network: string,
  localBalances?: Partial<WalletBalances>
): Promise<WalletBalances> {
  const local = localBalances ?? {};

  // TRON networks — use TronGrid REST API + tronService for full token balances
  if (network === 'TRON' || network === 'TRON Nile') {
    try {
      const { tronService } = await import('./tronService');
      const tronBals = await tronService.getAllBalances(walletAddress, network);
      const balances: WalletBalances = {
        USDT: tronBals.USDT,
        USDC: tronBals.USDC,
        ETH: 0,
        TRX: tronBals.TRX,
        BTC: local.BTC ?? 0,
        SOL: local.SOL ?? 0,
        BNB: local.BNB ?? 0,
        XRP: local.XRP ?? 0,
        TON: local.TON ?? 0,
        SUI: local.SUI ?? 0,
      };
      await AsyncStorage.setItem('cw_token_balances', JSON.stringify(balances)).catch(() => {});
      return balances;
    } catch {
      return {
        USDT: local.USDT ?? 0,
        USDC: local.USDC ?? 0,
        ETH: 0,
        TRX: local.TRX ?? 0,
        BTC: local.BTC ?? 0,
        SOL: local.SOL ?? 0,
        BNB: local.BNB ?? 0,
        XRP: local.XRP ?? 0,
        TON: local.TON ?? 0,
        SUI: local.SUI ?? 0,
      };
    }
  }

  const provider  = makeProvider(network);
  const isTestnet = network === 'Sepolia';

  const [ethRaw, usdcRaw, usdtRaw] = await Promise.allSettled([
    provider.getBalance(walletAddress),
    fetchERC20(provider, walletAddress, TOKEN_CONTRACTS.USDC[network], TOKEN_DECIMALS.USDC),
    fetchERC20(provider, walletAddress, TOKEN_CONTRACTS.USDT[network], TOKEN_DECIMALS.USDT),
  ]);

  const chainETH  = ethRaw.status  === 'fulfilled' ? parseFloat(formatEther(ethRaw.value)) : null;
  const chainUSDC   = usdcRaw.status   === 'fulfilled' ? usdcRaw.value : null;
  const chainUSDT   = usdtRaw.status   === 'fulfilled' ? usdtRaw.value : null;

  const balances: WalletBalances = {
    USDT: isTestnet ? Math.max(chainUSDT ?? 0, local.USDT ?? 0) : (chainUSDT !== null ? chainUSDT : (local.USDT ?? 0)),
    USDC: isTestnet ? Math.max(chainUSDC ?? 0, local.USDC ?? 0) : (chainUSDC !== null ? chainUSDC : (local.USDC ?? 0)),
    ETH: chainETH !== null ? chainETH : (local.ETH ?? 0),
    BTC: local.BTC ?? 0,
    SOL: local.SOL ?? 0,
    BNB: local.BNB ?? 0,
    XRP: local.XRP ?? 0,
    TON: local.TON ?? 0,
    TRX: 0,
    SUI: local.SUI ?? 0,
  };

  const hasAnyBalance = Object.values(balances).some(v => v > 0);
  if (hasAnyBalance || !isTestnet) {
    await AsyncStorage.setItem('cw_token_balances', JSON.stringify(balances)).catch(() => {});
  }

  return balances;
}

async function fetchERC20(
  provider: ethers.JsonRpcProvider,
  address: string,
  contractAddress: string | undefined,
  decimals: number,
): Promise<number> {
  if (!contractAddress) return 0;
  try {
    const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider);
    const raw: bigint = await contract.balanceOf(address);
    return parseFloat(formatUnits(raw, decimals));
  } catch {
    return 0;
  }
}
