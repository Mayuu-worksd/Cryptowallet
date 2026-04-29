import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Theme } from '../constants';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Platform, ActivityIndicator, StatusBar, Dimensions, SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useWallet, useMarket } from '../store/WalletContext';
import Toast from '../components/Toast';
import { CardDesignKey, CARD_DESIGNS } from '../components/card/CardDesigns';
import CardPreview from '../components/card/CardPreview';
import NoCardState from '../components/card/NoCardState';
import CreateCardFlow from '../components/card/CreateCardFlow';
import EditCardSheet from '../components/card/EditCardSheet';
import { cardService } from '../services/cardService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;
const CRIMSON = '#FF3B3B';
const COINS = ['ETH', 'USDT'] as const;
const ICONS = ['🛍️','🍔','☕','🎬','✈️','🏥','🎮','🏠','⚡','💊','📦','🎵'];

type CustomMerchant = { name: string; amount: string; icon: string };

// ── Extracted carousel item ──────────────────────────────────────────────────
function CarouselCard({
  designKey, cardNumber, holderName, expiry, cvv, frozen,
}: {
  designKey: CardDesignKey;
  cardNumber: string;
  holderName: string;
  expiry: string;
  cvv: string;
  frozen: boolean;
}) {
  return (
    <View style={{ width: SCREEN_WIDTH, paddingHorizontal: 24 }}>
      <CardPreview
        cardNumber={cardNumber}
        holderName={holderName}
        expiry={expiry}
        cvv={cvv}
        designKey={designKey}
        frozen={frozen}
      />
    </View>
  );
}



// ─────────────────────────────────────────────────────────────────────────────
export default function CardScreen({ navigation, route }: any) {
  const {
    cardFrozen, toggleFreezeCard,
    cardDetails, cardTransactions, cardCreated,
    balances, ethBalance, spendCard, topupCard, cardBalance,
    isDarkMode, network,
    createCard, updateCardDetails, kycStatus,
  } = useWallet();
  const { prices } = useMarket();

  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const [showCreate, setShowCreate]   = useState(false);
  const [showEdit, setShowEdit]       = useState(false);
  const [showSpend, setShowSpend]     = useState(false);
  const [showTopup, setShowTopup]     = useState(false);
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [merchant, setMerchant]       = useState<CustomMerchant>({ name: '', amount: '', icon: '🛍️' });
  const [topupToken, setTopupToken]   = useState<typeof COINS[number]>('ETH');
  const [topupAmount, setTopupAmount] = useState('');
  const [loading, setLoading]         = useState(false);
  const [topupLoading, setTopupLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [toast, setToast]             = useState({
    visible: false, message: '', type: 'success' as 'success' | 'error' | 'info',
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') =>
    setToast({ visible: true, message, type });

  // Pre-fill form when returning from QR scan
  useEffect(() => {
    if (!route?.params?.qrMerchant) return;
    setMerchant(route.params.qrMerchant);
    setShowSpend(true);
    navigation.setParams({ qrMerchant: undefined });
  }, [route?.params?.qrMerchant]);

  const topupTokenBalance = useMemo(() =>
    topupToken === 'ETH' ? parseFloat(ethBalance) : (balances[topupToken] ?? 0),
    [topupToken, ethBalance, balances]);

  const topupRate = useMemo(() => prices[topupToken]?.usd ?? 1, [topupToken, prices]);

  const topupUSD = useMemo(() => {
    const amt = parseFloat(topupAmount);
    return isNaN(amt) ? 0 : +(amt * topupRate).toFixed(2);
  }, [topupAmount, topupRate]);

  // conversionRate used for pay panel crypto equivalent preview (uses topupToken)
  const conversionRate = useMemo(() => prices[topupToken]?.usd ?? 1, [topupToken, prices]);

  const handleCardCreated = (holderName: string, design: CardDesignKey) => {
    createCard(holderName, design);
    setShowCreate(false);
    showToast('Card Created Successfully ✅', 'success');
  };

  const handleTopup = async () => {
    const amt = parseFloat(topupAmount);
    if (isNaN(amt) || amt <= 0) { showToast('Enter a valid amount', 'error'); return; }
    // Allow tiny epsilon for floating point rounding differences when hitting MAX
    if (amt > topupTokenBalance + 0.000001) { showToast(`Insufficient ${topupToken} balance`, 'error'); return; }
    setTopupLoading(true);
    await new Promise(r => setTimeout(r, 800));
    const ok = topupCard(topupToken, amt);
    setTopupLoading(false);
    if (ok) {
      showToast(`+$${topupUSD.toFixed(2)} added to card ✅`, 'success');
      setTopupAmount('');
      setShowTopup(false);
    } else showToast('Top-up failed. Check balance.', 'error');
  };

  const handleSpend = async () => {
    const amtUSD = parseFloat(merchant.amount);
    if (!merchant.name.trim()) { showToast('Enter a merchant name', 'error'); return; }
    if (isNaN(amtUSD) || amtUSD <= 0) { showToast('Enter a valid amount', 'error'); return; }
    if (amtUSD > 1000) { showToast('Exceeds per-payment limit ($1000)', 'error'); return; }
    if (cardFrozen) { showToast('Card is frozen. Unfreeze to spend.', 'error'); return; }
    if (amtUSD > cardBalance) { showToast('Insufficient card balance. Top up first.', 'error'); return; }

    setLoading(true);
    await new Promise(r => setTimeout(r, 900));
    const ok = spendCard(topupToken, amtUSD, `${merchant.icon} ${merchant.name.trim()}`);
    setLoading(false);
    if (ok) {
      showToast(`Paid $${amtUSD.toFixed(2)} to ${merchant.name.trim()} ✅`, 'success');
      setMerchant({ name: '', amount: '', icon: '🛍️' });
      setShowSpend(false);
    } else showToast('Payment failed. Try again.', 'error');
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
              cvv={cardDetails.cvv}
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

          {/* Balance Card */}
          <LinearGradient
            colors={[T.surfaceHigh, T.surface]}
            style={styles.premiumBalanceCard}
          >
            <View style={styles.balCardHeader}>
              <Text style={[styles.balCardLabel, { color: T.textDim }]}>CARD BALANCE</Text>
              <TouchableOpacity onPress={() => setBalanceHidden(v => !v)} activeOpacity={0.7}>
                <Feather name={balanceHidden ? 'eye-off' : 'eye'} size={16} color={T.textDim} />
              </TouchableOpacity>
            </View>
            <View style={styles.balCardMain}>
              {!balanceHidden && <Text style={[styles.currencySymbol, { color: T.text }]}>$</Text>}
              <Text style={[styles.mainBalText, { color: T.text }]}>
                {balanceHidden ? '••••••' : cardBalance.toFixed(2)}
              </Text>
              {!balanceHidden && <Text style={[styles.usdtTag, { color: T.textMuted }]}>USD</Text>}
            </View>
            <View style={[styles.cardDivider, { backgroundColor: T.border }]} />
            <View style={[styles.networkInfoRow, { justifyContent: 'space-between' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.statusIndicator, { backgroundColor: network === 'Sepolia' ? '#F59E0B' : '#00C853' }]} />
                <Text style={[styles.networkLabelText, { color: T.textMuted }]}>
                  {network.toUpperCase()} · LIVE PROTECTION ACTIVE
                </Text>
              </View>
              {cardBalance === 0 && (
                <Text style={{ color: CRIMSON, fontSize: 10, fontWeight: '800' }}>TOP UP TO SPEND</Text>
              )}
            </View>
          </LinearGradient>

          {/* Action buttons */}
          <View style={styles.mainActionsContainer}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: CRIMSON, flex: 1 }]}
              onPress={() => { setShowSpend(v => !v); setShowTopup(false); }}
              activeOpacity={0.9}
            >
              <Feather name="shopping-bag" size={20} color="#FFF" />
              <Text style={styles.actionBtnText}>Pay Now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: T.surfaceHigh, flex: 1 }]}
              onPress={() => { setShowTopup(v => !v); setShowSpend(false); }}
              activeOpacity={0.9}
            >
              <Feather name="plus-circle" size={20} color={T.text} />
              <Text style={[styles.actionBtnText, { color: T.text }]}>Top Up</Text>
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

          {/* Top Up Panel */}
          {showTopup && (
            <View style={[styles.panel, { backgroundColor: T.surface, borderColor: T.border, borderWidth: 1 }]}>
              <View style={styles.panelHeader}>
                <Text style={[styles.panelTitle, { color: T.text }]}>Top Up Card</Text>
                <TouchableOpacity onPress={() => { setShowTopup(false); setTopupAmount(''); }}>
                  <View style={[styles.closeIconBox, { backgroundColor: T.surfaceLow }]}>
                    <Feather name="x" size={14} color={T.textMuted} />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Token selector */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {COINS.map(c => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => { setTopupToken(c); setTopupAmount(''); }}
                    style={[
                      { flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: topupToken === c ? CRIMSON + '20' : T.surfaceLow,
                        borderWidth: 1, borderColor: topupToken === c ? CRIMSON : T.border },
                    ]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '800', color: topupToken === c ? CRIMSON : T.textDim }}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Amount input */}
              <Text style={[styles.availLabel, { color: T.textDim, marginBottom: 8 }]}>AMOUNT ({topupToken})</Text>
              <View style={[styles.miniInputBox, { backgroundColor: T.surfaceLow, marginBottom: 8 }]}>
                <TextInput
                  style={[styles.simpleInput, { color: T.text }]}
                  placeholder="0.00"
                  placeholderTextColor={T.textMuted}
                  keyboardType="decimal-pad"
                  value={topupAmount}
                  onChangeText={v => setTopupAmount(v.replace(/[^0-9.]/g, ''))}
                />
                <TouchableOpacity onPress={() => setTopupAmount((Math.floor(topupTokenBalance * 100000) / 100000).toString())}>
                  <Text style={{ color: CRIMSON, fontSize: 11, fontWeight: '900' }}>MAX</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                <Text style={[styles.availLabel, { color: T.textDim }]}>
                  Available: {topupTokenBalance.toFixed(4)} {topupToken}
                </Text>
                {topupUSD > 0 && (
                  <Text style={[styles.availLabel, { color: '#00C853' }]}>+${topupUSD.toFixed(2)} USD</Text>
                )}
              </View>

              <TouchableOpacity
                style={[styles.panelConfirmBtn, { backgroundColor: '#00C853' },
                  (!topupAmount || topupLoading) && { opacity: 0.5 }]}
                onPress={handleTopup}
                disabled={!topupAmount || topupLoading}
                activeOpacity={0.8}
              >
                {topupLoading
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={[styles.panelConfirmText, { color: '#FFF' }]}>
                      {topupUSD > 0 ? `Add $${topupUSD.toFixed(2)} to Card` : 'Enter Amount'}
                    </Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* Pay Panel */}
          {showSpend && (
            <View style={[styles.panel, { backgroundColor: T.surface, borderColor: T.border, borderWidth: 1 }]}>
              <View style={styles.panelHeader}>
                <Text style={[styles.panelTitle, { color: T.text }]}>New Payment</Text>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TouchableOpacity
                    style={[styles.closeIconBox, { backgroundColor: CRIMSON + '20', borderWidth: 1, borderColor: CRIMSON + '40' }]}
                    onPress={() => navigation.navigate('Scan', { returnTo: 'Card' })}
                    activeOpacity={0.75}
                  >
                    <Feather name="camera" size={14} color={CRIMSON} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setShowSpend(false); setMerchant({ name: '', amount: '', icon: '🛍️' }); }}>
                    <View style={[styles.closeIconBox, { backgroundColor: T.surfaceLow }]}>
                      <Feather name="x" size={14} color={T.textMuted} />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={[styles.availLabel, { color: T.textDim }]}>CARD BALANCE: ${cardBalance.toFixed(2)}</Text>
                {cardBalance === 0 && (
                  <TouchableOpacity onPress={() => { setShowSpend(false); setShowTopup(true); }}>
                    <Text style={[styles.availLabel, { color: CRIMSON }]}>TOP UP FIRST →</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Icon picker */}
              <Text style={[styles.availLabel, { color: T.textDim, marginBottom: 8 }]}>ICON</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {ICONS.map(ic => (
                    <TouchableOpacity
                      key={ic}
                      onPress={() => setMerchant(p => ({ ...p, icon: ic }))}
                      style={[
                        { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: T.surfaceLow },
                        merchant.icon === ic && { backgroundColor: CRIMSON + '25', borderWidth: 1.5, borderColor: CRIMSON },
                      ]}
                    >
                      <Text style={{ fontSize: 22 }}>{ic}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Merchant name */}
              <Text style={[styles.availLabel, { color: T.textDim, marginBottom: 8 }]}>MERCHANT NAME</Text>
              <View style={[styles.miniInputBox, { backgroundColor: T.surfaceLow, marginBottom: 14 }]}>
                <Text style={{ fontSize: 20, marginRight: 10 }}>{merchant.icon}</Text>
                <TextInput
                  style={[styles.simpleInput, { color: T.text }]}
                  placeholder="e.g. Netflix, Coffee Shop…"
                  placeholderTextColor={T.textMuted}
                  value={merchant.name}
                  onChangeText={v => setMerchant(p => ({ ...p, name: v }))}
                  maxLength={40}
                />
              </View>

              {/* Amount */}
              <Text style={[styles.availLabel, { color: T.textDim, marginBottom: 8 }]}>AMOUNT (USD)</Text>
              <View style={[styles.miniInputBox, { backgroundColor: T.surfaceLow, marginBottom: 20 }]}>
                <Text style={[styles.simpleInput, { color: T.textMuted, width: 18 }]}>$</Text>
                <TextInput
                  style={[styles.simpleInput, { color: T.text }]}
                  placeholder="0.00"
                  placeholderTextColor={T.textMuted}
                  keyboardType="decimal-pad"
                  value={merchant.amount}
                  onChangeText={v => setMerchant(p => ({ ...p, amount: v.replace(/[^0-9.]/g, '') }))}
                />
                <Text style={[styles.availLabel, { color: T.textDim }]}>
                  ≈ {merchant.amount.length > 0 && !isNaN(parseFloat(merchant.amount))
                    ? (parseFloat(merchant.amount) / conversionRate).toFixed(6)
                    : '0'} {topupToken}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.panelConfirmBtn, { backgroundColor: T.text },
                  (!merchant.name.trim() || !merchant.amount || loading) && { opacity: 0.5 }]}
                onPress={handleSpend}
                disabled={!merchant.name.trim() || !merchant.amount || loading}
                activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator color={T.background} />
                  : <Text style={[styles.panelConfirmText, { color: T.background }]}>
                      {merchant.name.trim().length > 0 && merchant.amount.length > 0
                        ? `Pay $${parseFloat(merchant.amount || '0').toFixed(2)} to ${merchant.name.trim()}`
                        : 'Fill in details to pay'}
                    </Text>
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

          {/* Physical Card CTA */}
          <TouchableOpacity
            style={[styles.physicalCardBtn, {
              backgroundColor: T.surface,
              borderColor: kycStatus === 'verified' ? T.success : T.border,
            }]}
            onPress={() => navigation.navigate(kycStatus === 'verified' ? 'ApplyPhysicalCard' : 'KYCStatus')}
            activeOpacity={0.8}
          >
            <View style={[styles.physicalCardIcon, { backgroundColor: kycStatus === 'verified' ? T.success + '20' : T.primary + '20' }]}>
              <Feather name="credit-card" size={20} color={kycStatus === 'verified' ? T.success : CRIMSON} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.physicalCardTitle, { color: T.text }]}>Physical Card</Text>
              <Text style={[styles.physicalCardSub, { color: T.textMuted }]}>
                {kycStatus === 'verified' ? 'Apply for a physical card' : 'Complete KYC to apply'}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={T.textMuted} />
          </TouchableOpacity>

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
                      {new Date(tx.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
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
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight ?? 0) + 16,
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
  physicalCardBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, borderRadius: 18, borderWidth: 1.5, marginBottom: 24,
  },
  physicalCardIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  physicalCardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  physicalCardSub: { fontSize: 12 },
});

