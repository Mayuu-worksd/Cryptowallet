import { RPC_URLS } from '../config';

export type AlchemyTransfer = {
  blockNum: string;
  hash: string;
  from: string;
  to: string;
  value: number | null;
  asset: string | null;
  category: 'external' | 'internal' | 'erc20' | 'erc721' | 'erc1155';
  rawContract: {
    value: string | null;
    address: string | null;
    decimal: string | null;
  };
  metadata: {
    blockTimestamp: string;
  };
};

export const alchemyService = {
  async fetchAssetTransfers(address: string, network: string, direction: 'from' | 'to'): Promise<AlchemyTransfer[]> {
    const rpcUrl = RPC_URLS[network];
    if (!rpcUrl || !rpcUrl.includes('alchemy.com')) {
      return [];
    }

    const payload = {
      id: 1,
      jsonrpc: '2.0',
      method: 'alchemy_getAssetTransfers',
      params: [
        {
          fromBlock: '0x0',
          toBlock: 'latest',
          [direction === 'from' ? 'fromAddress' : 'toAddress']: address,
          category: ['external', 'internal', 'erc20'],
          withMetadata: true,
          excludeZeroValue: true,
          maxCount: '0x3e8',
        },
      ],
    };

    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) return [];
      const data = await response.json();
      if (data.error) {
        console.error('Alchemy API Error:', data.error);
        return [];
      }
      return data.result?.transfers || [];
    } catch (e) {
      console.error('Failed to fetch from Alchemy:', e);
      return [];
    }
  },

  async fetchAllTransfers(address: string, network: string): Promise<AlchemyTransfer[]> {
    const [fromTxs, toTxs] = await Promise.all([
      this.fetchAssetTransfers(address, network, 'from'),
      this.fetchAssetTransfers(address, network, 'to'),
    ]);
    
    const merged = [...fromTxs, ...toTxs];
    const unique = new Map<string, AlchemyTransfer>();
    for (const tx of merged) {
      unique.set(`${tx.hash}-${tx.category}`, tx);
    }
    
    return Array.from(unique.values()).sort((a, b) => {
      const blockA = parseInt(a.blockNum, 16);
      const blockB = parseInt(b.blockNum, 16);
      return blockB - blockA;
    });
  }
};
