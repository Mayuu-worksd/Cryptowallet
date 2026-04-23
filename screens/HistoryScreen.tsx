import React, {
  useState, useEffect, useCallback, useRef, memo, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, Platform, Linking, Modal, ActivityIndicator,
  Animated, StatusBar,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useWallet, useMarket } from '../store/WalletContext';
import { Theme } from '../constants';
import Toast from '../components/Toast';
import { transactionService, UnifiedTx } from '../services/transactionService';

// ─── Filter tabs ──────────────────────────────────────────────────────────────
const FILTERS = ['All', 'Send', 'Receive', 'Swap', 'Card'] as const;
type Filter = typeof FILTERS[number];

// ─── Explorer URLs ────────────────────────────────────────────────────────────
const EXPLORER: Record<string, string> = {
  Sepolia:  'https://sepolia.etherscan.io/tx/',
  Ethereum: 'https://etherscan.io/tx/',
  Polygon:  'https://polygonscan.com/tx/',
  Arbitrum: 'https://arbiscan.io/tx/',
};

// ─── Type → visual config ─────────────────────────────────────────────────────
type TxConfig = { label: string; color: string; bg: string; icon: React.ReactNode };

function useTxConfig(T: any): Record<UnifiedTx['type'], TxConfig> {
  return useMemo(() => ({
    send:    { label: 'Sent',         color: T.error,   bg: T.error   + '18', icon: <Feather name="arrow-up-right"  size={18} color={T.error}   /> },
    receive: { label: 'Received',     color: T.success, bg: T.success + '18', icon: <Feather name="arrow-down-left" size={18} color={T.success} /> },
    swap:    { label: 'Swap',         color: '#0891B2', bg: '#0891B218',       icon: <MaterialCommunityIcons name="swap-horizontal" size={18} color="#0891B2" /> },
    card:    { label: 'Card',         color: '#7C3AED', bg: '#7C3AED18',       icon: <Feather name="credit-card"     size={18} color="#7C3AED"  /> },
  }), [T]);
}

// ─── Status badge ─────────────────────────────────────────────────────────────
const StatusBadge = memo(({ status, T }: { status: UnifiedTx['status']; T: any }) => {
  const color =
    status === 'completed' ? T.success :
    status === 'pending'   ? T.pending : T.error;
  return (
    <View style={[badgeStyles.wrap, { backgroundColor: color + '18' }]}>
      <View style={[badgeStyles.dot, { backgroundColor: color }]} />
      <Text style={[badgeStyles.text, { color }]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </View>
  );
});

const badgeStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  dot:  { width: 5, height: 5, borderRadius: 3 },
  text: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
});

// ─── Skeleton row ─────────────────────────────────────────────────────────────
const SkeletonRow = memo(({ T }: { T: any }) => {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
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
    <Animated.View style={[sk.row, { opacity: anim, backgroundColor: T.surface }]}>
      <View style={[sk.icon, { backgroundColor: T.border }]} />
      <View style={{ flex: 1, gap: 7 }}>
        <View style={[sk.line, { width: '45%', backgroundColor: T.border }]} />
        <View style={[sk.line, { width: '65%', height: 10, backgroundColor: T.border }]} />
      </View>
      <View style={{ alignItems: 'flex-end', gap: 7 }}>
        <View style={[sk.line, { width: 72, backgroundColor: T.border }]} />
        <View style={[sk.line, { width: 48, height: 10, backgroundColor: T.border }]} />
      </View>
    </Animated.View>
  );
});

const sk = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, marginBottom: 8 },
  icon: { width: 46, height: 46, borderRadius: 23 },
  line: { height: 13, borderRadius: 6 },
});

// ─── Transaction row ──────────────────────────────────────────────────────────
const TxRow = memo(({ tx, T, cfg, onPress }: {
  tx: UnifiedTx; T: any; cfg: TxConfig; onPress: () => void;
}) => {
  const isDebit  = tx.type === 'send' || (tx.type === 'card' && !tx.label.includes('Top-up'));
  const amtColor = isDebit ? T.error : T.success;
  const sign     = isDebit ? '−' : '+';

  return (
    <TouchableOpacity
      style={[styles.txRow, { backgroundColor: T.surface, borderColor: T.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.txIcon, { backgroundColor: cfg.bg }]}>
        {cfg.icon}
      </View>

      <View style={styles.txMid}>
        <Text style={[styles.txLabel, { color: T.text }]} numberOfLines={1}>{tx.label}</Text>
        <Text style={[styles.txAddr, { color: T.textMuted }]} numberOfLines={1}>
          {tx.type === 'send'
            ? (tx.to.length > 20   ? `${tx.to.slice(0, 8)}…${tx.to.slice(-6)}`   : tx.to)
            : tx.type === 'receive'
            ? (tx.from && tx.from !== 'You' && tx.from.length > 6
                ? `${tx.from.slice(0, 8)}…${tx.from.slice(-6)}`
                : 'Received to your wallet')
            : tx.label}
        </Text>
        <Text style={[styles.txDate, { color: T.textDim }]}>
          {transactionService.formatDate(tx.date)}
        </Text>
      </View>

      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: amtColor }]}>
          {sign}{parseFloat(tx.amount).toFixed(
            tx.token === 'USD' ? 2 : tx.token === 'ETH' ? 5 : 4
          )} {tx.token}
        </Text>
        <Text style={[styles.txUsd, { color: T.textMuted }]}>
          ${parseFloat(tx.usdValue || '0').toFixed(2)}
        </Text>
        <StatusBadge status={tx.status} T={T} />
      </View>

      <Feather name="chevron-right" size={13} color={T.border} style={{ marginLeft: 4 }} />
    </TouchableOpacity>
  );
});

// ─── Detail modal ─────────────────────────────────────────────────────────────
const DetailModal = memo(({ tx, T, cfg, network, onClose }: {
  tx: UnifiedTx | null; T: any; cfg: TxConfig | null; network: string; onClose: () => void;
}) => {
  if (!tx || !cfg) return null;
  const isDebit  = tx.type === 'send' || (tx.type === 'card' && !tx.label.includes('Top-up'));
  const amtColor = isDebit ? T.error : T.success;
  const explorerBase = EXPLORER[network] ?? EXPLORER.Sepolia;

  const rows = [
    { label: 'Type',   value: cfg.label },
    { label: 'Status', value: tx.status.charAt(0).toUpperCase() + tx.status.slice(1) },
    { label: 'Date',   value: transactionService.formatDate(tx.date) },
    { label: 'From',   value: tx.from.length > 28 ? `${tx.from.slice(0, 12)}…${tx.from.slice(-8)}` : tx.from },
    { label: 'To',     value: tx.to.length   > 28 ? `${tx.to.slice(0, 12)}…${tx.to.slice(-8)}`   : tx.to   },
    ...(tx.hash ? [{ label: 'Tx Hash', value: `${tx.hash.slice(0, 14)}…${tx.hash.slice(-8)}` }] : []),
  ];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={[modal.sheet, { backgroundColor: T.surface }]}>
          <View style={[modal.handle, { backgroundColor: T.border }]} />

          {/* Header */}
          <View style={modal.header}>
            <Text style={[modal.title, { color: T.text }]}>Transaction Detail</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={22} color={T.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Amount hero */}
          <View style={modal.hero}>
            <View style={[modal.heroIcon, { backgroundColor: cfg.bg }]}>
              {cfg.icon}
            </View>
            <Text style={[modal.heroAmount, { color: amtColor }]}>
              {isDebit ? '−' : '+'}{parseFloat(tx.amount).toFixed(
                tx.token === 'USD' ? 2 : tx.token === 'ETH' ? 6 : 4
              )} {tx.token}
            </Text>
            <Text style={[modal.heroUsd, { color: T.textMuted }]}>
              ≈ ${parseFloat(tx.usdValue || '0').toFixed(2)} USD
            </Text>
            <StatusBadge status={tx.status} T={T} />
          </View>

          {/* Detail rows */}
          <View style={[modal.detailBox, { backgroundColor: T.surfaceLow }]}>
            {rows.map((row, i) => (
              <View
                key={row.label}
                style={[modal.detailRow, i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.border }]}
              >
                <Text style={[modal.detailLabel, { color: T.textMuted }]}>{row.label}</Text>
                <Text style={[modal.detailValue, { color: T.text }]} numberOfLines={1}>{row.value}</Text>
              </View>
            ))}
          </View>

          {/* Explorer link */}
          {tx.hash && (
            <TouchableOpacity
              style={[modal.explorerBtn, { backgroundColor: T.primary + '18' }]}
              onPress={() => {
                const url = `${explorerBase}${tx.hash}`;
                try {
                  const u = new URL(url);
                  if (u.protocol === 'https:') Linking.openURL(u.href);
                } catch (_e) {}
              }}
              activeOpacity={0.8}
            >
              <Feather name="external-link" size={16} color={T.primary} />
              <Text style={[modal.explorerText, { color: T.primary }]}>View on Explorer</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
});

const modal = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet:       { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: Platform.OS === 'ios' ? 48 : 32 },
  handle:      { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title:       { fontSize: 18, fontWeight: '800' },
  hero:        { alignItems: 'center', marginBottom: 24, gap: 8 },
  heroIcon:    { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  heroAmount:  { fontSize: 30, fontWeight: '900', letterSpacing: -1 },
  heroUsd:     { fontSize: 15, fontWeight: '600' },
  detailBox:   { borderRadius: 20, marginBottom: 20, overflow: 'hidden' },
  detailRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  detailLabel: { fontSize: 13, fontWeight: '600' },
  detailValue: { fontSize: 13, fontWeight: '700', maxWidth: '55%', textAlign: 'right' },
  explorerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 16 },
  explorerText:{ fontSize: 14, fontWeight: '700' },
});

// ─── Empty state ──────────────────────────────────────────────────────────────
const EmptyState = memo(({ filter, T }: { filter: Filter; T: any }) => (
  <View style={styles.emptyWrap}>
    <View style={[styles.emptyIconBox, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
      <Feather name="inbox" size={30} color={T.textMuted} />
    </View>
    <Text style={[styles.emptyTitle, { color: T.text }]}>No transactions yet</Text>
    <Text style={[styles.emptySub, { color: T.textMuted }]}>
      {filter === 'All'
        ? 'Your transaction history will appear here once you send, receive, swap, or use your card.'
        : `No ${filter.toLowerCase()} transactions found.`}
    </Text>
  </View>
));

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function HistoryScreen({ navigation }: any) {
  const { isDarkMode, network, walletAddress } = useWallet();
  const { prices } = useMarket();
  const T       = isDarkMode ? Theme.colors : Theme.lightColors;
  const cfgMap  = useTxConfig(T);

  const [txs,          setTxs]          = useState<UnifiedTx[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [fromCache,    setFromCache]    = useState(false);
  const [activeFilter, setActiveFilter] = useState<Filter>('All');
  const [selectedTx,   setSelectedTx]  = useState<UnifiedTx | null>(null);
  const [toast,        setToast]        = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

  const ethPrice = prices.ETH?.usd ?? 3450;

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ visible: true, message, type });
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (!walletAddress) { setLoading(false); return; }
    if (isRefresh) setRefreshing(true);
    else           setLoading(true);

    try {
      const { txs: fetched, fromCache: cached } = await transactionService.fetchAll(
        walletAddress, network, ethPrice
      );
      setTxs(fetched);
      setFromCache(cached);
      if (isRefresh) {
        showToast(
          cached ? 'On-chain sync unavailable — local transactions shown' : `Refreshed · ${fetched.length} transactions`,
          cached ? 'info' : 'success'
        );
      }
    } catch {
      if (isRefresh) showToast('Failed to refresh. Try again.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [walletAddress, network, ethPrice, showToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (activeFilter === 'All') return txs;
    const map: Record<Filter, UnifiedTx['type'][]> = {
      All:     [],
      Send:    ['send'],
      Receive: ['receive'],
      Swap:    ['swap'],
      Card:    ['card'],
    };
    return txs.filter(tx => map[activeFilter].includes(tx.type));
  }, [txs, activeFilter]);

  // Count per tab for badges
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { All: txs.length, Send: 0, Receive: 0, Swap: 0, Card: 0 };
    for (const tx of txs) {
      if (tx.type === 'send')    c.Send++;
      if (tx.type === 'receive') c.Receive++;
      if (tx.type === 'swap')    c.Swap++;
      if (tx.type === 'card')    c.Card++;
    }
    return c;
  }, [txs]);

  return (
    <View style={[styles.container, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast(p => ({ ...p, visible: false }))}
      />

      <DetailModal
        tx={selectedTx}
        T={T}
        cfg={selectedTx ? cfgMap[selectedTx.type] : null}
        network={network}
        onClose={() => setSelectedTx(null)}
      />

      {/* ── Header ── */}
      <View style={[styles.header, { borderBottomColor: T.border }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.headerTitle, { color: T.text }]}>History</Text>
          {fromCache && (
            <Text style={[styles.cacheNote, { color: T.pending }]}>Cached data</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => load(true)}
          disabled={refreshing}
          activeOpacity={0.7}
        >
          {refreshing
            ? <ActivityIndicator size="small" color={T.primary} />
            : <Feather name="refresh-cw" size={18} color={T.primary} />}
        </TouchableOpacity>
      </View>

      {/* ── Filter tabs ── */}
      <View style={[styles.tabsWrap, { borderBottomColor: T.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {FILTERS.map(f => {
            const active = activeFilter === f;
            return (
              <TouchableOpacity
                key={f}
                style={[styles.tab, active && { borderBottomColor: T.primary, borderBottomWidth: 2 }]}
                onPress={() => setActiveFilter(f)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, { color: active ? T.primary : T.textMuted }]}>{f}</Text>
                {counts[f] > 0 && (
                  <View style={[styles.tabBadge, { backgroundColor: active ? T.primary : T.surfaceLow }]}>
                    <Text style={[styles.tabBadgeText, { color: active ? '#FFF' : T.textMuted }]}>
                      {counts[f]}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Cache warning banner ── */}
      {fromCache && (
        <TouchableOpacity
          style={[styles.cacheBanner, { backgroundColor: T.pending + '15', borderColor: T.pending + '40' }]}
          onPress={() => load(true)}
          activeOpacity={0.8}
        >
          <Feather name="wifi-off" size={13} color={T.pending} />
          <Text style={[styles.cacheBannerText, { color: T.pending }]}>
            On-chain sync unavailable — local transactions still shown. Tap to retry.
          </Text>
        </TouchableOpacity>
      )}

      {/* ── List ── */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={T.primary}
            colors={[T.primary]}
          />
        }
      >
        {/* Summary row */}
        {!loading && txs.length > 0 && (
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryText, { color: T.textMuted }]}>
              {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
              {activeFilter !== 'All' ? ` · ${activeFilter}` : ''}
            </Text>
            <Text style={[styles.summaryText, { color: T.textDim }]}>Pull down to refresh</Text>
          </View>
        )}

        {/* Skeleton */}
        {loading ? (
          [0, 1, 2, 3, 4].map(i => <SkeletonRow key={i} T={T} />)
        ) : filtered.length === 0 ? (
          <EmptyState filter={activeFilter} T={T} />
        ) : (
          filtered.map((tx, index) => (
            <TxRow
              key={tx.id ? `${tx.id}-${index}` : `tx-${index}`}
              tx={tx}
              T={T}
              cfg={cfgMap[tx.type]}
              onPress={() => setSelectedTx(tx)}
            />
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : Platform.OS === 'web' ? 20 : 40,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerBtn:   { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  headerTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  cacheNote:   { fontSize: 10, fontWeight: '700', textAlign: 'center', letterSpacing: 0.3 },

  tabsWrap: { borderBottomWidth: 1 },
  tabs:     { paddingHorizontal: 16, gap: 4 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 14,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText:      { fontSize: 14, fontWeight: '700' },
  tabBadge:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  tabBadgeText: { fontSize: 10, fontWeight: '800' },

  cacheBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 12,
    padding: 12, borderRadius: 12, borderWidth: 1,
  },
  cacheBannerText: { flex: 1, fontSize: 12, fontWeight: '600' },

  scroll:      { paddingHorizontal: 16, paddingTop: 12 },
  summaryRow:  { marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryText: { fontSize: 12, fontWeight: '600' },

  txRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 16, marginBottom: 8, borderWidth: 1,
  },
  txIcon:   { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  txMid:    { flex: 1, gap: 2 },
  txLabel:  { fontSize: 14, fontWeight: '700' },
  txAddr:   { fontSize: 11, fontWeight: '500' },
  txDate:   { fontSize: 10, fontWeight: '500' },
  txRight:  { alignItems: 'flex-end', gap: 3 },
  txAmount: { fontSize: 13, fontWeight: '800' },
  txUsd:    { fontSize: 11, fontWeight: '600' },

  emptyWrap:    { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 32, gap: 14 },
  emptyIconBox: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle:   { fontSize: 18, fontWeight: '800' },
  emptySub:     { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
