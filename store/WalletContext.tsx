import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback, useMemo } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { walletService } from '../services/walletService';
import { ethereumService } from '../services/ethereumService';
import { getWalletBalances } from '../services/balanceService';
import { storageService } from '../services/storageService';
import { marketService, NewsItem } from '../services/marketService';
import { hasPinSetup, clearPin } from '../services/pinService';
import { kycService, KYCStatus, txService, dbCardService, vccService, cardVariantService, VCCCard, profileService } from '../services/supabaseService';
import { transactionService } from '../services/transactionService';
import { cardService } from '../services/cardService';
import { supabase, setWallet, clearWalletSession } from '../services/supabaseClient';
import { notificationService } from '../services/notificationService';
import { DEFAULT_NETWORK, NETWORK_INFO } from '../constants';
import { ESCROW_CONTRACTS } from '../services/escrowService';
import { SUPPORTED_TOKENS, SUPPORTED_FIAT_CURRENCIES } from '../constants/currencyConfig';

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
  contractAddress?: string;
  isInternal?: boolean;
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
  accountType: 'personal' | 'business';
  accountTypeSet: boolean;
  setAccountType: (type: 'personal' | 'business') => Promise<void>;
  p2pCountry: string;
  p2pCurrency: string;
  setP2PPreferences: (country: string, currency: string) => Promise<void>;
  lockedBalance: Record<string, number>;
  lockBalance: (token: string, amount: number) => void;
  unlockBalance: (token: string, amount: number) => void;
  kycStatus: KYCStatus;
  refreshKYCStatus: () => Promise<void>;
  walletAddress: string;
  tronAddress: string;
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
  isSyncing: boolean;
  toggleBalanceVisible: () => void;
  pinEnabled: boolean;
  addTx: (tx: Omit<Transaction, 'id' | 'date'>) => string;
  updateTxStatus: (id: string, status: Transaction['status']) => void;
  refreshPinEnabled: () => Promise<void>;
  generateMnemonic: () => string;
  createWallet: () => Promise<{ mnemonic: string; address: string }>;
  importWallet: (mnemonic: string, isNew?: boolean, preferredNetwork?: string) => Promise<void>;
  deleteWallet: () => Promise<void>;
  enterReadOnlyMode: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  refreshCardData: () => Promise<void>;
  fetchBalance: (address: string, net: string) => Promise<void>;
  sendETH: (toAddress: string, amount: string) => Promise<{ success: boolean; error?: string; hash?: string }>;
  sendCrypto: (coin: string, amount: number, label: string) => void;
  topupCard: (coin: string, amount: number) => boolean;
  spendCard: (coin: string, amountUSD: number, label: string) => boolean;
  toggleFreezeCard: () => void;
  cardTransactions: CardTransaction[];
  cardDetails: { number: string; expiry: string; cvv: string; brand: 'VISA' | 'MASTERCARD'; holderName: string; design: string };
  setCardDetails: (details: any) => void;
  cardCreated: boolean;
  createCard: (holderName: string, design: string) => void;
  updateCardDetails: (patch: { holderName?: string; design?: string }) => void;
  generateCardDetails: () => void;
  applySwapBalances: (sellToken: string, sellAmt: number, buyToken: string, buyAmt: number) => Promise<void>;
  switchNetwork: (n: string) => void | Promise<void>;
  creditP2PBalance: (token: string, amount: number) => void;
  resetLockedBalances: () => void;
  fiatCurrency: string;
  setFiatCurrency: (currency: string) => Promise<void>;
  formatFiat: (amountUSD: number) => string;
  convertFiat: (amountUSD: number) => number;
  fiatSymbol: string;
  isGlobalLoading: boolean;
  setGlobalLoading: (loading: boolean, message?: string) => void;
  globalLoadingMessage: string;
};

const WalletContext = createContext<WalletContextType>({} as WalletContextType);

// Zero fallback — real prices always come from CoinGecko via marketService.
// Using 0 ensures the UI shows a loading state rather than stale hardcoded values.
const FALLBACK_PRICES: Record<string, CoinPrice> = Object.fromEntries(
  Object.keys(SUPPORTED_TOKENS).map(k => [k, { usd: 0, change24h: 0 }])
);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [isDarkMode,       setIsDarkMode]       = useState(true);
  const [fiatCurrency,     setFiatCurrencyState] = useState('USD');
  const [accountType,      setAccountTypeState] = useState<'personal' | 'business'>('personal');
  const [accountTypeSet,   setAccountTypeSet]   = useState(false);
  const [p2pCountry,       setP2PCountryState]  = useState('India');
  const [p2pCurrency,      setP2PCurrencyState] = useState('INR');
  const [lockedBalance,    setLockedBalance]    = useState<Record<string, number>>({});
  const [kycStatus,        setKycStatus]        = useState<KYCStatus>(null);
  const [balanceVisible,   setBalanceVisible]   = useState(true);
  const [pinEnabled,       setPinEnabled]       = useState(false);
  const [walletAddress,    setWalletAddress]    = useState('');
  const [tronAddress,      setTronAddress]      = useState('');
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
  const [cardDetails,      setCardDetails]      = useState<{ number: string; expiry: string; cvv: string; brand: 'VISA' | 'MASTERCARD'; holderName: string; design: string }>({
    number: '\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022',
    expiry: '\u2022\u2022/\u2022\u2022',
    cvv: '\u2022\u2022\u2022',
    brand: 'VISA',
    holderName: 'CARD HOLDER',
    design: 'dark',
  });
  const [network,         setNetworkState]  = useState(DEFAULT_NETWORK);
  const [transactions,    setTransactions]  = useState<Transaction[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>(
    Object.fromEntries(Object.keys(SUPPORTED_TOKENS).map(k => [k, 0]))
  );
  const [prices,          setPrices]        = useState<Record<string, CoinPrice>>(FALLBACK_PRICES);
  const [isPricesLoading, setIsPricesLoading] = useState(true);
  const [priceError,      setPriceError]    = useState(false);
  const [news,            setNews]          = useState<NewsItem[]>([]);
  const [isNewsLoading,   setIsNewsLoading] = useState(true);
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [globalLoadingMessage, setGlobalLoadingMessage] = useState('LOADING');

  const [dataLoaded,     setDataLoaded]     = useState(false);
  const [isSyncing,      setIsSyncing]      = useState(false);
  const pendingAddressRef  = useRef<{ address: string; net: string } | null>(null);
  const ethBalanceRef      = useRef('0.0');
  const balancesRef        = useRef<Record<string, number>>(
    Object.fromEntries(Object.keys(SUPPORTED_TOKENS).map(k => [k, 0]))
  );
  const priceIntervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const newsIntervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const balanceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncInProgressRef  = useRef(false);

  useEffect(() => { ethBalanceRef.current = ethBalance; }, [ethBalance]);

  const toggleTheme = useCallback(async () => {
    setIsDarkMode(prev => {
      const newVal = !prev;
      AsyncStorage.setItem('cw_is_dark_mode', String(newVal)).catch(() => {});
      // Persist to Supabase
      if (walletAddress) {
        profileService.upsert(walletAddress, { is_dark_mode: newVal }).catch(() => {});
      }
      return newVal;
    });
  }, [walletAddress]);

  const setAccountType = useCallback(async (type: 'personal' | 'business') => {
    setAccountTypeState(type);
    setAccountTypeSet(true);
    await AsyncStorage.setItem('cw_account_type', type);
    if (walletAddress) {
      profileService.upsert(walletAddress, { account_type: type }).catch(() => {});
    }
  }, [walletAddress]);

  const setP2PPreferences = useCallback(async (country: string, currency: string) => {
    setP2PCountryState(country);
    setP2PCurrencyState(currency);
    await AsyncStorage.setItem('cw_p2p_country', country);
    await AsyncStorage.setItem('cw_p2p_currency', currency);
    if (walletAddress) {
      profileService.upsert(walletAddress, { p2p_country: country, p2p_currency: currency }).catch(() => {});
    }
  }, [walletAddress]);

  const lockBalance = useCallback((token: string, amount: number) => {
    setLockedBalance(prev => {
      const updated = { ...prev, [token]: (prev[token] || 0) + amount };
      AsyncStorage.setItem('cw_locked_balance', JSON.stringify(updated)).catch(() => {});
      if (walletAddress) profileService.upsert(walletAddress, { locked_balances: updated }).catch(() => {});
      return updated;
    });
  }, [walletAddress]);

  const unlockBalance = useCallback((token: string, amount: number) => {
    setLockedBalance(prev => {
      const updated = { ...prev, [token]: Math.max(0, (prev[token] || 0) - amount) };
      AsyncStorage.setItem('cw_locked_balance', JSON.stringify(updated)).catch(() => {});
      if (walletAddress) profileService.upsert(walletAddress, { locked_balances: updated }).catch(() => {});
      return updated;
    });
  }, [walletAddress]);

  const resetLockedBalances = useCallback(() => {
    setLockedBalance({});
    AsyncStorage.removeItem('cw_locked_balance').catch(() => {});
    if (walletAddress) profileService.upsert(walletAddress, { locked_balances: {} }).catch(() => {});
  }, [walletAddress]);

  // Directly credit a P2P received amount into local balance state.
  // Testnet: no real on-chain transfer — update local state directly.
  // Mainnet with contract deployed: real ETH moved on-chain — poll RPC until balance updates.
  // Mainnet without contract: same as testnet (simulated).
  const fetchBalance = useCallback(async (address: string, net: string) => {
    setIsLoadingBalance(true);
    try {
      const isTronNet = net === 'TRON' || net === 'TRON Nile';
      let fetchAddr = address;
      if (isTronNet) {
        // Always use the TRON address for TRON networks
        const stored = await storageService.getTronAddress();
        if (stored) {
          fetchAddr = stored;
          if (!tronAddress) setTronAddress(stored);
        } else {
          const mnemonic = await storageService.getMnemonic();
          if (mnemonic) {
            const { deriveTronAddress } = await import('../services/tronService');
            const tron = await deriveTronAddress(mnemonic);
            fetchAddr = tron.address;
            setTronAddress(tron.address);
            storageService.saveTronAddress(tron.address).catch(() => {});
            // Persist TRON address to Supabase
            if (walletAddress) profileService.upsert(walletAddress, { tron_address: tron.address }).catch(() => {});
          } else {
            setIsLoadingBalance(false);
            return;
          }
        }
      }
      const onChain = await getWalletBalances(fetchAddr, net, balancesRef.current);
      // Only preserve cross-chain balances (BTC, SOL, BNB, XRP, TON, SUI) — never bleed EVM/TRON chain values
      const crossChain = { BTC: balancesRef.current.BTC ?? 0, SOL: balancesRef.current.SOL ?? 0, BNB: balancesRef.current.BNB ?? 0, XRP: balancesRef.current.XRP ?? 0, TON: balancesRef.current.TON ?? 0, SUI: balancesRef.current.SUI ?? 0 };
      // onChain returns 0 for cross-chain tokens — preserve local values for those
      const merged = {
        ...onChain,
        BTC: onChain.BTC > 0 ? onChain.BTC : crossChain.BTC,
        SOL: onChain.SOL > 0 ? onChain.SOL : crossChain.SOL,
        BNB: onChain.BNB > 0 ? onChain.BNB : crossChain.BNB,
        XRP: onChain.XRP > 0 ? onChain.XRP : crossChain.XRP,
        TON: onChain.TON > 0 ? onChain.TON : crossChain.TON,
        SUI: onChain.SUI > 0 ? onChain.SUI : crossChain.SUI,
      };
      if (isTronNet) {
        if ((balancesRef.current?.ETH ?? 0) > 0 && merged.ETH === 0) merged.ETH = balancesRef.current.ETH;
        if ((balancesRef.current?.USDT_ERC20 ?? 0) > 0 && merged.USDT_ERC20 === 0) merged.USDT_ERC20 = balancesRef.current.USDT_ERC20;
        if ((balancesRef.current?.USDC_ERC20 ?? 0) > 0 && merged.USDC_ERC20 === 0) merged.USDC_ERC20 = balancesRef.current.USDC_ERC20;
      } else {
        if ((balancesRef.current?.TRX ?? 0) > 0 && merged.TRX === 0) merged.TRX = balancesRef.current.TRX;
        if ((balancesRef.current?.USDT_TRC20 ?? 0) > 0 && merged.USDT_TRC20 === 0) merged.USDT_TRC20 = balancesRef.current.USDT_TRC20;
        if ((balancesRef.current?.USDC_TRC20 ?? 0) > 0 && merged.USDC_TRC20 === 0) merged.USDC_TRC20 = balancesRef.current.USDC_TRC20;
      }
      setEthBalance(Number(merged.ETH || 0).toFixed(6));
      ethBalanceRef.current = Number(merged.ETH || 0).toFixed(6);
      setBalances(merged);
      balancesRef.current = merged;
      await AsyncStorage.setItem('cw_token_balances', JSON.stringify(merged));
      // Persist balances to Supabase
      if (walletAddress) profileService.upsert(walletAddress, { token_balances: merged }).catch(() => {});
    } catch (e) {
    } finally {
      setIsLoadingBalance(false);
    }
  }, [tronAddress, walletAddress]);

  const creditP2PBalance = useCallback((token: string, amount: number) => {
    const isTestnet = NETWORK_INFO[network]?.type === 'Testnet';
    const contractDeployed = !!(ESCROW_CONTRACTS && ESCROW_CONTRACTS[network]);
    const isRealOnChain = !isTestnet && contractDeployed;

    if (isRealOnChain) {
      // Real on-chain transfer happened — poll RPC every 3s until balance reflects it
      const expectedMin = token === 'ETH'
        ? parseFloat(ethBalanceRef.current) + amount * 0.99 // allow for gas
        : (balancesRef.current[token] || 0) + amount * 0.99;

      let attempts = 0;
      const poll = async () => {
        attempts++;
        await fetchBalance(walletAddress, network);
        const current = token === 'ETH'
          ? parseFloat(ethBalanceRef.current)
          : (balancesRef.current[token] || 0);
        if (current >= expectedMin || attempts >= 20) return; // stop after 60s
        setTimeout(poll, 3000);
      };
      poll();
      return;
    }

    // Testnet or no contract — update local state directly
    if (token === 'ETH') {
      setEthBalance(prev => {
        const next = Math.max(0, parseFloat(prev) + amount).toFixed(6);
        ethBalanceRef.current = next;
        setBalances(b => {
          const nb = { ...b, ETH: parseFloat(next) };
          balancesRef.current = nb;
          AsyncStorage.setItem('cw_token_balances', JSON.stringify(nb)).catch(() => {});
          return nb;
        });
        return next;
      });
    } else {
      setBalances(prev => {
        const next = { ...prev, [token]: Math.max(0, (prev[token] || 0) + amount) };
        balancesRef.current = next;
        AsyncStorage.setItem('cw_token_balances', JSON.stringify(next)).catch(() => {});
        return next;
      });
    }
  }, [network, walletAddress, fetchBalance]);

  const toggleBalanceVisible = useCallback(() => setBalanceVisible(p => !p), []);
  const toggleFreezeCard = useCallback(() => {
    setCardFrozen(p => {
      const newVal = !p;
      cardService.setCardFrozen(newVal);
      // Persist freeze state to Supabase (check both tables for safety during migration)
      dbCardService.updateStatus(walletAddress, newVal ? 'frozen' : 'active').catch(() => {});
      vccService.updateStatus(walletAddress, newVal ? 'frozen' : 'active').catch(() => {});
      return newVal;
    });
  }, [walletAddress]);

  const refreshPinEnabled = useCallback(async () => {
    setPinEnabled(await hasPinSetup());
  }, []);

  const refreshKYCStatus = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const record = await kycService.getStatus(walletAddress);
      setKycStatus(record?.status ?? null);
    } catch (_e) {}
  }, [walletAddress]);

  useEffect(() => { refreshPinEnabled(); }, []);

  const addTx = useCallback((tx: Omit<Transaction, 'id' | 'date'>) => {
    const id = Date.now().toString();
    setTransactions(prev => [{
      ...tx,
      id,
      date:    new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      rawDate: Date.now(),
    }, ...prev]);
    return id;
  }, []);

  const updateTxStatus = useCallback((id: string, status: Transaction['status']) => {
    setTransactions(prev => prev.map(tx => tx.id === id ? { ...tx, status } : tx));
  }, []);

  // On startup: heal any P2P pending txs by checking their order status in Supabase
  const healP2PPendingTxs = useCallback(async (address: string, txList: Transaction[]) => {
    const pendingP2P = txList.filter(
      t => t.status === 'pending' && t.type === 'received' &&
      t.address?.includes('P2P Buy')
    );
    if (pendingP2P.length === 0) return;
    try {
      const { supabase } = await import('../services/supabaseClient');
      const { data: completedOrders } = await supabase
        .from('p2p_orders')
        .select('id, status, token, amount, fiat_total, fiat_currency')
        .eq('buyer_wallet', address.toLowerCase())
        .eq('status', 'completed');
      if (!completedOrders || completedOrders.length === 0) return;
      // Match pending txs to completed orders by token + amount
      setTransactions(prev => prev.map(tx => {
        if (tx.status !== 'pending' || tx.type !== 'received' || !tx.address?.includes('P2P Buy')) return tx;
        const match = completedOrders.find(
          o => o.token === tx.coin && Math.abs(o.amount - parseFloat(tx.amount)) < 0.000001
        );
        return match ? { ...tx, status: 'success' } : tx;
      }));
    } catch {}
  }, []);

  const addCardTx = useCallback((tx: Omit<CardTransaction, 'id' | 'timestamp'>) => {
    setCardTransactions(prev => [{ ...tx, id: Date.now().toString(), timestamp: new Date().toISOString() }, ...prev]);
  }, []);

  useEffect(() => {
    const startup = async () => {
      try {
        // Load UI preferences first (fastest)
        const [savedDarkMode, savedAccountType, savedP2PCountry, savedP2PCurrency, savedLockedBal, savedFiatCurrency] = await Promise.all([
          AsyncStorage.getItem('cw_is_dark_mode'),
          AsyncStorage.getItem('cw_account_type'),
          AsyncStorage.getItem('cw_p2p_country'),
          AsyncStorage.getItem('cw_p2p_currency'),
          AsyncStorage.getItem('cw_locked_balance'),
          AsyncStorage.getItem('cw_fiat_currency'),
        ]);

        if (savedDarkMode !== null) setIsDarkMode(savedDarkMode === 'true');
        if (savedFiatCurrency !== null) setFiatCurrencyState(savedFiatCurrency);
        if (savedAccountType === 'business') setAccountTypeState('business');
        if (savedP2PCountry)  setP2PCountryState(savedP2PCountry);
        if (savedP2PCurrency) setP2PCurrencyState(savedP2PCurrency);
        if (savedLockedBal)   setLockedBalance(JSON.parse(savedLockedBal));

        if (savedAccountType && savedP2PCountry && savedP2PCurrency) {
          setAccountTypeSet(true);
        }

        const address = await storageService.getWalletAddress();
        if (address) {
          setWalletAddress(address);
          setHasWallet(true);
          // FIX 1: set wallet in Supabase session so RLS policies work
          setWallet(address).catch(() => {});
          // Load TRON address — derive from mnemonic if not yet stored
          storageService.getTronAddress().then(async t => {
            if (t) { setTronAddress(t); return; }
            const mnemonic = await storageService.getMnemonic();
            if (!mnemonic) return;
            const { deriveTronAddress } = await import('../services/tronService');
            const tron = await deriveTronAddress(mnemonic);
            setTronAddress(tron.address);
            storageService.saveTronAddress(tron.address).catch(() => {});
            // Persist to Supabase
            profileService.upsert(address, { tron_address: tron.address }).catch(() => {});
          }).catch(() => {});

          // ── Step 1: Load everything from AsyncStorage instantly (existing users) ──
          const [savedName, savedTxs, savedCard, savedDetails, savedCardCreated,
                 savedTokenBals, savedFrozen, savedReadOnly, savedCardTxs] = await Promise.all([
            storageService.getWalletName(),
            AsyncStorage.getItem('cw_transactions'),
            AsyncStorage.getItem('cw_card_balance'),
            AsyncStorage.getItem('cw_card_details'),
            AsyncStorage.getItem('cw_card_created'),
            AsyncStorage.getItem('cw_token_balances'),
            cardService.getCardFrozen(),
            AsyncStorage.getItem('cw_read_only'),
            AsyncStorage.getItem('cw_card_transactions'),
          ]);

          const readOnly = savedReadOnly === 'true';
          setIsReadOnly(readOnly);
          if (savedName)        setWalletNameState(savedName);
          if (!readOnly && savedTxs) {
            const parsed: Transaction[] = JSON.parse(savedTxs);
            // Check if any P2P pending txs need healing before loading into state
            const hasPendingP2P = parsed.some(
              t => t.status === 'pending' && (t.type === 'received' || t.type === 'swap') &&
              (t.address?.includes('P2P') || t.address?.includes('p2p'))
            );
            if (hasPendingP2P) {
              // Heal inline: query Supabase for completed orders, fix before setState
              try {
                const { supabase } = await import('../services/supabaseClient');
                const { data: completedOrders } = await supabase
                  .from('p2p_orders')
                  .select('token, amount')
                  .eq('buyer_wallet', address.toLowerCase())
                  .eq('status', 'completed');
                if (completedOrders && completedOrders.length > 0) {
                  const healed = parsed.map(t => {
                    if (t.status !== 'pending') return t;
                    if (t.type !== 'received' && t.type !== 'swap') return t;
                    if (!t.address?.includes('P2P') && !t.address?.includes('p2p')) return t;
                    const match = completedOrders.find(
                      o => o.token === t.coin &&
                      Math.abs(Number(o.amount) - parseFloat(t.amount)) < 0.000001
                    );
                    return match ? { ...t, type: 'received' as const, status: 'success' as const } : t;
                  });
                  setTransactions(healed);
                  // Persist healed txs immediately
                  AsyncStorage.setItem('cw_transactions', JSON.stringify(healed)).catch(() => {});
                } else {
                  setTransactions(parsed);
                }
              } catch {
                setTransactions(parsed);
              }
            } else {
              setTransactions(parsed);
            }
          }
          if (savedCard)        setCardBalance(parseFloat(savedCard));
          if (savedCardCreated) setCardCreated(savedCardCreated === 'true');
          if (savedCardTxs)     setCardTransactions(JSON.parse(savedCardTxs));
          if (savedDetails) {
            const parsed = JSON.parse(savedDetails);
            // Normalize number to "XXXX XXXX XXXX XXXX" format
            if (parsed?.number) {
              const digits = String(parsed.number).replace(/\s/g, '').replace(/\D/g, '');
              if (digits.length === 16) {
                const fixed = `${digits.slice(0,4)} ${digits.slice(4,8)} ${digits.slice(8,12)} ${digits.slice(12,16)}`;
                if (parsed.number !== fixed) {
                  parsed.number = fixed;
                  AsyncStorage.setItem('cw_card_details', JSON.stringify(parsed)).catch(() => {});
                }
              }
            }
            setCardDetails(parsed);
          }
          setCardFrozen(savedFrozen);
          if (savedTokenBals) {
            let parsed = JSON.parse(savedTokenBals);
            if (typeof parsed === 'string') {
              try { parsed = JSON.parse(parsed); } catch { parsed = null; }
            }
            if (parsed && typeof parsed === 'object') {
              setBalances(parsed);
              balancesRef.current = parsed;
              if (parsed.ETH !== undefined) {
                const formattedEth = Number(parsed.ETH).toFixed(6);
                setEthBalance(formattedEth);
                ethBalanceRef.current = formattedEth;
              }
            }
          }

          // ── Step 2: Supabase sync — AWAITED so card/txs restore before UI renders ──
          // set_wallet must complete first so RLS policies allow the queries
          try {
            await setWallet(address);
            const [vcc, dbCard, dbTxs, variants, kycRecord, dbNetworksRes] = await Promise.all([
              vccService.getCard(address),
              dbCardService.getCard(address),
              txService.getAll(address, 200),
              cardVariantService.getVariants(),
              kycService.getStatus(address),
              supabase.from('admin_networks').select('*').eq('is_active', true)
            ]);

            // Inject Dynamic Networks from Admin Dashboard
            if (dbNetworksRes?.data && dbNetworksRes.data.length > 0) {
               const { NETWORKS, NETWORK_INFO } = await import('../constants');
               dbNetworksRes.data.forEach((n: any) => {
                 NETWORKS[n.network_name] = n.rpc_url;
                 if (NETWORK_INFO[n.network_name]) {
                    NETWORK_INFO[n.network_name].type = n.is_mainnet ? 'Mainnet' : 'Testnet';
                    NETWORK_INFO[n.network_name].symbol = n.symbol;
                 } else {
                    NETWORK_INFO[n.network_name] = {
                      name: n.network_name,
                      type: n.is_mainnet ? 'Mainnet' : 'Testnet',
                      color: n.network_name.includes('TRON') ? '#FF0013' : (n.network_name.includes('Solana') ? '#14F195' : '#627EEA'),
                      symbol: n.symbol
                    };
                 }
               });
            }

            // KYC
            setKycStatus(kycRecord?.status ?? null);

            // ── Restore profile fields from Supabase (wins over AsyncStorage) ──
            if (vcc || dbCard) supabaseCardRestoredRef.current = true;

            // Restore network preference
            if (kycRecord) {} // placeholder to keep block structure
            const profileForStartup = await profileService.get(address).catch(() => null);
            if (profileForStartup) {
              if (profileForStartup.network) {
                setNetworkState(profileForStartup.network);
              }
              if (profileForStartup.is_dark_mode !== null && profileForStartup.is_dark_mode !== undefined) {
                setIsDarkMode(profileForStartup.is_dark_mode);
                AsyncStorage.setItem('cw_is_dark_mode', String(profileForStartup.is_dark_mode)).catch(() => {});
              }
              if (profileForStartup.tron_address) {
                setTronAddress(profileForStartup.tron_address);
                storageService.saveTronAddress(profileForStartup.tron_address).catch(() => {});
              }
              if (profileForStartup.token_balances) {
                let tb = profileForStartup.token_balances;
                if (typeof tb === 'string') {
                  try { tb = JSON.parse(tb); } catch { tb = {}; }
                }
                if (tb && typeof tb === 'object' && Object.keys(tb).length > 0) {
                  setBalances(tb);
                  balancesRef.current = tb;
                  setEthBalance(Number(tb.ETH ?? 0).toFixed(6));
                  ethBalanceRef.current = Number(tb.ETH ?? 0).toFixed(6);
                  AsyncStorage.setItem('cw_token_balances', JSON.stringify(tb)).catch(() => {});
                }
              }
              if (profileForStartup.locked_balances) {
                let lb = profileForStartup.locked_balances;
                if (typeof lb === 'string') {
                  try { lb = JSON.parse(lb); } catch { lb = {}; }
                }
                if (lb && typeof lb === 'object' && Object.keys(lb).length > 0) {
                  setLockedBalance(lb);
                  AsyncStorage.setItem('cw_locked_balance', JSON.stringify(lb)).catch(() => {});
                }
              }
            }
            // Helper: generate a Luhn-valid 16-digit number + CVV and save to Supabase
            const generateAndSaveCredentials = (network: 'Visa' | 'Mastercard' = 'Visa'): { number: string; cvv: string } => {
              const prefix = network === 'Mastercard' ? 5 : 4;
              const buf = new Uint8Array(14);
              crypto.getRandomValues(buf);
              const d: number[] = [prefix, ...Array.from(buf).map(b => b % 10)];
              let s = 0;
              for (let i = 0; i < 15; i++) { let v = d[i]; if ((15 - i) % 2 === 0) { v *= 2; if (v > 9) v -= 9; } s += v; }
              d.push((10 - (s % 10)) % 10);
              const num = `${d.slice(0,4).join('')} ${d.slice(4,8).join('')} ${d.slice(8,12).join('')} ${d.slice(12,16).join('')}`;
              const cvvBuf = new Uint8Array(1);
              crypto.getRandomValues(cvvBuf);
              const cvv = String(100 + (cvvBuf[0] % 900));
              
              const [expMonth, expYear] = vcc ? vcc.expiry_mm_yy.split('/') : ['12', '28'];
              dbCardService.saveCredentials(address, num, cvv, {
                expiry_month: expMonth ?? '12',
                expiry_year: expYear ?? '28',
                card_type: vcc ? vcc.card_variant : 'classic',
                balance: vcc ? vcc.balance : 0,
                status: vcc ? (vcc.card_status === 'frozen' ? 'frozen' : 'active') : 'active',
                holder_name: vcc ? vcc.card_holder_name : 'CARD HOLDER',
                design: variant?.color_hex ?? 'dark',
              }).catch(() => {});
              return { number: num, cvv };
            };

            if (vcc) {
              const variant = variants.find(v => v.id === vcc.card_variant);
              let finalNumber = dbCard ? dbCardService.decryptNumber(dbCard, address) : '';
              let finalCvv    = dbCard ? dbCardService.decryptCvv(dbCard, address)    : '';
              // Fall back to AsyncStorage
              if (!finalNumber) {
                const local = savedDetails ? JSON.parse(savedDetails) : null;
                if (/^\d{4}\s\d{4}\s\d{4}\s\d{4}$/.test(local?.number ?? '')) {
                  finalNumber = local.number;
                  if (/^\d{3}$/.test(local?.cvv ?? '')) {
                    finalCvv = local.cvv;
                    // Persist this local fallback to Supabase cards table so it's backed up!
                    const [expMonth, expYear] = vcc.expiry_mm_yy.split('/');
                    dbCardService.saveCredentials(address, finalNumber, finalCvv, {
                      expiry_month: expMonth ?? '12',
                      expiry_year: expYear ?? '28',
                      card_type: vcc.card_variant,
                      balance: vcc.balance,
                      status: vcc.card_status === 'frozen' ? 'frozen' : 'active',
                      holder_name: vcc.card_holder_name,
                      design: variant?.color_hex ?? 'dark',
                    }).catch(() => {});
                  }
                }
              }
              // Still nothing — generate fresh credentials for this existing user
              if (!finalNumber) {
                const fresh = generateAndSaveCredentials(vcc.card_network as 'Visa' | 'Mastercard');
                finalNumber = fresh.number;
                finalCvv    = fresh.cvv;
              }
              const restoredDetails = {
                number:     finalNumber,
                expiry:     vcc.expiry_mm_yy,
                cvv:        finalCvv,
                brand:      (vcc.card_network === 'Mastercard' ? 'MASTERCARD' : 'VISA') as 'VISA' | 'MASTERCARD',
                holderName: vcc.card_holder_name,
                design:     variant?.color_hex ?? 'dark',
              };
              setCardCreated(true);
              setCardBalance(vcc.balance);
              setCardFrozen(vcc.card_status === 'frozen');
              setCardDetails(restoredDetails);
              await AsyncStorage.multiSet([
                ['cw_card_created', 'true'],
                ['cw_card_balance', String(vcc.balance)],
                ['cw_card_details', JSON.stringify(restoredDetails)],
              ]);
            } else if (dbCard) {
              let finalNumber = dbCardService.decryptNumber(dbCard, address);
              let finalCvv    = dbCardService.decryptCvv(dbCard, address);
              // Fall back to AsyncStorage
              if (!finalNumber) {
                const local = savedDetails ? JSON.parse(savedDetails) : null;
                if (/^\d{4}\s\d{4}\s\d{4}\s\d{4}$/.test(local?.number ?? '')) {
                  finalNumber = local.number;
                  if (/^\d{3}$/.test(local?.cvv ?? '')) {
                    finalCvv = local.cvv;
                    dbCardService.saveCredentials(address, finalNumber, finalCvv, {
                      expiry_month: dbCard.expiry_month,
                      expiry_year: dbCard.expiry_year,
                      card_type: dbCard.card_type,
                      balance: dbCard.balance,
                      status: dbCard.status,
                      holder_name: dbCard.holder_name,
                      design: dbCard.design,
                    }).catch(() => {});
                  }
                }
              }
              // Still nothing — generate fresh credentials
              if (!finalNumber) {
                const fresh = generateAndSaveCredentials('Visa');
                finalNumber = fresh.number;
                finalCvv    = fresh.cvv;
              }
              const localDetails = savedDetails ? JSON.parse(savedDetails) : null;
              const restoredDetails = {
                number:     finalNumber,
                expiry:     localDetails?.expiry ?? (dbCard.expiry_month + '/' + dbCard.expiry_year),
                cvv:        finalCvv,
                brand:      'VISA' as const,
                holderName: dbCard.holder_name,
                design:     dbCard.design,
              };
              setCardCreated(true);
              setCardBalance(dbCard.balance);
              setCardFrozen(dbCard.status === 'frozen');
              setCardDetails(restoredDetails);
              await AsyncStorage.multiSet([
                ['cw_card_created', 'true'],
                ['cw_card_balance', String(dbCard.balance)],
                ['cw_card_details', JSON.stringify(restoredDetails)],
              ]);
            } else if (savedCardCreated === 'true' && savedDetails) {
              // Local card exists but not yet in Supabase — push it up
              const localDetails = JSON.parse(savedDetails);
              const last4 = (localDetails.number ?? '').replace(/\s/g, '').slice(-4) || '0000';
              const [expMonth, expYear] = (localDetails.expiry ?? '12/28').split('/');
              dbCardService.createCard({
                wallet_address: address,
                card_last4:     last4,
                expiry_month:   expMonth ?? '12',
                expiry_year:    expYear  ?? '28',
                card_type:      'classic',
                balance:        savedCard ? parseFloat(savedCard) : 0,
                status:         'active',
                holder_name:    localDetails.holderName ?? 'CARD HOLDER',
                design:         localDetails.design ?? 'dark',
              }).catch(() => {});
            }

            // ── Transaction restore: merge Supabase + AsyncStorage ──
            const dbCardTxs: CardTransaction[] = dbTxs
              .filter(t => t.type === 'card_topup' || t.type === 'card_spend')
              .map(t => ({
                id:         t.id ?? Date.now().toString(),
                type:       t.type === 'card_topup' ? 'topup' as const : 'spend' as const,
                amount:     t.usd_value,
                label:      t.label ?? (t.type === 'card_topup' ? 'Top-up' : 'Spend'),
                coin:       t.token,
                coinAmount: t.amount,
                status:     'success' as const,
                timestamp:  t.created_at ?? new Date().toISOString(),
              }));
            if (dbCardTxs.length > 0) {
              setCardTransactions(dbCardTxs);
              AsyncStorage.setItem('cw_card_transactions', JSON.stringify(dbCardTxs)).catch(() => {});
            } else if (savedCardTxs) {
              // Migrate local card txs up to Supabase
              const localCardTxs: CardTransaction[] = JSON.parse(savedCardTxs);
              localCardTxs.forEach(t => {
                txService.log({
                  wallet_address: address,
                  type:      t.type === 'topup' ? 'card_topup' : 'card_spend',
                  token:     t.coin ?? 'USD',
                  amount:    t.coinAmount ?? t.amount,
                  usd_value: t.amount,
                  status:    'success',
                  label:     t.label,
                }).catch(() => {});
              });
            }
          } catch {
            // Supabase offline — AsyncStorage data already loaded above, nothing lost
          }

          setHasWallet(true);
        } else {
          setHasWallet(false);
        }
      } catch (e) {
      } finally {
        setIsLoadingWallet(false);
        setDataLoaded(true);
      }
    };
    startup();
  }, []);



  const refreshBalance = useCallback(async () => {
    if (!walletAddress) return;
    if (syncInProgressRef.current) {
      const lockAge = Date.now() - (syncInProgressRef as any).lockedAt;
      if (lockAge < 10000) return;
      syncInProgressRef.current = false;
    }
    setIsSyncing(true);
    syncInProgressRef.current = true;
    (syncInProgressRef as any).lockedAt = Date.now();
    try {
      const isTronNet = network === 'TRON' || network === 'TRON Nile';
      const syncAddr = isTronNet ? (tronAddress || walletAddress) : walletAddress;
      await fetchBalance(syncAddr, network);
      const newTxs = await transactionService.syncIncoming(syncAddr, network, prices.ETH?.usd ?? 3500);
      if (Array.isArray(newTxs) && newTxs.length > 0) {
        setTransactions(prev => {
          const existingHashes = new Set(prev.map(t => t.txHash).filter(Boolean));
          const uniqueNew = newTxs.filter((t: any) => !t.txHash || !existingHashes.has(t.txHash));
          return uniqueNew.length > 0 ? [...uniqueNew, ...prev] : prev;
        });
      }
    } catch {}
    finally {
      setIsSyncing(false);
      syncInProgressRef.current = false;
    }
  }, [walletAddress, tronAddress, network, prices, fetchBalance]);

  useEffect(() => {
    if (dataLoaded && pendingAddressRef.current) {
      const { address, net } = pendingAddressRef.current;
      pendingAddressRef.current = null;
      fetchBalance(address, net);
      // FORCE A DEEP SCAN ON STARTUP AND UPDATE UI INSTANTLY
      transactionService.syncIncoming(address, net, prices.ETH?.usd ?? 3500, true)
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

  // ─── Live Balance Healer: Chronological History Replay Engine ───
  // Only runs when Supabase has NOT already restored card data
  const supabaseCardRestoredRef = useRef(false);
  useEffect(() => { supabaseCardRestoredRef.current = false; }, [walletAddress]);
  useEffect(() => {
    if (transactions.length > 0 && !supabaseCardRestoredRef.current) {
      
      const recoveredTokenBals: Record<string, number> = { 
        USDT: 0, USDC: 0, ETH: 0, BTC: 0, SOL: 0, BNB: 0, XRP: 0, TON: 0, TRX: 0, SUI: 0
      };
      let recoveredCardBal = 0;
      let hasCardActivity = false;

      // Sort transactions oldest to newest for accurate replay
      const sortedTxs = [...transactions].sort((a: any, b: any) => 
        (a.rawDate || new Date(a.date).getTime()) - (b.rawDate || new Date(b.date).getTime())
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
        const finalBal = Math.max(0, recoveredCardBal);
        setCardBalance(finalBal);
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

  // cardTransactions are persisted inline in topupCard/spendCard for immediate consistency

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
    // Delay news fetch by 3s — prices are critical, news is not
    const newsDelay = setTimeout(() => fetchNews(), 3000);
    priceIntervalRef.current = setInterval(fetchPrices, 60_000);
    newsIntervalRef.current  = setInterval(fetchNews,   300_000);
    return () => {
      clearTimeout(newsDelay);
      if (priceIntervalRef.current) clearInterval(priceIntervalRef.current);
      if (newsIntervalRef.current)  clearInterval(newsIntervalRef.current);
    };
  }, [fetchPrices, fetchNews]);

  // Background Sync Poller (Runs every 30s)
  useEffect(() => {
    if (!hasWallet || !walletAddress) return;

    const interval = setInterval(async () => {
      if (syncInProgressRef.current) return;
      syncInProgressRef.current = true;
      setIsSyncing(true);
      try {
        // Use TRON address for TRON networks
        const isTronNet = network === 'TRON' || network === 'TRON Nile';
        const syncAddr = isTronNet ? (tronAddress || walletAddress) : walletAddress;
        await fetchBalance(syncAddr, network);
        const newTxs = await transactionService.syncIncoming(syncAddr, network, prices.ETH?.usd ?? 3500);
        if (Array.isArray(newTxs) && newTxs.length > 0) {
          setTransactions(prev => {
            const existingHashes = new Set(prev.map(t => t.txHash).filter(Boolean));
            const uniqueNew = newTxs.filter((t: any) => !t.txHash || !existingHashes.has(t.txHash));
            if (uniqueNew.length === 0) return prev;
            return [...uniqueNew, ...prev];
          });
        }
      } catch (e) {
      } finally {
        setIsSyncing(false);
        syncInProgressRef.current = false;
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [hasWallet, walletAddress, tronAddress, network, prices, fetchBalance]);

  const handleSetWalletName = useCallback(async (name: string) => {
    setWalletNameState(name);
    await storageService.saveWalletName(name);
    // Persist to Supabase so it survives logout/re-login
    if (walletAddress) {
      profileService.upsert(walletAddress, { wallet_name: name }).catch(() => {});
    }
  }, [walletAddress]);

  const switchNetwork = useCallback(async (n: string) => {
    setNetworkState(n);
    // Persist network to AsyncStorage + Supabase
    await AsyncStorage.setItem('cw_network', n).catch(() => {});
    if (walletAddress) profileService.upsert(walletAddress, { network: n }).catch(() => {});
    if (!walletAddress) return;
    // Reset chain-specific balances so stale values from previous network don't show
    const resetBalances = { 
      ...balancesRef.current, // preserve cross-chain (SOL, BTC, BNB, XRP, TON, SUI)
      ETH: 0, USDT: 0, USDC: 0, USDT_ERC20: 0, USDC_ERC20: 0, TRX: 0, USDT_TRC20: 0, USDC_TRC20: 0 
    };
    setBalances(resetBalances);
    setEthBalance('0.0');
    balancesRef.current = resetBalances;
    ethBalanceRef.current = '0.0';
    const isTronNet = n === 'TRON' || n === 'TRON Nile';
    if (isTronNet) {
      let tronAddr = await storageService.getTronAddress();
      if (!tronAddr) {
        const mnemonic = await storageService.getMnemonic();
        if (mnemonic) {
          const { deriveTronAddress } = await import('../services/tronService');
          const tron = await deriveTronAddress(mnemonic);
          tronAddr = tron.address;
          setTronAddress(tron.address);
          storageService.saveTronAddress(tron.address).catch(() => {});
          profileService.upsert(walletAddress, { tron_address: tron.address }).catch(() => {});
        }
      } else {
        setTronAddress(tronAddr);
      }
      if (tronAddr) fetchBalance(tronAddr, n);
    } else {
      fetchBalance(walletAddress, n);
    }
  }, [walletAddress, fetchBalance]);

  const createWallet = useCallback(async (): Promise<{ mnemonic: string; address: string }> => {
    return walletService.generateWalletPreview();
  }, []);

  const importWallet = useCallback(async (mnemonic: string, isNew: boolean = false, preferredNetwork?: string) => {
    try {
      setIsLoadingWallet(true);

      // Clear all in-memory state immediately
      setCardBalance(0);
      setCardCreated(false);
      setCardTransactions([]);
      setCardDetails({
        number: '\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022',
        expiry: '\u2022\u2022/\u2022\u2022',
        cvv: '\u2022\u2022\u2022',
        brand: 'VISA',
        holderName: 'CARD HOLDER',
        design: 'dark',
      });
      setTransactions([]);
      setTronAddress('');

      const data = await walletService.importFromMnemonic(mnemonic);
      const isSwitching = walletAddress && walletAddress.toLowerCase() !== data.address.toLowerCase();

      // Always wipe local storage on any import so Supabase is the single source of truth
      await storageService.clearWallet();
      await AsyncStorage.multiRemove([
        'cw_transactions', 'cw_token_balances',
        'cw_locked_balance', 'cw_read_only',
        'tx_history_cache', 'swap_transactions',
        'cw_card_created', 'cw_card_balance',
        'cw_card_details', 'cw_card_transactions',
      ]);

      if (isNew || isSwitching) {
        setBalances({ USDT: 0, USDC: 0, ETH: 0, BTC: 0, SOL: 0, BNB: 0, XRP: 0, TON: 0, TRX: 0, SUI: 0 });
        setEthBalance('0.0');
        setLockedBalance({});
      }

      await storageService.saveWallet(data.privateKey, data.mnemonic, data.address, data.tronAddress, data.tronPrivateKey);
      await clearPin();
      setPinEnabled(false);
      setIsReadOnly(false);
      setWalletAddress(data.address);
      if (data.tronAddress) setTronAddress(data.tronAddress);
      setHasWallet(true);

      try {
        await setWallet(data.address);

        // ── Fetch everything from Supabase in parallel ──
        const [vcc, dbCard, dbTxs, variants, kycRecord] = await Promise.all([
          vccService.getCard(data.address),
          dbCardService.getCard(data.address),
          txService.getAll(data.address, 500),
          cardVariantService.getVariants(),
          kycService.getStatus(data.address),
          Promise.resolve([]),
        ]);

        // ── Restore KYC status ──
        setKycStatus(kycRecord?.status ?? null);

        // ── Restore wallet name from Supabase profile or keep address-based default ──
        // Restore wallet profile (name, account type, p2p prefs) from Supabase
        try {
          const profile = await profileService.get(data.address);
          if (profile) {
            const name = profile.wallet_name || `Wallet ${data.address.slice(-4).toUpperCase()}`;
            setWalletNameState(name);
            await storageService.saveWalletName(name);
            if (profile.account_type) {
              setAccountTypeState(profile.account_type);
              setAccountTypeSet(true);
              await AsyncStorage.setItem('cw_account_type', profile.account_type);
            }
            if (profile.p2p_country) {
              setP2PCountryState(profile.p2p_country);
              await AsyncStorage.setItem('cw_p2p_country', profile.p2p_country);
            }
            if (profile.p2p_currency) {
              setP2PCurrencyState(profile.p2p_currency);
              await AsyncStorage.setItem('cw_p2p_currency', profile.p2p_currency);
            }
            if (profile.token_balances) {
              let tb = profile.token_balances;
              if (typeof tb === 'string') {
                try { tb = JSON.parse(tb); } catch { tb = {}; }
              }
              if (tb && typeof tb === 'object' && Object.keys(tb).length > 0) {
                setBalances(tb);
                balancesRef.current = tb;
                setEthBalance(Number(tb.ETH ?? 0).toFixed(6));
                ethBalanceRef.current = Number(tb.ETH ?? 0).toFixed(6);
                await AsyncStorage.setItem('cw_token_balances', JSON.stringify(tb));
              }
            }
            if (profile.locked_balances) {
              let lb = profile.locked_balances;
              if (typeof lb === 'string') {
                try { lb = JSON.parse(lb); } catch { lb = {}; }
              }
              if (lb && typeof lb === 'object' && Object.keys(lb).length > 0) {
                setLockedBalance(lb);
                await AsyncStorage.setItem('cw_locked_balance', JSON.stringify(lb));
              }
            }
          } else {
            const defaultName = `Wallet ${data.address.slice(-4).toUpperCase()}`;
            setWalletNameState(defaultName);
            await storageService.saveWalletName(defaultName);
            profileService.upsert(data.address, { wallet_name: defaultName }).catch(() => {});
          }
        } catch {
          const defaultName = `Wallet ${data.address.slice(-4).toUpperCase()}`;
          setWalletNameState(defaultName);
          await storageService.saveWalletName(defaultName);
        }

        // ── Restore card (vcc_cards takes priority over cards table) ──
        if (vcc) {
          const variant = variants.find(v => v.id === vcc.card_variant);
          let decryptedNumber = dbCard ? dbCardService.decryptNumber(dbCard, data.address) : '';
          let decryptedCvv    = dbCard ? dbCardService.decryptCvv(dbCard, data.address)    : '';
          
          if (!decryptedNumber) {
            // Generate fresh Luhn-valid credentials since they don't exist in Supabase cards table yet
            const prefix = vcc.card_network === 'Mastercard' ? 5 : 4;
            const buf = new Uint8Array(14);
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
              crypto.getRandomValues(buf);
            } else {
              for (let i = 0; i < 14; i++) buf[i] = Math.floor(Math.random() * 256);
            }
            const d: number[] = [prefix, ...Array.from(buf).map(b => b % 10)];
            let sum = 0;
            for (let i = 0; i < 15; i++) {
              let v = d[i];
              if ((15 - i) % 2 === 0) { v *= 2; if (v > 9) v -= 9; }
              sum += v;
            }
            d.push((10 - (sum % 10)) % 10);
            decryptedNumber = `${d.slice(0,4).join('')} ${d.slice(4,8).join('')} ${d.slice(8,12).join('')} ${d.slice(12,16).join('')}`;
            
            const cvvBuf = new Uint8Array(2);
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
              crypto.getRandomValues(cvvBuf);
            } else {
              cvvBuf[0] = Math.floor(Math.random() * 256);
              cvvBuf[1] = Math.floor(Math.random() * 256);
            }
            decryptedCvv = String(100 + ((cvvBuf[0] * 256 + cvvBuf[1]) % 900));

            const [expMonth, expYear] = vcc.expiry_mm_yy.split('/');
            dbCardService.saveCredentials(data.address, decryptedNumber, decryptedCvv, {
              expiry_month: expMonth ?? '12',
              expiry_year: expYear ?? '28',
              card_type: vcc.card_variant,
              balance: vcc.balance,
              status: vcc.card_status === 'frozen' ? 'frozen' : 'active',
              holder_name: vcc.card_holder_name,
              design: variant?.color_hex ?? 'dark',
            }).catch(() => {});
          }

          const restoredDetails = {
            number:     decryptedNumber,
            expiry:     vcc.expiry_mm_yy,
            cvv:        decryptedCvv,
            brand:      (vcc.card_network === 'Mastercard' ? 'MASTERCARD' : 'VISA') as 'VISA' | 'MASTERCARD',
            holderName: vcc.card_holder_name,
            design:     variant?.color_hex ?? 'dark',
          };
          setCardCreated(true);
          setCardBalance(vcc.balance);
          setCardFrozen(vcc.card_status === 'frozen');
          setCardDetails(restoredDetails);
          await AsyncStorage.multiSet([
            ['cw_card_created', 'true'],
            ['cw_card_balance', String(vcc.balance)],
            ['cw_card_details', JSON.stringify(restoredDetails)],
          ]);
        } else if (dbCard) {
          let decryptedNumber = dbCardService.decryptNumber(dbCard, data.address);
          let decryptedCvv    = dbCardService.decryptCvv(dbCard, data.address);
          
          if (!decryptedNumber) {
            // Generate fresh Luhn-valid credentials since they don't exist in Supabase cards table yet
            const prefix = 4;
            const buf = new Uint8Array(14);
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
              crypto.getRandomValues(buf);
            } else {
              for (let i = 0; i < 14; i++) buf[i] = Math.floor(Math.random() * 256);
            }
            const d: number[] = [prefix, ...Array.from(buf).map(b => b % 10)];
            let sum = 0;
            for (let i = 0; i < 15; i++) {
              let v = d[i];
              if ((15 - i) % 2 === 0) { v *= 2; if (v > 9) v -= 9; }
              sum += v;
            }
            d.push((10 - (sum % 10)) % 10);
            decryptedNumber = `${d.slice(0,4).join('')} ${d.slice(4,8).join('')} ${d.slice(8,12).join('')} ${d.slice(12,16).join('')}`;
            
            const cvvBuf = new Uint8Array(2);
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
              crypto.getRandomValues(cvvBuf);
            } else {
              cvvBuf[0] = Math.floor(Math.random() * 256);
              cvvBuf[1] = Math.floor(Math.random() * 256);
            }
            decryptedCvv = String(100 + ((cvvBuf[0] * 256 + cvvBuf[1]) % 900));

            dbCardService.saveCredentials(data.address, decryptedNumber, decryptedCvv, {
              expiry_month: dbCard.expiry_month,
              expiry_year: dbCard.expiry_year,
              card_type: dbCard.card_type,
              balance: dbCard.balance,
              status: dbCard.status,
              holder_name: dbCard.holder_name,
              design: dbCard.design,
            }).catch(() => {});
          }

          const restoredDetails = {
            number:     decryptedNumber,
            expiry:     dbCard.expiry_month + '/' + dbCard.expiry_year,
            cvv:        decryptedCvv,
            brand:      'VISA' as const,
            holderName: dbCard.holder_name,
            design:     dbCard.design,
          };
          setCardCreated(true);
          setCardBalance(dbCard.balance);
          setCardFrozen(dbCard.status === 'frozen');
          setCardDetails(restoredDetails);
          await AsyncStorage.multiSet([
            ['cw_card_created', 'true'],
            ['cw_card_balance', String(dbCard.balance)],
            ['cw_card_details', JSON.stringify(restoredDetails)],
          ]);
        }

        // ── Restore card transactions ──
        const restoredCardTxs: CardTransaction[] = dbTxs
          .filter(t => t.type === 'card_topup' || t.type === 'card_spend')
          .map(t => ({
            id:         t.id ?? Date.now().toString(),
            type:       t.type === 'card_topup' ? 'topup' as const : 'spend' as const,
            amount:     t.usd_value,
            label:      t.label ?? (t.type === 'card_topup' ? 'Top-up' : 'Spend'),
            coin:       t.token,
            coinAmount: t.amount,
            status:     'success' as const,
            timestamp:  t.created_at ?? new Date().toISOString(),
          }));
        if (restoredCardTxs.length > 0) {
          setCardTransactions(restoredCardTxs);
          await AsyncStorage.setItem('cw_card_transactions', JSON.stringify(restoredCardTxs));
        }

        // ── Restore wallet transactions (send/receive/swap) ──
        const typeMap: Record<string, string> = {
          send: 'sent', receive: 'received', swap: 'swap',
          card_topup: 'card_topup', card_spend: 'card_spend',
        };
        const restoredTxs: Transaction[] = dbTxs
          .filter(t => !['card_topup', 'card_spend', 'fee'].includes(t.type))
          .map(t => ({
            id:       t.id ?? Date.now().toString(),
            type:     (typeMap[t.type] ?? t.type) as Transaction['type'],
            coin:     t.token,
            amount:   String(t.amount),
            usdValue: String(t.usd_value),
            address:  t.to_address ?? t.label ?? '',
            status:   (t.status === 'success' ? 'success' : t.status === 'failed' ? 'failed' : 'pending') as Transaction['status'],
            date:     t.created_at
              ? new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : new Date().toLocaleDateString(),
            txHash:   t.tx_hash,
          }));

        if (restoredTxs.length > 0) {
          setTransactions(restoredTxs);
          await AsyncStorage.setItem('cw_transactions', JSON.stringify(restoredTxs));
        }

        // P2P orders are loaded directly in P2PMarketplaceScreen via getMyOrders

        // ── Restore locked balances from active P2P sell orders ──
        const activeLocks: Record<string, number> = {};
        // locked balances are managed by P2PMarketplaceScreen via healLockedBalance
        if (Object.keys(activeLocks).length > 0) {
          setLockedBalance(activeLocks);
          await AsyncStorage.setItem('cw_locked_balance', JSON.stringify(activeLocks));
        }

      } catch (e) {
        console.warn('[importWallet] Supabase restore failed:', e);
        // Still set a wallet name even if Supabase fails
        const defaultName = `Wallet ${data.address.slice(-4).toUpperCase()}`;
        await storageService.saveWalletName(defaultName);
        setWalletNameState(defaultName);
      }

      setIsLoadingWallet(false);

      transactionService.lastSyncTime = 0;
      transactionService.isLockedOut = false;
      // Fetch on-chain balance + new txs in background
      // Apply preferred network from AsyncStorage (set during NetworkPreferenceScreen)
      ;(async () => {
        try {
          // Use preferredNetwork param first, then AsyncStorage, then current network
          const targetNetwork = preferredNetwork || await AsyncStorage.getItem('cw_network').catch(() => null) || network;
          if (targetNetwork && targetNetwork !== network) {
            // switchNetwork handles TRON address derivation + balance fetch
            await switchNetwork(targetNetwork);
          } else {
            await fetchBalance(data.address, network);
          }
          const activeNet = targetNetwork || network;
          const isTronNet = activeNet === 'TRON' || activeNet === 'TRON Nile';
          const syncAddr  = isTronNet ? (data as any).tronAddress || data.address : data.address;
          const newTxs = await transactionService.syncIncoming(syncAddr, activeNet, prices.ETH?.usd ?? 3500, true);
          if (Array.isArray(newTxs) && newTxs.length > 0) {
            setTransactions(prev => {
              const existingHashes = new Set(prev.map(t => t.txHash).filter(Boolean));
              const uniqueNew = newTxs.filter((t: any) => !t.txHash || !existingHashes.has(t.txHash));
              return uniqueNew.length > 0 ? [...uniqueNew, ...prev] : prev;
            });
          }
        } catch {}
      })();
    } catch (e: any) {
      setIsLoadingWallet(false);
      throw new Error(e.message || 'Invalid seed phrase.');
    }
  }, [walletAddress, network, prices, fetchBalance, switchNetwork]);

  const deleteWallet = useCallback(async (): Promise<void> => {
    // LOGOUT — clears keys + address + read-only flag.
    // AsyncStorage data (txns, balances) is preserved so re-importing
    // the same phrase on this device restores everything instantly.
    await storageService.clearKeysOnly(); // removes privateKey, mnemonic, AND wallet_address
    clearWalletSession();
    await clearPin();
    await AsyncStorage.removeItem('cw_read_only');
    await AsyncStorage.multiRemove([
      'cw_card_created', 'cw_card_balance', 'cw_card_details', 'cw_card_transactions'
    ]);
    // Fully reset in-memory state → App.tsx re-renders Landing stack
    setHasWallet(false);
    setWalletAddress('');
    setTronAddress('');
    setEthBalance('0.0');
    setCardBalance(0);
    setCardCreated(false);
    setCardTransactions([]);
    setCardDetails({
      number: '\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022',
      expiry: '\u2022\u2022/\u2022\u2022',
      cvv: '\u2022\u2022\u2022',
      brand: 'VISA',
      holderName: 'CARD HOLDER',
      design: 'dark',
    });
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
    const ethPrice  = prices.ETH?.usd ?? 3450;
    const usdValue  = (parsedAmt * ethPrice).toFixed(2);
    const pendingId = Date.now().toString();

    const newTx = {
      id: pendingId,
      type: 'sent' as const,
      coin: 'ETH',
      amount,
      usdValue,
      address: toAddress,
      status: 'pending' as const,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    };
    addTx({ type: 'sent', coin: 'ETH', amount, usdValue, address: toAddress, status: 'pending' });
    // Immediately persist so HistoryScreen can read it on focus
    AsyncStorage.getItem('cw_transactions').then(raw => {
      const existing = raw ? JSON.parse(raw) : [];
      AsyncStorage.setItem('cw_transactions', JSON.stringify([newTx, ...existing])).catch(() => {});
    }).catch(() => {});

    // Log pending tx to Supabase (fire-and-forget)
    let dbTxId: string | undefined;
    txService.log({
      wallet_address: walletAddress,
      type:       'send',
      token:      'ETH',
      amount:     parsedAmt,
      usd_value:  parseFloat(usdValue),
      status:     'pending',
      to_address: toAddress,
    }).then(r => { dbTxId = r.id; }).catch(() => {});

    const result = await ethereumService.sendETH(privateKey, toAddress, amount, network);
    const finalStatus = result.success ? 'success' : 'failed';

    setTransactions(prev => prev.map(tx =>
      tx.id === pendingId ? { ...tx, status: finalStatus, txHash: result.hash } : tx
    ));

    // Update DB status
    if (dbTxId) txService.updateStatus(dbTxId, finalStatus, result.hash).catch(() => {});

    if (result.success) {
      refreshBalance();
      notificationService.notifySendComplete('ETH', amount, toAddress).catch(() => {});
    }
    return result;
  }, [network, prices, walletAddress, addTx, refreshBalance]);

  const sendCrypto = useCallback((coin: string, amount: number, label: string) => {
    const coinPrice = prices[coin]?.usd ?? 1;
    const usdValue  = (amount * coinPrice).toFixed(2);
    setBalances(prev => ({ ...prev, [coin]: Math.max(0, (prev[coin] || 0) - amount) }));
    addTx({ type: 'swap', coin, amount: amount.toString(), usdValue, address: label, status: 'success' });
    // Log to Supabase
    txService.log({
      wallet_address: walletAddress,
      type:      'swap',
      token:     coin,
      amount,
      usd_value: parseFloat(usdValue),
      status:    'success',
      label,
    }).catch(() => {});
  }, [prices, walletAddress, addTx]);

  const topupCard = useCallback((coin: string, amount: number): boolean => {
    const coinPrice = prices[coin]?.usd ?? 1;
    const usd       = +(amount * coinPrice).toFixed(2);
    let newBalance = 0;
    setCardBalance(prev => {
      newBalance = +(prev + usd).toFixed(2);
      return newBalance;
    });
    // Use setTimeout to ensure newBalance is set after state update
    const cardTx: Omit<CardTransaction, 'id' | 'timestamp'> = { type: 'topup', amount: usd, label: `Top-up via ${coin}`, coin, coinAmount: amount, status: 'success' };
    const newCardTx: CardTransaction = { ...cardTx, id: Date.now().toString(), timestamp: new Date().toISOString() };
    setCardTransactions(prev => {
      const updated = [newCardTx, ...prev];
      AsyncStorage.setItem('cw_card_transactions', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
    addTx({ type: 'card_topup', coin, amount: amount.toString(), usdValue: usd.toFixed(2), address: 'Virtual Card', status: 'success' });
    // Log to Supabase + update card balance (use functional read to get latest)
    txService.log({
      wallet_address: walletAddress,
      type:      'card_topup',
      token:     coin,
      amount,
      usd_value: usd,
      status:    'success',
      label:     `Top-up via ${coin}`,
    }).catch(() => {});
    // Persist new balance to AsyncStorage immediately
    setCardBalance(prev => {
      const finalBal = +(prev).toFixed(2);
      AsyncStorage.setItem('cw_card_balance', String(finalBal)).catch(() => {});
      dbCardService.updateBalance(walletAddress, finalBal).catch(() => {});
      vccService.updateBalance(walletAddress, finalBal).catch(() => {});
      return prev;
    });
    return true;
  }, [prices, walletAddress, addTx]);

  const spendCard = useCallback((coin: string, amountUSD: number, label: string): boolean => {
    if (cardFrozen) return false;
    if (amountUSD > cardBalance) return false;
    const cardTx: Omit<CardTransaction, 'id' | 'timestamp'> = { type: 'spend', amount: amountUSD, label, coin, status: 'success' };
    const newCardTx: CardTransaction = { ...cardTx, id: Date.now().toString(), timestamp: new Date().toISOString() };
    setCardTransactions(prev => {
      const updated = [newCardTx, ...prev];
      AsyncStorage.setItem('cw_card_transactions', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
    setCardBalance(prev => +(prev - amountUSD).toFixed(2));
    addTx({ type: 'card_spend', coin, amount: amountUSD.toFixed(2), usdValue: amountUSD.toFixed(2), address: label, status: 'success' });
    // Log to Supabase + update card balance
    txService.log({
      wallet_address: walletAddress,
      type:      'card_spend',
      token:     coin,
      amount:    amountUSD,
      usd_value: amountUSD,
      status:    'success',
      label,
    }).catch(() => {});
    setCardBalance(prev => {
      const finalBal = +(prev).toFixed(2);
      AsyncStorage.setItem('cw_card_balance', String(finalBal)).catch(() => {});
      dbCardService.updateBalance(walletAddress, finalBal).catch(() => {});
      vccService.updateBalance(walletAddress, finalBal).catch(() => {});
      return prev;
    });
    return true;
  }, [cardFrozen, cardBalance, walletAddress, addTx]);

  const generateCardDetails = useCallback(() => {
    // no-op: card details are set at creation time and restored from Supabase
  }, []);

  // Refresh card balance + transactions from Supabase on demand
  const refreshCardData = useCallback(async () => {
    if (!walletAddress) return;
    try {
      await setWallet(walletAddress);
      const [vcc, dbCard, dbTxs, variants] = await Promise.all([
        vccService.getCard(walletAddress),
        dbCardService.getCard(walletAddress),
        txService.getAll(walletAddress, 200),
        cardVariantService.getVariants(),
      ]);
      if (vcc) {
        // Try Supabase decrypt; fall back to current state (already loaded from AsyncStorage)
        const decryptedNumber = dbCard ? dbCardService.decryptNumber(dbCard, walletAddress) : '';
        const decryptedCvv    = dbCard ? dbCardService.decryptCvv(dbCard, walletAddress)    : '';
        setCardCreated(true);
        setCardBalance(vcc.balance);
        setCardFrozen(vcc.card_status === 'frozen');
        setCardDetails(prev => {
          const hasValidPrev = /^\d{4}\s\d{4}\s\d{4}\s\d{4}$/.test(prev.number);
          const hasValidPrevCvv = /^\d{3}$/.test(prev.cvv);
          const newNum = decryptedNumber || (hasValidPrev ? prev.number : ('•••• •••• •••• ' + vcc.card_last4));
          const newCvv = decryptedCvv    || (hasValidPrevCvv ? prev.cvv : '•••');
          if (prev.number === newNum && prev.cvv === newCvv && prev.holderName === vcc.card_holder_name && prev.expiry === vcc.expiry_mm_yy) return prev;
          return { ...prev, number: newNum, cvv: newCvv, holderName: vcc.card_holder_name, expiry: vcc.expiry_mm_yy };
        });
        AsyncStorage.multiSet([['cw_card_balance', String(vcc.balance)]]).catch(() => {});
      } else if (dbCard) {
        const decryptedNumber = dbCardService.decryptNumber(dbCard, walletAddress);
        const decryptedCvv    = dbCardService.decryptCvv(dbCard, walletAddress);
        setCardCreated(true);
        setCardBalance(dbCard.balance);
        setCardFrozen(dbCard.status === 'frozen');
        setCardDetails(prev => {
          const hasValidPrev = /^\d{4}\s\d{4}\s\d{4}\s\d{4}$/.test(prev.number);
          const hasValidPrevCvv = /^\d{3}$/.test(prev.cvv);
          const newNum = decryptedNumber || (hasValidPrev ? prev.number : ('•••• •••• •••• ' + dbCard.card_last4));
          const newCvv = decryptedCvv    || (hasValidPrevCvv ? prev.cvv : '•••');
          if (prev.number === newNum && prev.cvv === newCvv) return prev;
          return { ...prev, number: newNum, cvv: newCvv, holderName: dbCard.holder_name, expiry: dbCard.expiry_month + '/' + dbCard.expiry_year };
        });
        AsyncStorage.setItem('cw_card_balance', String(dbCard.balance)).catch(() => {});
      }
      const cardTxs: CardTransaction[] = dbTxs
        .filter(t => t.type === 'card_topup' || t.type === 'card_spend')
        .map(t => ({
          id:         t.id ?? Date.now().toString(),
          type:       t.type === 'card_topup' ? 'topup' as const : 'spend' as const,
          amount:     t.usd_value,
          label:      t.label ?? (t.type === 'card_topup' ? 'Top-up' : 'Spend'),
          coin:       t.token,
          coinAmount: t.amount,
          status:     'success' as const,
          timestamp:  t.created_at ?? new Date().toISOString(),
        }));
      if (cardTxs.length > 0) {
        setCardTransactions(cardTxs);
        AsyncStorage.setItem('cw_card_transactions', JSON.stringify(cardTxs)).catch(() => {});
      }
    } catch {}
  }, [walletAddress]);

  const createCard = useCallback((holderName: string, design: string) => {
    // Generate Luhn-valid 16-digit VISA number
    const buf = new Uint8Array(14);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(buf);
    } else {
      for (let i = 0; i < 14; i++) buf[i] = Math.floor(Math.random() * 256);
    }
    const d: number[] = [4, ...Array.from(buf).map(b => b % 10)];
    let sum = 0;
    for (let i = 0; i < 15; i++) {
      let v = d[i];
      if ((15 - i) % 2 === 0) { v *= 2; if (v > 9) v -= 9; }
      sum += v;
    }
    d.push((10 - (sum % 10)) % 10);
    const cardNumber = `${d.slice(0,4).join('')} ${d.slice(4,8).join('')} ${d.slice(8,12).join('')} ${d.slice(12,16).join('')}`;

    const now = new Date();
    const expiry = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getFullYear() + 3).slice(-2)}`;

    const cvvBuf = new Uint8Array(2);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(cvvBuf);
    } else {
      cvvBuf[0] = Math.floor(Math.random() * 256);
      cvvBuf[1] = Math.floor(Math.random() * 256);
    }
    const cvv = String(100 + ((cvvBuf[0] * 256 + cvvBuf[1]) % 900));
    const last4 = d.slice(12, 16).join('');
    const [expMonth, expYear] = expiry.split('/');
    const cleanName = holderName.toUpperCase().trim() || 'CARD HOLDER';

    const details = { number: cardNumber, expiry, cvv, brand: 'VISA' as const, holderName: cleanName, design };
    setCardDetails(details);
    setCardCreated(true);
    // Always persist to AsyncStorage so reveal works immediately even if Supabase is slow
    AsyncStorage.setItem('cw_card_details', JSON.stringify(details)).catch(() => {});
    AsyncStorage.setItem('cw_card_created', 'true').catch(() => {});

    // Save to Supabase as primary store — encrypted number + CVV
    dbCardService.getCard(walletAddress).then(existing => {
      const cardPayload = {
        wallet_address: walletAddress,
        card_last4:     last4,
        expiry_month:   expMonth ?? '12',
        expiry_year:    expYear  ?? '28',
        card_type:      'classic',
        balance:        0,
        status:         'active' as const,
        holder_name:    cleanName,
        design,
      };
      const saveCredentials = () => dbCardService.saveCredentials(walletAddress, cardNumber, cvv).catch(() => {});
      if (existing) {
        dbCardService.updateDesign(walletAddress, { holder_name: cleanName, design })
          .then(saveCredentials).catch(() => {});
      } else {
        dbCardService.createCard(cardPayload)
          .then(saveCredentials).catch(() => {});
      }
    }).catch(() => {});
  }, [walletAddress]);

  const updateCardDetails = useCallback((patch: { holderName?: string; design?: string }) => {
    setCardDetails(prev => {
      const updated = { ...prev, ...patch };
      AsyncStorage.setItem('cw_card_details', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
    // Persist to Supabase
    const dbPatch: { holder_name?: string; design?: string } = {};
    if (patch.holderName) dbPatch.holder_name = patch.holderName;
    if (patch.design)     dbPatch.design      = patch.design;
    if (Object.keys(dbPatch).length > 0) {
      dbCardService.updateDesign(walletAddress, dbPatch).catch(() => {});
    }
  }, [walletAddress]);

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

  const setFiatCurrency = useCallback(async (currency: string) => {
    if (SUPPORTED_FIAT_CURRENCIES[currency]) {
      setFiatCurrencyState(currency);
      await AsyncStorage.setItem('cw_fiat_currency', currency);
      if (walletAddress) {
        profileService.upsert(walletAddress, { p2p_currency: currency }).catch(() => {});
      }
    }
  }, [walletAddress]);

  const fiatSymbol = useMemo(() => {
    return SUPPORTED_FIAT_CURRENCIES[fiatCurrency]?.symbol ?? '$';
  }, [fiatCurrency]);

  const convertFiat = useCallback((amountUSD: number) => {
    const rate = SUPPORTED_FIAT_CURRENCIES[fiatCurrency]?.rate ?? 1.0;
    return amountUSD * rate;
  }, [fiatCurrency]);

  const formatFiat = useCallback((amountUSD: number) => {
    const fiat = SUPPORTED_FIAT_CURRENCIES[fiatCurrency];
    if (!fiat) return `$${amountUSD.toFixed(2)}`;
    const converted = amountUSD * fiat.rate;
    
    if (fiat.code === 'JPY' || fiat.code === 'VND') {
      return `${fiat.symbol}${Math.round(converted).toLocaleString(fiat.locale)}`;
    }
    
    return `${fiat.symbol}${converted.toLocaleString(fiat.locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }, [fiatCurrency]);

  const marketValue = useMemo(() => ({
    prices, isPricesLoading, priceError, news, isNewsLoading,
    refreshPrices: fetchPrices, refreshNews: fetchNews,
  }), [prices, isPricesLoading, priceError, news, isNewsLoading, fetchPrices, fetchNews]);

  const contextValue = useMemo(() => ({
    isDarkMode, toggleTheme,
    accountType, accountTypeSet, setAccountType,
    p2pCountry, p2pCurrency, setP2PPreferences,
    lockedBalance, lockBalance, unlockBalance, resetLockedBalances, creditP2PBalance,
    kycStatus, refreshKYCStatus,
    balanceVisible, toggleBalanceVisible,
    pinEnabled, refreshPinEnabled,
    walletAddress, tronAddress, walletName, setWalletName: handleSetWalletName,
    ethBalance, isLoadingBalance, hasWallet, isLoadingWallet, isReadOnly, isSyncing,
    balances, cardBalance, cardFrozen, network, transactions,
    cardDetails, cardCreated, createCard, updateCardDetails, generateCardDetails, cardTransactions,
    setCardDetails,
    addTx,
    updateTxStatus,
    generateMnemonic: () => walletService.generateMnemonic(),
    createWallet, importWallet, deleteWallet, enterReadOnlyMode, refreshBalance, refreshCardData, fetchBalance,
    sendETH, sendCrypto, topupCard, spendCard, toggleFreezeCard, applySwapBalances, switchNetwork,
    fiatCurrency, setFiatCurrency, formatFiat, convertFiat, fiatSymbol,
    isGlobalLoading,
    setGlobalLoading: (loading: boolean, msg?: string) => {
      if (msg) setGlobalLoadingMessage(msg);
      setIsGlobalLoading(loading);
    },
    globalLoadingMessage
  }), [
    isDarkMode, toggleTheme, accountType, accountTypeSet, setAccountType,
    p2pCountry, p2pCurrency, setP2PPreferences, lockedBalance, lockBalance, unlockBalance, resetLockedBalances, creditP2PBalance,
    kycStatus, refreshKYCStatus, balanceVisible, toggleBalanceVisible,
    pinEnabled, refreshPinEnabled, addTx, updateTxStatus, walletAddress, tronAddress, walletName, handleSetWalletName,
    ethBalance, isLoadingBalance, hasWallet, isLoadingWallet, isReadOnly, isSyncing,
    balances, cardBalance, cardFrozen, network, transactions,
    cardDetails, cardCreated, createCard, updateCardDetails, generateCardDetails, cardTransactions,
    createWallet, importWallet, deleteWallet, enterReadOnlyMode, refreshBalance, refreshCardData, fetchBalance,
    sendETH, sendCrypto, topupCard, spendCard, toggleFreezeCard, applySwapBalances, switchNetwork,
    fiatCurrency, setFiatCurrency, formatFiat, convertFiat, fiatSymbol,
    isGlobalLoading,
    globalLoadingMessage
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
