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
  importWallet: (mnemonic: string, isNew?: boolean) => Promise<void>;
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
  switchNetwork: (n: string) => void;
  creditP2PBalance: (token: string, amount: number) => void;
  resetLockedBalances: () => void;
};

const WalletContext = createContext<WalletContextType>({} as WalletContextType);

// Zero fallback — real prices always come from CoinGecko via marketService.
// Using 0 ensures the UI shows a loading state rather than stale hardcoded values.
const FALLBACK_PRICES: Record<string, CoinPrice> = {
  ETH:   { usd: 0, change24h: 0 },
  BTC:   { usd: 0, change24h: 0 },
  USDT:  { usd: 0, change24h: 0 },
  USDC:  { usd: 0, change24h: 0 },
  DAI:   { usd: 0, change24h: 0 },
  SOL:   { usd: 0, change24h: 0 },
  MATIC: { usd: 0, change24h: 0 },
  BNB:   { usd: 0, change24h: 0 },
  TRX:   { usd: 0, change24h: 0 },
};

export function WalletProvider({ children }: { children: ReactNode }) {
  const [isDarkMode,       setIsDarkMode]       = useState(true);
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
  const [balances, setBalances] = useState<Record<string, number>>({
    ETH: 0, USDC: 0, USDT: 0, DAI: 0, BTC: 0, SOL: 0, CUSTOM: 0, TRX: 0
  });
  const [prices,          setPrices]        = useState<Record<string, CoinPrice>>(FALLBACK_PRICES);
  const [isPricesLoading, setIsPricesLoading] = useState(true);
  const [priceError,      setPriceError]    = useState(false);
  const [news,            setNews]          = useState<NewsItem[]>([]);
  const [isNewsLoading,   setIsNewsLoading] = useState(true);

  const [dataLoaded,     setDataLoaded]     = useState(false);
  const [isSyncing,      setIsSyncing]      = useState(false);
  const pendingAddressRef  = useRef<{ address: string; net: string } | null>(null);
  const ethBalanceRef      = useRef('0.0');
  const balancesRef        = useRef<Record<string, number>>({ ETH: 0, USDT: 0, USDC: 0, DAI: 0, BTC: 0, SOL: 0 });
  const priceIntervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const newsIntervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const balanceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncInProgressRef  = useRef(false);

  useEffect(() => { ethBalanceRef.current = ethBalance; }, [ethBalance]);

  const toggleTheme = useCallback(async () => {
    setIsDarkMode(prev => {
      const newVal = !prev;
      AsyncStorage.setItem('cw_is_dark_mode', String(newVal)).catch(() => {});
      return newVal;
    });
  }, []);

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
      return updated;
    });
  }, []);

  const unlockBalance = useCallback((token: string, amount: number) => {
    setLockedBalance(prev => {
      const updated = { ...prev, [token]: Math.max(0, (prev[token] || 0) - amount) };
      AsyncStorage.setItem('cw_locked_balance', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const resetLockedBalances = useCallback(() => {
    setLockedBalance({});
    AsyncStorage.removeItem('cw_locked_balance').catch(() => {});
  }, []);

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
        const stored = await storageService.getTronAddress();
        if (stored) {
          fetchAddr = stored;
        } else {
          const mnemonic = await storageService.getMnemonic();
          if (mnemonic) {
            const { deriveTronAddress } = await import('../services/tronService');
            const tron = await deriveTronAddress(mnemonic);
            fetchAddr = tron.address;
            setTronAddress(tron.address);
            storageService.saveTronAddress(tron.address).catch(() => {});
          }
        }
      }
      const onChain = await getWalletBalances(fetchAddr, net, balancesRef.current);
      setEthBalance(onChain.ETH.toFixed(6));
      ethBalanceRef.current = onChain.ETH.toFixed(6);
      setBalances(onChain);
      balancesRef.current = onChain;
      await AsyncStorage.setItem('cw_token_balances', JSON.stringify(onChain));
    } catch (e) {
    } finally {
      setIsLoadingBalance(false);
    }
  }, []);

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
        const [savedDarkMode, savedAccountType, savedP2PCountry, savedP2PCurrency, savedLockedBal] = await Promise.all([
          AsyncStorage.getItem('cw_is_dark_mode'),
          AsyncStorage.getItem('cw_account_type'),
          AsyncStorage.getItem('cw_p2p_country'),
          AsyncStorage.getItem('cw_p2p_currency'),
          AsyncStorage.getItem('cw_locked_balance'),
        ]);

        if (savedDarkMode !== null) setIsDarkMode(savedDarkMode === 'true');
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
          if (savedDetails)     setCardDetails(JSON.parse(savedDetails));
          if (savedCardCreated) setCardCreated(savedCardCreated === 'true');
          if (savedCardTxs)     setCardTransactions(JSON.parse(savedCardTxs));
          setCardFrozen(savedFrozen);
          if (savedTokenBals) {
            const parsed = JSON.parse(savedTokenBals);
            setBalances(parsed);
            balancesRef.current = parsed;
          }

          // ── Step 2: Supabase sync — AWAITED so card/txs restore before UI renders ──
          // set_wallet must complete first so RLS policies allow the queries
          try {
            await setWallet(address);
            const [vcc, dbCard, dbTxs, variants, kycRecord] = await Promise.all([
              vccService.getCard(address),
              dbCardService.getCard(address),
              txService.getAll(address, 200),
              cardVariantService.getVariants(),
              kycService.getStatus(address),
            ]);

            // KYC
            setKycStatus(kycRecord?.status ?? null);

            // ── Card restore: Supabase wins over AsyncStorage ──
            if (vcc || dbCard) supabaseCardRestoredRef.current = true;
            if (vcc) {
              const variant = variants.find(v => v.id === vcc.card_variant);
              // Preserve full card number from AsyncStorage if it exists
              const existingDetails = savedDetails ? JSON.parse(savedDetails) : null;
              const existingNumber = existingDetails?.number ?? '';
              const hasFullNumber = /^\d{4}\s\d{4}\s\d{4}\s\d{4}$/.test(existingNumber);
              const restoredDetails = {
                number:     hasFullNumber ? existingNumber : ('•••• •••• •••• ' + vcc.card_last4),
                expiry:     vcc.expiry_mm_yy,
                cvv:        existingDetails?.cvv && existingDetails.cvv !== '•••' ? existingDetails.cvv : '•••',
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
              const existingDetails = savedDetails ? JSON.parse(savedDetails) : null;
              const existingNumber = existingDetails?.number ?? '';
              const hasFullNumber = /^\d{4}\s\d{4}\s\d{4}\s\d{4}$/.test(existingNumber);
              const restoredDetails = {
                number:     hasFullNumber ? existingNumber : ('•••• •••• •••• ' + dbCard.card_last4),
                expiry:     existingDetails?.expiry ?? (dbCard.expiry_month + '/' + dbCard.expiry_year),
                cvv:        existingDetails?.cvv && existingDetails.cvv !== '•••' ? existingDetails.cvv : '•••',
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
    // If already syncing, force-reset the lock after 10s to prevent permanent block
    if (syncInProgressRef.current) {
      const lockAge = Date.now() - (syncInProgressRef as any).lockedAt;
      if (lockAge < 10000) return;
      syncInProgressRef.current = false;
    }
    setIsSyncing(true);
    syncInProgressRef.current = true;
    (syncInProgressRef as any).lockedAt = Date.now();
    try {
      await fetchBalance(walletAddress, network);
      const newTxs = await transactionService.syncIncoming(walletAddress, network, prices.ETH?.usd ?? 3500);
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
  }, [walletAddress, network, prices, fetchBalance]);

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
        USDC: 0, USDT: 0, DAI: 0, BTC: 0, SOL: 0, CUSTOM: 0 
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
    fetchNews();
    priceIntervalRef.current = setInterval(fetchPrices, 60_000);
    newsIntervalRef.current  = setInterval(fetchNews,   300_000);
    return () => {
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
        await fetchBalance(walletAddress, network);
        const newTxs = await transactionService.syncIncoming(walletAddress, network, prices.ETH?.usd ?? 3500);
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
  }, [hasWallet, walletAddress, network, prices, fetchBalance]);

  const handleSetWalletName = useCallback(async (name: string) => {
    setWalletNameState(name);
    await storageService.saveWalletName(name);
    // Persist to Supabase so it survives logout/re-login
    if (walletAddress) {
      profileService.upsert(walletAddress, { wallet_name: name }).catch(() => {});
    }
  }, [walletAddress]);

  const createWallet = useCallback(async (): Promise<{ mnemonic: string; address: string }> => {
    return walletService.generateWalletPreview();
  }, []);

  const importWallet = useCallback(async (mnemonic: string, isNew: boolean = false) => {
    try {
      setIsLoadingWallet(true);

      // Clear all in-memory state immediately
      setCardBalance(0);
      setCardCreated(false);
      setCardTransactions([]);
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
      ]);

      if (isNew || isSwitching) {
        setBalances({ ETH: 0, USDT: 0, USDC: 0, DAI: 0, BTC: 0, SOL: 0 });
        setEthBalance('0.0');
        setLockedBalance({});
      }

      await storageService.saveWallet(data.privateKey, data.mnemonic, data.address, (data as any).tronAddress);
      await clearPin();
      setPinEnabled(false);
      setIsReadOnly(false);
      setWalletAddress(data.address);
      if ((data as any).tronAddress) setTronAddress((data as any).tronAddress);
      setHasWallet(true);

      try {
        await setWallet(data.address);

        // ── Fetch everything from Supabase in parallel ──
        const [vcc, dbCard, dbTxs, variants, kycRecord, p2pOrders] = await Promise.all([
          vccService.getCard(data.address),
          dbCardService.getCard(data.address),
          txService.getAll(data.address, 500),
          cardVariantService.getVariants(),
          kycService.getStatus(data.address),
          supabase
            .from('p2p_orders')
            .select('*')
            .or(`seller_wallet.eq.${data.address.toLowerCase()},buyer_wallet.eq.${data.address.toLowerCase()}`)
            .order('created_at', { ascending: false })
            .then(r => r.data ?? []),
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
          const restoredDetails = {
            number:     '•••• •••• •••• ' + vcc.card_last4,
            expiry:     vcc.expiry_mm_yy,
            cvv:        '•••',
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
          const restoredDetails = {
            number:     '•••• •••• •••• ' + dbCard.card_last4,
            expiry:     dbCard.expiry_month + '/' + dbCard.expiry_year,
            cvv:        '•••',
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

        // ── Restore P2P orders as transactions ──
        const p2pTxs: Transaction[] = (p2pOrders as any[]).map((o: any) => {
          const isSeller = o.seller_wallet?.toLowerCase() === data.address.toLowerCase();
          const statusMap: Record<string, Transaction['status']> = {
            completed: 'success', cancelled: 'failed',
            open: 'pending', in_escrow: 'pending', fiat_sent: 'pending', disputed: 'pending',
          };
          return {
            id:       `p2p_${o.id}`,
            type:     isSeller ? 'sent' as const : 'received' as const,
            coin:     o.token,
            amount:   String(o.amount),
            usdValue: String(o.fiat_total ?? 0),
            address:  isSeller
              ? `P2P Sale · ${o.token} → ${o.fiat_currency}`
              : `P2P Buy · ${o.fiat_currency} → ${o.token}`,
            status:   statusMap[o.status] ?? 'pending',
            date:     o.created_at
              ? new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : new Date().toLocaleDateString(),
          };
        });

        // Merge: Supabase txs + P2P txs, deduplicate by id
        const allTxs = [...restoredTxs, ...p2pTxs];
        const seenIds = new Set<string>();
        const dedupedTxs = allTxs.filter(t => {
          if (seenIds.has(t.id)) return false;
          seenIds.add(t.id);
          return true;
        });

        if (dedupedTxs.length > 0) {
          setTransactions(dedupedTxs);
          await AsyncStorage.setItem('cw_transactions', JSON.stringify(dedupedTxs));
        }

        // ── Restore locked balances from active P2P orders ──
        const activeLocks: Record<string, number> = {};
        (p2pOrders as any[]).forEach((o: any) => {
          if (!['open', 'in_escrow', 'fiat_sent'].includes(o.status)) return;
          if (o.seller_wallet?.toLowerCase() === data.address.toLowerCase()) {
            activeLocks[o.token] = (activeLocks[o.token] || 0) + o.amount;
          }
        });
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
      ;(async () => {
        try {
          await fetchBalance(data.address, network);
          const newTxs = await transactionService.syncIncoming(data.address, network, prices.ETH?.usd ?? 3500, true);
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
  }, [walletAddress, network, prices, fetchBalance]);

  const deleteWallet = useCallback(async (): Promise<void> => {
    // LOGOUT — clears keys + address + read-only flag.
    // AsyncStorage data (txns, balances) is preserved so re-importing
    // the same phrase on this device restores everything instantly.
    await storageService.clearKeysOnly(); // removes privateKey, mnemonic, AND wallet_address
    clearWalletSession();
    await clearPin();
    await AsyncStorage.removeItem('cw_read_only');
    // Fully reset in-memory state → App.tsx re-renders Landing stack
    setHasWallet(false);
    setWalletAddress('');
    setTronAddress('');
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
        const variant = variants.find(v => v.id === vcc.card_variant);
        const existing = await AsyncStorage.getItem('cw_card_details').catch(() => null);
        const existingParsed = existing ? JSON.parse(existing) : null;
        const existingNum = existingParsed?.number ?? '';
        const hasFullNum = /^\d{4}\s\d{4}\s\d{4}\s\d{4}$/.test(existingNum);
        const details = {
          number:     hasFullNum ? existingNum : ('•••• •••• •••• ' + vcc.card_last4),
          expiry:     vcc.expiry_mm_yy,
          cvv:        existingParsed?.cvv && existingParsed.cvv !== '•••' ? existingParsed.cvv : '•••',
          brand:      (vcc.card_network === 'Mastercard' ? 'MASTERCARD' : 'VISA') as 'VISA' | 'MASTERCARD',
          holderName: vcc.card_holder_name,
          design:     variant?.color_hex ?? 'dark',
        };
        setCardCreated(true);
        setCardBalance(vcc.balance);
        setCardFrozen(vcc.card_status === 'frozen');
        setCardDetails(details);
        AsyncStorage.multiSet([['cw_card_balance', String(vcc.balance)], ['cw_card_details', JSON.stringify(details)]]).catch(() => {});
      } else if (dbCard) {
        const existing = await AsyncStorage.getItem('cw_card_details').catch(() => null);
        const existingParsed = existing ? JSON.parse(existing) : null;
        const existingNum = existingParsed?.number ?? '';
        const hasFullNum = /^\d{4}\s\d{4}\s\d{4}\s\d{4}$/.test(existingNum);
        if (hasFullNum && existingParsed) {
          setCardDetails({ ...existingParsed, holderName: dbCard.holder_name, design: dbCard.design });
        }
        setCardCreated(true);
        setCardBalance(dbCard.balance);
        setCardFrozen(dbCard.status === 'frozen');
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
    // Generate random card details (not wallet-derived)
    const arr = new Uint8Array(14);
    crypto.getRandomValues(arr);
    const digits = [4, ...Array.from(arr).map(b => b % 10)];
    let sum = 0;
    for (let i = 0; i < 15; i++) { let d = digits[i]; if ((15 - i) % 2 === 0) { d *= 2; if (d > 9) d -= 9; } sum += d; }
    digits.push((10 - (sum % 10)) % 10);
    const cardNumber = digits.join('').replace(/(.{4})/g, '$1 ').trim();
    const now = new Date();
    const expiry = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getFullYear() + 3).slice(-2)}`;
    const cvvArr = new Uint8Array(1);
    crypto.getRandomValues(cvvArr);
    const cvv = String(100 + (cvvArr[0] % 900));
    const last4 = cardNumber.replace(/\s/g, '').slice(-4);
    const [expMonth, expYear] = expiry.split('/');

    const details = { number: cardNumber, expiry, cvv, brand: 'VISA' as const, holderName: holderName.toUpperCase().trim() || 'CARD HOLDER', design };
    setCardDetails(details);
    setCardCreated(true);
    AsyncStorage.setItem('cw_card_created', 'true');
    AsyncStorage.setItem('cw_card_details', JSON.stringify(details));

    // Encrypt card number using wallet address as key and save to Supabase
    const encryptCardNumber = (num: string, key: string): string => {
      const keyBytes = key.toLowerCase().replace('0x', '');
      const clean = num.replace(/\s/g, '');
      return Array.from(clean).map((ch, i) => {
        const k = parseInt(keyBytes[i % keyBytes.length] ?? '0', 16);
        return String.fromCharCode(ch.charCodeAt(0) ^ k);
      }).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    };
    const encrypted = encryptCardNumber(cardNumber, walletAddress);
    dbCardService.saveEncryptedNumber(walletAddress, encrypted).catch(() => {});

    dbCardService.getCard(walletAddress).then(existing => {
      if (existing) {
        dbCardService.updateDesign(walletAddress, { holder_name: holderName, design }).catch(() => {});
      } else {
        dbCardService.createCard({
          wallet_address: walletAddress,
          card_last4:     last4,
          expiry_month:   expMonth ?? '12',
          expiry_year:    expYear  ?? '28',
          card_type:      'classic',
          balance:        0,
          status:         'active',
          holder_name:    holderName,
          design,
        }).catch(() => {});
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
