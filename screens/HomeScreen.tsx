import React, { useCallback, useRef, memo, useMemo, useEffect, useState } from 'react';
import { Theme, Fonts, NETWORK_INFO } from '../constants';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, Linking, RefreshControl, Animated, StatusBar, Dimensions,
  Modal, Pressable, Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useWallet, useMarket } from '../store/WalletContext';
import { COIN_META, COIN_COLORS } from '../constants';
import { NewsItem } from '../services/marketService';
import { NetworkSelector } from '../components/NetworkSelector';
import { CurrencySelector } from '../components/CurrencySelector';
import { haptics } from '../utils/haptics';



const { width } = Dimensions.get('window');

// ─── Skeleton pulse animation ─────────────────────────────────────────────────
const SkeletonBox = memo(({ width, height, borderRadius = 8, style, T }: {
  width: number | string; height: number; borderRadius?: number; style?: any; T?: any;
}) => {
  const anim = useRef(new Animated.Value(0.4)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: T.border ?? '#2a2a2a', opacity: anim }, style]}
    />
  );
});

// ─── Coin icon with fallback ───────────────────────────────────────────────────
const CoinIcon = memo(({ symbol, size = 44 }: { symbol: string; size?: number }) => {
  const meta  = COIN_META[symbol];
  const color = COIN_COLORS[symbol] || '#888';
  const [failed, setFailed] = React.useState(false);
  if (meta && !failed) {
    return (
      <Image
        source={{ uri: meta.iconUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color + '25', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color, fontSize: size * 0.38, fontFamily: Fonts.extraBold }}>{symbol.charAt(0)}</Text>
    </View>
  );
});

// ─── Animated action button ────────────────────────────────────────────────────
const ActionBtn = memo(({ icon, label, onPress, T, isDark }: {
  icon: any; label: string; onPress: () => void; T: any; isDark: boolean;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const labelColor = isDark ? T.textMuted : '#5F6368';

  return (
    <TouchableOpacity
      style={{ flex: 1, alignItems: 'center', gap: 8 }}
      onPress={() => { haptics.selection(); onPress(); }}
      onPressIn={() => Animated.spring(scale, { toValue: 0.85, useNativeDriver: true, tension: 300, friction: 18 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 14 }).start()}
      activeOpacity={1}
    >
      <Animated.View style={[
        { width: 60, height: 60, borderRadius: 30, backgroundColor: isDark ? '#1c1b1b' : '#F1F3F4',
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 1, borderColor: isDark ? '#2a2a2a' : '#E8EAED',
          shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.18, shadowRadius: 8, elevation: 5 },
        { transform: [{ scale }] },
      ]}>
        <MaterialIcons name={icon} size={24} color={isDark ? '#FFFFFF' : '#131313'} />
      </Animated.View>
      <Text style={{ fontSize: 11, fontFamily: Fonts.semiBold, color: labelColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
    </TouchableOpacity>
  );
});

// safe number formatter — never crashes on undefined/NaN/Infinity
function safeFmt(n: unknown, decimals = 2): string {
  const num = typeof n === 'number' && isFinite(n) ? n : 0;
  if (num >= 1000) return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return num.toFixed(decimals);
}

// ─── Token row ─────────────────────────────────────────────────────────────────
const TokenRow = memo(({ symbol, amount, usd, change24h, T, hideBalance, onPress, formatFiat }: {
  symbol: string; amount: number; usd: number; change24h: number; T: any; hideBalance: boolean; onPress: () => void;
  formatFiat: (usd: number) => string;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const safeChange = typeof change24h === 'number' && isFinite(change24h) ? change24h : 0;
  const safeUsd    = typeof usd === 'number' && isFinite(usd) ? usd : 0;
  const safeAmt    = typeof amount === 'number' && isFinite(amount) ? amount : 0;
  const isUp = safeChange >= 0;
  return (
    <TouchableOpacity
      style={styles.tokenItem}
      onPress={() => { haptics.selection(); onPress(); }}
      onPressIn={() => Animated.spring(scale, { toValue: 0.97, tension: 300, friction: 20, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, tension: 200, friction: 14, useNativeDriver: true }).start()}
      activeOpacity={1}
    >
      <View style={[{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flex: 1 }]}>
        <View style={styles.tokenLeft}>
          <CoinIcon symbol={symbol} size={44} />
          <View style={{ marginLeft: 14 }}>
            <Text style={[styles.tokenName, { color: T.text }]}>{COIN_META[symbol]?.name ?? symbol}</Text>
            <Text style={[styles.tokenSub, { color: T.textMuted }]}>
              {hideBalance ? '••••' : `${safeAmt.toFixed(4)} ${symbol}`}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.tokenUsd, { color: T.text }]}>
              {hideBalance ? '••••' : formatFiat(safeUsd)}
            </Text>
            <Text style={{ fontSize: 12, fontFamily: Fonts.semiBold, color: isUp ? T.success : T.error }}>
              {isUp ? '▲' : '▼'} {Math.abs(safeChange).toFixed(2)}%
            </Text>
          </View>
          <Feather name="chevron-right" size={14} color={T.border} />
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ─── Market Ticker ────────────────────────────────────────────────────────────
const TICKER_GAP = 16;
const TICKER_ITEM_WIDTH = 160 + TICKER_GAP;

const MarketTicker = memo(({ prices, T, isPricesLoading, isInitialLoad, onCoinPress, onRefresh }: {
  prices: any; T: any; isPricesLoading: boolean; isInitialLoad: boolean;
  onCoinPress: (sym: string) => void; onRefresh: () => void;
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const animRef    = useRef<Animated.CompositeAnimation | null>(null);

  // Derive ticker coins from live prices — sorted by absolute 24h change desc
  const tickerCoins = useMemo(() => {
    const syms = Object.keys(prices).filter(s => prices[s]?.usd > 0);
    return syms.sort((a, b) =>
      Math.abs(prices[b]?.change24h ?? 0) - Math.abs(prices[a]?.change24h ?? 0)
    );
  }, [prices]);

  const totalWidth = TICKER_ITEM_WIDTH * Math.max(tickerCoins.length, 1);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  useEffect(() => {
    if (isInitialLoad || totalWidth === 0) return;
    translateX.setValue(0);
    animRef.current = Animated.loop(
      Animated.timing(translateX, { toValue: -totalWidth, duration: totalWidth * 42, useNativeDriver: true })
    );
    animRef.current.start();
    return () => animRef.current?.stop();
  }, [isInitialLoad, totalWidth]);

  const handleCoinPress = useCallback((sym: string) => {
    animRef.current?.stop();
    onCoinPress(sym);
    setTimeout(() => {
      if (totalWidth === 0) return;
      translateX.setValue(0);
      animRef.current = Animated.loop(
        Animated.timing(translateX, { toValue: -totalWidth, duration: totalWidth * 42, useNativeDriver: true })
      );
      animRef.current.start();
    }, 500);
  }, [onCoinPress, totalWidth, translateX]);

  // Triple the list so scroll looks infinite
  const items = [...tickerCoins, ...tickerCoins, ...tickerCoins];

  return (
    <View style={tickerStyles.container}>
      <View style={[tickerStyles.badge, { borderColor: T.border }]}>
        <View style={tickerStyles.badgeLeft}>
          <Animated.View style={[tickerStyles.dot, { opacity: pulseAnim }]} />
          <Text style={tickerStyles.badgeText}>MARKET LIVE</Text>
        </View>
        <View style={tickerStyles.badgeDivider} />
        <TouchableOpacity 
          onPress={onRefresh}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.6}
          style={tickerStyles.refreshBtnArea}
        >
          {isPricesLoading && !isInitialLoad 
            ? <ActivityIndicator size="small" color="#FFF" style={{ transform: [{ scale: 0.5 }] }} />
            : <Feather name="refresh-cw" size={12} color="#FFF" />
          }
        </TouchableOpacity>
      </View>

      <View style={[tickerStyles.surface, { backgroundColor: T.surface, borderColor: T.border }]}>
        <View style={[tickerStyles.accentLine, { backgroundColor: T.primary }]} />
        
        <View style={tickerStyles.trackContainer}>
          {isInitialLoad || tickerCoins.length === 0 ? (
            <View style={tickerStyles.skeletonRow}>
              {[0,1,2].map(i => (
                <View key={i} style={tickerStyles.skeletonCard}>
                  <SkeletonBox width={24} height={24} borderRadius={12} T={T} />
                  <SkeletonBox width={80} height={12} borderRadius={4} T={T} />
                </View>
              ))}
            </View>
          ) : (
            <Animated.View
              style={{ flexDirection: 'row', alignItems: 'center', height: '100%',
                width: TICKER_ITEM_WIDTH * items.length,
                transform: [{ translateX }] }}
            >
              {items.map((sym, idx) => {
                const p = prices[sym];
                const usdVal = typeof p?.usd === 'number' && isFinite(p.usd) && p.usd > 0 ? p.usd : null;
                const chg    = typeof p?.change24h === 'number' && isFinite(p.change24h) ? p.change24h : 0;
                const isUp   = chg >= 0;
                return (
                  <TouchableOpacity
                    key={`${sym}-${idx}`}
                    style={[tickerStyles.item, { backgroundColor: T.surfaceLow }]}
                    onPress={() => handleCoinPress(sym)}
                    activeOpacity={0.65}
                  >
                    <CoinIcon symbol={sym} size={28} />
                    <View style={tickerStyles.itemInfo}>
                      <View>
                        <Text style={[tickerStyles.symbolText, { color: T.text }]}>{sym}</Text>
                        <Text style={[tickerStyles.priceText, { color: T.textMuted }]}>
                          {usdVal !== null
                            ? usdVal >= 1
                              ? `$${usdVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : `$${usdVal.toFixed(4)}`
                            : '—'}
                        </Text>
                      </View>
                      <View style={[tickerStyles.changeBadge, { backgroundColor: isUp ? T.success + '18' : T.error + '18' }]}>
                        <Text style={[tickerStyles.changeText, { color: isUp ? T.success : T.error }]}>
                          {isUp ? '+' : ''}{chg.toFixed(2)}%
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </Animated.View>
          )}
        </View>
      </View>
    </View>
  );
});

const tickerStyles = StyleSheet.create({
  container: { marginTop: 32, paddingVertical: 4 },
  surface: {
    height: 74,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  accentLine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    opacity: 0.4,
  },
  badge: {
    position: 'absolute',
    top: -11,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    zIndex: 60,
    paddingVertical: 2,
    backgroundColor: '#EC2629',
  },
  badgeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#FFF' },
  badgeText: { fontSize: 10, fontFamily: Fonts.extraBold, letterSpacing: 1, color: '#FFF' },
  badgeDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 2 },
  refreshBtnArea: {
    paddingHorizontal: 10,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  trackContainer: { flex: 1, overflow: 'hidden' },
  
  item: {
    width: 160,
    height: 54,
    marginRight: TICKER_GAP,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 8,
  },
  itemInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  symbolText: { fontSize: 13, fontFamily: Fonts.extraBold },
  priceText: { fontSize: 11, fontFamily: Fonts.semiBold, marginTop: -2 },
  changeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  changeText: { fontSize: 10, fontFamily: Fonts.extraBold },
  
  skeletonRow: { flexDirection: 'row', alignItems: 'center', height: '100%', paddingHorizontal: 20 },
  skeletonCard: { width: 140, height: 44, borderRadius: 12, marginRight: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 10, backgroundColor: 'rgba(236,38,41,0.04)' },
});


const NewsCard = memo(({ item, T }: { item: NewsItem; T: any }) => {
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const h    = Math.floor(diff / 3_600_000);
    if (h < 1)  return `${Math.floor(diff / 60_000)}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };
  return (
    <TouchableOpacity
      style={[styles.newsCard, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
      onPress={() => {
        if (!item.url) return;
        try {
          const u = new URL(item.url);
          if (u.protocol !== 'https:' && u.protocol !== 'http:') return;
          const host = u.hostname.toLowerCase();
          if (
            host === 'localhost' ||
            host.startsWith('127.') ||
            host.startsWith('192.168.') ||
            host.startsWith('10.') ||
            host === '0.0.0.0' ||
            host === '169.254.169.254'
          ) return;
          Linking.openURL(u.href);
        } catch (_e) {}
      }}
      activeOpacity={0.75}
    >
      {!!item.thumbnail && (
        <Image source={{ uri: item.thumbnail }} style={styles.newsThumbnail} />
      )}
      <View style={{ flex: 1 }}>
        <View style={[styles.newsSourcePill, { backgroundColor: T.primary + '18' }]}>
          <Text style={[styles.newsSourceText, { color: T.primary }]}>{item.source?.title}</Text>
        </View>
        <Text style={[styles.newsTitle, { color: T.text }]} numberOfLines={2}>{item.title}</Text>
        <Text style={[styles.newsMeta, { color: T.textMuted }]}>{timeAgo(item.published_at)}</Text>
      </View>
      <Feather name="arrow-up-right" size={16} color={T.textMuted} style={{ marginLeft: 10, alignSelf: 'center' }} />
    </TouchableOpacity>
  );
});

const STABLE_FALLBACK: Record<string, number> = { 
  ETH: 3500, 
  BTC: 65000, 
  USDT: 1, 
  USDC: 1, 
  SOL: 150, 
  BNB: 600, 
  XRP: 0.50, 
  TON: 7.5, 
  TRX: 0.12, 
  SUI: 1.80, 
};
const ChangePill = memo(({ assetsList, T }: { assetsList: any[]; T: any }) => {
  const avgChange = useMemo(() => {
    if (!assetsList.length) return 0;
    const sum = assetsList.reduce((s: number, a: any) => {
      const c = typeof a.change24h === 'number' && isFinite(a.change24h) ? a.change24h : 0;
      return s + c;
    }, 0);
    return isFinite(sum / assetsList.length) ? sum / assetsList.length : 0;
  }, [assetsList]);
  const isUp = avgChange >= 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
      <View style={[styles.changePill, { backgroundColor: isUp ? T.success + '20' : T.error + '20' }]}>
        <Feather name={isUp ? 'trending-up' : 'trending-down'} size={12} color={isUp ? T.success : T.error} />
        <Text style={{ fontSize: 12, fontWeight: '700', color: isUp ? T.success : T.error }}>
          {isUp ? '+' : ''}{avgChange.toFixed(2)}% today
        </Text>
      </View>
    </View>
  );
});

export default function HomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const {
    ethBalance, balances, isDarkMode, walletName, walletAddress, tronAddress,
    isLoadingBalance, refreshBalance, isSyncing,
    balanceVisible, toggleBalanceVisible, network, transactions, accountType, lockedBalance, switchNetwork,
    fiatCurrency, setFiatCurrency, formatFiat, convertFiat, fiatSymbol,
  } = useWallet() as any;
  const { prices, isPricesLoading, priceError, refreshPrices, news, isNewsLoading, refreshNews } = useMarket();

  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  // ── UI state ──
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showNetworkPicker, setShowNetworkPicker] = useState(false);
  const [showAddrSheet, setShowAddrSheet] = useState(false);
  const [addrCopied, setAddrCopied] = useState<string | null>(null);

  // ── Double-tap balance to hide/show ──
  const lastBalanceTap = useRef(0);
  const balanceScale = useRef(new Animated.Value(1)).current;
  const handleBalanceTap = useCallback(() => {
    const now = Date.now();
    if (now - lastBalanceTap.current < 300) {
      haptics.selection();
      Animated.sequence([
        Animated.spring(balanceScale, { toValue: 0.95, tension: 300, friction: 18, useNativeDriver: true }),
        Animated.spring(balanceScale, { toValue: 1, tension: 200, friction: 14, useNativeDriver: true }),
      ]).start();
      toggleBalanceVisible();
      lastBalanceTap.current = 0;
    } else {
      lastBalanceTap.current = now;
    }
  }, [toggleBalanceVisible, balanceScale]);

  const copyAddress = useCallback((addr: string, label: string) => {
    Clipboard.setStringAsync(addr);
    setAddrCopied(label);
    setTimeout(() => setAddrCopied(null), 2000);
  }, []);

  const realBalances: Record<string, number> = useMemo(() => {
    const isTron = network === 'TRON' || network === 'TRON Nile';
    return {
      ETH:  isTron ? 0 : (parseFloat(ethBalance) || 0),
      TRX:  isTron ? (balances.TRX ?? 0) : 0,
      USDC: isTron ? (balances.USDC_TRC20 ?? balances.USDC ?? 0) : (balances.USDC_ERC20 ?? balances.USDC ?? 0),
      USDT: isTron ? (balances.USDT_TRC20 ?? balances.USDT ?? 0) : (balances.USDT_ERC20 ?? balances.USDT ?? 0),
      BTC: balances.BTC ?? 0,
      SOL: balances.SOL ?? 0,
      BNB: balances.BNB ?? 0,
      XRP: balances.XRP ?? 0,
      TON: balances.TON ?? 0,
      SUI: balances.SUI ?? 0,
    };
  }, [ethBalance, balances, network]);

  const assetsList = useMemo(() => {
    const isTron = network === 'TRON' || network === 'TRON Nile';
    const nativeSymbol = isTron ? 'TRX' : 'ETH';

    const list = (Object.keys(realBalances) as string[])
      .map(symbol => {
        const livePrice = prices[symbol]?.usd;
        const price     = (livePrice !== undefined && livePrice > 0) ? livePrice : (STABLE_FALLBACK[symbol] ?? 0);
        const change24h = prices[symbol]?.change24h ?? 0;
        return { symbol, amount: realBalances[symbol], usd: realBalances[symbol] * price, change24h };
      })
      .filter(a => {
        // Always show native token (ETH/TRX) even if balance is 0
        if (a.symbol === nativeSymbol) return true;
        // Hide ETH on TRON networks
        if (a.symbol === 'ETH' && isTron) return false;
        // Hide TRX on EVM networks  
        if (a.symbol === 'TRX' && !isTron) return false;
        // Only show other coins if user actually has a balance > 0
        return a.amount > 0;
      })
      .sort((a, b) => b.usd - a.usd);

    return list;
  }, [realBalances, prices, network]);

  const totalUsd = useMemo(() => {
    const sum = assetsList.reduce((acc, a) => acc + (typeof a.usd === 'number' && isFinite(a.usd) ? a.usd : 0), 0);
    return isFinite(sum) ? sum : 0;
  }, [assetsList]);

  const totalConverted = convertFiat(totalUsd);
  const fmtBalance = (usdVal: number) => formatFiat(usdVal);

  const isTron = network === 'TRON' || network === 'TRON Nile';
  // Show skeleton only on very first load before we have ANY balance data
  const isInitialLoad = isPricesLoading && (
    isTron
      ? (balances.TRX ?? 0) === 0 && (balances.USDT ?? 0) === 0
      : parseFloat(ethBalance) === 0 && Object.values(balances).every(v => v === 0)
  );

  const onRefresh = useCallback(() => {
    refreshBalance();
    refreshPrices();
  }, [refreshBalance, refreshPrices]);

  useFocusEffect(
    useCallback(() => {
      if (walletAddress) refreshBalance();
    }, [walletAddress, refreshBalance])
  );

  const networkInfo = NETWORK_INFO[network] || { color: '#627EEA', name: network, type: 'Unknown' };
  const networkColor = networkInfo.color;

  // Header height = status bar (insets.top) + content (avatar 36 + padding 12 top + 12 bottom)
  const HEADER_CONTENT_HEIGHT = 60;
  const headerHeight = insets.top + HEADER_CONTENT_HEIGHT;

  return (
    <View style={[styles.container, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* ── Network Selector ── */}
      <NetworkSelector
        visible={showNetworkPicker}
        onClose={() => setShowNetworkPicker(false)}
        currentNetwork={network}
        onSelect={(net) => {
          haptics.selection();
          switchNetwork(net);
        }}
        T={T}
      />

      {/* ── Currency Selector ── */}
      <CurrencySelector
        visible={showCurrencyPicker}
        onClose={() => setShowCurrencyPicker(false)}
        currentCurrency={fiatCurrency}
        onSelect={setFiatCurrency}
        T={T}
      />

      {/* ── Address Sheet Modal ── */}
      <Modal transparent visible={showAddrSheet} animationType="slide" onRequestClose={() => setShowAddrSheet(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }} onPress={() => setShowAddrSheet(false)}>
          <Pressable style={[styles.addrSheet, { backgroundColor: T.surface }]} onPress={e => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, { color: T.text }]}>My Addresses</Text>

            {/* ETH address */}
            <View style={[styles.addrRow, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
              <View style={[styles.addrChainDot, { backgroundColor: '#627EEA' }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.addrChainLabel, { color: T.textMuted }]}>Ethereum / EVM</Text>
                <Text style={[styles.addrFull, { color: T.text }]} numberOfLines={1}>{walletAddress}</Text>
              </View>
              <TouchableOpacity
                style={[styles.addrCopyBtn, { backgroundColor: addrCopied === 'ETH' ? T.success + '20' : T.primary + '15' }]}
                onPress={() => copyAddress(walletAddress, 'ETH')}
                activeOpacity={0.7}
              >
                <Feather name={addrCopied === 'ETH' ? 'check' : 'copy'} size={14} color={addrCopied === 'ETH' ? T.success : T.primary} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: addrCopied === 'ETH' ? T.success : T.primary }}>
                  {addrCopied === 'ETH' ? 'Copied!' : 'Copy'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* TRON address */}
            <View style={[styles.addrRow, { backgroundColor: T.surfaceLow, borderColor: T.border, marginTop: 10 }]}>
              <View style={[styles.addrChainDot, { backgroundColor: '#EF0027' }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.addrChainLabel, { color: T.textMuted }]}>TRON (TRC20)</Text>
                <Text style={[styles.addrFull, { color: T.text }]} numberOfLines={1}>
                  {tronAddress || 'Deriving...'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.addrCopyBtn, { backgroundColor: addrCopied === 'TRON' ? T.success + '20' : T.primary + '15' }]}
                onPress={() => tronAddress && copyAddress(tronAddress, 'TRON')}
                activeOpacity={0.7}
                disabled={!tronAddress}
              >
                <Feather name={addrCopied === 'TRON' ? 'check' : 'copy'} size={14} color={addrCopied === 'TRON' ? T.success : T.primary} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: addrCopied === 'TRON' ? T.success : T.primary }}>
                  {addrCopied === 'TRON' ? 'Copied!' : 'Copy'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.addrReceiveBtn, { backgroundColor: T.primary }]}
              onPress={() => { setShowAddrSheet(false); navigation.navigate('Receive'); }}
              activeOpacity={0.85}
            >
              <MaterialIcons name="qr-code" size={16} color="#FFF" />
              <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>Show QR Code</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: isDarkMode ? 'rgba(19,19,19,0.97)' : 'rgba(247,249,251,0.97)', paddingTop: insets.top + 8 }]}>
        {/* Left: wallet + network selector */}
        <TouchableOpacity
          style={styles.headerLeft}
          onPress={() => { haptics.selection(); setShowNetworkPicker(true); }}
          activeOpacity={0.7}
        >
          <View style={[styles.avatarWrap, { backgroundColor: T.primary + '18' }]}>
            <Image source={require('../assets/logo.png')} style={{ width: 24, height: 24, borderRadius: 4 }} resizeMode="contain" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.walletLabel, { color: T.text }]} numberOfLines={1}>{walletName}</Text>
              <View style={[styles.networkBadge, { backgroundColor: networkColor + '20', borderColor: networkColor + '40' }]}>
                {isSyncing && <View style={[styles.syncDot, { backgroundColor: networkColor }]} />}
                <Text style={[styles.networkText, { color: networkColor }]}>
                  {isSyncing ? 'Syncing' : networkInfo.name}
                </Text>
                <Feather name="chevron-down" size={10} color={networkColor} />
              </View>
            </View>
            <Text style={[styles.addressText, { color: T.textMuted }]}
              onLongPress={() => {
                const addr = isTron ? tronAddress : walletAddress;
                if (!addr) return;
                haptics.heavy();
                Clipboard.setStringAsync(addr);
                setAddrCopied(isTron ? 'TRON' : 'ETH');
                setTimeout(() => setAddrCopied(null), 2000);
              }}
            >
              {addrCopied ? '✓ Copied!' : isTron
                ? (tronAddress ? `${tronAddress.slice(0, 6)}...${tronAddress.slice(-4)}` : 'Deriving...')
                : (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : '')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Right: action icons */}
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Receive')} activeOpacity={0.7}>
            <MaterialIcons name="qr-code" size={22} color={T.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Scan')} activeOpacity={0.7}>
            <MaterialIcons name="qr-code-scanner" size={22} color={T.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('History')} activeOpacity={0.7}>
            <Feather name="clock" size={20} color={T.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate('Support')} activeOpacity={0.7}>
            <MaterialIcons name="headset-mic" size={22} color={T.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: headerHeight + 8, paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoadingBalance} onRefresh={onRefresh} tintColor={T.primary} />}
      >
        {/* ── Price error banner ── */}
        {priceError && (
          <TouchableOpacity
            style={[styles.errorBanner, { backgroundColor: T.error + '15', borderColor: T.error + '40' }]}
            onPress={refreshPrices} activeOpacity={0.8}
          >
            <Feather name="wifi-off" size={13} color={T.error} />
            <Text style={[styles.errorBannerText, { color: T.error }]}>
              Live prices unavailable — tap to retry.
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Balance ── */}
        <View style={styles.balanceSection}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Text style={[styles.estText, { color: T.textMuted }]}>Total Portfolio Value</Text>
            {isPricesLoading && !isInitialLoad && <ActivityIndicator size="small" color={T.primary} />}
            <TouchableOpacity onPress={toggleBalanceVisible} activeOpacity={0.7} style={{ marginLeft: 'auto' }}>
              <Feather name={balanceVisible ? 'eye' : 'eye-off'} size={18} color={T.textMuted} />
            </TouchableOpacity>
          </View>
          {isInitialLoad ? (
            <SkeletonBox width={200} height={52} borderRadius={12} T={T} style={{ marginBottom: 8 }} />
          ) : (
            <TouchableOpacity onPress={handleBalanceTap} activeOpacity={1}>
              <Animated.View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, transform: [{ scale: balanceScale }] }}>
                <Text
                  style={[styles.balanceValue, { color: T.text, fontSize: totalConverted > 9999999 ? 32 : 44 }]}
                >
                  {balanceVisible ? fmtBalance(totalUsd) : `${fiatSymbol} ••••••`}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    haptics.selection();
                    setShowCurrencyPicker(true);
                  }}
                  activeOpacity={0.7}
                  style={[styles.currencyToggle, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
                >
                  <Text style={[styles.currencyToggleText, { color: T.textMuted }]}>{fiatCurrency}</Text>
                  <Feather name="chevron-down" size={12} color={T.textMuted} />
                </TouchableOpacity>
              </Animated.View>
            </TouchableOpacity>
          )}
          {!isInitialLoad && balanceVisible && assetsList.length > 0 && (
            <ChangePill assetsList={assetsList} T={T} />
          )}
          {/* Locked balance badge */}
          {Object.entries(lockedBalance ?? {}).some(([, v]) => typeof v === 'number' && isFinite(v) && v > 0) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <View style={[styles.changePill, { backgroundColor: T.primary + '20' }]}>
                <Feather name="lock" size={11} color={T.primary} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: T.primary }}>
                  {Object.entries(lockedBalance ?? {})
                    .filter(([, v]) => typeof v === 'number' && isFinite(v) && v > 0)
                    .map(([k, v]) => `${Number(v).toFixed(4)} ${k}`)
                    .join(' · ')} locked in P2P
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Quick Actions ── */}
        {accountType === 'business' ? (
          // Business Merchant: 4 merchant-specific quick actions
          <View style={styles.actionsRow}>
            <ActionBtn icon="grid-on"       label="QR Gen"    onPress={() => navigation.navigate('MerchantQR')}        T={T} isDark={isDarkMode} />
            <ActionBtn icon="repeat"        label="P2P"       onPress={() => navigation.navigate('P2PMarketplace')}    T={T} isDark={isDarkMode} />
            <ActionBtn icon="list-alt"      label="Orders"    onPress={() => navigation.navigate('MyP2POrders')}       T={T} isDark={isDarkMode} />
            <ActionBtn icon="business"      label="Profile"   onPress={() => navigation.navigate('BusinessKYCForm')}   T={T} isDark={isDarkMode} />
          </View>
        ) : (
          // Personal: original 4 actions
          <View style={styles.actionsRow}>
            <ActionBtn icon="add"           label="Deposit"   onPress={() => navigation.navigate('Receive')} T={T} isDark={isDarkMode} />
            <ActionBtn icon="swap-horiz"    label="Swap"      onPress={() => navigation.navigate('Swap')}    T={T} isDark={isDarkMode} />
            <ActionBtn icon="send"          label="Send"      onPress={() => navigation.navigate('Send')}    T={T} isDark={isDarkMode} />
            <ActionBtn icon="credit-card"   label="Card"      onPress={() => navigation.navigate('Card')}    T={T} isDark={isDarkMode} />
          </View>
        )}



        {/* ── My Assets ── */}
        <View style={[styles.assetsContainer, { backgroundColor: T.surface, borderColor: T.border }]}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => navigation.navigate('Assets')}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.sectionTitleDot, { backgroundColor: T.primary }]} />
              <Text style={[styles.sectionTitle, { color: T.text }]}>My Assets</Text>
            </View>
            <View style={[styles.sectionArrow, { backgroundColor: T.primary + '15', borderColor: T.primary + '30' }]}>
              <Feather name="chevron-right" size={14} color={T.primary} />
            </View>
          </TouchableOpacity>
          {isInitialLoad ? (
            [0,1,2].map(i => (
              <View key={i} style={[styles.tokenItem, { gap: 12 }]}>
                <SkeletonBox width={44} height={44} borderRadius={22} T={T} />
                <View style={{ flex: 1, gap: 6 }}>
                  <SkeletonBox width={100} height={14} T={T} />
                  <SkeletonBox width={70} height={11} T={T} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <SkeletonBox width={70} height={14} T={T} />
                    <SkeletonBox width={45} height={11} T={T} />
                  </View>
                  <Feather name="chevron-right" size={14} color={T.border} style={{ opacity: 0.3 }} />
                </View>
              </View>
            ))
          ) : assetsList.length === 0 ? (
            <View style={{ paddingVertical: 24, alignItems: 'center', gap: 8 }}>
              <Feather name="inbox" size={28} color={T.textMuted} style={{ opacity: 0.4 }} />
              <Text style={{ color: T.textMuted, fontSize: 14, fontWeight: '700' }}>No assets yet</Text>
              <Text style={{ color: T.textMuted, fontSize: 12, opacity: 0.6, textAlign: 'center' }}>Deposit or swap to get started</Text>
            </View>
          ) : assetsList.map((a, idx) => (
            <React.Fragment key={a.symbol}>
              <TokenRow
                symbol={a.symbol} amount={a.amount} usd={a.usd}
                change24h={a.change24h} T={T} hideBalance={!balanceVisible}
                formatFiat={formatFiat}
                onPress={() => navigation.navigate('CoinChart', { symbol: a.symbol })}
              />
              {idx < assetsList.length - 1 && (
                <View style={[styles.divider, { backgroundColor: T.border }]} />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* ── Market Ticker ── */}
        <MarketTicker
          prices={prices}
          T={T}
          isPricesLoading={isPricesLoading}
          isInitialLoad={isInitialLoad}
          onCoinPress={(sym) => navigation.navigate('CoinChart', { symbol: sym })}
          onRefresh={refreshPrices}
        />

        {/* ── Trending News ── */}
        <View style={styles.newsSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: T.text }]}>Trending News</Text>
            <TouchableOpacity onPress={refreshNews} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {isNewsLoading
                ? <ActivityIndicator size="small" color={T.primary} />
                : <Feather name="refresh-cw" size={14} color={T.primary} />}
              <Text style={{ color: T.primary, fontSize: 12, fontWeight: '700' }}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {isNewsLoading ? (
            <View style={[styles.newsPlaceholder, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
              <ActivityIndicator color={T.primary} size="large" />
              <Text style={{ color: T.textMuted, marginTop: 12, fontSize: 13, fontWeight: '600' }}>Loading latest news...</Text>
            </View>
          ) : news.length === 0 ? (
            <View style={[styles.newsPlaceholder, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
              <Feather name="wifi-off" size={28} color={T.textMuted} />
              <Text style={{ color: T.textMuted, marginTop: 10, fontSize: 14, fontWeight: '700' }}>News unavailable</Text>
              <TouchableOpacity onPress={refreshNews} style={[styles.retryBtn, { backgroundColor: T.primary }]} activeOpacity={0.8}>
                <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            news.map(item => <NewsCard key={item.id} item={item} T={T} />)
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    position: 'absolute', top: 0, width: '100%', zIndex: 50,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginRight: 8,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  avatarWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  walletLabel: { fontSize: 15, fontFamily: Fonts.extraBold, letterSpacing: -0.3, flexShrink: 1 },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },

  scroll: { paddingHorizontal: 20 },

  getStartedBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 14 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 14 },
  errorBannerText: { flex: 1, fontSize: 12, fontFamily: Fonts.semiBold },

  balanceSection: { paddingVertical: 24 },
  estText: { fontSize: 13, fontFamily: Fonts.semiBold },
  balanceValue: { fontSize: 46, fontFamily: Fonts.extraBold, letterSpacing: -1.5 },
  balanceCurrency: { fontSize: 20, fontFamily: Fonts.bold },
  changePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
    paddingHorizontal: 4,
  },


  cardBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 18, borderRadius: 20, borderWidth: 1,
    marginBottom: 20,
  },
  cardBannerIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardBannerTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  cardBannerSub: { fontSize: 12 },
  openBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20 },
  openBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },

  assetsContainer: { borderRadius: 20, padding: 14, borderWidth: 1, marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontFamily: Fonts.extraBold, letterSpacing: -0.3 },
  sectionTitleDot: { width: 4, height: 18, borderRadius: 2 },
  sectionArrow: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  tokenItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  tokenLeft: { flexDirection: 'row', alignItems: 'center' },
  tokenName: { fontSize: 15, fontFamily: Fonts.extraBold, marginBottom: 1 },
  tokenSub: { fontSize: 11, fontFamily: Fonts.semiBold, letterSpacing: 0.2 },
  tokenUsd: { fontSize: 15, fontFamily: Fonts.extraBold, marginBottom: 1 },
  divider: { height: 1, width: '100%', opacity: 0.5 },

  marketSection: { marginTop: 24, borderRadius: 22, padding: 18, borderWidth: 1 },
  marketRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  newsSection: { marginTop: 24 },
  newsCard: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 10, gap: 12 },
  newsThumbnail: { width: 72, height: 72, borderRadius: 10 },
  newsSourcePill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 6 },
  newsSourceText: { fontSize: 10, fontFamily: Fonts.extraBold, letterSpacing: 0.5 },
  newsTitle: { fontSize: 13, fontFamily: Fonts.semiBold, lineHeight: 19, marginBottom: 6 },
  newsMeta: { fontSize: 11, fontFamily: Fonts.medium },
  newsPlaceholder: { padding: 40, borderRadius: 16, borderWidth: 1, alignItems: 'center', gap: 8 },
  retryBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },

  // Currency picker
  currencyToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1,
    marginBottom: 4,
  },
  currencyToggleText: { fontSize: 13, fontFamily: Fonts.bold },

  // Network selector
  networkBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1,
    flexShrink: 0,
  },
  networkText: { fontSize: 9, fontFamily: Fonts.extraBold, textTransform: 'uppercase' },
  syncDot: { width: 4, height: 4, borderRadius: 2 },
  addressText: { fontSize: 11, fontFamily: Fonts.semiBold, letterSpacing: 0.2, marginTop: 1 },

  // Address sheet
  addrSheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 0,
    marginBottom: 64,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: '#555',
    alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle: { fontSize: 17, fontFamily: Fonts.extraBold, marginBottom: 20 },
  addrRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 16, borderWidth: 1,
  },
  addrChainDot: { width: 10, height: 10, borderRadius: 5 },
  addrChainLabel: { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 0.5, marginBottom: 3 },
  addrFull: { fontSize: 13, fontFamily: Fonts.bold },
  addrCopyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10,
  },
  addrReceiveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 20, paddingVertical: 14, borderRadius: 18,
  },
});
