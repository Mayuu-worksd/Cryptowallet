import { ethers } from 'ethers';
import { Platform } from 'react-native';
import { RPC_URLS } from '../config';

let AsyncStorage: any;
if (Platform.OS === 'web') {
  AsyncStorage = {
    getItem: async (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
    setItem: async (k: string, v: string) => { try { localStorage.setItem(k, v); } catch (_e) {} },
  };
} else {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
}

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
  DAI: {
    Ethereum: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    Sepolia:  '0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6',
    Polygon:  '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    Arbitrum: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
  },
  CUSTOM: {
    Sepolia:  '0x351028A22C876E0431b30921c0dD0a836a14899E',
  }
};

const TOKEN_DECIMALS: Record<string, number> = { USDC: 6, USDT: 6, DAI: 18, CUSTOM: 18 };

const NETWORK_CONFIG: Record<string, { chainId: number; name: string }> = {
  Sepolia:  { chainId: 11155111, name: 'sepolia'   },
  Ethereum: { chainId: 1,        name: 'homestead' },
  Polygon:  { chainId: 137,      name: 'matic'     },
  Arbitrum: { chainId: 42161,    name: 'arbitrum'  },
};

export type WalletBalances = {
  ETH: number;
  USDC: number;
  USDT: number;
  DAI: number;
  CUSTOM: number;
  [key: string]: number;
};

/**
 * StaticJsonRpcProvider skips the eth_chainId network-detection handshake
 * entirely because we supply chainId explicitly. This eliminates the
 * "could not detect network" race that JsonRpcProvider suffers when multiple
 * calls fire before the handshake completes.
 */
function makeProvider(network: string): ethers.providers.StaticJsonRpcProvider {
  const rpcUrl = RPC_URLS[network] ?? RPC_URLS['Sepolia'];
  const netCfg = NETWORK_CONFIG[network] ?? NETWORK_CONFIG['Sepolia'];
  return new ethers.providers.StaticJsonRpcProvider(
    { url: rpcUrl, timeout: 12000 },
    { chainId: netCfg.chainId, name: netCfg.name }
  );
}

/**
 * Fetches on-chain balances and merges with local state.
 *
 * Merge strategy:
 *  - ETH: always trust chain (gas is spent even on simulated swaps)
 *  - ERC20 on Sepolia: Math.max(chain, local) — simulated swaps don't move
 *    real tokens so chain returns 0, but local has the correct post-swap value
 *  - ERC20 on mainnet: always trust chain (real tokens moved)
 */
export async function getWalletBalances(
  walletAddress: string,
  network: string,
  localBalances?: Partial<WalletBalances>
): Promise<WalletBalances> {
  const provider  = makeProvider(network);
  const isTestnet = network === 'Sepolia';
  const local     = localBalances ?? {};

  const [ethRaw, usdcRaw, usdtRaw, daiRaw, customRaw] = await Promise.allSettled([
    provider.getBalance(walletAddress),
    fetchERC20(provider, walletAddress, TOKEN_CONTRACTS.USDC[network], TOKEN_DECIMALS.USDC, 'USDC'),
    fetchERC20(provider, walletAddress, TOKEN_CONTRACTS.USDT[network], TOKEN_DECIMALS.USDT, 'USDT'),
    fetchERC20(provider, walletAddress, TOKEN_CONTRACTS.DAI[network],  TOKEN_DECIMALS.DAI,  'DAI'),
    fetchERC20(provider, walletAddress, TOKEN_CONTRACTS.CUSTOM[network], TOKEN_DECIMALS.CUSTOM, 'CUSTOM'),
  ]);

  const chainETH    = ethRaw.status    === 'fulfilled' ? parseFloat(ethers.utils.formatEther(ethRaw.value))  : null;
  const chainUSDC   = usdcRaw.status   === 'fulfilled' ? usdcRaw.value : null;
  const chainUSDT   = usdtRaw.status   === 'fulfilled' ? usdtRaw.value : null;
  const chainDAI    = daiRaw.status    === 'fulfilled' ? daiRaw.value  : null;
  const chainCUSTOM = customRaw.status === 'fulfilled' ? customRaw.value : null;

  // ─── AUTO-HEAL: Calculate CUSTOM balance from history ─────────────────────
  let historyCUSTOM = 0;
  try {
    const raw = await AsyncStorage.getItem('cw_transactions').catch(() => null);
    if (raw) {
      const txs: any[] = JSON.parse(raw);
      txs.forEach(t => {
        const isSuccess = t.status === 'success' || t.status === 'completed';
        if (!isSuccess) return;
        
        const isCustom = (t as any).contractAddress?.toLowerCase() === '0x351028A22C876E0431b30921c0dD0a836a14899E'.toLowerCase() || t.coin === 'CUSTOM';
        if (isCustom) {
          const amt = parseFloat((t as any).buyAmount || t.amount);
          if (!isNaN(amt)) {
            const isIncoming = t.type === 'receive' || t.type === 'received' || t.type === 'swap';
            historyCUSTOM += isIncoming ? amt : -amt;
          }
        }
      });
    }
  } catch (_e) {
    historyCUSTOM = local.CUSTOM || 0;
  }

  const balances: WalletBalances = {
    // ETH: Always trust the chain if we have it, otherwise fallback to local
    ETH: chainETH !== null ? chainETH : (local.ETH ?? 0),

    // ERC20: On Sepolia, simulated swaps might mean local is higher than chain (since chain is zero for tokens)
    // On Mainnet, always trust chain.
    USDC: isTestnet
      ? Math.max(chainUSDC ?? 0, local.USDC ?? 0)
      : (chainUSDC !== null ? chainUSDC : (local.USDC ?? 0)),
    USDT: isTestnet
      ? Math.max(chainUSDT ?? 0, local.USDT ?? 0)
      : (chainUSDT !== null ? chainUSDT : (local.USDT ?? 0)),
    DAI: isTestnet
      ? Math.max(chainDAI ?? 0, local.DAI ?? 0)
      : (chainDAI !== null ? chainDAI : (local.DAI ?? 0)),
    CUSTOM: isTestnet
      ? Math.max(chainCUSTOM ?? 0, historyCUSTOM, local.CUSTOM ?? 0)
      : (chainCUSTOM !== null ? chainCUSTOM : (local.CUSTOM ?? 0)),
  };

  const hasAnyBalance = balances.ETH > 0 || balances.USDC > 0 || balances.USDT > 0 || balances.DAI > 0 || balances.CUSTOM > 0;
  if (hasAnyBalance || !isTestnet) {
    await AsyncStorage.setItem('cw_token_balances', JSON.stringify(balances)).catch(() => {});
  }

  return balances;
}

async function fetchERC20(
  provider: ethers.providers.JsonRpcProvider,
  address: string,
  contractAddress: string | undefined,
  decimals: number,
  symbol: string
): Promise<number> {
  if (!contractAddress) return 0;
  
  // Special case: CUSTOM is a locally-simulated demo asset
  if (symbol === 'CUSTOM') return 0; 

  try {
    const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider);
    const raw: ethers.BigNumber = await contract.balanceOf(address);
    const value = parseFloat(ethers.utils.formatUnits(raw, decimals));
    return value;
  } catch (e: any) {
    // Squelch RPC errors for simulated/missing contracts to avoid UI hangs/terminal noise
    return 0;
  }
}
