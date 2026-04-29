/**
 * transactionService.ts
 * Unified transaction history — merges on-chain (Etherscan), sent, swap, and card
 * transactions from AsyncStorage + Etherscan API into one sorted list.
 */

import { Platform } from 'react-native';
import { ethers } from 'ethers';
import AsyncStorageNative from '@react-native-async-storage/async-storage';
import { etherscanService, ChainTx, TokenTx } from './etherscanService';

const AsyncStorage = Platform.OS === 'web'
  ? {
      getItem:  async (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
      setItem:  async (k: string, v: string) => { try { localStorage.setItem(k, v); } catch (_e) {} },
    }
  : AsyncStorageNative;

// ─── Cache key ────────────────────────────────────────────────────────────────
const CACHE_KEY = 'tx_history_cache';

// ─── Unified transaction shape ────────────────────────────────────────────────
export type UnifiedTx = {
  id:       string;
  type:     'send' | 'receive' | 'swap' | 'card';
  amount:   string;
  token:    string;
  usdValue: string;
  date:     string;          // ISO string
  status:   'completed' | 'pending' | 'failed';
  from:     string;
  to:       string;
  hash:     string | null;
  label:    string;
};

// ─── Internal storage shapes (matching WalletContext) ─────────────────────────
type LocalTx = {
  id:              string;
  type:            'sent' | 'received' | 'card_topup' | 'card_spend' | 'swap';
  coin:            string;
  amount:          string;
  usdValue:        string;
  address:         string;
  status:          'success' | 'pending' | 'failed';
  date:            string;
  txHash?:         string;
  contractAddress?: string;
  rawDate?:        number;
  isInternal?:     boolean;
};

type CardTx = {
  id:        string;
  type:      'topup' | 'spend';
  amount:    number;
  label:     string;
  coin?:     string;
  coinAmount?: number;
  status:    'success';
  timestamp: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toIso(dateStr: string): string {
  // Handles "Apr 22, 2024", ISO strings, and unix-ms strings
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch (_e) {}
  return new Date().toISOString();
}

function localStatusToUnified(s: 'success' | 'pending' | 'failed'): UnifiedTx['status'] {
  if (s === 'success') return 'completed';
  if (s === 'pending') return 'pending';
  return 'failed';
}

// ─── Converters ───────────────────────────────────────────────────────────────
function fromLocalTx(tx: LocalTx): UnifiedTx {
  const type: UnifiedTx['type'] =
    tx.type === 'sent'       ? 'send'    :
    tx.type === 'received'   ? 'receive' :
    tx.type === 'swap'       ? 'swap'    : 'card';

  const label =
    tx.type === 'sent'       ? `Sent ${tx.coin}`     :
    tx.type === 'received'   ? `Received ${tx.coin}` :
    tx.type === 'swap'       ? tx.address            : // swap address field holds "ETH → USDC" label
    tx.type === 'card_topup' ? `Card Top-up (${tx.coin})` :
                               `Card Payment`;

  // For received txs, if address equals the wallet's own address it's a self-transfer simulation
  const fromAddr = tx.type === 'sent' ? 'You' : tx.address;

  return {
    id:       tx.id,
    type,
    amount:   tx.amount,
    token:    tx.coin,
    usdValue: tx.usdValue,
    date:     toIso(tx.date),
    status:   localStatusToUnified(tx.status),
    from:     fromAddr,
    to:       tx.type === 'sent' ? tx.address : 'You',
    hash:     tx.txHash ?? null,
    label,
  };
}

function fromCardTx(tx: CardTx): UnifiedTx {
  const isTopup = tx.type === 'topup';
  return {
    id:       tx.id,
    type:     'card',
    amount:   tx.amount.toFixed(2),
    token:    'USD',
    usdValue: tx.amount.toFixed(2),
    date:     toIso(tx.timestamp),
    status:   'completed',
    from:     isTopup ? (tx.coin ?? 'Wallet') : 'Card',
    to:       isTopup ? 'Card' : tx.label,
    hash:     null,
    label:    isTopup ? `Card Top-up via ${tx.coin ?? 'Wallet'}` : `Card Payment · ${tx.label}`,
  };
}

function fromChainTx(tx: ChainTx, walletAddress: string, ethPriceUsd: number): UnifiedTx {
  const isSend  = tx.from.toLowerCase() === walletAddress.toLowerCase();
  const ethAmt  = parseFloat(ethers.formatEther(tx.value || '0'));
  const usd     = (ethAmt * ethPriceUsd).toFixed(2);
  const date    = new Date(parseInt(tx.timeStamp, 10) * 1000).toISOString();
  const status: UnifiedTx['status'] = tx.isError === '0' ? 'completed' : 'failed';

  return {
    id:       tx.hash,
    type:     isSend ? 'send' : 'receive',
    amount:   ethAmt.toFixed(6),
    token:    'ETH',
    usdValue: usd,
    date,
    status,
    from:     tx.from,
    to:       tx.to,
    hash:     tx.hash,
    label:    isSend ? 'Sent ETH' : 'Received ETH',
  };
}

// ─── Main service ─────────────────────────────────────────────────────────────
export const transactionService = {
  async fetchAll(
    walletAddress: string,
    network: string,
    ethPriceUsd: number,
  ): Promise<{ txs: UnifiedTx[]; fromCache: boolean }> {

    // 1. Always load local txs first — these are guaranteed to exist
    const [rawLocal, rawCard, rawSwap] = await Promise.all([
      AsyncStorage.getItem('cw_transactions').catch(() => null),
      AsyncStorage.getItem('cw_card_transactions').catch(() => null),
      AsyncStorage.getItem('swap_transactions').catch(() => null),
    ]);

    let localTxs: LocalTx[] = [];
    let cardTxs:  CardTx[]  = [];
    let swapTxs:  any[]     = [];
    try { const p = rawLocal ? JSON.parse(String(rawLocal)) : []; localTxs = Array.isArray(p) ? p : []; } catch (_e) {}
    try { const p = rawCard  ? JSON.parse(String(rawCard))  : []; cardTxs  = Array.isArray(p) ? p : []; } catch (_e) {}
    try { const p = rawSwap  ? JSON.parse(String(rawSwap))  : []; swapTxs  = Array.isArray(p) ? p : []; } catch (_e) {}

    const fromLocal = localTxs.map(fromLocalTx);
    const fromCard  = cardTxs.map(fromCardTx);
    // Convert swap_transactions entries to UnifiedTx (deduplicate against cw_transactions by txHash)
    const fromSwapStore: UnifiedTx[] = swapTxs.map((s: any) => ({
      id:       s.id ?? s.txHash ?? Date.now().toString(),
      type:     'swap' as const,
      amount:   s.fromAmount ?? s.sellAmount ?? '0',
      token:    s.fromToken ?? 'ETH',
      usdValue: s.usdValue ?? '0',
      date:     s.date ?? new Date().toISOString(),
      status:   (s.status === 'completed' ? 'completed' : 'pending') as UnifiedTx['status'],
      from:     'You',
      to:       s.toToken ?? '',
      hash:     s.txHash ?? null,
      label:    `${s.fromToken ?? '?'} → ${s.toToken ?? '?'}`,
    }));

    // 2. Try Etherscan (ETH + Tokens)
    let chainTxs: ChainTx[] = [];
    let tokenTxs: TokenTx[] = [];
    let etherscanFailed = false;
    try {
      [chainTxs, tokenTxs] = await Promise.all([
        etherscanService.fetchTransactions(walletAddress, network),
        etherscanService.fetchTokenTransactions(walletAddress, network),
      ]);
    } catch {
      etherscanFailed = true;
    }

    const fromChain = [...chainTxs, ...tokenTxs]
      .filter(tx => tx.value !== '0')
      .map(tx => fromChainTx(tx, walletAddress, ethPriceUsd));

    // 3. Merge — chain txs first (confirmed status), local fills the rest
    const seen   = new Set<string>();
    const merged: UnifiedTx[] = [];

    for (const tx of fromChain) {
      const key = `${tx.hash}:${tx.type}`;
      if (!seen.has(key)) { seen.add(key); merged.push(tx); }
    }
    for (const tx of [...fromLocal, ...fromCard, ...fromSwapStore]) {
      const key = tx.hash ? `${tx.hash}:${tx.type}` : tx.id;
      if (!seen.has(key)) { seen.add(key); merged.push(tx); }
    }

    // 4. If Etherscan failed, pull any previously cached chain txs and add them
    if (etherscanFailed) {
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (raw) {
          const cached: UnifiedTx[] = JSON.parse(String(raw));
          for (const tx of (Array.isArray(cached) ? cached : [])) {
            const key = tx.hash ? `${tx.hash}:${tx.type}` : tx.id;
            if (!seen.has(key)) { seen.add(key); merged.push(tx); }
          }
        }
      } catch (_e) {}
    }

    // 5. Sort descending
    merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 6. Persist cache only when Etherscan succeeded
    if (!etherscanFailed && merged.length > 0) {
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(merged)).catch(() => {});
    }

    // fromCache = true only if Etherscan failed AND we had no chain txs from cache either
    const fromCache = etherscanFailed && fromChain.length === 0;

    return { txs: merged, fromCache };
  },

  /** Format ISO date → "Apr 22, 2:30 PM" */
  formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString('en-US', {
        month:  'short',
        day:    'numeric',
        hour:   'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return iso;
    }
  },

  /**
   * Polls Etherscan for new incoming txs and saves them as local 'received' entries.
   * Call this on a timer so the receiver's history updates automatically.
   * Returns the number of new txs saved.
   */
  lastSyncTime: 0,
  isLockedOut: false,
  lockoutExpiry: 0,

  async syncIncoming(
    walletAddress: string,
    network: string,
    ethPriceUsd: number,
    force: boolean = false,
  ): Promise<any[]> {
    if (!walletAddress) return [];
    
    const now = Date.now();
    
    // 1. Check for active lockout
    if (this.isLockedOut && now < this.lockoutExpiry) {
      return [];
    }

    // 2. Standard Cooldown (15s) — Bypass if force is true
    if (!force && (now - this.lastSyncTime < 15000)) {
      return [];
    }
    this.lastSyncTime = now;

    try {

      // 1. Fetch Txs in parallel
      const [chainTxs, tokenTxs, internalTxs] = await Promise.all([
        etherscanService.fetchTransactions(walletAddress, network),
        etherscanService.fetchTokenTransactions(walletAddress, network),
        etherscanService.fetchInternalTransactions(walletAddress, network),
      ]);
      
      // Success! Clear lockout
      this.isLockedOut = false;
      this.lockoutExpiry = 0;

      // Load existing local txs
      const raw = await AsyncStorage.getItem('cw_transactions').catch(() => null);
      let localTxs: LocalTx[] = [];
      try { const p = raw ? JSON.parse(String(raw)) : []; localTxs = Array.isArray(p) ? p : []; } catch (_e) {}

      // Build a set of known hashes
      const knownHashes = new Set(localTxs.map(t => t.txHash).filter(Boolean));
      const newTxs: LocalTx[] = [];

      // 1. Process ETH Txs (Incoming & Outgoing)
      for (const tx of chainTxs) {
        if (tx.isError !== '0' || knownHashes.has(tx.hash)) continue;
        const isOut  = tx.from.toLowerCase() === walletAddress.toLowerCase();
        const ethAmt = parseFloat(ethers.formatEther(tx.value || '0'));
        if (ethAmt <= 0) continue;
        newTxs.push({
          id:       tx.hash,
          type:     isOut ? 'sent' : 'received',
          coin:     'ETH',
          amount:   ethAmt.toFixed(6),
          usdValue: (ethAmt * ethPriceUsd).toFixed(2),
          address:  isOut ? tx.to : tx.from,
          status:   'success',
          date:     new Date(parseInt(tx.timeStamp, 10) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          rawDate:  parseInt(tx.timeStamp, 10) * 1000,
          txHash:   tx.hash,
        });
        knownHashes.add(tx.hash);
      }

      // 1.5 Process Internal ETH Txs (Swaps/Contract Income)
      for (const tx of internalTxs) {
        if (tx.isError !== '0' || knownHashes.has(tx.hash)) continue;
        const isOut   = tx.from.toLowerCase() === walletAddress.toLowerCase();
        const ethAmt2 = parseFloat(ethers.formatEther(tx.value || '0'));
        if (ethAmt2 <= 0) continue;
        newTxs.push({
          id:         tx.hash + '_int',
          type:       isOut ? 'sent' : 'received',
          coin:       'ETH',
          amount:     ethAmt2.toFixed(6),
          usdValue:   (ethAmt2 * ethPriceUsd).toFixed(2),
          address:    isOut ? tx.to : tx.from,
          status:     'success',
          date:       new Date(parseInt(tx.timeStamp, 10) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          rawDate:    parseInt(tx.timeStamp, 10) * 1000,
          txHash:     tx.hash,
          isInternal: true,
        });
        knownHashes.add(tx.hash);
      }

      // 2. Process Token Txs (Check for CUSTOM swap)
      for (const tx of tokenTxs) {
        if (knownHashes.has(tx.hash)) continue;
        const isOut = tx.from.toLowerCase() === walletAddress.toLowerCase();
        const isCustom = tx.contractAddress.toLowerCase() === '0x351028A22C876E0431b30921c0dD0a836a14899E'.toLowerCase();
        
        const amt = parseFloat(ethers.formatUnits(tx.value, parseInt(tx.tokenDecimal, 10)));
        if (amt <= 0) continue;

        newTxs.push({
          id:      tx.hash + tx.nonce,
          type:    isCustom ? 'swap' : (isOut ? 'sent' : 'received'),
          coin:    isCustom ? 'CUSTOM' : tx.tokenSymbol,
          amount:  amt.toFixed(6),
          usdValue: '0.00',
          address: isOut ? tx.to : tx.from,
          status:  'success',
          date:    new Date(parseInt(tx.timeStamp, 10) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          rawDate: parseInt(tx.timeStamp, 10) * 1000,
          txHash:  tx.hash,
          contractAddress: tx.contractAddress,
        });
      }

      if (newTxs.length > 0) {
        const updated = [...newTxs, ...localTxs];
        await AsyncStorage.setItem('cw_transactions', JSON.stringify(updated));
        return newTxs;
      }
      return [];
    } catch (e: any) {
      if (e?.message?.includes('NOTOK') || e?.message?.includes('Rate limit')) {
        console.warn('[transactionService] Rate limit hit. Entering 5-minute backoff mode.');
        this.isLockedOut = true;
        this.lockoutExpiry = Date.now() + 300000; // 5 minutes
      } else {
        console.error('[transactionService] Sync error:', e);
      }
      return [];
    }
  },

  /** Clear the on-disk cache (call on wallet delete) */
  async clearCache(): Promise<void> {
    await Promise.all([
      AsyncStorage.setItem(CACHE_KEY, '[]').catch(() => {}),
      AsyncStorage.setItem('swap_transactions', '[]').catch(() => {}),
    ]);
  },
};
