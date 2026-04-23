// Etherscan V2 — single endpoint, network selected via chainid
const V2_BASE = 'https://api.etherscan.io/v2/api';

const CHAIN_ID: Record<string, string> = {
  Ethereum: '1',
  Sepolia:  '11155111',
  Polygon:  '137',
  Arbitrum: '42161',
};

const EXPLORER_KEY = process.env.EXPO_PUBLIC_ETHERSCAN_KEY ?? '';

export type ChainTx = {
  hash:        string;
  from:        string;
  to:          string;
  value:       string;   // in wei
  timeStamp:   string;   // unix seconds
  isError:     string;   // '0' = success, '1' = failed
  txreceipt_status: string;
  gasUsed:     string;
  gasPrice:    string;
  blockNumber: string;
};

export type TokenTx = ChainTx & {
  contractAddress: string;
  tokenName:       string;
  tokenSymbol:     string;
  tokenDecimal:    string;
  nonce:           string;
};

export const etherscanService = {
  async fetchTransactions(address: string, network: string): Promise<ChainTx[]> {
    const chainId = CHAIN_ID[network];
    if (!chainId || !address) return [];

    const params = new URLSearchParams({
      chainid:    chainId,
      module:     'account',
      action:     'txlist',
      address,
      startblock: '0',
      endblock:   '99999999',
      page:       '1',
      offset:     '50',
      sort:       'desc',
      ...(EXPLORER_KEY ? { apikey: EXPLORER_KEY } : {}),
    });

    const res = await fetch(`${V2_BASE}?${params}`, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('HTTP error');

    const data = await res.json();
    if (data.status !== '1') {
      if (data.message === 'No transactions found') return [];
      throw new Error(data.result || data.message || 'Etherscan error');
    }
    return (Array.isArray(data.result) ? data.result : []) as ChainTx[];
  },

  async fetchTokenTransactions(address: string, network: string): Promise<TokenTx[]> {
    const chainId = CHAIN_ID[network];
    if (!chainId || !address) return [];

    const params = new URLSearchParams({
      chainid:    chainId,
      module:     'account',
      action:     'tokentx',
      address,
      startblock: '0',
      endblock:   '99999999',
      page:       '1',
      offset:     '50',
      sort:       'desc',
      ...(EXPLORER_KEY ? { apikey: EXPLORER_KEY } : {}),
    });

    const res = await fetch(`${V2_BASE}?${params}`, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return [];

    const data = await res.json();
    if (data.status !== '1') return [];
    return (Array.isArray(data.result) ? data.result : []) as TokenTx[];
  },
};
