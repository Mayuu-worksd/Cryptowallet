import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, TextInput, Platform, Linking, Modal,
  ActivityIndicator, Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ethers } from 'ethers';
import { useWallet, useMarket, Transaction } from '../store/WalletContext';
import { Theme } from '../constants';
import { etherscanService, ChainTx } from '../services/etherscanService';

const TYPE_CONFIG_DARK  = makeTypeConfig(Theme.colors);
const TYPE_CONFIG_LIGHT = makeTypeConfig(Theme.lightColors);

function makeTypeConfig(T: any): Record<string, { label: string; color: string; icon: string; bg: string }> {
  return {
    sent:       { label: 'Sent',        color: T.error,   icon: 'arrow-up-right',  bg: T.error   + '18' },
    received:   { label: 'Received',    color: T.success, icon: 'arrow-down-left', bg: T.success + '18' },
    card_topup: { label: 'Card Top-up', color: '#2563EB', icon: 'credit-card',     bg: '#2563EB18' },
    card_spend: { label: 'Card Spend',  color: '#7C3AED', icon: 'shopping-cart',   bg: '#7C3AED18' },
    swap:       { label: 'Swap',        color: '#0891B2', icon: 'repeat',          bg: '#0891B218' },
  };
}

const FILTERS = ['All', 'Sent', 'Received', 'Card', 'Swap'];

const EXPLORER_URL: Record<string, string> = {
  Sepolia:  'https://sepolia.etherscan.io/tx/',
  Ethereum: 'https://etherscan.io/tx/',
  Polygon:  'https://polygonscan.com/tx/',
  Arbitrum: 'https://arbiscan.io/tx/',
};

// ─── Skeleton row ──────────────────────────────────────────────────────────────
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
    <Animated.View style={[styles.skeletonRow, { opacity: anim, backgroundColor: T.surface }]}>
      <View style={[styles.skeletonIcon, { backgroundColor: T.border }]} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={[styles.skeletonLine, { width: '50%', backgroundColor: T.border }]} />
        <View style={[styles.skeletonLine, { width: '70%', height: 10, backgroundColor: T.border }]} />
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <View style={[styles.skeletonLine, { width: 70, backgroundColor: T.border }]} />
        <View style={[styles.skeletonLine, { width: 45, height: 10, backgroundColor: T.border }]} />
      </View>
    </Animated.View>
  );
});

// ─── Tx Detail Modal ───────────────────────────────────────────────────────────
const TxDetailModal = memo(({ tx, T, network, isDarkMode, onClose }: {
  tx: Transaction | null; T: any; network: string; isDarkMode: boolean; onClose: () => void;
}) => {
  if (!tx) return null;
  const cfgMap   = isDarkMode ? TYPE_CONFIG_DARK : TYPE_CONFIG_LIGHT;
  const cfg      = cfgMap[tx.type] ?? { label: tx.type, color: T.primary, icon: 'activity', bg: T.primary + '18' };
  const isDebit  = tx.type === 'sent' || tx.type === 'card_spend';
  const explorerBase = EXPLORER_URL[network] ?? EXPLORER_URL.Sepolia;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 48 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: T.text }}>Transaction Detail</Text>
            <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={T.textMuted} /></TouchableOpacity>
          </View>
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 12, backgroundColor: cfg.bg }}>
              <Feather name={cfg.icon as any} size={28} color={cfg.color} />
            </View>
            <Text style={{ fontSize: 28, fontWeight: '800', color: isDebit ? T.error : T.success }}>
              {isDebit ? '-' : '+'}{tx.amount} {tx.coin}
            </Text>
            <Text style={{ fontSize: 15, color: T.textMuted, marginTop: 4 }}>${parseFloat(tx.usdValue || '0').toFixed(2)} USD</Text>
          </View>
          {[
            { label: 'Type',   value: cfg.label },
            { label: 'Status', value: tx.status.toUpperCase() },
            { label: 'Date',   value: tx.date },
            { label: tx.type === 'sent' ? 'To' : 'From/Label', value: tx.address.length > 24 ? `${tx.address.slice(0, 12)}...${tx.address.slice(-8)}` : tx.address },
          ].map(row => (
            <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.border }}>
              <Text style={{ color: T.textMuted, fontSize: 14 }}>{row.label}</Text>
              <Text style={{ color: T.text, fontSize: 14, fontWeight: '600', maxWidth: '60%', textAlign: 'right' }}>{row.value}</Text>
            </View>
          ))}
          {tx.txHash && (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, padding: 14, borderRadius: 14, backgroundColor: T.primary + '18' }}
              onPress={() => Linking.openURL(`${explorerBase}${tx.txHash}`)}
              activeOpacity={0.8}
            >
              <Feather name="external-link" size={16} color={T.primary} />
              <Text style={{ color: T.primary, fontWeight: '700', fontSize: 14 }}>View on Explorer</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
});

// ─── Convert on-chain tx to local Transaction format ──────────────────────────
function chainTxToLocal(tx: ChainTx, walletAddress: string, ethPrice: number): Transaction {
  const isSent   = tx.from.toLowerCase() === walletAddress.toLowerCase();
  const ethAmt   = parseFloat(ethers.utils.formatEther(tx.value || '0'));
  const usdValue = (ethAmt * ethPrice).toFixed(2);
  const date     = new Date(parseInt(tx.timeStamp) * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  return {
    id:      tx.hash,
    type:    isSent ? 'sent' : 'received',
    coin:    'ETH',
    amount:  ethAmt.toFixed(6),
    usdValue,
    address: isSent ? tx.to : tx.from,
    status:  tx.isError === '0' ? 'success' : 'failed',
    date,
    txHash:  tx.hash,
  };
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function HistoryScreen({ navigation }: any) {
  const { transactions, isDarkMode, network, walletAddress } = useWallet();
  const { prices } = useMarket();
  const T      = isDarkMode ? Theme.colors : Theme.lightColors;
  const cfgMap = isDarkMode ? TYPE_CONFIG_DARK : TYPE_CONFIG_LIGHT;

  const [search, setSearch]             = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedTx, setSelectedTx]     = useState<Transaction | null>(null);
  const [chainTxs, setChainTxs]         = useState<Transaction[]>([]);
  const [loadingChain, setLoadingChain] = useState(false);
  const [chainError, setChainError]     = useState(false);

  const ethPrice = prices.ETH?.usd ?? 3450;

  const fetchChainTxs = useCallback(async () => {
    if (!walletAddress) return;
    setLoadingChain(true);
    setChainError(false);
    try {
      const raw = await etherscanService.fetchTransactions(walletAddress, network);
      if (raw.length === 0 && network !== 'Sepolia') {
        setChainError(true);
      }
      const mapped = raw
        .filter(tx => tx.value !== '0' || tx.isError === '0') // skip failed zero-value txns
        .map(tx => chainTxToLocal(tx, walletAddress, ethPrice));
      setChainTxs(mapped);
    } catch {
      setChainError(true);
    } finally {
      setLoadingChain(false);
    }
  }, [walletAddress, network, ethPrice]);

  useEffect(() => { fetchChainTxs(); }, [fetchChainTxs]);

  // Merge on-chain txns with local ones, deduplicate by txHash
  const allTxs: Transaction[] = React.useMemo(() => {
    const seen  = new Set<string>();
    const merged: Transaction[] = [];
    // Local txns first (they have card/swap types not on chain)
    for (const tx of transactions) {
      const key = tx.txHash ?? tx.id;
      if (!seen.has(key)) { seen.add(key); merged.push(tx); }
    }
    // On-chain txns — skip if already in local (matched by txHash)
    for (const tx of chainTxs) {
      if (!seen.has(tx.id)) { seen.add(tx.id); merged.push(tx); }
    }
    // Sort by date descending
    return merged.sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0));
  }, [transactions, chainTxs]);

  const filtered = allTxs.filter(tx => {
    const matchFilter =
      activeFilter === 'All'      ||
      (activeFilter === 'Sent'     && tx.type === 'sent')     ||
      (activeFilter === 'Received' && tx.type === 'received') ||
      (activeFilter === 'Card'     && (tx.type === 'card_topup' || tx.type === 'card_spend')) ||
      (activeFilter === 'Swap'     && tx.type === 'swap');
    const matchSearch =
      search === '' ||
      tx.address.toLowerCase().includes(search.toLowerCase()) ||
      tx.coin.toLowerCase().includes(search.toLowerCase()) ||
      (tx.txHash ?? '').toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <View style={[styles.container, { backgroundColor: T.background }]}>
      <TxDetailModal tx={selectedTx} T={T} network={network} isDarkMode={isDarkMode} onClose={() => setSelectedTx(null)} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: T.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: T.text }]}>History</Text>
        <TouchableOpacity style={styles.backBtn} onPress={fetchChainTxs} activeOpacity={0.7}>
          {loadingChain
            ? <ActivityIndicator size="small" color={T.primary} />
            : <Feather name="refresh-cw" size={18} color={T.primary} />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.pageTitle, { color: T.text }]}>Transactions</Text>
        <Text style={[styles.pageSub, { color: T.textMuted }]}>
          {chainTxs.length > 0
            ? `${chainTxs.length} on-chain + ${transactions.length} local`
            : 'Tap any transaction for details'}
        </Text>

        {/* Chain error banner */}
        {chainError && (
          <TouchableOpacity
            style={[styles.errorBanner, { backgroundColor: T.pending + '15', borderColor: T.pending + '40' }]}
            onPress={fetchChainTxs}
            activeOpacity={0.8}
          >
            <Feather name="wifi-off" size={13} color={T.pending} />
            <Text style={[styles.errorBannerText, { color: T.pending }]}>
              Could not load on-chain history. Tap to retry.
            </Text>
          </TouchableOpacity>
        )}

        {/* Search */}
        <View style={[styles.searchBox, { backgroundColor: T.surface, borderColor: T.border }]}>
          <Feather name="search" size={16} color={T.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: T.text }]}
            placeholder="Search by address, coin or hash"
            placeholderTextColor={T.textDim}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x" size={16} color={T.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          <View style={styles.filterRow}>
            {FILTERS.map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.filterPill, { backgroundColor: T.surface, borderColor: T.border },
                  activeFilter === f && { backgroundColor: T.primary, borderColor: T.primary }]}
                onPress={() => setActiveFilter(f)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterText, { color: activeFilter === f ? '#FFF' : T.textMuted }]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Skeleton while loading */}
        {loadingChain && chainTxs.length === 0 ? (
          [0,1,2,3,4].map(i => <SkeletonRow key={i} T={T} />)
        ) : filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={[styles.emptyIcon, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
              <Feather name="inbox" size={28} color={T.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: T.text }]}>No transactions found</Text>
            <Text style={[styles.emptySub, { color: T.textMuted }]}>
              {search || activeFilter !== 'All'
                ? 'Try adjusting your search or filter'
                : 'Your transaction history will appear here'}
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.countText, { color: T.textMuted }]}>
              {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
            </Text>
            {filtered.map(tx => {
              const cfg     = cfgMap[tx.type] ?? { label: tx.type, color: T.primary, icon: 'activity', bg: T.primary + '18' };
              const isDebit = tx.type === 'sent' || tx.type === 'card_spend';
              return (
                <TouchableOpacity
                  key={tx.id}
                  style={[styles.txCard, { backgroundColor: T.surface, borderColor: T.border }]}
                  onPress={() => setSelectedTx(tx)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.txIconBox, { backgroundColor: cfg.bg }]}>
                    <Feather name={cfg.icon as any} size={18} color={cfg.color} />
                  </View>
                  <View style={styles.txMid}>
                    <Text style={[styles.txLabel, { color: T.text }]}>{cfg.label}</Text>
                    <Text style={[styles.txAddr, { color: T.textMuted }]} numberOfLines={1}>
                      {tx.address.length > 22 ? `${tx.address.slice(0, 10)}...${tx.address.slice(-6)}` : tx.address}
                    </Text>
                    <Text style={[styles.txDate, { color: T.textDim }]}>{tx.date}</Text>
                  </View>
                  <View style={styles.txRight}>
                    <Text style={[styles.txAmount, { color: isDebit ? T.error : T.success }]}>
                      {isDebit ? '-' : '+'}{tx.amount} {tx.coin}
                    </Text>
                    <Text style={[styles.txUsd, { color: T.textMuted }]}>${parseFloat(tx.usdValue || '0').toFixed(2)}</Text>
                    <View style={styles.statusRow}>
                      <View style={[styles.statusDot, {
                        backgroundColor: tx.status === 'success' ? T.success : tx.status === 'pending' ? T.pending : T.error,
                      }]} />
                      <Text style={[styles.statusText, {
                        color: tx.status === 'success' ? T.success : tx.status === 'pending' ? T.pending : T.error,
                      }]}>{tx.status}</Text>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={14} color={T.border} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 20 : 56, paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  navTitle: { fontSize: 18, fontWeight: '700' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  pageTitle: { fontSize: 26, fontWeight: '800', marginBottom: 4, marginTop: 16 },
  pageSub: { fontSize: 13, marginBottom: 18 },

  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 14 },
  errorBannerText: { flex: 1, fontSize: 12, fontWeight: '600' },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingHorizontal: 14, height: 48, borderWidth: 1, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 14 },

  filterRow: { flexDirection: 'row', gap: 8 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 13, fontWeight: '600' },

  countText: { fontSize: 12, fontWeight: '600', marginBottom: 10 },

  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptySub: { fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },

  txCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, marginBottom: 8, borderWidth: 1 },
  txIconBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  txMid: { flex: 1 },
  txLabel: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  txAddr: { fontSize: 11, marginBottom: 2 },
  txDate: { fontSize: 10 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  txUsd: { fontSize: 11, marginBottom: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },

  // Skeleton
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, marginBottom: 8 },
  skeletonIcon: { width: 44, height: 44, borderRadius: 22 },
  skeletonLine: { height: 13, borderRadius: 6 },
});
