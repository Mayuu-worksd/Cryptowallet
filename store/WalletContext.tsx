import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback, useMemo } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { walletService } from '../services/walletService';
import { ethereumService } from '../services/ethereumService';
import { getWalletBalances } from '../services/balanceService';
import { storageService } from '../services/storageService';
import { marketService, NewsItem } from '../services/marketService';
import { hasPinSetup, clearPin } from '../services/pinService';
import { transactionService } from '../services/transactionService';
import { cardService } from '../services/cardService';
import { notificationService } from '../services/notificationService';
import { DEFAULT_NETWORK } from '../constants';

export type Transaction = {
  id: string;
  type: 'sent' | 'received' | 'card_topup' | 'card_spend' | 'swap';
  coin: string;
  amount: string;
  usdValue: string;
  address: string;
  status: 'success' | 'pending' | 'failed' | 'completed';
  date: string;
  txHash?: string;
};

export type CardTransaction = {
  id: string;
  type: 'topup' | 'spend';
  amount: number;
  label: string;
  coin?: string;
  coinAmount?: number;
  status: 'success';
  timestamp: string;
};

export type CoinPrice = { usd: number; change24h: number };

type MarketContextType = {
  prices: Record<string, CoinPrice>;
  isPricesLoading: boolean;
  priceError: boolean;
  news: NewsItem[];
  isNewsLoading: boolean;
  refreshPrices: () => Promise<void>;
  refreshNews: () => Promise<void>;
};

const MarketContext = createContext<MarketContextType>({} as MarketContextType);
export const useMarket = () => useContext(MarketContext);

type WalletContextType = {
  isDarkMode: boolean;
  toggleTheme: () => void;
  walletAddress: string;
  walletName: string;
  setWalletName: (name: string) => void;
  ethBalance: string;
  isLoadingBalance: boolean;
  hasWallet: boolean;
  isLoadingWallet: boolean;
  isReadOnly: boolean;
  balances: Record<string, number>;
  cardBalance: number;
  cardFrozen: boolean;
  network: string;
  transactions: Transaction[];
  balanceVisible: boolean;
  toggleBalanceVisible: () => void;
  pinEnabled: boolean;
  refreshPinEnabled: () => Promise<void>;
  generateMnemonic: () => string;
  createWallet: () => Promise<{ mnemonic: string; address: string }>;
  importWallet: (mnemonic: string, isNew?: boolean) => Promise<void>;
  deleteWallet: () => Promise<void>;
  enterReadOnlyMode: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  fetchBalance: (address: string, net: string) => Promise<void>;
  sendETH: (toAddress: string, amount: string) => Promise<{ success: boolean; error?: string; hash?: string }>;
  sendCrypto: (coin: string, amount: number, label: string) => void;
  topupCard: (coin: string, amount: number) => boolean;
  spendCard: (coin: string, amountUSD: number, label: string) => boolean;
  toggleFreezeCard: () => void;
  cardTransactions: CardTransaction[];
  cardDetails: { number: string; expiry: string; cvv: string; brand: 'VISA' | 'MASTERCARD'; holderName: string; design: string };
  cardCreated: boolean;
  createCard: (holderName: string, design: string) => void;
  updateCardDetails: (patch: { holderName?: string; design?: string }) => void;
  generateCardDetails: () => void;
  applySwapBalances: (sellToken: string, sellAmt: number, buyToken: string, buyAmt: number) => Promise<void>;
  switchNetwork: (n: string) => void;
};

const WalletContext = createContext<WalletContextType>({} as WalletContextType);

const FALLBACK_PRICES: Record<string, CoinPrice> = {
  ETH:   { usd: 3450,  change24h: 0 },
  BTC:   { usd: 64000, change24h: 0 },
  USDT:  { usd: 1,     change24h: 0 },
  USDC:  { usd: 1,     change24h: 0 },
  DAI:   { usd: 1,     change24h: 0 },
  SOL:   { usd: 180,   change24h: 0 },
  MATIC: { usd: 0.85,  change24h: 0 },
  BNB:   { usd: 580,   change24h: 0 },
};

export function WalletProvider({ children }: { children: ReactNode }) {
  const [isDarkMode,       setIsDarkMode]       = useState(true);
  const [balanceVisible,   setBalanceVisible]   = useState(true);
  const [pinEnabled,       setPinEnabled]       = useState(false);
  const [walletAddress,    setWalletAddress]    = useState('');
  const [walletName,       setWalletNameState]  = useState('Account 1');
  const [ethBalance,       setEthBalance]       = useState('0.0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [hasWallet,        setHasWallet]        = useState(false);
  const [isReadOnly,       setIsReadOnly]       = useState(false);
  const [isLoadingWallet,  setIsLoadingWallet]  = useState(true);
  const [cardBalance,      setCardBalance]      = useState(0);
  const [cardFrozen,       setCardFrozen]       = useState(false);
  const [cardTransactions, setCardTransactions] = useState<CardTransaction[]>([]);
  const [cardCreated,      setCardCreated]      = useState(false);
  const [cardDetails,      setCardDetails]      = useState({
    number: '\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022',
    expiry: '\u2022\u2022/\u2022\u2022',
    cvv: '\u2022\u2022\u2022',
    brand: 'VISA' as const,
    holderName: 'CARD HOLDER',
    design: 'dark',
  });
  const [network,         setNetworkState]  = useState(DEFAULT_NETWORK);
  const [transactions,    setTransactions]  = useState<Transaction[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({
    ETH: 0, USDC: 0, USDT: 0, DAI: 0, BTC: 0, SOL: 0, CUSTOM: 0
  });
  const [prices,          setPrices]        = useState<Record<string, CoinPrice>>(FALLBACK_PRICES);
  const [isPricesLoading, setIsPricesLoading] = useState(true);
  const [priceError,      setPriceError]    = useState(false);
  const [news,            setNews]          = useState<NewsItem[]>([]);
  const [isNewsLoading,   setIsNewsLoading] = useState(true);

  const [dataLoaded,     setDataLoaded]     = useState(false);
  const pendingAddressRef  = useRef<{ address: string; net: string } | null>(null);
  const ethBalanceRef      = useRef('0.0');
  const balancesRef        = useRef<Record<string, number>>({ ETH: 0, USDT: 0, USDC: 0, DAI: 0, BTC: 0, SOL: 0 });
  const priceIntervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const newsIntervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const balanceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { ethBalanceRef.current = ethBalance; }, [ethBalance]);

  const toggleTheme          = useCallback(() => setIsDarkMode(p => !p), []);
  const toggleBalanceVisible = useCallback(() => setBalanceVisible(p => !p), []);
  const toggleFreezeCard     = useCallback(() => {
    setCardFrozen(p => {
      const newVal = !p;
      cardService.setCardFrozen(newVal);
      return newVal;
    });
  }, []);

  const refreshPinEnabled = useCallback(async () => {
    setPinEnabled(await hasPinSetup());
  }, []);

  useEffect(() => { refreshPinEnabled(); }, []);

  const addTx = useCallback((tx: Omit<Transaction, 'id' | 'date'>) => {
    setTransactions(prev => [{
      ...tx,
      id:   Date.now().toString(),
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    }, ...prev]);
  }, []);

  const addCardTx = useCallback((tx: Omit<CardTransaction, 'id' | 'timestamp'>) => {
    setCardTransactions(prev => [{ ...tx, id: Date.now().toString(), timestamp: new Date().toISOString() }, ...prev]);
  }, []);

  useEffect(() => {
    const startup = async () => {
      console.log("[Startup] Checking for existing wallet...");
      try {
        const address = await storageService.getWalletAddress();
        
        if (address) {
          console.log("Wallet Loaded:", address);
          console.log("Stored Address:", address);
          
          setWalletAddress(address);
          setHasWallet(true);
          
          const [savedName, savedTxs, savedCard, savedDetails, savedCardCreated, savedTokenBals, savedFrozen, savedReadOnly] = await Promise.all([
            storageService.getWalletName(),
            AsyncStorage.getItem('cw_transactions'),
            AsyncStorage.getItem('cw_card_balance'),
            AsyncStorage.getItem('cw_card_details'),
            AsyncStorage.getItem('cw_card_created'),
            AsyncStorage.getItem('cw_token_balances'),
            cardService.getCardFrozen(),
            AsyncStorage.getItem('cw_read_only'),
          ]);

          // Check if we're in read-only mode (Delete Account was used)
          const readOnly = savedReadOnly === 'true';
          setIsReadOnly(readOnly);

          if (savedName) setWalletNameState(savedName);
          if (!readOnly && savedTxs)  setTransactions(JSON.parse(savedTxs));
          if (savedCard) setCardBalance(parseFloat(savedCard));
          if (savedDetails) setCardDetails(JSON.parse(savedDetails));
          if (savedCardCreated) setCardCreated(savedCardCreated === 'true');
          setCardFrozen(savedFrozen);
          if (savedTokenBals) {
            const parsed = JSON.parse(savedTokenBals);
            setBalances(parsed);
            balancesRef.current = parsed;
          }

          // 3. Auto-Healing: Restore balances from transaction history if missing
          if (savedTxs) {
            const txs: any[] = JSON.parse(savedTxs);
            const heals: Record<string, number> = {};
            txs.forEach(t => {
              const isSuccess = t.status === 'success' || t.status === 'completed';
              if (isSuccess && t.type === 'swap') {
                // For a swap, we gain the 'buyToken' amount
                const buyAmt = parseFloat(t.buyAmount);
                const sellAmt = parseFloat(t.amount);
                const buyTok = t.buyToken;
                const sellTok = t.coin;
                
                if (!isNaN(buyAmt) && buyTok) {
                  heals[buyTok] = (heals[buyTok] || 0) + buyAmt;
                }
                if (!isNaN(sellAmt) && sellTok) {
                  heals[sellTok] = (heals[sellTok] || 0) - sellAmt;
                }
              }
            });
            
            setBalances(prev => {
              const next = { ...prev };
              Object.entries(heals).forEach(([coin, val]) => {
                // If current balance is 0 or missing, apply the healing from history
                if (!next[coin] || next[coin] === 0) {
                  // We use Math.max(0, ...) for the sell side to avoid negative balances
                  next[coin] = Math.max(0, (next[coin] || 0) + val);
                }
              });
              balancesRef.current = next;
              return next;
            });
          }

          pendingAddressRef.current = { address, net: network };
        } else {
          setHasWallet(false);
        }
      } catch (e) {
        console.error("[Startup] Error loading wallet:", e);
      } finally {
        setIsLoadingWallet(false);
        setDataLoaded(true);
      }
    };
    startup();
  }, []);

  const fetchBalance = useCallback(async (address: string, net: string) => {
    setIsLoadingBalance(true);
    try {
      const onChain = await getWalletBalances(address, net, balancesRef.current);
      setEthBalance(onChain.ETH.toFixed(6));
      ethBalanceRef.current = onChain.ETH.toFixed(6);
      setBalances(onChain);
      balancesRef.current = onChain;
      await AsyncStorage.setItem('cw_token_balances', JSON.stringify(onChain));
    } catch (e) {
      console.error('[WalletContext] Balance fetch error:', e);
    } finally {
      setIsLoadingBalance(false);
    }
  }, []);

  const refreshBalance = useCallback(async () => {
    if (walletAddress) {
      await fetchBalance(walletAddress, network);
      // Also trigger a history sync in the background
      transactionService.syncIncoming(walletAddress, network, prices.ETH?.usd ?? 3500).catch(() => {});
    }
  }, [walletAddress, network, fetchBalance]);

  useEffect(() => {
    if (dataLoaded && pendingAddressRef.current) {
      const { address, net } = pendingAddressRef.current;
      pendingAddressRef.current = null;
      fetchBalance(address, net);
      // FORCE A DEEP SCAN ON STARTUP AND UPDATE UI INSTANTLY
      transactionService.syncIncoming(address, net, prices.ETH?.usd ?? 3500)
        .then(newTxs => {
          if (Array.isArray(newTxs) && newTxs.length > 0) {
            setTransactions(prev => {
              const existingHashes = new Set(prev.map(t => t.txHash).filter(Boolean));
              const uniqueNew = newTxs.filter((t: any) => !t.txHash || !existingHashes.has(t.txHash));
              // Fire notification for each new incoming tx
              uniqueNew.forEach((t: any) => {
                if (t.type === 'received') {
                  const usd = (parseFloat(t.amount) * (prices.ETH?.usd ?? 3500)).toFixed(2);
                  notificationService.notifyReceived(t.coin, t.amount, usd).catch(() => {});
                }
              });
              return [...uniqueNew, ...prev];
            });
          }
        })
        .catch(() => {});
    }
  }, [dataLoaded, fetchBalance]);

  // ─── 4. Live Balance Healer: Chronological History Replay Engine ───
  useEffect(() => {
    if (transactions.length > 0) {
      console.log('[HEALER] Replaying', transactions.length, 'transactions to reconstruct state...');
      
      const recoveredTokenBals: Record<string, number> = { 
        USDC: 0, USDT: 0, DAI: 0, BTC: 0, SOL: 0, CUSTOM: 0 
      };
      let recoveredCardBal = 0;
      let hasCardActivity = false;

      // Sort transactions oldest to newest for accurate replay
      const sortedTxs = [...transactions].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      sortedTxs.forEach(t => {
        const isSuccess = t.status === 'success' || t.status === 'completed';
        if (!isSuccess) return;

        const txAny = t as any;
        const coin  = t.coin;
        const amt   = parseFloat(t.amount);

        // 1. Recover Card State
        if (t.type === 'card_topup') {
          recoveredCardBal += parseFloat(t.usdValue || t.amount);
          hasCardActivity = true;
          if (coin && coin !== 'ETH') {
            recoveredTokenBals[coin] = (recoveredTokenBals[coin] || 0) - amt;
          }
        } else if (t.type === 'card_spend') {
          recoveredCardBal -= parseFloat(t.usdValue || t.amount);
          hasCardActivity = true;
        }

        // 2. Recover Token Balances (Receives / Sends)
        if (t.type === 'received' && coin !== 'ETH') {
          recoveredTokenBals[coin] = (recoveredTokenBals[coin] || 0) + amt;
        } else if (t.type === 'sent' && coin !== 'ETH') {
          recoveredTokenBals[coin] = Math.max(0, (recoveredTokenBals[coin] || 0) - amt);
        }

        // 3. Recover Swaps
        if (t.type === 'swap') {
          const sellTok = coin;
          const sellAmt = amt;
          const buyTok  = txAny.buyToken || (sellTok === 'ETH' ? (t.address.split('→')[1]?.trim()) : 'ETH');
          const buyAmt  = parseFloat(txAny.buyAmount || t.amount);

          if (sellTok && sellTok !== 'ETH') {
            recoveredTokenBals[sellTok] = Math.max(0, (recoveredTokenBals[sellTok] || 0) - sellAmt);
          }
          if (buyTok && buyTok !== 'ETH') {
            recoveredTokenBals[buyTok] = (recoveredTokenBals[buyTok] || 0) + buyAmt;
          }
        }
      });

      // Apply Recovered State
      if (hasCardActivity) {
        setCardCreated(true);
        setCardBalance(Math.max(0, recoveredCardBal));
      }

      setBalances(prev => {
        let changed = false;
        const next = { ...prev };
        Object.entries(recoveredTokenBals).forEach(([coin, val]) => {
          if (Math.abs((next[coin] || 0) - val) > 0.0001) {
            next[coin] = val;
            changed = true;
          }
        });
        if (changed) {
          balancesRef.current = next;
          AsyncStorage.setItem('cw_token_balances', JSON.stringify(next)).catch(() => {});
          return next;
        }
        return prev;
      });
    }
  }, [transactions, walletAddress]);

  useEffect(() => { 
    if (!dataLoaded || !hasWallet) return;
    AsyncStorage.setItem('cw_transactions', JSON.stringify(transactions)).catch(() => {});
  }, [transactions, dataLoaded, hasWallet]);

  useEffect(() => {
    if (!dataLoaded || !hasWallet) return;
    AsyncStorage.setItem('cw_card_balance', String(cardBalance)).catch(() => {});
  }, [cardBalance, dataLoaded, hasWallet]);

  useEffect(() => {
    if (!dataLoaded || !hasWallet) return;
    AsyncStorage.setItem('cw_card_transactions', JSON.stringify(cardTransactions)).catch(() => {});
  }, [cardTransactions, dataLoaded, hasWallet]);

  const fetchPrices = useCallback(async () => {
    try {
      setPriceError(false);
      const data = await marketService.fetchPrices();
      if (Object.keys(data).length > 0) setPrices(prev => ({ ...prev, ...data }));
    } catch (_e) { setPriceError(true); }
    finally { setIsPricesLoading(false); }
  }, []);

  const fetchNews = useCallback(async () => {
    setIsNewsLoading(true);
    try { setNews(await marketService.fetchNews()); } catch (_e) {}
    finally { setIsNewsLoading(false); }
  }, []);

  useEffect(() => {
    fetchPrices();
    fetchNews();
    priceIntervalRef.current = setInterval(fetchPrices, 30_000);
    newsIntervalRef.current  = setInterval(fetchNews,   300_000);
    return () => {
      if (priceIntervalRef.current) clearInterval(priceIntervalRef.current);
      if (newsIntervalRef.current)  clearInterval(newsIntervalRef.current);
    };
  }, [fetchPrices, fetchNews]);

  const handleSetWalletName = useCallback(async (name: string) => {
    setWalletNameState(name);
    await storageService.saveWalletName(name);
  }, []);

  const createWallet = useCallback(async (): Promise<{ mnemonic: string; address: string }> => {
    return walletService.generateWalletPreview();
  }, []);

  const importWallet = useCallback(async (mnemonic: string, isNew = false): Promise<void> => {
    try {
      const data = await walletService.importFromMnemonic(mnemonic);
      const oldAddress = await storageService.getWalletAddress();
      const isSwitching = oldAddress && oldAddress.toLowerCase() !== data.address.toLowerCase();

      // ONLY wipe local data if this is a brand-new wallet OR switching to a different address.
      // If restoring the SAME wallet (same address, e.g. from another device), preserve nothing
      // locally — on-chain sync will repopulate everything.
      if (isNew || isSwitching) {
        await storageService.clearWallet();
        await AsyncStorage.multiRemove([
          'cw_transactions', 'cw_card_balance', 'cw_card_details',
          'cw_card_transactions', 'cw_card_created', 'cw_token_balances'
        ]);
        setTransactions([]);
        setCardBalance(0);
        setCardCreated(false);
        setCardTransactions([]);
        setBalances({ ETH: 0, USDT: 0, USDC: 0, DAI: 0, BTC: 0, SOL: 0 });
        setEthBalance('0.0');
      }

      await storageService.saveWallet(data.privateKey, data.mnemonic, data.address);
      const finalName = isNew ? 'Main Wallet' : (await storageService.getWalletName() || 'Main Wallet');
      await storageService.saveWalletName(finalName);

      await clearPin();
      await AsyncStorage.removeItem('cw_read_only'); // Clear read-only flag on re-import
      setPinEnabled(false);
      setIsReadOnly(false);
      setWalletAddress(data.address);
      setWalletNameState(finalName);
      setHasWallet(true);

      // Always fetch fresh on-chain data after import/restore.
      // Reset the cooldown so the 120s gate doesn't block a newly imported wallet.
      transactionService.lastSyncTime = 0;
      transactionService.isLockedOut = false;
      (async () => {
        try {
          await fetchBalance(data.address, network);
          const newTxs = await transactionService.syncIncoming(data.address, network, prices.ETH?.usd ?? 3500);
          if (Array.isArray(newTxs) && newTxs.length > 0) {
            setTransactions(prev => {
              const existingHashes = new Set(prev.map(t => t.txHash).filter(Boolean));
              const uniqueNew = newTxs.filter((t: any) => !t.txHash || !existingHashes.has(t.txHash));
              return [...uniqueNew, ...prev];
            });
          }
        } catch (e) {
          console.error('[importWallet] Background sync error:', e);
        }
      })();
    } catch (e: any) {
      throw new Error(e.message || 'Invalid seed phrase. Please try again.');
    }
  }, [network, prices.ETH?.usd, fetchBalance]);

  const deleteWallet = useCallback(async (): Promise<void> => {
    // LOGOUT — clears keys + address + read-only flag.
    // AsyncStorage data (txns, balances) is preserved so re-importing
    // the same phrase on this device restores everything instantly.
    await storageService.clearKeysOnly(); // removes privateKey, mnemonic, AND wallet_address
    await clearPin();
    await AsyncStorage.removeItem('cw_read_only');
    // Fully reset in-memory state → App.tsx re-renders Landing stack
    setHasWallet(false);
    setWalletAddress('');
    setEthBalance('0.0');
    setIsReadOnly(false);
    setPinEnabled(false);
  }, []);

  const enterReadOnlyMode = useCallback(async (): Promise<void> => {
    // DELETE ACCOUNT — removes private keys but keeps wallet address.
    // Stays on main screen showing balance only (read-only view).
    // User can re-import their phrase anytime to restore full access.
    await storageService.clearSecretsOnly(); // removes only privateKey + mnemonic
    await clearPin();
    // Wipe local transaction/card data but keep address + balances
    await AsyncStorage.multiRemove([
      'cw_transactions', 'cw_card_balance', 'cw_card_details',
      'cw_card_transactions', 'cw_card_created',
    ]);
    await AsyncStorage.setItem('cw_read_only', 'true');
    // Clear in-memory sensitive data
    setPinEnabled(false);
    setTransactions([]);
    setCardBalance(0);
    setCardCreated(false);
    setCardTransactions([]);
    setIsReadOnly(true);
    // hasWallet stays true, walletAddress stays set → balance still fetches from chain
  }, []);

  const factoryReset = useCallback(async (): Promise<void> => {
    // This is the "Nuclear" option
    await storageService.clearWallet();
    await clearPin();
    await AsyncStorage.multiRemove([
      'cw_transactions', 'cw_card_balance', 'cw_card_details',
      'cw_card_transactions', 'cw_card_created', 'cw_token_balances'
    ]);
    setHasWallet(false);
    setWalletAddress('');
    setEthBalance('0.0');
    setTransactions([]);
    setCardBalance(0);
    setCardCreated(false);
    setCardTransactions([]);
    setPinEnabled(false);
  }, []);

  const sendETH = useCallback(async (toAddress: string, amount: string): Promise<{ success: boolean; error?: string; hash?: string }> => {
    const privateKey = await storageService.getPrivateKey();
    if (!privateKey) return { success: false, error: 'Private key not found' };
    
    const parsedAmt = parseFloat(amount);
    const ethPrice = prices.ETH?.usd ?? 3450;
    const pendingId = Date.now().toString();
    
    addTx({
      type:     'sent',
      coin:     'ETH',
      amount,
      usdValue: (parsedAmt * ethPrice).toFixed(2),
      address:  toAddress,
      status:   'pending',
    });

    const result = await ethereumService.sendETH(privateKey, toAddress, amount, network);
    setTransactions(prev => prev.map(tx =>
      tx.id === pendingId ? { ...tx, status: result.success ? 'success' : 'failed', txHash: result.hash } : tx
    ));
    
    if (result.success) {
      refreshBalance();
      notificationService.notifySendComplete('ETH', amount, toAddress).catch(() => {});
    }
    return result;
  }, [network, prices, addTx, refreshBalance]);

  const sendCrypto = useCallback((coin: string, amount: number, label: string) => {
    const coinPrice = prices[coin]?.usd ?? 1;
    setBalances(prev => ({ ...prev, [coin]: Math.max(0, (prev[coin] || 0) - amount) }));
    addTx({ type: 'swap', coin, amount: amount.toString(), usdValue: (amount * coinPrice).toFixed(2), address: label, status: 'success' });
  }, [prices, addTx]);

  const topupCard = useCallback((coin: string, amount: number): boolean => {
    const coinPrice  = prices[coin]?.usd ?? 1;
    const usd = +(amount * coinPrice).toFixed(2);
    setCardBalance(prev => +(prev + usd).toFixed(2));
    addTx({ type: 'card_topup', coin, amount: amount.toString(), usdValue: usd.toFixed(2), address: 'Virtual Card', status: 'success' });
    addCardTx({ type: 'topup', amount: usd, label: `Top-up via ${coin}`, coin, coinAmount: amount, status: 'success' });
    return true;
  }, [prices, addTx, addCardTx]);

  const spendCard = useCallback((coin: string, amountUSD: number, label: string): boolean => {
    if (cardFrozen) return false;
    setCardBalance(prev => {
      if (amountUSD > prev) return prev;
      return +(prev - amountUSD).toFixed(2);
    });
    addTx({ type: 'card_spend', coin, amount: amountUSD.toFixed(2), usdValue: amountUSD.toFixed(2), address: label, status: 'success' });
    addCardTx({ type: 'spend', amount: amountUSD, label, coin, status: 'success' });
    return true;
  }, [cardFrozen, addTx, addCardTx]);

  const generateCardDetails = useCallback(() => {
    setCardDetails(prev => cardService.getFixedCardDetails(prev.holderName, prev.design, walletAddress));
  }, [walletAddress]);

  const createCard = useCallback((holderName: string, design: string) => {
    const details = cardService.getFixedCardDetails(holderName, design, walletAddress);
    setCardDetails(details);
    setCardCreated(true);
    AsyncStorage.setItem('cw_card_created', 'true');
    AsyncStorage.setItem('cw_card_details', JSON.stringify(details));
  }, [walletAddress]);

  const updateCardDetails = useCallback((patch: { holderName?: string; design?: string }) => {
    setCardDetails(prev => {
      const updated = { ...prev, ...patch };
      AsyncStorage.setItem('cw_card_details', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const applySwapBalances = useCallback(async (sellTok: string, sellAmt: number, buyTok: string, buyAmt: number) => {
    setBalances(prev => {
      const updated = {
        ...prev,
        [sellTok]: Math.max(0, (prev[sellTok] || 0) - sellAmt),
        [buyTok]: (prev[buyTok] || 0) + buyAmt
      };
      balancesRef.current = updated;
      AsyncStorage.setItem('cw_token_balances', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const switchNetwork = useCallback((n: string) => {
    setNetworkState(n);
    if (walletAddress) fetchBalance(walletAddress, n);
  }, [walletAddress, fetchBalance]);

  const marketValue = useMemo(() => ({
    prices, isPricesLoading, priceError, news, isNewsLoading,
    refreshPrices: fetchPrices, refreshNews: fetchNews,
  }), [prices, isPricesLoading, priceError, news, isNewsLoading, fetchPrices, fetchNews]);

  const contextValue = useMemo(() => ({
    isDarkMode, toggleTheme,
    balanceVisible, toggleBalanceVisible,
    pinEnabled, refreshPinEnabled,
    walletAddress, walletName, setWalletName: handleSetWalletName,
    ethBalance, isLoadingBalance, hasWallet, isLoadingWallet, isReadOnly,
    balances, cardBalance, cardFrozen, network, transactions,
    cardDetails, cardCreated, createCard, updateCardDetails, generateCardDetails, cardTransactions,
    generateMnemonic: () => walletService.generateMnemonic(),
    createWallet, importWallet, deleteWallet, enterReadOnlyMode, refreshBalance, fetchBalance,
    sendETH, sendCrypto, topupCard, spendCard, toggleFreezeCard, applySwapBalances, switchNetwork,
  }), [
    isDarkMode, toggleTheme, balanceVisible, toggleBalanceVisible,
    pinEnabled, refreshPinEnabled, walletAddress, walletName, handleSetWalletName,
    ethBalance, isLoadingBalance, hasWallet, isLoadingWallet, isReadOnly,
    balances, cardBalance, cardFrozen, network, transactions,
    cardDetails, cardCreated, createCard, updateCardDetails, generateCardDetails, cardTransactions,
    createWallet, importWallet, deleteWallet, enterReadOnlyMode, refreshBalance, fetchBalance,
    sendETH, sendCrypto, topupCard, spendCard, toggleFreezeCard, applySwapBalances, switchNetwork,
  ]);

  return (
    <MarketContext.Provider value={marketValue}>
      <WalletContext.Provider value={contextValue}>
        {children}
      </WalletContext.Provider>
    </MarketContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
