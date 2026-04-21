import { ethers } from 'ethers';

// 0x Protocol Swap API — no API key, no KYC, completely free
// Docs: https://docs.0x.org/0x-swap-api/api-references

const ZRX_API: Record<string, string> = {
  Ethereum: 'https://api.0x.org',
  Polygon:  'https://polygon.api.0x.org',
  Arbitrum: 'https://arbitrum.api.0x.org',
};

// Strict allowlist of permitted hostnames for swap API calls
const ALLOWED_SWAP_HOSTS = ['api.0x.org', 'polygon.api.0x.org', 'arbitrum.api.0x.org'];

function isSafeSwapUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ALLOWED_SWAP_HOSTS.some(h => parsed.hostname === h);
  } catch {
    return false;
  }
}

// Native ETH sentinel address used by 0x
const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// Token addresses per network
const TOKEN_ADDRESSES: Record<string, Record<string, string>> = {
  Ethereum: {
    ETH:  ETH_ADDRESS,
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    BTC:  '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  },
  Polygon: {
    ETH:  '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  },
  Arbitrum: {
    ETH:  ETH_ADDRESS,
    USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    USDC: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  },
};

const TOKEN_DECIMALS: Record<string, number> = {
  ETH:  18,
  USDT: 6,
  USDC: 6,
  BTC:  8,
};

const ERC20_APPROVE_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

export type SwapQuote = {
  toAmount: string;
  estimatedGas: string;
  rate: string;
};

export type SwapResult = {
  success: boolean;
  hash?: string;
  error?: string;
};

async function fetchWithTimeout(url: string, ms = 10000): Promise<Response> {
  // SSRF guard: only allow requests to known 0x API hosts
  if (!isSafeSwapUrl(url)) throw new Error(`Blocked unsafe swap URL: ${url}`);
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const ZRX_API_KEY = process.env.EXPO_PUBLIC_ZRX_API_KEY ?? '';
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (ZRX_API_KEY) headers['0x-api-key'] = ZRX_API_KEY;
    return await fetch(url, { signal: controller.signal, headers });
  } finally {
    clearTimeout(id);
  }
}

export const swapService = {
  isNetworkSupported(network: string): boolean {
    return !!ZRX_API[network];
  },

  async getQuote(
    fromSymbol: string,
    toSymbol: string,
    amount: string,
    network: string,
  ): Promise<SwapQuote | null> {
    const baseUrl   = ZRX_API[network];
    const tokens    = TOKEN_ADDRESSES[network];
    const fromToken = tokens?.[fromSymbol];
    const toToken   = tokens?.[toSymbol];
    if (!baseUrl || !fromToken || !toToken) return null;

    const fromDecimals = TOKEN_DECIMALS[fromSymbol] ?? 18;
    const toDecimals   = TOKEN_DECIMALS[toSymbol]   ?? 18;
    const amountWei    = ethers.utils.parseUnits(amount, fromDecimals).toString();

    try {
      const url = `${baseUrl}/swap/v1/price?sellToken=${fromToken}&buyToken=${toToken}&sellAmount=${amountWei}`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) return null;
      const data = await res.json();

      const toAmountHuman   = parseFloat(ethers.utils.formatUnits(data.buyAmount, toDecimals));
      const fromAmountHuman = parseFloat(amount);
      const rate            = fromAmountHuman > 0 ? (toAmountHuman / fromAmountHuman).toFixed(6) : '0';
      const gasEth          = ethers.utils.formatEther(
        ethers.BigNumber.from(data.estimatedGas ?? 200000)
          .mul(ethers.BigNumber.from(data.gasPrice ?? ethers.utils.parseUnits('20', 'gwei')))
      );

      return {
        toAmount:     toAmountHuman.toFixed(6),
        estimatedGas: parseFloat(gasEth).toFixed(6),
        rate,
      };
    } catch {
      return null;
    }
  },

  async executeSwap(
    fromSymbol: string,
    toSymbol: string,
    amount: string,
    walletAddress: string,
    privateKey: string,
    provider: ethers.providers.JsonRpcProvider,
    network: string,
    slippagePct: number = 1,
  ): Promise<SwapResult> {
    const baseUrl   = ZRX_API[network];
    const tokens    = TOKEN_ADDRESSES[network];
    const fromToken = tokens?.[fromSymbol];
    const toToken   = tokens?.[toSymbol];
    if (!baseUrl || !fromToken || !toToken)
      return { success: false, error: `${fromSymbol}→${toSymbol} not supported on ${network}` };

    const fromDecimals = TOKEN_DECIMALS[fromSymbol] ?? 18;
    const amountWei    = ethers.utils.parseUnits(amount, fromDecimals).toString();
    const slippage     = (slippagePct / 100).toFixed(4);

    try {
      const url = `${baseUrl}/swap/v1/quote?sellToken=${fromToken}&buyToken=${toToken}&sellAmount=${amountWei}&takerAddress=${walletAddress}&slippagePercentage=${slippage}`;
      const res = await fetchWithTimeout(url);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, error: (err as any)?.reason ?? `Quote failed (${res.status})` };
      }

      const quote  = await res.json();
      const wallet = new ethers.Wallet(privateKey, provider);

      if (fromToken !== ETH_ADDRESS && quote.allowanceTarget) {
        const token     = new ethers.Contract(fromToken, ERC20_APPROVE_ABI, wallet);
        const allowance: ethers.BigNumber = await token.allowance(walletAddress, quote.allowanceTarget);
        if (allowance.lt(ethers.BigNumber.from(amountWei))) {
          const approveTx = await token.approve(quote.allowanceTarget, ethers.constants.MaxUint256);
          await approveTx.wait(1);
        }
      }

      const tx = await wallet.sendTransaction({
        to:       quote.to,
        data:     quote.data,
        value:    ethers.BigNumber.from(quote.value ?? '0'),
        gasLimit: ethers.BigNumber.from(quote.estimatedGas ?? 300000),
        gasPrice: ethers.BigNumber.from(quote.gasPrice),
      });

      await tx.wait(1);
      return { success: true, hash: tx.hash };
    } catch (e: any) {
      const msg = e?.message ?? 'Swap failed';
      if (msg.includes('insufficient funds')) return { success: false, error: 'Insufficient funds for swap + gas' };
      if (msg.includes('user rejected'))      return { success: false, error: 'Transaction rejected' };
      return { success: false, error: msg };
    }
  },
};
