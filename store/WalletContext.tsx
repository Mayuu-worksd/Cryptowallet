import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { Platform } from 'react-native';

// Web uses localStorage shim to avoid AsyncStorage hooks bundling error
let AsyncStorage: any;
if (Platform.OS === 'web') {
  AsyncStorage = {
    getItem:     async (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
    setItem:     async (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} },
    removeItem:  async (k: string) => { try { localStorage.removeItem(k); } catch {} },
    multiRemove: async (keys: string[]) => { try { keys.forEach(k => localStorage.removeItem(k)); } catch {} },
  };
} else {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
}
import { walletService } from '../services/walletService';
import { ethereumService } from '../services/ethereumService';
import { storageService } from '../services/storageService';
import { marketService, NewsItem } from '../services/marketService';
import { hasPinSetup, clearPin } from '../services/pinService';
import { DEFAULT_NETWORK } from '../constants';

export type Transaction = {
  id: string;
  type: 'sent' | 'received' | 'card_topup' | 'card_spend' | 'swap';
  coin: string;
  amount: string;
  usdValue: string;
  address: string;
  status: 'success' | 'pending' | 'failed';
  date: string;
  txHash?: string;
};

export type CoinPrice = { usd: number; change24h: number };

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

  balances: Record<string, number>;
  cardBalance: number;
  cardFrozen: boolean;
  network: string;
  transactions: Transaction[];

  prices: Record<string, CoinPrice>;
  isPricesLoading: boolean;
  news: NewsItem[];
  isNewsLoading: boolean;
  priceError: boolean;

  // Security
  balanceVisible: boolean;
  toggleBalanceVisible: () => void;
  pinEnabled: boolean;
  setupPin: () => void;

  generateMnemonic: () => string;
  createWallet: () => Promise<{ mnemonic: string; address: string }>;
  importWallet: (mnemonic: string) => Promise<void>;
  deleteWallet: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  refreshPrices: () => Promise<void>;
  refreshNews: () => Promise<void>;

  sendETH: (toAddress: string, amount: string) => Promise<{ success: boolean; error?: string; hash?: string }>;
  sendCrypto: (coin: string, amount: number, label: string) => void;

  topupCard: (coin: string, amount: number) => boolean;
  spendCard: (amount: number, label: string) => boolean;
  toggleFreezeCard: () => void;

  switchNetwork: (n: string) => void;
};

const WalletContext = createContext<WalletContextType>({} as WalletContextType);

const FALLBACK_PRICES: Record<string, CoinPrice> = {
  ETH:   { usd: 3450,  change24h: 0 },
  BTC:   { usd: 64000, change24h: 0 },
  USDT:  { usd: 1,     change24h: 0 },
  SOL:   { usd: 180,   change24h: 0 },
  MATIC: { usd: 0.85,  change24h: 0 },
};

export function WalletProvider({ children }: { children: ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const toggleTheme = () => setIsDarkMode(p => !p);

  const [balanceVisible, setBalanceVisible] = useState(true);
  const toggleBalanceVisible = () => setBalanceVisible(p => !p);
  const [pinEnabled, setPinEnabled] = useState(false);
  const setupPin = () => setPinEnabled(true); // triggers PIN setup UI in App.tsx via context

  // Check if PIN is already set on mount
  useEffect(() => {
    AsyncStorage.getItem('cw_pin_hash').then((v: string | null) => setPinEnabled(!!v)).catch(() => {});
  }, []);

  const [walletAddress, setWalletAddress] = useState('');
  const [walletName, setWalletName] = useState('Account 1');
  const [ethBalance, setEthBalance] = useState('0.0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);
  const [isLoadingWallet, setIsLoadingWallet] = useState(true);
  const [cardBalance, setCardBalance] = useState(0);
  const [cardFrozen, setCardFrozen] = useState(false);
  const [network, setNetworkState] = useState(DEFAULT_NETWORK);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({ ETH: 0, USDT: 0, BTC: 0, SOL: 0 });

  // ── Load persisted data on mount ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [savedTxs, savedCard] = await Promise.all([
          AsyncStorage.getItem('cw_transactions'),
          AsyncStorage.getItem('cw_card_balance'),
        ]);
        if (savedTxs)  setTransactions(JSON.parse(savedTxs));
        if (savedCard) setCardBalance(parseFloat(savedCard));
      } catch {}
    })();
  }, []);

  // ── Persist transactions whenever they change ──────────────────────────────
  useEffect(() => {
    AsyncStorage.setItem('cw_transactions', JSON.stringify(transactions)).catch(() => {});
  }, [transactions]);

  // ── Persist card balance whenever it changes ───────────────────────────────
  useEffect(() => {
    AsyncStorage.setItem('cw_card_balance', String(cardBalance)).catch(() => {});
  }, [cardBalance]);

  const [prices, setPrices] = useState<Record<string, CoinPrice>>(FALLBACK_PRICES);
  const [isPricesLoading, setIsPricesLoading] = useState(true);
  const [priceError, setPriceError] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isNewsLoading, setIsNewsLoading] = useState(true);

  const priceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const newsIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPrices = useCallback(async () => {
    try {
      setPriceError(false);
      const data = await marketService.fetchPrices();
      if (Object.keys(data).length > 0) setPrices(prev => ({ ...prev, ...data }));
      else setPriceError(true);
    } catch {
      setPriceError(true);
    } finally {
      setIsPricesLoading(false);
    }
  }, []);

  const refreshPrices = useCallback(async () => {
    setIsPricesLoading(true);
    await fetchPrices();
  }, [fetchPrices]);

  const fetchNews = useCallback(async () => {
    setIsNewsLoading(true);
    try {
      const data = await marketService.fetchNews();
      setNews(data); // always update, even if empty
    } catch {
      // keep existing news on failure
    } finally {
      setIsNewsLoading(false);
    }
  }, []);

  const refreshNews = useCallback(async () => { await fetchNews(); }, [fetchNews]);

  useEffect(() => {
    fetchPrices();
    fetchNews();
    priceIntervalRef.current = setInterval(fetchPrices, 30_000);
    newsIntervalRef.current  = setInterval(fetchNews, 300_000);
    return () => {
      if (priceIntervalRef.current) clearInterval(priceIntervalRef.current);
      if (newsIntervalRef.current)  clearInterval(newsIntervalRef.current);
    };
  }, [fetchPrices, fetchNews]);

  useEffect(() => {
    (async () => {
      try {
        const exists = await walletService.walletExists();
        if (exists) {
          const address   = await storageService.getWalletAddress();
          const savedName = await storageService.getWalletName();
          if (address) {
            setWalletAddress(address);
            setHasWallet(true);
            if (savedName) setWalletName(savedName);
            fetchBalance(address, DEFAULT_NETWORK);
          }
        }
      } catch (e) {
        console.error('Wallet load error:', e);
      } finally {
        setIsLoadingWallet(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!walletAddress) return;
    const interval = setInterval(() => fetchBalance(walletAddress, network), 30_000);
    return () => clearInterval(interval);
  }, [walletAddress, network]);

  const fetchBalance = async (address: string, net: string) => {
    setIsLoadingBalance(true);
    try {
      const [ethBal, usdtBal] = await Promise.all([
        ethereumService.getETHBalance(address, net),
        ethereumService.getTokenBalance(address, 'USDT', net),
      ]);
      const parsed = parseFloat(ethBal);
      setEthBalance(parsed.toFixed(6));
      setBalances(prev => ({ ...prev, ETH: parsed, USDT: usdtBal }));
    } catch (e) {
      console.error('Balance error:', e);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const refreshBalance = async () => {
    if (walletAddress) await fetchBalance(walletAddress, network);
  };

  const handleSetWalletName = useCallback(async (name: string) => {
    setWalletName(name);
    await storageService.saveWalletName(name);
  }, []);

  const addTx = (tx: Omit<Transaction, 'id' | 'date'>) => {
    setTransactions(prev => [{
      ...tx,
      id:   Date.now().toString(),
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    }, ...prev]);
  };

  // This only generates — doesn't set hasWallet until verified
  const createWallet = async (): Promise<{ mnemonic: string; address: string }> => {
    return walletService.generateWalletPreview();
  };

  const importWallet = async (mnemonic: string): Promise<void> => {
    const data = await walletService.importFromMnemonic(mnemonic);
    await clearPin();
    setPinEnabled(false);
    setWalletAddress(data.address);
    setWalletName('Main Wallet');
    await storageService.saveWalletName('Main Wallet');
    setHasWallet(true);
    fetchBalance(data.address, network);
  };

  const deleteWallet = async (): Promise<void> => {
    await walletService.deleteWallet();
    await clearPin();
    await AsyncStorage.multiRemove(['cw_transactions', 'cw_card_balance']);
    setWalletAddress('');
    setEthBalance('0.0');
    setHasWallet(false);
    setTransactions([]);
    setCardBalance(0);
    setWalletName('Account 1');
    setBalances({ ETH: 0, USDT: 0, BTC: 0, SOL: 0 });
    setPinEnabled(false);
  };

  const sendETH = async (toAddress: string, amount: string): Promise<{ success: boolean; error?: string; hash?: string }> => {
    if (!walletService.isValidAddress(toAddress))
      return { success: false, error: 'Invalid Ethereum address. Please check and try again.' };
    const parsedAmt  = parseFloat(amount);
    const currentBal = parseFloat(ethBalance);
    if (isNaN(parsedAmt) || parsedAmt <= 0)
      return { success: false, error: 'Enter a valid amount greater than 0.' };
    if (parsedAmt >= currentBal)
      return { success: false, error: `Insufficient balance. You need to keep some ETH for gas fees.` };

    const privateKey = await storageService.getPrivateKey();
    if (!privateKey) return { success: false, error: 'Wallet not found. Please re-import.' };

    const ethPrice = prices.ETH?.usd ?? 3450;
    addTx({ type: 'sent', coin: 'ETH', amount, usdValue: (parsedAmt * ethPrice).toFixed(2), address: toAddress, status: 'pending' });

    const result = await ethereumService.sendETH(privateKey, toAddress, amount, network);
    setTransactions(prev => prev.map((tx, i) =>
      i === 0 ? { ...tx, status: result.success ? 'success' : 'failed', txHash: result.hash } : tx
    ));
    if (result.success) await refreshBalance();
    return result;
  };

  const sendCrypto = (coin: string, amount: number, label: string) => {
    const coinPrice = prices[coin]?.usd ?? 1;
    setBalances(prev => ({ ...prev, [coin]: Math.max(0, +(prev[coin] - amount).toFixed(6)) }));
    addTx({ type: 'swap', coin, amount: amount.toString(), usdValue: (amount * coinPrice).toFixed(2), address: label, status: 'success' });
  };

  const topupCard = (coin: string, amount: number): boolean => {
    const coinPrice  = prices[coin]?.usd ?? 1;
    const currentBal = coin === 'ETH' ? parseFloat(ethBalance) : (balances[coin] ?? 0);
    if (amount > currentBal) return false;
    if (coin === 'ETH') {
      const newBal = Math.max(0, parseFloat(ethBalance) - amount);
      setEthBalance(newBal.toFixed(6));
      setBalances(prev => ({ ...prev, ETH: newBal }));
    } else {
      setBalances(prev => ({ ...prev, [coin]: Math.max(0, +(prev[coin] - amount).toFixed(6)) }));
    }
    const usd = amount * coinPrice;
    setCardBalance(prev => +(prev + usd).toFixed(2));
    addTx({ type: 'card_topup', coin, amount: amount.toString(), usdValue: usd.toFixed(2), address: 'Virtual Card', status: 'success' });
    return true;
  };

  const spendCard = (amount: number, label: string): boolean => {
    if (cardFrozen || cardBalance < amount) return false;
    setCardBalance(prev => +(prev - amount).toFixed(2));
    addTx({ type: 'card_spend', coin: 'USD', amount: amount.toString(), usdValue: amount.toFixed(2), address: label, status: 'success' });
    return true;
  };

  const toggleFreezeCard = () => setCardFrozen(prev => !prev);

  const switchNetwork = (n: string) => {
    ethereumService.switchNetwork(n);
    setNetworkState(n);
    if (walletAddress) fetchBalance(walletAddress, n);
  };

  return (
    <WalletContext.Provider value={{
      isDarkMode, toggleTheme,
      balanceVisible, toggleBalanceVisible,
      pinEnabled, setupPin,
      walletAddress, walletName, setWalletName: handleSetWalletName,
      ethBalance, isLoadingBalance, hasWallet, isLoadingWallet,
      balances, cardBalance, cardFrozen, network, transactions,
      prices, isPricesLoading, priceError, news, isNewsLoading,
      generateMnemonic: () => walletService.generateMnemonic(),
      createWallet, importWallet, deleteWallet, refreshBalance, refreshPrices, refreshNews,
      sendETH, sendCrypto, topupCard, spendCard, toggleFreezeCard, switchNetwork,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
