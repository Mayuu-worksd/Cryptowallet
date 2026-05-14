import React, { useCallback, useRef, memo, useMemo, useEffect } from 'react';
import { Theme, Fonts } from '../constants';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, Image, ActivityIndicator, Linking, RefreshControl, Animated, StatusBar, Dimensions,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useWallet, useMarket } from '../store/WalletContext';
import { COIN_META, COIN_COLORS } from '../constants';
import { NewsItem } from '../services/marketService';

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
      style={{ flex: 1, alignItems: 'center', gap: 10 }}
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 30, bounciness: 6 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 14 }).start()}
      activeOpacity={1}
    >
      <Animated.View style={[
        { width: 64, height: 64, borderRadius: 32, backgroundColor: '#000000',
          alignItems: 'center', justifyContent: 'center',
          shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
        { transform: [{ scale }] },
      ]}>
        <MaterialIcons name={icon} size={26} color="#FFFFFF" />
      </Animated.View>
      <Text style={{ fontSize: 11, fontFamily: Fonts.bold, color: labelColor, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</Text>
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
const TokenRow = memo(({ symbol, amount, usd, change24h, T, hideBalance, onPress }: {
  symbol: string; amount: number; usd: number; change24h: number; T: any; hideBalance: boolean; onPress: () => void;
}) => {
  const safeChange = typeof change24h === 'number' && isFinite(change24h) ? change24h : 0;
  const safeUsd    = typeof usd === 'number' && isFinite(usd) ? usd : 0;
  const safeAmt    = typeof amount === 'number' && isFinite(amount) ? amount : 0;
  const isUp = safeChange >= 0;
  return (
    <TouchableOpacity style={styles.tokenItem} onPress={onPress} activeOpacity={0.7}>
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
            {hideBalance ? '••••' : `$${safeFmt(safeUsd)}`}
          </Text>
          <Text style={{ fontSize: 12, fontFamily: Fonts.semiBold, color: isUp ? T.success : T.error }}>
            {isUp ? '▲' : '▼'} {Math.abs(safeChange).toFixed(2)}%
          </Text>
        </View>
        <Feather name="chevron-right" size={14} color={T.border} />
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
                              : `$${usdVal.toFixed(6)}`
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
  USDC: 1, 
  USDT: 1, 
  DAI: 1,
  TRX: 0.12,
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

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }: any) {
  const {
    ethBalance, balances, isDarkMode, walletName, walletAddress, tronAddress,
    isLoadingBalance, refreshBalance, isSyncing,
    balanceVisible, toggleBalanceVisible, network, transactions, accountType, lockedBalance,
  } = useWallet() as any;
  const { prices, isPricesLoading, priceError, refreshPrices, news, isNewsLoading, refreshNews } = useMarket();

  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const realBalances: Record<string, number> = useMemo(() => {
    const isTron = network === 'TRON' || network === 'TRON Nile';
    return {
      // On TRON networks, native balance is TRX (stored in balances.TRX)
      // On EVM networks, native balance is ETH (stored in ethBalance string)
      ETH:  isTron ? 0 : (parseFloat(ethBalance) || 0),
      TRX:  isTron ? (balances.TRX ?? 0) : 0,
      USDC: balances.USDC ?? 0,
      USDT: balances.USDT ?? 0,
      DAI:  balances.DAI  ?? 0,
      ...(balances.CUSTOM > 0 ? { CUSTOM: balances.CUSTOM } : {}),
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
        if (a.symbol === nativeSymbol) return true;          // always show native token
        if (a.symbol === 'CUSTOM') return a.amount > 0;      // CUSTOM only if held
        if (a.symbol === 'ETH' && isTron) return false;      // hide ETH on TRON
        if (a.symbol === 'TRX' && !isTron) return false;     // hide TRX on EVM
        return a.amount > 0;                                  // others only if held
      })
      .sort((a, b) => b.usd - a.usd);

    return list;
  }, [realBalances, prices, network]);

  const totalUsd = useMemo(() => {
    const sum = assetsList.reduce((acc, a) => acc + (typeof a.usd === 'number' && isFinite(a.usd) ? a.usd : 0), 0);
    return isFinite(sum) ? sum : 0;
  }, [assetsList]);

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

  const networkColor =
    network === 'Sepolia'    ? '#F59E0B' :
    network === 'Polygon'    ? '#8247E5' :
    network === 'Arbitrum'   ? '#2D374B' :
    network === 'TRON'       ? '#EF0027' :
    network === 'TRON Nile'  ? '#FF6B6B' :
    '#627EEA';

  return (
    <View style={[styles.container, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: isDarkMode ? 'rgba(19,19,19,0.92)' : 'rgba(247,249,251,0.95)', top: Platform.OS === 'ios' ? 44 : 0 }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.avatarWrap, { backgroundColor: T.primary + '18' }]}>
            <MaterialIcons name="account-balance-wallet" size={20} color={T.primary} />
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.walletLabel, { color: T.text }]}>{walletName}</Text>
              <View style={{ backgroundColor: networkColor + '20', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, borderWidth: 1, borderColor: networkColor + '40', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {isSyncing ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: networkColor }} /> : null}
                <Text style={{ color: networkColor, fontSize: 8, fontWeight: '800', textTransform: 'uppercase' }}>
                  {isSyncing ? 'Syncing...' : network}
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 10, color: T.textMuted, fontWeight: '600', letterSpacing: 0.2 }}>
              {isTron
                ? (tronAddress ? `${tronAddress.slice(0, 6)}...${tronAddress.slice(-4)}` : '')
                : (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : '')}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
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
        contentContainerStyle={styles.scroll}
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
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text 
                style={[
                  styles.balanceValue, 
                  { 
                    color: T.text,
                    fontSize: totalUsd > 9999999 ? 32 : 44
                  }
                ]}
              >
                {balanceVisible
                  ? `$${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '$ ••••••'}
              </Text>
              <Text style={[styles.balanceCurrency, { color: T.textMuted }]}>USD</Text>
            </View>
          )}
          {!isInitialLoad && balanceVisible && assetsList.length > 0 && (
            <ChangePill assetsList={assetsList} T={T} />
          )}
          {/* Locked balance badge */}
          {Object.entries(lockedBalance ?? {}).some(([, v]) => v > 0) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <View style={[styles.changePill, { backgroundColor: T.primary + '20' }]}>
                <Feather name="lock" size={11} color={T.primary} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: T.primary }}>
                  {Object.entries(lockedBalance).filter(([,v]) => v > 0).map(([k,v]) => `${v.toFixed(4)} ${k}`).join(' · ')} locked in P2P
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
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: T.text }]}>My Assets</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Portfolio')} activeOpacity={0.7}>
              <Text style={{ color: T.primary, fontSize: 13, fontWeight: '700' }}>View All →</Text>
            </TouchableOpacity>
          </View>
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

        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    position: 'absolute', top: 0, width: '100%', zIndex: 50,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 20 : 56, paddingBottom: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  walletLabel: { fontSize: 16, fontFamily: Fonts.extraBold, letterSpacing: -0.5 },
  headerBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19 },

  scroll: { paddingTop: Platform.OS === 'ios' ? 130 : 110, paddingHorizontal: 20, paddingBottom: 80 },

  getStartedBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 14 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 14 },
  errorBannerText: { flex: 1, fontSize: 12, fontFamily: Fonts.semiBold },

  balanceSection: { paddingVertical: 24 },
  estText: { fontSize: 13, fontFamily: Fonts.semiBold },
  balanceValue: { fontSize: 46, fontFamily: Fonts.extraBold, letterSpacing: -1.5 },
  balanceCurrency: { fontSize: 20, fontFamily: Fonts.bold },
  changePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },

  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },


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
  sectionTitle: { fontSize: 16, fontFamily: Fonts.extraBold, letterSpacing: -0.2 },

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

});

