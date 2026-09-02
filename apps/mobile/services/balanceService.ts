import { ethers } from 'ethers';
import { Platform } from 'react-native';
import AsyncStorageNative from '@react-native-async-storage/async-storage';
import { RPC_URLS } from '../config';
import { supabase } from './supabaseClient';

// ethers v5/v6 compatibility shims
const formatEther = (ethers as any).formatEther ?? ethers.utils.formatEther;
const formatUnits = (ethers as any).formatUnits ?? ethers.utils.formatUnits;
const StaticJsonRpcProvider = (ethers as any).StaticJsonRpcProvider ?? ethers.providers.StaticJsonRpcProvider;

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
    Sepolia:  '0x29553D1AD85C55b41812c19856E1106cBB406EA9',
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
    Sepolia:  '0xbD1ea96750Ef2E971D4B17F80DeB29a081BbA9A0',
    Polygon:  '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    Arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    BSC:      '0x55d398326f99059fF775485246999027B3197955',
    'Base Sepolia':     '0xbD1ea96750Ef2E971D4B17F80DeB29a081BbA9A0',
    'Polygon Amoy':     '0xbD1ea96750Ef2E971D4B17F80DeB29a081BbA9A0',
    'Arbitrum Sepolia': '0xbD1ea96750Ef2E971D4B17F80DeB29a081BbA9A0',
    'Optimism Sepolia': '0xbD1ea96750Ef2E971D4B17F80DeB29a081BbA9A0',
  },
  INRX: {
    Sepolia:  '0x451a80dE07d5ab6140A5272dC6F62742FAcC6BaB',
    Ethereum: '0x51a5f24560547f587999c331788ac495d40d95ba',
    Polygon:  '0xd52280A15b30e5EdfFF858E7EC22266604358F26',
    'Polygon Amoy': '0xd52280A15b30e5EdfFF858E7EC22266604358F26',
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

// Hardcoded reliable public RPCs — used as primary when no Alchemy key, always as fallback
const RELIABLE_RPCS: Record<string, { url: string; chainId: number; name: string }> = {
  Sepolia:  { url: 'https://ethereum-sepolia-rpc.publicnode.com', chainId: 11155111, name: 'sepolia' },
  Ethereum: { url: 'https://ethereum.publicnode.com',             chainId: 1,        name: 'homestead' },
  Polygon:  { url: 'https://polygon-bor-rpc.publicnode.com',      chainId: 137,      name: 'matic' },
};

function makeProvider(network: string) {
  const netCfg = NETWORK_CONFIG[network] ?? NETWORK_CONFIG['Sepolia'];
  const reliable = RELIABLE_RPCS[network];
  // Always prefer the configured RPC_URL, but if it's missing or matches a known-dead URL, use publicnode
  const configuredUrl = RPC_URLS[network];
  const DEAD_URLS = ['https://rpc.sepolia.org', 'https://cloudflare-eth.com'];
  const rpcUrl = (!configuredUrl || DEAD_URLS.includes(configuredUrl))
    ? (reliable?.url ?? 'https://ethereum-sepolia-rpc.publicnode.com')
    : configuredUrl;
  return new StaticJsonRpcProvider(rpcUrl, { chainId: netCfg.chainId, name: netCfg.name });
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
      // Persist all dynamic/custom token balances (THB, AED, PKR, etc.)
      const KNOWN_KEYS = new Set(['ETH','USDT','USDC','INRX','BTC','SOL','BNB','XRP','TON','TRX','SUI','USDT_TRC20','USDC_TRC20','USDT_ERC20','USDC_ERC20']);
      Object.entries(balances).forEach(([key, val]) => {
        if (!KNOWN_KEYS.has(key) && typeof val === 'number' && val >= 0) {
          toSave[`${key}_${network}`] = val;
        }
      });
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
      const tronAddr = tronService.normalizeTronAddress(walletAddress);
      const tronBals = await tronService.getAllBalances(tronAddr, network);
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

  const provider = makeProvider(network);

  // Fetch active contracts on this network from Supabase
  let activeContracts: any[] = [];
  try {
    const { data } = await supabase
      .from('token_contracts')
      .select('*')
      .eq('network_name', network)
      .eq('is_enabled', true);
    if (data) {
      activeContracts = data;
    }
  } catch (err) {
    console.warn('[balanceService] Failed to query dynamic contracts:', err);
  }

  // Fetch native balance
  const nativePromise = provider.getBalance(walletAddress);

  // Always fetch INRX from hardcoded contract if not already in activeContracts
  const inrxContractAddr = TOKEN_CONTRACTS.INRX?.[network];
  const hasInrxInDynamic = activeContracts.some(c => c.currency_code === 'INRX');
  if (inrxContractAddr && !hasInrxInDynamic) {
    activeContracts = [
      ...activeContracts,
      { currency_code: 'INRX', contract_address: inrxContractAddr, decimals: TOKEN_DECIMALS.INRX ?? 6 }
    ];
  }

  // Fetch dynamic contract balances
  const contractPromises = activeContracts.map(async (c) => {
    const code = c.currency_code;
    const address = c.contract_address;
    const decimals = c.decimals || 18;
    if (address && address.startsWith('0x')) {
      try {
        const bal = await fetchERC20(provider, walletAddress, address, decimals);
        return { code, bal };
      } catch (err) {
        console.warn(`[balanceService] Error fetching balance for ${code}:`, err);
        return { code, bal: 0 };
      }
    } else {
      return { code, bal: 0 };
    }
  });

  const results = await Promise.allSettled([
    nativePromise,
    ...contractPromises
  ]);

  const nativeResult = results[0];
  const chainETH = nativeResult.status === 'fulfilled' ? parseFloat(formatEther(nativeResult.value)) : null;

  const chainBalances: Record<string, number> = {};
  results.slice(1).forEach((res, i) => {
    const c = activeContracts[i];
    if (res.status === 'fulfilled') {
      chainBalances[c.currency_code] = res.value.bal;
    } else {
      chainBalances[c.currency_code] = 0;
    }
  });

  // Load network-specific cached values
  const cachedETH = local[`ETH_${network}` as keyof WalletBalances] as number | undefined;
  const cachedUSDT = local[`USDT_ERC20_${network}` as any] as number | undefined;
  const cachedUSDC = local[`USDC_ERC20_${network}` as any] as number | undefined;
  const cachedINRX = local[`INRX_${network}` as any] as number | undefined;
  const resolvedETH = chainETH !== null ? chainETH : (cachedETH ?? 0);

  const balances: any = {
    USDT_ERC20: cachedUSDT ?? local.USDT_ERC20 ?? 0,
    USDC_ERC20: cachedUSDC ?? local.USDC_ERC20 ?? 0,
    USDT_TRC20: local.USDT_TRC20 ?? 0,
    USDC_TRC20: local.USDC_TRC20 ?? 0,
    USDT: cachedUSDT ?? local.USDT ?? 0,
    USDC: cachedUSDC ?? local.USDC ?? 0,
    ETH: resolvedETH,
    TRX: local.TRX ?? 0,
    BTC: local.BTC ?? 0,
    SOL: local.SOL ?? 0,
    BNB: local.BNB ?? 0,
    XRP: local.XRP ?? 0,
    TON: local.TON ?? 0,
    SUI: local.SUI ?? 0,
    INRX: cachedINRX ?? local.INRX ?? 0,
  };

  const isTestnet = network.toLowerCase().includes('sepolia') || 
                    network.toLowerCase().includes('testnet') || 
                    network.toLowerCase().includes('devnet') || 
                    network.toLowerCase().includes('nile') || 
                    network.toLowerCase().includes('amoy');

  // Merge the dynamic contract balances into the balances object
  activeContracts.forEach(c => {
    const code = c.currency_code;
    const chainVal = chainBalances[code];
    const cachedVal = (local[`${code}_${network}` as any] as number | undefined) ?? (local[code] ?? 0);
    
    if (isTestnet) {
      balances[code] = Math.max(chainVal ?? 0, cachedVal ?? 0);
    } else {
      balances[code] = chainVal !== undefined && chainVal !== null ? chainVal : (cachedVal ?? 0);
    }
  });

  // Map backward compatible fields
  if (chainBalances.USDC !== undefined) {
    const cachedUSDCVal = (local[`USDC_ERC20_${network}` as any] as number | undefined) ?? (local.USDC ?? 0);
    balances.USDC = isTestnet ? Math.max(chainBalances.USDC, cachedUSDCVal) : chainBalances.USDC;
    balances.USDC_ERC20 = balances.USDC;
  }
  if (chainBalances.USDT !== undefined) {
    const cachedUSDTVal = (local[`USDT_ERC20_${network}` as any] as number | undefined) ?? (local.USDT ?? 0);
    balances.USDT = isTestnet ? Math.max(chainBalances.USDT, cachedUSDTVal) : chainBalances.USDT;
    balances.USDT_ERC20 = balances.USDT;
  }
  if (chainBalances.INRX !== undefined) {
    const cachedINRXVal = (local[`INRX_${network}` as any] as number | undefined) ?? (local.INRX ?? 0);
    balances.INRX = isTestnet ? Math.max(chainBalances.INRX, cachedINRXVal) : chainBalances.INRX;
  }

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
  } catch (err: any) {
    console.error(`[balanceService] fetchERC20 failed for contract ${contractAddress}:`, err.message || err);
    return 0;
  }
}
