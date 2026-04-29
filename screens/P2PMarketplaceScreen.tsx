import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Platform, ActivityIndicator, Modal, Alert, ScrollView, Image } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useWallet } from '../store/WalletContext';
import { Theme } from '../constants';
import { p2pService, P2POrder, FIAT_CURRENCIES, PAYMENT_METHODS } from '../services/merchantService';

const TOKENS   = ['ETH', 'USDC', 'USDT', 'DAI'];
const COUNTRIES = ['United States','United Kingdom','India','UAE','Singapore','Germany','France','Australia','Canada','Brazil','Other'];

const TOKEN_COLORS: Record<string, string> = {
  ETH: '#627EEA', USDC: '#2775CA', USDT: '#26A17B', DAI: '#F5AC37',
};

const TOKEN_LOGOS: Record<string, string> = {
  ETH:  'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
  USDC: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
  USDT: 'https://assets.coingecko.com/coins/images/325/large/Tether.png',
  DAI:  'https://assets.coingecko.com/coins/images/9956/large/4943.png',
};

function TokenSymbolIcon({ token, size = 44 }: { token: string; size?: number }) {
  const color = TOKEN_COLORS[token] ?? '#888';
  const [failed, setFailed] = React.useState(false);
  const uri = TOKEN_LOGOS[token];
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color + '20', borderWidth: 1.5, borderColor: color + '40',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color, fontSize: size * 0.42, fontWeight: '900' }}>{token.charAt(0)}</Text>
    </View>
  );
}

function SkeletonCard({ T }: { T: any }) {
  return (
    <View style={[sk.card, { backgroundColor: T.surface }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <View style={[sk.circle, { backgroundColor: T.surfaceHigh }]} />
        <View style={{ gap: 6, flex: 1 }}>
          <View style={[sk.line, { backgroundColor: T.surfaceHigh, width: '50%' }]} />
          <View style={[sk.line, { backgroundColor: T.surfaceHigh, width: '30%' }]} />
        </View>
        <View style={[sk.line, { backgroundColor: T.surfaceHigh, width: 60 }]} />
      </View>
      <View style={[sk.line, { backgroundColor: T.surfaceHigh, width: '100%', height: 1, marginBottom: 14 }]} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={[sk.line, { backgroundColor: T.surfaceHigh, width: '35%' }]} />
        <View style={[sk.line, { backgroundColor: T.surfaceHigh, width: '25%' }]} />
      </View>
    </View>
  );
}
const sk = StyleSheet.create({
  card:   { borderRadius: 20, padding: 20, marginBottom: 12 },
  circle: { width: 44, height: 44, borderRadius: 22 },
  line:   { height: 10, borderRadius: 5 },
});

function OrderCard({ order, onPress, T, walletAddress }: { order: P2POrder; onPress: () => void; T: any; walletAddress: string }) {
  const isMine = order.seller_wallet.toLowerCase() === walletAddress.toLowerCase();
  const tokenColor = TOKEN_COLORS[order.token] ?? T.primary;

  const statusMeta: Record<string, { label: string; color: string }> = {
    open:      { label: 'OPEN',       color: T.success },
    in_escrow: { label: 'IN ESCROW',  color: '#6366F1' },
    fiat_sent: { label: 'FIAT SENT',  color: '#F59E0B' },
    completed: { label: 'COMPLETED',  color: T.success },
    cancelled: { label: 'CANCELLED',  color: T.textDim },
    disputed:  { label: 'DISPUTED',   color: T.error },
  };
  const { label: statusLabel, color: statusColor } = statusMeta[order.status] ?? { label: order.status.toUpperCase(), color: T.textDim };

  return (
    <TouchableOpacity style={[s.card, { backgroundColor: T.surface, borderColor: T.border, borderWidth: 1 }]} onPress={onPress} activeOpacity={0.75}>
      <View style={s.cardTop}>
        <TokenSymbolIcon token={order.token} size={44} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[s.tokenName, { color: T.text }]}>{order.token} Trade</Text>
            {isMine && (
              <View style={[s.minePill, { backgroundColor: T.surfaceHigh }]}>
                <Text style={[s.minePillText, { color: T.textMuted }]}>MINE</Text>
              </View>
            )}
          </View>
          <Text style={[s.sellerAddr, { color: T.textMuted }]}>
            Merchant: {order.seller_wallet.slice(0, 6)}…{order.seller_wallet.slice(-4)}
          </Text>
        </View>
        <View style={[s.statusPill, { backgroundColor: statusColor + '15' }]}>
          <Text style={[s.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      <View style={s.statsRow}>
        <View style={s.statLine}>
          <Text style={[s.statLabel, { color: T.textMuted }]}>Amount</Text>
          <Text style={[s.statValue, { color: T.text }]}>{order.amount} {order.token}</Text>
        </View>
        <View style={s.statLine}>
          <Text style={[s.statLabel, { color: T.textMuted }]}>Total Price</Text>
          <Text style={[s.statValueBig, { color: T.primary }]}>{order.fiat_total.toFixed(2)} {order.fiat_currency}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 }}>
        <Feather name="credit-card" size={14} color={T.textMuted} />
        <Text style={{ fontSize: 12, color: T.textMuted, fontWeight: '600' }}>{order.payment_method}</Text>
      </View>

      <TouchableOpacity style={[s.buyBtn, { backgroundColor: isMine ? T.surfaceHigh : T.primary }]} onPress={onPress}>
        <Text style={s.buyBtnText}>{isMine ? 'View Order' : `Buy ${order.token}`}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function P2PMarketplaceScreen({ navigation, route }: any) {
  const { walletAddress, isDarkMode, balances, lockedBalance, lockBalance, p2pCountry, p2pCurrency } = useWallet();
  const T = isDarkMode ? Theme.colors : Theme.lightColors;

  const [tab, setTab]         = useState<'buy' | 'sell'>(route?.params?.tab === 'sell' ? 'sell' : 'buy');

  useFocusEffect(useCallback(() => {
    if (route?.params?.tab) {
      setTab(route.params.tab);
    }
  }, [route?.params?.tab]));

  const [orders,  setOrders]  = useState<P2POrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterFiat, setFilterFiat] = useState(p2pCurrency || 'USD');
  const [showSellModal, setShowSellModal] = useState(false);

  const [sellToken,   setSellToken]   = useState('ETH');
  const [sellAmount,  setSellAmount]  = useState('');
  const [sellFiat,    setSellFiat]    = useState(p2pCurrency || 'USD');
  const [sellRate,    setSellRate]    = useState('');
  const [sellMethod,  setSellMethod]  = useState('Bank Transfer');
  const [sellCountry, setSellCountry] = useState(p2pCountry || 'United States');
  const [sellLoading, setSellLoading] = useState(false);

  const [fiatModal,    setFiatModal]    = useState(false);
  const [methodModal,  setMethodModal]  = useState(false);
  const [countryModal, setCountryModal] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = tab === 'buy'
        ? await p2pService.getOpenOrders(undefined, filterFiat)
        : await p2pService.getMyOrders(walletAddress);
      setOrders(data);
    } catch {}
    setLoading(false);
  }, [tab, filterFiat, walletAddress]);

  useEffect(() => { loadOrders(); }, [loadOrders]);
  useFocusEffect(useCallback(() => { loadOrders(); }, [loadOrders]));

  const handleCreateSellOrder = async () => {
    const amt  = parseFloat(sellAmount);
    const rate = parseFloat(sellRate);
    if (!amt || amt <= 0)   { Alert.alert('Invalid Amount', 'Enter a valid amount.'); return; }
    if (!rate || rate <= 0) { Alert.alert('Invalid Rate',   'Enter a valid rate.');   return; }
    const available = balances[sellToken] ?? 0;
    if (amt > available) { Alert.alert('Insufficient Balance', 'Some funds may be locked in active orders.'); return; }

    setSellLoading(true);
    try {
      await p2pService.createOrder({
        seller_wallet: walletAddress, token: sellToken, amount: amt,
        fiat_currency: sellFiat, rate, fiat_total: amt * rate,
        payment_method: sellMethod, country: sellCountry, is_merchant: false,
      });
      lockBalance(sellToken, amt);
      setShowSellModal(false);
      setSellAmount(''); setSellRate('');
      loadOrders();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to create order.');
    } finally { setSellLoading(false); }
  };

  const PickerModal = ({ visible, title, items, selected, onSelect, onClose }: any) => (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.modalOverlay}>
        <View style={[s.modalSheet, { backgroundColor: T.surface }]}>
          <View style={[s.modalHandle, { backgroundColor: T.border }]} />
          <Text style={[s.modalTitle, { color: T.text }]}>{title}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {items.map((item: string) => (
              <TouchableOpacity key={item} style={[s.modalRow, { borderBottomColor: T.border }]} onPress={() => { onSelect(item); onClose(); }}>
                <Text style={[s.modalRowText, { color: T.text }]}>{item}</Text>
                {selected === item && <Feather name="check" size={16} color={T.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={[s.root, { backgroundColor: T.background }]}>
      <PickerModal visible={fiatModal}    title="Fiat Currency"   items={FIAT_CURRENCIES} selected={sellFiat}    onSelect={setSellFiat}    onClose={() => setFiatModal(false)} />
      <PickerModal visible={methodModal}  title="Payment Method"  items={PAYMENT_METHODS} selected={sellMethod}  onSelect={setSellMethod}  onClose={() => setMethodModal(false)} />
      <PickerModal visible={countryModal} title="Country"         items={COUNTRIES}       selected={sellCountry} onSelect={setSellCountry} onClose={() => setCountryModal(false)} />

      {/* Sell Modal */}
      <Modal visible={showSellModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.sellSheet, { backgroundColor: T.surface }]}>
            {/* Handle + Header */}
            <View style={[s.modalHandle, { backgroundColor: T.border }]} />
            <View style={s.sellSheetHeader}>
              <View>
                <Text style={[s.modalTitle, { color: T.text }]}>Create Sell Order</Text>
                <Text style={[s.modalSubtitle, { color: T.textDim }]}>List your crypto for fiat payment</Text>
              </View>
              <TouchableOpacity style={[s.closeBtn, { backgroundColor: T.surfaceLow }]} onPress={() => setShowSellModal(false)}>
                <Feather name="x" size={18} color={T.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.sellFormContent}>

              {/* Token Selector */}
              <Text style={[s.fieldLabel, { color: T.textDim }]}>SELECT TOKEN</Text>
              <View style={s.tokenRow}>
                {TOKENS.map(t => {
                  const active = sellToken === t;
                  return (
                    <TouchableOpacity key={t}
                      style={[s.tokenBtn, { backgroundColor: active ? T.primary : T.surfaceLow, borderColor: active ? T.primary : T.border }]}
                      onPress={() => setSellToken(t)}>
                      <View style={[s.tokenDot, { backgroundColor: active ? 'rgba(255,255,255,0.3)' : TOKEN_COLORS[t] + '15', overflow: 'hidden' }]}>
                        <TokenSymbolIcon token={t} size={20} />
                      </View>
                      <Text style={[s.tokenBtnText, { color: active ? '#FFF' : T.text }]}>{t}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Balance Badge */}
              <View style={[s.balanceBadge, { backgroundColor: T.surfaceLow }]}>
                <MaterialIcons name="account-balance-wallet" size={13} color={T.textDim} />
                <Text style={[s.balanceBadgeText, { color: T.textDim }]}>Available: </Text>
                <Text style={[s.balanceBadgeValue, { color: T.text }]}>{(balances[sellToken] ?? 0).toFixed(6)} {sellToken}</Text>
              </View>

              {/* Amount */}
              <Text style={[s.fieldLabel, { color: T.textDim }]}>AMOUNT TO SELL</Text>
              <View style={[s.inputWrap, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
                <TextInput
                  style={[s.input, { color: T.text, flex: 1 }]}
                  value={sellAmount}
                  onChangeText={setSellAmount}
                  placeholder="0.00"
                  placeholderTextColor={T.textDim}
                  keyboardType="decimal-pad"
                />
                <View style={[s.inputBadge, { backgroundColor: T.surfaceHigh }]}>
                  <Text style={[s.inputBadgeText, { color: T.text }]}>{sellToken}</Text>
                </View>
              </View>

              {/* Rate + Fiat row */}
              <View style={s.rowFields}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.fieldLabel, { color: T.textDim }]}>RATE PER TOKEN</Text>
                  <View style={[s.inputWrap, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
                    <TextInput
                      style={[s.input, { color: T.text, flex: 1 }]}
                      value={sellRate}
                      onChangeText={setSellRate}
                      placeholder="0.00"
                      placeholderTextColor={T.textDim}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.fieldLabel, { color: T.textDim }]}>FIAT CURRENCY</Text>
                  <TouchableOpacity
                    style={[s.inputWrap, s.inputWrapRow, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
                    onPress={() => setFiatModal(true)}>
                    <Text style={[s.input, { color: T.text }]}>{sellFiat}</Text>
                    <Feather name="chevron-down" size={16} color={T.textDim} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Payment Method */}
              <Text style={[s.fieldLabel, { color: T.textDim }]}>PAYMENT METHOD</Text>
              <TouchableOpacity
                style={[s.inputWrap, s.inputWrapRow, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
                onPress={() => setMethodModal(true)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <Feather name="credit-card" size={15} color={T.textDim} />
                  <Text style={[s.input, { color: T.text }]}>{sellMethod}</Text>
                </View>
                <Feather name="chevron-down" size={16} color={T.textDim} />
              </TouchableOpacity>

              {/* Country */}
              <Text style={[s.fieldLabel, { color: T.textDim }]}>COUNTRY</Text>
              <TouchableOpacity
                style={[s.inputWrap, s.inputWrapRow, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
                onPress={() => setCountryModal(true)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <Feather name="map-pin" size={15} color={T.textDim} />
                  <Text style={[s.input, { color: T.text }]}>{sellCountry}</Text>
                </View>
                <Feather name="chevron-down" size={16} color={T.textDim} />
              </TouchableOpacity>

              {/* Total Preview */}
              {sellAmount && sellRate ? (
                <View style={[s.totalPreview, { backgroundColor: T.primary + '12', borderColor: T.primary + '30' }]}>
                  <View style={s.totalPreviewLeft}>
                    <Feather name="trending-up" size={16} color={T.primary} />
                    <Text style={[s.totalPreviewLabel, { color: T.textDim }]}>You'll receive</Text>
                  </View>
                  <Text style={[s.totalPreviewValue, { color: T.primary }]}>
                    {(parseFloat(sellAmount || '0') * parseFloat(sellRate || '0')).toFixed(2)} {sellFiat}
                  </Text>
                </View>
              ) : (
                <View style={[s.totalPreviewEmpty, { backgroundColor: T.surfaceLow, borderColor: T.border }]}>
                  <Feather name="info" size={14} color={T.textDim} />
                  <Text style={[s.totalPreviewEmptyText, { color: T.textDim }]}>Enter amount & rate to see total</Text>
                </View>
              )}

              {/* Actions */}
              <View style={s.modalActions}>
                <TouchableOpacity
                  style={[s.cancelBtn, { backgroundColor: T.surfaceLow, borderColor: T.border }]}
                  onPress={() => setShowSellModal(false)}>
                  <Text style={[s.cancelBtnText, { color: T.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.confirmBtn, { backgroundColor: T.primary, shadowColor: T.primary }, sellLoading && { opacity: 0.6 }]}
                  onPress={handleCreateSellOrder}
                  disabled={sellLoading}>
                  {sellLoading
                    ? <ActivityIndicator color="#FFF" />
                    : <>
                        <Feather name="upload" size={16} color="#FFF" />
                        <Text style={s.confirmBtnText}>List Order</Text>
                      </>}
                </TouchableOpacity>
              </View>

            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={[s.header, { borderBottomColor: T.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}>
          <Feather name="arrow-left" size={24} color={T.text} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row' }}>
           <Text style={[s.headerTitle, { color: T.primary }]}>P2P </Text>
           <Text style={[s.headerTitle, { color: T.text }]}>Marketplace</Text>
        </View>
        <TouchableOpacity 
          style={[s.iconBtn, { backgroundColor: T.surfaceLow }]}
          onPress={() => navigation.navigate('Settings')}
        >
          <Feather name="settings" size={20} color={T.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[s.tabBar, { borderBottomWidth: 1, borderBottomColor: T.border }]}>
        {(['buy', 'sell'] as const).map(t => (
          <TouchableOpacity key={t} style={[s.tabItem, tab === t && [s.tabItemActive, { borderBottomColor: T.primary }]]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, { color: tab === t ? T.primary : T.textMuted }]}>
              {t === 'buy' ? 'Buy' : 'Sell / My Orders'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Fiat filter chips */}
      {tab === 'buy' && (
        <View style={[s.filterBar, { borderBottomColor: T.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingVertical: 14 }}>
            {FIAT_CURRENCIES.map(f => (
              <TouchableOpacity key={f}
                style={[s.chip, { backgroundColor: filterFiat === f ? T.primary : T.surfaceLow, borderColor: filterFiat === f ? T.primary : T.border }]}
                onPress={() => setFilterFiat(f)}>
                <Text style={[s.chipText, { color: filterFiat === f ? '#FFF' : T.text }]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* List */}
      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {[1, 2, 3].map(i => <SkeletonCard key={i} T={T} />)}
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => item.id ?? Math.random().toString()}
          renderItem={({ item }) => (
            <OrderCard order={item} T={T} walletAddress={walletAddress}
              onPress={() => navigation.navigate('P2POrderDetail', { order: item })} />
          )}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={[s.emptyIcon, { backgroundColor: T.surfaceLow }]}>
                <Feather name="inbox" size={32} color={T.textDim} />
              </View>
              <Text style={[s.emptyTitle, { color: T.text }]}>No orders found</Text>
              <Text style={[s.emptySub, { color: T.textMuted }]}>
                {tab === 'buy' ? 'No open orders for this currency yet.' : 'Tap + to create your first sell order.'}
              </Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      {tab === 'sell' && (
        <TouchableOpacity style={[s.fab, { backgroundColor: T.primary, shadowColor: T.primary }]} onPress={() => setShowSellModal(true)} activeOpacity={0.85}>
          <Feather name="plus" size={26} color="#FFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 20 : 56, paddingBottom: 16, borderBottomWidth: 1 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },

  tabBar: { flexDirection: 'row' },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomWidth: 2 },
  tabText: { fontSize: 13, fontWeight: '800' },

  filterBar: { borderBottomWidth: 1 },
  chip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '700' },

  list: { padding: 16, paddingBottom: 110 },

  // Order card
  card: { borderRadius: 24, padding: 20, marginBottom: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  tokenAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  tokenAvatarText: { fontSize: 13, fontWeight: '900' },
  tokenName: { fontSize: 16, fontWeight: '800' },
  sellerAddr: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  minePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  minePillText: { fontSize: 9, fontWeight: '900' },
  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusLabel: { fontSize: 10, fontWeight: '900' },
  statsRow: { marginBottom: 20, gap: 12 },
  statLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { fontSize: 13, fontWeight: '500' },
  statValue: { fontSize: 14, fontWeight: '800' },
  statValueBig: { fontSize: 18, fontWeight: '900' },
  buyBtn: { width: '100%', height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  buyBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  // Empty
  empty: { alignItems: 'center', paddingTop: 72, gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptySub: { fontSize: 13, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },

  // FAB
  fab: { position: 'absolute', bottom: 32, right: 24, width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 10 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet:   { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '65%' },
  sellSheet:    { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 0, maxHeight: '92%' },
  modalHandle:  { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle:   { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  modalSubtitle:{ fontSize: 13, fontWeight: '500', marginTop: 3 },
  sellSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sellFormContent: { paddingBottom: 32 },
  modalRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  modalRowText: { fontSize: 15, fontWeight: '600' },

  fieldLabel:  { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  tokenRow:    { flexDirection: 'row', gap: 8 },
  tokenBtn:    { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, gap: 4 },
  tokenDot:    { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tokenBtnText:{ fontSize: 12, fontWeight: '800' },

  balanceBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginTop: 10, alignSelf: 'flex-start' },
  balanceBadgeText: { fontSize: 12, fontWeight: '600' },
  balanceBadgeValue: { fontSize: 12, fontWeight: '800' },

  rowFields:   { flexDirection: 'row', gap: 12 },
  inputWrap:   { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, height: 52, justifyContent: 'center', flexDirection: 'row', alignItems: 'center' },
  inputWrapRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input:       { fontSize: 15, fontWeight: '600' },
  inputBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  inputBadgeText: { fontSize: 12, fontWeight: '800' },
  inputSuffix: { fontSize: 11, marginTop: 2 },

  totalPreview:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1.5, marginTop: 20 },
  totalPreviewLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  totalPreviewLabel: { fontSize: 13, fontWeight: '600' },
  totalPreviewValue: { fontSize: 18, fontWeight: '900' },
  totalPreviewEmpty: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 14, borderWidth: 1.5, marginTop: 20 },
  totalPreviewEmptyText: { fontSize: 13, fontWeight: '600' },

  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn:    { flex: 1, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  cancelBtnText:{ fontSize: 15, fontWeight: '700' },
  confirmBtn:   { flex: 2, height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 6 },
  confirmBtnText:{ color: '#FFF', fontSize: 15, fontWeight: '900' },
});
