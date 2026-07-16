import { ethers } from 'ethers';
import { Platform } from 'react-native';
import AsyncStorageNative from '@react-native-async-storage/async-storage';
import { SUPPORTED_TOKENS as CONFIG_SUPPORTED_TOKENS } from '../constants/currencyConfig';

const AsyncStorage = Platform.OS === 'web'
  ? {
      getItem: async (k: string) => { try { return localStorage.getItem(k); } catch (e) { console.error('localStorage getItem failed', e); return null; } },
      setItem: async (k: string, v: string) => { try { localStorage.setItem(k, v); } catch (e) { console.error('localStorage setItem failed', e); } },
    }
  : AsyncStorageNative;

// ─── Constants ────────────────────────────────────────────────────────────────
const ETH_SENTINEL = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

const MAINNET_TOKENS: Record<string, Record<string, string>> = {
  Ethereum: {
    ETH:  ETH_SENTINEL,
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI:  '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    INRX: '0x51A5F24560547f587999c331788aC495D40d95ba',
  },
  Polygon: {
    ETH:  '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    DAI:  '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    INRX: '0xd52280A15b30e5EdfFF858E7EC22266604358F26',
  },
  Arbitrum: {
    ETH:  ETH_SENTINEL,
    USDC: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    DAI:  '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
  },
};

const SEPOLIA_TOKENS: Record<string, string> = {
  ETH:  ETH_SENTINEL,
  WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
  USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  USDT: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
  DAI:  '0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6',
  INRX: '0x51A5F24560547f587999c331788aC495D40d95ba',
  CUSTOM: '0x351028A22C876E0431b30921c0dD0a836a14899E',
};

const UNISWAP_ROUTER_SEPOLIA = '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48e';
const UNISWAP_QUOTER_SEPOLIA = '0xEd1f6473345F45b75833fd55D191EaA8D2C54Dd9';
const POOL_FEE = 3000;

const ZRX_APIS: Record<string, string> = {
  Ethereum: 'https://api.0x.org',
  Polygon:  'https://polygon.api.0x.org',
  Arbitrum: 'https://arbitrum.api.0x.org',
};

const ALLOWED_ZRX_HOSTS = ['api.0x.org', 'polygon.api.0x.org', 'arbitrum.api.0x.org'];

const COINGECKO_IDS: Record<string, string> = Object.fromEntries(
  Object.entries(CONFIG_SUPPORTED_TOKENS).map(([k, v]) => [k, v.coingeckoId])
);

// Hardcoded fallback prices so the app NEVER fails to show a quote
const FALLBACK_PRICES: Record<string, number> = {
  ETH: 3500, USDC: 1, USDT: 1, BTC: 65000, SOL: 150, BNB: 600, XRP: 0.50, TON: 7.5, TRX: 0.12, SUI: 1.80, INRX: 0.012 // 1 INRX = ₹1 ≈ $0.012 at ₹83.5/USD
};

export const SUPPORTED_TOKENS = Object.keys(CONFIG_SUPPORTED_TOKENS);

export const TOKEN_DECIMALS: Record<string, number> = Object.fromEntries(
  Object.entries(CONFIG_SUPPORTED_TOKENS).map(([k, v]) => [k, v.decimals])
);

// ─── Types ────────────────────────────────────────────────────────────────────
export type SwapQuote = {
  buyAmount:       string;
  sellAmount:      string;
  price:           string;
  estimatedGas:    string;
  isSimulated:     boolean;
  source:          '0x' | 'uniswap_v3' | 'coingecko' | 'cached';
  fromToken:       string;
  toToken:         string;
  slippage:        string;
  minimumReceived: string;
  toAmount:        string;
  rate:            string;
  allowanceTarget?: string;
  txData?:         any;
  needsApproval?:  boolean;
  usdValue?:       string;
};

export type SwapResult = {
  success:      boolean;
  hash?:        string;
  error?:       string;
  explorerUrl?: string;
};

// ─── ABIs ─────────────────────────────────────────────────────────────────────
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

const WETH_ABI = [
  'function deposit() payable',
  'function withdraw(uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

const ROUTER_ABI = [
  'function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)',
];

const QUOTER_ABI = [
  'function quoteExactInputSingle(address tokenIn,address tokenOut,uint24 fee,uint256 amountIn,uint160 sqrtPriceLimitX96) returns (uint256 amountOut)',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isSafeUrl(url: string, allowed: string[]): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && allowed.some(h => u.hostname === h);
  } catch { return false; }
}

export function parseSwapError(e: any): string {
  const msg: string = e?.reason ?? e?.message ?? 'Unknown error';
  if (msg.includes('insufficient funds'))   return 'Insufficient ETH for gas fees';
  if (msg.includes('INSUFFICIENT_OUTPUT'))  return 'Price moved too much. Try increasing slippage.';
  if (msg.includes('user rejected'))        return 'Transaction rejected';
  if (msg.includes('nonce'))                return 'Transaction conflict. Please try again.';
  if (msg.includes('gas'))                  return 'Gas estimation failed. Network may be congested.';
  if (msg.includes('No liquidity'))         return 'No liquidity for this pair on this network.';
  if (msg.includes('rate limit') || msg.includes('429')) return 'Too many requests. Wait 10 seconds.';
  if (msg.includes('timeout') || msg.includes('network')) return 'Network slow. Please try again.';
  return `Swap failed: ${msg.slice(0, 120)}`;
}

// Normalize decimal input — handle both '.' and ',' as decimal separator
function parseAmount(val: string): number {
  if (!val) return 0;
  const normalized = val.replace(',', '.');
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

// Build a simulated quote from prices (always succeeds)
function buildSimulatedQuote(
  from: string, to: string, amount: string,
  fromUsd: number, toUsd: number,
  source: 'coingecko' | 'cached'
): SwapQuote {
  const amt    = parseAmount(amount);
  const buyAmt = toUsd > 0 ? (amt * fromUsd) / toUsd : 0;
  const rate   = toUsd > 0 ? (fromUsd / toUsd) : 0;
  return {
    buyAmount:       buyAmt > 0 ? buyAmt.toFixed(6) : '0',
    sellAmount:      amount,
    price:           rate.toFixed(6),
    estimatedGas:    '0.002',
    isSimulated:     true,
    source,
    fromToken:       from,
    toToken:         to,
    slippage:        '1',
    minimumReceived: (buyAmt * 0.99).toFixed(6),
    toAmount:        buyAmt > 0 ? buyAmt.toFixed(6) : '0',
    rate:            rate.toFixed(6),
    usdValue:        (amt * fromUsd).toFixed(2),
  };
}

const SUNSWAP_ROUTER = 'TKzxdSv2FZKQrEqkKVgp5DcwEXBEKMg2Ax'; // SunSwap V2 Router mainnet
const SUNSWAP_API = 'https://rot.endjgfsv.link/swap/router'; // SunSwap routing API
const ALLOWED_SUNSWAP_HOSTS = ['rot.endjgfsv.link'];

const TRON_TOKEN_ADDRESSES: Record<string, Record<string, string>> = {
  TRON: {
    TRX:  'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb', // wrapped TRX (WTRX) for routing
    USDT: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    USDC: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
  },
};

async function trySunSwapQuote(
  from: string, to: string, amount: string, network: string
): Promise<SwapQuote | null> {
  if (network !== 'TRON') return null;
  const tokens = TRON_TOKEN_ADDRESSES.TRON;
  if (!tokens[from] || !tokens[to]) return null;
  try {
    const fromDecimals = from === 'TRX' ? 6 : (TOKEN_DECIMALS[from] ?? 6);
    const toDecimals   = to   === 'TRX' ? 6 : (TOKEN_DECIMALS[to]   ?? 6);
    const amountSun    = Math.floor(parseFloat(amount) * Math.pow(10, fromDecimals)).toString();
    const url = `${SUNSWAP_API}?fromToken=${tokens[from]}&toToken=${tokens[to]}&amountIn=${amountSun}&typeList=PSM,CURVE,WTRX`;
    if (!isSafeUrl(url, ALLOWED_SUNSWAP_HOSTS)) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal }).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.amountOut) return null;
    const buyAmt = parseFloat(data.amountOut) / Math.pow(10, toDecimals);
    const rate   = buyAmt / parseFloat(amount);
    return {
      buyAmount:       buyAmt.toFixed(6),
      sellAmount:      amount,
      price:           rate.toFixed(6),
      estimatedGas:    '1',  // ~1 TRX bandwidth fee
      isSimulated:     false,
      source:          '0x' as const, // reuse type
      fromToken:       from,
      toToken:         to,
      slippage:        '1',
      minimumReceived: (buyAmt * 0.99).toFixed(6),
      toAmount:        buyAmt.toFixed(6),
      rate:            rate.toFixed(6),
      txData:          data, // store full routing data for execution
    };
  } catch {
    return null;
  }
}

async function try0xQuote(
  from: string, to: string, amount: string, network: string, walletAddress?: string
): Promise<SwapQuote | null> {
  const base   = ZRX_APIS[network];
  const tokens = MAINNET_TOKENS[network];
  if (!base || !tokens?.[from] || !tokens?.[to]) return null;

  try {
    const sellAmountWei = ethers.utils.parseUnits(amount, TOKEN_DECIMALS[from] ?? 18).toString();
    const chainId = network === 'Ethereum' ? '1' : network === 'Polygon' ? '137' : '42161';
    // Include taker address if available — required for accurate quotes on 0x v2
    const takerParam = walletAddress ? `&taker=${walletAddress}` : '';
    const url = `${base}/swap/permit2/price?chainId=${chainId}&sellToken=${tokens[from]}&buyToken=${tokens[to]}&sellAmount=${sellAmountWei}${takerParam}`;
    if (!isSafeUrl(url, ALLOWED_ZRX_HOSTS)) return null;

    const headers: Record<string, string> = { 'Accept': 'application/json', '0x-version': 'v2' };
    const apiKey = process.env.EXPO_PUBLIC_ZRX_API_KEY;
    if (apiKey) headers['0x-api-key'] = apiKey;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { headers, signal: controller.signal }).finally(() => clearTimeout(timer));
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({})) as any;
      console.error('[0x price] failed', res.status, errBody?.reason ?? errBody?.message ?? errBody);
      return null;
    }
    const data = await res.json();
    if (!data.buyAmount) {
      console.error('[0x price] no buyAmount in response', data);
      return null;
    }

    const buyAmt = parseFloat(ethers.utils.formatUnits(data.buyAmount, TOKEN_DECIMALS[to] ?? 18));
    const gasEth = data.totalNetworkFee
      ? parseFloat(ethers.utils.formatEther(data.totalNetworkFee)).toFixed(6)
      : '0.003';
    const rate = buyAmt / parseFloat(amount);

    return {
      buyAmount:       buyAmt.toFixed(6),
      sellAmount:      amount,
      price:           rate.toFixed(6),
      estimatedGas:    gasEth,
      isSimulated:     false,
      source:          '0x',
      fromToken:       from,
      toToken:         to,
      slippage:        '1',
      minimumReceived: (buyAmt * 0.99).toFixed(6),
      toAmount:        buyAmt.toFixed(6),
      rate:            rate.toFixed(6),
      allowanceTarget: data.issues?.allowance?.spender,
      needsApproval:   from !== 'ETH' && !!data.issues?.allowance,
    };
  } catch (e: any) {
    console.error('[0x price] exception', e?.message ?? e);
    return null;
  }
}

// ─── Layer 2: Uniswap V3 Quoter on Sepolia ────────────────────────────────────
async function tryUniswapSepoliaQuote(
  from: string, to: string, amount: string, rpcUrl: string
): Promise<SwapQuote | null> {
  if (!SEPOLIA_TOKENS[from] || !SEPOLIA_TOKENS[to]) return null;
  try {
    const provider  = new ethers.providers.JsonRpcProvider(rpcUrl);
    const quoter    = new ethers.Contract(UNISWAP_QUOTER_SEPOLIA, QUOTER_ABI, provider);
    const tokenIn   = from === 'ETH' ? SEPOLIA_TOKENS.WETH : SEPOLIA_TOKENS[from];
    const tokenOut  = to   === 'ETH' ? SEPOLIA_TOKENS.WETH : SEPOLIA_TOKENS[to];
    const amtIn     = ethers.utils.parseUnits(amount, TOKEN_DECIMALS[from] ?? 18);
    // Hard 6s timeout — Sepolia RPC can be slow
    const quoteMethod = quoter.quoteExactInputSingle.staticCall 
      ? quoter.quoteExactInputSingle.staticCall(tokenIn, tokenOut, POOL_FEE, amtIn, 0)
      : quoter.callStatic.quoteExactInputSingle(tokenIn, tokenOut, POOL_FEE, amtIn, 0);

    const amtOut: bigint = await Promise.race([
      quoteMethod,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000)),
    ]);
    const buyAmt = parseFloat(ethers.utils.formatUnits(amtOut, TOKEN_DECIMALS[to] ?? 18));
    const rate   = buyAmt / parseFloat(amount);
    return {
      buyAmount:       buyAmt.toFixed(6),
      sellAmount:      amount,
      price:           rate.toFixed(6),
      estimatedGas:    '0.001',
      isSimulated:     false,
      source:          'uniswap_v3',
      fromToken:       from,
      toToken:         to,
      slippage:        '1',
      minimumReceived: (buyAmt * 0.99).toFixed(6),
      toAmount:        buyAmt.toFixed(6),
      rate:            rate.toFixed(6),
      allowanceTarget: UNISWAP_ROUTER_SEPOLIA,
      needsApproval:   from !== 'ETH',
    };
  } catch (e) { console.error('Uniswap quote exception', e); return null; }
}

// ─── Layer 3: CoinGecko ───────────────────────────────────────────────────────
async function tryCoinGeckoQuote(from: string, to: string, amount: string): Promise<SwapQuote | null> {
  const fromId = COINGECKO_IDS[from];
  const toId   = COINGECKO_IDS[to];
  if (!fromId || !toId) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${fromId},${toId}&vs_currencies=usd`,
      { headers: { 'Accept': 'application/json' }, signal: controller.signal }
    ).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    const data = await res.json();
    const fromUsd = data[fromId]?.usd;
    const toUsd   = data[toId]?.usd;
    if (!fromUsd || !toUsd) return null;
    // Merge into existing cache so all token prices accumulate
    try {
      const existing = await AsyncStorage.getItem('cw_price_cache');
      const prev = existing ? JSON.parse(existing) : {};
      await AsyncStorage.setItem('cw_price_cache', JSON.stringify({ ...prev, [from]: fromUsd, [to]: toUsd, ts: Date.now() }));
    } catch (e) { console.error('Failed to save prices', e); }
    return buildSimulatedQuote(from, to, amount, fromUsd, toUsd, 'coingecko');
  } catch (e) { console.error('CoinGecko quote exception', e); return null; }
}

// ─── Layer 4: Cached / hardcoded (NEVER fails) ───────────────────────────────
async function tryCachedQuote(from: string, to: string, amount: string): Promise<SwapQuote> {
  let fromUsd = FALLBACK_PRICES[from] ?? 1;
  let toUsd   = FALLBACK_PRICES[to]   ?? 1;
  try {
    const raw = await AsyncStorage.getItem('cw_price_cache');
    if (raw) {
      const cached = JSON.parse(raw);
      // Cache stores individual token prices keyed by symbol
      if (cached[from] && cached[from] > 0) fromUsd = cached[from];
      if (cached[to]   && cached[to]   > 0) toUsd   = cached[to];
    }
  } catch (e) { console.error('Failed to get cached prices', e); }
  return buildSimulatedQuote(from, to, amount, fromUsd, toUsd, 'cached');
}

// ─── Public: getSwapQuote — ALWAYS returns a quote, never throws ──────────────
export async function getSwapQuote(
  from: string, to: string, amount: string,
  network: string, rpcUrl?: string, walletAddress?: string
): Promise<SwapQuote> {
  const normalizedAmount = amount ? amount.replace(',', '.') : '0';
  if (!normalizedAmount || parseAmount(normalizedAmount) <= 0) return tryCachedQuote(from, to, '0');

  // TRON: try SunSwap first, fall back to simulated
  if (network === 'TRON' || network === 'TRON Nile') {
    if (network === 'TRON') {
      const q = await trySunSwapQuote(from, to, normalizedAmount, network);
      if (q) return q;
    }
    const cg = await tryCoinGeckoQuote(from, to, normalizedAmount);
    if (cg) return cg;
    return tryCachedQuote(from, to, normalizedAmount);
  }

  // Mainnet: try 0x first, fall back to simulated
  if (network !== 'Sepolia') {
    const q = await try0xQuote(from, to, normalizedAmount, network, walletAddress);
    if (q) return q;
    const cg = await tryCoinGeckoQuote(from, to, normalizedAmount);
    if (cg) return cg;
    return tryCachedQuote(from, to, normalizedAmount);
  }

  // Sepolia: try Uniswap V3, fall back to simulated
  if (rpcUrl) {
    const q = await tryUniswapSepoliaQuote(from, to, normalizedAmount, rpcUrl);
    if (q) return q;
  }
  const cg = await tryCoinGeckoQuote(from, to, normalizedAmount);
  if (cg) return cg;
  return tryCachedQuote(from, to, normalizedAmount);
}

// ─── Execute 0x swap (mainnet) ────────────────────────────────────────────────
async function _execute0x(
  quote: SwapQuote, wallet: ethers.Wallet, network: string,
  onStatus?: (msg: string) => void
): Promise<SwapResult> {
  const base   = ZRX_APIS[network];
  const tokens = MAINNET_TOKENS[network];
  if (!base || !tokens) return { success: false, error: `0x not supported on ${network}` };

  onStatus?.('Fetching executable quote...');
  const sellAmt = ethers.utils.parseUnits(quote.sellAmount, TOKEN_DECIMALS[quote.fromToken] ?? 18).toString();
  const chainId = network === 'Ethereum' ? '1' : network === 'Polygon' ? '137' : '42161';
  const url = `${base}/swap/permit2/quote?chainId=${chainId}&sellToken=${tokens[quote.fromToken]}&buyToken=${tokens[quote.toToken]}&sellAmount=${sellAmt}&taker=${wallet.address}&slippageBps=100`;
  if (!isSafeUrl(url, ALLOWED_ZRX_HOSTS)) return { success: false, error: 'Blocked unsafe URL' };

  const headers: Record<string, string> = { 'Accept': 'application/json', '0x-version': 'v2' };
  const apiKey = process.env.EXPO_PUBLIC_ZRX_API_KEY;
  if (apiKey) headers['0x-api-key'] = apiKey;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any;
    return { success: false, error: err?.reason ?? err?.message ?? `Quote failed (${res.status})` };
  }
  const data = await res.json();

  if (data.issues?.balance) {
    const needed = ethers.utils.formatUnits(data.issues.balance.expected, TOKEN_DECIMALS[quote.fromToken] ?? 18);
    return { success: false, error: `Insufficient balance. Need ${parseFloat(needed).toFixed(6)} ${quote.fromToken}.` };
  }

  if (quote.fromToken !== 'ETH' && data.issues?.allowance?.spender) {
    onStatus?.(`Approving ${quote.fromToken}...`);
    const token = new ethers.Contract(tokens[quote.fromToken], ERC20_ABI, wallet);
    const allowance: ethers.BigNumber = await token.allowance(wallet.address, data.issues.allowance.spender);
    if (allowance.lt(sellAmt)) {
      const approveTx = await token.approve(data.issues.allowance.spender, ethers.constants.MaxUint256);
      onStatus?.('Waiting for approval...');
      await approveTx.wait(2);
    }
  }

   onStatus?.('Broadcasting swap...');
   
   // Safely convert transaction fields to BigInt
   const toStringValue = (val: any): string => {
     if (typeof val === 'string') return val;
     if (typeof val === 'number') return val.toString();
     if (typeof val === 'bigint') return val.toString();
     if (val && typeof val === 'object' && '_hex' in val) return val._hex; // ethers.js BigNumber
     return '0';
   };
   
   const txReq: any = {
     to:       data.transaction.to,
     data:     data.transaction.data,
     value:    BigInt(toStringValue(data.transaction.value) || '0'),
     gasLimit: BigInt(toStringValue(data.transaction.gas) || '400000'),
   };
   if (data.transaction.gasPrice) txReq.gasPrice = BigInt(toStringValue(data.transaction.gasPrice));

  const tx      = await wallet.sendTransaction(txReq);
  onStatus?.(`Submitted! ${tx.hash.slice(0, 12)}...`);
  const receipt = await tx.wait(2);
  onStatus?.('Swap complete!');
  return { success: true, hash: receipt!.transactionHash, explorerUrl: `https://etherscan.io/tx/${receipt!.transactionHash}` };
}

// ─── Execute Uniswap V3 swap (Sepolia) ───────────────────────────────────────
async function _executeUniswapSepolia(
  quote: SwapQuote, wallet: ethers.Wallet,
  onStatus?: (msg: string) => void
): Promise<SwapResult> {
  const isFromETH = quote.fromToken === 'ETH';
  const isToETH   = quote.toToken   === 'ETH';
  const tokenIn   = isFromETH ? SEPOLIA_TOKENS.WETH : SEPOLIA_TOKENS[quote.fromToken];
  const tokenOut  = isToETH   ? SEPOLIA_TOKENS.WETH : SEPOLIA_TOKENS[quote.toToken];
  if (!tokenIn || !tokenOut) return { success: false, error: `Token not supported on Sepolia` };

  const amtIn  = ethers.utils.parseUnits(quote.sellAmount, TOKEN_DECIMALS[quote.fromToken] ?? 18);
  const minOut = ethers.utils.parseUnits(quote.minimumReceived, TOKEN_DECIMALS[quote.toToken] ?? 18);

  if (isFromETH) {
    onStatus?.('Wrapping ETH → WETH...');
    const weth = new ethers.Contract(SEPOLIA_TOKENS.WETH, WETH_ABI, wallet);
    await (await weth.deposit({ value: amtIn })).wait(2);
  }

  onStatus?.('Approving Uniswap router...');
  const tokenContract = new ethers.Contract(tokenIn, ERC20_ABI, wallet);
  const allowance: ethers.BigNumber = await tokenContract.allowance(wallet.address, UNISWAP_ROUTER_SEPOLIA);
  if (allowance.lt(amtIn)) {
    await (await tokenContract.approve(UNISWAP_ROUTER_SEPOLIA, ethers.constants.MaxUint256)).wait(2);
  }

  onStatus?.('Executing Uniswap V3 swap...');
  const router = new ethers.Contract(UNISWAP_ROUTER_SEPOLIA, ROUTER_ABI, wallet);
  const swapTx = await router.exactInputSingle(
    { tokenIn, tokenOut, fee: POOL_FEE, recipient: wallet.address, amountIn: amtIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0 },
    { gasLimit: 400000 }
  );
  onStatus?.(`Submitted! ${swapTx.hash.slice(0, 12)}...`);
  const receipt = await swapTx.wait(2);

  if (isToETH) {
    onStatus?.('Unwrapping WETH → ETH...');
    const weth = new ethers.Contract(SEPOLIA_TOKENS.WETH, WETH_ABI, wallet);
    const bal: ethers.BigNumber = await weth.balanceOf(wallet.address);
    if (bal.gt(0)) await (await weth.withdraw(bal)).wait(2);
  }

  onStatus?.('Swap complete!');
  return { success: true, hash: receipt!.transactionHash, explorerUrl: `https://sepolia.etherscan.io/tx/${receipt!.transactionHash}` };
}

// ─── Execute SunSwap swap (TRON mainnet) ────────────────────────────────────
async function _executeSunSwap(
  quote: SwapQuote, privateKey: string, walletAddress: string,
  onStatus?: (msg: string) => void
): Promise<SwapResult> {
  try {
    const { tronService, tronAddressToHex } = await import('./tronService');
    const base     = tronService.getBaseUrl('TRON');
    const tokens   = TRON_TOKEN_ADDRESSES.TRON;
    const fromDec  = quote.fromToken === 'TRX' ? 6 : (TOKEN_DECIMALS[quote.fromToken] ?? 6);
    const toDec    = quote.toToken   === 'TRX' ? 6 : (TOKEN_DECIMALS[quote.toToken]   ?? 6);
    const amtIn    = Math.floor(parseFloat(quote.sellAmount)      * Math.pow(10, fromDec));
    const minOut   = Math.floor(parseFloat(quote.minimumReceived) * Math.pow(10, toDec));
    const ownerHex = tronAddressToHex(walletAddress);
    const deadline = Math.floor(Date.now() / 1000) + 300;
    const isTRXIn  = quote.fromToken === 'TRX';

    // TRC20 → approve router first
    if (!isTRXIn) {
      onStatus?.(`Approving ${quote.fromToken}...`);
      const approveRes = await fetch(`${base}/wallet/triggersmartcontract`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_address:     ownerHex,
          contract_address:  tronAddressToHex(tokens[quote.fromToken]),
          function_selector: 'approve(address,uint256)',
          parameter:         tronAddressToHex(SUNSWAP_ROUTER).slice(2).padStart(64, '0') + 'f'.repeat(64),
          fee_limit:         100_000_000,
        }),
      });
      const approveTxData = await approveRes.json();
      if (approveTxData?.transaction) {
        const signedApprove = _signTron(approveTxData.transaction, privateKey);
        await fetch(`${base}/wallet/broadcasttransaction`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(signedApprove),
        });
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    onStatus?.('Broadcasting swap...');
    const path    = [tokens[quote.fromToken], tokens[quote.toToken]];
    const selector = isTRXIn
      ? 'swapExactTRXForTokens(uint256,address[],address,uint256)'
      : 'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)';
    const pad = (n: number | bigint, len = 64) => BigInt(n).toString(16).padStart(len, '0');
    const pathOffset = (isTRXIn ? 3 : 4) * 32;
    const params: string[] = [];
    if (!isTRXIn) params.push(pad(amtIn));
    params.push(pad(minOut));
    params.push(pad(pathOffset));
    params.push(tronAddressToHex(walletAddress).slice(2).padStart(64, '0'));
    params.push(pad(deadline));
    params.push(pad(path.length));
    for (const addr of path) params.push(tronAddressToHex(addr).slice(2).padStart(64, '0'));

    const swapRes = await fetch(`${base}/wallet/triggersmartcontract`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner_address:     ownerHex,
        contract_address:  tronAddressToHex(SUNSWAP_ROUTER),
        function_selector: selector,
        call_value:        isTRXIn ? amtIn : 0,
        parameter:         params.join(''),
        fee_limit:         100_000_000,
      }),
    });
    const swapTxData = await swapRes.json();
    if (!swapTxData?.transaction) throw new Error(swapTxData?.result?.message ?? 'Failed to build swap tx');

    const signed = _signTron(swapTxData.transaction, privateKey);
    const broadcastRes = await fetch(`${base}/wallet/broadcasttransaction`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signed),
    });
    const broadcastResult = await broadcastRes.json();
    if (!broadcastResult.result) throw new Error(broadcastResult.message ?? 'Broadcast failed');

    onStatus?.('Swap complete!');
    return { success: true, hash: swapTxData.transaction.txID, explorerUrl: `https://tronscan.org/#/transaction/${swapTxData.transaction.txID}` };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'SunSwap failed' };
  }
}

function _signTron(tx: any, privateKey: string): any {
  const wallet     = new ethers.Wallet(privateKey);
  const msgBytes   = Uint8Array.from(Buffer.from(tx.txID, 'hex'));
  const signingKey = typeof (wallet as any)._signingKey === 'function'
    ? (wallet as any)._signingKey()
    : (wallet as any).signingKey;
  const sig = signingKey.signDigest ? signingKey.signDigest(msgBytes) : signingKey.sign(msgBytes);
  const r = sig.r.slice(2).padStart(64, '0');
  const s = sig.s.slice(2).padStart(64, '0');
  const v = sig.v === 27 ? '00' : '01';
  return { ...tx, signature: [r + s + v] };
}

// ─── Execute simulated swap ───────────────────────────────────────────────────
async function _executeSimulated(
  quote: SwapQuote, onStatus?: (msg: string) => void
): Promise<SwapResult> {
  onStatus?.('Processing swap...');
  await new Promise(r => setTimeout(r, 1200));
  const fakeHash = '0xSIM' + Date.now().toString(16).padStart(60, '0');
  onStatus?.('Swap complete!');
  return { success: true, hash: fakeHash };
}

// ─── Save history ─────────────────────────────────────────────────────────────
async function _saveSwapHistory(data: SwapQuote & { txHash: string; isSimulated: boolean }) {
  try {
    const raw = await AsyncStorage.getItem('swap_transactions');
    let history: any[] = [];
    try { history = raw ? JSON.parse(raw) : []; } catch (e) { console.error('Failed to parse swap_transactions', e); history = []; }
    history.unshift({
      id:         Date.now().toString(),
      type:       'swap',
      fromToken:  data.fromToken,
      toToken:    data.toToken,
      fromAmount: data.sellAmount,
      toAmount:   data.buyAmount,
      usdValue:   data.usdValue ?? '0',
      source:     data.isSimulated ? 'simulated' : data.source,
      status:     'completed',
      txHash:     data.txHash,
      date:       new Date().toISOString(),
    });
    await AsyncStorage.setItem('swap_transactions', JSON.stringify(history.slice(0, 100)));
  } catch (e) { console.error('Failed to save swap_transactions', e); }
}

export const saveSwapToHistory = _saveSwapHistory;

// ─── Public: executeSwap ──────────────────────────────────────────────────────
export async function executeSwap(
  quote: SwapQuote, privateKey: string, rpcUrl: string,
  walletAddress: string, network: string,
  onStatus?: (msg: string) => void
): Promise<SwapResult> {
  // Hard 60s global timeout — prevents infinite loading
  const timeoutPromise = new Promise<SwapResult>((_, rej) =>
    setTimeout(() => rej(new Error('Swap timed out. Network may be congested. Please try again.')), 60000)
  );
  return Promise.race([_doExecuteSwap(quote, privateKey, rpcUrl, walletAddress, network, onStatus), timeoutPromise]);
}

async function _doExecuteSwap(
  quote: SwapQuote, privateKey: string, rpcUrl: string,
  walletAddress: string, network: string,
  onStatus?: (msg: string) => void
): Promise<SwapResult> {
  try {
    // TRON mainnet: use SunSwap
    if (network === 'TRON' && !quote.isSimulated) {
      const result = await _executeSunSwap(quote, privateKey, walletAddress, onStatus);
      if (result.success && result.hash) await _saveSwapHistory({ ...quote, txHash: result.hash, isSimulated: false });
      return result;
    }

    // MAINNET SAFETY: Block simulated swaps on real mainnet only
    const isRealMainnet = network === 'Ethereum' || network === 'Polygon' || network === 'Arbitrum' || network === 'TRON';
    if (quote.isSimulated && isRealMainnet) {
      return { success: false, error: 'Live quote required for mainnet swaps. Please wait for a real quote or try again.' };
    }

    // Simulated quote → simulated execution (Sepolia only)
    if (quote.isSimulated) {
      const result = await _executeSimulated(quote, onStatus);
      if (result.success) await _saveSwapHistory({ ...quote, txHash: result.hash!, isSimulated: true });
      return result;
    }

    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const wallet   = new ethers.Wallet(privateKey, provider);

    let result: SwapResult;
    if (quote.source === '0x') {
      result = await _execute0x(quote, wallet, network, onStatus);
    } else if (quote.source === 'uniswap_v3') {
      result = await _executeUniswapSepolia(quote, wallet, onStatus);
    } else {
      // coingecko/cached with isSimulated=false shouldn't happen, but handle it
      result = await _executeSimulated(quote, onStatus);
    }

    if (result.success && result.hash) {
      await _saveSwapHistory({ ...quote, txHash: result.hash, isSimulated: false });
    }
    return result;
  } catch (e: any) {
    return { success: false, error: parseSwapError(e) };
  }
}

// ─── Shim ─────────────────────────────────────────────────────────────────────
export const swapService = {
  isNetworkSupported: (network: string) =>
    network === 'Sepolia' || network === 'TRON' || network === 'TRON Nile' || network === 'Solana' || network === 'Solana Devnet' || !!ZRX_APIS[network],
  getQuote: (from: string, to: string, amount: string, network: string, rpcUrl?: string, walletAddress?: string) =>
    getSwapQuote(from, to, amount, network, rpcUrl, walletAddress),
  executeSwap: (quote: SwapQuote, privateKey: string, rpcUrl: string, walletAddress: string, network: string, onStatus?: (msg: string) => void) =>
    executeSwap(quote, privateKey, rpcUrl, walletAddress, network, onStatus),
};
