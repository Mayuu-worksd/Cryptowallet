import React, { useState, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Platform, ActivityIndicator, StatusBar, Dimensions, SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useWallet, useMarket } from '../store/WalletContext';
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
const COINS = ['ETH', 'USDT'] as const;

// ── Extracted carousel item ──────────────────────────────────────────────────
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
    balances, ethBalance, topupCard, spendCard,
    isDarkMode, network,
    createCard, updateCardDetails,
  } = useWallet();
  const { prices } = useMarket();

  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit]     = useState(false);
  const [showTopup, setShowTopup]   = useState(false);
  const [showSpend, setShowSpend]   = useState(false);
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [spendAmount, setSpendAmount] = useState('');
  const [spendLabel, setSpendLabel]   = useState('');
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

  const handleSpend = async () => {
    const amt = parseFloat(spendAmount);
    if (!amt || amt <= 0)    { showToast('Enter a valid amount', 'error'); return; }
    if (cardFrozen)          { showToast('Card is frozen. Unfreeze to spend.', 'error'); return; }
    if (amt > cardBalance)   { showToast('Insufficient card balance', 'error'); return; }
    const label = spendLabel.trim() || 'Online Purchase';
    setLoading(true);
    await new Promise(r => setTimeout(r, 900));
    const ok = spendCard(amt, label);
    setLoading(false);
    if (ok) { 
      showToast(`Payment of $${amt.toFixed(2)} successful ✅`, 'success'); 
      setSpendAmount(''); 
      setSpendLabel(''); 
      setShowSpend(false); 
    }
    else showToast('Payment failed. Try again.', 'error');
  };

  if (showCreate) {
    return <CreateCardFlow onComplete={handleCardCreated} onCancel={() => setShowCreate(false)} />;
  }

  if (!cardCreated) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: T.background }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <Toast visible={toast.visible} message={toast.message} type={toast.type}
          onHide={() => setToast(p => ({ ...p, visible: false }))} />
        <NoCardState onCreatePress={() => setShowCreate(true)} isDarkMode={isDarkMode} />
      </SafeAreaView>
    );
  }

  const currentDesignKey = (cardDetails.design ?? 'dark') as CardDesignKey;
  const carouselDesign = CARD_DESIGNS[activeIndex]?.key ?? currentDesignKey;
  const designChanged = carouselDesign !== currentDesignKey;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: T.background }]}>
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

      {/* Header */}
      <View style={styles.pageHeader}>
        <Text style={[styles.pageTitle, { color: T.text }]}>Vault Card</Text>
        <TouchableOpacity
          style={[styles.editPill, { backgroundColor: T.surface }]}
          onPress={() => setShowEdit(true)}
          activeOpacity={0.75}
        >
          <Feather name="settings" size={14} color={CRIMSON} />
          <Text style={[styles.editPillText, { color: T.text }]}>Settings</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Card carousel */}
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
            <Text style={[styles.applyBtnText, { color: CRIMSON }]}>Apply New Skin</Text>
          </TouchableOpacity>
        )}

        <View style={styles.body}>

          {/* New Balance Component */}
          <LinearGradient
            colors={[T.surfaceHigh, T.surface]}
            style={styles.premiumBalanceCard}
          >
            <View style={styles.balCardHeader}>
              <Text style={[styles.balCardLabel, { color: T.textDim }]}>AVAILABLE TO SPEND</Text>
              <TouchableOpacity onPress={() => setBalanceHidden(v => !v)} activeOpacity={0.7}>
                <Feather name={balanceHidden ? 'eye-off' : 'eye'} size={16} color={T.textDim} />
              </TouchableOpacity>
            </View>
            <View style={styles.balCardMain}>
              <Text style={[styles.currencySymbol, { color: T.text }]}>$</Text>
              <Text style={[styles.mainBalText, { color: T.text }]}>
                {balanceHidden ? '••••••' : cardBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={[styles.usdtTag, { color: T.textMuted }]}>USDT</Text>
            </View>
            <View style={[styles.cardDivider, { backgroundColor: T.border }]} />
            <View style={styles.networkInfoRow}>
              <View style={[styles.statusIndicator, { backgroundColor: network === 'Sepolia' ? '#F59E0B' : '#00C853' }]} />
              <Text style={[styles.networkLabelText, { color: T.textMuted }]}>
                {network.toUpperCase()} · LIVE PROTECTION ACTIVE
              </Text>
            </View>
          </LinearGradient>

          {/* Action buttons - REDESIGNED */}
          <View style={styles.mainActionsContainer}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: CRIMSON }]}
              onPress={() => { setShowTopup(v => !v); setShowSpend(false); }}
              activeOpacity={0.9}
            >
              <Feather name="plus-circle" size={20} color="#FFF" />
              <Text style={styles.actionBtnText}>Add Cash</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: T.surfaceLow, borderWidth: 1, borderColor: T.border }]}
              onPress={() => { setShowSpend(v => !v); setShowTopup(false); }}
              activeOpacity={0.8}
            >
              <Feather name="shopping-bag" size={20} color={T.text} />
              <Text style={[styles.actionBtnText, { color: T.text }]}>Pay Now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.smallActionBtn, { backgroundColor: T.surfaceHigh }]}
              onPress={toggleFreezeCard}
              activeOpacity={0.7}
            >
              <View style={[styles.freezeCircle, { backgroundColor: cardFrozen ? 'rgba(0,196,83,0.1)' : 'rgba(255,59,59,0.1)' }]}>
                <Feather
                  name={cardFrozen ? 'unlock' : 'lock'}
                  size={16}
                  color={cardFrozen ? '#00C853' : CRIMSON}
                />
              </View>
            </TouchableOpacity>
          </View>

          {/* Panels */}
          {showTopup && (
            <View style={[styles.panel, { backgroundColor: T.surface, borderColor: T.border, borderWidth: 1 }]}>
              <View style={styles.panelHeader}>
                <Text style={[styles.panelTitle, { color: T.text }]}>Fund Your Card</Text>
                <TouchableOpacity onPress={() => { setShowTopup(false); setTopupAmount(''); }}>
                   <View style={[styles.closeIconBox, { backgroundColor: T.surfaceLow }]}>
                    <Feather name="x" size={14} color={T.textMuted} />
                   </View>
                </TouchableOpacity>
              </View>

              <View style={styles.coinSelector}>
                {COINS.map(c => {
                  if (c === 'BTC' || c === 'SOL') return null;
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.coinPill,
                        { backgroundColor: T.surfaceLow },
                        topupCoin === c && { backgroundColor: CRIMSON },
                      ]}
                      onPress={() => { setTopupCoin(c); setTopupAmount(''); }}
                      activeOpacity={0.75}
                    >
                      <Text style={[
                        styles.coinPillText,
                        { color: T.textDim },
                        topupCoin === c && { color: '#FFF' },
                      ]}>{c}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={[styles.amountInputBox, { backgroundColor: T.surfaceLow }]}>
                <View style={styles.inputTopRow}>
                  <Text style={[styles.availLabel, { color: T.textDim }]}>Available: {parseFloat(ethBalance).toFixed(4)} {topupCoin}</Text>
                  <TouchableOpacity onPress={() => setTopupAmount(ethBalance)}>
                    <Text style={[styles.maxLabel, { color: CRIMSON }]}>MAX</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.inputMainRow}>
                  <TextInput
                    style={[styles.hugeInput, { color: T.text }]}
                    placeholder="0.00"
                    placeholderTextColor={T.textDim}
                    keyboardType="decimal-pad"
                    value={topupAmount}
                    onChangeText={setTopupAmount}
                  />
                  <Text style={[styles.unitText, { color: T.textMuted }]}>{topupCoin}</Text>
                </View>
                <View style={[styles.innerDivider, { backgroundColor: T.border }]} />
                <View style={styles.summaryRow}>
                   <Text style={[styles.convInfo, { color: T.textDim }]}>1 {topupCoin} = ${conversionRate.toLocaleString()}</Text>
                   <Text style={[styles.receiveInfo, { color: T.text }]}>Get <Text style={{ color: '#00C853', fontWeight: '900' }}>${usdtValue}</Text></Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.panelConfirmBtn, (!topupAmount || loading) && { opacity: 0.6 }]}
                onPress={handleTopup}
                disabled={!topupAmount || loading}
                activeOpacity={0.8}
              >
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.panelConfirmText}>Deposit Funds</Text>}
              </TouchableOpacity>
            </View>
          )}

          {showSpend && (
            <View style={[styles.panel, { backgroundColor: T.surface, borderColor: T.border, borderWidth: 1 }]}>
              <View style={styles.panelHeader}>
                <Text style={[styles.panelTitle, { color: T.text }]}>New Payment</Text>
                <TouchableOpacity onPress={() => { setShowSpend(false); setSpendAmount(''); setSpendLabel(''); }}>
                  <View style={[styles.closeIconBox, { backgroundColor: T.surfaceLow }]}>
                    <Feather name="x" size={14} color={T.textMuted} />
                   </View>
                </TouchableOpacity>
              </View>
              
              <View style={[styles.amountInputBox, { backgroundColor: T.surfaceLow, marginBottom: 16 }]}>
                <Text style={[styles.availLabel, { color: T.textDim, marginBottom: 8 }]}>LIMIT: ${cardBalance.toFixed(2)} USDT</Text>
                <TextInput
                  style={[styles.hugeInput, { color: T.text }]}
                  placeholder="$0.00"
                  placeholderTextColor={T.textDim}
                  keyboardType="decimal-pad"
                  value={spendAmount}
                  onChangeText={setSpendAmount}
                />
              </View>
              
              <View style={[styles.miniInputBox, { backgroundColor: T.surfaceLow }]}>
                 <Feather name="tag" size={14} color={T.textDim} style={{marginRight: 10}} />
                 <TextInput
                  style={[styles.simpleInput, { color: T.text }]}
                  placeholder="Merchant name (optional)"
                  placeholderTextColor={T.textDim}
                  value={spendLabel}
                  onChangeText={setSpendLabel}
                />
              </View>

              <TouchableOpacity
                style={[styles.panelConfirmBtn, { backgroundColor: T.text }, (!spendAmount || loading) && { opacity: 0.6 }]}
                onPress={handleSpend}
                disabled={!spendAmount || loading}
                activeOpacity={0.8}
              >
                {loading 
                  ? <ActivityIndicator color={T.background} /> 
                  : <Text style={[styles.panelConfirmText, { color: T.background }]}>Confirm Payment</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* Transactions */}
          <View style={styles.transactionsHeader}>
            <Text style={[styles.transactionsTitle, { color: T.text }]}>Transaction History</Text>
            <TouchableOpacity onPress={() => navigation.navigate('History')}>
              <Text style={[styles.viewAllText, { color: CRIMSON }]}>View all</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.transactionBox, { backgroundColor: T.surface }]}>
            {cardTransactions.length === 0 ? (
              <View style={styles.emptyActivity}>
                <Feather name="inbox" size={32} color={T.textDim} />
                <Text style={[styles.emptyTextTitle, { color: T.textDim }]}>No Activity Yet</Text>
              </View>
            ) : (
              cardTransactions.slice(0, 8).map((tx, i) => (
                <View
                  key={tx.id}
                  style={[
                    styles.txRow,
                    i < Math.min(cardTransactions.length, 8) - 1 && {
                      borderBottomWidth: 1, borderBottomColor: T.border,
                    },
                  ]}
                >
                  <View style={[styles.typeIconBox, {
                    backgroundColor: tx.type === 'topup' ? 'rgba(0,200,83,0.1)' : 'rgba(255,255,255,0.05)',
                  }]}>
                    <Feather
                      name={tx.type === 'topup' ? 'download' : 'shopping-bag'}
                      size={16}
                      color={tx.type === 'topup' ? '#00C853' : T.text}
                    />
                  </View>
                  <View style={styles.txMainInfo}>
                    <Text style={[styles.txLabel, { color: T.text }]} numberOfLines={1}>{tx.label}</Text>
                    <Text style={[styles.txSubDate, { color: T.textDim }]}>
                      {new Date(tx.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })} · {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Text style={[styles.txAmountText, {
                    color: tx.type === 'topup' ? '#00C853' : T.text,
                  }]}>
                    {tx.type === 'topup' ? '+' : '−'}${tx.amount.toFixed(2)}
                  </Text>
                </View>
              ))
            )}
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 12,
    paddingBottom: 16,
  },
  pageTitle: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  editPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24,
  },
  editPillText: { fontSize: 13, fontWeight: '800' },

  scroll: { paddingBottom: 120 },
  carousel: { height: (SCREEN_WIDTH - 48) / 1.586 + 48 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 12 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { width: 22, borderRadius: 3 },

  applyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'center', borderWidth: 1.5,
    paddingHorizontal: 20, paddingVertical: 9,
    borderRadius: 22, marginBottom: 12,
  },
  applyBtnText: { fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },

  body: { paddingHorizontal: 20 },

  premiumBalanceCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
  },
  balCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  balCardLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  balCardMain: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 16 },
  currencySymbol: { fontSize: 24, fontWeight: '700', marginRight: 4, opacity: 0.6 },
  mainBalText: { fontSize: 48, fontWeight: '900', letterSpacing: -2 },
  usdtTag: { fontSize: 16, fontWeight: '800', marginLeft: 8 },
  cardDivider: { height: 1, width: '100%', marginBottom: 16, opacity: 0.2 },
  networkInfoRow: { flexDirection: 'row', alignItems: 'center' },
  statusIndicator: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  networkLabelText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  mainActionsContainer: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  actionBtn: { 
    flex: 2, height: 58, borderRadius: 18, 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    overflow: 'hidden'
  },
  actionBtnText: { fontWeight: '900', fontSize: 16, color: '#FFF' },
  smallActionBtn: {
    width: 58, height: 58, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  freezeCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  panel: { borderRadius: 26, padding: 20, marginBottom: 24 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  panelTitle: { fontSize: 18, fontWeight: '900' },
  closeIconBox: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  coinSelector: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  coinPill: { flex: 1, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  coinPillText: { fontSize: 13, fontWeight: '800' },

  amountInputBox: { borderRadius: 22, padding: 20 },
  inputTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  availLabel: { fontSize: 11, fontWeight: '700' },
  maxLabel: { fontSize: 11, fontWeight: '900' },
  inputMainRow: { flexDirection: 'row', alignItems: 'center' },
  hugeInput: { flex: 1, fontSize: 32, fontWeight: '900', paddingVertical: 4 },
  unitText: { fontSize: 16, fontWeight: '800', marginLeft: 10 },
  innerDivider: { height: 1, marginVertical: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  convInfo: { fontSize: 12, fontWeight: '600' },
  receiveInfo: { fontSize: 13, fontWeight: '700' },

  miniInputBox: { borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  simpleInput: { flex: 1, fontSize: 15, fontWeight: '700' },
  
  panelConfirmBtn: { 
    backgroundColor: '#FF3B3B', height: 60, 
    borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 12
  },
  panelConfirmText: { color: '#FFF', fontWeight: '900', fontSize: 16 },

  transactionsHeader: { 
    flexDirection: 'row', justifyContent: 'space-between', 
    alignItems: 'center', marginBottom: 16, marginTop: 12 
  },
  transactionsTitle: { fontSize: 18, fontWeight: '900' },
  viewAllText: { fontSize: 13, fontWeight: '800' },

  transactionBox: { borderRadius: 24, overflow: 'hidden', padding: 4 },
  txRow: { flexDirection: 'row', alignItems: 'center', padding: 16, height: 72 },
  typeIconBox: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  txMainInfo: { flex: 1, marginLeft: 14 },
  txLabel: { fontSize: 15, fontWeight: '800' },
  txSubDate: { fontSize: 11, fontWeight: '600', marginTop: 3 },
  txAmountText: { fontSize: 16, fontWeight: '900' },
  emptyActivity: { padding: 48, alignItems: 'center', gap: 12 },
  emptyTextTitle: { fontSize: 14, fontWeight: '700' },
});
