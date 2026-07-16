import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback, useMemo } from 'react';
import { Platform, AppState, AppStateStatus, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { walletService } from '../services/walletService';
import { ethereumService } from '../services/ethereumService';
import { getWalletBalances } from '../services/balanceService';
import { storageService } from '../services/storageService';
import getSymbolFromCurrency from 'currency-symbol-map';
import { marketService, NewsItem } from '../services/marketService';
import { hasPinSetup, clearPin } from '../services/pinService';
import { kycService, KYCStatus, txService, dbCardService, vccService, cardVariantService, VCCCard, profileService, adminSettingsService, adminAlertsService } from '../services/supabaseService';
import { transactionService } from '../services/transactionService';
import { cardService } from '../services/cardService';
import { supabase, setWallet, clearWalletSession } from '../services/supabaseClient';
import { notificationService } from '../services/notificationService';
import { DEFAULT_NETWORK, NETWORK_INFO } from '../constants';
import { ESCROW_CONTRACTS } from '../services/escrowService';
import { SUPPORTED_TOKENS, SUPPORTED_FIAT_CURRENCIES } from '../constants/currencyConfig';
import { commissionService } from '../services/commissionService';
import { parseDateSafe } from '../utils/date';

export type Transaction = {
  id: string;
  type: 'sent' | 'received' | 'card_topup' | 'card_spend' | 'swap' | 'fee';
  coin: string;
  amount: string;
  usdValue: string;
  address: string;
  status: 'success' | 'pending' | 'failed' | 'completed';
  date: string;
  txHash?: string;
  contractAddress?: string;
  isInternal?: boolean;
  buyToken?: string;
  buyAmount?: string;
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
  merchantCategory?: string;
  country?: string;
  currencyUsed?: string;
  exchangeRate?: number;
  cardUsed?: string;
  settlementBreakdown?: Record<string, number>;
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
  formatOrderFiat: (amountLocal: number, currencyCode: string) => string;
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
  spendCard: (coin: string, amountUSD: number, label: string, currency?: string) => boolean;
  toggleFreezeCard: () => void | Promise<void>;
  cardTransactions: CardTransaction[];
  enabledCardCurrencies: Record<string, boolean>;
  setEnabledCardCurrencies: (currencies: Record<string, boolean>) => Promise<void>;
  cardDetails: { number: string; expiry: string; cvv: string; brand: 'VISA' | 'MASTERCARD'; holderName: string; design: string; codegoCardId?: string };
  setCardDetails: (details: any) => void;
  cardCreated: boolean;
  createCard: (holderName: string, design: string) => void;
  deleteCard: () => Promise<void>;
  fundVirtualCard: (amountUsd: number) => Promise<boolean>;
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
  userUuid: string;
  userUid: string;
  kycEmail: string;
  kycFullName: string;
  adminNetworks: any[];
  bridgeINRX: (sourceNetwork: string, destChainId: number, amount: string, recipientAddress: string) => Promise<{ success: boolean; error?: string; txHash?: string; error?: string }>;
};

const WalletContext = createContext<WalletContextType>({} as WalletContextType);

// Zero fallback — real prices always come from CoinGecko via marketService.
// Using 0 ensures the UI shows a loading state rather than stale hardcoded values.
const FALLBACK_PRICES: Record<string, CoinPrice> = {
  ...Object.fromEntries(Object.keys(SUPPORTED_TOKENS).map(k => [k, { usd: 0, change24h: 0 }])),
  INRX: { usd: 0.012, change24h: 0.15 }
};

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
  const [userUuid,         setUserUuid]         = useState('');
  const [userUid,          setUserUid]          = useState('');
  const [kycEmail,         setKycEmail]         = useState('');
  const [kycFullName,      setKycFullName]      = useState('');
  const [ethBalance,       setEthBalance]       = useState('0.0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [hasWallet,        setHasWallet]        = useState(false);
  const [isReadOnly,       setIsReadOnly]       = useState(false);
  const [isLoadingWallet,  setIsLoadingWallet]  = useState(true);
  const [cardBalance,      setCardBalance]      = useState(0);
  const [cardFrozen,       setCardFrozen]       = useState(false);
  const [cardTransactions, setCardTransactions] = useState<CardTransaction[]>([]);
  const [enabledCardCurrencies, setEnabledCardCurrenciesState] = useState<Record<string, boolean>>(() => {
    // Build a fully explicit default — every token and fiat currency enabled
    const defaults: Record<string, boolean> = {};
    ['USDT','USDC','ETH','BTC','BNB','TRX','SOL','XRP','TON','SUI'].forEach(t => { defaults[t] = true; });
    ['USD','EUR','GBP','INR','AED','AUD','SGD','RUB','BHD','VND','SAR','KWD','THB','HKD','JPY'].forEach(f => { defaults[f] = true; });
    return defaults;
  });
  const [cardCreated,      setCardCreated]      = useState(false);
  const [paymentPriority,  setPaymentPriority]  = useState<string[]>(['USDT', 'BTC', 'ETH', 'BNB', 'TRX']);

  useEffect(() => {
    adminSettingsService.getSetting<string[]>('payment_priority', ['USDT', 'BTC', 'ETH', 'BNB', 'TRX'])
      .then(setPaymentPriority).catch(() => {});
  }, []);
  const [cardDetails,      setCardDetails]      = useState<{ number: string; expiry: string; cvv: string; brand: 'VISA' | 'MASTERCARD'; holderName: string; design: string; codegoCardId?: string }>({
    number: '\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022',
    expiry: '\u2022\u2022/\u2022\u2022',
    cvv: '\u2022\u2022\u2022',
    brand: 'VISA',
    holderName: 'CARD HOLDER',
    design: 'dark',
  });
  const [network,         setNetworkState]  = useState(DEFAULT_NETWORK);
  const [transactions,    setTransactions]  = useState<Transaction[]>([]);
  const [adminNetworks,   setAdminNetworks] = useState<any[]>([]);
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
      // Refresh KYC immediately based on new type
      try {
        if (type === 'business') {
          const { businessKYCService } = await import('../services/merchantService');
          const record = await businessKYCService.getStatus(walletAddress);
          setKycStatus(record?.status === 'approved' ? 'verified' : (record?.status ?? null));
        } else {
          const record = await kycService.getStatus(walletAddress);
          setKycStatus(record?.status ?? null);
        }
      } catch (e) {}
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

  const setEnabledCardCurrencies = useCallback(async (currencies: Record<string, boolean>) => {
    setEnabledCardCurrenciesState(currencies);
    // Persist user preferences to Supabase profile only — no AsyncStorage
    if (walletAddress) profileService.upsert(walletAddress, { card_currencies: currencies } as any).catch(() => {});
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
        if (((balancesRef.current as any)?.USDT_ERC20 ?? 0) > 0 && (merged as any).USDT_ERC20 === 0) (merged as any).USDT_ERC20 = (balancesRef.current as any).USDT_ERC20;
        if (((balancesRef.current as any)?.USDC_ERC20 ?? 0) > 0 && (merged as any).USDC_ERC20 === 0) (merged as any).USDC_ERC20 = (balancesRef.current as any).USDC_ERC20;
      } else {
        if ((balancesRef.current?.TRX ?? 0) > 0 && merged.TRX === 0) merged.TRX = balancesRef.current.TRX;
        if (((balancesRef.current as any)?.USDT_TRC20 ?? 0) > 0 && (merged as any).USDT_TRC20 === 0) (merged as any).USDT_TRC20 = (balancesRef.current as any).USDT_TRC20;
        if (((balancesRef.current as any)?.USDC_TRC20 ?? 0) > 0 && (merged as any).USDC_TRC20 === 0) (merged as any).USDC_TRC20 = (merged as any).USDC_TRC20;
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

  // Refresh card balance + transactions from Supabase on demand
  const refreshCardData = useCallback(async () => {
    if (!walletAddress) return;
    try {
      await setWallet(walletAddress);
      const [vcc, dbCard, dbTxs, variants, priorityData, platformCurrencies] = await Promise.all([
        vccService.getCard(walletAddress),
        dbCardService.getCard(walletAddress),
        txService.getAll(walletAddress, 200),
        cardVariantService.getVariants(),
        adminSettingsService.getSetting<string[]>('payment_asset_priority', ['USDT', 'BTC', 'ETH', 'BNB', 'TRX']),
        adminSettingsService.getSetting<Record<string, boolean>>('card_currencies_config', {}),
      ]);
      setPaymentPriority(priorityData);
      // Re-apply admin currency config on every refresh — Supabase only, no AsyncStorage
      {
        const base: Record<string, boolean> = {};
        ['USDT','USDC','ETH','BTC','BNB','TRX','SOL','XRP','TON','SUI'].forEach(t => { base[t] = true; });
        ['USD','EUR','GBP','INR','AED','AUD','SGD','RUB','BHD','VND','SAR','KWD','THB','HKD','JPY'].forEach(f => { base[f] = true; });
        if (platformCurrencies && Object.keys(platformCurrencies).length > 0) {
          Object.entries(platformCurrencies).forEach(([k, v]) => { base[k] = v; });
        }
        setEnabledCardCurrenciesState(base);
      }
      if (vcc && vcc.codego_card_id && !vcc.codego_card_id.startsWith('mock_cg_')) {
        // ── Fetch real KripiCard transactions and merge into cardTransactions ──
        try {
          const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
          const kripiTxRes = await fetch(`${apiUrl}/api/public/card/${vcc.card_last4}`);
          if (kripiTxRes.ok) {
            const kripiTxJson = await kripiTxRes.json();
            const kripiTxs: CardTransaction[] = (kripiTxJson.transactions || []).map((tx: any) => ({
              id: tx.id,
              type: tx.type === 'topup' ? 'topup' as const : 'spend' as const,
              amount: Number(tx.amount),
              label: tx.merchant || (tx.type === 'topup' ? 'Top-up' : 'Card Spend'),
              status: 'success' as const,
              timestamp: tx.date || new Date().toISOString(),
            }));
            // Update balance from KripiCard live data
            if (kripiTxJson.card?.balance !== undefined) {
              const liveBalance = Number(kripiTxJson.card.balance);
              setCardBalance(liveBalance);
              await vccService.updateBalance(walletAddress, liveBalance).catch(() => {});
              await AsyncStorage.multiSet([['cw_card_balance', String(liveBalance)]]).catch(() => {});
            }
            if (kripiTxs.length > 0) {
              setCardTransactions(kripiTxs);
              AsyncStorage.setItem('cw_card_transactions', JSON.stringify(kripiTxs)).catch(() => {});
              return; // skip Supabase tx merge below — KripiCard is source of truth
            }
          }
        } catch (_e) {}

        if (vcc.codego_card_id && (!dbCard || !dbCardService.decryptNumber(dbCard, walletAddress))) {
          try {
            const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
            const liveRes = await fetch(`${apiUrl}/api/cards/${vcc.codego_card_id}`);
            if (liveRes.ok) {
              const liveJson = await liveRes.json();
              const liveCard = liveJson.data?.card || liveJson.card;
              if (liveCard?.number && liveCard?.cvv) {
                await dbCardService.saveCredentials(walletAddress, liveCard.number, liveCard.cvv, {
                  expiry_month: vcc.expiry_mm_yy?.split('/')[0] || '12',
                  expiry_year: vcc.expiry_mm_yy?.split('/')[1] || '28',
                  card_type: vcc.card_variant,
                  balance: vcc.balance,
                  status: vcc.card_status === 'frozen' ? 'frozen' : 'active',
                  holder_name: vcc.card_holder_name,
                  design: 'dark',
                });
              }
            }
          } catch (_e) {}
          // Re-fetch dbCard after saving
          const { data: freshDbCard } = await (await import('../services/supabaseClient')).supabase
            .from('cards').select('*').eq('wallet_address', walletAddress.toLowerCase()).maybeSingle();
          if (freshDbCard) (dbCard as any) = freshDbCard;
        }
        // Try Supabase decrypt; fall back to current state (already loaded from AsyncStorage)
        let decryptedNumber = dbCard ? dbCardService.decryptNumber(dbCard, walletAddress) : '';
        let decryptedCvv    = dbCard ? dbCardService.decryptCvv(dbCard, walletAddress)    : '';

        // Auto-recover missing credentials — fetch from KripiCard API
        if (!decryptedNumber && vcc.codego_card_id && walletAddress) {
          try {
            const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
            const liveRes = await fetch(`${apiUrl}/api/cards/${vcc.codego_card_id}`);
            if (liveRes.ok) {
              const liveJson = await liveRes.json();
              const liveCard = liveJson.data?.card || liveJson.card;
              if (liveCard?.number && liveCard?.cvv) {
                decryptedNumber = liveCard.number;
                decryptedCvv = liveCard.cvv;
                await dbCardService.saveCredentials(walletAddress, decryptedNumber, decryptedCvv, {
                  expiry_month: vcc.expiry_mm_yy?.split('/')[0] || '12',
                  expiry_year: vcc.expiry_mm_yy?.split('/')[1] || '28',
                  card_type: vcc.card_variant,
                  balance: vcc.balance,
                  status: vcc.card_status === 'frozen' ? 'frozen' : 'active',
                  holder_name: vcc.card_holder_name,
                  design: variants?.[0]?.color_hex || 'dark',
                });
              }
            }
          } catch (_e) {}
        }
        setCardCreated(true);
        setCardBalance(vcc.balance);
        setCardFrozen(vcc.card_status === 'frozen');
        setCardDetails(prev => {
          const prevDigitsLength = String(prev.number).replace(/\s/g, '').replace(/\D/g, '').length;
          const hasValidPrev = prevDigitsLength >= 15;
          const hasValidPrevCvv = String(prev.cvv).replace(/\D/g, '').length >= 3;

          const newNum = decryptedNumber || (hasValidPrev ? prev.number : ('•••• •••• •••• ' + vcc.card_last4));
          const newCvv = decryptedCvv    || (hasValidPrevCvv ? prev.cvv : '•••');

          if (prev.number === newNum && prev.cvv === newCvv && prev.holderName === vcc.card_holder_name && prev.expiry === vcc.expiry_mm_yy) return prev;

          const nextDetails = { ...prev, number: newNum, cvv: newCvv, holderName: vcc.card_holder_name, expiry: vcc.expiry_mm_yy, codegoCardId: vcc.codego_card_id };
          storageService.saveCardDetails(nextDetails).catch(() => {});
          return nextDetails;
        });
        AsyncStorage.multiSet([['cw_card_balance', String(vcc.balance)]]).catch(() => {});
      } else if (vcc && (!vcc.codego_card_id || vcc.codego_card_id.startsWith('mock_cg_'))) {
        // Mock card — delete it so user can create a real KripiCard
        await supabase.from('vcc_cards').delete().eq('wallet_address', walletAddress.toLowerCase()).catch(() => {});
        await AsyncStorage.multiRemove(['cw_card_created', 'cw_card_balance', 'cw_card_transactions']);
        storageService.clearCardDetails().catch(() => {});
        setCardCreated(false);
        setCardBalance(0);
        setCardDetails({ number: '\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022', expiry: '\u2022\u2022/\u2022\u2022', cvv: '\u2022\u2022\u2022', brand: 'VISA', holderName: 'CARD HOLDER', design: 'dark' });
      } else if (dbCard) {
        let decryptedNumber = dbCardService.decryptNumber(dbCard, walletAddress);
        let decryptedCvv    = dbCardService.decryptCvv(dbCard, walletAddress);

        // No credentials and no codego_card_id — nothing to recover from

        setCardCreated(true);
        setCardBalance(dbCard.balance);
        setCardFrozen(dbCard.status === 'frozen');
        setCardDetails(prev => {
          const prevDigitsLength = String(prev.number).replace(/\s/g, '').replace(/\D/g, '').length;
          const hasValidPrev = prevDigitsLength >= 15;
          const hasValidPrevCvv = String(prev.cvv).replace(/\D/g, '').length >= 3;
          
          const newNum = decryptedNumber || (hasValidPrev ? prev.number : ('•••• •••• •••• ' + dbCard.card_last4));
          const newCvv = decryptedCvv    || (hasValidPrevCvv ? prev.cvv : '•••');
          
          if (prev.number === newNum && prev.cvv === newCvv) return prev;
          
          const nextDetails = { ...prev, number: newNum, cvv: newCvv, holderName: dbCard.holder_name, expiry: dbCard.expiry_month + '/' + dbCard.expiry_year };
          storageService.saveCardDetails(nextDetails).catch(() => {});
          return nextDetails;
        });
        AsyncStorage.setItem('cw_card_balance', String(dbCard.balance)).catch(() => {});
      }
      // Deduplicate card txs: group by reference_id (sandbox) or label+created_at minute bucket
      // This cleans up old per-asset duplicate entries written by previous versions
      const rawCardTxs = dbTxs.filter(t => t.type === 'card_topup' || t.type === 'card_spend');
      const seenCardKeys = new Set<string>();
      const dedupedCardTxs = rawCardTxs.filter(t => {
        // Prefer reference_id dedup (sandbox terminal inserts)
        const key = t.reference_id
          ? `ref:${t.reference_id}`
          : `${t.type}:${t.label}:${t.created_at ? new Date(t.created_at).toISOString().slice(0, 16) : ''}:${t.usd_value}`;
        if (seenCardKeys.has(key)) return false;
        seenCardKeys.add(key);
        return true;
      });
      const cardTxs: CardTransaction[] = dedupedCardTxs.map(t => ({
        id:         t.id ?? Date.now().toString(),
        type:       t.type === 'card_topup' ? 'topup' as const : 'spend' as const,
        amount:     t.usd_value,
        label:      t.label ?? (t.type === 'card_topup' ? 'Top-up' : 'Spend'),
        coin:       t.token,
        coinAmount: t.amount,
        status:     'success' as const,
        timestamp:  t.created_at ?? new Date().toISOString(),
        currencyUsed: (t as any).currency_used,
      }));
      // Always update — replaces old corrupt/duplicate data with fresh Supabase data
      setCardTransactions(cardTxs);
      AsyncStorage.setItem('cw_card_transactions', JSON.stringify(cardTxs)).catch(() => {});
    } catch {}
  }, [walletAddress]);

  const toggleBalanceVisible = useCallback(() => setBalanceVisible(p => !p), []);
  const toggleFreezeCard = useCallback(async () => {
    const newVal = !cardFrozen;
    setCardFrozen(newVal);
    cardService.setCardFrozen(newVal);
    
    // Sync to Codego if codegoCardId is present
    const codegoCardId = cardDetails?.codegoCardId;
    if (codegoCardId) {
      try {
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
        const res = await fetch(`${apiUrl}/api/cards/${codegoCardId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newVal ? 'frozen' : 'active' })
        });
        if (!res.ok) console.warn('[toggleFreezeCard] failed to sync status to Codego API');
      } catch (e) {
        console.warn('[toggleFreezeCard] error syncing status to Codego:', e);
      }
    }

    // Persist freeze state to Supabase (check both tables for safety during migration)
    dbCardService.updateStatus(walletAddress, newVal ? 'frozen' : 'active').catch(() => {});
    vccService.updateStatus(walletAddress, newVal ? 'frozen' : 'active').catch(() => {});
    
    // Log alert to admin dashboard
    const action = newVal ? 'frozen' : 'unfrozen';
    const message = `User ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} has ${action} their card.`;
    adminAlertsService.logAlert(
      `card_${action}`,
      message,
      walletAddress
    ).catch(() => {});
  }, [walletAddress, cardFrozen, cardDetails]);

  const reportLostCard = useCallback(async () => {
    if (!walletAddress) return;
    try {
      cardService.setCardFrozen(true);
      setCardFrozen(true);

      const codegoCardId = cardDetails?.codegoCardId;
      if (codegoCardId) {
        try {
          const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
          await fetch(`${apiUrl}/api/cards/${codegoCardId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'blocked' })
          });
        } catch (e) {
          console.warn('[reportLostCard] failed to sync status to Codego API:', e);
        }
      }

      await dbCardService.updateStatus(walletAddress, 'frozen').catch(() => {});
      await vccService.updateStatus(walletAddress, 'frozen').catch(() => {});
      
      const message = `User ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} reported their card as LOST.`;
      await adminAlertsService.logAlert(
        'card_lost',
        message,
        walletAddress
      );
    } catch (e) {
      console.warn('[reportLostCard] Failed to report lost card:', e);
    }
  }, [walletAddress, cardDetails]);

  const deleteCard = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const codegoCardId = cardDetails?.codegoCardId;
      if (codegoCardId) {
        try {
          const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
          await fetch(`${apiUrl}/api/cards/${codegoCardId}`, {
            method: 'DELETE',
          });
        } catch (e) {
          console.warn('[deleteCard] failed to sync DELETE to API:', e);
        }
      }

      await vccService.updateStatus(walletAddress, 'terminated').catch(() => {});
      await dbCardService.updateStatus(walletAddress, 'frozen').catch(() => {});

      setCardCreated(false);
      setCardBalance(0);
      setCardFrozen(false);
      await AsyncStorage.multiRemove([
        'cw_card_created',
        'cw_card_balance',
      ]);
    } catch (e) {
      console.warn('[deleteCard] error:', e);
    }
  }, [walletAddress, cardDetails]);

  const fundVirtualCard = useCallback(async (amountUsd: number): Promise<boolean> => {
    if (!walletAddress || amountUsd <= 0) return false;
    try {
      const codegoCardId = cardDetails?.codegoCardId;
      if (codegoCardId) {
        try {
          const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
          const res = await fetch(`${apiUrl}/api/cards/${codegoCardId}/fund`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: amountUsd, currency: 'USD' })
          });
          if (!res.ok) {
            console.warn('[fundVirtualCard] API call failed');
          }
        } catch (e) {
          console.warn('[fundVirtualCard] error calling fund endpoint:', e);
        }
      }
      const newBal = cardBalance + amountUsd;
      setCardBalance(newBal);
      await vccService.updateBalance(walletAddress, newBal).catch(() => {});
      await dbCardService.updateBalance(walletAddress, newBal).catch(() => {});
      await AsyncStorage.setItem('cw_card_balance', String(newBal)).catch(() => {});
      return true;
    } catch (e) {
      console.warn('[fundVirtualCard] error:', e);
      return false;
    }
  }, [walletAddress, cardDetails, cardBalance]);

  const refreshPinEnabled = useCallback(async () => {
    setPinEnabled(await hasPinSetup());
  }, []);

  const refreshKYCStatus = useCallback(async () => {
    if (!walletAddress) return;
    try {
      if (accountType === 'business') {
        const { businessKYCService } = await import('../services/merchantService');
        const record = await businessKYCService.getStatus(walletAddress);
        setKycStatus(record?.status === 'approved' ? 'verified' : (record?.status ?? null));
      } else {
        const record = await kycService.getStatus(walletAddress);
        // Map 'approved' (Codego legacy) to 'verified' for UI consistency
        const rawStatus = record?.status as any;
        setKycStatus(rawStatus === 'approved' ? 'verified' : rawStatus ?? null);
        if (record?.email) {
          setKycEmail(record.email);
        } else {
          setKycEmail('');
        }
        if (record?.full_name) {
          setKycFullName(record.full_name);
        } else {
          setKycFullName('');
        }
      }
    } catch (_e) {}
  }, [walletAddress, accountType]);

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
        // NOTE: cw_card_currencies intentionally NOT read from AsyncStorage.
        // Card currency config comes from Supabase only (admin_settings + user profile).

        if (savedDarkMode !== null) setIsDarkMode(savedDarkMode === 'true');
        if (savedFiatCurrency !== null) setFiatCurrencyState(savedFiatCurrency);
        if (savedAccountType === 'business') setAccountTypeState('business');
        if (savedP2PCountry)  setP2PCountryState(savedP2PCountry);
        if (savedP2PCurrency) setP2PCurrencyState(savedP2PCurrency);
        if (savedLockedBal)   setLockedBalance(JSON.parse(savedLockedBal));
        // card_currencies: loaded exclusively from Supabase below — no AsyncStorage read

        if (savedAccountType && savedP2PCountry && savedP2PCurrency) {
          setAccountTypeSet(true);
        }

        const address = await storageService.getWalletAddress();
        if (address) {
          setWalletAddress(address);
          setHasWallet(true);
          setWallet(address).catch(() => {});

          // One-time cleanup: wipe corrupt duplicate card transactions from AsyncStorage
          // These were written by the old topupCard flow (now deprecated) on 27/5/2026
          const savedCardTxsRaw = await AsyncStorage.getItem('cw_card_transactions');
          if (savedCardTxsRaw) {
            try {
              const parsed = JSON.parse(savedCardTxsRaw);
              if (Array.isArray(parsed) && parsed.length > 0) {
                // Detect corrupt data: >3 entries with same timestamp within 1 minute
                const timestamps = parsed.map((t: any) => t.timestamp).filter(Boolean);
                const firstTs = timestamps[0];
                const sameCount = timestamps.filter((ts: string) =>
                  Math.abs(new Date(ts).getTime() - new Date(firstTs).getTime()) < 60000
                ).length;
                if (sameCount >= 3) {
                  // Corrupt data — wipe it, Supabase will replace on next sync
                  await AsyncStorage.removeItem('cw_card_transactions');
                  setCardTransactions([]);
                }
              }
            } catch { await AsyncStorage.removeItem('cw_card_transactions'); }
          }
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
            storageService.getCardDetails(),
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
            const parsed = typeof savedDetails === 'string' ? JSON.parse(savedDetails) : savedDetails;
            // Normalize number to "XXXX XXXX XXXX XXXX" format
            if (parsed?.number) {
              const digits = String(parsed.number).replace(/\s/g, '').replace(/\D/g, '');
              if (digits.length === 16) {
                const fixed = `${digits.slice(0,4)} ${digits.slice(4,8)} ${digits.slice(8,12)} ${digits.slice(12,16)}`;
                if (parsed.number !== fixed) {
                  parsed.number = fixed;
                  storageService.saveCardDetails(parsed).catch(() => {});
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
            const [vcc, dbCard, dbTxs, variants, kycRecord, dbNetworksRes, bizRecord, pPriority, platformCurrencies] = await Promise.all([
              vccService.getCard(address),
              dbCardService.getCard(address),
              txService.getAll(address, 200),
              cardVariantService.getVariants(),
              kycService.getStatus(address),
              supabase.from('admin_networks').select('*').eq('is_active', true),
              import('../services/merchantService').then(m => m.businessKYCService.getStatus(address)).catch(() => null),
              adminSettingsService.getSetting<string[]>('payment_asset_priority', ['USDT', 'BTC', 'ETH', 'BNB', 'TRX']),
              adminSettingsService.getSetting<Record<string, boolean>>('card_currencies_config', {}),
            ]);
            setPaymentPriority(pPriority);
            // Card currencies: build from full-enabled defaults,
            // then apply admin-disabled entries unconditionally.
            // No AsyncStorage involved — Supabase is the only source of truth.
            {
              const base: Record<string, boolean> = {};
              ['USDT','USDC','ETH','BTC','BNB','TRX','SOL','XRP','TON','SUI'].forEach(t => { base[t] = true; });
              ['USD','EUR','GBP','INR','AED','AUD','SGD','RUB','BHD','VND','SAR','KWD','THB','HKD','JPY'].forEach(f => { base[f] = true; });
              if (platformCurrencies && Object.keys(platformCurrencies).length > 0) {
                Object.entries(platformCurrencies).forEach(([k, v]) => { base[k] = v; });
              }
              setEnabledCardCurrenciesState(base);
            }

            // Inject Dynamic Networks from Admin Dashboard
            if (dbNetworksRes?.data && dbNetworksRes.data.length > 0) {
               setAdminNetworks(dbNetworksRes.data);
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
                      symbol: n.symbol,
                      iconUrl: n.icon_url ?? '',
                    } as any;
                 }
               });
            }

            // KYC
            const acctType = savedAccountType ?? 'personal';
            if (acctType === 'business') {
              setKycStatus(bizRecord?.status === 'approved' ? 'verified' : (bizRecord?.status as any ?? null));
            } else {
              // Map 'approved' (Codego legacy) to 'verified' for UI consistency
              const rawStatus = kycRecord?.status as any;
              setKycStatus(rawStatus === 'approved' ? 'verified' : rawStatus ?? null);
              if (kycRecord?.email) {
                setKycEmail(kycRecord.email);
              }
              if (kycRecord?.full_name) {
                setKycFullName(kycRecord.full_name);
              }
            }

            // ── Restore profile fields from Supabase (wins over AsyncStorage) ──
            if (vcc || dbCard) supabaseCardRestoredRef.current = true;

            // Restore network preference
            if (kycRecord) {} // placeholder to keep block structure
            let profileForStartup = await profileService.get(address).catch(() => null);
            if (!profileForStartup) {
              const defaultName = savedName || `Wallet ${address.slice(-4).toUpperCase()}`;
              profileForStartup = await profileService.upsert(address, { wallet_name: defaultName }).catch(() => null);
            }
            if (profileForStartup) {
              if (profileForStartup.user_uuid) {
                setUserUuid(profileForStartup.user_uuid);
              }
              if (profileForStartup.user_uid) {
                setUserUid(profileForStartup.user_uid.toString());
              }
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
            // Helper: fetch real credentials from KripiCard API
            const fetchKripiCredentials = async (kripiCardId: string, vccRow: any, variantRow: any): Promise<{ number: string; cvv: string } | null> => {
              try {
                const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
                const res = await fetch(`${apiUrl}/api/cards/${kripiCardId}`);
                if (!res.ok) return null;
                const json = await res.json();
                const card = json.data?.card || json.card;
                if (!card?.number || !card?.cvv) return null;
                const [expMonth, expYear] = (vccRow?.expiry_mm_yy || '12/28').split('/');
                dbCardService.saveCredentials(address, card.number, card.cvv, {
                  expiry_month: expMonth ?? '12',
                  expiry_year: expYear ?? '28',
                  card_type: vccRow?.card_variant ?? 'classic',
                  balance: vccRow?.balance ?? 0,
                  status: vccRow?.card_status === 'frozen' ? 'frozen' : 'active',
                  holder_name: vccRow?.card_holder_name ?? 'CARD HOLDER',
                  design: variantRow?.color_hex ?? 'dark',
                }).catch(() => {});
                return { number: card.number, cvv: card.cvv };
              } catch { return null; }
            };

            if (vcc && vcc.codego_card_id && !vcc.codego_card_id.startsWith('mock_cg_')) {
              const variant = variants.find(v => v.id === vcc.card_variant);
              let finalNumber = dbCard ? dbCardService.decryptNumber(dbCard, address) : '';
              let finalCvv    = dbCard ? dbCardService.decryptCvv(dbCard, address)    : '';
              // Still nothing — fetch real credentials from KripiCard API
              if (!finalNumber) {
                const live = await fetchKripiCredentials(vcc.codego_card_id, vcc, variant);
                if (live) { finalNumber = live.number; finalCvv = live.cvv; }
              }
              const restoredDetails = {
                number:     finalNumber,
                expiry:     vcc.expiry_mm_yy,
                cvv:        finalCvv,
                brand:      (vcc.card_network === 'Mastercard' ? 'MASTERCARD' : 'VISA') as 'VISA' | 'MASTERCARD',
                holderName: vcc.card_holder_name,
                design:     variant?.color_hex ?? 'dark',
                codegoCardId: vcc.codego_card_id,
              };
              setCardCreated(true);
              setCardBalance(vcc.balance);
              setCardFrozen(vcc.card_status === 'frozen');
              setCardDetails(restoredDetails);
              await AsyncStorage.multiSet([
                ['cw_card_created', 'true'],
                ['cw_card_balance', String(vcc.balance)],
              ]);
              storageService.saveCardDetails(restoredDetails).catch(() => {});
            } else if (vcc && (!vcc.codego_card_id || vcc.codego_card_id.startsWith('mock_cg_'))) {
              // Mock card (no real KripiCard id or mock_cg_ prefix) — reset so user can create a real card
              await supabase.from('vcc_cards').delete().eq('wallet_address', address.toLowerCase()).catch(() => {});
              await AsyncStorage.multiRemove(['cw_card_created', 'cw_card_balance', 'cw_card_transactions']);
              storageService.clearCardDetails().catch(() => {});
              setCardCreated(false);
              setCardBalance(0);
              setCardDetails({ number: '\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022', expiry: '\u2022\u2022/\u2022\u2022', cvv: '\u2022\u2022\u2022', brand: 'VISA', holderName: 'CARD HOLDER', design: 'dark' });
            } else if (dbCard) {
              let finalNumber = dbCardService.decryptNumber(dbCard, address);
              let finalCvv    = dbCardService.decryptCvv(dbCard, address);
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
              ]);
              storageService.saveCardDetails(restoredDetails).catch(() => {});
            } else if (savedCardCreated === 'true' && savedDetails) {
              // Local card exists but not yet in Supabase — this is a leaked/stale card from another session!
              // Wipe local card storage to prevent contamination
              await AsyncStorage.multiRemove([
                'cw_card_created', 'cw_card_balance', 'cw_card_transactions'
              ]);
              storageService.clearCardDetails().catch(() => {});
              setCardCreated(false);
              setCardBalance(0);
              setCardDetails({
                number: '\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022',
                expiry: '\u2022\u2022/\u2022\u2022',
                cvv: '\u2022\u2022\u2022',
                brand: 'VISA',
                holderName: 'CARD HOLDER',
                design: 'dark',
              });
            }

            // ── Transaction restore: merge Supabase + AsyncStorage ──
            const rawDbCardTxs = dbTxs.filter(t => t.type === 'card_topup' || t.type === 'card_spend');
            const seenStartupKeys = new Set<string>();
            const dbCardTxs: CardTransaction[] = rawDbCardTxs
              .filter(t => {
                const key = t.reference_id
                  ? `ref:${t.reference_id}`
                  : `${t.type}:${t.label}:${t.created_at ? new Date(t.created_at).toISOString().slice(0, 16) : ''}:${t.usd_value}`;
                if (seenStartupKeys.has(key)) return false;
                seenStartupKeys.add(key);
                return true;
              })
              .map(t => ({
                id:         t.id ?? Date.now().toString(),
                type:       t.type === 'card_topup' ? 'topup' as const : 'spend' as const,
                amount:     t.usd_value,
                label:      t.label ?? (t.type === 'card_topup' ? 'Top-up' : 'Spend'),
                coin:       t.token,
                coinAmount: t.amount,
                status:     'success' as const,
                timestamp:  t.created_at ?? new Date().toISOString(),
                currencyUsed: (t as any).currency_used,
              }));
            // Always replace AsyncStorage card txns with Supabase data
            // This cleans up old corrupt/duplicate entries on the device
            const cleanCardTxs = dbCardTxs;
            setCardTransactions(cleanCardTxs);
            AsyncStorage.setItem('cw_card_transactions', JSON.stringify(cleanCardTxs)).catch(() => {});
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

  // ── Realtime: KYC status live push ──
  // Listens for UPDATE on kyc table for this wallet and refreshes kycStatus immediately.
  // This ensures the mobile app reacts the moment admin verifies or Codego webhook fires.
  useEffect(() => {
    if (!walletAddress) return;
    const channel = supabase
      .channel(`kyc_live_${walletAddress}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'kyc',
          filter: `wallet_address=eq.${walletAddress.toLowerCase()}`,
        },
        (payload: any) => {
          const newStatus = payload.new?.status ?? null;
          if (newStatus) {
            // Map 'approved' (legacy) to 'verified' for UI consistency
            const mapped = newStatus === 'approved' ? 'verified' : newStatus;
            setKycStatus(mapped as KYCStatus);
            if (payload.new?.email) setKycEmail(payload.new.email);
            if (payload.new?.full_name) setKycFullName(payload.new.full_name);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [walletAddress]);

  // ── Realtime: wallet_profiles live push (card spend balance deduction → mobile) ──
  useEffect(() => {
    if (!walletAddress) return;
    const channel = supabase
      .channel(`wallet_profile_live_${walletAddress}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wallet_profiles',
          filter: `wallet_address=eq.${walletAddress.toLowerCase()}`,
        },
        (payload: any) => {
          const tb = payload.new?.token_balances;
          if (!tb) return;
          const parsed = typeof tb === 'string' ? JSON.parse(tb) : tb;
          if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
            setBalances(parsed);
            balancesRef.current = parsed;
            setEthBalance(Number(parsed.ETH ?? 0).toFixed(6));
            ethBalanceRef.current = Number(parsed.ETH ?? 0).toFixed(6);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [walletAddress]);

  // ── Realtime: vcc_cards live push (sandbox terminal events → mobile) ──
  // Listens for INSERT/UPDATE on vcc_cards for this wallet and refreshes card state immediately.
  useEffect(() => {
    if (!walletAddress) return;
    const channel = supabase
      .channel(`vcc_cards_live_${walletAddress}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vcc_cards',
          filter: `wallet_address=eq.${walletAddress.toLowerCase()}`,
        },
        () => { refreshCardData(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [walletAddress, refreshCardData]);

  // ── Realtime: transactions live push (sandbox card spends → mobile) ──
  // Listens for INSERT on transactions for this wallet and refreshes card transactions immediately.
  useEffect(() => {
    if (!walletAddress) return;
    const addr = walletAddress.toLowerCase();
    const channel = supabase
      .channel(`transactions_live_${addr}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `wallet_address=eq.${addr}`,
        },
        (payload: any) => {
          const row = payload.new;
          if (!row) return;
          // Only refresh for card transactions inserted by admin/sandbox terminal
          // (local spendCard already updates state directly — avoid double-counting)
          if (row.type === 'card_spend' || row.type === 'card_topup') {
            const isLocalSpend = row.reference_id != null;
            // reference_id is set by local spendCard — skip to avoid duplicate
            if (!isLocalSpend) {
              refreshCardData();
            }
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [walletAddress, refreshCardData]);

  // ── Realtime: Admin Settings Live Push ──
  // Listens for any UPDATE on admin_settings and applies changes instantly — zero delay.
  useEffect(() => {
    if (!hasWallet) return;
    const channel = supabase
      .channel('admin_settings_live')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'admin_settings' },
        (payload: any) => {
          const { key, value } = payload.new ?? {};
          if (!key || value === undefined) return;
          // Bust the in-memory TTL cache for this key so next getSetting() fetches fresh
          adminSettingsService.invalidate(key);
          if (key === 'card_currencies_config') {
            const base: Record<string, boolean> = {};
            ['USDT','USDC','ETH','BTC','BNB','TRX','SOL','XRP','TON','SUI'].forEach(t => { base[t] = true; });
            ['USD','EUR','GBP','INR','AED','AUD','SGD','RUB','BHD','VND','SAR','KWD','THB','HKD','JPY'].forEach(f => { base[f] = true; });
            if (value && typeof value === 'object') {
              Object.entries(value).forEach(([k, v]) => { base[k] = v as boolean; });
            }
            setEnabledCardCurrenciesState(base);
          }
          if (key === 'payment_asset_priority' && Array.isArray(value)) {
            setPaymentPriority(value);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [hasWallet]);

  // ── Auto-Sync Local Transactions to Supabase ──
  useEffect(() => {
    if (!walletAddress || !hasWallet) return;
    const syncToSupabase = async () => {
      try {
        const [savedTxs, savedSwapTxs] = await Promise.all([
          AsyncStorage.getItem('cw_transactions'),
          AsyncStorage.getItem('swap_transactions'),
        ]);
        const localTxs: any[] = savedTxs ? JSON.parse(savedTxs) : [];
        const localSwaps: any[] = savedSwapTxs ? JSON.parse(savedSwapTxs) : [];
        
        const dbTxs = await txService.getAll(walletAddress, 500);
        const existingTxHashes = new Set(dbTxs.map(t => t.tx_hash).filter(Boolean));
        // Add existing IDs or labels to prevent duplicates
        const existingLabels = new Set(dbTxs.map(t => `${t.type}-${t.amount}-${t.token}-${t.status}`));

        // 1. Sync standard local txs (excluding card and swap types — handled separately or consolidated)
        for (const tx of localTxs) {
          if (tx.type === 'card_topup' || tx.type === 'card_spend' || tx.type === 'swap' || tx.type === 'fee') continue;
          const isFee = tx.type === 'fee';
          const typeStr = isFee ? 'fee' : (tx.type === 'sent' ? 'send' : 'receive');
          const token = tx.coin;
          const amt = parseFloat(tx.amount || '0');
          const hash = tx.txHash;
          if (hash && existingTxHashes.has(hash)) continue;
          const sig = `${typeStr}-${amt}-${token}-${tx.status === 'completed' ? 'success' : tx.status}`;
          if (existingLabels.has(sig)) continue;
          
          await txService.log({
            wallet_address: walletAddress,
            type: typeStr as any,
            token,
            amount: amt,
            usd_value: parseFloat(tx.usdValue || '0'),
            status: (tx.status === 'completed' || tx.status === 'success') ? 'success' : (tx.status === 'failed' ? 'failed' : 'pending'),
            tx_hash: hash,
            label: tx.address || tx.label,
          }).catch(() => {});
          existingLabels.add(sig);
          if (hash) existingTxHashes.add(hash);
        }

        // 2. Sync local swap transactions
        for (const swap of localSwaps) {
          const hash = swap.txHash;
          if (hash && existingTxHashes.has(hash)) continue;
          const token = swap.fromToken || swap.sellToken || 'ETH';
          const amt = parseFloat(swap.fromAmount || swap.sellAmount || '0');
          const sig = `swap-${amt}-${token}-${swap.status === 'completed' ? 'success' : swap.status}`;
          if (existingLabels.has(sig)) continue;

          await txService.log({
            wallet_address: walletAddress,
            type: 'swap',
            token,
            amount: amt,
            usd_value: parseFloat(swap.usdValue || '0'),
            status: (swap.status === 'completed' || swap.status === 'success') ? 'success' : (swap.status === 'failed' ? 'failed' : 'pending'),
            tx_hash: hash,
            label: `${token} → ${swap.toToken || swap.buyToken || '?'}`,
            swap_to_token: swap.toToken || swap.buyToken,
            swap_to_amount: parseFloat(swap.toAmount || swap.buyAmount || '0')
          }).catch(() => {});
          existingLabels.add(sig);
          if (hash) existingTxHashes.add(hash);
        }
      } catch (e) {
        console.log('[syncLocalTransactionsToSupabase] Error:', e);
      }
    };
    syncToSupabase();
  }, [walletAddress, hasWallet]);



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
        (a.rawDate || parseDateSafe(a.date).getTime()) - (b.rawDate || parseDateSafe(b.date).getTime())
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

        // Load commission rates
        await commissionService.loadRates();

        const data = await walletService.importFromMnemonic(mnemonic);
      const isSwitching = walletAddress && walletAddress.toLowerCase() !== data.address.toLowerCase();

      // Always wipe local storage on any import so Supabase is the single source of truth
      await storageService.clearWallet();
      await AsyncStorage.multiRemove([
        'cw_transactions', 'cw_token_balances',
        'cw_locked_balance', 'cw_read_only',
        'tx_history_cache', 'swap_transactions',
        'cw_card_created', 'cw_card_balance',
        'cw_card_transactions',
      ]);
      await storageService.clearCardDetails();

      if (isNew || isSwitching) {
        setBalances({ USDT: 0, USDC: 0, ETH: 0, BTC: 0, SOL: 0, BNB: 0, XRP: 0, TON: 0, TRX: 0, SUI: 0 });
        setEthBalance('0.0');
        setLockedBalance({});
        setCardCreated(false);
        setCardBalance(0);
        setCardTransactions([]);
        setCardDetails({
          number: '\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022',
          expiry: '\u2022\u2022/\u2022\u2022',
          cvv: '\u2022\u2022\u2022',
          brand: 'VISA',
          holderName: 'CARD HOLDER',
          design: 'dark',
        });
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
        const [vcc, dbCard, dbTxs, variants, kycRecord, bizRecord] = await Promise.all([
          vccService.getCard(data.address),
          dbCardService.getCard(data.address),
          txService.getAll(data.address, 500),
          cardVariantService.getVariants(),
          kycService.getStatus(data.address),
          import('../services/merchantService').then(m => m.businessKYCService.getStatus(data.address)).catch(() => null),
        ]);

        // ── Restore KYC status (deferred type check) ──
        // We will update this again after profile fetch if they are business
        setKycStatus(kycRecord?.status ?? null);
        if (kycRecord?.email) {
          setKycEmail(kycRecord.email);
        } else {
          setKycEmail('');
        }
        if (kycRecord?.full_name) {
          setKycFullName(kycRecord.full_name);
        } else {
          setKycFullName('');
        }

        // ── Restore wallet name from Supabase profile or keep address-based default ──
        // Restore wallet profile (name, account type, p2p prefs) from Supabase
        try {
          const profile = await profileService.get(data.address);
          if (profile) {
            const name = profile.wallet_name || `Wallet ${data.address.slice(-4).toUpperCase()}`;
            setWalletNameState(name);
            await storageService.saveWalletName(name);
            if (profile.user_uuid) {
              setUserUuid(profile.user_uuid);
            }
            if (profile.user_uid) {
              setUserUid(profile.user_uid.toString());
            }
            if (profile.account_type) {
              setAccountTypeState(profile.account_type);
              setAccountTypeSet(true);
              await AsyncStorage.setItem('cw_account_type', profile.account_type);
              if (profile.account_type === 'business') {
                setKycStatus(bizRecord?.status === 'approved' ? 'verified' : (bizRecord?.status ?? null));
              }
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
            // card_currencies restored from admin_settings + user profile after this block
          } else {
            const defaultName = `Wallet ${data.address.slice(-4).toUpperCase()}`;
            setWalletNameState(defaultName);
            await storageService.saveWalletName(defaultName);
            const newProfile = await profileService.upsert(data.address, { wallet_name: defaultName }).catch(() => null);
            if (newProfile) {
              if (newProfile.user_uuid) setUserUuid(newProfile.user_uuid);
              if (newProfile.user_uid) setUserUid(newProfile.user_uid.toString());
            }
          }
          // Apply admin card currency config after profile restore
          {
            const importPlatformCurrencies = await adminSettingsService.getSetting<Record<string, boolean>>('card_currencies_config', {});
            const base: Record<string, boolean> = {};
            ['USDT','USDC','ETH','BTC','BNB','TRX','SOL','XRP','TON','SUI'].forEach(t => { base[t] = true; });
            ['USD','EUR','GBP','INR','AED','AUD','SGD','RUB','BHD','VND','SAR','KWD','THB','HKD','JPY'].forEach(f => { base[f] = true; });
            if (importPlatformCurrencies && Object.keys(importPlatformCurrencies).length > 0) {
              Object.entries(importPlatformCurrencies).forEach(([k, v]) => { base[k] = v; });
            }
            setEnabledCardCurrenciesState(base);
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

          if (!decryptedNumber && vcc.codego_card_id) {
            try {
              const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
              const liveRes = await fetch(`${apiUrl}/api/cards/${vcc.codego_card_id}`);
              if (liveRes.ok) {
                const liveJson = await liveRes.json();
                const liveCard = liveJson.data?.card || liveJson.card;
                if (liveCard?.number && liveCard?.cvv) {
                  decryptedNumber = liveCard.number;
                  decryptedCvv = liveCard.cvv;
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
              }
            } catch (_e) {}
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
            
          ]);
        } else if (dbCard) {
          let decryptedNumber = dbCardService.decryptNumber(dbCard, data.address);
          let decryptedCvv    = dbCardService.decryptCvv(dbCard, data.address);

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
            
          ]);
        } else {
          setCardCreated(false);
          setCardBalance(0);
          setCardDetails({
            number: '\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022',
            expiry: '\u2022\u2022/\u2022\u2022',
            cvv: '\u2022\u2022\u2022',
            brand: 'VISA',
            holderName: 'CARD HOLDER',
            design: 'dark',
          });
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
        if (dbCard || vcc) {
          setCardTransactions(restoredCardTxs);
          await AsyncStorage.setItem('cw_card_transactions', JSON.stringify(restoredCardTxs));
        } else {
          setCardTransactions([]);
          await AsyncStorage.removeItem('cw_card_transactions');
        }

        // ── Restore wallet transactions (send/receive/swap) ──
        const typeMap: Record<string, string> = {
          send: 'sent', receive: 'received', swap: 'swap',
          card_topup: 'card_topup', card_spend: 'card_spend',
        };
        const restoredTxs: Transaction[] = dbTxs
          .filter(t => !['card_topup', 'card_spend'].includes(t.type))
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
            buyToken: t.swap_to_token,
            buyAmount: t.swap_to_amount !== undefined && t.swap_to_amount !== null ? String(t.swap_to_amount) : undefined,
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
      'cw_card_created', 'cw_card_balance', 'cw_card_transactions'
    ]);
    await storageService.clearCardDetails();
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
      'cw_transactions', 'cw_card_balance',
      'cw_card_transactions', 'cw_card_created',
    ]);
    await storageService.clearCardDetails();
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
      'cw_transactions', 'cw_card_balance',
      'cw_card_transactions', 'cw_card_created', 'cw_token_balances'
    ]);
    await storageService.clearCardDetails();
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
      // Deduct send fee
      const sendFeeUSD = commissionService.calculateFee('send_fee', parseFloat(usdValue));
      if (sendFeeUSD > 0) {
        const sendFeeETH = sendFeeUSD / ethPrice;
        setEthBalance(prev => Math.max(0, parseFloat(prev || '0') - sendFeeETH).toFixed(6));
        addTx({ type: 'fee', coin: 'USD', amount: sendFeeUSD.toFixed(2), usdValue: sendFeeUSD.toFixed(2), address: 'Send Fee', status: 'success' });
        txService.log({ wallet_address: walletAddress, type: 'fee', token: 'USD', amount: sendFeeUSD, usd_value: sendFeeUSD, status: 'success', label: 'Send Fee' }).catch(() => {});
      }
      
      refreshBalance();
      notificationService.notifySendComplete('ETH', amount, toAddress).catch(() => {});
    }
    return result;
  }, [network, prices, walletAddress, addTx, refreshBalance]);

  const bridgeINRX = useCallback(async (
    sourceNetwork: string,
    destChainId: number,
    amount: string,
    recipientAddress: string
  ): Promise<{ success: boolean; error?: string; txHash?: string }> => {
    const privateKey = await storageService.getPrivateKey();
    if (!privateKey) return { success: false, error: 'Private key not found' };
    
    const usdValue = amount;
    const pendingId = Date.now().toString();

    const newTx = {
      id: pendingId,
      type: 'sent' as const,
      coin: 'INRX',
      amount,
      usdValue,
      address: `Bridge to Chain #${destChainId}`,
      status: 'pending' as const,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    };
    addTx({ type: 'sent', coin: 'INRX', amount, usdValue, address: `Bridge to Chain #${destChainId}`, status: 'pending' });

    let dbTxId: string | undefined;
    txService.log({
      wallet_address: walletAddress,
      type: 'send',
      token: 'INRX',
      amount: parseFloat(amount),
      usd_value: parseFloat(usdValue),
      status: 'pending',
      to_address: recipientAddress,
    }).then(r => { dbTxId = r.id; }).catch(() => {});

    const { bridgeService } = await import('../services/bridgeService');
    const bridgeNetwork = sourceNetwork || network;
    const result = await bridgeService.lockTokens(
      privateKey,
      amount,
      destChainId,
      recipientAddress,
      bridgeNetwork
    );
    const finalStatus = result.success ? 'success' : 'failed';

    setTransactions(prev => prev.map(tx =>
      tx.id === pendingId ? { ...tx, status: finalStatus, txHash: result.hash } : tx
    ));

    if (dbTxId) txService.updateStatus(dbTxId, finalStatus, result.hash).catch(() => {});

    if (result.success) {
      refreshBalance();
      notificationService.notifySendComplete('INRX', amount, recipientAddress).catch(() => {});
    }
    return { success: result.success, error: result.error, txHash: result.hash };
  }, [network, walletAddress, addTx, refreshBalance]);

  const sendCrypto = useCallback((coin: string, amount: number, label: string) => {
    const coinPrice = prices[coin]?.usd ?? 1;
    const usdValue  = (amount * coinPrice).toFixed(2);
    
    const sendFeeUSD = commissionService.calculateFee('send_fee', parseFloat(usdValue));
    const sendFeeCoin = sendFeeUSD / coinPrice;
    const totalDeduct = amount + sendFeeCoin;
    
    setBalances(prev => ({ ...prev, [coin]: Math.max(0, (prev[coin] || 0) - totalDeduct) }));
    addTx({ type: 'swap', coin, amount: amount.toString(), usdValue, address: label, status: 'success' });
    
    if (sendFeeUSD > 0) {
      addTx({ type: 'fee', coin: 'USD', amount: sendFeeUSD.toFixed(2), usdValue: sendFeeUSD.toFixed(2), address: 'Send Fee', status: 'success' });
      txService.log({ wallet_address: walletAddress, type: 'fee', token: 'USD', amount: sendFeeUSD, usd_value: sendFeeUSD, status: 'success', label: 'Send Fee' }).catch(() => {});
    }
    
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
    // Deprecated: VCC Top-up flow removed
    return false;
  }, []);

  const spendCard = useCallback((coin: string, amountUSD: number, label: string, currency: string = 'USD'): boolean => {
    if (cardFrozen) return false;
    
    if (currency && enabledCardCurrencies[currency] === false) {
      // Transaction declined because currency is disabled
      return false;
    }
    
    // 1. Calculate required USD including Card Fee
    const cardFeeUSD = commissionService.calculateFee('card_fee', amountUSD);
    const totalRequiredUSD = amountUSD + cardFeeUSD;
    
    // 2. Calculate total available USD balance from priority assets
    let totalAvailableUSD = 0;
    const availableAssets: { coin: string, balance: number, usdPrice: number, usdValue: number, isSettlement: boolean }[] = [];
    
    // Define the base settlement currency (e.g. USDT)
    const SETTLEMENT_CURRENCY = 'USDT';
    
    for (const pCoin of paymentPriority) {
      // Skip tokens the user has explicitly disabled in their currency settings
      if (enabledCardCurrencies[pCoin] === false) continue;
      const balance = pCoin === 'ETH' ? parseFloat(ethBalance || '0') : (balances[pCoin] || 0);
      if (balance > 0) {
        const usdPrice = prices[pCoin]?.usd || 0;
        if (usdPrice > 0) {
          const usdValue = balance * usdPrice;
          totalAvailableUSD += usdValue;
          availableAssets.push({ coin: pCoin, balance, usdPrice, usdValue, isSettlement: pCoin === SETTLEMENT_CURRENCY });
        }
      }
    }
    
    // 3. Reject if insufficient combined balance (we must also account for settlement fees)
    // We'll calculate exact settlement fees during deduction.
    if (totalRequiredUSD > totalAvailableUSD) {
      return false;
    }
    
    // 4. Deduct from assets progressively
    let remainingUSD = totalRequiredUSD;
    let newEthBalance = parseFloat(ethBalance || '0');
    const newBalances = { ...balances };
    const timestamp = new Date().toISOString();
    
    let totalCardFeeDeducted = 0;
    let totalSettlementFeeDeducted = 0;
    
    const settlementBreakdown: Record<string, number> = {};
    
    for (const asset of availableAssets) {
      if (remainingUSD <= 0) break;
      
      const settlementFeeRate = asset.isSettlement ? 0 : (commissionService.getRates().settlement_fee.type === 'percentage' ? commissionService.getRates().settlement_fee.value / 100 : 0);
      const settlementFeeFixed = asset.isSettlement ? 0 : (commissionService.getRates().settlement_fee.type === 'fixed' ? commissionService.getRates().settlement_fee.value : 0);
      
      const usableUSD = asset.isSettlement 
        ? asset.usdValue 
        : Math.max(0, (asset.usdValue - settlementFeeFixed) / (1 + settlementFeeRate));
        
      if (usableUSD <= 0) continue;
      
      const deductUsableUSD = Math.min(usableUSD, remainingUSD);
      
      const settlementFeeUSD = asset.isSettlement 
        ? 0 
        : (deductUsableUSD * settlementFeeRate) + (deductUsableUSD === usableUSD ? settlementFeeFixed : (settlementFeeFixed * (deductUsableUSD/usableUSD)));
      
      const totalDeductUSD = deductUsableUSD + settlementFeeUSD;
      const deductAmount = totalDeductUSD / asset.usdPrice;
      
      if (asset.coin === 'ETH') {
        newEthBalance = Math.max(0, newEthBalance - deductAmount);
      } else {
        newBalances[asset.coin] = Math.max(0, (newBalances[asset.coin] || 0) - deductAmount);
      }
      
      remainingUSD -= deductUsableUSD;
      totalSettlementFeeDeducted += settlementFeeUSD;
      settlementBreakdown[asset.coin] = (settlementBreakdown[asset.coin] || 0) + deductUsableUSD;
    }
    
    // If we couldn't cover it (due to fees eating up the balance), revert.
    if (remainingUSD > 0.01) {
      return false;
    }
    
    // Create ONE consolidated CardTransaction
    const cardTx: CardTransaction = {
      id: Date.now().toString(),
      timestamp,
      type: 'spend',
      amount: amountUSD,
      label,
      status: 'success',
      currencyUsed: currency,
      settlementBreakdown,
      merchantCategory: 'Retail', // Default mock
      country: 'USA', // Default mock
    };
    
    // 5. Log ONE consolidated card_spend to Supabase (prevents duplicate entries in statements)
    const primaryAsset = availableAssets[0]?.coin || 'USD';
    txService.log({
      wallet_address: walletAddress,
      type:      'card_spend',
      token:     primaryAsset,
      amount:    amountUSD / (prices[primaryAsset]?.usd || 1),
      usd_value: amountUSD,
      status:    'success',
      label,
      reference_id: cardTx.id,
    }).catch(() => {});

    // 6. Update local state
    setBalances(newBalances);
    balancesRef.current = newBalances;
    AsyncStorage.setItem('cw_token_balances', JSON.stringify(newBalances)).catch(() => {});
    setEthBalance(newEthBalance.toFixed(6));
    
    setCardTransactions(prev => {
      const updated = [cardTx, ...prev];
      AsyncStorage.setItem('cw_card_transactions', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
    
    return true;
  }, [cardFrozen, balances, ethBalance, prices, walletAddress, addTx, paymentPriority, enabledCardCurrencies]);

  const generateCardDetails = useCallback(() => {
    // no-op: card details are set at creation time and restored from Supabase
  }, []);



  const createCard = useCallback(async (holderName: string, design: string) => {
    try {
      setIsGlobalLoading(true);
      setGlobalLoadingMessage('Activating Virtual Card...');
      const cleanName = holderName.toUpperCase().trim() || 'CARD HOLDER';

      // Map design → variant id
      const variantId = design === 'neon' ? 'platinum' : design === 'emerald' ? 'gold' : 'classic';
      const variants = await cardVariantService.getVariants();
      const cardVariant = variants.find(v => v.id === variantId) ?? variants[0];

      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      const kripiRes = await fetch(`${apiUrl}/api/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          type: 'virtual',
          variant: cardVariant.id,
          nameOnCard: cleanName,
        }),
      });
      const kripiData = await kripiRes.json();
      if (!kripiRes.ok || !kripiData.cardData) {
        throw new Error(kripiData?.error?.message || 'KripiCard API failed. Please try again.');
      }
      const cardData = kripiData.cardData;
      const expiryMmYy = (cardData.expiryMonth && cardData.expiryYear)
        ? `${String(cardData.expiryMonth).padStart(2, '0')}/${String(cardData.expiryYear).slice(-2)}`
        : '12/28';
      const last4 = (cardData.number || '').replace(/\s/g, '').slice(-4) || cardData.last4 || '0000';
      await dbCardService.saveCredentials(walletAddress, cardData.number || `4000 0000 0000 ${last4}`, cardData.cvv || '000', {
        expiry_month: expiryMmYy.split('/')[0],
        expiry_year:  expiryMmYy.split('/')[1],
        card_type:    cardVariant.id,
        balance:      cardData.limit?.amount ? cardData.limit.amount / 100 : 0,
        status:       cardData.status === 'locked' ? 'frozen' : 'active',
        holder_name:  cleanName,
        design,
      });

      await refreshCardData();
      // Notify admin that a new virtual card was issued
      adminAlertsService.logAlert(
        'card_created',
        `User ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} created a new virtual card.`,
        walletAddress
      ).catch(() => {});
      setIsGlobalLoading(false);
    } catch (e: any) {
      setIsGlobalLoading(false);
      console.warn('[createCard] error:', e);
      Alert.alert('Card Error', e.message === 'KYC_NOT_VERIFIED'
        ? 'KYC verification required before creating a card.'
        : e.message === 'NAME_MISMATCH'
          ? 'Card holder name must match your KYC name.'
          : e.message || 'Failed to issue card. Please try again.');
    }
  }, [walletAddress, refreshCardData]);

  const updateCardDetails = useCallback((patch: { holderName?: string; design?: string }) => {
    setCardDetails(prev => {
      const updated = { ...prev, ...patch };
      storageService.saveCardDetails(updated).catch(() => {});
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
    if (fiatCurrency === 'AED') return 'AED'; // The UI will render the SVG
    return getSymbolFromCurrency(fiatCurrency) || '$';
  }, [fiatCurrency]);

  const convertFiat = useCallback((amountUSD: number) => {
    const rate = SUPPORTED_FIAT_CURRENCIES[fiatCurrency]?.rate ?? 1.0;
    return amountUSD * rate;
  }, [fiatCurrency]);

  const formatFiat = useCallback((amountUSD: number) => {
    const fiat = SUPPORTED_FIAT_CURRENCIES[fiatCurrency];
    if (!fiat) return amountUSD.toFixed(2);
    const converted = amountUSD * fiat.rate;
    
    if (fiat.code === 'JPY' || fiat.code === 'VND') {
      return Math.round(converted).toLocaleString(fiat.locale);
    }
    
    return converted.toLocaleString(fiat.locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }, [fiatCurrency]);

  const formatOrderFiat = useCallback((amountLocal: number, currencyCode: string) => {
    const fiat = SUPPORTED_FIAT_CURRENCIES[currencyCode] || SUPPORTED_FIAT_CURRENCIES['USD'];
    if (fiat.code === 'JPY' || fiat.code === 'VND') {
      return Math.round(amountLocal).toLocaleString(fiat.locale);
    }
    return amountLocal.toLocaleString(fiat.locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }, []);

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
    cardDetails, cardCreated, createCard, deleteCard, fundVirtualCard, updateCardDetails, generateCardDetails, cardTransactions,
    enabledCardCurrencies, setEnabledCardCurrencies,
    setCardDetails,
    addTx,
    updateTxStatus,
    generateMnemonic: () => walletService.generateMnemonic(),
    createWallet, importWallet, deleteWallet, enterReadOnlyMode, refreshBalance, refreshCardData, fetchBalance,
    sendETH, sendCrypto, topupCard, spendCard, toggleFreezeCard, reportLostCard, applySwapBalances, switchNetwork,
    bridgeINRX,
    fiatCurrency, setFiatCurrency, formatFiat, convertFiat, fiatSymbol, formatOrderFiat,
    isGlobalLoading,
    setGlobalLoading: (loading: boolean, msg?: string) => {
      if (msg) setGlobalLoadingMessage(msg);
      setIsGlobalLoading(loading);
    },
    globalLoadingMessage,
    userUuid,
    userUid,
    kycEmail,
    kycFullName,
    adminNetworks
  }), [
    isDarkMode, toggleTheme, accountType, accountTypeSet, setAccountType,
    p2pCountry, p2pCurrency, setP2PPreferences, lockedBalance, lockBalance, unlockBalance, resetLockedBalances, creditP2PBalance,
    kycStatus, refreshKYCStatus, balanceVisible, toggleBalanceVisible,
    pinEnabled, refreshPinEnabled, addTx, updateTxStatus, walletAddress, tronAddress, walletName, handleSetWalletName,
    ethBalance, isLoadingBalance, hasWallet, isLoadingWallet, isReadOnly, isSyncing,
    balances, cardBalance, cardFrozen, network, transactions,
    cardDetails, cardCreated, createCard, deleteCard, fundVirtualCard, updateCardDetails, generateCardDetails, cardTransactions,
    enabledCardCurrencies, setEnabledCardCurrencies,
    createWallet, importWallet, deleteWallet, enterReadOnlyMode, refreshBalance, refreshCardData, fetchBalance,
    sendETH, sendCrypto, topupCard, spendCard, toggleFreezeCard, reportLostCard, applySwapBalances, switchNetwork,
    bridgeINRX,
    fiatCurrency, setFiatCurrency, formatFiat, convertFiat, fiatSymbol, formatOrderFiat,
    isGlobalLoading,
    globalLoadingMessage,
    userUuid,
    userUid,
    kycEmail,
    kycFullName,
    adminNetworks
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
