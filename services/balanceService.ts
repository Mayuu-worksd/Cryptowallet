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
    BSC:      '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    'Base Sepolia':     '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    'Polygon Amoy':     '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    'Arbitrum Sepolia': '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    'Optimism Sepolia': '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
  },
  USDT: {
    Ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    Sepolia:  '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
    Polygon:  '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    Arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    BSC:      '0x55d398326f99059fF775485246999027B3197955',
    'Base Sepolia':     '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
    'Polygon Amoy':     '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
    'Arbitrum Sepolia': '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
    'Optimism Sepolia': '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
  },
  INRX: {
    Ethereum: '0x51A5F24560547f587999c331788aC495D40d95ba',
    Sepolia:  '0x51A5F24560547f587999c331788aC495D40d95ba',
    Polygon:  '0xd52280A15b30e5EdfFF858E7EC22266604358F26',
    'Polygon Amoy':     '0xd52280A15b30e5EdfFF858E7EC22266604358F26',
    'Base Sepolia':     '0x51A5F24560547f587999c331788aC495D40d95ba',
    'Arbitrum Sepolia': '0x51A5F24560547f587999c331788aC495D40d95ba',
    'Optimism Sepolia': '0x51A5F24560547f587999c331788aC495D40d95ba',
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
  INRX: 6,
};

const NETWORK_CONFIG: Record<string, { chainId: number; name: string }> = {
  Sepolia:            { chainId: 11155111, name: 'sepolia'          },
  Ethereum:           { chainId: 1,        name: 'homestead'        },
  Polygon:            { chainId: 137,      name: 'matic'            },
  Arbitrum:           { chainId: 42161,    name: 'arbitrum'         },
  'Polygon Amoy':     { chainId: 80002,    name: 'amoy'             },
  'Arbitrum Sepolia': { chainId: 421614,   name: 'arbitrum-sepolia' },
  'Base Sepolia':     { chainId: 84532,    name: 'base-sepolia'     },
  'Optimism Sepolia': { chainId: 11155420, name: 'optimism-sepolia' },
  BSC:                { chainId: 56,       name: 'bnb'              },
  'BSC Testnet':      { chainId: 97,       name: 'bnbt'             },
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
  INRX: number;
  [key: string]: number;
};

function makeProvider(network: string) {
  const rpcUrl = RPC_URLS[network] ?? RPC_URLS['Sepolia'];
  const netCfg = NETWORK_CONFIG[network] ?? NETWORK_CONFIG['Sepolia'];
  return new JsonRpcProvider(rpcUrl, { chainId: netCfg.chainId, name: netCfg.name }, { staticNetwork: true });
}

function deriveSolanaAddress(evmAddress: string): string {
  if (!evmAddress) return '';
  const cleanHex = evmAddress.toLowerCase().replace('0x', '');
  const b58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let res = '';
  for (let i = 0; i < cleanHex.length; i += 2) {
    const byte = parseInt(cleanHex.slice(i, i + 2), 16) || 0;
    res += b58[byte % 58];
  }
  return (res + res).padEnd(44, 'x').slice(0, 44);
}

export async function saveTokenBalances(network: string, balances: Partial<WalletBalances>) {
  try {
    const cachedStr = await AsyncStorage.getItem('cw_token_balances');
    let toSave = cachedStr ? JSON.parse(cachedStr) : {};

    const isBSC = network === 'BSC' || network === 'BSC Testnet';
    const isTron = network === 'TRON' || network === 'TRON Nile';
    const isSolana = network === 'Solana' || network === 'Solana Devnet';
    const isEVM = !isBSC && !isTron && !isSolana && network !== 'Bitcoin';

    // 1. Always save cross-chain tokens (BTC, SOL, XRP, TON, SUI, TRX) globally
    const crossChainKeys = ['BTC', 'SOL', 'XRP', 'TON', 'SUI', 'TRX', 'USDT_TRC20', 'USDC_TRC20'];
    crossChainKeys.forEach(k => {
      if ((balances as any)[k] !== undefined) toSave[k] = (balances as any)[k];
    });

    // 2. Save network-specific prefixed keys — NEVER overwrite flat ETH/USDT/USDC globally
    if (isBSC) {
      toSave[`BNB_${network}`] = balances.BNB;
      toSave[`USDC_ERC20_${network}`] = (balances as any).USDC_ERC20 ?? balances.USDC;
      toSave[`USDT_ERC20_${network}`] = (balances as any).USDT_ERC20 ?? balances.USDT;
    } else if (isEVM) {
      toSave[`ETH_${network}`] = balances.ETH;
      toSave[`USDC_ERC20_${network}`] = (balances as any).USDC_ERC20 ?? balances.USDC;
      toSave[`USDT_ERC20_${network}`] = (balances as any).USDT_ERC20 ?? balances.USDT;
      toSave[`INRX_${network}`] = balances.INRX;
    }

    await AsyncStorage.setItem('cw_token_balances', JSON.stringify(toSave));
  } catch (e) {
    console.error('Error saving token balances:', e);
  }
}

export async function getWalletBalances(
  walletAddress: string,
  network: string,
  localBalances?: Partial<WalletBalances>
): Promise<WalletBalances> {
  // 1. Always load from AsyncStorage first to make sure we don't lose cross-chain cache
  let local: Partial<WalletBalances> = { ...(localBalances ?? {}) };
  try {
    const cachedStr = await AsyncStorage.getItem('cw_token_balances');
    if (cachedStr) {
      const cached = JSON.parse(cachedStr);
      // Preserve cross-chain tokens (BTC, SOL, XRP, TON, SUI, TRX) from global cache
      const crossChainKeys = ['BTC', 'SOL', 'XRP', 'TON', 'SUI', 'TRX', 'USDT_TRC20', 'USDC_TRC20'];
      crossChainKeys.forEach(k => {
        if ((local as any)[k] === undefined || (local as any)[k] === 0) {
          if (typeof cached[k] === 'number' && cached[k] > 0) (local as any)[k] = cached[k];
        }
      });
      // Copy all network-prefixed keys into local so resolvedXxx can read them
      Object.entries(cached).forEach(([k, v]) => {
        if (k.includes('_')) (local as any)[k] = v;
      });
    }
  } catch {}

  const isBSC = network === 'BSC' || network === 'BSC Testnet';

  // BSC: fetch BNB + BEP20 tokens (same EVM logic as Ethereum)
  if (isBSC) {
    const provider = makeProvider(network);
    const [bnbRaw, usdcRaw, usdtRaw] = await Promise.allSettled([
      provider.getBalance(walletAddress),
      fetchERC20(provider, walletAddress, TOKEN_CONTRACTS.USDC[network], 18), // BSC USDC is 18 decimals
      fetchERC20(provider, walletAddress, TOKEN_CONTRACTS.USDT[network], 18), // BSC USDT is 18 decimals
    ]);
    const chainBNB  = bnbRaw.status  === 'fulfilled' ? parseFloat(formatEther(bnbRaw.value)) : (local.BNB ?? 0);
    const chainUSDC = usdcRaw.status === 'fulfilled' ? usdcRaw.value : (local.USDC ?? 0);
    const chainUSDT = usdtRaw.status === 'fulfilled' ? usdtRaw.value : (local.USDT ?? 0);
    const balances: WalletBalances = {
      USDT_TRC20: local.USDT_TRC20 ?? 0, USDC_TRC20: local.USDC_TRC20 ?? 0,
      USDT_ERC20: local.USDT_ERC20 ?? 0, USDC_ERC20: local.USDC_ERC20 ?? 0,
      USDT: chainUSDT, USDC: chainUSDC,
      ETH: local.ETH ?? 0, TRX: local.TRX ?? 0,
      BTC: local.BTC ?? 0, SOL: local.SOL ?? 0,
      BNB: chainBNB,
      XRP: local.XRP ?? 0, TON: local.TON ?? 0, SUI: local.SUI ?? 0,
      INRX: local.INRX ?? 0,
    };
    await saveTokenBalances(network, balances);
    return balances;
  }

  const isTronNet = network === 'TRON' || network === 'TRON Nile';

  // Solana networks — use JSON-RPC getBalance
  if (network === 'Solana' || network === 'Solana Devnet') {
    try {
      const solAddress = deriveSolanaAddress(walletAddress);
      const rpcUrl = RPC_URLS[network] ?? 'https://api.mainnet-beta.solana.com';
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [solAddress]
        })
      });
      const json = await response.json();
      const lamports = json?.result?.value ?? 0;
      const solBalance = lamports / 1_000_000_000;
      const balances: WalletBalances = {
        USDT_TRC20: local.USDT_TRC20 ?? 0,
        USDC_TRC20: local.USDC_TRC20 ?? 0,
        USDT_ERC20: local.USDT_ERC20 ?? 0,
        USDC_ERC20: local.USDC_ERC20 ?? 0,
        USDT: local.USDT ?? 0,
        USDC: local.USDC ?? 0,
        ETH: local.ETH ?? 0,
        TRX: local.TRX ?? 0,
        BTC: local.BTC ?? 0,
        SOL: solBalance,
        BNB: local.BNB ?? 0,
        XRP: local.XRP ?? 0,
        TON: local.TON ?? 0,
        SUI: local.SUI ?? 0,
        INRX: local.INRX ?? 0,
      };
      await saveTokenBalances(network, balances);
      return balances;
    } catch {
      return {
        USDT_TRC20: local.USDT_TRC20 ?? 0,
        USDC_TRC20: local.USDC_TRC20 ?? 0,
        USDT_ERC20: local.USDT_ERC20 ?? 0,
        USDC_ERC20: local.USDC_ERC20 ?? 0,
        USDT: local.USDT ?? 0,
        USDC: local.USDC ?? 0,
        ETH: local.ETH ?? 0,
        TRX: local.TRX ?? 0,
        BTC: local.BTC ?? 0,
        SOL: local.SOL ?? 0,
        BNB: local.BNB ?? 0,
        XRP: local.XRP ?? 0,
        TON: local.TON ?? 0,
        SUI: local.SUI ?? 0,
        INRX: local.INRX ?? 0,
      };
    }
  }

  // TRON networks — use TronGrid REST API + tronService for full token balances
  if (isTronNet) {
    try {
      const { tronService } = await import('./tronService');
      const tronBals = await tronService.getAllBalances(walletAddress, network);
      const resolvedTRX = tronBals.TRX !== undefined ? tronBals.TRX : (local.TRX ?? 0);
      const resolvedUSDT = tronBals.USDT !== undefined ? tronBals.USDT : (local.USDT ?? local.USDT_TRC20 ?? 0);
      const resolvedUSDC = tronBals.USDC !== undefined ? tronBals.USDC : (local.USDC ?? local.USDC_TRC20 ?? 0);
      const resolvedINRX = (tronBals as any).INRX !== undefined ? (tronBals as any).INRX : (local.INRX ?? 0);
      const balances: WalletBalances = {
        USDT_TRC20: resolvedUSDT,
        USDC_TRC20: resolvedUSDC,
        USDT_ERC20: local.USDT_ERC20 ?? 0,
        USDC_ERC20: local.USDC_ERC20 ?? 0,
        USDT: resolvedUSDT,
        USDC: resolvedUSDC,
        ETH: local.ETH ?? 0,
        TRX: resolvedTRX,
        BTC: local.BTC ?? 0,
        SOL: local.SOL ?? 0,
        BNB: local.BNB ?? 0,
        XRP: local.XRP ?? 0,
        TON: local.TON ?? 0,
        SUI: local.SUI ?? 0,
        INRX: resolvedINRX,
      };
      await saveTokenBalances(network, balances);
      return balances;
    } catch {
      return {
        USDT_TRC20: local.USDT_TRC20 ?? 0,
        USDC_TRC20: local.USDC_TRC20 ?? 0,
        USDT_ERC20: local.USDT_ERC20 ?? 0,
        USDC_ERC20: local.USDC_ERC20 ?? 0,
        USDT: local.USDT_TRC20 ?? 0,
        USDC: local.USDC_TRC20 ?? 0,
        ETH: local.ETH ?? 0,
        TRX: local.TRX ?? 0,
        BTC: local.BTC ?? 0,
        SOL: local.SOL ?? 0,
        BNB: local.BNB ?? 0,
        XRP: local.XRP ?? 0,
        TON: local.TON ?? 0,
        SUI: local.SUI ?? 0,
        INRX: local.INRX ?? 0,
      };
    }
  }

  const provider  = makeProvider(network);

  const [ethRaw, usdcRaw, usdtRaw, inrxRaw] = await Promise.allSettled([
    provider.getBalance(walletAddress),
    fetchERC20(provider, walletAddress, TOKEN_CONTRACTS.USDC[network], TOKEN_DECIMALS.USDC),
    fetchERC20(provider, walletAddress, TOKEN_CONTRACTS.USDT[network], TOKEN_DECIMALS.USDT),
    fetchERC20(provider, walletAddress, TOKEN_CONTRACTS.INRX[network], TOKEN_DECIMALS.INRX),
  ]);

  const chainETH  = ethRaw.status  === 'fulfilled' ? parseFloat(formatEther(ethRaw.value)) : null;
  const chainUSDC = usdcRaw.status === 'fulfilled' ? usdcRaw.value : null;
  const chainUSDT = usdtRaw.status === 'fulfilled' ? usdtRaw.value : null;
  const chainINRX = inrxRaw.status === 'fulfilled' ? inrxRaw.value : null;

  // Load network-specific cached values (never bleed across networks)
  const cachedETH  = local[`ETH_${network}` as keyof WalletBalances] as number | undefined;
  const cachedUSDT = local[`USDT_ERC20_${network}` as keyof WalletBalances] as number | undefined;
  const cachedUSDC = local[`USDC_ERC20_${network}` as keyof WalletBalances] as number | undefined;
  const cachedINRX = local[`INRX_${network}` as keyof WalletBalances] as number | undefined;

  // Use live chain value; fall back ONLY to this network's own cache if RPC failed
  const resolvedETH  = chainETH  !== null ? chainETH  : (cachedETH  ?? 0);
  const resolvedUSDT = chainUSDT !== null ? chainUSDT : (cachedUSDT ?? 0);
  const resolvedUSDC = chainUSDC !== null ? chainUSDC : (cachedUSDC ?? 0);
  const resolvedINRX = chainINRX !== null ? chainINRX : (cachedINRX ?? 0);

  const balances: WalletBalances = {
    USDT_ERC20: resolvedUSDT,
    USDC_ERC20: resolvedUSDC,
    USDT_TRC20: local.USDT_TRC20 ?? 0,
    USDC_TRC20: local.USDC_TRC20 ?? 0,
    USDT: resolvedUSDT,
    USDC: resolvedUSDC,
    ETH: resolvedETH,
    TRX: local.TRX ?? 0,
    BTC: local.BTC ?? 0,
    SOL: local.SOL ?? 0,
    BNB: local.BNB ?? 0,
    XRP: local.XRP ?? 0,
    TON: local.TON ?? 0,
    SUI: local.SUI ?? 0,
    INRX: resolvedINRX,
  };

  await saveTokenBalances(network, balances);

  return balances;
}

async function fetchERC20(
  provider: ethers.providers.JsonRpcProvider,
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
