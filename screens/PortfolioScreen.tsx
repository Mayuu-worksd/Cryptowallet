import React, { useState, useMemo, memo, useEffect } from 'react';
import { Theme } from '../constants';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useWallet, useMarket } from '../store/WalletContext';
import { COIN_META, COIN_COLORS } from '../constants';
import { SYMBOL_TO_COINGECKO_ID } from '../services/marketService';
import Toast from '../components/Toast';
import { haptics } from '../utils/haptics';
import { supabase } from '../services/supabaseClient';
import { P2POrder } from '../services/merchantService';

// Coins that have a CoinGecko price feed but no on-chain balance tracking yet
const DISPLAY_ONLY_COINS = Object.keys(SYMBOL_TO_COINGECKO_ID).filter(
  sym => !['ETH', 'USDT', 'USDC', 'DAI', 'TRX', 'MATIC', 'BNB'].includes(sym)
);

const CoinIcon = memo(({ symbol, size = 44 }: { symbol: string; size?: number }) => {
  const meta  = COIN_META[symbol];
  const color = COIN_COLORS[symbol] || '#888';
  const [failed, setFailed] = useState(false);
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
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color + '20', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color, fontSize: size * 0.4, fontWeight: '800' }}>{symbol.charAt(0)}</Text>
    </View>
  );
});

const STABLE_FALLBACK: Record<string, number> = { USDC: 1, USDT: 1, DAI: 1 };

export default function PortfolioScreen({ navigation }: any) {
  const { ethBalance, balances, isDarkMode, walletAddress, lockedBalance } = useWallet();
  const { prices } = useMarket();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' as 'success' | 'error' | 'info' });
  const [activeOrders, setActiveOrders] = useState<P2POrder[]>([]);

  // Fetch active P2P orders
  useEffect(() => {
    if (!walletAddress) return;
    const fetchOrders = async () => {
      try {
        const { data } = await supabase
          .from('p2p_orders')
          .select('*')
          .or(`buyer_wallet.eq.${walletAddress.toLowerCase()},seller_wallet.eq.${walletAddress.toLowerCase()}`)
          .in('status', ['open', 'in_escrow', 'fiat_sent', 'disputed'])
          .order('created_at', { ascending: false });
        if (data) setActiveOrders(data);
      } catch {}
    };
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [walletAddress]);

  const showComingSoon = () => {
    haptics.selection();
    setToast({ visible: true, message: 'BTC & SOL support coming soon!', type: 'info' });
  };

  const realBalances: Record<string, number> = useMemo(() => ({
    ETH:  parseFloat(ethBalance) || 0,
    ...Object.fromEntries(
      Object.entries(balances).filter(([k]) => k !== 'ETH').map(([k, v]) => [k, v ?? 0])
    ),
  }), [ethBalance, balances]);

  const assetsList = useMemo(() =>
    (Object.keys(realBalances) as string[])
      .map(symbol => {
        const price     = prices[symbol]?.usd ?? STABLE_FALLBACK[symbol] ?? 0;
        const change24h = prices[symbol]?.change24h ?? 0;
        const available = realBalances[symbol] - (lockedBalance[symbol] ?? 0);
        return { symbol, amount: realBalances[symbol], available: Math.max(0, available), locked: lockedBalance[symbol] ?? 0, usd: realBalances[symbol] * price, change24h };
      })
      .sort((a, b) => b.usd - a.usd),
    [realBalances, prices, lockedBalance]
  );

  const totalUsd = useMemo(() => assetsList.reduce((acc, a) => acc + a.usd, 0), [assetsList]);
  const totalLockedUsd = useMemo(() => {
    return assetsList.reduce((acc, a) => acc + (a.locked * (prices[a.symbol]?.usd ?? STABLE_FALLBACK[a.symbol] ?? 0)), 0);
  }, [assetsList, prices]);

  return (
    <View style={[styles.container, { backgroundColor: T.background }]}>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        isDarkMode={isDarkMode}
        onHide={() => setToast(p => ({ ...p, visible: false }))}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: T.background }]}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>My Assets</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Balance gradient card */}
        <View style={styles.balanceContainer}>
          <LinearGradient
            colors={[Theme.colors.primary, Theme.colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.editorialGradient}
          >
            <Text style={styles.totalSubtitle}>Total Balance Equivalent</Text>
            <Text style={styles.totalValue}>
              ${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            {totalLockedUsd > 0 && (
              <View style={styles.lockedBadge}>
                <Feather name="lock" size={12} color="#FFA500" />
                <Text style={styles.lockedText}>
                  ${totalLockedUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} locked in P2P
                </Text>
              </View>
            )}
            {(() => {
              const avgChange = assetsList.reduce((s, a) => s + a.change24h, 0) / (assetsList.length || 1);
              const isUp = avgChange >= 0;
              return (
                <View style={styles.changeRow}>
                  <View style={[styles.changeBadge, { backgroundColor: isUp ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.25)' }]}>
                    <Text style={[styles.changeBadgeText, { color: '#FFFFFF' }]}>
                      {isUp ? '+' : ''}{avgChange.toFixed(2)}%
                    </Text>
                  </View>
                  <Text style={styles.changeMuted}>24h change</Text>
                </View>
              );
            })()}
            <View style={styles.decorativeGlow} />
          </LinearGradient>
        </View>

        {/* Active P2P Orders Section */}
        {activeOrders.length > 0 && (
          <View style={styles.ordersSection}>
            <View style={styles.sectionHeader}>
              <Feather name="activity" size={18} color={T.primary} />
              <Text style={[styles.sectionTitle, { color: T.text }]}>Active P2P Orders</Text>
              <View style={[styles.orderBadge, { backgroundColor: T.primary + '20' }]}>
                <Text style={[styles.orderBadgeText, { color: T.primary }]}>{activeOrders.length}</Text>
              </View>
            </View>
            {activeOrders.map(order => {
              const isBuyer = order.buyer_wallet?.toLowerCase() === walletAddress.toLowerCase();
              const statusColor = order.status === 'disputed' ? T.error : order.status === 'fiat_sent' ? '#F59E0B' : T.primary;
              return (
                <TouchableOpacity
                  key={order.id}
                  style={[styles.orderCard, { backgroundColor: T.surface, borderColor: T.border }]}
                  onPress={() => navigation.navigate('P2POrderDetail', { order })}
                  activeOpacity={0.8}
                >
                  <View style={styles.orderLeft}>
                    <View style={[styles.orderIcon, { backgroundColor: statusColor + '20' }]}>
                      <Feather name={isBuyer ? 'download' : 'upload'} size={16} color={statusColor} />
                    </View>
                    <View style={styles.orderInfo}>
                      <Text style={[styles.orderAmount, { color: T.text }]}>
                        {order.amount} {order.token}
                      </Text>
                      <Text style={[styles.orderStatus, { color: T.textMuted }]}>
                        {isBuyer ? 'Buying' : 'Selling'} • {order.status.toUpperCase().replace('_', ' ')}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.orderRight}>
                    <Text style={[styles.orderFiat, { color: T.text }]}>
                      ${order.fiat_total.toFixed(2)}
                    </Text>
                    <Text style={[styles.orderRate, { color: T.textMuted }]}>
                      @ ${order.rate.toFixed(2)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Assets list — live coins */}
        <View style={styles.assetList}>
          {assetsList.map(a => {
            if (a.amount <= 0) return null;
            const isUp = a.change24h >= 0;
            return (
              <TouchableOpacity
                key={a.symbol}
                style={[styles.assetCard, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
                activeOpacity={0.8}
                onPress={() => { haptics.selection(); navigation.navigate('CoinChart', { symbol: a.symbol }); }}
              >
                <View style={styles.assetLeft}>
                  <View style={[styles.coinWrapper, { backgroundColor: T.surface, borderColor: T.border }]}>
                    <CoinIcon symbol={a.symbol} size={40} />
                  </View>
                  <View style={styles.assetInfo}>
                    <Text style={[styles.assetName, { color: T.text }]}>{COIN_META[a.symbol]?.name ?? a.symbol}</Text>
                    <Text style={[styles.assetSymbol, { color: T.textMuted }]}>{a.symbol}</Text>
                    {a.locked > 0 && (
                      <View style={styles.lockedIndicator}>
                        <Feather name="lock" size={10} color="#FFA500" />
                        <Text style={styles.lockedIndicatorText}>{a.locked.toFixed(4)} locked</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={styles.assetValBox}>
                    <Text style={[styles.assetAmountNum, { color: T.text }]}>
                      {a.available.toFixed(4)} {a.symbol}
                    </Text>
                    <Text style={[styles.assetUsd, { color: T.textMuted }]}>
                      ${(a.available * (prices[a.symbol]?.usd ?? STABLE_FALLBACK[a.symbol] ?? 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                    <Text style={[styles.assetChange, { color: isUp ? T.success : T.error }]}>
                      {isUp ? '▲' : '▼'} {Math.abs(a.change24h).toFixed(2)}%
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={14} color={T.border} />
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Coming Soon rows — derived dynamically */}
          {DISPLAY_ONLY_COINS.map(sym => (
            <TouchableOpacity
              key={sym}
              style={[styles.assetCard, { backgroundColor: T.surfaceLow, opacity: 0.6, borderColor: T.border }]}
              activeOpacity={0.8}
              onPress={showComingSoon}
            >
              <View style={styles.assetLeft}>
                <View style={[styles.coinWrapper, { backgroundColor: T.surface, borderColor: T.border }]}>
                  <CoinIcon symbol={sym} size={40} />
                </View>
                <View style={styles.assetInfo}>
                  <Text style={[styles.assetName, { color: T.text }]}>{COIN_META[sym]?.name ?? sym}</Text>
                  <Text style={[styles.assetSymbol, { color: T.textMuted }]}>{sym}</Text>
                </View>
              </View>
              <View style={[styles.comingSoonChip, { backgroundColor: T.primary + '20', borderColor: T.primary + '40' }]}>
                <Text style={[styles.comingSoonText, { color: T.primary }]}>Coming Soon</Text>
              </View>
            </TouchableOpacity>
          ))}

          {assetsList.every(a => a.amount <= 0) && (
            <View style={styles.emptyBox}>
              <Feather name="inbox" size={32} color={T.border} style={{ marginBottom: 16 }} />
              <Text style={{ color: T.text, fontWeight: '800', fontSize: 16, marginBottom: 8 }}>Empty Portfolio</Text>
              <Text style={{ color: T.textMuted, fontSize: 13, textAlign: 'center' }}>
                Your assets will appear here once you have a balance.
              </Text>
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 16,
  },
  headerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center', flex: 1 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },

  scroll: { paddingHorizontal: 24, paddingBottom: 100, paddingTop: 10 },

  balanceContainer: { marginBottom: 28, marginTop: 0 },
  editorialGradient: {
    padding: 24, borderRadius: 24, overflow: 'hidden',
    shadowColor: '#EC2629', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4, shadowRadius: 24, elevation: 12,
  },
  totalSubtitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.85)', marginBottom: 8 },
  totalValue: { fontSize: 44, fontWeight: '900', letterSpacing: -1.5, color: '#FFFFFF' },
  lockedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(255,165,0,0.2)', borderRadius: 12 },
  lockedText: { fontSize: 11, fontWeight: '700', color: '#FFA500' },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  changeBadge: { backgroundColor: '#85f3fe', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  changeBadgeText: { color: '#002022', fontSize: 12, fontWeight: '700' },
  changeMuted: { fontSize: 10, color: 'rgba(255,255,255,0.6)' },
  decorativeGlow: {
    position: 'absolute', right: -40, bottom: -40, width: 160, height: 160,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 80,
  },

  ordersSection: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', flex: 1 },
  orderBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  orderBadgeText: { fontSize: 11, fontWeight: '800' },
  orderCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  orderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  orderIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  orderInfo: { flex: 1 },
  orderAmount: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  orderStatus: { fontSize: 11, fontWeight: '600' },
  orderRight: { alignItems: 'flex-end' },
  orderFiat: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  orderRate: { fontSize: 11, fontWeight: '600' },

  assetList: { gap: 10 },
  assetCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderRadius: 20, borderWidth: 1,
  },
  assetLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  coinWrapper: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  assetInfo: { justifyContent: 'center' },
  assetName: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  assetSymbol: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  lockedIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  lockedIndicatorText: { fontSize: 10, fontWeight: '700', color: '#FFA500' },

  assetValBox: { alignItems: 'flex-end' },
  assetAmountNum: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  assetUsd: { fontSize: 12, fontWeight: '500', marginBottom: 2 },
  assetChange: { fontSize: 11, fontWeight: '700' },

  comingSoonChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  comingSoonText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  emptyBox: { padding: 40, alignItems: 'center' },
});
