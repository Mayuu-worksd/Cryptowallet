import React, { useState, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Platform, ActivityIndicator, StatusBar, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import Toast from '../components/Toast';
import { CardDesignKey, CARD_DESIGNS } from '../components/card/CardDesigns';
import CardPreview from '../components/card/CardPreview';
import NoCardState from '../components/card/NoCardState';
import CreateCardFlow from '../components/card/CreateCardFlow';
import EditCardSheet from '../components/card/EditCardSheet';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;
const CRIMSON = '#FF3B3B';
const COINS = ['ETH', 'USDT', 'BTC', 'SOL'] as const;

// ── Extracted carousel item — hooks are safe here ─────────────────────────────
function CarouselCard({
  designKey, cardNumber, holderName, expiry, frozen,
}: {
  designKey: CardDesignKey;
  cardNumber: string;
  holderName: string;
  expiry: string;
  frozen: boolean;
}) {
  return (
    <View style={{ width: SCREEN_WIDTH, paddingHorizontal: 24 }}>
      <CardPreview
        cardNumber={cardNumber}
        holderName={holderName}
        expiry={expiry}
        designKey={designKey}
        frozen={frozen}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function CardScreen({ navigation }: any) {
  const {
    cardBalance, cardFrozen, toggleFreezeCard,
    cardDetails, cardTransactions, cardCreated,
    balances, ethBalance, topupCard,
    isDarkMode, prices, network,
    createCard, updateCardDetails,
  } = useWallet();

  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const [showCreate, setShowCreate]   = useState(false);
  const [showEdit, setShowEdit]       = useState(false);
  const [showTopup, setShowTopup]     = useState(false);
  const [topupCoin, setTopupCoin]     = useState<typeof COINS[number]>('ETH');
  const [topupAmount, setTopupAmount] = useState('');
  const [loading, setLoading]         = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [toast, setToast]             = useState({
    visible: false, message: '', type: 'success' as 'success' | 'error' | 'info',
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') =>
    setToast({ visible: true, message, type });

  const availableBalance = useMemo(() =>
    topupCoin === 'ETH' ? parseFloat(ethBalance) : (balances[topupCoin] ?? 0),
    [topupCoin, ethBalance, balances]);

  const conversionRate = useMemo(() => prices[topupCoin]?.usd ?? 1, [topupCoin, prices]);

  const usdtValue = useMemo(() => {
    const amt = parseFloat(topupAmount) || 0;
    return (amt * conversionRate).toFixed(2);
  }, [topupAmount, conversionRate]);

  const handleCardCreated = (holderName: string, design: CardDesignKey) => {
    createCard(holderName, design);
    setShowCreate(false);
    showToast('Card Created Successfully ✅', 'success');
  };

  const handleTopup = async () => {
    const amt = parseFloat(topupAmount);
    if (!amt || amt <= 0)       { showToast('Enter a valid amount', 'error'); return; }
    if (amt > availableBalance) { showToast('Insufficient balance', 'error'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    const ok = topupCard(topupCoin, amt);
    setLoading(false);
    if (ok) { showToast('Funds added successfully', 'success'); setTopupAmount(''); setShowTopup(false); }
    else showToast('Top-up failed. Try again.', 'error');
  };

  // ── Full-screen create flow ────────────────────────────────────────────────
  if (showCreate) {
    return <CreateCardFlow onComplete={handleCardCreated} onCancel={() => setShowCreate(false)} />;
  }

  // ── No card state ──────────────────────────────────────────────────────────
  if (!cardCreated) {
    return (
      <View style={[styles.root, { backgroundColor: T.background }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <Toast visible={toast.visible} message={toast.message} type={toast.type}
          onHide={() => setToast(p => ({ ...p, visible: false }))} />
        <View style={styles.safeTop} />
        <NoCardState onCreatePress={() => setShowCreate(true)} isDarkMode={isDarkMode} />
      </View>
    );
  }

  // ── Card created — main view ───────────────────────────────────────────────
  const currentDesignKey = (cardDetails.design ?? 'dark') as CardDesignKey;
  const carouselDesign = CARD_DESIGNS[activeIndex]?.key ?? currentDesignKey;
  const designChanged = carouselDesign !== currentDesignKey;

  return (
    <View style={[styles.root, { backgroundColor: T.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Toast visible={toast.visible} message={toast.message} type={toast.type}
        onHide={() => setToast(p => ({ ...p, visible: false }))} />

      <EditCardSheet
        visible={showEdit}
        currentName={cardDetails.holderName}
        currentDesign={currentDesignKey}
        cardNumber={cardDetails.number}
        expiry={cardDetails.expiry}
        onSave={patch => { updateCardDetails(patch); showToast('Card updated ✅', 'success'); }}
        onClose={() => setShowEdit(false)}
      />

      <View style={styles.safeTop} />

      {/* Header */}
      <View style={styles.pageHeader}>
        <Text style={[styles.pageTitle, { color: T.text }]}>My Card</Text>
        <TouchableOpacity
          style={[styles.editPill, { backgroundColor: T.surface }]}
          onPress={() => setShowEdit(true)}
          activeOpacity={0.75}
        >
          <Feather name="edit-2" size={13} color={CRIMSON} />
          <Text style={styles.editPillText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Card carousel — horizontal ScrollView avoids nested FlatList warning */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          scrollEventThrottle={16}
          contentOffset={{ x: CARD_DESIGNS.findIndex(d => d.key === currentDesignKey) * SCREEN_WIDTH, y: 0 }}
          onMomentumScrollEnd={e => {
            setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
          }}
          style={styles.carousel}
        >
          {CARD_DESIGNS.map(item => (
            <CarouselCard
              key={item.key}
              designKey={item.key as CardDesignKey}
              cardNumber={cardDetails.number}
              holderName={cardDetails.holderName}
              expiry={cardDetails.expiry}
              frozen={cardFrozen}
            />
          ))}
        </ScrollView>

        {/* Pagination dots */}
        <View style={styles.dots}>
          {CARD_DESIGNS.map((d, i) => (
            <View
              key={d.key}
              style={[
                styles.dot,
                { backgroundColor: i === activeIndex ? CRIMSON : T.border },
                i === activeIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* Apply design button — only shows when carousel is on a different design */}
        {designChanged && (
          <TouchableOpacity
            style={[styles.applyBtn, { borderColor: CRIMSON }]}
            onPress={() => {
              updateCardDetails({ design: carouselDesign });
              showToast('Design updated ✨', 'info');
            }}
            activeOpacity={0.75}
          >
            <Feather name="check" size={14} color={CRIMSON} />
            <Text style={[styles.applyBtnText, { color: CRIMSON }]}>Apply This Design</Text>
          </TouchableOpacity>
        )}

        <View style={styles.body}>

          {/* Balance */}
          <View style={styles.balanceBlock}>
            <Text style={[styles.balLabel, { color: T.textMuted }]}>CARD BALANCE</Text>
            <View style={styles.balRow}>
              <Text style={[styles.balSign, { color: T.text }]}>$</Text>
              <Text style={[styles.balValue, { color: T.text }]}>
                {cardBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={[styles.balCurrency, { color: T.textMuted }]}>USDT</Text>
            </View>
          </View>

          {/* Network badge */}
          <View style={[styles.networkBadge, { backgroundColor: T.surface }]}>
            <View style={[styles.networkDot, {
              backgroundColor: network === 'Sepolia' ? '#F59E0B' : '#00C853',
            }]} />
            <Text style={[styles.networkText, { color: T.textMuted }]}>
              {network.toUpperCase()} · {network === 'Sepolia' ? 'TESTNET' : 'MAINNET'}
            </Text>
          </View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.primaryAction, { backgroundColor: CRIMSON }]}
              onPress={() => setShowTopup(v => !v)}
              activeOpacity={0.85}
            >
              <Feather name="plus" size={18} color="#FFF" />
              <Text style={styles.primaryActionText}>Add Funds</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryAction, { backgroundColor: T.surface }]}
              onPress={toggleFreezeCard}
              activeOpacity={0.75}
            >
              <Feather
                name={cardFrozen ? 'unlock' : 'lock'}
                size={18}
                color={cardFrozen ? '#4ADE80' : CRIMSON}
              />
              <Text style={[styles.secondaryActionText, { color: T.text }]}>
                {cardFrozen ? 'Unfreeze' : 'Freeze'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Top-up panel */}
          {showTopup && (
            <View style={[styles.panel, { backgroundColor: T.surface }]}>
              <View style={styles.panelHeader}>
                <Text style={[styles.panelTitle, { color: T.text }]}>Add Funds to Card</Text>
                <TouchableOpacity onPress={() => { setShowTopup(false); setTopupAmount(''); }}>
                  <Feather name="x" size={18} color={T.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.panelSub, { color: T.textMuted }]}>Select asset to convert</Text>

              <View style={styles.coinRow}>
                {COINS.map(c => {
                  const bal = c === 'ETH' ? parseFloat(ethBalance) : (balances[c] ?? 0);
                  const unavailable = (c === 'BTC' || c === 'SOL') && bal === 0;
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.coinTab,
                        { backgroundColor: T.surfaceLow },
                        topupCoin === c && styles.coinTabActive,
                        unavailable && { opacity: 0.35 },
                      ]}
                      onPress={() => { if (!unavailable) { setTopupCoin(c); setTopupAmount(''); } }}
                      activeOpacity={unavailable ? 1 : 0.75}
                    >
                      <Text style={[
                        styles.coinTabText,
                        { color: T.textMuted },
                        topupCoin === c && styles.coinTabTextActive,
                      ]}>{c}</Text>
                      {unavailable && (
                        <Text style={{ fontSize: 8, color: T.textDim, marginTop: 2 }}>N/A</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={[styles.inputArea, { backgroundColor: T.surfaceLow }]}>
                <View style={styles.inputHeader}>
                  <Text style={[styles.inputLabel, { color: T.textMuted }]}>
                    Balance: {availableBalance.toFixed(4)} {topupCoin}
                  </Text>
                  <TouchableOpacity onPress={() => setTopupAmount(availableBalance.toString())}>
                    <Text style={styles.maxText}>MAX</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.amtInput, { color: T.text }]}
                    placeholder="0.00"
                    placeholderTextColor={T.textDim}
                    keyboardType="decimal-pad"
                    value={topupAmount}
                    onChangeText={setTopupAmount}
                  />
                  <Text style={[styles.coinLabel, { color: T.textMuted }]}>{topupCoin}</Text>
                </View>
                <View style={[styles.divider, { borderTopColor: T.border }]} />
                <View style={styles.convRow}>
                  <Text style={[styles.convRate, { color: T.textMuted }]}>
                    1 {topupCoin} ≈ ${conversionRate.toLocaleString()}
                  </Text>
                  <Text style={[styles.receiveText, { color: T.text }]}>
                    → <Text style={{ color: '#4ADE80', fontWeight: '800' }}>${usdtValue} USDT</Text>
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.confirmBtn, (!topupAmount || loading) && { opacity: 0.5 }]}
                onPress={handleTopup}
                disabled={!topupAmount || loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={styles.confirmBtnText}>Confirm Transfer</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* Transactions */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: T.text }]}>Recent Activity</Text>
            <TouchableOpacity onPress={() => navigation.navigate('History')} activeOpacity={0.7}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.txList, { backgroundColor: T.surface }]}>
            {cardTransactions.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIcon, { backgroundColor: T.surfaceLow }]}>
                  <Feather name="activity" size={22} color={T.textDim} />
                </View>
                <Text style={[styles.emptyTitle, { color: T.text }]}>No transactions yet</Text>
                <Text style={[styles.emptyText, { color: T.textMuted }]}>
                  Add funds to start using your card
                </Text>
              </View>
            ) : (
              cardTransactions.slice(0, 10).map((tx, i) => (
                <View
                  key={tx.id}
                  style={[
                    styles.txItem,
                    i < Math.min(cardTransactions.length, 10) - 1 && {
                      borderBottomWidth: 1, borderBottomColor: T.border,
                    },
                  ]}
                >
                  <View style={[styles.txIcon, {
                    backgroundColor: tx.type === 'topup'
                      ? 'rgba(74,222,128,0.1)'
                      : 'rgba(255,59,59,0.08)',
                  }]}>
                    <Feather
                      name={tx.type === 'topup' ? 'arrow-down-left' : 'arrow-up-right'}
                      size={16}
                      color={tx.type === 'topup' ? '#4ADE80' : CRIMSON}
                    />
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={[styles.txTitle, { color: T.text }]} numberOfLines={1}>
                      {tx.label}
                    </Text>
                    <Text style={[styles.txDate, { color: T.textMuted }]}>
                      {new Date(tx.timestamp).toLocaleString([], {
                        month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <Text style={[styles.txAmt, {
                    color: tx.type === 'topup' ? '#4ADE80' : T.text,
                  }]}>
                    {tx.type === 'topup' ? '+' : '−'}${tx.amount.toFixed(2)}
                  </Text>
                </View>
              ))
            )}
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeTop: { height: Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight ?? 24) + 8 },

  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  pageTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -0.8 },
  editPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  editPillText: { color: CRIMSON, fontSize: 13, fontWeight: '700' },

  scroll: { paddingBottom: 110 },

  carousel: { height: (CARD_WIDTH) / 1.586 + 48 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 12 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { width: 20, borderRadius: 3 },

  applyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'center', borderWidth: 1,
    paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 20, marginBottom: 8,
  },
  applyBtnText: { fontSize: 13, fontWeight: '800' },

  body: { paddingHorizontal: 20, marginTop: 16 },

  balanceBlock: { alignItems: 'center', marginBottom: 16 },
  balLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  balRow: { flexDirection: 'row', alignItems: 'baseline' },
  balSign: { fontSize: 22, fontWeight: '700', marginRight: 2 },
  balValue: { fontSize: 48, fontWeight: '900', letterSpacing: -1.5 },
  balCurrency: { fontSize: 15, fontWeight: '700', marginLeft: 8 },

  networkBadge: {
    alignSelf: 'center', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 24,
  },
  networkDot: { width: 6, height: 6, borderRadius: 3, marginRight: 7 },
  networkText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },

  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  primaryAction: {
    flex: 1, height: 54, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  primaryActionText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  secondaryAction: {
    flex: 1, height: 54, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', gap: 5,
  },
  secondaryActionText: { fontSize: 11, fontWeight: '700' },

  panel: { borderRadius: 20, padding: 20, marginBottom: 24 },
  panelHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  panelTitle: { fontSize: 16, fontWeight: '800' },
  panelSub: { fontSize: 13, marginBottom: 14 },
  coinRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  coinTab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  coinTabActive: { backgroundColor: CRIMSON },
  coinTabText: { fontSize: 12, fontWeight: '800' },
  coinTabTextActive: { color: '#FFF' },
  inputArea: { borderRadius: 14, padding: 16, marginBottom: 14 },
  inputHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  inputLabel: { fontSize: 12, fontWeight: '600' },
  maxText: { fontSize: 12, fontWeight: '900', color: CRIMSON },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  amtInput: { flex: 1, fontSize: 26, fontWeight: '800', paddingVertical: 4 },
  coinLabel: { fontSize: 14, fontWeight: '700', marginLeft: 8 },
  divider: { borderTopWidth: 1, marginVertical: 12 },
  convRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convRate: { fontSize: 12, fontWeight: '500' },
  receiveText: { fontSize: 13, fontWeight: '600' },
  confirmBtn: {
    backgroundColor: CRIMSON, height: 52,
    borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  confirmBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  seeAll: { color: CRIMSON, fontSize: 13, fontWeight: '700' },

  txList: { borderRadius: 18, overflow: 'hidden', marginBottom: 24 },
  txItem: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  txIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1, marginLeft: 14 },
  txTitle: { fontSize: 14, fontWeight: '700' },
  txDate: { fontSize: 11, marginTop: 2, fontWeight: '500' },
  txAmt: { fontSize: 15, fontWeight: '800' },

  emptyState: { padding: 36, alignItems: 'center', gap: 10 },
  emptyIcon: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700' },
  emptyText: { fontSize: 13, fontWeight: '500' },
});
