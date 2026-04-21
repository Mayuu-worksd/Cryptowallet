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

export type CardTransaction = {
  id: string;
  type: 'topup' | 'spend';
  amount: number;        // USDT value
  label: string;
  coin?: string;         // source coin for topups
  coinAmount?: number;   // source coin amount for topups
  status: 'success';
  timestamp: string;     // ISO string
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
  refreshPinEnabled: () => Promise<void>;

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
  cardTransactions: CardTransaction[];

  cardDetails: {
    number: string;
    expiry: string;
    cvv: string;
    brand: 'VISA' | 'MASTERCARD';
    holderName: string;
    design: string;
  };
  cardCreated: boolean;
  createCard: (holderName: string, design: string) => void;
  updateCardDetails: (patch: { holderName?: string; design?: string }) => void;
  generateCardDetails: () => void;

  switchNetwork: (n: string) => void;
};

const WalletContext = createContext<WalletContextType>({} as WalletContextType);

const FALLBACK_PRICES: Record<string, CoinPrice> = {
  ETH:   { usd: 3450,  change24h: 0 },
  BTC:   { usd: 64000, change24h: 0 },
  USDT:  { usd: 1,     change24h: 0 },
  SOL:   { usd: 180,   change24h: 0 },
  MATIC: { usd: 0.85,  change24h: 0 },
  BNB:   { usd: 580,   change24h: 0 },
};

// ── Number formatting helpers ─────────────────────────────────────────────────
export function formatUSD(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000)     return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (value >= 1)         return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
}

export function formatCrypto(value: number, symbol: string): string {
  if (value === 0) return `0 ${symbol}`;
  if (value < 0.000001) return `<0.000001 ${symbol}`;
  if (value < 0.01)     return `${value.toFixed(6)} ${symbol}`;
  if (value < 1)        return `${value.toFixed(4)} ${symbol}`;
  return `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${symbol}`;
}

export function formatPrice(usd: number): string {
  if (usd >= 1000) return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (usd >= 1)    return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(6)}`;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const toggleTheme = () => setIsDarkMode(p => !p);

  const [balanceVisible, setBalanceVisible] = useState(true);
  const toggleBalanceVisible = () => setBalanceVisible(p => !p);
  const [pinEnabled, setPinEnabled] = useState(false);

  // Check PIN status on mount and expose a refresh function
  const refreshPinEnabled = useCallback(async () => {
    const has = await hasPinSetup();
    setPinEnabled(has);
  }, []);

  useEffect(() => {
    refreshPinEnabled();
  }, []);

  const [walletAddress, setWalletAddress] = useState('');
  const [walletName, setWalletName] = useState('Account 1');
  const [ethBalance, setEthBalance] = useState('0.0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);
  const [isLoadingWallet, setIsLoadingWallet] = useState(true);
  const [cardBalance, setCardBalance] = useState(0);
  const [cardFrozen, setCardFrozen] = useState(false);
  const [cardTransactions, setCardTransactions] = useState<CardTransaction[]>([]);
  const [cardCreated, setCardCreated] = useState(false);
  const [cardDetails, setCardDetails] = useState({
    number: '•••• •••• •••• ••••',
    expiry: '••/••',
    cvv: '•••',
    brand: 'VISA' as const,
    holderName: 'MAYUR K',
    design: 'dark',
  });
  const [network, setNetworkState] = useState(DEFAULT_NETWORK);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({ ETH: 0, USDT: 0, BTC: 0, SOL: 0 });

  // Guard: don't persist until initial load from storage is complete
  const dataLoaded = useRef(false);

  // ── Load persisted data on mount ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [savedTxs, savedCard, savedDetails, savedCardTxs, savedCreated] = await Promise.all([
          AsyncStorage.getItem('cw_transactions'),
          AsyncStorage.getItem('cw_card_balance'),
          AsyncStorage.getItem('cw_card_details'),
          AsyncStorage.getItem('cw_card_transactions'),
          AsyncStorage.getItem('cw_card_created'),
        ]);
        if (savedTxs)      setTransactions(JSON.parse(savedTxs));
        if (savedCard)     setCardBalance(parseFloat(savedCard));
        if (savedCardTxs)  setCardTransactions(JSON.parse(savedCardTxs));
        if (savedCreated)  setCardCreated(savedCreated === 'true');
        if (savedDetails)  setCardDetails(JSON.parse(savedDetails));
        else generateCardDetails();
      } catch {}
      // Mark load complete — persist effects are now safe to run
      dataLoaded.current = true;
    })();
  }, []);

  // ── Persist transactions whenever they change ──────────────────────────────
  useEffect(() => {
    if (!dataLoaded.current) return;
    AsyncStorage.setItem('cw_transactions', JSON.stringify(transactions)).catch(() => {});
  }, [transactions]);

  // ── Persist card balance whenever it changes ───────────────────────────────
  useEffect(() => {
    if (!dataLoaded.current) return;
    AsyncStorage.setItem('cw_card_balance', String(cardBalance)).catch(() => {});
  }, [cardBalance]);

  // ── Persist card details ────────────────────────────────────────────────────
  useEffect(() => {
    if (!dataLoaded.current) return;
    if (cardDetails.number !== '•••• •••• •••• ••••') {
      AsyncStorage.setItem('cw_card_details', JSON.stringify(cardDetails)).catch(() => {});
    }
  }, [cardDetails]);

  // ── Persist card transactions ──────────────────────────────────────────────
  useEffect(() => {
    if (!dataLoaded.current) return;
    AsyncStorage.setItem('cw_card_transactions', JSON.stringify(cardTransactions)).catch(() => {});
  }, [cardTransactions]);

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
    generateCardDetails('MAIN WALLET');
    fetchBalance(data.address, network);
  };

  const deleteWallet = async (): Promise<void> => {
    await walletService.deleteWallet();
    await clearPin();
    await AsyncStorage.multiRemove(['cw_transactions', 'cw_card_balance', 'cw_card_details', 'cw_card_transactions', 'cw_card_created']);
    setCardTransactions([]);
    setCardCreated(false);
    setWalletAddress('');
    setEthBalance('0.0');
    setHasWallet(false);
    setTransactions([]);
    setCardBalance(0);
    setWalletName('Account 1');
    setBalances({ ETH: 0, USDT: 0, BTC: 0, SOL: 0 });
    setCardDetails({ number: '•••• •••• •••• ••••', expiry: '••/••', cvv: '•••', brand: 'VISA', holderName: 'CARD HOLDER', design: 'dark' });
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

  const addCardTx = (tx: Omit<CardTransaction, 'id' | 'timestamp'>) => {
    setCardTransactions(prev => [{
      ...tx,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
    }, ...prev]);
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
    const usd = +(amount * coinPrice).toFixed(2);
    setCardBalance(prev => +(prev + usd).toFixed(2));
    addTx({ type: 'card_topup', coin, amount: amount.toString(), usdValue: usd.toFixed(2), address: 'Virtual Card', status: 'success' });
    addCardTx({ type: 'topup', amount: usd, label: `Top-up via ${coin}`, coin, coinAmount: amount, status: 'success' });
    return true;
  };

  const spendCard = (amount: number, label: string): boolean => {
    if (cardFrozen || cardBalance < amount) return false;
    setCardBalance(prev => +(prev - amount).toFixed(2));
    addTx({ type: 'card_spend', coin: 'USD', amount: amount.toString(), usdValue: amount.toFixed(2), address: label, status: 'success' });
    addCardTx({ type: 'spend', amount, label, status: 'success' });
    return true;
  };

  const toggleFreezeCard = () => setCardFrozen(prev => !prev);

  const generateCardDetails = useCallback((name?: string) => {
    const rand = () => Math.floor(1000 + Math.random() * 9000);
    const num = `4532 ${rand()} ${rand()} ${rand()}`;
    const cvv = String(Math.floor(100 + Math.random() * 900));
    const exp = new Date();
    exp.setFullYear(exp.getFullYear() + 4);
    const expiry = `${String(exp.getMonth() + 1).padStart(2, '0')}/${String(exp.getFullYear()).slice(-2)}`;
    const holderName = (name ?? walletName).toUpperCase().trim() || 'CARD HOLDER';
    setCardDetails(prev => ({ ...prev, number: num, expiry, cvv, brand: 'VISA', holderName }));
  }, [walletName]);

  const createCard = useCallback((holderName: string, design: string) => {
    // Generate unique card number using timestamp + random entropy
    const rand = () => Math.floor(1000 + Math.random() * 9000);
    const num = `4532 ${rand()} ${rand()} ${rand()}`;
    const cvv = String(Math.floor(100 + Math.random() * 900));
    // Expiry = 4 years from now
    const exp = new Date();
    exp.setFullYear(exp.getFullYear() + 4);
    const expiry = `${String(exp.getMonth() + 1).padStart(2, '0')}/${String(exp.getFullYear()).slice(-2)}`;
    const details = { number: num, expiry, cvv, brand: 'VISA' as const, holderName: holderName.toUpperCase().trim(), design };
    setCardDetails(details);
    setCardCreated(true);
    AsyncStorage.setItem('cw_card_created', 'true').catch(() => {});
    AsyncStorage.setItem('cw_card_details', JSON.stringify(details)).catch(() => {});
  }, []);

  const updateCardDetails = useCallback((patch: { holderName?: string; design?: string }) => {
    setCardDetails(prev => {
      const updated = {
        ...prev,
        ...(patch.holderName ? { holderName: patch.holderName.toUpperCase().trim() } : {}),
        ...(patch.design     ? { design: patch.design } : {}),
      };
      AsyncStorage.setItem('cw_card_details', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const switchNetwork = (n: string) => {
    ethereumService.switchNetwork(n);
    setNetworkState(n);
    if (walletAddress) fetchBalance(walletAddress, n);
  };

  return (
    <WalletContext.Provider value={{
      isDarkMode, toggleTheme,
      balanceVisible, toggleBalanceVisible,
      pinEnabled, refreshPinEnabled,
      walletAddress, walletName, setWalletName: handleSetWalletName,
      ethBalance, isLoadingBalance, hasWallet, isLoadingWallet,
      balances, cardBalance, cardFrozen, network, transactions,
      prices, isPricesLoading, priceError, news, isNewsLoading,
      cardDetails, cardCreated, createCard, updateCardDetails, generateCardDetails, cardTransactions,
      generateMnemonic: () => walletService.generateMnemonic(),
      createWallet, importWallet, deleteWallet, refreshBalance, refreshPrices, refreshNews,
      sendETH, sendCrypto, topupCard, spendCard, toggleFreezeCard, switchNetwork,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
