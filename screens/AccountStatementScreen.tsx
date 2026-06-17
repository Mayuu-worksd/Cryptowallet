import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator, StatusBar, Modal, Animated
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { Theme, Fonts } from '../constants';
import Toast from '../components/Toast';
import { fiatRequestService, FiatCryptoRequest, LedgerEntry } from '../services/supabaseService';
import { haptics } from '../utils/haptics';

type Tab = 'ledger' | 'requests';

const DATE_FILTERS = ['All Time', 'Today', 'Last 7 Days', 'Last 30 Days'] as const;
type DateFilter = typeof DATE_FILTERS[number];

export default function AccountStatementScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { isDarkMode, walletAddress, formatFiat } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const [activeTab, setActiveTab] = useState<Tab>('ledger');
  const [requests, setRequests] = useState<FiatCryptoRequest[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters state
  const [dateFilter, setDateFilter] = useState<DateFilter>('All Time');
  const [currencyFilter, setCurrencyFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modal selector states
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ visible: true, message, type });
  };

  const loadData = useCallback(async (isRefresh = false) => {
    if (!walletAddress) { setLoading(false); return; }
    if (isRefresh) setRefreshing(true);
    else           setLoading(true);

    try {
      const [reqData, ledData] = await Promise.all([
        fiatRequestService.getRequests(walletAddress),
        fiatRequestService.getLedgerEntries(walletAddress)
      ]);
      setRequests(reqData);
      setLedger(ledData);
    } catch (err: any) {
      showToast(err.message || 'Failed to load statements data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derive unique currencies present in the logs
  const currencies = useMemo(() => {
    const list = new Set<string>();
    requests.forEach(r => {
      list.add(r.fiat_currency);
      list.add(r.crypto_asset);
    });
    ledger.forEach(l => list.add(l.asset));
    return ['All', ...Array.from(list)];
  }, [requests, ledger]);

  // Date check helper
  const isWithinDate = useCallback((dateStr: string, filter: DateFilter) => {
    if (filter === 'All Time') return true;
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (filter === 'Today') {
      return date.toDateString() === now.toDateString();
    }
    if (filter === 'Last 7 Days') {
      return diffDays <= 7;
    }
    if (filter === 'Last 30 Days') {
      return diffDays <= 30;
    }
    return true;
  }, []);

  // Filtered Ledger Entries
  const filteredLedger = useMemo(() => {
    return ledger.filter(item => {
      // Currency filter
      if (currencyFilter !== 'All' && item.asset !== currencyFilter) return false;
      // Date filter
      if (!isWithinDate(item.created_at, dateFilter)) return false;
      // Status filter
      if (statusFilter !== 'All' && item.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      return true;
    });
  }, [ledger, currencyFilter, dateFilter, statusFilter, isWithinDate]);

  // Filtered Requests
  const filteredRequests = useMemo(() => {
    return requests.filter(item => {
      // Currency filter
      if (currencyFilter !== 'All' && item.fiat_currency !== currencyFilter && item.crypto_asset !== currencyFilter) return false;
      // Date filter
      if (!isWithinDate(item.created_at, dateFilter)) return false;
      // Status filter
      if (statusFilter !== 'All' && item.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      return true;
    });
  }, [requests, currencyFilter, dateFilter, statusFilter, isWithinDate]);

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'completed': return T.success;
      case 'approved': return T.primary;
      case 'under_review': return '#F59E0B'; // Amber
      case 'pending': return T.pending;
      case 'rejected':
      case 'failed': return T.error;
      default: return T.textMuted;
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        isDarkMode={isDarkMode}
        onHide={() => setToast(p => ({ ...p, visible: false }))}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: T.border }]}>
        <TouchableOpacity
          onPress={() => { haptics.selection(); navigation.goBack(); }}
          style={[styles.backBtn, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
        >
          <Feather name="chevron-left" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>Statement Ledger</Text>
        
        <TouchableOpacity
          onPress={() => { haptics.selection(); setFilterModalOpen(true); }}
          style={[styles.filterBtn, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
        >
          <Feather name="sliders" size={18} color={T.text} />
        </TouchableOpacity>
      </View>

      {/* Segmented control */}
      <View style={[styles.segmentContainer, { borderBottomColor: T.border }]}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'ledger' && { borderBottomColor: T.primary }]}
          onPress={() => { haptics.selection(); setActiveTab('ledger'); }}
        >
          <Text style={[styles.segmentText, { color: activeTab === 'ledger' ? T.primary : T.textMuted }]}>
            Ledger Entries
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'requests' && { borderBottomColor: T.primary }]}
          onPress={() => { haptics.selection(); setActiveTab('requests'); }}
        >
          <Text style={[styles.segmentText, { color: activeTab === 'requests' ? T.primary : T.textMuted }]}>
            Fiat Tickets
          </Text>
        </TouchableOpacity>
      </View>

      {/* Active filters display banner */}
      {(currencyFilter !== 'All' || dateFilter !== 'All Time' || statusFilter !== 'All') && (
        <View style={[styles.activeFiltersBanner, { backgroundColor: T.surfaceLow, borderBottomColor: T.border }]}>
          <Text style={[styles.activeFiltersText, { color: T.textMuted }]}>
            Filters: {[
              currencyFilter !== 'All' ? `Currency: ${currencyFilter}` : null,
              dateFilter !== 'All Time' ? `Time: ${dateFilter}` : null,
              statusFilter !== 'All' ? `Status: ${statusFilter}` : null
            ].filter(Boolean).join(' · ')}
          </Text>
          <TouchableOpacity onPress={() => { haptics.selection(); setCurrencyFilter('All'); setDateFilter('All Time'); setStatusFilter('All'); }}>
            <Feather name="x-circle" size={15} color={T.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Main content scroll */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={T.primary} colors={[T.primary]} />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color={T.primary} style={{ marginTop: 64 }} />
        ) : activeTab === 'ledger' ? (
          // Ledger Tab
          filteredLedger.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Feather name="book-open" size={48} color={T.textDim} style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyTitle, { color: T.text }]}>No Ledger Entries</Text>
              <Text style={[styles.emptyDesc, { color: T.textMuted }]}>
                Credit or debit items generated by your fiat settlements will appear here.
              </Text>
            </View>
          ) : (
            filteredLedger.map((item) => {
              const isCredit = item.credit_entry > 0;
              const sign = isCredit ? '+' : '-';
              const displayAmt = isCredit ? item.credit_entry : item.debit_entry;
              const amtColor = isCredit ? T.success : T.error;

              return (
                <View key={item.id} style={[styles.receiptCard, { backgroundColor: T.surface, borderColor: T.border }]}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <View style={[styles.circleIcon, { backgroundColor: isCredit ? T.success + '12' : T.error + '12' }]}>
                        <Feather name={isCredit ? 'arrow-down-left' : 'arrow-up-right'} size={18} color={amtColor} />
                      </View>
                      <View>
                        <Text style={[styles.cardTitle, { color: T.text }]}>
                          {isCredit ? 'Credit Entry' : 'Debit Entry'}
                        </Text>
                        <Text style={[styles.cardSub, { color: T.textMuted }]}>
                          Ref: {item.ticket_id}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.cardAmount, { color: amtColor }]}>
                      {sign}{displayAmt.toFixed(item.asset === 'ETH' ? 6 : item.asset === 'BTC' ? 6 : 2)} {item.asset}
                    </Text>
                  </View>

                  <View style={[styles.dashedDivider, { borderBottomColor: T.border }]} />

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: T.textMuted }]}>TIMESTAMP</Text>
                    <Text style={[styles.detailValue, { color: T.text }]}>{formatDate(item.created_at)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: T.textMuted }]}>LEDGER STATUS</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={[styles.statusDot, { backgroundColor: getStatusBadgeColor(item.status) }]} />
                      <Text style={[styles.statusText, { color: getStatusBadgeColor(item.status) }]}>
                        {item.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )
        ) : (
          // Requests Tab
          filteredRequests.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Feather name="file-text" size={48} color={T.textDim} style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyTitle, { color: T.text }]}>No Fiat Requests</Text>
              <Text style={[styles.emptyDesc, { color: T.textMuted }]}>
                Deposit or withdrawal tickets submitted will show here.
              </Text>
            </View>
          ) : (
            filteredRequests.map((item) => {
              const isDeposit = item.type === 'deposit';
              const badgeColor = getStatusBadgeColor(item.status);

              return (
                <View key={item.id} style={[styles.receiptCard, { backgroundColor: T.surface, borderColor: T.border }]}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <View style={[styles.circleIcon, { backgroundColor: T.primary + '12' }]}>
                        <Feather name={isDeposit ? 'plus-circle' : 'minus-circle'} size={18} color={T.primary} />
                      </View>
                      <View>
                        <Text style={[styles.cardTitle, { color: T.text }]}>
                          {isDeposit ? 'Deposit Request' : 'Withdrawal Request'}
                        </Text>
                        <Text style={[styles.cardSub, { color: T.primary }]}>
                          {item.ticket_id}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.cardHeaderRight}>
                      <Text style={[styles.cardAmount, { color: T.text }]}>
                        {item.amount.toFixed(2)} {isDeposit ? item.fiat_currency : item.crypto_asset}
                      </Text>
                      {item.crypto_amount && (
                        <Text style={[styles.settledText, { color: T.success }]}>
                          Credit: {item.crypto_amount} {item.crypto_asset}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={[styles.dashedDivider, { borderBottomColor: T.border }]} />

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: T.textMuted }]}>CREATED ON</Text>
                    <Text style={[styles.detailValue, { color: T.text }]}>{formatDate(item.created_at)}</Text>
                  </View>
                  
                  {isDeposit ? (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: T.textMuted }]}>RECEIVE ASSET</Text>
                      <Text style={[styles.detailValue, { color: T.text }]}>{item.crypto_asset}</Text>
                    </View>
                  ) : (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: T.textMuted }]}>PAYOUT CURRENCY</Text>
                      <Text style={[styles.detailValue, { color: T.text }]}>{item.fiat_currency}</Text>
                    </View>
                  )}

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: T.textMuted }]}>STATUS</Text>
                    <View style={[styles.statusBadge, { backgroundColor: badgeColor + '18', borderColor: badgeColor }]}>
                      <Text style={[styles.statusBadgeText, { color: badgeColor }]}>
                        {item.status.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {item.admin_notes && (
                    <View style={[styles.notesBox, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
                      <Text style={[styles.notesLabel, { color: T.textMuted }]}>ADMIN COMMENTS:</Text>
                      <Text style={[styles.notesText, { color: T.text }]}>{item.admin_notes}</Text>
                    </View>
                  )}
                </View>
              );
            })
          ))}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Filter Modal */}
      <Modal visible={filterModalOpen} transparent animationType="slide" onRequestClose={() => setFilterModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: T.surface, borderColor: T.border }]}>
            <View style={[styles.modalHandle, { backgroundColor: T.border }]} />
            
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: T.text }]}>Filter Statement</Text>
              <TouchableOpacity onPress={() => setFilterModalOpen(false)}>
                <Feather name="x" size={20} color={T.text} />
              </TouchableOpacity>
            </View>

            {/* Date Filters */}
            <Text style={[styles.modalSectionTitle, { color: T.text }]}>Time Period</Text>
            <View style={styles.modalGrid}>
              {DATE_FILTERS.map(f => {
                const selected = dateFilter === f;
                return (
                  <TouchableOpacity
                    key={f}
                    onPress={() => setDateFilter(f)}
                    style={[styles.modalGridItem, {
                      borderColor: selected ? T.primary : T.border,
                      backgroundColor: selected ? T.primary + '12' : 'transparent'
                    }]}
                  >
                    <Text style={[styles.modalGridText, { color: selected ? T.primary : T.text }]}>{f}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Currency Filters */}
            <Text style={[styles.modalSectionTitle, { color: T.text }]}>Currency / Asset</Text>
            <View style={styles.modalGrid}>
              {currencies.slice(0, 8).map(c => {
                const selected = currencyFilter === c;
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setCurrencyFilter(c)}
                    style={[styles.modalGridItem, {
                      borderColor: selected ? T.primary : T.border,
                      backgroundColor: selected ? T.primary + '12' : 'transparent'
                    }]}
                  >
                    <Text style={[styles.modalGridText, { color: selected ? T.primary : T.text }]}>{c}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Status Filters */}
            <Text style={[styles.modalSectionTitle, { color: T.text }]}>Review Status</Text>
            <View style={styles.modalGrid}>
              {['All', 'Pending', 'Under_Review', 'Completed', 'Rejected'].map(s => {
                const selected = statusFilter.toLowerCase() === s.toLowerCase();
                const display = s.replace('_', ' ');
                return (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setStatusFilter(s)}
                    style={[styles.modalGridItem, {
                      borderColor: selected ? T.primary : T.border,
                      backgroundColor: selected ? T.primary + '12' : 'transparent'
                    }]}
                  >
                    <Text style={[styles.modalGridText, { color: selected ? T.primary : T.text }]}>{display}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.btnApply, { backgroundColor: T.text }]}
              onPress={() => { haptics.selection(); setFilterModalOpen(false); }}
            >
              <Text style={[styles.btnApplyText, { color: T.background }]}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1
  },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  filterBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  headerTitle: { fontSize: 18, fontFamily: Fonts.extraBold },
  segmentContainer: { flexDirection: 'row', borderBottomWidth: 1 },
  segmentBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  segmentText: { fontSize: 13, fontFamily: Fonts.extraBold },
  activeFiltersBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8, borderBottomWidth: 1 },
  activeFiltersText: { fontSize: 11, fontFamily: Fonts.bold },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  emptyWrap: { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontFamily: Fonts.extraBold, marginBottom: 6 },
  emptyDesc: { fontSize: 12, fontFamily: Fonts.medium, textAlign: 'center', lineHeight: 18 },
  receiptCard: { borderRadius: 16, borderWidth: 1.5, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  cardHeaderRight: { alignItems: 'flex-end' },
  circleIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 13, fontFamily: Fonts.extraBold },
  cardSub: { fontSize: 11, fontFamily: Fonts.medium },
  cardAmount: { fontSize: 15, fontFamily: Fonts.extraBold },
  settledText: { fontSize: 10, fontFamily: Fonts.bold, marginTop: 2 },
  dashedDivider: { borderBottomWidth: 1, borderStyle: 'dashed', marginVertical: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
  detailLabel: { fontSize: 9, fontFamily: Fonts.extraBold, letterSpacing: 0.5 },
  detailValue: { fontSize: 12, fontFamily: Fonts.bold },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontFamily: Fonts.extraBold },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  statusBadgeText: { fontSize: 9, fontFamily: Fonts.extraBold },
  notesBox: { padding: 10, borderRadius: 8, borderWidth: 1, marginTop: 12 },
  notesLabel: { fontSize: 8, fontFamily: Fonts.extraBold, letterSpacing: 0.5, marginBottom: 2 },
  notesText: { fontSize: 11, fontFamily: Fonts.medium, lineHeight: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1.5, borderBottomWidth: 0, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontFamily: Fonts.extraBold },
  modalSectionTitle: { fontSize: 13, fontFamily: Fonts.extraBold, marginTop: 14, marginBottom: 10 },
  modalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  modalGridItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  modalGridText: { fontSize: 12, fontFamily: Fonts.bold },
  btnApply: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginTop: 32 },
  btnApplyText: { fontSize: 15, fontFamily: Fonts.extraBold },
});
