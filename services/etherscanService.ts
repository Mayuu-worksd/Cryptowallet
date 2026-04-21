// Etherscan-compatible APIs for each network — free, no key needed for basic use
const EXPLORER_API: Record<string, string> = {
  Ethereum: 'https://api.etherscan.io/api',
  Sepolia:  'https://api-sepolia.etherscan.io/api',
  Polygon:  'https://api.polygonscan.com/api',
  Arbitrum: 'https://api.arbiscan.io/api',
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

export const etherscanService = {
  async fetchTransactions(address: string, network: string): Promise<ChainTx[]> {
    const base = EXPLORER_API[network];
    if (!base || !address) return [];

    try {
      const params = new URLSearchParams({
        module:     'account',
        action:     'txlist',
        address,
        startblock: '0',
        endblock:   '99999999',
        page:       '1',
        offset:     '50',       // last 50 txns
        sort:       'desc',
        ...(EXPLORER_KEY ? { apikey: EXPLORER_KEY } : {}),
      });

      const res = await fetch(`${base}?${params}`, {
        headers: { 'Accept': 'application/json' },
      });

      if (!res.ok) return [];
      const data = await res.json();
      if (data.status !== '1' || !Array.isArray(data.result)) return [];
      return data.result as ChainTx[];
    } catch {
      return [];
    }
  },
};
