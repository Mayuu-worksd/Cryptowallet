import React, { useCallback, useRef, memo, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, Image, ActivityIndicator, Linking, RefreshControl, Animated,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { Theme, COIN_META, COIN_COLORS } from '../constants';
import { NewsItem } from '../services/marketService';

// ─── Skeleton pulse animation ─────────────────────────────────────────────────
const SkeletonBox = memo(({ width, height, borderRadius = 8, style }: {
  width: number | string; height: number; borderRadius?: number; style?: any;
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
      style={[{ width, height, borderRadius, backgroundColor: '#2E3036', opacity: anim }, style]}
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
      <Text style={{ color, fontSize: size * 0.38, fontWeight: '800' }}>{symbol.charAt(0)}</Text>
    </View>
  );
});

// ─── Animated action button ────────────────────────────────────────────────────
const ActionBtn = memo(({ icon, label, onPress, T, isDark }: {
  icon: any; label: string; onPress: () => void; T: any; isDark: boolean;
}) => {
  const scale      = useRef(new Animated.Value(1)).current;
  const onPressIn  = () => Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 20, bounciness: 14 }).start();
  const circleBg   = '#111111';
  const iconColor  = '#FFFFFF';
  const labelColor = isDark ? T.textMuted  : '#444444';
  return (
    <Animated.View style={{ flex: 1, alignItems: 'center', transform: [{ scale }] }}>
      <TouchableOpacity
        style={{ alignItems: 'center', gap: 8, width: '100%' }}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        <View style={{
          width: 62, height: 62, borderRadius: 31, backgroundColor: circleBg,
          alignItems: 'center', justifyContent: 'center',
          shadowColor: isDark ? T.primary : '#000',
          shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.22 : 0.14, shadowRadius: 8, elevation: 5,
        }}>
          <MaterialIcons name={icon} size={26} color={iconColor} />
        </View>
        <Text style={{ fontSize: 11, fontWeight: '700', color: labelColor, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── Token row ─────────────────────────────────────────────────────────────────
const TokenRow = memo(({ symbol, amount, usd, change24h, T, hideBalance, onPress }: {
  symbol: string; amount: number; usd: number; change24h: number; T: any; hideBalance: boolean; onPress: () => void;
}) => {
  const isUp = change24h >= 0;
  return (
    <TouchableOpacity style={styles.tokenItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.tokenLeft}>
        <CoinIcon symbol={symbol} size={44} />
        <View style={{ marginLeft: 14 }}>
          <Text style={[styles.tokenName, { color: T.text }]}>{COIN_META[symbol]?.name ?? symbol}</Text>
          <Text style={[styles.tokenSub, { color: T.textMuted }]}>
            {hideBalance ? '••••' : `${amount.toFixed(4)} ${symbol}`}
          </Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.tokenUsd, { color: T.text }]}>
          {hideBalance ? '••••' : `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </Text>
        <Text style={{ fontSize: 12, fontWeight: '600', color: isUp ? T.success : T.error }}>
          {isUp ? '▲' : '▼'} {Math.abs(change24h).toFixed(2)}%
        </Text>
      </View>
      <Feather name="chevron-right" size={14} color={T.border} style={{ marginLeft: 6 }} />
    </TouchableOpacity>
  );
});

// ─── News card ─────────────────────────────────────────────────────────────────
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
          // Only allow safe protocols — block javascript:, data:, file:, etc.
          if (u.protocol !== 'https:' && u.protocol !== 'http:') return;
          // Block private/local IP ranges to prevent SSRF-style abuse
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
        } catch {}
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

// ─── Web Dashboard ──────────────────────────────────────────────────────────
const WebDashboard = ({ assetsList, totalUsd, T, walletName, transactions }: any) => {
  return (
    <View style={webStyles.container}>
      <View style={webStyles.topRow}>
        <View style={webStyles.heroColumn}>
          <Text style={[webStyles.welcomeText, { color: T.textMuted }]}>Welcome back, {walletName}</Text>
          <View style={[webStyles.portfolioCard, { backgroundColor: T.surface, borderColor: T.border }]}>
            <Text style={[webStyles.portfolioLabel, { color: T.textMuted }]}>Total Portfolio Value</Text>
            <Text style={[webStyles.portfolioValue, { color: T.text }]}>
              ${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <View style={[webStyles.assetChartWrap, { borderTopColor: T.border }]}>
              <Text style={[webStyles.chartTitle, { color: T.text }]}>Asset Allocation</Text>
              <View style={webStyles.chartRow}>
                {assetsList.filter((a: any) => a.usd > 0).slice(0, 4).map((a: any) => {
                  const pct = totalUsd > 0 ? ((a.usd / totalUsd) * 100).toFixed(1) : '0.0';
                  return (
                    <View key={a.symbol} style={[webStyles.chartCol, { flex: parseFloat(pct) || 1 }]}>
                      <View style={[webStyles.chartBar, { backgroundColor: COIN_COLORS[a.symbol] || T.primary }]} />
                      <Text style={[webStyles.chartLabel, { color: T.text }]}>{a.symbol}</Text>
                      <Text style={[webStyles.chartPercent, { color: T.textMuted }]}>{pct}%</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={webStyles.activitySection}>
            <View style={webStyles.sectionHead}>
              <Text style={[webStyles.sectionTitle, { color: T.text }]}>Recent Activity</Text>
            </View>
            <View style={webStyles.activityList}>
              {transactions.length === 0 ? (
                <Text style={{ color: T.textMuted, fontSize: 14, paddingVertical: 20 }}>No transactions yet.</Text>
              ) : transactions.slice(0, 5).map((tx: any, i: number) => {
                const isDebit = tx.type === 'sent' || tx.type === 'card_spend';
                return (
                  <View key={tx.id} style={[webStyles.activityItem, { borderBottomColor: T.border }]}>
                    <View style={webStyles.activityMeta}>
                      <Text style={[webStyles.activityTitle, { color: T.text }]}>{tx.type.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</Text>
                      <Text style={[webStyles.activityDate, { color: T.textMuted }]}>{tx.date}</Text>
                    </View>
                    <Text style={[webStyles.activitySub, { color: T.textMuted }]} numberOfLines={1}>
                      {tx.address.length > 20 ? `${tx.address.slice(0, 12)}...` : tx.address}
                    </Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[webStyles.activityAmount, { color: isDebit ? T.error : T.success }]}>
                        {isDebit ? '-' : '+'}{tx.amount} {tx.coin}
                      </Text>
                      <Text style={[webStyles.activityStatus, { color: T.textMuted }]}>{tx.status}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        <View style={webStyles.sideColumn}>
          <View style={[webStyles.marketPulseCard, { backgroundColor: T.surface, borderColor: T.border, borderWidth: 1 }]}>
            <Text style={[webStyles.pulseLabel, { color: T.text }]}>Market Pulse</Text>
            {assetsList.slice(0, 3).map((a: any) => {
              const isUp = a.change24h >= 0;
              return (
                <View key={a.symbol} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: T.border }}>
                  <Text style={{ color: T.text, fontWeight: '700', fontSize: 14 }}>{a.symbol}</Text>
                  <Text style={{ color: isUp ? T.success : T.error, fontWeight: '700', fontSize: 14 }}>
                    {isUp ? '+' : ''}{a.change24h.toFixed(2)}%
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
};

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }: any) {
  const {
    ethBalance, balances, isDarkMode, walletName,
    prices, isPricesLoading, priceError, refreshPrices,
    news, isNewsLoading, isLoadingBalance, refreshBalance,
    balanceVisible, toggleBalanceVisible, network, refreshNews, transactions,
  } = useWallet();

  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const realBalances: Record<string, number> = useMemo(
    () => ({ ...balances, ETH: parseFloat(ethBalance) || 0 }),
    [balances, ethBalance]
  );

  const assetsList = useMemo(() =>
    Object.keys(realBalances)
      .map(symbol => {
        const price     = prices[symbol]?.usd ?? 0;
        const change24h = prices[symbol]?.change24h ?? 0;
        return { symbol, amount: realBalances[symbol], usd: realBalances[symbol] * price, change24h };
      })
      .sort((a, b) => b.usd - a.usd),
    [realBalances, prices]
  );

  const totalUsd = useMemo(() => assetsList.reduce((acc, a) => acc + a.usd, 0), [assetsList]);

  const onRefresh = useCallback(() => {
    refreshBalance();
    refreshPrices();
  }, [refreshBalance, refreshPrices]);

  const networkColor = network === 'Sepolia' ? '#F59E0B' : network === 'Polygon' ? '#8247E5' : '#627EEA';
  const isInitialLoad = isPricesLoading && totalUsd === 0;

  if (Platform.OS === 'web') {
    return <WebDashboard assetsList={assetsList} totalUsd={totalUsd} T={T} walletName={walletName} transactions={transactions} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: T.background }]}>
      
      {/* Testnet Ribbon — only show on testnet */}
      {network === 'Sepolia' && (
        <View style={styles.testnetRibbon}>
          <Text style={styles.testnetText}>
            RUNNING ON SEPOLIA TESTNET · NO REAL FUNDS
          </Text>
        </View>
      )}

      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: isDarkMode ? 'rgba(19,19,19,0.97)' : 'rgba(247,249,251,0.97)', top: Platform.OS === 'ios' ? 24 : 0 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={[styles.avatar, { borderColor: T.border, backgroundColor: T.surfaceLow }]}>
            <Text style={{ color: T.primary, fontWeight: '800', fontSize: 16 }}>
              {walletName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={[styles.logoText, { color: T.primary }]}>CryptoWallet</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[styles.networkDot, { backgroundColor: networkColor }]} />
              <Text style={{ fontSize: 11, color: T.textMuted, fontWeight: '600' }}>{network}</Text>
            </View>
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
        contentContainerStyle={[styles.scroll, network !== 'Sepolia' && { paddingTop: 96 }]}
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
            <SkeletonBox width={200} height={52} borderRadius={12} style={{ marginBottom: 8 }} />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text style={[styles.balanceValue, { color: T.text }]}>
                {balanceVisible
                  ? `$${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '$ ••••••'}
              </Text>
              <Text style={[styles.balanceCurrency, { color: T.textMuted }]}>USD</Text>
            </View>
          )}
          {!isInitialLoad && balanceVisible && assetsList.length > 0 && (() => {
            const avgChange = assetsList.reduce((s, a) => s + a.change24h, 0) / assetsList.length;
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
          })()}
        </View>

        {/* ── Quick Actions ── */}
        <View style={styles.actionsRow}>
          <ActionBtn icon="add"         label="Deposit" onPress={() => navigation.navigate('Receive')} T={T} isDark={isDarkMode} />
          <ActionBtn icon="swap-horiz"  label="Swap"    onPress={() => navigation.navigate('Swap')}    T={T} isDark={isDarkMode} />
          <ActionBtn icon="send"        label="Send"    onPress={() => navigation.navigate('Send')}    T={T} isDark={isDarkMode} />
          <ActionBtn icon="credit-card" label="Card"    onPress={() => navigation.navigate('Card')}    T={T} isDark={isDarkMode} />
        </View>

        {/* ── Virtual Card Banner ── */}
        <TouchableOpacity
          style={[styles.cardBanner, { backgroundColor: T.surface, borderColor: T.border }]}
          onPress={() => navigation.navigate('Card')}
          activeOpacity={0.85}
        >
          <View style={[styles.cardBannerIcon, { backgroundColor: T.primary + '18' }]}>
            <MaterialIcons name="credit-card" size={24} color={T.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardBannerTitle, { color: T.text }]}>Virtual Card</Text>
            <Text style={[styles.cardBannerSub, { color: T.textMuted }]}>Spend crypto anywhere, instantly</Text>
          </View>
          <View style={[styles.openBtn, { backgroundColor: T.primary }]}>
            <Text style={styles.openBtnText}>Open</Text>
          </View>
        </TouchableOpacity>

        {/* ── My Assets ── */}
        <View style={[styles.assetsContainer, { backgroundColor: T.surface, borderColor: T.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: T.text }]}>My Assets</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Assets')} activeOpacity={0.7}>
              <Text style={{ color: T.primary, fontSize: 13, fontWeight: '700' }}>View All →</Text>
            </TouchableOpacity>
          </View>
          {isInitialLoad ? (
            [0,1,2].map(i => (
              <View key={i} style={[styles.tokenItem, { gap: 12 }]}>
                <SkeletonBox width={44} height={44} borderRadius={22} />
                <View style={{ flex: 1, gap: 6 }}>
                  <SkeletonBox width={100} height={14} />
                  <SkeletonBox width={70} height={11} />
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <SkeletonBox width={70} height={14} />
                  <SkeletonBox width={45} height={11} />
                </View>
              </View>
            ))
          ) : assetsList.slice(0, 4).map((a, idx) => (
            <React.Fragment key={a.symbol}>
              <TokenRow
                symbol={a.symbol} amount={a.amount} usd={a.usd}
                change24h={a.change24h} T={T} hideBalance={!balanceVisible}
                onPress={() => navigation.navigate('CoinChart', { symbol: a.symbol })}
              />
              {idx < Math.min(assetsList.length, 4) - 1 && (
                <View style={[styles.divider, { backgroundColor: T.border }]} />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* ── Market Prices ── */}
        <View style={styles.marketSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: T.text }]}>Market</Text>
            {isPricesLoading && !isInitialLoad && <ActivityIndicator size="small" color={T.primary} />}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {isInitialLoad ? (
              [0,1,2,3,4].map(i => (
                <View key={i} style={[styles.marketChip, { backgroundColor: T.surface, borderColor: T.border, gap: 6 }]}>
                  <SkeletonBox width={28} height={28} borderRadius={14} />
                  <SkeletonBox width={36} height={13} />
                  <SkeletonBox width={48} height={14} />
                  <SkeletonBox width={40} height={11} />
                </View>
              ))
            ) : (['ETH', 'BTC', 'SOL', 'MATIC', 'USDT'] as const).map(sym => {
              const p    = prices[sym];
              const isUp = (p?.change24h ?? 0) >= 0;
              return (
                <View key={sym} style={[styles.marketChip, { backgroundColor: T.surface, borderColor: T.border }]}>
                  <CoinIcon symbol={sym} size={28} />
                  <Text style={[styles.marketSym, { color: T.text }]}>{sym}</Text>
                  <Text style={[styles.marketPrice, { color: T.text }]}>
                    ${p ? (p.usd >= 1000 ? (p.usd / 1000).toFixed(1) + 'k' : p.usd.toFixed(2)) : '—'}
                  </Text>
                  <Text style={[styles.marketChange, { color: isUp ? T.success : T.error }]}>
                    {isUp ? '+' : ''}{(p?.change24h ?? 0).toFixed(2)}%
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>

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
  testnetRibbon: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 10,
  },
  testnetText: {
    color: '#D97706',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  header: {
    position: 'absolute', top: 0, width: '100%', zIndex: 50,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 20 : 56, paddingBottom: 14,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 17, fontWeight: '800', letterSpacing: -0.5 },
  networkDot: { width: 7, height: 7, borderRadius: 4 },
  headerBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19 },

  scroll: { paddingTop: 116, paddingHorizontal: 20, paddingBottom: 60 },

  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 14 },
  errorBannerText: { flex: 1, fontSize: 12, fontWeight: '600' },

  balanceSection: { paddingVertical: 20 },
  estText: { fontSize: 13, fontWeight: '600' },
  balanceValue: { fontSize: 46, fontWeight: '800', letterSpacing: -1.5 },
  balanceCurrency: { fontSize: 20, fontWeight: '700' },
  changePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },

  // Actions row — clear bottom margin so Virtual Card has its own space
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },

  // Virtual Card Banner — proper spacing top and bottom
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

  // My Assets — clear card with proper padding
  assetsContainer: { borderRadius: 22, padding: 18, borderWidth: 1 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '800' },

  tokenItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11 },
  tokenLeft: { flexDirection: 'row', alignItems: 'center' },
  tokenName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  tokenSub: { fontSize: 12, fontWeight: '500' },
  tokenUsd: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  divider: { height: 1, width: '100%' },

  marketSection: { marginTop: 24 },
  marketChip: { marginRight: 10, padding: 14, borderRadius: 16, borderWidth: 1, alignItems: 'flex-start', gap: 6, minWidth: 90 },
  marketSym: { fontSize: 13, fontWeight: '700' },
  marketPrice: { fontSize: 14, fontWeight: '800' },
  marketChange: { fontSize: 11, fontWeight: '700' },

  newsSection: { marginTop: 24 },
  newsCard: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 10, gap: 12 },
  newsThumbnail: { width: 72, height: 72, borderRadius: 10 },
  newsSourcePill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 6 },
  newsSourceText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  newsTitle: { fontSize: 13, fontWeight: '600', lineHeight: 19, marginBottom: 6 },
  newsMeta: { fontSize: 11, fontWeight: '500' },
  newsPlaceholder: { padding: 40, borderRadius: 16, borderWidth: 1, alignItems: 'center', gap: 8 },
  retryBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
});

const webStyles = StyleSheet.create({
  container: { flex: 1 },
  topRow: { flexDirection: 'row', gap: 48 },
  heroColumn: { flex: 2.2 },
  welcomeText: { fontSize: 18, fontWeight: '700', marginBottom: 24, letterSpacing: -0.4 },
  portfolioCard: {
    backgroundColor: '#1C1D21',
    borderRadius: 32,
    padding: 40,
    marginBottom: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  portfolioLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  portfolioValue: { fontSize: 56, fontWeight: '900', letterSpacing: -2, marginBottom: 40 },
  assetChartWrap: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 32 },
  chartTitle: { fontSize: 15, fontWeight: '800', marginBottom: 24 },
  chartRow: { flexDirection: 'row', gap: 12 },
  chartCol: { gap: 8 },
  chartBar: { width: '100%' },
  chartLabel: { fontSize: 13, fontWeight: '800' },
  chartPercent: { fontSize: 12, fontWeight: '600' },

  activitySection: { flex: 1 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  sectionTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.6 },
  activityList: { gap: 4 },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    gap: 24,
  },
  activityMeta: { flex: 1.2 },
  activityTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  activityDate: { fontSize: 12, fontWeight: '600' },
  activitySub: { flex: 1, fontSize: 14, fontWeight: '600' },
  activityAmount: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  activityStatus: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },

  sideColumn: { flex: 1, gap: 32 },
  eliteCard: {
    borderRadius: 32,
    padding: 32,
    minHeight: 340,
    justifyContent: 'space-between',
    borderWidth: 1,
  },
  eliteHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eliteDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF3B3B' },
  eliteTitle: { color: '#FFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  eliteDesc: { color: 'rgba(255,255,255,0.7)', fontSize: 18, fontWeight: '600', lineHeight: 28 },
  eliteFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eliteUser: { color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  eliteChip: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  eliteChipText: { color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  marketPulseCard: {
    borderRadius: 32,
    padding: 32,
    gap: 12,
  },
  pulseLabel: { fontSize: 15, fontWeight: '800' },
  pulseValue: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  pulseInfo: { fontSize: 14, fontWeight: '600', lineHeight: 22 },
});

