import { ethers } from 'ethers';
import { Platform } from 'react-native';

let AsyncStorage: any;
if (Platform.OS === 'web') {
  AsyncStorage = {
    getItem: async (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
    setItem: async (k: string, v: string) => { try { localStorage.setItem(k, v); } catch (_e) {} },
  };
} else {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ETH_SENTINEL = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

const MAINNET_TOKENS: Record<string, Record<string, string>> = {
  Ethereum: {
    ETH:  ETH_SENTINEL,
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI:  '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  },
  Polygon: {
    ETH:  '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    DAI:  '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
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
  CUSTOM: '0x351028A22C876E0431b30921c0dD0a836a14899E',
};

const UNISWAP_ROUTER_SEPOLIA = '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48e';
const UNISWAP_QUOTER_SEPOLIA = '0xEd1f6473345F45b75833fd55D191EaA8D2C54Dd';
const POOL_FEE = 3000;

const ZRX_APIS: Record<string, string> = {
  Ethereum: 'https://api.0x.org',
  Polygon:  'https://polygon.api.0x.org',
  Arbitrum: 'https://arbitrum.api.0x.org',
};

const ALLOWED_ZRX_HOSTS = ['api.0x.org', 'polygon.api.0x.org', 'arbitrum.api.0x.org'];

const COINGECKO_IDS: Record<string, string> = {
  ETH: 'ethereum', USDC: 'usd-coin', USDT: 'tether', DAI: 'dai',
};

// Hardcoded fallback prices so the app NEVER fails to show a quote
const FALLBACK_PRICES: Record<string, number> = {
  ETH: 3500, USDC: 1, USDT: 1, DAI: 1, CUSTOM: 0.1,
};

export const SUPPORTED_TOKENS = ['ETH', 'USDC', 'USDT', 'DAI', 'CUSTOM'];

export const TOKEN_DECIMALS: Record<string, number> = {
  ETH: 18, WETH: 18, DAI: 18, USDC: 6, USDT: 6, CUSTOM: 18,
};

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

// ─── Layer 1: 0x API v2 (mainnet) ────────────────────────────────────────────
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

    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.buyAmount) return null;

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
  } catch { return null; }
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
    const amtOut: ethers.BigNumber = await quoter.callStatic.quoteExactInputSingle(
      tokenIn, tokenOut, POOL_FEE, amtIn, 0
    );
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
  } catch { return null; }
}

// ─── Layer 3: CoinGecko ───────────────────────────────────────────────────────
async function tryCoinGeckoQuote(from: string, to: string, amount: string): Promise<SwapQuote | null> {
  const fromId = COINGECKO_IDS[from];
  const toId   = COINGECKO_IDS[to];
  if (!fromId || !toId) return null;
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${fromId},${toId}&vs_currencies=usd`,
      { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(5000) }
    );
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
    } catch (_e) {}
    return buildSimulatedQuote(from, to, amount, fromUsd, toUsd, 'coingecko');
  } catch { return null; }
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
  } catch (_e) {}
  return buildSimulatedQuote(from, to, amount, fromUsd, toUsd, 'cached');
}

// ─── Public: getSwapQuote — ALWAYS returns a quote, never throws ──────────────
export async function getSwapQuote(
  from: string, to: string, amount: string,
  network: string, rpcUrl?: string, walletAddress?: string
): Promise<SwapQuote> {
  const normalizedAmount = amount ? amount.replace(',', '.') : '0';
  if (!normalizedAmount || parseAmount(normalizedAmount) <= 0) return tryCachedQuote(from, to, '0');

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
      await approveTx.wait();
    }
  }

  onStatus?.('Broadcasting swap...');
  const txReq: any = {
    to:       data.transaction.to,
    data:     data.transaction.data,
    value:    ethers.BigNumber.from(data.transaction.value ?? '0'),
    gasLimit: ethers.BigNumber.from(data.transaction.gas ?? '400000'),
  };
  if (data.transaction.gasPrice) txReq.gasPrice = ethers.BigNumber.from(data.transaction.gasPrice);

  const tx      = await wallet.sendTransaction(txReq);
  onStatus?.(`Submitted! ${tx.hash.slice(0, 12)}...`);
  const receipt = await tx.wait();
  onStatus?.('Swap complete!');
  return { success: true, hash: receipt.transactionHash, explorerUrl: `https://etherscan.io/tx/${receipt.transactionHash}` };
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
    await (await weth.deposit({ value: amtIn })).wait();
  }

  onStatus?.('Approving Uniswap router...');
  const tokenContract = new ethers.Contract(tokenIn, ERC20_ABI, wallet);
  const allowance: ethers.BigNumber = await tokenContract.allowance(wallet.address, UNISWAP_ROUTER_SEPOLIA);
  if (allowance.lt(amtIn)) {
    await (await tokenContract.approve(UNISWAP_ROUTER_SEPOLIA, ethers.constants.MaxUint256)).wait();
  }

  onStatus?.('Executing Uniswap V3 swap...');
  const router = new ethers.Contract(UNISWAP_ROUTER_SEPOLIA, ROUTER_ABI, wallet);
  const swapTx = await router.exactInputSingle(
    { tokenIn, tokenOut, fee: POOL_FEE, recipient: wallet.address, amountIn: amtIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0 },
    { gasLimit: 400000 }
  );
  onStatus?.(`Submitted! ${swapTx.hash.slice(0, 12)}...`);
  const receipt = await swapTx.wait();

  if (isToETH) {
    onStatus?.('Unwrapping WETH → ETH...');
    const weth = new ethers.Contract(SEPOLIA_TOKENS.WETH, WETH_ABI, wallet);
    const bal: ethers.BigNumber = await weth.balanceOf(wallet.address);
    if (bal.gt(0)) await (await weth.withdraw(bal)).wait();
  }

  onStatus?.('Swap complete!');
  return { success: true, hash: receipt.transactionHash, explorerUrl: `https://sepolia.etherscan.io/tx/${receipt.transactionHash}` };
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
    try { history = raw ? JSON.parse(raw) : []; } catch (_e) {}
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
  } catch (_e) {}
}

export const saveSwapToHistory = _saveSwapHistory;

// ─── Public: executeSwap ──────────────────────────────────────────────────────
export async function executeSwap(
  quote: SwapQuote, privateKey: string, rpcUrl: string,
  walletAddress: string, network: string,
  onStatus?: (msg: string) => void
): Promise<SwapResult> {
  try {
    // MAINNET SAFETY: Block simulated swaps on real mainnet only
    const isRealMainnet = network === 'Ethereum' || network === 'Polygon' || network === 'Arbitrum';
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
  isNetworkSupported: (network: string) => network === 'Sepolia' || !!ZRX_APIS[network],
  getQuote: (from: string, to: string, amount: string, network: string, rpcUrl?: string, walletAddress?: string) =>
    getSwapQuote(from, to, amount, network, rpcUrl, walletAddress),
  executeSwap: (quote: SwapQuote, privateKey: string, rpcUrl: string, walletAddress: string, network: string, onStatus?: (msg: string) => void) =>
    executeSwap(quote, privateKey, rpcUrl, walletAddress, network, onStatus),
};
