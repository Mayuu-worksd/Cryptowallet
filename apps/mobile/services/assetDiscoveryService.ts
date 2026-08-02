import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { ethers } from 'ethers';
import { ethereumService } from './ethereumService';
import { SUPPORTED_TOKENS } from '../constants/currencyConfig';

const ALCHEMY_KEY = process.env.EXPO_PUBLIC_ALCHEMY_KEY ?? '';
const ETHERSCAN_KEY = process.env.EXPO_PUBLIC_ETHERSCAN_KEY ?? '';

const ALCHEMY_URLS: Record<string, string> = {
  'Ethereum': `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  'Polygon': `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  'Arbitrum': `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  'Optimism': `https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  'Base': `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  'Avalanche': `https://avax-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  'Sepolia': `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`,
};

const CHAIN_IDS: Record<string, string> = {
  'Ethereum': '1',
  'Polygon': '137',
  'Arbitrum': '42161',
  'Optimism': '10',
  'Base': '8453',
  'Avalanche': '43114',
  'BSC': '56',
  'Sepolia': '11155111',
};

export type DiscoveredAsset = {
  id: string;
  symbol: string;
  name: string;
  contractAddress: string;
  decimals: number;
  balance: number;
  network: string;
  type: 'erc20' | 'erc721' | 'erc1155' | 'unknown';
  estimatedValueUsd: number;
  verificationStatus: 'safe' | 'warning' | 'danger';
  warningMessage?: string;
  explorerLink: string;
  logoUrl?: string;
  tokenId?: string; // For NFTs
};

// Simple local cache for metadata to prevent repeated RPC calls
const METADATA_CACHE_KEY = 'cw_recovery_metadata_cache';

export const assetDiscoveryService = {
  async getMetadataCache(): Promise<Record<string, any>> {
    try {
      const raw = await AsyncStorage.getItem(METADATA_CACHE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  async writeMetadataCache(cache: Record<string, any>): Promise<void> {
    try {
      await AsyncStorage.setItem(METADATA_CACHE_KEY, JSON.stringify(cache));
    } catch {}
  },

  async fetchTokenMetadata(contractAddress: string, network: string): Promise<{ symbol: string; decimals: number; name: string } | null> {
    const cacheKey = `${network}_${contractAddress.toLowerCase()}`;
    const cache = await this.getMetadataCache();
    if (cache[cacheKey]) {
      return cache[cacheKey];
    }

    try {
      // Use ethereumService to fetch basic metadata
      const meta = await ethereumService.getCustomTokenMetadata(contractAddress, network);
      if (meta) {
        const fullMeta = {
          symbol: meta.symbol,
          decimals: meta.decimals,
          name: meta.symbol // fallback name to symbol
        };
        cache[cacheKey] = fullMeta;
        await this.writeMetadataCache(cache);
        return fullMeta;
      }
    } catch {}
    return null;
  },

  // Heuristics for spam/scam classification
  classifySpam(symbol: string, name: string, contractAddress: string): { status: 'safe' | 'warning' | 'danger'; message?: string } {
    const cleanSym = symbol.toUpperCase();
    const cleanName = name.toUpperCase();
    
    // Known high-risk patterns
    const spamKeywords = ['CLAIM', 'FREE', 'AIRDROP', 'GIFT', 'VISIT', 'PROMO', 'WIN', 'REWARD', 'VOUCHER'];
    const hasSpamKeyword = spamKeywords.some(kw => cleanSym.includes(kw) || cleanName.includes(kw));
    
    // URLs in symbols or names
    const urlPattern = /\.(COM|NET|ORG|IO|XYZ|VIP|INFO|TOP|WORK|XYZ|WIN)/;
    const hasUrl = urlPattern.test(cleanSym) || urlPattern.test(cleanName);

    if (hasSpamKeyword || hasUrl) {
      return {
        status: 'danger',
        message: 'Potential phishing / malicious token. Do not interact with this contract.'
      };
    }

    // Common standard whitelists
    const verifiedSymbols = ['USDT', 'USDC', 'DAI', 'WBTC', 'WETH', 'LINK', 'UNI', 'AAVE', 'INRX', 'MATIC', 'BNB'];
    if (verifiedSymbols.includes(cleanSym)) {
      return { status: 'safe' };
    }

    return {
      status: 'warning',
      message: 'Unverified custom asset. Verify contract details before performing transfers.'
    };
  },

  // Auto-Scan: Queries transfers using Alchemy where supported, Etherscan for BSC
  async autoScanAddress(walletAddress: string, activeNetwork: string): Promise<DiscoveredAsset[]> {
    if (!walletAddress) return [];
    
    const allDiscovered: DiscoveredAsset[] = [];
    const scanNetworks = Object.keys(CHAIN_IDS); // ethereum, polygon, arbitrum, base, optimism, avalanche, bsc, sepolia

    for (const net of scanNetworks) {
      try {
        const isBsc = net === 'BSC';
        let transfers: any[] = [];

        if (isBsc) {
          transfers = await this.fetchBscTransfers(walletAddress);
        } else {
          transfers = await this.fetchAlchemyTransfers(walletAddress, net);
        }

        // Process discovered transfers
        for (const tx of transfers) {
          const isIncoming = tx.to.toLowerCase() === walletAddress.toLowerCase();
          if (!isIncoming) continue;

          const contract = tx.rawContract?.address || tx.contractAddress;
          if (!contract) continue;

          // Check if already supported in Core token config
          const isCoreToken = SUPPORTED_TOKENS[tx.asset || ''];
          if (isCoreToken && net === activeNetwork) continue; // Skip core tokens on active network

          const symbol = tx.asset || 'UNKNOWN';
          const type = tx.category === 'erc721' ? 'erc721' : tx.category === 'erc1155' ? 'erc1155' : 'erc20';
          const decimals = tx.rawContract?.decimal ? parseInt(tx.rawContract.decimal, 16) : 18;

          // Check spam status
          const spam = this.classifySpam(symbol, symbol, contract);

          // Get balance on-chain
          let balance = 0;
          try {
            balance = await ethereumService.getCustomTokenBalance(walletAddress, contract, net);
          } catch {}

          if (balance <= 0) continue;

          const id = `${net}_${contract.toLowerCase()}`;
          const explorerLink = net === 'BSC' 
            ? `https://bscscan.com/token/${contract}`
            : `https://etherscan.io/token/${contract}`; // Fallback explorer

          allDiscovered.push({
            id,
            symbol,
            name: symbol,
            contractAddress: contract,
            decimals,
            balance,
            network: net,
            type,
            estimatedValueUsd: symbol === 'USDT' || symbol === 'USDC' ? balance : balance * 0, // simple heuristic
            verificationStatus: spam.status,
            warningMessage: spam.message,
            explorerLink,
          });
        }
      } catch (e) {
        console.warn(`Scan failed for network ${net}:`, e);
      }
    }

    return allDiscovered;
  },

  async fetchAlchemyTransfers(address: string, network: string): Promise<any[]> {
    const url = ALCHEMY_URLS[network];
    if (!url || !ALCHEMY_KEY) return [];

    const payload = {
      id: 1,
      jsonrpc: '2.0',
      method: 'alchemy_getAssetTransfers',
      params: [
        {
          fromBlock: '0x0',
          toBlock: 'latest',
          toAddress: address,
          category: ['erc20', 'erc721', 'erc1155'],
          withMetadata: true,
          excludeZeroValue: true,
          maxCount: '0x64',
        },
      ],
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) return [];
      const res = await response.json();
      return res.result?.transfers || [];
    } catch {
      return [];
    }
  },

  async fetchBscTransfers(address: string): Promise<any[]> {
    const chainId = CHAIN_IDS['BSC'];
    if (!chainId) return [];

    // Hit Etherscan V2 API for BSC token transactions
    const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&page=1&offset=50&sort=desc${ETHERSCAN_KEY ? `&apikey=${ETHERSCAN_KEY}` : ''}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      if (data.status !== '1') return [];
      
      return (data.result || []).map((tx: any) => ({
        to: tx.to,
        from: tx.from,
        asset: tx.tokenSymbol,
        category: 'erc20',
        contractAddress: tx.contractAddress,
        rawContract: {
          address: tx.contractAddress,
          decimal: parseInt(tx.tokenDecimal).toString(16),
          value: tx.value
        }
      }));
    } catch {
      return [];
    }
  }
};
